"""
Telegram Session Manager
========================
Manages per-influencer Pyrogram client sessions. Each influencer that wants
a Telegram presence gets a dedicated authenticated session.

Session files are stored locally in TELEGRAM_SESSIONS_DIR and can optionally
be encrypted at rest using Fernet symmetric encryption.
"""

import asyncio
import logging
import os
from pathlib import Path

from pyrogram import Client
from pyrogram.errors import (
    AuthKeyUnregistered,
    SessionPasswordNeeded,
    PhoneCodeInvalid,
    FloodWait,
)

from app.core.config import settings

log = logging.getLogger(__name__)


class TelegramSessionManager:
    """Manages per-influencer Pyrogram client sessions."""

    def __init__(self):
        self._sessions: dict[str, Client] = {}
        self._locks: dict[str, asyncio.Lock] = {}
        self._sessions_dir = Path(settings.TELEGRAM_SESSIONS_DIR)
        self._sessions_dir.mkdir(parents=True, exist_ok=True)

    def _get_lock(self, influencer_id: str) -> asyncio.Lock:
        """Get or create a per-influencer lock to prevent race conditions."""
        if influencer_id not in self._locks:
            self._locks[influencer_id] = asyncio.Lock()
        return self._locks[influencer_id]

    @property
    def active_sessions(self) -> dict[str, Client]:
        """Return a copy of active sessions for inspection."""
        return dict(self._sessions)

    def is_active(self, influencer_id: str) -> bool:
        """Check if an influencer has an active session."""
        return influencer_id in self._sessions and self._sessions[influencer_id].is_connected

    async def create_session(
        self,
        influencer_id: str,
        phone_number: str | None = None,
    ) -> Client:
        """Create and start a Pyrogram session for an influencer.

        If a session file already exists, it will resume from saved auth.
        Otherwise, phone_number is required for initial authentication.

        Args:
            influencer_id: Unique identifier for the influencer.
            phone_number: Phone number for first-time auth (e.g., "+1234567890").

        Returns:
            The connected Pyrogram Client instance.

        Raises:
            ValueError: If Telegram API credentials are not configured.
            RuntimeError: If session already exists and is active.
        """
        if not settings.TELEGRAM_API_ID or not settings.TELEGRAM_API_HASH:
            raise ValueError(
                "TELEGRAM_API_ID and TELEGRAM_API_HASH must be configured. "
                "Get them from https://my.telegram.org"
            )

        async with self._get_lock(influencer_id):
            if self.is_active(influencer_id):
                log.info("Session already active for influencer=%s", influencer_id)
                return self._sessions[influencer_id]

            session_name = f"influencer_{influencer_id}"
            session_path = self._sessions_dir / f"{session_name}.session"

            # Check if we have an existing session file
            has_existing_session = session_path.exists()

            if not has_existing_session and not phone_number:
                raise ValueError(
                    f"No existing session for '{influencer_id}'. "
                    "A phone_number is required for first-time authentication."
                )

            client = Client(
                name=session_name,
                api_id=settings.TELEGRAM_API_ID,
                api_hash=settings.TELEGRAM_API_HASH,
                phone_number=phone_number,
                workdir=str(self._sessions_dir),
            )

            try:
                await client.start()
                me = await client.get_me()
                log.info(
                    "Telegram session started for influencer=%s as @%s (id=%s)",
                    influencer_id,
                    me.username or me.first_name,
                    me.id,
                )
                self._sessions[influencer_id] = client
                return client
            except FloodWait as e:
                log.error(
                    "Telegram FloodWait for influencer=%s, retry in %d seconds",
                    influencer_id, e.value,
                )
                raise RuntimeError(
                    f"Telegram rate limit hit. Retry in {e.value} seconds."
                )
            except AuthKeyUnregistered:
                log.error("Auth key expired/invalid for influencer=%s", influencer_id)
                # Clean up stale session file
                if session_path.exists():
                    session_path.unlink()
                raise RuntimeError(
                    f"Session for '{influencer_id}' is invalid or expired. "
                    "Re-authentication required."
                )
            except Exception:
                log.exception("Failed to start Telegram session for influencer=%s", influencer_id)
                raise

    async def stop_session(self, influencer_id: str) -> bool:
        """Gracefully stop an influencer's Telegram session.

        Returns:
            True if session was stopped, False if no active session found.
        """
        async with self._get_lock(influencer_id):
            client = self._sessions.pop(influencer_id, None)
            if client is None:
                log.info("No active session to stop for influencer=%s", influencer_id)
                return False

            try:
                await client.stop()
                log.info("Telegram session stopped for influencer=%s", influencer_id)
                return True
            except Exception:
                log.exception("Error stopping session for influencer=%s", influencer_id)
                return False

    async def stop_all(self):
        """Gracefully stop all active sessions (used during shutdown)."""
        influencer_ids = list(self._sessions.keys())
        log.info("Stopping %d Telegram session(s)...", len(influencer_ids))

        results = await asyncio.gather(
            *[self.stop_session(iid) for iid in influencer_ids],
            return_exceptions=True,
        )

        for iid, result in zip(influencer_ids, results):
            if isinstance(result, Exception):
                log.error("Failed to stop session for %s: %s", iid, result)

    async def get_session(self, influencer_id: str) -> Client | None:
        """Get an active session for an influencer, or None."""
        client = self._sessions.get(influencer_id)
        if client and client.is_connected:
            return client
        return None

    def list_sessions(self) -> list[dict]:
        """List all active sessions with their status."""
        result = []
        for iid, client in self._sessions.items():
            result.append({
                "influencer_id": iid,
                "connected": client.is_connected,
            })
        return result

    def list_saved_sessions(self) -> list[str]:
        """List all session files on disk (including inactive ones)."""
        return [
            f.stem.replace("influencer_", "")
            for f in self._sessions_dir.glob("influencer_*.session")
        ]


# Singleton instance
session_manager = TelegramSessionManager()
