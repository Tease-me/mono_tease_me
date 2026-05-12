from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.admin.common import ensure_admin
from app.core.session import get_db
from app.data.enums import InfluencerPublicationStatus
from app.data.models import Influencer, User
from app.data.schemas.influencer import (
    InfluencerDetail,
    InfluencerPublicationStatusResponse,
    InfluencerPublicationUpdateRequest,
)
from app.services.repositories.pre_influencer_repository import (
    list_pre_influencer_ids_for_influencer_id,
)
from app.services.use_cases.influencer_detail import build_influencer_detail
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

    pre_ids = await list_pre_influencer_ids_for_influencer_id(
        db, influencer_id=influencer.id
    )
    for pre_id in pre_ids:
        schedule_mjfp_pre_influencer_step_webhook(pre_id)

    return InfluencerPublicationStatusResponse(
        influencer_id=influencer.id,
        publication_status=InfluencerPublicationStatus(influencer.publication_status),
    )
