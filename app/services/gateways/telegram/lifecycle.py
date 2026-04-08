"""
Telegram Lifecycle Management
==============================
Startup and shutdown hooks for integrating the Telegram Userbot
with FastAPI's lifespan. Handles automatic session resumption
and graceful shutdown.
"""

import logging

from app.core.config import settings
from app.core.session import SessionLocal
from app.services.repositories.call_record_repository import cleanup_stale_active_calls
from app.services.gateways.telegram.session_manager import (
    TelegramSessionOwnershipError,
    session_manager,
)
from app.services.gateways.telegram.handlers import TelegramMessageHandler

log = logging.getLogger(__name__)

# Track registered handlers to avoid double-registration
_registered_handlers: dict[str, TelegramMessageHandler] = {}


async def start_all_sessions():
    """Resume all saved Telegram sessions on server startup.

    Called from FastAPI lifespan. Only starts sessions that have
    existing session files (already authenticated).
    """
    if not settings.TELEGRAM_USERBOT_ENABLED:
        log.info("Telegram Userbot is disabled (TELEGRAM_USERBOT_ENABLED=false)")
        return

    if not settings.TELEGRAM_API_ID or not settings.TELEGRAM_API_HASH:
        log.warning(
            "Telegram Userbot is enabled but TELEGRAM_API_ID / TELEGRAM_API_HASH "
            "are not configured. Skipping session startup."
        )
        return

    # Mark any calls that were still 'active' from a prior crash as 'abandoned'
    # so they count toward the user's trial budget.
    try:
        async with SessionLocal() as db:
            await cleanup_stale_active_calls(db)
    except Exception:
        log.exception("Failed to clean up stale active calls on startup")

    saved = session_manager.list_saved_sessions()
    if not saved:
        log.info("No saved Telegram sessions found to resume.")
        return

    log.info("Resuming %d saved Telegram session(s): %s", len(saved), saved)

    for influencer_id in saved:
        log.info("Attempting Telegram session resume for influencer=%s", influencer_id)
        try:
            client = await session_manager.create_session(influencer_id)
            _register_handlers(influencer_id, client)
            log.info("Resumed Telegram session for influencer=%s", influencer_id)
        except TelegramSessionOwnershipError as exc:
            log.warning(
                "Skipping Telegram session for influencer=%s: %s",
                influencer_id,
                exc,
            )
        except Exception:
            log.exception(
                "Failed to resume Telegram session for influencer=%s",
                influencer_id,
            )


async def start_session(influencer_id: str, phone_number: str | None = None):
    """Start a new or resume an existing session for a specific influencer.

    Called from the admin API.
    """
    client = await session_manager.create_session(influencer_id, phone_number)
    _register_handlers(influencer_id, client)
    return client


def register_session_handlers(influencer_id: str, client) -> None:
    """Register Telegram handlers for a client once."""
    _register_handlers(influencer_id, client)


async def stop_session(influencer_id: str) -> bool:
    """Stop a specific influencer's session.

    Called from the admin API.
    """
    # End any active voice calls for this influencer
    try:
        from app.services.gateways.telegram.voice_engine import voice_call_manager
        for key, session in list(voice_call_manager._active_calls.items()):
            if key.startswith(f"{influencer_id}:") and session.is_active:
                await session.stop(reason="session_stopped")
    except Exception:
        log.exception("Error stopping voice calls for influencer=%s", influencer_id)

    _registered_handlers.pop(influencer_id, None)
    return await session_manager.stop_session(influencer_id)


async def stop_all_sessions():
    """Gracefully stop all active sessions on server shutdown."""
    if not settings.TELEGRAM_USERBOT_ENABLED:
        return

    # End all active voice calls first
    try:
        from app.services.gateways.telegram.voice_engine import voice_call_manager
        await voice_call_manager.end_all_calls()
    except Exception:
        log.exception("Error stopping voice calls during shutdown")

    log.info("Stopping all Telegram sessions...")
    _registered_handlers.clear()
    await session_manager.stop_all()


def _register_handlers(influencer_id: str, client):
    """Register message handlers on a Pyrogram client.

    Note: PyTgCalls is already started by session_manager.create_session(),
    so no additional voice-engine registration is needed here.
    """
    if influencer_id in _registered_handlers:
        log.debug("Handlers already registered for influencer=%s", influencer_id)
        return
    if getattr(client, "_tease_me_handlers_registered", False):
        log.debug(
            "Handlers already attached to client for influencer=%s",
            influencer_id,
        )
        return

    handler = TelegramMessageHandler(client, influencer_id)
    handler.register()
    setattr(client, "_tease_me_handlers_registered", True)
    _registered_handlers[influencer_id] = handler
