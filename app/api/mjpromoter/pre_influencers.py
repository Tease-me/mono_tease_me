from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.internal_auth import require_internal_token
from app.core.session import get_db
from app.data.schemas.pre_influencer import (
    MJPreInfluencerStepProgressRequest,
    MJPreInfluencerStepProgressOut,
    PreInfluencerAdminOut,
)
from app.services.repositories.pre_influencer_repository import (
    get_pre_influencer_by_progress_identity,
    list_pre_influencers as list_pre_influencers_repo,
)
from app.services.use_cases.pre_influencer_output import build_pre_influencer_admin_out
from app.services.use_cases.approve_pre_influencer import (
    approve_pre_influencer as run_pre_influencer_approval,
)

router = APIRouter(
    prefix="/pre-influencers",
)


@router.get("", response_model=list[PreInfluencerAdminOut])
async def list_pre_influencers_internal(
    status: str | None = None,
    _internal_auth: None = Depends(require_internal_token),
    db: AsyncSession = Depends(get_db),
):
    rows = await list_pre_influencers_repo(db, status=status)
    return [build_pre_influencer_admin_out(row) for row in rows]


@router.post("/step-progress", response_model=MJPreInfluencerStepProgressOut)
async def get_pre_influencer_step_progress_internal(
    payload: MJPreInfluencerStepProgressRequest,
    _internal_auth: None = Depends(require_internal_token),
    db: AsyncSession = Depends(get_db),
):
    invite_code = payload.invite_code.strip()
    if not invite_code:
        raise HTTPException(status_code=422, detail="invite_code is required")

    pre = await get_pre_influencer_by_progress_identity(
        db,
        invite_code=invite_code,
        new_user_email=str(payload.new_user_email).strip().lower(),
    )

    if not pre:
        raise HTTPException(
            status_code=404,
            detail="Pre-influencer progress target not found",
        )

    return MJPreInfluencerStepProgressOut(
        pre_influencer_id=pre.id,
        username=pre.username,
        survey_step=pre.survey_step or 0,
        status=pre.status,
    )


@router.post("/{pre_id}/approve")
async def approve_pre_influencer_internal(
    pre_id: int,
    _internal_auth: None = Depends(require_internal_token),
    db: AsyncSession = Depends(get_db),
):
    return await run_pre_influencer_approval(db, pre_id)
