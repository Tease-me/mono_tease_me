"""Telegram invite code service.

Handles creation and claiming of unique invite codes that bind
Telegram users to web accounts during registration.

Business logic only — DB access delegated to the repository layer.
"""

import secrets
import logging
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import TelegramInvite, User
from app.services.repositories.telegram_invite_repository import (
    get_unclaimed_invite,
    create_invite,
    get_unclaimed_by_code,
    mark_claimed,
)

log = logging.getLogger(__name__)


async def get_or_create_invite_code(
    db: AsyncSession,
    telegram_user_id: int,
    influencer_id: str,
) -> str:
    """Return an existing unclaimed invite code or create a new one.

    For a given (telegram_user_id, influencer_id) pair, reuses an
    existing unclaimed code so the user always gets the same link.
    """
    existing = await get_unclaimed_invite(db, telegram_user_id, influencer_id)
    if existing:
        return existing.code

    code = secrets.token_urlsafe(16)  # ~22 chars, URL-safe
    invite = await create_invite(db, code, telegram_user_id, influencer_id)

    log.info(
        "telegram_invite.created code=%s tg_user=%s influencer=%s",
        invite.code, telegram_user_id, influencer_id,
    )
    return invite.code


async def claim_invite_code(
    db: AsyncSession,
    code: str,
    user_id: int,
) -> TelegramInvite | None:
    """Claim an invite code during registration.

    Returns the invite record (with telegram_user_id and influencer_id)
    if successful, or None if the code is invalid/already claimed.
    """
    invite = await get_unclaimed_by_code(db, code)
    if not invite:
        log.warning("telegram_invite.claim_failed code=%s (not found or already claimed)", code)
        return None

    invite = await mark_claimed(db, invite, user_id)

    log.info(
        "telegram_invite.claimed code=%s user_id=%s tg_user=%s",
        code, user_id, invite.telegram_user_id,
    )
    return invite


@dataclass
class TelegramBindResult:
    """Result of claiming an invite and binding a Telegram user."""
    telegram_id: int
    influencer_id: str


async def claim_and_bind_telegram(
    db: AsyncSession,
    invite_code: str,
    user: User,
    provided_influencer_id: str | None = None,
) -> TelegramBindResult | None:
    """Claim an invite code and bind the user's Telegram ID.

    Orchestrates the full invite-claiming flow:
    1. Claim the invite code
    2. Bind telegram_id to the user via the repository
    3. Return the influencer_id (from invite if not already provided)

    Returns None if the code is invalid or already claimed.
    """
    from app.services.repositories.user_repository import bind_telegram_id

    invite = await claim_invite_code(db, invite_code, user.id)
    if not invite:
        log.warning(
            "register.invalid_invite_code code=%s user=%s",
            invite_code, user.id,
        )
        return None

    await bind_telegram_id(db, user, invite.telegram_user_id)

    influencer_id = provided_influencer_id or invite.influencer_id

    log.info(
        "register.telegram_bound user=%s telegram_id=%s invite=%s influencer=%s",
        user.id, invite.telegram_user_id, invite_code, influencer_id,
    )
    return TelegramBindResult(
        telegram_id=invite.telegram_user_id,
        influencer_id=influencer_id,
    )

