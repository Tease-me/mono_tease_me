from __future__ import annotations

import asyncio
import json
import logging

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
        self.agent_id = agent_id
        self.voice_id = voice_id
        self.prompt = prompt
        self.greeting_used = greeting_used
        self.language = language
        self.chat_id = chat_id
        self.credits_remainder_secs = credits_remainder_secs
        self.max_duration_secs = max_duration_secs
        self._conversation_gateway = conversation_gateway or ElevenLabsConversationGateway()

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

    @property
    def conversation_id(self) -> str | None:
        return self._conversation_id

    async def start(self) -> None:
        if not HAS_WEBSOCKETS:
            raise RuntimeError("websockets dependency is required for browser voice calls")

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

        if self._convai_task and self._convai_task is not current and not self._convai_task.done():
            self._convai_task.cancel()

        await self._send_state("ended", reason=reason)

    async def handle_client_audio(self, audio_b64: str) -> None:
        if not self._is_active or not self._convai_ws:
            return

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
        except Exception:
            self._startup_event.set()
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
                    "silence_duration_ms": 200,
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
                await self._convai_ws.send(
                    json.dumps({"type": "pong", "event_id": event_id})
                )
            return

        if msg_type == "error":
            log.error(
                "adult_browser_voice.server_error influencer=%s body=%s",
                self.influencer_id,
                json.dumps(msg)[:300],
            )
            await self._send_error("UPSTREAM_ERROR", "Voice service error.")
            await self.stop(reason="upstream_error")

    async def _handle_conversation_metadata(self, msg: dict) -> None:
        meta = msg.get("conversation_initiation_metadata_event", {})
        self._conversation_id = meta.get("conversation_id")
        if not self._conversation_id:
            return

        if not self._conversation_registered:
            self._conversation_registered = True
            async with SessionLocal() as db:
                await save_pending_conversation(
                    db,
                    self._conversation_id,
                    self.user_id,
                    self.influencer_id,
                    sid=None,
                    is_adult_call=True,
                    adult_character_id=self.character_id,
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

    async def _handle_audio(self, msg: dict) -> None:
        audio_b64 = msg.get("audio_event", {}).get("audio_base_64")
        if not audio_b64:
            return

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

        self._flush_held_audio_task = asyncio.create_task(
            self._flush_held_audio_after_delay()
        )

    async def _send_audio_to_convai(self, audio_b64: str) -> None:
        if not self._convai_ws or not self._is_active:
            return
        await self._convai_ws.send(json.dumps({"user_audio_chunk": audio_b64}))

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
