from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.models import PreInfluencer
from app.data.schemas.pre_influencer import MJPreInfluencerApproveOut


async def approve_pre_influencer_status_only(
    db: AsyncSession,
    pre_id: int,
) -> MJPreInfluencerApproveOut:
    pre = await db.get(PreInfluencer, pre_id)
    if not pre:
        raise HTTPException(status_code=404, detail="PreInfluencer not found")

    pre.status = "approved"
    db.add(pre)
    await db.commit()
    await db.refresh(pre)

    return MJPreInfluencerApproveOut(
        pre_influencer_id=pre.id,
        status=pre.status,
    )
