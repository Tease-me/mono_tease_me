"""
Voice Engine
=============
Manages live 1-on-1 Telegram voice calls via pytgcalls.

Handles the complete call lifecycle:
1. Accept incoming private call
2. Capture user audio (PCM) → buffer → transcribe (Whisper)
3. Generate AI response (LLM) → synthesize (ElevenLabs) → play back
4. Enforce 2-minute free trial timer
5. End call + send redirect link to teaseme.live
"""

import asyncio
import logging
import time
from typing import Optional

from pyrogram import Client

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
    CHANNELS,
)

log = logging.getLogger(__name__)

# Buffer ~2.5 seconds of audio before transcribing
BUFFER_DURATION_SECS = 2.5
BUFFER_SIZE_BYTES = int(BYTES_PER_SECOND * BUFFER_DURATION_SECS)

# Silence threshold: if RMS below this, skip transcription
SILENCE_RMS_THRESHOLD = 300

# Default free trial duration
DEFAULT_TRIAL_SECS = 120

# Redirect URL after trial
TEASEME_URL = "https://www.teaseme.live/"


class VoiceCallSession:
    """Manages a single live 1-on-1 voice call.

    Each instance handles one active call between a Telegram user
    and an influencer's AI persona.
    """

    def __init__(
        self,
        client: Client,
        influencer_id: str,
        telegram_user_id: int,
        chat_id: int,
        voice_id: str,
        system_prompt: str,
        max_duration_secs: int = DEFAULT_TRIAL_SECS,
    ):
        self.client = client
        self.influencer_id = influencer_id
        self.telegram_user_id = telegram_user_id
        self.chat_id = chat_id
        self.voice_id = voice_id
        self.system_prompt = system_prompt
        self.max_duration_secs = max_duration_secs

        # Internal state
        self._audio_buffer = bytearray()
        self._playback_queue: asyncio.Queue[bytes] = asyncio.Queue()
        self._playback_offset = 0
        self._current_playback: bytes = b""
        self._conversation_history: list[dict] = []
        self._is_active = False
        self._start_time: float = 0
        self._timer_task: Optional[asyncio.Task] = None
        self._processing_lock = asyncio.Lock()
        self._call_record_id: Optional[str] = None

    @property
    def is_active(self) -> bool:
        return self._is_active

    @property
    def elapsed_seconds(self) -> float:
        if not self._start_time:
            return 0
        return time.monotonic() - self._start_time

    async def start(self):
        """Start the call session and timer."""
        self._is_active = True
        self._start_time = time.monotonic()

        # Create call record in DB
        await self._create_call_record()

        # Start the trial timer
        self._timer_task = asyncio.create_task(self._trial_timer())

        log.info(
            "voice_call.started influencer=%s user=%s max_duration=%ds",
            self.influencer_id,
            self.telegram_user_id,
            self.max_duration_secs,
        )

    async def stop(self, reason: str = "ended"):
        """Stop the call session and clean up."""
        if not self._is_active:
            return

        self._is_active = False

        # Cancel timer
        if self._timer_task and not self._timer_task.done():
            self._timer_task.cancel()

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

    def on_recorded_data(self, data: bytes):
        """Callback for pytgcalls: receives captured PCM audio from the user.

        Buffers audio and triggers transcription when enough data is collected.
        """
        if not self._is_active:
            return

        self._audio_buffer.extend(data)

        if len(self._audio_buffer) >= BUFFER_SIZE_BYTES:
            # Extract buffer and process asynchronously
            chunk = bytes(self._audio_buffer[:BUFFER_SIZE_BYTES])
            self._audio_buffer = self._audio_buffer[BUFFER_SIZE_BYTES:]

            # Skip near-silence
            if not _is_speech(chunk):
                return

            asyncio.create_task(self._process_audio_chunk(chunk))

    def on_played_data(self, length: int) -> bytes:
        """Callback for pytgcalls: provides PCM audio to play to the user.

        Returns the next chunk of synthesized audio, or silence if nothing
        is queued.
        """
        if not self._is_active:
            return b"\x00" * length

        # If we have remaining audio in current playback buffer
        if self._playback_offset < len(self._current_playback):
            end = self._playback_offset + length
            chunk = self._current_playback[self._playback_offset:end]
            self._playback_offset = end

            # Pad with silence if we're at the end
            if len(chunk) < length:
                chunk += b"\x00" * (length - len(chunk))
            return chunk

        # Try to get next queued audio
        try:
            self._current_playback = self._playback_queue.get_nowait()
            self._playback_offset = length
            chunk = self._current_playback[:length]
            if len(chunk) < length:
                chunk += b"\x00" * (length - len(chunk))
            return chunk
        except asyncio.QueueEmpty:
            # Return silence
            return b"\x00" * length

    async def _process_audio_chunk(self, pcm_chunk: bytes):
        """Process a buffered audio chunk through the full AI pipeline.

        Pipeline: PCM → WAV → Whisper STT → LLM → ElevenLabs TTS → PCM
        """
        async with self._processing_lock:
            if not self._is_active:
                return

            try:
                # 1. Convert PCM → WAV for Whisper
                wav_bytes = pcm_to_wav(pcm_chunk)

                # 2. Transcribe
                transcript = await transcribe_audio(wav_bytes)
                if not transcript or len(transcript.strip()) < 2:
                    return  # Skip empty/noise transcriptions

                log.debug(
                    "voice_call.stt influencer=%s user=%s text=%s",
                    self.influencer_id,
                    self.telegram_user_id,
                    transcript[:80],
                )

                # 3. Generate LLM response
                response_text = await self._generate_response(transcript)
                if not response_text:
                    return

                log.debug(
                    "voice_call.llm influencer=%s response=%s",
                    self.influencer_id,
                    response_text[:80],
                )

                # 4. Synthesize speech
                pcm_audio = await elevenlabs_tts_to_pcm(response_text, self.voice_id)
                if not pcm_audio:
                    return

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
                max_tokens=150,  # Short for voice
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
                record = CallRecord(
                    conversation_id=self._call_record_id,
                    user_id=0,  # Telegram-only user
                    influencer_id=self.influencer_id,
                    chat_id=f"tg_{self.influencer_id}_{self.telegram_user_id}",
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
    """Manages active voice call sessions across all influencers."""

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
        influencer_id: str,
        telegram_user_id: int,
        chat_id: int,
    ) -> Optional[VoiceCallSession]:
        """Start a new voice call session for a user.

        Loads the influencer's voice_id and persona from the database,
        checks billing eligibility, and creates a VoiceCallSession.
        """
        key = self._call_key(influencer_id, telegram_user_id)

        # Prevent duplicate calls
        if key in self._active_calls and self._active_calls[key].is_active:
            log.warning("Call already active for %s", key)
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
                user_id=0,  # Telegram user
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


def _is_speech(pcm_chunk: bytes) -> bool:
    """Basic voice activity detection using RMS energy.

    Returns True if the audio chunk likely contains speech.
    """
    if len(pcm_chunk) < 4:
        return False

    # Calculate RMS of 16-bit PCM samples
    import struct
    num_samples = len(pcm_chunk) // 2
    total = 0
    for i in range(0, len(pcm_chunk) - 1, 2):
        sample = struct.unpack_from("<h", pcm_chunk, i)[0]
        total += sample * sample

    rms = (total / num_samples) ** 0.5
    return rms > SILENCE_RMS_THRESHOLD
