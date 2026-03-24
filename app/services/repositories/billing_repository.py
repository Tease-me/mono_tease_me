from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.models import InfluencerWallet


async def get_influencer_wallet(
    db: AsyncSession,
    *,
    user_id: int,
    influencer_id: str,
    is_18: bool,
) -> InfluencerWallet | None:
    return await db.scalar(
        select(InfluencerWallet).where(
            and_(
                InfluencerWallet.user_id == user_id,
                InfluencerWallet.influencer_id == influencer_id,
                InfluencerWallet.is_18.is_(is_18),
            )
        )
    )


async def get_wallet_balance_cents(
    db: AsyncSession,
    *,
    user_id: int,
    influencer_id: str,
    is_18: bool,
) -> int:
    wallet = await get_influencer_wallet(
        db,
        user_id=user_id,
        influencer_id=influencer_id,
        is_18=is_18,
    )
    if not wallet or wallet.balance_cents is None:
        return 0
    return int(wallet.balance_cents)
