"""Fire-and-forget funnel tracking service.

Every function opens its OWN SessionLocal() context — never receives
the request session.  All functions are wrapped in try/except and
never raise — a tracking failure must never break user-facing flows.
"""

import logging

from app.core.session import SessionLocal
from app.data.models import TelegramInvite
from app.services.repositories.funnel_repository import (
    record_event,
    event_exists,
    get_invite_by_code,
    get_invite_by_claimed_user,
)

log = logging.getLogger(__name__)


# ── core ────────────────────────────────────────────────────────────

async def track(
    event_type: str,
    *,
    telegram_user_id: int,
    influencer_id: str,
    user_id: int | None = None,
    invite_code: str | None = None,
    session_id: str | None = None,
    meta: dict | None = None,
) -> None:
    """Record a single funnel event.  Never raises."""
    try:
        async with SessionLocal() as db:
            await record_event(
                db,
                event_type=event_type,
                telegram_user_id=telegram_user_id,
                influencer_id=influencer_id,
                user_id=user_id,
                invite_code=invite_code,
                session_id=session_id,
                meta=meta,
            )
    except Exception:
        log.warning("Failed to track funnel event %s", event_type, exc_info=True)


# ── convenience wrappers ────────────────────────────────────────────

async def track_call_started(
    telegram_user_id: int,
    influencer_id: str,
    session_id: str | None = None,
) -> None:
    await track(
        "call_started",
        telegram_user_id=telegram_user_id,
        influencer_id=influencer_id,
        session_id=session_id,
    )


async def track_call_completed(
    telegram_user_id: int,
    influencer_id: str,
    session_id: str,
    duration_secs: float,
) -> None:
    await track(
        "call_completed",
        telegram_user_id=telegram_user_id,
        influencer_id=influencer_id,
        session_id=session_id,
        meta={"duration_secs": duration_secs},
    )


async def track_trial_exhausted(
    telegram_user_id: int,
    influencer_id: str,
    session_id: str | None = None,
) -> None:
    await track(
        "trial_exhausted",
        telegram_user_id=telegram_user_id,
        influencer_id=influencer_id,
        session_id=session_id,
    )


async def track_invite_sent(
    telegram_user_id: int,
    influencer_id: str,
    invite_code: str,
) -> None:
    await track(
        "invite_sent",
        telegram_user_id=telegram_user_id,
        influencer_id=influencer_id,
        invite_code=invite_code,
    )


async def track_registration_completed(
    telegram_user_id: int,
    influencer_id: str,
    user_id: int,
    invite_code: str,
) -> None:
    await track(
        "registration_completed",
        telegram_user_id=telegram_user_id,
        influencer_id=influencer_id,
        user_id=user_id,
        invite_code=invite_code,
    )


# ── helpers that look up telegram_user_id from the invite table ────

async def lookup_invite(code: str) -> TelegramInvite | None:
    """Look up a TelegramInvite by code. Never raises."""
    try:
        async with SessionLocal() as db:
            return await get_invite_by_code(db, code)
    except Exception:
        log.warning("Failed to look up invite code=%s", code, exc_info=True)
        return None


async def _get_invite_for_user(user_id: int) -> TelegramInvite | None:
    """Fetch the claimed TelegramInvite for a given user_id.

    Returns None if the user did not come through the Telegram funnel.
    """
    try:
        async with SessionLocal() as db:
            return await get_invite_by_claimed_user(db, user_id)
    except Exception:
        log.warning(
            "Failed to look up TelegramInvite for user_id=%s", user_id, exc_info=True
        )
        return None


async def track_email_verified(user_id: int) -> None:
    """Track email verification — looks up telegram_user_id from invite."""
    invite = await _get_invite_for_user(user_id)
    if not invite:
        return
    await track(
        "email_verified",
        telegram_user_id=invite.telegram_user_id,
        influencer_id=invite.influencer_id,
        user_id=user_id,
        invite_code=invite.code,
    )


async def track_influencer_followed(user_id: int, influencer_id: str) -> None:
    """Track when a Telegram-funnel user follows an influencer."""
    invite = await _get_invite_for_user(user_id)
    if not invite:
        return
    await track(
        "influencer_followed",
        telegram_user_id=invite.telegram_user_id,
        influencer_id=influencer_id,
        user_id=user_id,
    )


async def track_first_chat(user_id: int, influencer_id: str) -> None:
    """Track first chat message — deduplicates so only one event per user+influencer."""
    invite = await _get_invite_for_user(user_id)
    if not invite:
        return
    try:
        async with SessionLocal() as db:
            if await event_exists(db, "first_chat", user_id, influencer_id):
                return
    except Exception:
        log.warning(
            "Failed to check first_chat dedup for user_id=%s", user_id, exc_info=True
        )
        return
    await track(
        "first_chat",
        telegram_user_id=invite.telegram_user_id,
        influencer_id=influencer_id,
        user_id=user_id,
    )


async def track_first_payment(
    user_id: int, influencer_id: str, amount_cents: int
) -> None:
    """Track first payment — deduplicates so only one event per user+influencer."""
    invite = await _get_invite_for_user(user_id)
    if not invite:
        return
    try:
        async with SessionLocal() as db:
            if await event_exists(db, "first_payment", user_id, influencer_id):
                return
    except Exception:
        log.warning(
            "Failed to check first_payment dedup for user_id=%s",
            user_id,
            exc_info=True,
        )
        return
    await track(
        "first_payment",
        telegram_user_id=invite.telegram_user_id,
        influencer_id=influencer_id,
        user_id=user_id,
        meta={"amount_cents": amount_cents},
    )
