from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.enums import InfluencerPublicationStatus
from app.data.models import Influencer


async def ensure_influencer(
    db: AsyncSession,
    influencer_id: str,
) -> Influencer:
    influencer = await db.get(Influencer, influencer_id)
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer not found")
    return influencer


async def ensure_published_influencer(
    db: AsyncSession,
    influencer_id: str,
) -> Influencer:
    influencer = await ensure_influencer(db, influencer_id)
    if influencer.publication_status != InfluencerPublicationStatus.PUBLISHED.value:
        raise HTTPException(status_code=404, detail="Influencer not found")
    return influencer
