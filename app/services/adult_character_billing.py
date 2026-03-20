from datetime import date

from fastapi import HTTPException
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    AdultCharacter,
    DailyUsage,
    InfluencerCreditTransaction,
    InfluencerWallet,
    User,
)
from app.repositories.billing_repository import get_wallet_balance_cents


def _compute_adult_character_voice_cost_cents(
    *,
    character: AdultCharacter,
    units: int,
) -> int:
    unit_price_millicents = max(int(character.voice_price_millicents or 0), 0)
    cost_millicents = max(int(units), 0) * unit_price_millicents
    return (cost_millicents + 999) // 1000 if cost_millicents > 0 else 0


async def can_afford_adult_character_voice(
    db: AsyncSession,
    *,
    user_id: int,
    influencer_id: str,
    character: AdultCharacter,
    units: int,
) -> tuple[bool, int, int]:
    cost_cents = _compute_adult_character_voice_cost_cents(
        character=character,
        units=units,
    )
    balance_cents = await get_wallet_balance_cents(
        db,
        user_id=user_id,
        influencer_id=influencer_id,
        is_18=False,
    )
    return (balance_cents >= cost_cents or cost_cents == 0), cost_cents, 0


async def _record_adult_character_voice_usage(
    db: AsyncSession,
    *,
    user_id: int,
    units: int,
) -> None:
    today = date.today()
    usage = await db.get(DailyUsage, (user_id, today, True))
    if not usage:
        usage = DailyUsage(user_id=user_id, date=today, is_18=True)

    for field in ["text_count", "voice_secs", "live_secs"]:
        if getattr(usage, field, None) is None:
            setattr(usage, field, 0)

    usage.live_secs += max(int(units), 0)
    db.add(usage)


async def charge_adult_character_voice_call(
    db: AsyncSession,
    *,
    user_id: int,
    influencer_id: str,
    character: AdultCharacter,
    units: int,
    meta: dict | None = None,
    allow_partial: bool = False,
    auto_commit: bool = True,
) -> int:
    await _record_adult_character_voice_usage(
        db,
        user_id=user_id,
        units=units,
    )

    cost = _compute_adult_character_voice_cost_cents(
        character=character,
        units=units,
    )
    if cost:
        wallet = await db.scalar(
            select(InfluencerWallet).where(
                and_(
                    InfluencerWallet.user_id == user_id,
                    InfluencerWallet.influencer_id == influencer_id,
                    InfluencerWallet.is_18.is_(False),
                )
            )
        )

        if not wallet:
            wallet = InfluencerWallet(
                user_id=user_id,
                influencer_id=influencer_id,
                is_18=False,
                balance_cents=0,
            )
            db.add(wallet)
            await db.flush()

        old_balance = int(wallet.balance_cents or 0)
        if old_balance < cost:
            if allow_partial:
                cost = old_balance
            else:
                raise HTTPException(402, "Insufficient credits")

        wallet.balance_cents = old_balance - cost
        db.add(wallet)

        new_balance = int(wallet.balance_cents or 0)
        threshold = 1000
        if old_balance >= threshold and new_balance < threshold:
            user_obj = await db.get(User, user_id)
            if user_obj and user_obj.email:
                try:
                    from app.api.notify_ws import notify_low_balance

                    await notify_low_balance(user_obj.email, new_balance)
                except Exception as exc:
                    print(f"Error sending low balance notification: {exc}")

    tx_meta = dict(meta or {})
    tx_meta.setdefault("adult_character_id", character.id)
    tx_meta.setdefault("voice_price_millicents", int(character.voice_price_millicents or 0))
    db.add(
        InfluencerCreditTransaction(
            user_id=user_id,
            influencer_id=influencer_id,
            feature="adult_character_voice",
            units=-max(int(units), 0),
            amount_cents=-cost,
            meta=tx_meta,
        )
    )

    if auto_commit:
        await db.commit()
    else:
        await db.flush()

    return cost


async def get_remaining_adult_character_voice_secs(
    db: AsyncSession,
    *,
    user_id: int,
    influencer_id: str,
    character: AdultCharacter,
) -> int:
    unit_price_millicents = max(int(character.voice_price_millicents or 0), 0)
    if unit_price_millicents <= 0:
        return 0

    balance_cents = await get_wallet_balance_cents(
        db,
        user_id=user_id,
        influencer_id=influencer_id,
        is_18=False,
    )
    return (balance_cents * 1000) // unit_price_millicents
