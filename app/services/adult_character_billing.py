from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AdultCharacter
from app.repositories.billing_repository import get_wallet_balance_cents


async def can_afford_adult_character_voice(
    db: AsyncSession,
    *,
    user_id: int,
    influencer_id: str,
    character: AdultCharacter,
    units: int,
) -> tuple[bool, int, int]:
    unit_price_millicents = max(int(character.voice_price_millicents or 0), 0)
    cost_millicents = max(int(units), 0) * unit_price_millicents
    cost_cents = (cost_millicents + 999) // 1000 if cost_millicents > 0 else 0
    balance_cents = await get_wallet_balance_cents(
        db,
        user_id=user_id,
        influencer_id=influencer_id,
        is_18=False,
    )
    return (balance_cents >= cost_cents or cost_cents == 0), cost_cents, 0


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
