"""
Telegram Message Handlers
=========================
Routes incoming Telegram DMs through the existing TeaseMe chat pipeline.
Reuses the same LLM, persona context, and memory infrastructure.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone

try:
    from pyrogram import Client, filters
    from pyrogram.enums import ChatAction
    from pyrogram.types import Message as TgMessage
except ImportError:
    Client = None  # type: ignore
    filters = None  # type: ignore
    ChatAction = None  # type: ignore
    TgMessage = None  # type: ignore

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import SessionLocal
from app.db.models import Influencer, Chat, Message

log = logging.getLogger(__name__)


class TelegramMessageHandler:
    """Routes incoming Telegram messages to the existing AI chat pipeline.

    This bridges the gap between Telegram DMs and the existing
    chat_buffer_service / chat.py infrastructure.

    Chat IDs follow the format: tg_{influencer_id}_{telegram_user_id}
    This keeps Telegram conversations isolated from WebSocket-based chats.
    """

    def __init__(
        self,
        client: Client,
        influencer_id: str,
    ):
        self.client = client
        self.influencer_id = influencer_id
        self._response_locks: dict[int, asyncio.Lock] = {}

    def _get_user_lock(self, telegram_user_id: int) -> asyncio.Lock:
        """Prevent concurrent AI responses to the same user."""
        if telegram_user_id not in self._response_locks:
            self._response_locks[telegram_user_id] = asyncio.Lock()
        return self._response_locks[telegram_user_id]

    @staticmethod
    def _make_chat_id(influencer_id: str, telegram_user_id: int) -> str:
        return f"tg_{influencer_id}_{telegram_user_id}"

    def register(self):
        """Register all message handlers on the Pyrogram client."""

        @self.client.on_message(filters.private & filters.text & ~filters.me & ~filters.user(777000))
        async def handle_text_dm(_client: Client, message: TgMessage):
            """Handle incoming private text messages.

            Excludes Telegram system messages (user_id 777000) which
            deliver login codes and service notifications.
            """
            await self._handle_text(message)

        @self.client.on_message(filters.private & filters.voice & ~filters.me & ~filters.user(777000))
        async def handle_voice_dm(_client: Client, message: TgMessage):
            """Handle incoming voice messages (Phase 2 — placeholder)."""
            await message.reply_text(
                "🎤 Voice messages are coming soon! "
                "For now, please send a text message."
            )

        @self.client.on_raw_update()
        async def handle_raw_update(_client: Client, update, users, chats):
            """Detect incoming private calls via raw Telegram updates."""
            update_class = type(update).__name__
            if "Phone" in update_class or "Call" in update_class or "phone" in str(update).lower():
                log.info("RAW UPDATE CAUGHT: %s -> %s", update_class, update)
            await self._handle_incoming_call(update)

        log.info(
            "Telegram handlers registered for influencer=%s (text + voice calls)",
            self.influencer_id,
        )

    async def _handle_text(self, message: TgMessage):
        """Process a text DM through the AI pipeline.

        Flow:
        1. Ensure a Chat record exists for this Telegram user
        2. Load influencer persona context
        3. Route through the LLM with conversation history
        4. Send response back via Telegram
        """
        telegram_user_id = message.from_user.id
        user_text = message.text.strip()

        if not user_text:
            return

        log.info(
            "telegram.dm influencer=%s from_user=%s text=%s",
            self.influencer_id,
            telegram_user_id,
            user_text[:80],
        )

        async with self._get_user_lock(telegram_user_id):
            try:
                # Show "typing" indicator while processing
                await self.client.send_chat_action(
                    chat_id=message.chat.id,
                    action=ChatAction.TYPING,
                )

                response = await self._generate_ai_response(
                    user_text=user_text,
                    telegram_user_id=telegram_user_id,
                    telegram_first_name=message.from_user.first_name,
                )

                # Split long responses (Telegram 4096 char limit)
                if len(response) <= 4096:
                    await message.reply_text(response)
                else:
                    chunks = [response[i:i + 4096] for i in range(0, len(response), 4096)]
                    for chunk in chunks:
                        await message.reply_text(chunk)
                        await asyncio.sleep(0.3)  # Human-like delay

            except Exception:
                log.exception(
                    "telegram.dm.error influencer=%s user=%s",
                    self.influencer_id,
                    telegram_user_id,
                )
                await message.reply_text(
                    "Sorry, I'm having trouble right now. Try again in a moment! 💕"
                )

    async def _generate_ai_response(
        self,
        user_text: str,
        telegram_user_id: int,
        telegram_first_name: str | None,
    ) -> str:
        """Generate an AI response using the existing persona infrastructure.

        Uses the influencer's prompt_template and bio_json for persona context,
        and stores conversation history in the standard Chat/Message tables
        using a `tg_` prefixed chat_id.
        """
        from openai import AsyncOpenAI
        from app.core.config import settings

        from sqlalchemy import select, func
        openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        async with SessionLocal() as db:
            # 1. Load influencer persona (case-insensitive)
            result = await db.execute(
                select(Influencer).where(func.lower(Influencer.id) == self.influencer_id.lower())
            )
            influencer = result.scalar_one_or_none()
            if not influencer:
                return "I'm not available right now. Please try again later."
            
            actual_influencer_id = influencer.id
            chat_id = self._make_chat_id(actual_influencer_id, telegram_user_id)

            # 2. Ensure Chat record exists (user_id=0 for Telegram users without
            #    a TeaseMe account — they interact anonymously via Telegram)
            existing_chat = await db.get(Chat, chat_id)
            if not existing_chat:
                new_chat = Chat(
                    id=chat_id,
                    user_id=0,  # Telegram-only user placeholder
                    influencer_id=actual_influencer_id,
                )
                db.add(new_chat)
                await db.flush()

            # 3. Get recent conversation history
            result = await db.execute(
                select(Message)
                .where(Message.chat_id == chat_id)
                .order_by(Message.created_at.desc())
                .limit(10)
            )
            history_rows = list(reversed(result.scalars().all()))

            # 4. Build system prompt from persona
            system_prompt = influencer.prompt_template or ""
            if not system_prompt and influencer.bio_json and isinstance(influencer.bio_json, dict):
                system_prompt = influencer.bio_json.get("personality_rules", "")

            if not system_prompt:
                display = influencer.display_name or self.influencer_id
                system_prompt = (
                    f"You are {display}, a friendly and engaging influencer "
                    "chatting on Telegram. Be warm, personal, and authentic."
                )

            # Add Telegram-specific context
            system_prompt += (
                "\n\n[Context: This conversation is happening on Telegram. "
                "Keep messages concise and conversational. Use emojis naturally.]"
            )

            # 5. Build messages array for LLM
            messages = [{"role": "system", "content": system_prompt}]

            for msg in history_rows:
                role = "assistant" if msg.sender == "ai" else "user"
                messages.append({"role": role, "content": msg.content})

            messages.append({"role": "user", "content": user_text})

            # 6. Generate response
            completion = await openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                max_tokens=500,
                temperature=0.8,
            )

            response_text = completion.choices[0].message.content or ""

            # 7. Persist both messages
            now = datetime.utcnow()

            db.add(Message(
                chat_id=chat_id,
                sender="user",
                channel="telegram",
                content=user_text,
                created_at=now,
            ))
            db.add(Message(
                chat_id=chat_id,
                sender="ai",
                channel="telegram",
                content=response_text,
                created_at=now,
            ))

            await db.commit()

        return response_text

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
        """Clean up voice call session when the Telegram call is discarded."""
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

        if not caller_id:
            log.warning("call_discarded: no admin_id, skipping cleanup")
            return

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

