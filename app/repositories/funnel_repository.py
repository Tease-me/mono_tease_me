"""Telegram funnel event repository — DB access only.

All persistence operations for the TelegramFunnelEvent model live here.
Business decisions belong in the service layer.
"""

import logging

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.funnel import TelegramFunnelEvent
from app.db.models.telegram_invite import TelegramInvite

log = logging.getLogger(__name__)


async def get_invite_by_code(
    db: AsyncSession,
    code: str,
) -> TelegramInvite | None:
    """Fetch a TelegramInvite by code (claimed or unclaimed)."""
    result = await db.execute(
        select(TelegramInvite).where(TelegramInvite.code == code)
    )
    return result.scalar_one_or_none()


async def get_invite_by_claimed_user(
    db: AsyncSession,
    user_id: int,
) -> TelegramInvite | None:
    """Fetch the TelegramInvite claimed by the given user_id."""
    result = await db.execute(
        select(TelegramInvite).where(TelegramInvite.claimed_by_user_id == user_id)
    )
    return result.scalar_one_or_none()


async def record_event(
    db: AsyncSession,
    *,
    event_type: str,
    telegram_user_id: int,
    influencer_id: str,
    user_id: int | None = None,
    invite_code: str | None = None,
    session_id: str | None = None,
    meta: dict | None = None,
) -> TelegramFunnelEvent:
    """Insert a new funnel event and commit."""
    event = TelegramFunnelEvent(
        event_type=event_type,
        telegram_user_id=telegram_user_id,
        influencer_id=influencer_id,
        user_id=user_id,
        invite_code=invite_code,
        session_id=session_id,
        meta=meta,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event


async def get_funnel_events_for_user(
    db: AsyncSession,
    telegram_user_id: int,
    influencer_id: str,
) -> list[TelegramFunnelEvent]:
    """Return all funnel events for a (telegram_user, influencer) pair, ordered by time."""
    result = await db.execute(
        select(TelegramFunnelEvent)
        .where(
            and_(
                TelegramFunnelEvent.telegram_user_id == telegram_user_id,
                TelegramFunnelEvent.influencer_id == influencer_id,
            )
        )
        .order_by(TelegramFunnelEvent.occurred_at)
    )
    return list(result.scalars().all())


async def get_attribution_for_user(
    db: AsyncSession,
    user_id: int,
) -> TelegramFunnelEvent | None:
    """Return the earliest registration_completed event for the given user_id."""
    result = await db.execute(
        select(TelegramFunnelEvent)
        .where(
            and_(
                TelegramFunnelEvent.user_id == user_id,
                TelegramFunnelEvent.event_type == "registration_completed",
            )
        )
        .order_by(TelegramFunnelEvent.occurred_at)
        .limit(1)
    )
    return result.scalar_one_or_none()


async def event_exists(
    db: AsyncSession,
    event_type: str,
    user_id: int,
    influencer_id: str,
) -> bool:
    """Check whether a funnel event already exists — used for deduplication."""
    result = await db.execute(
        select(TelegramFunnelEvent.id)
        .where(
            and_(
                TelegramFunnelEvent.event_type == event_type,
                TelegramFunnelEvent.user_id == user_id,
                TelegramFunnelEvent.influencer_id == influencer_id,
            )
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None
