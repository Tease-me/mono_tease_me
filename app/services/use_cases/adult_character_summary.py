from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.models import CallRecord, InfluencerCreditTransaction, Pricing
from app.data.schemas.billing import AdultCharacterSummaryOut, LatestAdultCallSummaryOut
from app.services.repositories.billing_repository import get_wallet_balance_cents


async def get_adult_character_summary(
    db: AsyncSession,
    *,
    user_id: int,
    influencer_id: str,
) -> AdultCharacterSummaryOut:
    balance_cents = await get_wallet_balance_cents(
        db,
        user_id=user_id,
        influencer_id=influencer_id,
        is_18=False,
    )
    pricing = await db.scalar(
        select(Pricing).where(
            Pricing.feature == "live_chat_18",
            Pricing.is_active.is_(True),
        )
    )
    unit_price_cents = int(pricing.price_cents or 0) if pricing else 0
    estimated_remaining_call_seconds: int | None = (
        balance_cents // unit_price_cents if unit_price_cents > 0 else None
    )

    latest_adult_call = await db.scalar(
        select(CallRecord)
        .where(
            CallRecord.user_id == user_id,
            CallRecord.influencer_id == influencer_id,
            CallRecord.is_adult_call.is_(True),
        )
        .order_by(CallRecord.created_at.desc())
    )

    latest_adult_call_summary: LatestAdultCallSummaryOut | None = None

    if latest_adult_call:
        latest_adult_call_cost = await db.scalar(
            select(InfluencerCreditTransaction.amount_cents)
            .where(
                InfluencerCreditTransaction.user_id == user_id,
                InfluencerCreditTransaction.feature == "live_chat_18",
                InfluencerCreditTransaction.meta["conversation_id"].as_string()
                == latest_adult_call.conversation_id,
            )
            .order_by(InfluencerCreditTransaction.created_at.desc())
        )

        latest_adult_call_summary = LatestAdultCallSummaryOut(
            duration_seconds=latest_adult_call.call_duration_secs,
            cost_cents=(
                abs(int(latest_adult_call_cost))
                if latest_adult_call_cost is not None
                else None
            ),
        )

    return AdultCharacterSummaryOut(
        influencer_id=influencer_id,
        balance_cents=balance_cents,
        estimated_remaining_call_seconds=estimated_remaining_call_seconds,
        latest_adult_call_summary=latest_adult_call_summary,
    )
