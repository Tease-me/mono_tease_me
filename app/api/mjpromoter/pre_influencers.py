from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.internal_auth import require_internal_token
from app.core.session import get_db
from app.services.use_cases.approve_pre_influencer import (
    approve_pre_influencer as run_pre_influencer_approval,
)

router = APIRouter(
    prefix="/pre-influencers",
)


@router.post("/{pre_id}/approve")
async def approve_pre_influencer_internal(
    pre_id: int,
    _internal_auth: None = Depends(require_internal_token),
    db: AsyncSession = Depends(get_db),
):
    return await run_pre_influencer_approval(db, pre_id)
