from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.internal_auth import require_internal_token
from app.core.session import get_db
from app.data.schemas.pre_influencer import PreInfluencerAdminOut
from app.services.repositories.pre_influencer_repository import (
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


@router.post("/{pre_id}/approve")
async def approve_pre_influencer_internal(
    pre_id: int,
    _internal_auth: None = Depends(require_internal_token),
    db: AsyncSession = Depends(get_db),
):
    return await run_pre_influencer_approval(db, pre_id)
