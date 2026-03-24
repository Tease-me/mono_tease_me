"""
Admin Telegram funnel analytics queries.

Read-only analytics for the Telegram conversion funnel — overview,
per-influencer breakdown, drop-off analysis, revenue attribution,
user journeys, and cohort analysis.

All functions accept an AsyncSession and return plain dicts ready
for JSON serialisation.  Errors propagate to the router.
"""

import logging
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select, func, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.models.funnel import TelegramFunnelEvent
from app.data.models.billing import PayPalTopUp, InfluencerSubscriptionPayment

log = logging.getLogger(__name__)

# ── Ordered funnel stages ────────────────────────────────────────

FUNNEL_STAGES = [
    "call_started",
    "call_completed",
    "trial_exhausted",
    "invite_sent",
    "registration_completed",
    "email_verified",
    "influencer_followed",
    "first_chat",
    "first_payment",
]

# ── Helpers ──────────────────────────────────────────────────────


def _period_start(period: str) -> datetime:
    """Convert a period shorthand to a naive UTC start datetime.

    Returns timezone-naive datetimes to match database columns
    that use TIMESTAMP WITHOUT TIME ZONE.
    """
    now = datetime.utcnow()
    match period:
        case "1h":
            return now - timedelta(hours=1)
        case "24h":
            return now - timedelta(hours=24)
        case "7d":
            return now - timedelta(days=7)
        case "30d":
            return now - timedelta(days=30)
        case "90d":
            return now - timedelta(days=90)
        case "all":
            return datetime(2020, 1, 1)
        case _:
            return now - timedelta(days=30)


# ── 1. Funnel Overview ───────────────────────────────────────────


async def get_funnel_overview(
    db: AsyncSession, period: str = "30d"
) -> dict[str, Any]:
    """Distinct user counts per stage and conversion rates between stages."""
    start = _period_start(period)

    stmt = (
        select(
            TelegramFunnelEvent.event_type,
            func.count(distinct(TelegramFunnelEvent.telegram_user_id)).label("users"),
        )
        .where(TelegramFunnelEvent.occurred_at >= start)
        .group_by(TelegramFunnelEvent.event_type)
    )
    rows = (await db.execute(stmt)).all()
    counts = {r.event_type: r.users for r in rows}

    stages = []
    for stage in FUNNEL_STAGES:
        stages.append({"stage": stage, "users": counts.get(stage, 0)})

    conversion_rates = []
    for i in range(len(FUNNEL_STAGES) - 1):
        from_stage = FUNNEL_STAGES[i]
        to_stage = FUNNEL_STAGES[i + 1]
        from_count = counts.get(from_stage, 0)
        to_count = counts.get(to_stage, 0)
        rate = round(to_count / from_count, 4) if from_count > 0 else 0.0
        conversion_rates.append(
            {
                "from": from_stage,
                "to": to_stage,
                "from_count": from_count,
                "to_count": to_count,
                "rate": rate,
                "percentage": round(rate * 100, 2),
            }
        )

    return {
        "period": period,
        "stages": stages,
        "conversion_rates": conversion_rates,
    }


# ── 2. Funnel by Influencer ─────────────────────────────────────


async def get_funnel_by_influencer(
    db: AsyncSession, period: str = "30d"
) -> dict[str, Any]:
    """Per-influencer stage counts and conversion rates."""
    start = _period_start(period)

    stmt = (
        select(
            TelegramFunnelEvent.influencer_id,
            TelegramFunnelEvent.event_type,
            func.count(distinct(TelegramFunnelEvent.telegram_user_id)).label("users"),
        )
        .where(TelegramFunnelEvent.occurred_at >= start)
        .group_by(TelegramFunnelEvent.influencer_id, TelegramFunnelEvent.event_type)
    )
    rows = (await db.execute(stmt)).all()

    # Group by influencer
    influencer_map: dict[str, dict[str, int]] = {}
    for r in rows:
        influencer_map.setdefault(r.influencer_id, {})[r.event_type] = r.users

    influencers = []
    for influencer_id, counts in sorted(influencer_map.items()):
        stages = [
            {"stage": s, "users": counts.get(s, 0)} for s in FUNNEL_STAGES
        ]
        conversion_rates = []
        for i in range(len(FUNNEL_STAGES) - 1):
            from_count = counts.get(FUNNEL_STAGES[i], 0)
            to_count = counts.get(FUNNEL_STAGES[i + 1], 0)
            rate = round(to_count / from_count, 4) if from_count > 0 else 0.0
            conversion_rates.append(
                {
                    "from": FUNNEL_STAGES[i],
                    "to": FUNNEL_STAGES[i + 1],
                    "from_count": from_count,
                    "to_count": to_count,
                    "rate": rate,
                    "percentage": round(rate * 100, 2),
                }
            )
        influencers.append(
            {
                "influencer_id": influencer_id,
                "stages": stages,
                "conversion_rates": conversion_rates,
            }
        )

    return {"period": period, "influencers": influencers}


# ── 3. Funnel Drop-off ──────────────────────────────────────────


async def get_funnel_dropoff(
    db: AsyncSession, period: str = "30d"
) -> dict[str, Any]:
    """Drop count and percentage between each adjacent stage pair."""
    start = _period_start(period)

    stmt = (
        select(
            TelegramFunnelEvent.event_type,
            func.count(distinct(TelegramFunnelEvent.telegram_user_id)).label("users"),
        )
        .where(TelegramFunnelEvent.occurred_at >= start)
        .group_by(TelegramFunnelEvent.event_type)
    )
    rows = (await db.execute(stmt)).all()
    counts = {r.event_type: r.users for r in rows}

    dropoffs = []
    for i in range(len(FUNNEL_STAGES) - 1):
        from_stage = FUNNEL_STAGES[i]
        to_stage = FUNNEL_STAGES[i + 1]
        from_count = counts.get(from_stage, 0)
        to_count = counts.get(to_stage, 0)
        drop_count = max(from_count - to_count, 0)
        drop_pct = round(drop_count / from_count * 100, 2) if from_count > 0 else 0.0
        dropoffs.append(
            {
                "from": from_stage,
                "to": to_stage,
                "from_count": from_count,
                "to_count": to_count,
                "drop_count": drop_count,
                "drop_percentage": drop_pct,
            }
        )

    return {"period": period, "dropoffs": dropoffs}


# ── 4. Revenue Attribution ───────────────────────────────────────


async def get_revenue_attribution(
    db: AsyncSession, period: str = "30d"
) -> dict[str, Any]:
    """Revenue attributed to each influencer via Telegram funnel registrations.

    Joins registration_completed funnel events with PayPalTopUp and
    InfluencerSubscriptionPayment to calculate per-influencer revenue.
    """
    start = _period_start(period)

    # Subquery: users who came through the funnel (registration_completed)
    funnel_users = (
        select(
            TelegramFunnelEvent.user_id,
            TelegramFunnelEvent.influencer_id,
        )
        .where(
            TelegramFunnelEvent.event_type == "registration_completed",
            TelegramFunnelEvent.user_id.isnot(None),
            TelegramFunnelEvent.occurred_at >= start,
        )
        .distinct()
        .subquery("funnel_users")
    )

    # Top-up revenue attributed via funnel
    topup_stmt = (
        select(
            funnel_users.c.influencer_id,
            func.coalesce(func.sum(PayPalTopUp.cents), 0).label("topup_cents"),
            func.count(PayPalTopUp.id).label("topup_count"),
        )
        .outerjoin(
            PayPalTopUp,
            (PayPalTopUp.user_id == funnel_users.c.user_id)
            & (PayPalTopUp.status == "COMPLETED")
            & (PayPalTopUp.created_at >= start),
        )
        .group_by(funnel_users.c.influencer_id)
    )
    topup_rows = (await db.execute(topup_stmt)).all()

    # Subscription payment revenue attributed via funnel
    sub_stmt = (
        select(
            funnel_users.c.influencer_id,
            func.coalesce(func.sum(InfluencerSubscriptionPayment.amount_cents), 0).label(
                "sub_cents"
            ),
            func.count(InfluencerSubscriptionPayment.id).label("sub_count"),
        )
        .outerjoin(
            InfluencerSubscriptionPayment,
            (InfluencerSubscriptionPayment.user_id == funnel_users.c.user_id)
            & (InfluencerSubscriptionPayment.status == "completed")
            & (InfluencerSubscriptionPayment.occurred_at >= start),
        )
        .group_by(funnel_users.c.influencer_id)
    )
    sub_rows = (await db.execute(sub_stmt)).all()

    # Merge results
    topup_map = {r.influencer_id: r for r in topup_rows}
    sub_map = {r.influencer_id: r for r in sub_rows}
    all_ids = sorted(set(topup_map.keys()) | set(sub_map.keys()))

    influencers = []
    total_cents = 0
    for infl_id in all_ids:
        t = topup_map.get(infl_id)
        s = sub_map.get(infl_id)
        topup_cents = int(t.topup_cents) if t else 0
        sub_cents = int(s.sub_cents) if s else 0
        rev = topup_cents + sub_cents
        total_cents += rev
        influencers.append(
            {
                "influencer_id": infl_id,
                "topup_cents": topup_cents,
                "subscription_cents": sub_cents,
                "total_cents": rev,
                "total_usd": round(rev / 100, 2),
                "topup_count": t.topup_count if t else 0,
                "subscription_payment_count": s.sub_count if s else 0,
            }
        )

    # Sort by revenue descending
    influencers.sort(key=lambda x: x["total_cents"], reverse=True)

    return {
        "period": period,
        "total_cents": total_cents,
        "total_usd": round(total_cents / 100, 2),
        "influencers": influencers,
    }


# ── 5. User Journey ─────────────────────────────────────────────


async def get_user_journey(
    db: AsyncSession, telegram_user_id: int
) -> dict[str, Any]:
    """All funnel events for a specific Telegram user, ordered by time."""
    stmt = (
        select(TelegramFunnelEvent)
        .where(TelegramFunnelEvent.telegram_user_id == telegram_user_id)
        .order_by(TelegramFunnelEvent.occurred_at)
    )
    rows = (await db.execute(stmt)).scalars().all()

    events = [
        {
            "id": e.id,
            "event_type": e.event_type,
            "influencer_id": e.influencer_id,
            "user_id": e.user_id,
            "invite_code": e.invite_code,
            "session_id": e.session_id,
            "meta": e.meta,
            "occurred_at": e.occurred_at.isoformat() if e.occurred_at else None,
        }
        for e in rows
    ]

    return {
        "telegram_user_id": telegram_user_id,
        "event_count": len(events),
        "events": events,
    }


# ── 6. Cohort Analysis ──────────────────────────────────────────


async def get_cohort_analysis(
    db: AsyncSession, cohort_days: int = 7
) -> dict[str, Any]:
    """Group users by week of first call_started, track conversion per cohort.

    Each cohort is defined by the week (or custom interval) of the user's
    first ``call_started`` event.  For each cohort we report how many
    users reached each subsequent stage.
    """
    # Step 1: Get the first call_started per telegram_user_id
    first_call = (
        select(
            TelegramFunnelEvent.telegram_user_id,
            func.min(TelegramFunnelEvent.occurred_at).label("first_call_at"),
        )
        .where(TelegramFunnelEvent.event_type == "call_started")
        .group_by(TelegramFunnelEvent.telegram_user_id)
        .subquery("first_call")
    )

    # Step 2: Bucket into cohorts by truncating to cohort_days intervals
    # Use date_trunc to the nearest week for cohort_days=7
    if cohort_days == 7:
        cohort_expr = func.date_trunc("week", first_call.c.first_call_at)
    else:
        # Fall back to day-based truncation for non-week intervals
        cohort_expr = func.date_trunc("day", first_call.c.first_call_at)

    # Step 3: For each user, find which stages they reached
    user_stages = (
        select(
            TelegramFunnelEvent.telegram_user_id,
            TelegramFunnelEvent.event_type,
        )
        .distinct()
        .subquery("user_stages")
    )

    # Step 4: Join first_call with user_stages and group by cohort
    cohort_stmt = (
        select(
            cohort_expr.label("cohort"),
            user_stages.c.event_type,
            func.count(distinct(first_call.c.telegram_user_id)).label("users"),
        )
        .join(
            user_stages,
            user_stages.c.telegram_user_id == first_call.c.telegram_user_id,
        )
        .group_by("cohort", user_stages.c.event_type)
        .order_by("cohort", user_stages.c.event_type)
    )
    rows = (await db.execute(cohort_stmt)).all()

    # Step 5: Also get total users per cohort
    cohort_totals_stmt = (
        select(
            cohort_expr.label("cohort"),
            func.count(distinct(first_call.c.telegram_user_id)).label("total"),
        )
        .group_by("cohort")
        .order_by("cohort")
    )
    total_rows = (await db.execute(cohort_totals_stmt)).all()
    totals_map = {
        r.cohort.isoformat() if hasattr(r.cohort, "isoformat") else str(r.cohort): r.total
        for r in total_rows
    }

    # Build cohort map
    cohort_map: dict[str, dict[str, int]] = {}
    for r in rows:
        key = r.cohort.isoformat() if hasattr(r.cohort, "isoformat") else str(r.cohort)
        cohort_map.setdefault(key, {})[r.event_type] = r.users

    cohorts = []
    for cohort_key in sorted(cohort_map.keys()):
        stage_counts = cohort_map[cohort_key]
        total = totals_map.get(cohort_key, 0)
        stages = []
        for stage in FUNNEL_STAGES:
            count = stage_counts.get(stage, 0)
            rate = round(count / total * 100, 2) if total > 0 else 0.0
            stages.append({"stage": stage, "users": count, "percentage": rate})
        cohorts.append(
            {
                "cohort_start": cohort_key,
                "total_users": total,
                "stages": stages,
            }
        )

    return {"cohort_days": cohort_days, "cohorts": cohorts}
