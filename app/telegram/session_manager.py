"""
Telegram Session Manager
========================
Manages per-influencer Pyrogram client sessions. Each influencer that wants
a Telegram presence gets a dedicated authenticated session.

Session files are stored locally in TELEGRAM_SESSIONS_DIR and can optionally
be encrypted at rest using Fernet symmetric encryption.
"""

from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path

try:
    from pyrogram import Client
    from pyrogram.errors import (
        AuthKeyUnregistered,
        SessionPasswordNeeded,
        PhoneCodeInvalid,
        FloodWait,
    )
    HAS_PYROGRAM = True
except ImportError:
    HAS_PYROGRAM = False
    Client = None  # type: ignore

# Ensure pyrogram has error classes expected by py-tgcalls (v2.2.11+)
try:
    from pyrogram.errors import GroupcallForbidden  # noqa: F401
except ImportError:
    import pyrogram.errors as _pe

    class _GroupcallForbidden(Exception):
        pass

    _pe.GroupcallForbidden = _GroupcallForbidden  # type: ignore[attr-defined]

try:
    from pytgcalls import PyTgCalls
    HAS_PYTGCALLS = True
except ImportError:
    HAS_PYTGCALLS = False
    PyTgCalls = None  # type: ignore

from app.core.config import settings

log = logging.getLogger(__name__)


class TelegramSessionManager:
    """Manages per-influencer Pyrogram client sessions."""

    def __init__(self):
        self._sessions: dict[str, Client] = {}
        self._pytgcalls: dict[str, PyTgCalls] = {}  # per-influencer PyTgCalls instances
        self._locks: dict[str, asyncio.Lock] = {}
        self._pending_auth: dict[str, dict] = {}  # influencer_id -> {client, phone_code_hash}
        self._sessions_dir = Path(settings.TELEGRAM_SESSIONS_DIR)
        self._sessions_dir.mkdir(parents=True, exist_ok=True)

    def _get_lock(self, influencer_id: str) -> asyncio.Lock:
        """Get or create a per-influencer lock to prevent race conditions."""
        if influencer_id not in self._locks:
            self._locks[influencer_id] = asyncio.Lock()
        return self._locks[influencer_id]

    @staticmethod
    def _require_pyrogram():
        if not HAS_PYROGRAM:
            raise ValueError("pyrogram is not installed. Run: pip install pyrogram")
        if not settings.TELEGRAM_API_ID or not settings.TELEGRAM_API_HASH:
            raise ValueError(
                "TELEGRAM_API_ID and TELEGRAM_API_HASH must be configured. "
                "Get them from https://my.telegram.org"
            )

    @property
    def active_sessions(self) -> dict[str, Client]:
        """Return a copy of active sessions for inspection."""
        return dict(self._sessions)

    def is_active(self, influencer_id: str) -> bool:
        """Check if an influencer has an active session."""
        return influencer_id in self._sessions and self._sessions[influencer_id].is_connected

    def get_pytgcalls(self, influencer_id: str) -> "PyTgCalls | None":
        """Get the PyTgCalls instance for an influencer (if active)."""
        return self._pytgcalls.get(influencer_id)

    async def _start_pytgcalls(self, influencer_id: str, client: Client):
        """Create and start a PyTgCalls instance for voice call support."""
        if not HAS_PYTGCALLS:
            log.debug("pytgcalls not installed, skipping voice call setup")
            return

        try:
            ptg = PyTgCalls(client)
            await ptg.start()
            self._pytgcalls[influencer_id] = ptg
            log.info("PyTgCalls started for influencer=%s", influencer_id)
        except Exception:
            log.exception("Failed to start PyTgCalls for influencer=%s", influencer_id)

    async def _stop_pytgcalls(self, influencer_id: str):
        """Stop PyTgCalls instance for an influencer."""
        ptg = self._pytgcalls.pop(influencer_id, None)
        if ptg:
            try:
                # Leave any active calls before stopping
                for call_id in list(ptg.private_calls or []):
                    try:
                        await ptg.leave_call(call_id)
                    except Exception:
                        pass
                log.info("PyTgCalls stopped for influencer=%s", influencer_id)
            except Exception:
                log.exception("Error stopping PyTgCalls for influencer=%s", influencer_id)

    # ─────────────────── 2-step headless auth ───────────────────

    async def send_code(
        self,
        influencer_id: str,
        phone_number: str,
    ) -> dict:
        """Step 1: Send a verification code to the phone number.

        Creates a bare Pyrogram client, connects, and requests a code.
        Stores the pending client + phone_code_hash for verify_code().

        Returns:
            dict with status info (phone_code_hash is stored internally).
        """
        self._require_pyrogram()

        async with self._get_lock(influencer_id):
            if self.is_active(influencer_id):
                return {
                    "status": "already_active",
                    "message": f"Session already active for '{influencer_id}'.",
                }

            session_name = f"influencer_{influencer_id}"
            session_path = self._sessions_dir / f"{session_name}.session"

            # If session file exists, try resuming directly
            if session_path.exists():
                return await self._resume_existing_session(influencer_id, session_name)

            client = Client(
                name=session_name,
                api_id=settings.TELEGRAM_API_ID,
                api_hash=settings.TELEGRAM_API_HASH,
                workdir=str(self._sessions_dir),
            )

            await client.connect()
            sent_code = await client.send_code(phone_number)

            self._pending_auth[influencer_id] = {
                "client": client,
                "phone_number": phone_number,
                "phone_code_hash": sent_code.phone_code_hash,
            }

            log.info(
                "Verification code sent for influencer=%s to phone=%s",
                influencer_id,
                phone_number[:6] + "****",
            )

            return {
                "status": "code_sent",
                "message": "Verification code sent to Telegram app. Use /verify-code to complete.",
            }

    async def verify_code(
        self,
        influencer_id: str,
        code: str,
        password: str | None = None,
    ) -> Client:
        """Step 2: Verify the code and complete sign-in.

        Args:
            influencer_id: The influencer this session belongs to.
            code: The verification code from Telegram.
            password: 2FA password if the account has it enabled.

        Returns:
            The authenticated Pyrogram Client.
        """
        self._require_pyrogram()

        pending = self._pending_auth.get(influencer_id)
        if not pending:
            raise ValueError(
                f"No pending auth for '{influencer_id}'. Call send-code first."
            )

        client = pending["client"]
        phone_number = pending["phone_number"]
        phone_code_hash = pending["phone_code_hash"]

        try:
            try:
                await client.sign_in(
                    phone_number=phone_number,
                    phone_code_hash=phone_code_hash,
                    phone_code=code,
                )
            except SessionPasswordNeeded:
                if not password:
                    raise ValueError(
                        "This account has 2FA enabled. "
                        "Please provide the 'password' field."
                    )
                await client.check_password(password)

            me = await client.get_me()

            # Start the Pyrogram dispatcher so handlers fire on incoming updates
            await client.initialize()

            self._sessions[influencer_id] = client
            self._pending_auth.pop(influencer_id, None)

            # Start PyTgCalls for voice call support
            await self._start_pytgcalls(influencer_id, client)

            log.info(
                "Telegram session authenticated for influencer=%s as @%s (id=%s)",
                influencer_id,
                me.username or me.first_name,
                me.id,
            )
            return client

        except PhoneCodeInvalid:
            raise ValueError("Invalid verification code. Please try again.")
        except FloodWait as e:
            raise RuntimeError(
                f"Telegram rate limit hit. Retry in {e.value} seconds."
            )
        except Exception:
            # Clean up on failure
            self._pending_auth.pop(influencer_id, None)
            try:
                await client.disconnect()
            except Exception:
                pass
            raise

    async def _resume_existing_session(
        self, influencer_id: str, session_name: str
    ) -> dict:
        """Resume an existing session from a saved session file.

        Uses client.start() which, for VALID session files, skips the
        authorize() step and goes straight to connect + dispatcher start.
        If the session is stale/invalid, start() would ask for stdin input —
        we catch that (EOFError) and clean up the bad file.
        """
        session_path = self._sessions_dir / f"{session_name}.session"
        client = Client(
            name=session_name,
            api_id=settings.TELEGRAM_API_ID,
            api_hash=settings.TELEGRAM_API_HASH,
            workdir=str(self._sessions_dir),
        )

        try:
            await client.start()
            me = await client.get_me()
            self._sessions[influencer_id] = client

            # Start PyTgCalls for voice call support
            await self._start_pytgcalls(influencer_id, client)

            log.info(
                "Resumed existing session for influencer=%s as @%s",
                influencer_id,
                me.username or me.first_name,
            )
            return {
                "status": "resumed",
                "message": f"Existing session resumed as @{me.username or me.first_name}.",
                "telegram_user": me.username or me.first_name,
                "telegram_id": me.id,
            }
        except (EOFError, AuthKeyUnregistered, AttributeError) as e:
            # Session file is invalid, partial, or expired — clean up
            log.warning(
                "Could not resume session for %s (%s), removing stale file",
                influencer_id, type(e).__name__,
            )
            try:
                await client.disconnect()
            except Exception:
                pass
            if session_path.exists():
                session_path.unlink()
            raise RuntimeError(
                f"Saved session for '{influencer_id}' is invalid or expired. "
                "Call send-code again with a phone number to re-authenticate."
            )

    # ─────────────────── legacy start (for auto-resume) ───────────────────

    async def create_session(
        self,
        influencer_id: str,
        phone_number: str | None = None,
    ) -> Client:
        """Create and start a Pyrogram session (used for auto-resume on startup).

        Only works for existing session files. For new auth, use
        send_code() + verify_code() instead.
        """
        if not HAS_PYROGRAM:
            raise ValueError("pyrogram is not installed. Run: pip install pyrogram")

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

            if not session_path.exists():
                raise ValueError(
                    f"No existing session for '{influencer_id}'. "
                    "Use the send-code/verify-code API for first-time authentication."
                )

            client = Client(
                name=session_name,
                api_id=settings.TELEGRAM_API_ID,
                api_hash=settings.TELEGRAM_API_HASH,
                workdir=str(self._sessions_dir),
            )

            try:
                await client.start()
                me = await client.get_me()
                self._sessions[influencer_id] = client

                # Start PyTgCalls for voice call support
                await self._start_pytgcalls(influencer_id, client)

                log.info(
                    "Telegram session started for influencer=%s as @%s (id=%s)",
                    influencer_id,
                    me.username or me.first_name,
                    me.id,
                )
                return client
            except FloodWait as e:
                raise RuntimeError(
                    f"Telegram rate limit hit. Retry in {e.value} seconds."
                )
            except (AuthKeyUnregistered, EOFError, Exception) as exc:
                log.warning(
                    "Cannot resume session for %s (%s), removing file",
                    influencer_id, type(exc).__name__,
                )
                try:
                    await client.disconnect()
                except Exception:
                    pass
                if session_path.exists():
                    session_path.unlink()
                raise RuntimeError(
                    f"Session for '{influencer_id}' is invalid or expired. "
                    "Re-authentication required via send-code/verify-code."
                )

    # ─────────────────── lifecycle ───────────────────

    async def stop_session(self, influencer_id: str) -> bool:
        async with self._get_lock(influencer_id):
            # Stop PyTgCalls first
            await self._stop_pytgcalls(influencer_id)

            client = self._sessions.pop(influencer_id, None)
            if client is None:
                return False
            try:
                await client.stop()
                log.info("Telegram session stopped for influencer=%s", influencer_id)
                return True
            except Exception:
                log.exception("Error stopping session for influencer=%s", influencer_id)
                return False

    async def delete_session(self, influencer_id: str) -> dict:
        """Fully wipe a session: stop connection, delete file, clear pending auth."""
        async with self._get_lock(influencer_id):
            stopped = False
            file_deleted = False

            # Stop active connection
            client = self._sessions.pop(influencer_id, None)
            if client:
                try:
                    await client.stop()
                    stopped = True
                except Exception:
                    log.exception("Error stopping session during delete for %s", influencer_id)

            # Delete session file
            session_name = f"influencer_{influencer_id}"
            session_path = self._sessions_dir / f"{session_name}.session"
            if session_path.exists():
                session_path.unlink()
                file_deleted = True
                log.info("Deleted session file for influencer=%s", influencer_id)

            # Clear pending auth
            self._pending_auth.pop(influencer_id, None)

            return {
                "connection_stopped": stopped,
                "file_deleted": file_deleted,
            }

    async def stop_all(self):
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
        client = self._sessions.get(influencer_id)
        if client and client.is_connected:
            return client
        return None

    def list_sessions(self) -> list[dict]:
        result = []
        for iid, client in self._sessions.items():
            result.append({
                "influencer_id": iid,
                "connected": client.is_connected,
            })
        return result

    def list_saved_sessions(self) -> list[str]:
        return [
            f.stem.replace("influencer_", "")
            for f in self._sessions_dir.glob("influencer_*.session")
        ]


# Singleton instance
session_manager = TelegramSessionManager()
