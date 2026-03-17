"""
Voice Engine
=============
Manages live 1-on-1 Telegram voice calls via pytgcalls.

Handles the complete call lifecycle:
1. Accept incoming private call via pytgcalls ``play()`` + ``CallConfig``
2. Receive incoming audio via ``on_update(stream_frame)`` → buffer → transcribe
3. Generate AI response (LLM) → synthesize (ElevenLabs) → ``send_frame()``
4. Enforce 2-minute free trial timer
5. End call + send redirect link to teaseme.live
"""

from __future__ import annotations

import asyncio
import logging
import struct
import time
from typing import Optional

try:
    from pyrogram import Client
except ImportError:
    Client = None  # type: ignore

try:
    from pytgcalls import PyTgCalls, filters as ptg_filters
    from pytgcalls.types import (
        CallConfig,
        ChatUpdate,
        MediaStream,
        RecordStream,
        StreamFrames,
        Device,
        Direction,
        Frame,
        AudioQuality,
    )
    from pytgcalls.types.stream.external_media import ExternalMedia
    from pytgcalls.types.raw import AudioParameters as RawAudioParameters
    HAS_PYTGCALLS = True
except ImportError:
    HAS_PYTGCALLS = False

from app.core.config import settings
from app.db.session import SessionLocal
from app.db.models import Influencer, CallRecord
from app.telegram.audio_bridge import (
    pcm_to_wav,
    transcribe_audio,
    elevenlabs_tts_to_pcm,
    seconds_of_pcm,
    BYTES_PER_SECOND,
    SAMPLE_RATE,
    SAMPLE_WIDTH,
    CHANNELS,
)

log = logging.getLogger(__name__)

# Buffer ~1.5 seconds of audio before transcribing (lower = faster response)
BUFFER_DURATION_SECS = 1.5
BUFFER_SIZE_BYTES = int(BYTES_PER_SECOND * BUFFER_DURATION_SECS)

# Silence threshold: if RMS below this, skip transcription
SILENCE_RMS_THRESHOLD = 300

# Default free trial duration
DEFAULT_TRIAL_SECS = 120

# Redirect URL after trial
TEASEME_URL = "https://www.teaseme.live/"

def _is_speech(pcm_data: bytes) -> bool:
    """Check if the given PCM chunk exceeds the silence threshold (RMS energy)."""
    if len(pcm_data) < 4:
        return False
    num_samples = len(pcm_data) // 2
    total = 0
    for i in range(0, len(pcm_data) - 1, 2):
        sample = struct.unpack_from("<h", pcm_data, i)[0]
        total += sample * sample
    rms = (total / num_samples) ** 0.5
    return rms > SILENCE_RMS_THRESHOLD


class VoiceCallSession:
    """Manages a single live 1-on-1 voice call.

    Each instance handles one active call between a Telegram user
    and an influencer's AI persona.
    """

    def __init__(
        self,
        client: Client,
        ptg: PyTgCalls,
        influencer_id: str,
        telegram_user_id: int,
        chat_id: int,
        voice_id: str,
        system_prompt: str,
        max_duration_secs: int = DEFAULT_TRIAL_SECS,
    ):
        self.client = client
        self.ptg = ptg
        self.influencer_id = influencer_id
        self.telegram_user_id = telegram_user_id
        self.chat_id = chat_id
        self.voice_id = voice_id
        self.system_prompt = system_prompt
        self.max_duration_secs = max_duration_secs

        # Internal state
        self._audio_buffer = bytearray()
        self._playback_queue: asyncio.Queue[bytes] = asyncio.Queue()
        self._conversation_history: list[dict] = []
        self._is_active = False
        self._start_time: float = 0
        self._timer_task: Optional[asyncio.Task] = None
        self._playback_task: Optional[asyncio.Task] = None
        self._processing_lock = asyncio.Lock()
        self._call_record_id: Optional[str] = None
        self._play_task: Optional[asyncio.Task] = None

    @property
    def is_active(self) -> bool:
        return self._is_active

    @property
    def elapsed_seconds(self) -> float:
        if not self._start_time:
            return 0
        return time.monotonic() - self._start_time

    async def start(self):
        """Accept the call and start the audio pipeline + trial timer."""
        self._is_active = True
        self._start_time = time.monotonic()

        # Register the incoming audio handler FIRST so we catch frames
        # as soon as the WebRTC connection establishes
        self._register_stream_handler()

        # Create call record in DB
        await self._create_call_record()

        # Start playback loop and trial timer immediately
        self._playback_task = asyncio.create_task(self._playback_loop())
        self._timer_task = asyncio.create_task(self._trial_timer())

        # Accept the incoming private call using pytgcalls.
        # NOTE: ptg.play() triggers AcceptCall and WebRTC setup internally,
        # but its await hangs indefinitely for private calls in pytgcalls
        # v2.2.x. We fire it as a background task so it doesn't block
        # the audio pipeline (stream handler, playback, greeting).
        log.info(
            "voice_call.play_starting influencer=%s chat=%s ptg=%s",
            self.influencer_id,
            self.chat_id,
            type(self.ptg).__name__,
        )
        try:
            # Private calls are MONO — use 48kHz, 1 channel
            stream = MediaStream(
                ExternalMedia.AUDIO,
                audio_parameters=RawAudioParameters(
                    bitrate=SAMPLE_RATE,
                    channels=CHANNELS,  # 1 = mono for private calls
                ),
            )
            self._play_task = asyncio.create_task(
                self._accept_call(stream)
            )
        except Exception:
            log.exception(
                "voice_call.play_failed influencer=%s chat=%s",
                self.influencer_id,
                self.chat_id,
            )
            self._is_active = False
            return



        log.info(
            "voice_call.started influencer=%s user=%s chat=%s max_duration=%ds",
            self.influencer_id,
            self.telegram_user_id,
            self.chat_id,
            self.max_duration_secs,
        )

        # Send greeting after a short delay to let WebRTC establish
        asyncio.create_task(self._send_greeting_delayed())

    async def _accept_call(self, stream: MediaStream):
        """Background task: call ptg.play() to accept the private call.

        play() sends AcceptCall, performs DH key exchange, and establishes
        the WebRTC connection. For private calls it may never return its
        await, so this runs as a background task.
        """
        try:
            await self.ptg.play(
                self.chat_id,
                stream=stream,
                config=CallConfig(timeout=60),
            )
            log.info(
                "voice_call.play_completed influencer=%s chat=%s",
                self.influencer_id,
                self.chat_id,
            )

            # Now that the call is connected, enable incoming audio capture (mono)
            try:
                await self.ptg.record(
                    self.chat_id,
                    RecordStream(
                        audio=True,
                        audio_parameters=RawAudioParameters(
                            bitrate=SAMPLE_RATE,
                            channels=CHANNELS,  # 1 = mono for private calls
                        ),
                    ),
                )
                log.info(
                    "voice_call.record_started influencer=%s chat=%s",
                    self.influencer_id,
                    self.chat_id,
                )
            except Exception:
                log.warning(
                    "voice_call.record_failed influencer=%s chat=%s",
                    self.influencer_id,
                    self.chat_id,
                    exc_info=True,
                )
        except Exception:
            if self._is_active:
                log.exception(
                    "voice_call.play_error influencer=%s chat=%s",
                    self.influencer_id,
                    self.chat_id,
                )

    async def _send_greeting_delayed(self):
        """Wait for WebRTC to establish before sending the TTS greeting."""
        try:
            await asyncio.sleep(3)
            if self._is_active:
                await self._send_greeting()
        except asyncio.CancelledError:
            pass
        except Exception:
            log.exception("voice_call.greeting_delayed_error influencer=%s", self.influencer_id)

    def _register_stream_handler(self):
        """Register pytgcalls handlers for incoming audio and call-end events."""

        @self.ptg.on_update(ptg_filters.stream_frame(Direction.INCOMING, Device.MICROPHONE))
        async def _on_stream_frames(_, update: StreamFrames):
            # Only handle frames for our specific call
            if update.chat_id != self.chat_id:
                return
            if not self._is_active:
                return

            for frame in update.frames:
                data = frame.frame
                if data:
                    self._on_audio_frame(data)

        self._stream_handler = _on_stream_frames

        # Detect when the remote party hangs up at the WebRTC level
        @self.ptg.on_update(ptg_filters.chat_update(ChatUpdate.Status.LEFT_CALL))
        async def _on_call_ended(_, update: ChatUpdate):
            if update.chat_id != self.chat_id:
                return
            if not self._is_active:
                return

            log.info(
                "voice_call.call_ended_by_remote influencer=%s chat=%s status=%s",
                self.influencer_id,
                self.chat_id,
                update.status,
            )
            await self.stop(reason="remote_hangup")

            # Also remove from voice_call_manager
            from app.telegram.voice_engine import voice_call_manager
            key = voice_call_manager._call_key(self.influencer_id, self.telegram_user_id)
            voice_call_manager._active_calls.pop(key, None)

        self._call_ended_handler = _on_call_ended
        log.info(
            "voice_call.stream_handler_registered influencer=%s chat=%s",
            self.influencer_id,
            self.chat_id,
        )

    _frame_count: int = 0  # diagnostic counter for received audio frames

    def _on_audio_frame(self, data: bytes):
        """Receive raw PCM audio from the user and buffer it."""
        if not self._is_active or not data:
            return

        self._frame_count += 1
        if self._frame_count == 1:
            log.info(
                "voice_call.first_frame_received influencer=%s chat=%s bytes=%d",
                self.influencer_id,
                self.chat_id,
                len(data),
            )
        elif self._frame_count % 500 == 0:
            log.debug(
                "voice_call.frames_received influencer=%s count=%d buffer=%d",
                self.influencer_id,
                self._frame_count,
                len(self._audio_buffer),
            )

        self._audio_buffer.extend(data)

        if len(self._audio_buffer) >= BUFFER_SIZE_BYTES:
            chunk = bytes(self._audio_buffer[:BUFFER_SIZE_BYTES])
            self._audio_buffer = self._audio_buffer[BUFFER_SIZE_BYTES:]

            if not _is_speech(chunk):
                return

            log.debug(
                "voice_call.speech_detected influencer=%s chunk_bytes=%d",
                self.influencer_id,
                len(chunk),
            )
            asyncio.create_task(self._process_audio_chunk(chunk))

    async def _playback_loop(self):
        """Send synthesized audio frames to the user."""
        try:
            while self._is_active:
                try:
                    pcm_data = await asyncio.wait_for(
                        self._playback_queue.get(), timeout=0.5
                    )
                except asyncio.TimeoutError:
                    continue

                if not self._is_active:
                    break

                log.info(
                    "voice_call.playback_sending influencer=%s pcm_bytes=%d duration=%.1fs",
                    self.influencer_id,
                    len(pcm_data),
                    seconds_of_pcm(pcm_data),
                )

                # Send audio in ~20ms chunks (960 samples @ 48kHz mono, 16-bit)
                # 48000 Hz * 1 ch * 2 bytes * 0.02s = 1920 bytes per 20ms frame
                chunk_duration = 0.02
                chunk_size = int(SAMPLE_RATE * CHANNELS * SAMPLE_WIDTH * chunk_duration)

                offset = 0
                start_time = asyncio.get_running_loop().time()
                frames_sent = 0

                while offset < len(pcm_data) and self._is_active:
                    end = min(offset + chunk_size, len(pcm_data))
                    frame_bytes = pcm_data[offset:end]

                    # Pad last chunk if needed to meet exact frame size
                    if len(frame_bytes) < chunk_size:
                        frame_bytes += b"\x00" * (chunk_size - len(frame_bytes))

                    try:
                        await self.ptg.send_frame(
                            self.chat_id,
                            Device.MICROPHONE,
                            frame_bytes,
                            Frame.Info(),
                        )
                    except Exception as e:
                        if self._is_active:
                            log.warning(
                                "voice_call.send_frame_error influencer=%s err=%s",
                                self.influencer_id,
                                e,
                            )
                        break

                    offset = end
                    frames_sent += 1

                    # Precise timing to prevent jitter and static cuts
                    target_time = start_time + (frames_sent * chunk_duration)
                    now = asyncio.get_running_loop().time()
                    sleep_time = target_time - now
                    if sleep_time > 0:
                        await asyncio.sleep(sleep_time)
                    else:
                        await asyncio.sleep(0)  # Yield to event loop even if behind

        except asyncio.CancelledError:
            pass
        except Exception:
            if self._is_active:
                log.exception("voice_call.playback_loop_error")

    async def stop(self, reason: str = "ended"):
        """Stop the call session and clean up."""
        if not self._is_active:
            return

        self._is_active = False

        # Cancel tasks
        if self._timer_task and not self._timer_task.done():
            self._timer_task.cancel()
        if self._playback_task and not self._playback_task.done():
            self._playback_task.cancel()
        if self._play_task and not self._play_task.done():
            self._play_task.cancel()

        # Leave the call
        try:
            await self.ptg.leave_call(self.chat_id)
        except Exception as e:
            log.warning("voice_call.leave_error: %s", e)

        # Remove handlers
        try:
            if hasattr(self, "_stream_handler"):
                self.ptg.remove_handler(self._stream_handler)
        except Exception:
            pass
        try:
            if hasattr(self, "_call_ended_handler"):
                self.ptg.remove_handler(self._call_ended_handler)
        except Exception:
            pass

        duration = self.elapsed_seconds

        # Update call record
        await self._finalize_call_record(duration)

        log.info(
            "voice_call.stopped influencer=%s user=%s duration=%.1fs reason=%s",
            self.influencer_id,
            self.telegram_user_id,
            duration,
            reason,
        )

    async def _send_greeting(self):
        """Send an immediate TTS greeting so the caller hears the AI voice."""
        try:
            log.info(
                "voice_call.greeting_generating influencer=%s voice_id=%s",
                self.influencer_id,
                self.voice_id,
            )

            # Generate a short greeting via the LLM
            greeting_text = await self._generate_response(
                "[SYSTEM: The call just connected. Greet the caller warmly in 1-2 sentences. "
                "Be excited and flirty. Do NOT mention you are an AI.]"
            )
            if not greeting_text:
                greeting_text = "Hey! Oh my god, hi! I'm so happy you called me!"

            log.info(
                "voice_call.greeting_text influencer=%s text=%s",
                self.influencer_id,
                greeting_text[:100],
            )

            # Synthesize via ElevenLabs
            pcm_audio = await elevenlabs_tts_to_pcm(greeting_text, self.voice_id)
            if not pcm_audio:
                log.warning("voice_call.greeting_tts_failed influencer=%s", self.influencer_id)
                return

            duration = seconds_of_pcm(pcm_audio)
            log.info(
                "voice_call.greeting_queued influencer=%s duration=%.1fs pcm_bytes=%d",
                self.influencer_id,
                duration,
                len(pcm_audio),
            )

            # Queue for playback
            await self._playback_queue.put(pcm_audio)

        except Exception:
            log.exception(
                "voice_call.greeting_error influencer=%s",
                self.influencer_id,
            )

    async def _process_audio_chunk(self, pcm_chunk: bytes):
        """Process a buffered audio chunk through the full AI pipeline.

        Pipeline: PCM mono → WAV → Whisper STT → LLM → ElevenLabs TTS → PCM mono
        """
        async with self._processing_lock:
            if not self._is_active:
                return

            try:
                # 1. Convert mono PCM → WAV for Whisper (already mono from private call)
                wav_bytes = pcm_to_wav(pcm_chunk)
                log.info(
                    "voice_call.pipeline.stt_start influencer=%s wav_bytes=%d",
                    self.influencer_id,
                    len(wav_bytes),
                )

                # 2. Transcribe
                transcript = await transcribe_audio(wav_bytes)
                if not transcript or len(transcript.strip()) < 2:
                    log.debug("voice_call.pipeline.stt_empty influencer=%s", self.influencer_id)
                    return

                log.info(
                    "voice_call.stt influencer=%s user=%s text=%s",
                    self.influencer_id,
                    self.telegram_user_id,
                    transcript[:80],
                )

                # 3. Generate LLM response
                response_text = await self._generate_response(transcript)
                if not response_text:
                    log.warning("voice_call.pipeline.llm_empty influencer=%s", self.influencer_id)
                    return

                log.info(
                    "voice_call.llm influencer=%s response=%s",
                    self.influencer_id,
                    response_text[:80],
                )

                # 4. Synthesize speech
                pcm_audio = await elevenlabs_tts_to_pcm(response_text, self.voice_id)
                if not pcm_audio:
                    log.warning("voice_call.pipeline.tts_empty influencer=%s", self.influencer_id)
                    return

                duration = seconds_of_pcm(pcm_audio)
                log.info(
                    "voice_call.pipeline.tts_done influencer=%s duration=%.1fs",
                    self.influencer_id,
                    duration,
                )

                # 5. Queue for playback
                await self._playback_queue.put(pcm_audio)

            except Exception:
                log.exception(
                    "voice_call.pipeline_error influencer=%s user=%s",
                    self.influencer_id,
                    self.telegram_user_id,
                )

    async def _generate_response(self, user_text: str) -> str:
        """Generate a conversational response using the LLM."""
        from openai import AsyncOpenAI

        openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        # Maintain conversation history (keep last 8 turns)
        self._conversation_history.append({"role": "user", "content": user_text})
        if len(self._conversation_history) > 16:
            self._conversation_history = self._conversation_history[-16:]

        messages = [
            {
                "role": "system",
                "content": self.system_prompt + (
                    "\n\n[Context: You are on a LIVE VOICE CALL on Telegram. "
                    "Keep responses SHORT (1-3 sentences max). "
                    "Be natural, warm, and conversational. "
                    "Use filler words occasionally like 'hmm', 'oh', 'yeah'. "
                    "Do NOT use emojis or markdown — this is spoken audio.]"
                ),
            },
            *self._conversation_history,
        ]

        try:
            completion = await openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                max_tokens=150,
                temperature=0.85,
            )
            response = completion.choices[0].message.content or ""
            self._conversation_history.append({"role": "assistant", "content": response})
            return response
        except Exception:
            log.exception("voice_call.llm_error")
            return ""

    async def _trial_timer(self):
        """Enforce the free trial duration limit."""
        try:
            await asyncio.sleep(self.max_duration_secs)

            if not self._is_active:
                return

            log.info(
                "voice_call.trial_expired influencer=%s user=%s after=%ds",
                self.influencer_id,
                self.telegram_user_id,
                self.max_duration_secs,
            )

            # Stop the call
            await self.stop(reason="trial_expired")

            # Send redirect message
            try:
                await self.client.send_message(
                    chat_id=self.chat_id,
                    text=(
                        "✨ Your free call just ended! I had such a great time chatting with you 💕\n\n"
                        "Want to keep talking? Get more time here:\n"
                        f"👉 {TEASEME_URL}\n\n"
                        "See you there! 😘"
                    ),
                )
            except Exception:
                log.exception("Failed to send trial redirect message")

        except asyncio.CancelledError:
            pass  # Timer was cancelled (user hung up first)

    async def _create_call_record(self):
        """Create a CallRecord in the database."""
        import uuid

        self._call_record_id = f"tg_call_{uuid.uuid4().hex[:16]}"

        try:
            async with SessionLocal() as db:
                chat_id = f"tg_{self.influencer_id}_{self.telegram_user_id}"

                from app.db.models import Chat
                existing_chat = await db.get(Chat, chat_id)
                if not existing_chat:
                    new_chat = Chat(
                        id=chat_id,
                        user_id=0,
                        influencer_id=self.influencer_id,
                    )
                    db.add(new_chat)
                    await db.flush()

                record = CallRecord(
                    conversation_id=self._call_record_id,
                    user_id=0,
                    influencer_id=self.influencer_id,
                    chat_id=chat_id,
                    status="active",
                )
                db.add(record)
                await db.commit()
        except Exception:
            log.exception("Failed to create call record")

    async def _finalize_call_record(self, duration_secs: float):
        """Update the CallRecord with final duration and status."""
        if not self._call_record_id:
            return

        try:
            async with SessionLocal() as db:
                record = await db.get(CallRecord, self._call_record_id)
                if record:
                    record.status = "completed"
                    record.call_duration_secs = duration_secs
                    await db.commit()
        except Exception:
            log.exception("Failed to finalize call record")


class VoiceCallManager:
    """Manages active voice call sessions across all influencers.

    Uses PyTgCalls instances from session_manager (not its own).
    """

    def __init__(self):
        self._active_calls: dict[str, VoiceCallSession] = {}

    def _call_key(self, influencer_id: str, telegram_user_id: int) -> str:
        return f"{influencer_id}:{telegram_user_id}"

    def get_active_call(
        self, influencer_id: str, telegram_user_id: int
    ) -> Optional[VoiceCallSession]:
        key = self._call_key(influencer_id, telegram_user_id)
        session = self._active_calls.get(key)
        if session and session.is_active:
            return session
        return None

    async def start_call(
        self,
        client: Client,
        ptg: PyTgCalls,
        influencer_id: str,
        telegram_user_id: int,
        chat_id: int,
    ) -> Optional[VoiceCallSession]:
        """Start a new voice call session for a user.

        Loads the influencer's voice_id and persona from the database,
        checks billing eligibility, and creates a VoiceCallSession.
        """
        key = self._call_key(influencer_id, telegram_user_id)

        # Prevent duplicate calls — but clean up stale sessions
        if key in self._active_calls and self._active_calls[key].is_active:
            existing = self._active_calls[key]
            elapsed = existing.elapsed_seconds
            # If session is older than 45 seconds, consider it stale and clean up
            if elapsed > 45:
                log.warning(
                    "Cleaning up stale call session for %s (elapsed=%.0fs)",
                    key, elapsed,
                )
                try:
                    await existing.stop(reason="stale_cleanup")
                except Exception:
                    log.exception("Error cleaning up stale session %s", key)
                del self._active_calls[key]
            else:
                log.warning("Call already active for %s (elapsed=%.0fs)", key, elapsed)
                return self._active_calls[key]

        # Load influencer data
        async with SessionLocal() as db:
            influencer = await db.get(Influencer, influencer_id)
            if not influencer:
                log.error("Influencer %s not found for voice call", influencer_id)
                return None

            voice_id = influencer.voice_id
            if not voice_id:
                log.error("Influencer %s has no voice_id", influencer_id)
                return None

            # Check remaining free seconds
            from app.services.billing import get_remaining_units
            remaining = await get_remaining_units(
                db,
                user_id=0,
                influencer_id=influencer_id,
                feature="voice",
                is_18=False,
            )

            if remaining <= 0:
                log.info(
                    "No free trial remaining for user=%s influencer=%s",
                    telegram_user_id,
                    influencer_id,
                )
                return None  # Caller should send redirect message

            max_duration = min(remaining, DEFAULT_TRIAL_SECS)

            # Build system prompt
            system_prompt = influencer.prompt_template or ""
            if not system_prompt and influencer.bio_json and isinstance(influencer.bio_json, dict):
                system_prompt = influencer.bio_json.get("personality_rules", "")
            if not system_prompt:
                display = influencer.display_name or influencer_id
                system_prompt = (
                    f"You are {display}, a friendly and engaging influencer "
                    "on a voice call. Be warm, personal, and authentic."
                )

        session = VoiceCallSession(
            client=client,
            ptg=ptg,
            influencer_id=influencer_id,
            telegram_user_id=telegram_user_id,
            chat_id=chat_id,
            voice_id=voice_id,
            system_prompt=system_prompt,
            max_duration_secs=max_duration,
        )

        await session.start()
        self._active_calls[key] = session
        return session

    async def end_call(self, influencer_id: str, telegram_user_id: int):
        """End an active call."""
        key = self._call_key(influencer_id, telegram_user_id)
        session = self._active_calls.pop(key, None)
        if session and session.is_active:
            await session.stop(reason="user_hangup")

    async def end_all_calls(self):
        """End all active calls (used during shutdown)."""
        for key, session in list(self._active_calls.items()):
            if session.is_active:
                await session.stop(reason="server_shutdown")
        self._active_calls.clear()


# Singleton
voice_call_manager = VoiceCallManager()
