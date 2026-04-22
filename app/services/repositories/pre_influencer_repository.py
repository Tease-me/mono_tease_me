from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.models.influencer import PreInfluencer


async def list_pre_influencers(
    db: AsyncSession,
    *,
    status: str | None = None,
) -> list[PreInfluencer]:
    query = select(PreInfluencer).order_by(PreInfluencer.created_at.desc(), PreInfluencer.id.desc())
    if status:
        query = query.where(PreInfluencer.status == status)

    result = await db.execute(query)
    return list(result.scalars().all())
