"""Redeem a first-deposit gift promo code."""

import asyncio
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.models import GiftCode, User
from app.services.billing import topup_wallet
from app.services.credit_conversion import balance_cents_to_credits
from app.services.repositories import gift_code_repository as repo
from app.services.use_cases.mjfp_gift_redeemed_webhook import notify_mjfp_promo_code_redeemed
from app.utils.gift_code_generator import normalize_gift_code

CENTS_PER_USD = 100
CREDITS_PER_USD = 60


def credits_to_cents(credits: int) -> int:
    return (credits * CENTS_PER_USD) // CREDITS_PER_USD


async def _ensure_not_expired(db: AsyncSession, gift: GiftCode) -> None:
    now = datetime.now(timezone.utc)
    if gift.expires_at < now and gift.status in ("pending", "sent"):
        await repo.mark_expired(db, gift)
        await db.commit()
        raise HTTPException(status_code=410, detail="Gift code has expired")


async def redeem_gift_code(
    db: AsyncSession,
    *,
    user: User,
    code: str,
) -> dict:
    normalized = normalize_gift_code(code)
    gift = await repo.get_by_code(db, normalized)
    if not gift:
        raise HTTPException(status_code=404, detail="Invalid promo code")

    if gift.user_id != user.id:
        raise HTTPException(
            status_code=403,
            detail="This promo code can only be redeemed with the email it was issued to",
        )

    await _ensure_not_expired(db, gift)

    if gift.status == "accepted":
        raise HTTPException(status_code=409, detail="Promo code already redeemed")
    if gift.status == "expired":
        raise HTTPException(status_code=410, detail="Gift code has expired")
    if gift.status != "sent":
        raise HTTPException(status_code=400, detail="Promo code is not yet available to redeem")

    cents = credits_to_cents(gift.diamonds)
    source = f"gift_code:{gift.code}"

    new_balance = await topup_wallet(
        db,
        user_id=user.id,
        influencer_id=gift.influencer_id,
        cents=cents,
        source=source,
        is_18=False,
    )

    await repo.mark_redeemed(db, gift)
    await db.commit()

    redeemed_at = datetime.now(timezone.utc)
    asyncio.create_task(
        notify_mjfp_promo_code_redeemed(
            promo_code=gift.code,
            redeemed_at=redeemed_at,
        )
    )

    return {
        "ok": True,
        "diamonds": gift.diamonds,
        "new_balance_cents": new_balance,
        "new_balance_credits": balance_cents_to_credits(int(new_balance)),
    }
