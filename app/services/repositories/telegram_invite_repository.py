"""Telegram invite repository — DB access only.

All persistence operations for the TelegramInvite model live here.
Business decisions belong in the service layer.
"""

from datetime import datetime, timezone

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import TelegramInvite


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
    """Insert a new invite record and return it."""
    invite = TelegramInvite(
        code=code,
        telegram_user_id=telegram_user_id,
        influencer_id=influencer_id,
    )
    db.add(invite)
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
