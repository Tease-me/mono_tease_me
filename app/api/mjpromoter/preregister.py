from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.internal_auth import require_internal_token
from app.core.config import settings
from app.core.session import get_db
from app.data.schemas.mjpromoter import (
    MjpromoterPreregisterRequest,
    MjpromoterPreregisterResponse,
)
from app.services.use_cases.preregister_mjpromoter_user import (
    preregister_mjpromoter_user as preregister_mjpromoter_user_use_case,
)
from app.utils.infrastructure.rate_limiter import rate_limit

router = APIRouter()


@router.post("/preregister", response_model=MjpromoterPreregisterResponse)
@rate_limit(
    max_requests=settings.RATE_LIMIT_AUTH_MAX,
    window_seconds=settings.RATE_LIMIT_AUTH_WINDOW,
    key_prefix="mjpromoter:preregister",
)
async def preregister_mjpromoter_user(
    request: Request,
    data: MjpromoterPreregisterRequest,
    db: AsyncSession = Depends(get_db),
    _internal_auth: None = Depends(require_internal_token),
):
    return await preregister_mjpromoter_user_use_case(db, data)
