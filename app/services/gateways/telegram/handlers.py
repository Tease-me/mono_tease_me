"""
Telegram Handlers
==================
Handles incoming 1-on-1 private voice calls and text messages via Telegram.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import re
from collections.abc import Awaitable, Callable

from telethon import events
from telethon.tl.types import PhoneCallDiscarded, PhoneCallRequested, UpdatePhoneCall

from app.core.config import settings
from app.services.gateways.telegram.telethon_client import TelethonClientAdapter

log = logging.getLogger(__name__)


class TelegramMessageHandler:
    """Handles incoming Telegram private voice calls and text messages."""

    DEFAULT_IGNORED_USERNAMES = frozenset({"botfather", "spambot", "telegram"})

    def __init__(
        self,
        client: TelethonClientAdapter,
        influencer_id: str,
    ):
        self.client = client
        self.influencer_id = influencer_id
        self._ignored_user_ids = self._parse_ignored_user_ids(
            settings.TELEGRAM_IGNORED_USER_IDS
        )
        self._ignored_usernames = self._parse_ignored_usernames(
            settings.TELEGRAM_IGNORED_USERNAMES
        )

    TEXT_REPLIES = [
        "Hey baby~ i've been waiting for you~",
        "Do you want to call me now on telegram?",
        "Come on~ don't be shy 💕 I want to hear your voice ☺️ pretty pleeeeese~ 💋",
    ]

    MAX_TEXT_REPLIES = 3
    MESSAGE_DEDUPE_TTL_SECONDS = 300
    FINGERPRINT_DEDUPE_TTL_SECONDS = 8
    FIRST_REPLY_DELAY_SECONDS = 120
    FOLLOW_UP_REPLY_DELAY_SECONDS = 10

    @staticmethod
    def _parse_ignored_user_ids(raw_value: str) -> set[int]:
        ignored_user_ids: set[int] = set()
        for item in raw_value.split(","):
            value = item.strip()
            if not value:
                continue
            try:
                ignored_user_ids.add(int(value))
            except ValueError:
                log.warning("telegram.ignore_list_invalid_user_id value=%r", value)
        return ignored_user_ids

    @classmethod
    def _parse_ignored_usernames(cls, raw_value: str) -> set[str]:
        ignored_usernames = set(cls.DEFAULT_IGNORED_USERNAMES)
        for item in raw_value.split(","):
            value = item.strip().lstrip("@").lower()
            if value:
                ignored_usernames.add(value)
        return ignored_usernames

    async def _should_ignore_private_message(self, event) -> bool:
        if event.sender_id in self._ignored_user_ids:
            log.info(
                "telegram.message_ignored influencer=%s reason=ignored_user_id tg_user=%s",
                self.influencer_id,
                event.sender_id,
            )
            return True

        sender = getattr(event, "sender", None)
        if sender is None:
            try:
                sender = await event.get_sender()
            except Exception:
                log.debug(
                    "telegram.message_sender_lookup_failed influencer=%s tg_user=%s",
                    self.influencer_id,
                    event.sender_id,
                    exc_info=True,
                )
                sender = None

        username = getattr(sender, "username", None)
        normalized_username = username.lstrip("@").lower() if username else None
        if normalized_username and normalized_username in self._ignored_usernames:
            log.info(
                "telegram.message_ignored influencer=%s reason=ignored_username tg_user=%s username=%s",
                self.influencer_id,
                event.sender_id,
                normalized_username,
            )
            return True

        return False

    def register(self):
        @self.client.on(events.NewMessage(incoming=True))
        async def handle_new_message(event):
            if not event.is_private or event.out:
                return
            if await self._should_ignore_private_message(event):
                return
            message_text = self._normalize_text(event.raw_text or "")
            if not message_text or not event.sender_id:
                return
            await self._process_text_message(
                user_id=event.sender_id,
                message_id=event.id,
                text=message_text,
                send_text=lambda outgoing_text, parse_mode=None: event.respond(
                    outgoing_text,
                    parse_mode=parse_mode,
                ),
            )

        @self.client.on(events.Raw())
        async def handle_raw_update(update):
            if isinstance(update, UpdatePhoneCall):
                call_type = type(getattr(update, "phone_call", None)).__name__
                log.info("RAW UPDATE: %s (phone_call=%s)", type(update).__name__, call_type)
                await self._handle_incoming_call(update)

        log.info(
            "Telegram handlers registered for influencer=%s (new message + raw voice call)",
            self.influencer_id,
        )

    @staticmethod
    def _build_preview(text: str) -> str:
        preview = re.sub(r"\s+", " ", text.strip())
        if len(preview) > 100:
            return preview[:97] + "..."
        return preview

    @staticmethod
    def _normalize_text(text: str) -> str:
        return re.sub(r"\s+", " ", text.strip())

    @classmethod
    def _reply_delay_seconds(cls, reply_count: int) -> int:
        if reply_count <= 0:
            return cls.FIRST_REPLY_DELAY_SECONDS
        return cls.FOLLOW_UP_REPLY_DELAY_SECONDS

    def _build_fingerprint_key(
        self,
        *,
        session_identity: str,
        user_id: int,
        normalized_text: str,
    ) -> tuple[str, str]:
        digest = hashlib.sha256(normalized_text.encode("utf-8")).hexdigest()[:16]
        return (
            f"tg:text_fingerprint_seen:{session_identity}:{user_id}:{digest}",
            digest,
        )

    async def _log_session_identity(self) -> tuple[str, int | None]:
        session_identity = await self._get_session_identity()
        session_telegram_id = getattr(self.client, "_tease_me_telegram_id", None)
        return session_identity, session_telegram_id

    async def _get_session_identity(self) -> str:
        telegram_id = getattr(self.client, "_tease_me_telegram_id", None)
        if telegram_id is None:
            me = await self.client.get_me()
            telegram_id = getattr(me, "id", None)
            if telegram_id is not None:
                setattr(self.client, "_tease_me_telegram_id", telegram_id)
                setattr(
                    self.client,
                    "_tease_me_telegram_user",
                    getattr(me, "username", None) or getattr(me, "first_name", None),
                )
        return f"telegram_account:{telegram_id or self.influencer_id}"

    async def _process_text_message(
        self,
        *,
        user_id: int,
        message_id: int | None,
        text: str,
        send_text: Callable[[str, str | None], Awaitable[None]],
    ) -> None:
        from app.utils.infrastructure.concurrency import advisory_lock
        from app.utils.infrastructure.redis_pool import get_redis

        redis = await get_redis()
        session_identity, session_telegram_id = await self._log_session_identity()
        normalized_text = self._normalize_text(text)
        log.info(
            "telegram.text_processing_start influencer=%s session_identity=%s session_tg_id=%s tg_user=%s message_id=%s preview=%r",
            self.influencer_id,
            session_identity,
            session_telegram_id,
            user_id,
            message_id,
            self._build_preview(normalized_text),
        )
        if message_id is not None:
            dedupe_key = (
                f"tg:text_message_seen:{session_identity}:{user_id}:{message_id}"
            )
            is_new_message = await redis.set(
                dedupe_key,
                "1",
                ex=self.MESSAGE_DEDUPE_TTL_SECONDS,
                nx=True,
            )
            if not is_new_message:
                log.info(
                    "telegram.text_duplicate_suppressed influencer=%s reason=message_id session_tg_id=%s tg_user=%s message_id=%s",
                    self.influencer_id,
                    session_telegram_id,
                    user_id,
                    message_id,
                )
                return

        fingerprint_key, fingerprint_digest = self._build_fingerprint_key(
            session_identity=session_identity,
            user_id=user_id,
            normalized_text=normalized_text,
        )
        is_new_fingerprint = await redis.set(
            fingerprint_key,
            "1",
            ex=self.FINGERPRINT_DEDUPE_TTL_SECONDS,
            nx=True,
        )
        if not is_new_fingerprint:
            log.info(
                "telegram.text_duplicate_suppressed influencer=%s reason=fingerprint session_tg_id=%s tg_user=%s message_id=%s fingerprint=%s",
                self.influencer_id,
                session_telegram_id,
                user_id,
                message_id,
                fingerprint_digest,
            )
            return

        key = f"tg:text_replies:{session_identity}:{user_id}"
        lock_name = f"tg_text_reply:{session_identity}:{user_id}"

        async with advisory_lock(
            lock_name,
            timeout=5,
            retry_count=1,
            retry_delay=0.05,
            raise_on_fail=False,
        ) as acquired:
            if not acquired:
                log.info(
                    "telegram.text_reply_lock_suppressed influencer=%s reason=lock session_tg_id=%s tg_user=%s message_id=%s fingerprint=%s preview=%r",
                    self.influencer_id,
                    session_telegram_id,
                    user_id,
                    message_id,
                    fingerprint_digest,
                    self._build_preview(normalized_text),
                )
                return

            raw = await redis.get(key)
            count = int(raw) if raw else 0

            log.info(
                "telegram.incoming_text influencer=%s path=new_message session_tg_id=%s tg_user=%s message_id=%s fingerprint=%s reply_count=%s preview=%r",
                self.influencer_id,
                session_telegram_id,
                user_id,
                message_id,
                fingerprint_digest,
                count,
                self._build_preview(normalized_text),
            )

            if count > self.MAX_TEXT_REPLIES:
                log.info(
                    "telegram.text_reply_suppressed influencer=%s session_tg_id=%s tg_user=%s message_id=%s reply_count=%s",
                    self.influencer_id,
                    session_telegram_id,
                    user_id,
                    message_id,
                    count,
                )
                return

            if count < self.MAX_TEXT_REPLIES:
                reply_index = count
                delay_seconds = self._reply_delay_seconds(count)
                log.info(
                    "telegram.text_reply_delay influencer=%s session_tg_id=%s tg_user=%s message_id=%s reply_index=%s delay_seconds=%s",
                    self.influencer_id,
                    session_telegram_id,
                    user_id,
                    message_id,
                    reply_index,
                    delay_seconds,
                )
                await asyncio.sleep(delay_seconds)
                await send_text(self.TEXT_REPLIES[count], None)
                count += 1
                await redis.set(key, count)
                log.info(
                    "telegram.text_reply_sent influencer=%s path=new_message session_tg_id=%s tg_user=%s message_id=%s fingerprint=%s reply_index=%s",
                    self.influencer_id,
                    session_telegram_id,
                    user_id,
                    message_id,
                    fingerprint_digest,
                    reply_index,
                )

            if count == self.MAX_TEXT_REPLIES:
                await redis.set(key, count + 1)
                log.info(
                    "telegram.text_reply_sequence_completed influencer=%s session_tg_id=%s tg_user=%s message_id=%s counter_key=%s terminal_reply_count=%s",
                    self.influencer_id,
                    session_telegram_id,
                    user_id,
                    message_id,
                    key,
                    count + 1,
                )
                await self._send_text_cta(
                    send_text=send_text,
                    telegram_user_id=user_id,
                )

    async def _send_text_cta(
        self,
        *,
        send_text: Callable[[str, str | None], Awaitable[None]],
        telegram_user_id: int,
    ):
        from sqlalchemy import func, select

        from app.core.session import SessionLocal as _SessionLocal
        from app.data.models import Influencer
        from app.services.funnel_tracking_service import track_invite_sent
        from app.services.telegram_invite_service import get_or_create_invite_code
        from app.utils.telegram_link_builder import build_telegram_cta_html

        try:
            async with _SessionLocal() as db:
                result = await db.execute(
                    select(Influencer).where(
                        func.lower(Influencer.id) == self.influencer_id.lower()
                    )
                )
                inf_record = result.scalar_one_or_none()
                actual_id = inf_record.id if inf_record else self.influencer_id

                invite_code = await get_or_create_invite_code(
                    db,
                    telegram_user_id,
                    actual_id,
                )
                asyncio.create_task(
                    track_invite_sent(telegram_user_id, actual_id, invite_code)
                )

                cta_html = build_telegram_cta_html(invite_code, actual_id)
                await send_text(
                    text=f"Want more of me? 💋\n\n{cta_html}",
                    parse_mode="html",
                )

                log.info(
                    "text_cta_sent tg_user=%s influencer=%s",
                    telegram_user_id,
                    actual_id,
                )
        except Exception:
            log.exception(
                "Failed to send text CTA tg_user=%s influencer=%s",
                telegram_user_id,
                self.influencer_id,
            )

    async def _handle_incoming_call(self, update):
        if type(update).__name__ != "UpdatePhoneCall":
            return

        phone_call = getattr(update, "phone_call", None)
        if phone_call is None:
            log.warning("UpdatePhoneCall has no phone_call attribute: %s", update)
            return

        log.info("Detected phone_call of type: %s", type(phone_call).__name__)

        if isinstance(phone_call, PhoneCallDiscarded):
            await self._handle_call_discarded(phone_call)
            return

        if not isinstance(phone_call, PhoneCallRequested):
            return

        caller_id = getattr(phone_call, "admin_id", None)
        if not caller_id:
            log.warning("Incoming call but no caller ID found in %s", phone_call)
            return

        log.info(
            "telegram.incoming_call influencer=%s caller=%s",
            self.influencer_id,
            caller_id,
        )

        from sqlalchemy import func, select

        from app.core.session import SessionLocal as _SessionLocal
        from app.data.models import Influencer
        from app.services.gateways.telegram.voice_engine import voice_call_manager
        from app.services.telegram_call_service import (
            check_telegram_trial_eligibility,
        )

        try:
            async with _SessionLocal() as db:
                result = await db.execute(
                    select(Influencer).where(
                        func.lower(Influencer.id) == self.influencer_id.lower()
                    )
                )
                inf_record = result.scalar_one_or_none()
                actual_id = inf_record.id if inf_record else self.influencer_id
                remaining = await check_telegram_trial_eligibility(db, caller_id)
        except Exception:
            log.exception("telegram.incoming_call failed during DB query")
            return

        if remaining <= 0:
            log.info(
                "trial_gate_blocked tg_user=%s influencer=%s", caller_id, actual_id
            )
            return

        from app.services.gateways.telegram.session_manager import session_manager

        ptg = session_manager.get_pytgcalls(self.influencer_id)
        if not ptg:
            log.error(
                "No PyTgCalls instance for influencer=%s — cannot accept call",
                self.influencer_id,
            )
            try:
                await self.client.send_message(
                    chat_id=caller_id,
                    text="Sorry, voice calls aren't available right now. Try again later! 💕",
                )
            except Exception:
                pass
            return

        session = await voice_call_manager.start_call(
            client=self.client,
            ptg=ptg,
            influencer_id=actual_id,
            telegram_user_id=caller_id,
            chat_id=caller_id,
            phone_call_id=getattr(phone_call, "id", None),
            phone_call_access_hash=getattr(phone_call, "access_hash", None),
        )

        if session:
            from app.services.funnel_tracking_service import track_call_started

            session_id = getattr(session, "conversation_id", None)
            asyncio.create_task(
                track_call_started(caller_id, actual_id, session_id=session_id)
            )

        if not session:
            log.error(
                "Failed to start voice call for influencer=%s caller=%s",
                self.influencer_id,
                caller_id,
            )
            try:
                await self.client.send_message(
                    chat_id=caller_id,
                    text="Sorry, I can't take calls right now. Try again later! 💕",
                )
            except Exception:
                pass

    async def _handle_call_discarded(self, phone_call):
        from app.services.gateways.telegram.voice_engine import voice_call_manager

        caller_id = getattr(phone_call, "admin_id", None)
        reason_obj = getattr(phone_call, "reason", None)
        reason_class = type(reason_obj).__name__ if reason_obj else "unknown"

        log.info(
            "telegram.call_discarded influencer=%s caller=%s reason=%s",
            self.influencer_id,
            caller_id,
            reason_class,
        )

        from sqlalchemy import func, select

        from app.core.session import SessionLocal as _SessionLocal
        from app.data.models import Influencer

        try:
            async with _SessionLocal() as db:
                result = await db.execute(
                    select(Influencer).where(
                        func.lower(Influencer.id) == self.influencer_id.lower()
                    )
                )
                inf_record = result.scalar_one_or_none()
                actual_id = inf_record.id if inf_record else self.influencer_id
        except Exception:
            actual_id = self.influencer_id

        if caller_id:
            try:
                await voice_call_manager.end_call(actual_id, caller_id)
                log.info(
                    "telegram.call_discarded.cleaned_up influencer=%s caller=%s",
                    actual_id,
                    caller_id,
                )
            except Exception:
                log.exception(
                    "telegram.call_discarded.cleanup_error influencer=%s caller=%s",
                    actual_id,
                    caller_id,
                )
        else:
            prefix = f"{actual_id}:"
            stale_keys = [
                k
                for k in list(voice_call_manager._active_calls.keys())
                if k.startswith(prefix)
            ]
            for key in stale_keys:
                session = voice_call_manager._active_calls.get(key)
                if session:
                    log.info(
                        "telegram.call_discarded.cleanup_by_prefix key=%s",
                        key,
                    )
                    try:
                        await session.stop(reason="call_discarded")
                    except Exception:
                        pass
                    voice_call_manager._active_calls.pop(key, None)
