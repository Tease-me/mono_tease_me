from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.internal_auth import require_internal_token
from app.core.session import get_db
from app.data.schemas.pre_influencer import (
    MJPreInfluencerAssetLinkOut,
    MJPreInfluencerApproveOut,
    MJPreInfluencerStepProgressRequest,
    MJPreInfluencerStepProgressOut,
    MJPreInfluencerSurveyLinkOut,
    PreInfluencerAdminOut,
)
from app.services.repositories.pre_influencer_repository import (
    get_pre_influencer_by_progress_identity,
    list_pre_influencers as list_pre_influencers_repo,
)
from app.services.use_cases.mj_pre_influencer_progress import derive_mj_survey_step
from app.services.use_cases.pre_influencer_output import build_pre_influencer_admin_out
from app.services.use_cases.pre_influencer_survey_link import (
    build_pre_influencer_survey_link,
)
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


def _normalize_invite_code(invite_code: str) -> str:
    normalized = invite_code.strip()
    if not normalized:
        raise HTTPException(status_code=422, detail="invite_code is required")
    return normalized


async def _get_pre_influencer_by_mj_lookup(
    db: AsyncSession,
    payload: MJPreInfluencerStepProgressRequest,
):
    return await get_pre_influencer_by_progress_identity(
        db,
        invite_code=_normalize_invite_code(payload.invite_code),
        invitee_email=str(payload.invitee_email).strip().lower(),
    )


def _get_asset_link(pre) -> str | None:
    answers = pre.survey_answers if isinstance(pre.survey_answers, dict) else {}
    raw_asset_link = answers.get("asset_link")
    asset_link = raw_asset_link.strip() if isinstance(raw_asset_link, str) else None
    return asset_link or None


async def _approve_pre_influencer_for_mj(
    db: AsyncSession,
    pre_id: int,
) -> MJPreInfluencerApproveOut:
    await run_pre_influencer_approval(db, pre_id)
    return MJPreInfluencerApproveOut(
        pre_influencer_id=pre_id,
        status="approved",
    )


@router.post("/step-progress", response_model=MJPreInfluencerStepProgressOut)
async def get_pre_influencer_step_progress_internal(
    payload: MJPreInfluencerStepProgressRequest,
    _internal_auth: None = Depends(require_internal_token),
    db: AsyncSession = Depends(get_db),
):
    pre = await _get_pre_influencer_by_mj_lookup(db, payload)

    if not pre:
        raise HTTPException(
            status_code=404,
            detail="Pre-influencer progress target not found",
        )

    return MJPreInfluencerStepProgressOut(
        pre_influencer_id=pre.id,
        username=pre.username,
        survey_step=await derive_mj_survey_step(db, pre),
        status=pre.status,
        asset_link=_get_asset_link(pre),
        survey_link=build_pre_influencer_survey_link(
            token=pre.survey_token,
            temp_password=pre.password,
        ),
    )


@router.post("/asset-link", response_model=MJPreInfluencerAssetLinkOut)
async def get_pre_influencer_asset_link_internal(
    payload: MJPreInfluencerStepProgressRequest,
    _internal_auth: None = Depends(require_internal_token),
    db: AsyncSession = Depends(get_db),
):
    pre = await _get_pre_influencer_by_mj_lookup(db, payload)

    if not pre:
        raise HTTPException(
            status_code=404,
            detail="Pre-influencer asset link target not found",
        )

    return MJPreInfluencerAssetLinkOut(
        pre_influencer_id=pre.id,
        username=pre.username,
        asset_link=_get_asset_link(pre),
    )


@router.post("/survey-link", response_model=MJPreInfluencerSurveyLinkOut)
async def get_pre_influencer_survey_link_internal(
    payload: MJPreInfluencerStepProgressRequest,
    _internal_auth: None = Depends(require_internal_token),
    db: AsyncSession = Depends(get_db),
):
    pre = await _get_pre_influencer_by_mj_lookup(db, payload)

    if not pre:
        raise HTTPException(
            status_code=404,
            detail="Pre-influencer survey link target not found",
        )

    return MJPreInfluencerSurveyLinkOut(
        pre_influencer_id=pre.id,
        username=pre.username,
        survey_link=build_pre_influencer_survey_link(
            token=pre.survey_token,
            temp_password=pre.password,
        ),
    )


@router.post("/approve", response_model=MJPreInfluencerApproveOut)
async def approve_pre_influencer_by_mj_lookup_internal(
    payload: MJPreInfluencerStepProgressRequest,
    _internal_auth: None = Depends(require_internal_token),
    db: AsyncSession = Depends(get_db),
):
    pre = await _get_pre_influencer_by_mj_lookup(db, payload)

    if not pre:
        raise HTTPException(
            status_code=404,
            detail="Pre-influencer approval target not found",
        )

    return await _approve_pre_influencer_for_mj(db, pre.id)


@router.post("/{pre_id}/approve", response_model=MJPreInfluencerApproveOut)
async def approve_pre_influencer_internal(
    pre_id: int,
    _internal_auth: None = Depends(require_internal_token),
    db: AsyncSession = Depends(get_db),
):
    return await _approve_pre_influencer_for_mj(db, pre_id)
