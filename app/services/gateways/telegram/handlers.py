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

from pyrogram import Client

log = logging.getLogger(__name__)


class TelegramMessageHandler:
    """Handles incoming Telegram private voice calls and text messages.

    Registers a raw update handler for voice calls and a message handler
    for text auto-replies (up to 3 replies + CTA link, then silent).
    """

    def __init__(
        self,
        client: Client,
        influencer_id: str,
    ):
        self.client = client
        self.influencer_id = influencer_id
        self._self_user_id: int | None = None  # Cached to avoid get_me() per message

    # Auto-reply messages for text conversations (generic, no influencer name)
    TEXT_REPLIES = [
        "Hey baby~ i've been waiting for you~",
        "Do you want to call me now on telegram?",
        "Come on~ don't be shy 💕 I want to hear your voice ☺️ pretty pleeeeese~ 💋",
    ]

    # Max text replies before sending CTA link and going silent
    MAX_TEXT_REPLIES = 3
    MESSAGE_DEDUPE_TTL_SECONDS = 300
    FINGERPRINT_DEDUPE_TTL_SECONDS = 8
    FIRST_REPLY_DELAY_SECONDS = 120
    FOLLOW_UP_REPLY_DELAY_SECONDS = 10

    def register(self):
        """Register voice call and text message handlers on the Pyrogram client."""

        @self.client.on_raw_update()
        async def handle_raw_update(_client: Client, update, users, chats):
            """Detect incoming private voice calls and text DMs via raw updates."""
            update_class = type(update).__name__
            if update_class == "UpdatePhoneCall":
                call_type = type(getattr(update, "phone_call", None)).__name__
                log.info("RAW UPDATE: %s (phone_call=%s)", update_class, call_type)
            await self._handle_incoming_text_update(update)
            await self._handle_incoming_call(update)

        log.info(
            "Telegram handlers registered for influencer=%s (raw text + voice call)",
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
        """Normalize text for dedupe/logging consistency."""
        return re.sub(r"\s+", " ", text.strip())

    @classmethod
    def _reply_delay_seconds(cls, reply_count: int) -> int:
        """Return the delay before sending a text auto-reply."""
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
        """Return short-lived logical-message fingerprint key and digest."""
        digest = hashlib.sha256(normalized_text.encode("utf-8")).hexdigest()[:16]
        return (
            f"tg:text_fingerprint_seen:{session_identity}:{user_id}:{digest}",
            digest,
        )

    async def _log_session_identity(self) -> tuple[str, int | None]:
        """Return session identity data for consistent logging."""
        session_identity = await self._get_session_identity()
        session_telegram_id = getattr(self.client, "_tease_me_telegram_id", None)
        return session_identity, session_telegram_id

    async def _get_session_identity(self) -> str:
        """Return a stable Redis identity for the authenticated Telegram account."""
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
        send_reply: Callable[[str], Awaitable[None]],
    ) -> None:
        """Reply to private text messages up to MAX_TEXT_REPLIES, then send CTA link.

        Tracks reply count per (influencer, telegram_user) in Redis.
        After all replies are sent, sends the influencer CTA link once and goes silent.
        """
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
            log.debug(
                "telegram.text_message_id_recorded influencer=%s session_tg_id=%s tg_user=%s message_id=%s dedupe_key=%s",
                self.influencer_id,
                session_telegram_id,
                user_id,
                message_id,
                dedupe_key,
            )

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
        log.debug(
            "telegram.text_fingerprint_recorded influencer=%s session_tg_id=%s tg_user=%s message_id=%s fingerprint_key=%s fingerprint=%s ttl=%s",
            self.influencer_id,
            session_telegram_id,
            user_id,
            message_id,
            fingerprint_key,
            fingerprint_digest,
            self.FINGERPRINT_DEDUPE_TTL_SECONDS,
        )

        key = f"tg:text_replies:{session_identity}:{user_id}"
        lock_name = f"tg_text_reply:{session_identity}:{user_id}"
        log.debug(
            "telegram.text_reply_lock_attempt influencer=%s session_tg_id=%s tg_user=%s message_id=%s lock_name=%s counter_key=%s",
            self.influencer_id,
            session_telegram_id,
            user_id,
            message_id,
            lock_name,
            key,
        )

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
            log.debug(
                "telegram.text_reply_counter_loaded influencer=%s session_tg_id=%s tg_user=%s message_id=%s counter_key=%s reply_count=%s",
                self.influencer_id,
                session_telegram_id,
                user_id,
                message_id,
                key,
                count,
            )

            log.info(
                "telegram.incoming_text influencer=%s path=raw_update session_tg_id=%s tg_user=%s message_id=%s fingerprint=%s reply_count=%s preview=%r",
                self.influencer_id,
                session_telegram_id,
                user_id,
                message_id,
                fingerprint_digest,
                count,
                self._build_preview(normalized_text),
            )

            if count > self.MAX_TEXT_REPLIES:
                # Already sent all replies + CTA — stay silent
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
                await send_reply(self.TEXT_REPLIES[count])
                count += 1
                await redis.set(key, count)
                log.info(
                    "telegram.text_reply_sent influencer=%s path=raw_update session_tg_id=%s tg_user=%s message_id=%s fingerprint=%s reply_index=%s",
                    self.influencer_id,
                    session_telegram_id,
                    user_id,
                    message_id,
                    fingerprint_digest,
                    reply_index,
                )
                log.debug(
                    "telegram.text_reply_counter_saved influencer=%s session_tg_id=%s tg_user=%s message_id=%s counter_key=%s new_reply_count=%s",
                    self.influencer_id,
                    session_telegram_id,
                    user_id,
                    message_id,
                    key,
                    count,
                )

            if count == self.MAX_TEXT_REPLIES:
                # All 3 replies sent — mark as done so future messages are silent
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

    async def _handle_incoming_text_update(self, update) -> None:
        """Process incoming private text DMs from raw Telegram updates."""
        update_class = type(update).__name__
        log.debug(
            "telegram.raw_update_received influencer=%s class=%s",
            self.influencer_id,
            update_class,
        )

        if hasattr(update, "updates") and isinstance(getattr(update, "updates"), list):
            log.debug(
                "telegram.raw_update_container influencer=%s class=%s nested_count=%s",
                self.influencer_id,
                update_class,
                len(getattr(update, "updates", []) or []),
            )
            for nested_update in update.updates:
                await self._handle_incoming_text_update(nested_update)
            return

        if hasattr(update, "update") and update_class.startswith("UpdateShort"):
            log.debug(
                "telegram.raw_update_short_wrapper influencer=%s class=%s nested_class=%s",
                self.influencer_id,
                update_class,
                type(getattr(update, "update", None)).__name__,
            )
            await self._handle_incoming_text_update(update.update)
            return

        if update_class == "UpdateShortMessage":
            if getattr(update, "out", False):
                return
            message_text = self._normalize_text(getattr(update, "message", None) or "")
            user_id = getattr(update, "user_id", None)
            if not user_id or not message_text:
                return
            log.info(
                "telegram.raw_incoming_text_update influencer=%s class=%s tg_user=%s message_id=%s",
                self.influencer_id,
                update_class,
                user_id,
                getattr(update, "id", None),
            )
            await self._process_text_message(
                user_id=user_id,
                message_id=getattr(update, "id", None),
                text=message_text,
                send_reply=lambda reply_text: self.client.send_message(
                    chat_id=user_id,
                    text=reply_text,
                ),
            )
            return

        if update_class != "UpdateNewMessage":
            log.debug(
                "telegram.raw_update_ignored influencer=%s class=%s",
                self.influencer_id,
                update_class,
            )
            return

        raw_message = getattr(update, "message", None)
        if raw_message is None:
            return
        if type(raw_message).__name__ == "MessageService":
            return
        if getattr(raw_message, "out", False):
            return

        peer_id = getattr(raw_message, "peer_id", None)
        if type(peer_id).__name__ != "PeerUser":
            return

        user_id = getattr(peer_id, "user_id", None)
        message_text = self._normalize_text(getattr(raw_message, "message", None) or "")
        if not user_id or not message_text:
            return
        log.info(
            "telegram.raw_incoming_text_update influencer=%s class=%s tg_user=%s message_id=%s",
            self.influencer_id,
            update_class,
            user_id,
            getattr(raw_message, "id", None),
        )

        await self._process_text_message(
            user_id=user_id,
            message_id=getattr(raw_message, "id", None),
            text=message_text,
            send_reply=lambda reply_text: self.client.send_message(
                chat_id=user_id,
                text=reply_text,
            ),
        )

    async def _send_text_cta(self, *, chat_id: int, telegram_user_id: int):
        """Send the influencer CTA link as a follow-up after text replies."""
        import asyncio

        from pyrogram import enums
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
                await self.client.send_message(
                    chat_id=chat_id,
                    text=f"Want more of me? 💋\n\n{cta_html}",
                    parse_mode=enums.ParseMode.HTML,
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
        """Handle an incoming private voice call via Telegram's raw API.

        Detects PhoneCallRequested updates, checks billing eligibility,
        and starts a VoiceCallSession using the voice engine.
        """
        # Unpack wrapped updates
        if hasattr(update, "updates") and isinstance(getattr(update, "updates"), list):
            for u in update.updates:
                await self._handle_incoming_call(u)
            return

        if hasattr(update, "update") and type(update).__name__.startswith(
            "UpdateShort"
        ):
            await self._handle_incoming_call(update.update)
            return

        # Telegram sends UpdatePhoneCall with phone_call of type PhoneCallRequested
        update_class = type(update).__name__
        if "Phone" in update_class or "Call" in update_class:
            log.info("_handle_incoming_call checking update: class=%s", update_class)

        if update_class != "UpdatePhoneCall":
            return

        phone_call = getattr(update, "phone_call", None)
        if phone_call is None:
            log.warning("UpdatePhoneCall has no phone_call attribute: %s", update)
            return

        call_class = type(phone_call).__name__
        log.info("Detected phone_call of type: %s", call_class)

        # Handle call disconnect/hangup — clean up active sessions
        if call_class == "PhoneCallDiscarded":
            await self._handle_call_discarded(phone_call)
            return

        if call_class != "PhoneCallRequested":
            return

        # For incoming calls, admin_id is the caller who initiated the call
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

        # Resolve case-insensitive influencer ID
        try:
            async with _SessionLocal() as db:
                result = await db.execute(
                    select(Influencer).where(
                        func.lower(Influencer.id) == self.influencer_id.lower()
                    )
                )
                inf_record = result.scalar_one_or_none()
                log.info("telegram.incoming_call queried influencer=%s", inf_record)

                actual_id = inf_record.id if inf_record else self.influencer_id

                remaining = await check_telegram_trial_eligibility(db, caller_id)
        except Exception:
            log.exception("telegram.incoming_call failed during DB query")
            return

        if remaining <= 0:
            # Trial already used — silently ignore the call
            # (text auto-replies will handle conversion via 3-msg + CTA flow)
            log.info(
                "trial_gate_blocked tg_user=%s influencer=%s", caller_id, actual_id
            )
            return

        # Start voice call session
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
        """Clean up voice call session when the Telegram call is discarded.

        PhoneCallDiscarded often lacks admin_id, so we also search active
        sessions by influencer_id prefix to find and clean up the right one.
        """
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

        # Resolve actual influencer ID (case-insensitive)
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
            # Direct cleanup when we know the caller
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
            # No admin_id — search active calls for this influencer and end them
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
