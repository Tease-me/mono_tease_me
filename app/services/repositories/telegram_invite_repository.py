"""Telegram invite repository — DB access only.

All persistence operations for the TelegramInvite model live here.
Business decisions belong in the service layer.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy import select, update, and_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import TelegramInvite

log = logging.getLogger(__name__)


async def get_unclaimed_invite(
    db: AsyncSession,
    telegram_user_id: int,
    influencer_id: str,
) -> TelegramInvite | None:
    """Return an existing unclaimed invite for the (tg_user, influencer) pair."""
    result = await db.execute(
        select(TelegramInvite).where(
            and_(
                TelegramInvite.telegram_user_id == telegram_user_id,
                TelegramInvite.influencer_id == influencer_id,
                TelegramInvite.is_claimed == False,  # noqa: E712
            )
        )
    )
    return result.scalar_one_or_none()


async def create_invite(
    db: AsyncSession,
    code: str,
    telegram_user_id: int,
    influencer_id: str,
) -> TelegramInvite:
    """Insert a new invite record and return it.

    Handles the race condition where a concurrent request creates the
    same (telegram_user_id, influencer_id) invite between our check and
    insert.  On IntegrityError we rollback and return the existing row.
    """
    invite = TelegramInvite(
        code=code,
        telegram_user_id=telegram_user_id,
        influencer_id=influencer_id,
    )
    db.add(invite)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        log.info(
            "telegram_invite.create_race tg_user=%s influencer=%s — returning existing",
            telegram_user_id, influencer_id,
        )
        # Another concurrent request created it — fetch the existing one
        existing = await get_unclaimed_invite(db, telegram_user_id, influencer_id)
        if existing:
            return existing
        raise  # Re-raise if we still can't find it
    await db.commit()
    await db.refresh(invite)
    return invite


async def get_unclaimed_by_code(
    db: AsyncSession,
    code: str,
) -> TelegramInvite | None:
    """Fetch an unclaimed invite by its unique code."""
    result = await db.execute(
        select(TelegramInvite).where(
            and_(
                TelegramInvite.code == code,
                TelegramInvite.is_claimed == False,  # noqa: E712
            )
        )
    )
    return result.scalar_one_or_none()


async def mark_claimed(
    db: AsyncSession,
    invite: TelegramInvite,
    user_id: int,
) -> TelegramInvite:
    """Mark an invite as claimed by the given user."""
    invite.is_claimed = True
    invite.claimed_by_user_id = user_id
    invite.claimed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(invite)
    return invite


async def claim_invite_atomic(
    db: AsyncSession,
    code: str,
    user_id: int,
) -> TelegramInvite | None:
    """Atomically claim an invite code. Returns the claimed invite or None if already claimed/not found.

    Uses UPDATE ... WHERE is_claimed = false RETURNING to prevent race conditions.
    """
    result = await db.execute(
        update(TelegramInvite)
        .where(
            TelegramInvite.code == code,
            TelegramInvite.is_claimed == False,  # noqa: E712
        )
        .values(
            is_claimed=True,
            claimed_by_user_id=user_id,
            claimed_at=datetime.now(timezone.utc),
        )
        .returning(TelegramInvite)
    )
    invite = result.scalar_one_or_none()
    if invite:
        await db.commit()
    return invite
