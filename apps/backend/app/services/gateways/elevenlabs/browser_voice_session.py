from __future__ import annotations

import asyncio
import json
import logging
import time

from fastapi import WebSocket

try:
    import websockets

    HAS_WEBSOCKETS = True
except ImportError:
    HAS_WEBSOCKETS = False

from app.core.config import settings
from app.core.session import SessionLocal
from app.services.gateways.elevenlabs.conversation_gateway import (
    ElevenLabsConversationGateway,
)
from app.services.use_cases.elevenlabs_call_lifecycle import save_pending_conversation
from app.services.use_cases.elevenlabs_call_persistence import (
    poll_and_persist_conversation,
)
from app.services.use_cases.elevenlabs_credit_guard import (
    end_conversation_after_credits,
)

log = logging.getLogger(__name__)


class AdultBrowserVoiceSession:
    """Bridge a browser websocket to ElevenLabs ConvAI over a backend websocket."""

    def __init__(
        self,
        *,
        client_ws: WebSocket,
        user_id: int,
        influencer_id: str,
        character_id: int,
        character_slug: str,
        agent_id: str,
        voice_id: str | None,
        prompt: str,
        greeting_used: str | None,
        language: str,
        chat_id: str,
        credits_remainder_secs: int,
        max_duration_secs: int,
        conversation_gateway: ElevenLabsConversationGateway | None = None,
    ) -> None:
        self.client_ws = client_ws
        self.user_id = user_id
        self.influencer_id = influencer_id
        self.character_id = character_id
        self.character_slug = character_slug
        self.agent_id = agent_id
        self.voice_id = voice_id
        self.prompt = prompt
        self.greeting_used = greeting_used
        self.language = language
        self.chat_id = chat_id
        self.credits_remainder_secs = credits_remainder_secs
        self.max_duration_secs = max_duration_secs
        self._conversation_gateway = (
            conversation_gateway or ElevenLabsConversationGateway()
        )

        self._convai_ws = None
        self._convai_task: asyncio.Task | None = None
        self._remaining_task: asyncio.Task | None = None
        self._flush_held_audio_task: asyncio.Task | None = None
        self._startup_event = asyncio.Event()
        self._conversation_registered = False
        self._is_active = False
        self._ai_speaking = False
        self._held_audio_queue: list[str] = []
        self._conversation_id: str | None = None
        self._created_at = time.perf_counter()
        self._first_client_audio_logged = False
        self._first_forwarded_audio_logged = False
        self._metadata_logged = False
        self._first_convai_audio_logged = False
        self._first_frontend_audio_logged = False
        self._current_stage_index: int | None = None
        self._current_variant_index: int | None = None
        self._agent_transcript_buffer: list[str] = []
        self._user_transcript_buffer: list[str] = []
        self._scene_match_task: asyncio.Task | None = None

    @property
    def conversation_id(self) -> str | None:
        return self._conversation_id

    async def start(self) -> None:
        if not HAS_WEBSOCKETS:
            raise RuntimeError(
                "websockets dependency is required for browser voice calls"
            )

        self._is_active = True
        await self._send_state("connecting")

        self._convai_task = asyncio.create_task(self._run_convai())
        self._remaining_task = asyncio.create_task(self._remaining_time_loop())

        try:
            await asyncio.wait_for(self._startup_event.wait(), timeout=12.0)
        except asyncio.TimeoutError as exc:
            raise RuntimeError("Timed out connecting to ElevenLabs") from exc

        if self._convai_task.done():
            exc = self._convai_task.exception()
            if exc:
                raise RuntimeError("Failed to initialize ElevenLabs session") from exc

    async def stop(self, reason: str = "ended") -> None:
        if not self._is_active:
            return

        self._is_active = False
        current = asyncio.current_task()

        if self._flush_held_audio_task and self._flush_held_audio_task is not current:
            self._flush_held_audio_task.cancel()
        if self._remaining_task and self._remaining_task is not current:
            self._remaining_task.cancel()

        await self._send_state("ending")

        if self._convai_ws is not None:
            try:
                await self._convai_ws.close()
            except Exception:
                pass
            self._convai_ws = None

        if (
            self._convai_task
            and self._convai_task is not current
            and not self._convai_task.done()
        ):
            self._convai_task.cancel()

        if self._scene_match_task and self._scene_match_task is not current:
            self._scene_match_task.cancel()

        await self._send_state("ended", reason=reason)

    async def handle_client_audio(self, audio_b64: str) -> None:
        if not self._is_active or not self._convai_ws:
            return

        if not self._first_client_audio_logged:
            self._first_client_audio_logged = True
            log.info(
                "adult_browser_voice.first_client_audio influencer=%s user=%s elapsed_ms=%d",
                self.influencer_id,
                self.user_id,
                int((time.perf_counter() - self._created_at) * 1000),
            )

        if self._ai_speaking:
            self._held_audio_queue.append(audio_b64)
            return

        await self._send_audio_to_convai(audio_b64)

    async def _run_convai(self) -> None:
        try:
            signed_url = await self._conversation_gateway.get_conversation_signed_url(
                self.agent_id
            )
            separator = "&" if "?" in signed_url else "?"
            ws_url = f"{signed_url}{separator}output_format=pcm_16000"

            async with websockets.connect(
                ws_url,
                additional_headers={"Origin": settings.FRONTEND_URL},
                ping_interval=20,
                ping_timeout=10,
            ) as ws:
                self._convai_ws = ws
                await ws.send(json.dumps(self._build_init_payload()))
                self._startup_event.set()

                async for raw_msg in ws:
                    if not self._is_active:
                        break

                    try:
                        msg = json.loads(raw_msg)
                    except json.JSONDecodeError:
                        continue

                    await self._handle_convai_message(msg)
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            self._startup_event.set()
            if await self._handle_upstream_close(exc):
                return
            log.exception(
                "adult_browser_voice.convai_error influencer=%s user=%s",
                self.influencer_id,
                self.user_id,
            )
            await self._send_error("UPSTREAM_ERROR", "Voice service unavailable.")
            if self._is_active:
                await self.stop(reason="upstream_error")
        finally:
            self._convai_ws = None

    def _build_init_payload(self) -> dict[str, object]:
        payload: dict[str, object] = {
            "type": "conversation_initiation_client_data",
            "conversation_config_override": {
                "agent": {
                    "prompt": {
                        "prompt": self.prompt,
                    },
                    "first_message": self.greeting_used,
                    "language": self.language,
                },
                "turn_detection": {
                    "type": "server_vad",
                    "silence_duration_ms": 120,
                    "threshold": 0.6,
                },
            },
            "custom_llm_extra_body": {},
        }
        if self.voice_id:
            payload["conversation_config_override"]["tts"] = {  # type: ignore[index]
                "voice_id": self.voice_id
            }
        return payload

    async def _handle_convai_message(self, msg: dict) -> None:
        msg_type = msg.get("type", "")

        if msg_type == "conversation_initiation_metadata":
            await self._handle_conversation_metadata(msg)
            return

        if msg_type == "audio":
            await self._handle_audio(msg)
            return

        if msg_type == "ping":
            event_id = msg.get("ping_event", {}).get("event_id", 0)
            if self._convai_ws:
                try:
                    await self._convai_ws.send(
                        json.dumps({"type": "pong", "event_id": event_id})
                    )
                except Exception as exc:
                    if not await self._handle_upstream_close(exc):
                        raise
            return

        if msg_type == "error":
            log.error(
                "adult_browser_voice.server_error influencer=%s body=%s",
                self.influencer_id,
                json.dumps(msg)[:300],
            )
            await self._send_error("UPSTREAM_ERROR", "Voice service error.")
            await self.stop(reason="upstream_error")
            return

        if msg_type == "user_transcript":
            transcript = msg.get("user_transcription_event", {}).get("user_transcript", "")
            if transcript:
                await self._on_transcript(transcript, source="user")
            return

        if msg_type == "agent_response":
            response = msg.get("agent_response_event", {}).get("agent_response", "")
            if response:
                await self._on_transcript(response, source="agent")
            return

        if msg_type in {"tentative_user_transcript", "interruption"}:
            return

        log.debug(
            "adult_browser_voice.unhandled_convai_message influencer=%s type=%s",
            self.influencer_id,
            msg_type,
        )

    async def _on_transcript(self, text: str, *, source: str) -> None:
        cleaned = text.strip()
        if not cleaned:
            return
        buffer = (
            self._agent_transcript_buffer
            if source == "agent"
            else self._user_transcript_buffer
        )
        buffer.append(cleaned)
        if len(buffer) > 4:
            buffer.pop(0)
        if self._scene_match_task and not self._scene_match_task.done():
            self._scene_match_task.cancel()
        self._scene_match_task = asyncio.create_task(self._debounced_scene_match())

    async def _debounced_scene_match(self) -> None:
        try:
            await asyncio.sleep(0.45)
            agent_text = " ".join(self._agent_transcript_buffer).strip()
            user_text = " ".join(self._user_transcript_buffer).strip()
            transcript = " ".join(part for part in (agent_text, user_text) if part).strip()
            if not transcript or not self._is_active:
                return

            from app.services.use_cases.adult.scene_matcher import match_scene_from_transcript

            async with SessionLocal() as db:
                payload = await match_scene_from_transcript(
                    db,
                    influencer_id=self.influencer_id,
                    character_id=self.character_id,
                    character_slug=self.character_slug,
                    transcript=transcript,
                    agent_text=agent_text,
                    user_text=user_text,
                    current_stage_index=self._current_stage_index,
                    current_variant_index=self._current_variant_index,
                )
            if payload:
                await self._send_scene_update(payload)
        except asyncio.CancelledError:
            pass
        except Exception:
            log.exception(
                "adult_browser_voice.scene_match_failed influencer=%s character=%s",
                self.influencer_id,
                self.character_id,
            )

    async def _send_initial_scene(self) -> None:
        try:
            from app.services.use_cases.adult.scene_matcher import get_initial_scene_update

            async with SessionLocal() as db:
                payload = await get_initial_scene_update(
                    db,
                    influencer_id=self.influencer_id,
                    character_id=self.character_id,
                    character_slug=self.character_slug,
                )
            if payload:
                await self._send_scene_update(payload)
            else:
                log.warning(
                    "adult_browser_voice.no_gallery_videos influencer=%s character=%s",
                    self.influencer_id,
                    self.character_id,
                )
        except Exception:
            log.exception(
                "adult_browser_voice.initial_scene_failed influencer=%s character=%s",
                self.influencer_id,
                self.character_id,
            )

    async def _send_scene_update(self, payload: dict) -> None:
        self._current_stage_index = payload.get("stage_index")
        self._current_variant_index = payload.get("variant_index")
        try:
            await self.client_ws.send_json(payload)
            log.info(
                "adult_browser_voice.scene_update influencer=%s character=%s stage=%s variant=%s method=%s",
                self.influencer_id,
                self.character_id,
                self._current_stage_index,
                self._current_variant_index,
                payload.get("match_method"),
            )
            asyncio.create_task(self._record_scene_unlock(payload))
        except Exception:
            log.exception(
                "adult_browser_voice.scene_update_send_failed influencer=%s character=%s",
                self.influencer_id,
                self.character_id,
            )

    async def _record_scene_unlock(self, payload: dict) -> None:
        stage_index = payload.get("stage_index")
        variant_index = payload.get("variant_index")
        if stage_index is None or variant_index is None:
            return
        try:
            from app.services.repositories.user_gallery_repository import unlock_stage_video

            async with SessionLocal() as db:
                await unlock_stage_video(
                    db,
                    user_id=self.user_id,
                    influencer_id=self.influencer_id,
                    character_id=self.character_id,
                    stage_index=int(stage_index),
                    variant_index=int(variant_index),
                    conversation_id=self._conversation_id,
                )
        except Exception:
            log.exception(
                "adult_browser_voice.scene_unlock_failed influencer=%s character=%s",
                self.influencer_id,
                self.character_id,
            )

    async def _handle_conversation_metadata(self, msg: dict) -> None:
        meta = msg.get("conversation_initiation_metadata_event", {})
        self._conversation_id = meta.get("conversation_id")
        if not self._conversation_id:
            return

        if not self._metadata_logged:
            self._metadata_logged = True
            log.info(
                "adult_browser_voice.metadata_received influencer=%s user=%s conv=%s elapsed_ms=%d",
                self.influencer_id,
                self.user_id,
                self._conversation_id,
                int((time.perf_counter() - self._created_at) * 1000),
            )

        if not self._conversation_registered:
            self._conversation_registered = True
            asyncio.create_task(
                self._register_pending_conversation(self._conversation_id)
            )
            asyncio.create_task(
                poll_and_persist_conversation(
                    self._conversation_id,
                    user_id=self.user_id,
                    influencer_id=self.influencer_id,
                    chat_id=self.chat_id,
                )
            )
            asyncio.create_task(
                end_conversation_after_credits(
                    self._conversation_id,
                    self.user_id,
                    self.influencer_id,
                )
            )

        await self.client_ws.send_json(
            {
                "type": "call_started",
                "chat_id": self.chat_id,
                "conversation_id": self._conversation_id,
                "credits_remainder_secs": self.credits_remainder_secs,
            }
        )
        await self._send_state("listening")
        asyncio.create_task(self._send_initial_scene())

    async def _handle_audio(self, msg: dict) -> None:
        audio_b64 = msg.get("audio_event", {}).get("audio_base_64")
        if not audio_b64:
            return

        if not self._first_convai_audio_logged:
            self._first_convai_audio_logged = True
            log.info(
                "adult_browser_voice.first_convai_audio influencer=%s user=%s conv=%s elapsed_ms=%d",
                self.influencer_id,
                self.user_id,
                self._conversation_id,
                int((time.perf_counter() - self._created_at) * 1000),
            )

        self._ai_speaking = True
        if self._flush_held_audio_task:
            self._flush_held_audio_task.cancel()

        await self._send_state("agent_speaking")
        await self.client_ws.send_json(
            {
                "type": "output_audio_chunk",
                "audio": audio_b64,
            }
        )
        if not self._first_frontend_audio_logged:
            self._first_frontend_audio_logged = True
            log.info(
                "adult_browser_voice.first_frontend_audio influencer=%s user=%s conv=%s elapsed_ms=%d",
                self.influencer_id,
                self.user_id,
                self._conversation_id,
                int((time.perf_counter() - self._created_at) * 1000),
            )

        self._flush_held_audio_task = asyncio.create_task(
            self._flush_held_audio_after_delay()
        )

    async def _send_audio_to_convai(self, audio_b64: str) -> None:
        if not self._convai_ws or not self._is_active:
            return
        if not self._first_forwarded_audio_logged:
            self._first_forwarded_audio_logged = True
            log.info(
                "adult_browser_voice.first_audio_forwarded influencer=%s user=%s conv=%s elapsed_ms=%d",
                self.influencer_id,
                self.user_id,
                self._conversation_id,
                int((time.perf_counter() - self._created_at) * 1000),
            )
        try:
            await self._convai_ws.send(json.dumps({"user_audio_chunk": audio_b64}))
        except Exception as exc:
            if not await self._handle_upstream_close(exc):
                raise

    async def _register_pending_conversation(self, conversation_id: str) -> None:
        try:
            async with SessionLocal() as db:
                await save_pending_conversation(
                    db,
                    conversation_id,
                    self.user_id,
                    self.influencer_id,
                    sid=None,
                    is_adult_call=True,
                    adult_character_id=self.character_id,
                )
        except Exception:
            log.exception(
                "adult_browser_voice.pending_registration_failed influencer=%s user=%s conv=%s",
                self.influencer_id,
                self.user_id,
                conversation_id,
            )

    async def _flush_held_audio_after_delay(self) -> None:
        try:
            await asyncio.sleep(0.35)
            self._ai_speaking = False
            held = self._held_audio_queue
            self._held_audio_queue = []
            for chunk in held:
                await self._send_audio_to_convai(chunk)
            if self._is_active:
                await self._send_state("listening")
        except asyncio.CancelledError:
            pass

    async def _remaining_time_loop(self) -> None:
        remaining = int(self.max_duration_secs)
        if remaining <= 0:
            remaining = 1
        try:
            while self._is_active and remaining >= 0:
                await self.client_ws.send_json(
                    {"type": "remaining_time", "seconds": remaining}
                )
                sleep_for = 1 if remaining <= 10 else 5
                await asyncio.sleep(sleep_for)
                remaining -= sleep_for
            if self._is_active:
                await self.stop(reason="credit_timeout")
        except asyncio.CancelledError:
            pass
        except Exception:
            log.exception(
                "adult_browser_voice.remaining_time_error influencer=%s user=%s",
                self.influencer_id,
                self.user_id,
            )

    async def _send_state(self, state: str, *, reason: str | None = None) -> None:
        payload: dict[str, object] = {"type": "state", "state": state}
        if reason:
            payload["reason"] = reason
        try:
            await self.client_ws.send_json(payload)
        except Exception:
            pass

    async def _send_error(self, code: str, message: str) -> None:
        try:
            await self.client_ws.send_json(
                {
                    "type": "error",
                    "error": code,
                    "message": message,
                }
            )
        except Exception:
            pass

    async def _handle_upstream_close(self, exc: Exception) -> bool:
        if not self._is_upstream_close_exception(exc):
            return False

        self._convai_ws = None
        if not self._is_active:
            return True

        close_code = self._extract_close_code(exc)
        if close_code in (None, 1000):
            await self.stop(reason="upstream_closed")
            return True

        await self._send_error("UPSTREAM_ERROR", "Voice service unavailable.")
        await self.stop(reason="upstream_error")
        return True

    @staticmethod
    def _is_upstream_close_exception(exc: Exception) -> bool:
        name = exc.__class__.__name__
        return name in {"ConnectionClosed", "ConnectionClosedOK", "ConnectionClosedError"}

    @staticmethod
    def _extract_close_code(exc: Exception) -> int | None:
        direct_code = getattr(exc, "code", None)
        if isinstance(direct_code, int):
            return direct_code

        for attr in ("rcvd", "sent"):
            close_frame = getattr(exc, attr, None)
            code = getattr(close_frame, "code", None)
            if isinstance(code, int):
                return code
        return None
