import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.admin.common import ensure_admin
from app.data.models import User
from app.core.session import get_db
from app.use_cases.admin_telegram_funnel_analytics import (
    get_cohort_analysis,
    get_funnel_by_influencer,
    get_funnel_dropoff,
    get_funnel_overview,
    get_revenue_attribution,
    get_user_journey,
)
from app.utils.auth.dependencies import get_current_user

router = APIRouter(tags=["admin-telegram-funnel"])
log = logging.getLogger(__name__)


@router.get(
    "/telegram-funnel/overview",
    summary="Telegram funnel overview",
    description="Return stage counts and conversion rates for the Telegram funnel.",
)
async def telegram_funnel_overview(
    period: str = "30d",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    try:
        return await get_funnel_overview(db, period)
    except Exception:
        log.error("telegram_funnel_overview_failed", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch funnel overview")


@router.get(
    "/telegram-funnel/by-influencer",
    summary="Telegram funnel by influencer",
    description="Return per-influencer stage counts and conversion rates.",
)
async def telegram_funnel_by_influencer(
    period: str = "30d",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    try:
        return await get_funnel_by_influencer(db, period)
    except Exception:
        log.error("telegram_funnel_by_influencer_failed", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch funnel by influencer")


@router.get(
    "/telegram-funnel/dropoff",
    summary="Telegram funnel drop-off",
    description="Return drop counts and percentages between adjacent funnel stages.",
)
async def telegram_funnel_dropoff(
    period: str = "30d",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    try:
        return await get_funnel_dropoff(db, period)
    except Exception:
        log.error("telegram_funnel_dropoff_failed", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch funnel dropoff data")


@router.get(
    "/telegram-funnel/revenue",
    summary="Telegram funnel revenue attribution",
    description="Return per-influencer revenue attributed to the Telegram funnel.",
)
async def telegram_funnel_revenue(
    period: str = "30d",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    try:
        return await get_revenue_attribution(db, period)
    except Exception:
        log.error("telegram_funnel_revenue_failed", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch funnel revenue data")


@router.get(
    "/telegram-funnel/cohorts",
    summary="Telegram funnel cohort analysis",
    description="Return cohort-based conversion analysis grouped by first call week.",
)
async def telegram_funnel_cohorts(
    cohort_days: int = 7,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    try:
        return await get_cohort_analysis(db, cohort_days)
    except Exception:
        log.error("telegram_funnel_cohorts_failed", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch cohort analysis")


@router.get(
    "/telegram-funnel/user/{telegram_user_id}",
    summary="Telegram funnel user journey",
    description="Return all funnel events for a specific Telegram user.",
)
async def telegram_funnel_user_journey(
    telegram_user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    try:
        result = await get_user_journey(db, telegram_user_id)
        if result["event_count"] == 0:
            raise HTTPException(
                status_code=404,
                detail="No funnel events found for this Telegram user",
            )
        return result
    except HTTPException:
        raise
    except Exception:
        log.error(
            "telegram_funnel_user_journey_failed telegram_user_id=%s",
            telegram_user_id,
            exc_info=True,
        )
        raise HTTPException(status_code=500, detail="Failed to fetch user journey")
