import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.admin.common import ensure_admin
from app.data.models import User
from app.core.session import get_db
from app.services.use_cases.admin_user_analytics import (
    get_analytics_overview,
    get_user_detail,
    get_user_engagement,
    get_user_growth,
    get_user_retention,
    get_user_spending,
)
from app.utils.auth.dependencies import get_current_user

router = APIRouter(tags=["admin-analytics"])
log = logging.getLogger(__name__)


@router.get(
    "/analytics/overview",
    summary="Get analytics overview",
    description="Return the high-level admin analytics KPI overview.",
)
async def analytics_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    try:
        return await get_analytics_overview(db)
    except Exception:
        log.error("analytics_overview_failed", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch analytics overview")


@router.get(
    "/analytics/user-growth",
    summary="Get user growth analytics",
    description="Return registration and growth trends for the requested period.",
)
async def analytics_user_growth(
    period: str = "30d",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    try:
        return await get_user_growth(db, period)
    except Exception:
        log.error("analytics_user_growth_failed", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch user growth data")


@router.get(
    "/analytics/user-engagement",
    summary="Get user engagement analytics",
    description="Return admin engagement metrics such as activity volume and active users.",
)
async def analytics_user_engagement(
    period: str = "24h",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    try:
        return await get_user_engagement(db, period)
    except Exception:
        log.error("analytics_user_engagement_failed", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch user engagement data")


@router.get(
    "/analytics/user-spending",
    summary="Get user spending analytics",
    description="Return admin revenue and spending metrics for the requested period.",
)
async def analytics_user_spending(
    period: str = "30d",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    try:
        return await get_user_spending(db, period)
    except Exception:
        log.error("analytics_user_spending_failed", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch user spending data")


@router.get(
    "/analytics/user-retention",
    summary="Get user retention analytics",
    description="Return retention and active user trend metrics for the requested period.",
)
async def analytics_user_retention(
    period: str = "30d",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    try:
        return await get_user_retention(db, period)
    except Exception:
        log.error("analytics_user_retention_failed", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch user retention data")


@router.get(
    "/analytics/user-detail/{user_id}",
    summary="Get analytics for one user",
    description="Return detailed admin analytics for a single user.",
)
async def analytics_user_detail(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    try:
        result = await get_user_detail(db, user_id)
        if result is None:
            raise HTTPException(status_code=404, detail="User not found")
        return result
    except HTTPException:
        raise
    except Exception:
        log.error("analytics_user_detail_failed user_id=%s", user_id, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch user detail")
