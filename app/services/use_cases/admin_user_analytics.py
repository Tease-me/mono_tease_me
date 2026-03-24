"""
Admin user analytics queries.

Read-only analytics for the admin dashboard — user growth, engagement,
spending, retention, and per-user deep-dives.

All functions accept an AsyncSession and a period string, and return
plain dicts ready for JSON serialisation. Errors propagate to the router.
"""

import logging
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select, func, desc, case, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.models import (
    User,
    Chat,
    Chat18,
    Message,
    Message18,
    CallRecord,
    RelationshipState,
    InfluencerSubscription,
    InfluencerSubscriptionPayment,
    InfluencerWallet,
    PayPalTopUp,
    ContentViolation,
    InfluencerFollower,
    ApiUsageLog,
)

log = logging.getLogger(__name__)


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
        case "7d":
            return now - timedelta(days=7)
        case "30d":
            return now - timedelta(days=30)
        case "90d":
            return now - timedelta(days=90)
        case "all":
            return datetime(2020, 1, 1)
        case _:
            return now - timedelta(hours=24)


def _day_trunc(col):
    """Truncate a datetime column to date (day)."""
    return func.date_trunc("day", col)


# ── 1. User Growth ──────────────────────────────────────────────

async def get_user_growth(db: AsyncSession, period: str = "30d") -> dict[str, Any]:
    """
    Signup trends over time.

    Returns daily registration counts, total users, verified vs unverified split.
    """
    start = _period_start(period)

    # -- Daily signup counts --
    daily_stmt = (
        select(
            _day_trunc(User.created_at).label("day"),
            func.count(User.id).label("signups"),
        )
        .where(User.created_at >= start)
        .group_by("day")
        .order_by("day")
    )
    daily_rows = (await db.execute(daily_stmt)).all()

    # -- Totals --
    totals_stmt = select(
        func.count(User.id).label("total"),
        func.sum(case((User.is_verified.is_(True), 1), else_=0)).label("verified"),
        func.sum(case((User.is_verified.is_(False), 1), else_=0)).label("unverified"),
        func.sum(case((User.is_identity_verified.is_(True), 1), else_=0)).label("identity_verified"),
        func.sum(case((User.is_age_verified.is_(True), 1), else_=0)).label("age_verified"),
    )
    totals = (await db.execute(totals_stmt)).one()

    # -- New in period --
    new_in_period = (
        await db.execute(
            select(func.count(User.id)).where(User.created_at >= start)
        )
    ).scalar() or 0

    return {
        "period": period,
        "total_users": totals.total or 0,
        "verified": int(totals.verified or 0),
        "unverified": int(totals.unverified or 0),
        "identity_verified": int(totals.identity_verified or 0),
        "age_verified": int(totals.age_verified or 0),
        "new_in_period": new_in_period,
        "daily": [
            {
                "date": r.day.isoformat() if hasattr(r.day, "isoformat") else str(r.day),
                "signups": r.signups,
            }
            for r in daily_rows
        ],
    }


# ── 2. User Engagement ─────────────────────────────────────────

async def get_user_engagement(db: AsyncSession, period: str = "24h") -> dict[str, Any]:
    """
    Activity metrics: messages, calls, active users, channel breakdown,
    relationship stage distribution.
    """
    start = _period_start(period)

    # -- Message counts (regular) --
    msg_stmt = (
        select(
            func.count(Message.id).label("total"),
            func.count(distinct(Message.chat_id)).label("active_chats"),
        )
        .where(Message.created_at >= start)
    )
    msg = (await db.execute(msg_stmt)).one()

    # -- Message counts (18+) --
    msg18_stmt = (
        select(func.count(Message18.id).label("total"))
        .where(Message18.created_at >= start)
    )
    msg18_total = (await db.execute(msg18_stmt)).scalar() or 0

    # -- Channel breakdown for regular messages --
    channel_stmt = (
        select(
            Message.channel,
            func.count(Message.id).label("count"),
        )
        .where(Message.created_at >= start)
        .group_by(Message.channel)
    )
    channel_rows = (await db.execute(channel_stmt)).all()

    # -- Active users (users who sent a message) --
    active_users_stmt = (
        select(func.count(distinct(Chat.user_id)))
        .join(Message, Message.chat_id == Chat.id)
        .where(Message.created_at >= start)
    )
    active_text_users = (await db.execute(active_users_stmt)).scalar() or 0

    # -- Active 18+ users --
    active_18_stmt = (
        select(func.count(distinct(Chat18.user_id)))
        .join(Message18, Message18.chat_id == Chat18.id)
        .where(Message18.created_at >= start)
    )
    active_18_users = (await db.execute(active_18_stmt)).scalar() or 0

    # -- Call activity --
    call_stmt = (
        select(
            func.count(CallRecord.conversation_id).label("total_calls"),
            func.count(distinct(CallRecord.user_id)).label("callers"),
            func.sum(CallRecord.call_duration_secs).label("total_secs"),
            func.avg(CallRecord.call_duration_secs).label("avg_secs"),
        )
        .where(CallRecord.created_at >= start)
    )
    calls = (await db.execute(call_stmt)).one()

    # -- Relationship stage distribution --
    rel_stmt = (
        select(
            RelationshipState.state,
            func.count(RelationshipState.id).label("count"),
        )
        .group_by(RelationshipState.state)
        .order_by(desc("count"))
    )
    rel_rows = (await db.execute(rel_stmt)).all()

    # -- Top active users by message count --
    top_users_stmt = (
        select(
            Chat.user_id,
            User.email,
            User.username,
            func.count(Message.id).label("messages"),
        )
        .join(Message, Message.chat_id == Chat.id)
        .join(User, User.id == Chat.user_id)
        .where(Message.created_at >= start)
        .group_by(Chat.user_id, User.email, User.username)
        .order_by(desc("messages"))
        .limit(10)
    )
    top_users = (await db.execute(top_users_stmt)).all()

    return {
        "period": period,
        "messages": {
            "total": msg.total or 0,
            "total_18": msg18_total,
            "active_chats": msg.active_chats or 0,
        },
        "active_users": {
            "text": active_text_users,
            "text_18": active_18_users,
            "voice": int(calls.callers or 0),
        },
        "calls": {
            "total": calls.total_calls or 0,
            "unique_callers": int(calls.callers or 0),
            "total_duration_secs": float(calls.total_secs) if calls.total_secs else 0.0,
            "avg_duration_secs": round(float(calls.avg_secs), 1) if calls.avg_secs else 0.0,
        },
        "channels": [
            {"channel": r.channel or "unknown", "count": r.count}
            for r in channel_rows
        ],
        "relationship_stages": [
            {"stage": r.state, "count": r.count}
            for r in rel_rows
        ],
        "top_active_users": [
            {
                "user_id": r.user_id,
                "email": r.email,
                "username": r.username,
                "messages": r.messages,
            }
            for r in top_users
        ],
    }


# ── 3. User Spending ───────────────────────────────────────────

async def get_user_spending(db: AsyncSession, period: str = "30d") -> dict[str, Any]:
    """
    Revenue analysis: total revenue, ARPU, top spenders,
    subscription status breakdown, top-up revenue.
    """
    start = _period_start(period)

    # -- Top-up revenue (PayPal/Stripe) --
    topup_stmt = (
        select(
            func.count(PayPalTopUp.id).label("count"),
            func.sum(PayPalTopUp.cents).label("total_cents"),
        )
        .where(
            PayPalTopUp.created_at >= start,
            PayPalTopUp.status == "COMPLETED",
        )
    )
    topups = (await db.execute(topup_stmt)).one()

    # -- Subscription payment revenue --
    sub_pay_stmt = (
        select(
            func.count(InfluencerSubscriptionPayment.id).label("count"),
            func.sum(InfluencerSubscriptionPayment.amount_cents).label("total_cents"),
        )
        .where(
            InfluencerSubscriptionPayment.occurred_at >= start,
            InfluencerSubscriptionPayment.status == "completed",
        )
    )
    sub_pays = (await db.execute(sub_pay_stmt)).one()

    # -- Subscription status breakdown --
    sub_status_stmt = (
        select(
            InfluencerSubscription.status,
            func.count(InfluencerSubscription.id).label("count"),
        )
        .group_by(InfluencerSubscription.status)
    )
    sub_statuses = (await db.execute(sub_status_stmt)).all()

    # -- Top spenders (by top-up amount) --
    top_spenders_stmt = (
        select(
            PayPalTopUp.user_id,
            User.email,
            User.username,
            func.sum(PayPalTopUp.cents).label("total_cents"),
            func.count(PayPalTopUp.id).label("purchases"),
        )
        .join(User, User.id == PayPalTopUp.user_id)
        .where(
            PayPalTopUp.created_at >= start,
            PayPalTopUp.status == "COMPLETED",
        )
        .group_by(PayPalTopUp.user_id, User.email, User.username)
        .order_by(desc("total_cents"))
        .limit(10)
    )
    top_spenders = (await db.execute(top_spenders_stmt)).all()

    # -- Active wallet balances --
    wallet_stmt = (
        select(
            func.count(InfluencerWallet.id).label("wallets"),
            func.sum(InfluencerWallet.balance_cents).label("total_balance"),
            func.avg(InfluencerWallet.balance_cents).label("avg_balance"),
        )
        .where(InfluencerWallet.balance_cents > 0)
    )
    wallets = (await db.execute(wallet_stmt)).one()

    # -- Unique paying users in period --
    paying_users = (
        await db.execute(
            select(func.count(distinct(PayPalTopUp.user_id)))
            .where(
                PayPalTopUp.created_at >= start,
                PayPalTopUp.status == "COMPLETED",
            )
        )
    ).scalar() or 0

    total_topup_cents = int(topups.total_cents or 0)
    total_sub_cents = int(sub_pays.total_cents or 0)
    total_revenue_cents = total_topup_cents + total_sub_cents

    return {
        "period": period,
        "revenue": {
            "total_cents": total_revenue_cents,
            "total_usd": round(total_revenue_cents / 100, 2),
            "topup_cents": total_topup_cents,
            "subscription_cents": total_sub_cents,
            "topup_count": topups.count or 0,
            "subscription_payment_count": sub_pays.count or 0,
        },
        "paying_users": paying_users,
        "arpu_cents": round(total_revenue_cents / paying_users, 2) if paying_users > 0 else 0,
        "subscriptions": [
            {"status": r.status, "count": r.count}
            for r in sub_statuses
        ],
        "wallets": {
            "active_wallets": wallets.wallets or 0,
            "total_balance_cents": int(wallets.total_balance or 0),
            "avg_balance_cents": round(float(wallets.avg_balance or 0), 2),
        },
        "top_spenders": [
            {
                "user_id": r.user_id,
                "email": r.email,
                "username": r.username,
                "total_cents": int(r.total_cents or 0),
                "total_usd": round(int(r.total_cents or 0) / 100, 2),
                "purchases": r.purchases,
            }
            for r in top_spenders
        ],
    }


# ── 4. User Retention ──────────────────────────────────────────

async def get_user_retention(db: AsyncSession, period: str = "30d") -> dict[str, Any]:
    """
    DAU / WAU / MAU and new vs returning users.
    """
    now = datetime.utcnow()

    # -- DAU (has sent a message today) --
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    dau_stmt = (
        select(func.count(distinct(Chat.user_id)))
        .join(Message, Message.chat_id == Chat.id)
        .where(Message.created_at >= today_start)
    )
    dau = (await db.execute(dau_stmt)).scalar() or 0

    # -- WAU (past 7 days) --
    week_start = now - timedelta(days=7)
    wau_stmt = (
        select(func.count(distinct(Chat.user_id)))
        .join(Message, Message.chat_id == Chat.id)
        .where(Message.created_at >= week_start)
    )
    wau = (await db.execute(wau_stmt)).scalar() or 0

    # -- MAU (past 30 days) --
    month_start = now - timedelta(days=30)
    mau_stmt = (
        select(func.count(distinct(Chat.user_id)))
        .join(Message, Message.chat_id == Chat.id)
        .where(Message.created_at >= month_start)
    )
    mau = (await db.execute(mau_stmt)).scalar() or 0

    # -- Total registered users --
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0

    # -- New users today --
    new_today = (
        await db.execute(
            select(func.count(User.id)).where(User.created_at >= today_start)
        )
    ).scalar() or 0

    # -- New users this week --
    new_week = (
        await db.execute(
            select(func.count(User.id)).where(User.created_at >= week_start)
        )
    ).scalar() or 0

    # -- Daily active user trend (last N days based on period) --
    start = _period_start(period)
    daily_active_stmt = (
        select(
            _day_trunc(Message.created_at).label("day"),
            func.count(distinct(Chat.user_id)).label("active_users"),
        )
        .join(Message, Message.chat_id == Chat.id)
        .where(Message.created_at >= start)
        .group_by("day")
        .order_by("day")
    )
    daily_rows = (await db.execute(daily_active_stmt)).all()

    # -- Stickiness ratio --
    stickiness = round(dau / mau, 4) if mau > 0 else 0.0

    return {
        "period": period,
        "dau": dau,
        "wau": wau,
        "mau": mau,
        "total_users": total_users,
        "new_today": new_today,
        "new_this_week": new_week,
        "stickiness_dau_mau": stickiness,
        "daily_active": [
            {
                "date": r.day.isoformat() if hasattr(r.day, "isoformat") else str(r.day),
                "active_users": r.active_users,
            }
            for r in daily_rows
        ],
    }


# ── 5. User Detail ──────────────────────────────────────────────

async def get_user_detail(db: AsyncSession, user_id: int) -> dict[str, Any] | None:
    """
    Deep-dive for a single user: profile, wallets, subscriptions,
    messages, calls, relationships, violations, spend totals.
    """
    # -- User profile --
    user = await db.get(User, user_id)
    if not user:
        return None

    profile = {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "gender": user.gender,
        "date_of_birth": user.date_of_birth.isoformat() if user.date_of_birth else None,
        "is_verified": user.is_verified,
        "is_identity_verified": user.is_identity_verified,
        "is_age_verified": user.is_age_verified,
        "verification_level": user.verification_level,
        "moderation_status": user.moderation_status,
        "violation_count": user.violation_count,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }

    # -- Wallets --
    wallet_rows = (
        await db.execute(
            select(InfluencerWallet).where(InfluencerWallet.user_id == user_id)
        )
    ).scalars().all()
    wallets = [
        {
            "influencer_id": w.influencer_id,
            "is_18": w.is_18,
            "balance_cents": w.balance_cents,
            "updated_at": w.updated_at.isoformat() if w.updated_at else None,
        }
        for w in wallet_rows
    ]

    # -- Subscriptions --
    sub_rows = (
        await db.execute(
            select(InfluencerSubscription).where(InfluencerSubscription.user_id == user_id)
        )
    ).scalars().all()
    subscriptions = [
        {
            "id": s.id,
            "influencer_id": s.influencer_id,
            "status": s.status,
            "price_cents": s.price_cents,
            "currency": s.currency,
            "interval": s.interval,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "canceled_at": s.canceled_at.isoformat() if s.canceled_at else None,
        }
        for s in sub_rows
    ]

    # -- Message counts --
    msg_count = (
        await db.execute(
            select(func.count(Message.id))
            .join(Chat, Chat.id == Message.chat_id)
            .where(Chat.user_id == user_id)
        )
    ).scalar() or 0

    msg18_count = (
        await db.execute(
            select(func.count(Message18.id))
            .join(Chat18, Chat18.id == Message18.chat_id)
            .where(Chat18.user_id == user_id)
        )
    ).scalar() or 0

    # -- Call summary --
    call_stats = (
        await db.execute(
            select(
                func.count(CallRecord.conversation_id).label("total"),
                func.sum(CallRecord.call_duration_secs).label("total_secs"),
            )
            .where(CallRecord.user_id == user_id)
        )
    ).one()

    # -- Relationships --
    rel_rows = (
        await db.execute(
            select(RelationshipState).where(RelationshipState.user_id == user_id)
        )
    ).scalars().all()
    relationships = [
        {
            "influencer_id": r.influencer_id,
            "state": r.state,
            "trust": r.trust,
            "closeness": r.closeness,
            "attraction": r.attraction,
            "stage_points": r.stage_points,
            "last_interaction_at": r.last_interaction_at.isoformat() if r.last_interaction_at else None,
        }
        for r in rel_rows
    ]

    # -- Total spend --
    total_spend = (
        await db.execute(
            select(func.sum(PayPalTopUp.cents))
            .where(
                PayPalTopUp.user_id == user_id,
                PayPalTopUp.status == "COMPLETED",
            )
        )
    ).scalar() or 0

    # -- Recent violations --
    violation_rows = (
        await db.execute(
            select(ContentViolation)
            .where(ContentViolation.user_id == user_id)
            .order_by(desc(ContentViolation.created_at))
            .limit(10)
        )
    ).scalars().all()
    violations = [
        {
            "id": v.id,
            "category": v.category,
            "severity": v.severity,
            "created_at": v.created_at.isoformat() if v.created_at else None,
        }
        for v in violation_rows
    ]

    # -- Following --
    following_count = (
        await db.execute(
            select(func.count(InfluencerFollower.influencer_id))
            .where(InfluencerFollower.user_id == user_id)
        )
    ).scalar() or 0

    # -- API cost attributed --
    api_cost = (
        await db.execute(
            select(func.sum(ApiUsageLog.estimated_cost_micros))
            .where(ApiUsageLog.user_id == user_id)
        )
    ).scalar() or 0

    return {
        "profile": profile,
        "wallets": wallets,
        "subscriptions": subscriptions,
        "activity": {
            "total_messages": msg_count,
            "total_messages_18": msg18_count,
            "total_calls": call_stats.total or 0,
            "total_call_secs": float(call_stats.total_secs) if call_stats.total_secs else 0.0,
            "following_count": following_count,
        },
        "relationships": relationships,
        "spending": {
            "total_topup_cents": int(total_spend),
            "total_topup_usd": round(int(total_spend) / 100, 2),
            "api_cost_usd": round(int(api_cost) / 1_000_000, 4),
        },
        "violations": violations,
    }


# ── 6. Analytics Overview (KPI Dashboard) ──────────────────────

async def get_analytics_overview(db: AsyncSession) -> dict[str, Any]:
    """
    High-level KPI summary for the analytics dashboard landing.
    """
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=7)
    month_start = now - timedelta(days=30)

    # -- User KPIs --
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    new_today = (
        await db.execute(
            select(func.count(User.id)).where(User.created_at >= today_start)
        )
    ).scalar() or 0
    new_week = (
        await db.execute(
            select(func.count(User.id)).where(User.created_at >= week_start)
        )
    ).scalar() or 0

    # -- DAU --
    dau = (
        await db.execute(
            select(func.count(distinct(Chat.user_id)))
            .join(Message, Message.chat_id == Chat.id)
            .where(Message.created_at >= today_start)
        )
    ).scalar() or 0

    # -- Revenue today --
    rev_today = (
        await db.execute(
            select(func.sum(PayPalTopUp.cents))
            .where(
                PayPalTopUp.created_at >= today_start,
                PayPalTopUp.status == "COMPLETED",
            )
        )
    ).scalar() or 0

    # -- Revenue this month (proxy for MRR) --
    rev_month = (
        await db.execute(
            select(func.sum(PayPalTopUp.cents))
            .where(
                PayPalTopUp.created_at >= month_start,
                PayPalTopUp.status == "COMPLETED",
            )
        )
    ).scalar() or 0

    # -- Active subscriptions --
    active_subs = (
        await db.execute(
            select(func.count(InfluencerSubscription.id))
            .where(InfluencerSubscription.status == "active")
        )
    ).scalar() or 0

    # -- Messages today --
    msgs_today = (
        await db.execute(
            select(func.count(Message.id)).where(Message.created_at >= today_start)
        )
    ).scalar() or 0

    # -- Calls today --
    calls_today = (
        await db.execute(
            select(func.count(CallRecord.conversation_id))
            .where(CallRecord.created_at >= today_start)
        )
    ).scalar() or 0

    # -- API cost today --
    api_cost_today = (
        await db.execute(
            select(func.sum(ApiUsageLog.estimated_cost_micros))
            .where(ApiUsageLog.created_at >= today_start)
        )
    ).scalar() or 0

    # -- Top influencers by follower count --
    top_influencers_stmt = (
        select(
            InfluencerFollower.influencer_id,
            func.count(InfluencerFollower.user_id).label("followers"),
        )
        .group_by(InfluencerFollower.influencer_id)
        .order_by(desc("followers"))
        .limit(5)
    )
    top_infl = (await db.execute(top_influencers_stmt)).all()

    return {
        "users": {
            "total": total_users,
            "new_today": new_today,
            "new_this_week": new_week,
            "dau": dau,
        },
        "revenue": {
            "today_cents": int(rev_today),
            "today_usd": round(int(rev_today) / 100, 2),
            "month_cents": int(rev_month),
            "month_usd": round(int(rev_month) / 100, 2),
        },
        "subscriptions": {
            "active": active_subs,
        },
        "activity": {
            "messages_today": msgs_today,
            "calls_today": calls_today,
        },
        "costs": {
            "api_cost_today_usd": round(int(api_cost_today) / 1_000_000, 4),
        },
        "top_influencers": [
            {"influencer_id": r.influencer_id, "followers": r.followers}
            for r in top_infl
        ],
    }
