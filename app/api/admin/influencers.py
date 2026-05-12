from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.admin.common import ensure_admin
from app.core.session import get_db
from app.data.enums import InfluencerPublicationStatus
from app.data.models import Influencer, PreInfluencer, User
from app.data.schemas.influencer import (
    InfluencerDetail,
    InfluencerPublicationStatusResponse,
    InfluencerPublicationUpdateRequest,
)
from app.services.use_cases.influencer_detail import build_influencer_detail
from app.services.use_cases.mj_pre_influencer_progress import (
    normalize_influencer_id_from_username,
)
from app.services.use_cases.mjfp_pre_influencer_webhook import (
    schedule_mjfp_pre_influencer_step_webhook,
)
from app.utils.auth.dependencies import get_current_user

router = APIRouter(tags=["Admin Influencers"])


@router.get(
    "/influencers",
    response_model=list[InfluencerDetail],
    summary="List influencers for admin selectors",
    description="Return all influencers for admin-only selector flows, including unpublished influencers.",
)
async def list_admin_influencers(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    result = await db.execute(select(Influencer))
    influencers = result.scalars().all()
    return [await build_influencer_detail(influencer) for influencer in influencers]


@router.post(
    "/influencers/{influencer_id}/publication",
    response_model=InfluencerPublicationStatusResponse,
)
async def update_admin_influencer_publication(
    influencer_id: str,
    payload: InfluencerPublicationUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)

    influencer = await db.get(Influencer, influencer_id)
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer not found")

    influencer.publication_status = (
        InfluencerPublicationStatus.PUBLISHED.value
        if payload.published
        else InfluencerPublicationStatus.DRAFT.value
    )
    db.add(influencer)
    await db.commit()
    await db.refresh(influencer)

    result = await db.execute(select(PreInfluencer))
    for pre in result.scalars().all():
        if normalize_influencer_id_from_username(pre.username) == influencer_id:
            schedule_mjfp_pre_influencer_step_webhook(pre.id)

    return InfluencerPublicationStatusResponse(
        influencer_id=influencer.id,
        publication_status=InfluencerPublicationStatus(influencer.publication_status),
    )
