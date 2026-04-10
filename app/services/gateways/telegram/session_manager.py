"""
Telegram Session Manager
========================
Manages per-influencer Telethon client sessions. Each influencer that wants
a Telegram presence gets a dedicated authenticated session.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from telethon import TelegramClient
from telethon.errors import (
    AuthKeyUnregisteredError,
    FloodWaitError,
    PhoneCodeExpiredError,
    PhoneCodeInvalidError,
    PhoneNumberUnoccupiedError,
    SessionPasswordNeededError,
)

try:
    from pytgcalls import PyTgCalls

    HAS_PYTGCALLS = True
except ImportError:
    HAS_PYTGCALLS = False
    PyTgCalls = None  # type: ignore

from app.core.config import settings
from app.services.gateways.telegram.telethon_client import TelethonClientAdapter
from app.utils.infrastructure.concurrency import AdvisoryLock

log = logging.getLogger(__name__)


class TelegramSessionOwnershipError(RuntimeError):
    """Raised when another process already owns a Telegram session lock."""


class TelegramSessionManager:
    """Manages per-influencer Telethon client sessions."""

    def __init__(self):
        self._sessions: dict[str, TelethonClientAdapter] = {}
        self._pytgcalls: dict[str, PyTgCalls] = {}
        self._locks: dict[str, asyncio.Lock] = {}
        self._ownership_locks: dict[str, AdvisoryLock] = {}
        self._pending_auth: dict[str, dict] = {}
        self._sessions_dir = Path(settings.TELEGRAM_SESSIONS_DIR)
        self._sessions_dir.mkdir(parents=True, exist_ok=True)

    def _get_lock(self, influencer_id: str) -> asyncio.Lock:
        if influencer_id not in self._locks:
            self._locks[influencer_id] = asyncio.Lock()
        return self._locks[influencer_id]

    def _session_path(self, influencer_id: str) -> Path:
        return self._sessions_dir / f"influencer_{influencer_id}.session"

    def _build_client(self, influencer_id: str) -> TelethonClientAdapter:
        raw_client = TelegramClient(
            session=str(self._session_path(influencer_id)),
            api_id=settings.TELEGRAM_API_ID,
            api_hash=settings.TELEGRAM_API_HASH,
            catch_up=True,
            receive_updates=True,
        )
        return TelethonClientAdapter(raw_client)

    @staticmethod
    def _set_client_identity(client: TelethonClientAdapter, me) -> None:
        client._me = me
        setattr(client, "_tease_me_telegram_id", getattr(me, "id", None))
        setattr(
            client,
            "_tease_me_telegram_user",
            getattr(me, "username", None) or getattr(me, "first_name", None),
        )

    @staticmethod
    def _get_client_telegram_id(client: TelethonClientAdapter) -> int | None:
        return getattr(client, "_tease_me_telegram_id", None)

    @staticmethod
    def _get_client_telegram_user(client: TelethonClientAdapter) -> str | None:
        return getattr(client, "_tease_me_telegram_user", None)

    def _find_account_collision(
        self,
        influencer_id: str,
        telegram_id: int | None,
    ) -> str | None:
        if telegram_id is None:
            return None

        for existing_influencer_id, existing_client in self._sessions.items():
            if existing_influencer_id == influencer_id or not existing_client.is_connected:
                continue
            if self._get_client_telegram_id(existing_client) == telegram_id:
                return existing_influencer_id
        return None

    def _assert_unique_account(self, influencer_id: str, me) -> None:
        telegram_id = getattr(me, "id", None)
        conflicting_influencer_id = self._find_account_collision(
            influencer_id,
            telegram_id,
        )
        if conflicting_influencer_id is None:
            return

        raise ValueError(
            "Telegram account collision: influencer "
            f"'{conflicting_influencer_id}' already uses telegram_id={telegram_id}. "
            f"Stop/delete that session before authenticating '{influencer_id}'."
        )

    @staticmethod
    def _ownership_lock_name(telegram_id: int | None) -> str | None:
        if telegram_id is None:
            return None
        return f"tg_session_owner:{telegram_id}"

    async def _acquire_session_ownership_lock(
        self,
        influencer_id: str,
        client: TelethonClientAdapter,
    ) -> None:
        telegram_id = self._get_client_telegram_id(client)
        lock_name = self._ownership_lock_name(telegram_id)
        if lock_name is None:
            log.debug(
                "telegram.session_lock_skipped influencer=%s reason=no_telegram_id",
                influencer_id,
            )
            return

        existing_lock = self._ownership_locks.pop(influencer_id, None)
        if existing_lock:
            log.info(
                "telegram.session_lock_replacing influencer=%s telegram_id=%s lock_name=%s",
                influencer_id,
                telegram_id,
                lock_name,
            )
            await existing_lock.release()

        lock = AdvisoryLock(lock_name, timeout=300, retry_count=1, retry_delay=0.05)
        log.info(
            "telegram.session_lock_attempt influencer=%s telegram_id=%s lock_name=%s",
            influencer_id,
            telegram_id,
            lock_name,
        )
        acquired = await lock.acquire()
        if not acquired:
            log.warning(
                "telegram.session_lock_conflict influencer=%s telegram_id=%s lock_name=%s",
                influencer_id,
                telegram_id,
                lock_name,
            )
            raise TelegramSessionOwnershipError(
                "Telegram session ownership conflict: another process already owns "
                f"telegram_id={telegram_id} for influencer '{influencer_id}'."
            )

        self._ownership_locks[influencer_id] = lock
        setattr(client, "_tease_me_session_lock_name", lock_name)
        log.info(
            "telegram.session_lock_acquired influencer=%s telegram_id=%s lock_name=%s",
            influencer_id,
            telegram_id,
            lock_name,
        )

    async def _release_session_ownership_lock(
        self,
        influencer_id: str,
        client: TelethonClientAdapter | None = None,
    ) -> None:
        lock = self._ownership_locks.pop(influencer_id, None)
        if lock is not None:
            log.info(
                "telegram.session_lock_releasing influencer=%s lock_name=%s",
                influencer_id,
                lock.name,
            )
            await lock.release()
        if client is not None:
            setattr(client, "_tease_me_session_lock_name", None)
        if lock is None:
            log.debug(
                "telegram.session_lock_release_skipped influencer=%s reason=no_lock",
                influencer_id,
            )

    @staticmethod
    def _require_telethon():
        if not settings.TELEGRAM_API_ID or not settings.TELEGRAM_API_HASH:
            raise ValueError(
                "TELEGRAM_API_ID and TELEGRAM_API_HASH must be configured. "
                "Get them from https://my.telegram.org"
            )

    @property
    def active_sessions(self) -> dict[str, TelethonClientAdapter]:
        return dict(self._sessions)

    def is_active(self, influencer_id: str) -> bool:
        return influencer_id in self._sessions and self._sessions[influencer_id].is_connected

    def get_pytgcalls(self, influencer_id: str) -> "PyTgCalls | None":
        return self._pytgcalls.get(influencer_id)

    async def _start_pytgcalls(
        self,
        influencer_id: str,
        client: TelethonClientAdapter,
    ):
        if not HAS_PYTGCALLS:
            log.debug("pytgcalls not installed, skipping voice call setup")
            return

        try:
            ptg = PyTgCalls(client.raw)
            await ptg.start()
            self._pytgcalls[influencer_id] = ptg
            log.info("PyTgCalls started for influencer=%s", influencer_id)
        except Exception:
            log.exception("Failed to start PyTgCalls for influencer=%s", influencer_id)

    async def _stop_pytgcalls(self, influencer_id: str):
        ptg = self._pytgcalls.pop(influencer_id, None)
        if ptg:
            try:
                try:
                    calls = ptg.private_calls
                    if asyncio.iscoroutine(calls):
                        calls = await calls
                    for call_id in list(calls or []):
                        try:
                            await ptg.leave_call(call_id)
                        except Exception:
                            pass
                except Exception:
                    pass
                log.info("PyTgCalls stopped for influencer=%s", influencer_id)
            except Exception:
                log.exception("Error stopping PyTgCalls for influencer=%s", influencer_id)

    @staticmethod
    def _describe_code_type(sent_code) -> str:
        code_type = getattr(sent_code, "type", None)
        if code_type is None:
            return "unknown"
        name = type(code_type).__name__
        if name.startswith("SentCodeType"):
            return name[len("SentCodeType"):].lower()
        return name.lower()

    async def send_code(
        self,
        influencer_id: str,
        phone_number: str,
    ) -> dict:
        self._require_telethon()

        async with self._get_lock(influencer_id):
            if self.is_active(influencer_id):
                return {
                    "status": "already_active",
                    "message": f"Session already active for '{influencer_id}'.",
                }

            session_path = self._session_path(influencer_id)
            if session_path.exists():
                return await self._resume_existing_session(influencer_id)

            client = self._build_client(influencer_id)
            await client.connect()
            try:
                sent_code = await client.raw.send_code_request(phone_number)
            except Exception:
                try:
                    await client.disconnect()
                except Exception:
                    pass
                raise

            delivery_type = self._describe_code_type(sent_code)
            next_type = getattr(sent_code, "next_type", None)
            next_type_str = type(next_type).__name__ if next_type else None
            timeout = getattr(sent_code, "timeout", None)

            self._pending_auth[influencer_id] = {
                "client": client,
                "phone_number": phone_number,
                "phone_code_hash": sent_code.phone_code_hash,
            }

            log.info(
                "Verification code sent for influencer=%s to phone=%s "
                "delivery_type=%s next_type=%s timeout=%s",
                influencer_id,
                phone_number[:6] + "****",
                delivery_type,
                next_type_str,
                timeout,
            )

            delivery_messages = {
                "app": "Code sent as an in-app message in Telegram. Check the 'Telegram' chat.",
                "sms": "Code sent via SMS to the phone number.",
                "call": "Code will be delivered via a phone call.",
                "flashcall": "Code will arrive as a flash call (the code is in the phone number).",
                "missedcall": "Code will arrive as a missed call (the code is the last digits of the caller number).",
                "fragmentsms": "Code sent via Fragment SMS.",
                "emailcode": "Code sent to the associated email address.",
            }
            delivery_msg = delivery_messages.get(
                delivery_type,
                "Verification code sent. Check your Telegram app or phone.",
            )

            return {
                "status": "code_sent",
                "delivery_type": delivery_type,
                "next_type": next_type_str,
                "timeout_seconds": timeout,
                "message": f"{delivery_msg} Use /verify-code to complete.",
                "hint": (
                    f"If you don't receive it, you can call /resend-code after "
                    f"{timeout or 60}s to try the fallback method ({next_type_str or 'none available'})."
                ) if next_type_str else None,
            }

    async def resend_code(
        self,
        influencer_id: str,
    ) -> dict:
        self._require_telethon()

        pending = self._pending_auth.get(influencer_id)
        if not pending:
            raise ValueError(
                f"No pending auth for '{influencer_id}'. Call send-code first."
            )

        client = pending["client"]
        phone_number = pending["phone_number"]
        resent = await client.raw.send_code_request(phone_number, force_sms=True)
        pending["phone_code_hash"] = getattr(
            resent,
            "phone_code_hash",
            pending["phone_code_hash"],
        )

        delivery_type = self._describe_code_type(resent)
        next_type = getattr(resent, "next_type", None)
        next_type_str = type(next_type).__name__ if next_type else None
        timeout = getattr(resent, "timeout", None)

        log.info(
            "Verification code re-sent for influencer=%s delivery_type=%s",
            influencer_id,
            delivery_type,
        )

        return {
            "status": "code_resent",
            "delivery_type": delivery_type,
            "next_type": next_type_str,
            "timeout_seconds": timeout,
            "message": f"Code re-sent via {delivery_type}. Use /verify-code to complete.",
        }

    async def verify_code(
        self,
        influencer_id: str,
        code: str,
        password: str | None = None,
    ) -> TelethonClientAdapter:
        self._require_telethon()

        pending = self._pending_auth.get(influencer_id)
        if not pending:
            raise ValueError(
                f"No pending auth for '{influencer_id}'. Call send-code first."
            )

        client: TelethonClientAdapter = pending["client"]
        phone_number = pending["phone_number"]
        phone_code_hash = pending["phone_code_hash"]

        try:
            try:
                me = await client.raw.sign_in(
                    phone=phone_number,
                    code=code,
                    phone_code_hash=phone_code_hash,
                )
            except SessionPasswordNeededError:
                if not password:
                    raise ValueError(
                        "This account has 2FA enabled. "
                        "Please provide the 'password' field."
                    )
                me = await client.raw.sign_in(password=password)

            if me is None:
                me = await client.get_me()

            self._assert_unique_account(influencer_id, me)
            self._set_client_identity(client, me)
            await self._acquire_session_ownership_lock(influencer_id, client)

            self._sessions[influencer_id] = client
            self._pending_auth.pop(influencer_id, None)

            await self._start_pytgcalls(influencer_id, client)

            log.info(
                "Telegram session authenticated for influencer=%s as @%s (id=%s)",
                influencer_id,
                me.username or me.first_name,
                me.id,
            )
            return client

        except PhoneCodeInvalidError:
            raise ValueError("Invalid verification code. Please try again.")
        except PhoneCodeExpiredError:
            raise ValueError("Verification code expired. Please send a new code.")
        except PhoneNumberUnoccupiedError:
            raise ValueError(
                "SIGN_UP_REQUIRED: This phone number is not registered. "
                "Call sign_up() to create a new account."
            )
        except FloodWaitError as e:
            raise RuntimeError(
                f"Telegram rate limit hit. Retry in {e.seconds} seconds."
            )
        except ValueError:
            raise
        except Exception:
            await self._release_session_ownership_lock(influencer_id, client)
            raise

    async def sign_up(
        self,
        influencer_id: str,
        first_name: str = "User",
        last_name: str = "",
    ) -> TelethonClientAdapter:
        raise ValueError(
            "SIGN_UP_REQUIRED: Creating new Telegram accounts is not supported "
            "by this admin flow. Use an existing Telegram account."
        )

    def has_pending_auth(self, influencer_id: str) -> bool:
        return influencer_id in self._pending_auth

    async def cancel_pending_auth(self, influencer_id: str) -> None:
        pending = self._pending_auth.pop(influencer_id, None)
        if pending:
            client = pending.get("client")
            if client:
                try:
                    await client.disconnect()
                except Exception:
                    pass

    async def _resume_existing_session(self, influencer_id: str) -> dict:
        session_path = self._session_path(influencer_id)
        client = self._build_client(influencer_id)

        try:
            await client.connect()
            if not await client.raw.is_user_authorized():
                raise RuntimeError("Session is not authorized")

            me = await client.get_me()
            self._assert_unique_account(influencer_id, me)
            self._set_client_identity(client, me)
            await self._acquire_session_ownership_lock(influencer_id, client)
            self._sessions[influencer_id] = client

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
        except ValueError:
            await self._release_session_ownership_lock(influencer_id, client)
            try:
                await client.disconnect()
            except Exception:
                pass
            raise
        except TelegramSessionOwnershipError:
            await self._release_session_ownership_lock(influencer_id, client)
            try:
                await client.disconnect()
            except Exception:
                pass
            raise
        except (AuthKeyUnregisteredError, EOFError, Exception) as exc:
            log.warning(
                "Could not resume session for %s (%s), removing stale file",
                influencer_id,
                type(exc).__name__,
            )
            await self._release_session_ownership_lock(influencer_id, client)
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

    async def create_session(
        self,
        influencer_id: str,
        phone_number: str | None = None,
    ) -> TelethonClientAdapter:
        self._require_telethon()

        async with self._get_lock(influencer_id):
            if self.is_active(influencer_id):
                log.info("Session already active for influencer=%s", influencer_id)
                return self._sessions[influencer_id]

            session_path = self._session_path(influencer_id)
            if not session_path.exists():
                raise ValueError(
                    f"No existing session for '{influencer_id}'. "
                    "Use the send-code/verify-code API for first-time authentication."
                )

            try:
                await self._resume_existing_session(influencer_id)
            except FloodWaitError as e:
                raise RuntimeError(
                    f"Telegram rate limit hit. Retry in {e.seconds} seconds."
                )

            return self._sessions[influencer_id]

    async def stop_session(self, influencer_id: str) -> bool:
        async with self._get_lock(influencer_id):
            await self._stop_pytgcalls(influencer_id)

            client = self._sessions.pop(influencer_id, None)
            if client is None:
                await self._release_session_ownership_lock(influencer_id)
                return False
            try:
                await self._release_session_ownership_lock(influencer_id, client)
                await client.disconnect()
                log.info("Telegram session stopped for influencer=%s", influencer_id)
                return True
            except Exception:
                log.exception("Error stopping session for influencer=%s", influencer_id)
                return False

    async def delete_session(
        self,
        influencer_id: str,
        *,
        terminate_on_telegram: bool = False,
    ) -> dict:
        async with self._get_lock(influencer_id):
            stopped = False
            logged_out = False
            file_deleted = False

            client = self._sessions.pop(influencer_id, None)
            if client:
                await self._release_session_ownership_lock(influencer_id, client)
                if terminate_on_telegram:
                    try:
                        logged_out = await client.log_out()
                        stopped = True
                        log.info(
                            "Telegram session terminated on server for influencer=%s",
                            influencer_id,
                        )
                    except Exception:
                        log.exception(
                            "Error logging out from Telegram for %s, falling back to disconnect",
                            influencer_id,
                        )

                if not stopped:
                    try:
                        await client.disconnect()
                        stopped = True
                    except Exception:
                        log.exception(
                            "Error stopping session during delete for %s",
                            influencer_id,
                        )
            elif terminate_on_telegram and self._session_path(influencer_id).exists():
                temp_client = self._build_client(influencer_id)
                try:
                    await temp_client.connect()
                    if await temp_client.raw.is_user_authorized():
                        logged_out = await temp_client.log_out()
                        stopped = True
                except Exception:
                    log.exception(
                        "Error logging out inactive Telegram session for %s",
                        influencer_id,
                    )
                finally:
                    try:
                        await temp_client.disconnect()
                    except Exception:
                        pass

            session_path = self._session_path(influencer_id)
            if session_path.exists():
                session_path.unlink()
                file_deleted = True
                log.info("Deleted session file for influencer=%s", influencer_id)

            self._pending_auth.pop(influencer_id, None)
            if client is None:
                await self._release_session_ownership_lock(influencer_id)

            return {
                "connection_stopped": stopped,
                "logged_out_from_telegram": logged_out,
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

    async def get_session(self, influencer_id: str) -> TelethonClientAdapter | None:
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
                "telegram_user": self._get_client_telegram_user(client),
                "telegram_id": self._get_client_telegram_id(client),
            })
        return result

    def list_saved_sessions(self) -> list[str]:
        return [
            f.stem.replace("influencer_", "")
            for f in self._sessions_dir.glob("influencer_*.session")
        ]


session_manager = TelegramSessionManager()
