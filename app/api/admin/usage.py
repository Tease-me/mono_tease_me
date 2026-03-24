from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import Integer, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.admin.common import ensure_admin
from app.data.models import ApiUsageLog, User
from app.core.session import get_db
from app.utils.auth.dependencies import get_current_user

router = APIRouter(tags=["admin-usage"])


def _parse_period(period: str) -> datetime:
    now = datetime.now(timezone.utc)
    if period == "1h":
        return now - timedelta(hours=1)
    if period == "7d":
        return now - timedelta(days=7)
    if period == "30d":
        return now - timedelta(days=30)
    if period == "90d":
        return now - timedelta(days=90)
    return now - timedelta(hours=24)


@router.get(
    "/api-usage/summary",
    summary="Get API usage summary",
    description="Return grouped API usage metrics for the selected period.",
)
async def get_api_usage_summary(
    period: str = "24h",
    group_by: str = "category",
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    start_time = _parse_period(period)
    group_col = getattr(ApiUsageLog, group_by, ApiUsageLog.category)
    stmt = (
        select(
            group_col.label("group_name"),
            func.count(ApiUsageLog.id).label("requests"),
            func.sum(ApiUsageLog.estimated_cost_micros).label("total_cost_micros"),
            func.sum(ApiUsageLog.total_tokens).label("total_tokens"),
            func.sum(ApiUsageLog.input_tokens).label("total_input_tokens"),
            func.sum(ApiUsageLog.output_tokens).label("total_output_tokens"),
            func.avg(ApiUsageLog.latency_ms).label("avg_latency_ms"),
            func.max(ApiUsageLog.latency_ms).label("max_latency_ms"),
            func.sum(ApiUsageLog.duration_secs).label("total_duration_secs"),
            func.sum(func.cast(ApiUsageLog.success.is_(False), Integer)).label("errors"),
        )
        .where(ApiUsageLog.created_at >= start_time)
        .group_by(group_col)
    )
    res = await db.execute(stmt)
    rows = res.all()
    return {
        "period": period,
        "group_by": group_by,
        "groups": [
            {
                "key": getattr(r, "group_name") or "unknown",
                "total_calls": r.requests,
                "total_tokens": int(r.total_tokens) if r.total_tokens else 0,
                "total_input_tokens": int(r.total_input_tokens) if r.total_input_tokens else 0,
                "total_output_tokens": int(r.total_output_tokens) if r.total_output_tokens else 0,
                "estimated_cost_usd": (float(r.total_cost_micros) / 1000000.0) if r.total_cost_micros else 0.0,
                "avg_latency_ms": float(r.avg_latency_ms) if r.avg_latency_ms else None,
                "max_latency_ms": int(r.max_latency_ms) if r.max_latency_ms else None,
                "total_duration_secs": float(r.total_duration_secs) if r.total_duration_secs else None,
                "error_count": int(r.errors) if r.errors else 0,
                "error_rate": (r.errors / r.requests) if r.requests > 0 else 0.0,
            }
            for r in rows
        ],
    }


@router.get(
    "/api-usage/top-users",
    summary="Get top API users",
    description="Return the users with the highest API usage for the selected period.",
)
async def get_api_usage_top_users(
    period: str = "24h",
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    start_time = _parse_period(period)
    stmt = (
        select(
            ApiUsageLog.user_id,
            User.email,
            func.count(ApiUsageLog.id).label("requests"),
            func.sum(ApiUsageLog.estimated_cost_micros).label("cost_micros"),
            func.sum(ApiUsageLog.total_tokens).label("tokens"),
        )
        .join(User, User.id == ApiUsageLog.user_id, isouter=True)
        .where(ApiUsageLog.created_at >= start_time)
        .where(ApiUsageLog.user_id.isnot(None))
        .group_by(ApiUsageLog.user_id, User.email)
        .order_by(desc("cost_micros"))
        .limit(10)
    )
    res = await db.execute(stmt)
    rows = res.all()
    return {
        "users": [
            {
                "user_id": r.user_id,
                "email": r.email,
                "total_calls": r.requests,
                "total_tokens": int(r.tokens) if r.tokens else 0,
                "estimated_cost_usd": (float(r.cost_micros) / 1000000.0) if r.cost_micros else 0.0,
            }
            for r in rows
        ]
    }


@router.get(
    "/api-usage/top-influencers",
    summary="Get top API influencers",
    description="Return the influencers with the highest API usage for the selected period.",
)
async def get_api_usage_top_influencers(
    period: str = "24h",
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    start_time = _parse_period(period)
    stmt = (
        select(
            ApiUsageLog.influencer_id,
            func.count(ApiUsageLog.id).label("requests"),
            func.sum(ApiUsageLog.estimated_cost_micros).label("cost_micros"),
            func.sum(ApiUsageLog.total_tokens).label("tokens"),
            func.sum(ApiUsageLog.duration_secs).label("duration_secs"),
        )
        .where(ApiUsageLog.created_at >= start_time)
        .where(ApiUsageLog.influencer_id.isnot(None))
        .group_by(ApiUsageLog.influencer_id)
        .order_by(desc("cost_micros"))
        .limit(10)
    )
    res = await db.execute(stmt)
    rows = res.all()
    return {
        "influencers": [
            {
                "influencer_id": r.influencer_id,
                "total_calls": r.requests,
                "total_tokens": int(r.tokens) if r.tokens else 0,
                "estimated_cost_usd": (float(r.cost_micros) / 1000000.0) if r.cost_micros else 0.0,
                "total_call_secs": float(r.duration_secs) if r.duration_secs else 0.0,
            }
            for r in rows
        ]
    }


@router.get(
    "/api-usage/errors",
    summary="Get API usage errors",
    description="Return recent failed API usage records for admin debugging.",
)
async def get_api_usage_errors(
    period: str = "24h",
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    start_time = _parse_period(period)
    stmt = (
        select(ApiUsageLog)
        .where(ApiUsageLog.created_at >= start_time)
        .where(ApiUsageLog.success.is_(False))
        .order_by(desc(ApiUsageLog.created_at))
        .limit(50)
    )
    res = await db.execute(stmt)
    rows = res.scalars().all()
    return {
        "errors": [
            {
                "id": r.id,
                "timestamp": r.created_at.isoformat(),
                "created_at": r.created_at.isoformat(),
                "category": r.category,
                "provider": r.provider,
                "model": r.model,
                "purpose": r.purpose,
                "error_message": r.error_message,
                "user_id": r.user_id,
                "influencer_id": r.influencer_id,
            }
            for r in rows
        ],
        "total_errors": len(rows),
    }
