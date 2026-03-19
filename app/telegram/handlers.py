"""
Telegram Voice Call Handlers
=============================
Handles incoming 1-on-1 private voice calls via Telegram.
No text messaging — voice calls only.
"""

from __future__ import annotations

import logging

try:
    from pyrogram import Client
except ImportError:
    Client = None  # type: ignore

log = logging.getLogger(__name__)


class TelegramMessageHandler:
    """Handles incoming Telegram private voice calls.

    Only registers a raw update handler to detect and manage 1-on-1
    voice calls. Text messages are not processed.
    """

    def __init__(
        self,
        client: Client,
        influencer_id: str,
    ):
        self.client = client
        self.influencer_id = influencer_id

    def register(self):
        """Register voice call handler on the Pyrogram client."""

        @self.client.on_raw_update()
        async def handle_raw_update(_client: Client, update, users, chats):
            """Detect incoming private calls via raw Telegram updates."""
            update_class = type(update).__name__
            # Only log meaningful call state changes — skip SignalingData
            # which fires ~10x/sec during calls with encrypted binary payloads.
            if update_class == "UpdatePhoneCall":
                call_type = type(getattr(update, "phone_call", None)).__name__
                log.info("RAW UPDATE: %s (phone_call=%s)", update_class, call_type)
            await self._handle_incoming_call(update)

        log.info(
            "Telegram handlers registered for influencer=%s (voice calls only)",
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

        from app.telegram.voice_engine import voice_call_manager, TEASEME_URL
        from app.services.billing import get_remaining_units
        from app.db.session import SessionLocal as _SessionLocal

        from sqlalchemy import select, func
        from app.db.models import Influencer

        # Check billing eligibility
        try:
            async with _SessionLocal() as db:
                result = await db.execute(
                    select(Influencer).where(func.lower(Influencer.id) == self.influencer_id.lower())
                )
                inf_record = result.scalar_one_or_none()
                log.info("telegram.incoming_call queried influencer=%s", inf_record)
                
                actual_id = inf_record.id if inf_record else self.influencer_id

                remaining = await get_remaining_units(
                    db,
                    user_id=0,  # Telegram-only user
                    influencer_id=actual_id,
                    feature="voice",
                    is_18=False,
                )
        except Exception as e:
            log.exception("telegram.incoming_call failed during DB query")
            return

        if remaining <= 0:
            # No free trial left — send redirect
            try:
                await self.client.send_message(
                    chat_id=caller_id,
                    text=(
                        "💕 You've used your free call time!\n\n"
                        "Get more time with me here:\n"
                        f"👉 {TEASEME_URL}\n\n"
                        "Can't wait to hear from you again! 😘"
                    ),
                )
            except Exception:
                log.exception("Failed to send trial-expired redirect")
            return

        # Start voice call session
        from app.telegram.session_manager import session_manager
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
        from app.telegram.voice_engine import voice_call_manager

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
        from app.db.models import Influencer
        from app.db.session import SessionLocal as _SessionLocal

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

