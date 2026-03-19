from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AdultCharacter, Influencer, InfluencerCharacterMeta


async def get_influencer_by_id(db: AsyncSession, influencer_id: str) -> Influencer | None:
    return await db.get(Influencer, influencer_id)


async def get_adult_character_by_id(
    db: AsyncSession,
    character_id: int,
) -> AdultCharacter | None:
    return await db.get(AdultCharacter, character_id)


async def get_active_influencer_character_meta(
    db: AsyncSession,
    influencer_id: str,
    character_id: int,
) -> InfluencerCharacterMeta | None:
    result = await db.execute(
        select(InfluencerCharacterMeta).where(
            InfluencerCharacterMeta.influencer_id == influencer_id,
            InfluencerCharacterMeta.character_id == character_id,
            InfluencerCharacterMeta.is_active.is_(True),
        )
    )
    return result.scalars().first()
