"""
Telegram Handlers
==================
Handles incoming 1-on-1 private voice calls and text messages via Telegram.
"""

from __future__ import annotations

import asyncio
import logging
import re

try:
    from pyrogram import Client, filters
except ImportError:
    Client = None  # type: ignore
    filters = None  # type: ignore

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

    # Auto-reply messages for text conversations (generic, no influencer name)
    TEXT_REPLIES = [
        "Hey babe! 💋 So sweet of you to message me. I'd love to hear your voice though… Why don't you give me a call! 📞",
        "I'm way better on calls, trust me 😘 Hit that call button and let's have some fun together!",
        "Come on, don't be shy! 💕 Just call me right now, I promise you won't regret it 😏",
    ]

    # Max text replies before sending CTA link and going silent
    MAX_TEXT_REPLIES = 3

    def register(self):
        """Register voice call and text message handlers on the Pyrogram client."""

        @self.client.on_raw_update()
        async def handle_raw_update(_client: Client, update, users, chats):
            """Detect incoming private calls via raw Telegram updates."""
            update_class = type(update).__name__
            if update_class == "UpdatePhoneCall":
                call_type = type(getattr(update, "phone_call", None)).__name__
                log.info("RAW UPDATE: %s (phone_call=%s)", update_class, call_type)
            await self._handle_incoming_call(update)

        @self.client.on_message(filters.private & ~filters.service)
        async def handle_text_message(_client: Client, message):
            """Auto-reply to private messages up to MAX_TEXT_REPLIES, then send CTA."""
            await self._handle_text_message(message)

        log.info(
            "Telegram handlers registered for influencer=%s (voice calls + text)",
            self.influencer_id,
        )

    async def _handle_text_message(self, message):
        """Reply to private text messages up to MAX_TEXT_REPLIES, then send CTA link.

        Tracks reply count per (influencer, telegram_user) in Redis.
        After all replies are sent, sends the influencer CTA link once and goes silent.
        """
        from app.utils.infrastructure.redis_pool import get_redis
        from pyrogram import enums

        user_id = message.from_user.id if message.from_user else None
        if not user_id:
            return

        redis = await get_redis()
        key = f"tg:text_replies:{self.influencer_id}:{user_id}"

        raw = await redis.get(key)
        count = int(raw) if raw else 0
        preview = re.sub(r"\s+", " ", (getattr(message, "text", None) or "").strip())
        if len(preview) > 100:
            preview = preview[:97] + "..."

        log.info(
            "telegram.incoming_text influencer=%s tg_user=%s message_id=%s reply_count=%s preview=%r",
            self.influencer_id,
            user_id,
            getattr(message, "id", None),
            count,
            preview,
        )

        if count > self.MAX_TEXT_REPLIES:
            # Already sent all replies + CTA — stay silent
            log.info(
                "telegram.text_reply_suppressed influencer=%s tg_user=%s reply_count=%s",
                self.influencer_id,
                user_id,
                count,
            )
            return

        if count < self.MAX_TEXT_REPLIES:
            reply_index = count
            await message.reply_text(
                self.TEXT_REPLIES[count],
                parse_mode=enums.ParseMode.HTML,
            )
            count += 1
            await redis.set(key, count)
            log.info(
                "telegram.text_reply_sent influencer=%s tg_user=%s reply_index=%s",
                self.influencer_id,
                user_id,
                reply_index,
            )

        if count == self.MAX_TEXT_REPLIES:
            # Send CTA link after the last text reply
            await self._send_text_cta(message, user_id)
            await redis.set(key, count + 1)

    async def _send_text_cta(self, message, telegram_user_id: int):
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
                    db, telegram_user_id, actual_id,
                )
                asyncio.create_task(
                    track_invite_sent(telegram_user_id, actual_id, invite_code)
                )

                cta_html = build_telegram_cta_html(invite_code, actual_id)
                await message.reply_text(
                    f"Want more of me? 💋\n\n{cta_html}",
                    parse_mode=enums.ParseMode.HTML,
                )

                log.info(
                    "text_cta_sent tg_user=%s influencer=%s",
                    telegram_user_id, actual_id,
                )
        except Exception:
            log.exception(
                "Failed to send text CTA tg_user=%s influencer=%s",
                telegram_user_id, self.influencer_id,
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
            
        if hasattr(update, "update") and type(update).__name__.startswith("UpdateShort"):
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

        from app.services.gateways.telegram.voice_engine import voice_call_manager
        from app.services.telegram_call_service import (
            check_telegram_trial_eligibility,
            send_trial_expired_messages,
        )
        from app.core.session import SessionLocal as _SessionLocal

        from sqlalchemy import select, func
        from app.data.models import Influencer

        # Resolve case-insensitive influencer ID
        try:
            async with _SessionLocal() as db:
                result = await db.execute(
                    select(Influencer).where(func.lower(Influencer.id) == self.influencer_id.lower())
                )
                inf_record = result.scalar_one_or_none()
                log.info("telegram.incoming_call queried influencer=%s", inf_record)
                
                actual_id = inf_record.id if inf_record else self.influencer_id

                remaining = await check_telegram_trial_eligibility(db, caller_id)
        except Exception:
            log.exception("telegram.incoming_call failed during DB query")
            return

        if remaining <= 0:
            # No free trial left — send promo media + redirect with unique invite link
            from app.services.funnel_tracking_service import track_trial_exhausted
            asyncio.create_task(track_trial_exhausted(caller_id, actual_id))
            try:
                async with _SessionLocal() as db2:
                    await send_trial_expired_messages(
                        self.client, db2, caller_id, caller_id, actual_id,
                    )
            except Exception:
                log.exception("Failed to send trial-expired redirect")
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
            asyncio.create_task(track_call_started(caller_id, actual_id, session_id=session_id))

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
        from sqlalchemy import select, func
        from app.data.models import Influencer
        from app.core.session import SessionLocal as _SessionLocal

        try:
            async with _SessionLocal() as db:
                result = await db.execute(
                    select(Influencer).where(func.lower(Influencer.id) == self.influencer_id.lower())
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
                    actual_id, caller_id,
                )
            except Exception:
                log.exception(
                    "telegram.call_discarded.cleanup_error influencer=%s caller=%s",
                    actual_id, caller_id,
                )
        else:
            # No admin_id — search active calls for this influencer and end them
            prefix = f"{actual_id}:"
            stale_keys = [
                k for k in list(voice_call_manager._active_calls.keys())
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
