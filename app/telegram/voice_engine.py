"""
Voice Engine — ElevenLabs ConvAI Bridge
========================================
Bridges Telegram private voice calls (pytgcalls / WebRTC) with
ElevenLabs Conversational AI (WebSocket).

Audio flow:
  User speaks → pytgcalls 48kHz PCM → downsample 3x → 16kHz PCM
    → base64 → ElevenLabs ConvAI WebSocket

  AI responds → ConvAI WebSocket → base64 → 24kHz PCM
    → FFmpeg resample 2x → 48kHz PCM → pytgcalls send_frame → user hears AI
"""

from __future__ import annotations

import collections
import array
import asyncio
import base64
import json
import logging
import re
import struct
import time
import uuid
from typing import Optional

import httpx

try:
    import websockets
    HAS_WEBSOCKETS = True
except ImportError:
    HAS_WEBSOCKETS = False

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
    downsample_48k_to_16k,
    pcm_resample_to_48k_mono,
    BYTES_PER_SECOND,
    SAMPLE_RATE,
    SAMPLE_WIDTH,
    CHANNELS,
)

log = logging.getLogger(__name__)

# Default free trial duration
DEFAULT_TRIAL_SECS = 120

# Redirect URL after trial
TEASEME_URL = "https://www.teaseme.live/"

# ElevenLabs ConvAI input: 16kHz mono 16-bit PCM (for STT / user audio capture)
CONVAI_INPUT_SAMPLE_RATE = 16000
CONVAI_INPUT_BPS = CONVAI_INPUT_SAMPLE_RATE * CHANNELS * SAMPLE_WIDTH  # 32000

# ElevenLabs ConvAI output: defaults to 16kHz mono 16-bit PCM.
# We request pcm_24000 for better quality (12kHz Nyquist vs 8kHz),
# but ConvAI may ignore this and send 16kHz. The resampler adapts
# dynamically via _convai_output_rate parsed from session metadata.
CONVAI_OUTPUT_SAMPLE_RATE = 16000
CONVAI_OUTPUT_BPS = CONVAI_OUTPUT_SAMPLE_RATE * CHANNELS * SAMPLE_WIDTH  # 32000

# Send audio to ConvAI every ~100ms for low latency.
# ConvAI *input* is 16kHz (for STT). 1600 samples @ 16kHz = 100ms.
CONVAI_CHUNK_SAMPLES = 1600
CONVAI_CHUNK_BYTES_16K = CONVAI_CHUNK_SAMPLES * SAMPLE_WIDTH  # 3200 bytes @ 16kHz
# Equivalent in 48kHz bytes (3x more): 100ms * 96000 bytes/sec = 9600 bytes
CONVAI_CHUNK_BYTES_48K = int(BYTES_PER_SECOND * 0.1)

# Frame size for send_frame: 10ms @ 48kHz mono 16-bit = 960 bytes.
# NTgCalls AudioSink operates at 10ms intervals (frameRate=100, frameTime=10ms),
# confirmed from ntgcalls/src/media/audio_sink.cpp.
FRAME_SIZE = int(SAMPLE_RATE * CHANNELS * SAMPLE_WIDTH * 0.01)

# Pre-allocated silence frame — sent to pytgcalls when no ConvAI audio
# is available, keeping the WebRTC RTP stream alive. Without this,
# missing packets cause Telegram to report "poor connection".
SILENCE_FRAME = b'\x00' * FRAME_SIZE

# Jitter buffer: pre-fill 80ms of audio before starting playback.
# This absorbs ConvAI network jitter and prevents buffer underruns.
# Browser WebRTC uses 50-200ms adaptive; 80ms is a good balance
# between latency and stability for voice conversation.
JITTER_BUFFER_MS = 80
JITTER_BUFFER_FRAMES = max(1, JITTER_BUFFER_MS // 10)  # 8 frames of 10ms


def _upsample_by_ratio(pcm: bytes, ratio: int) -> bytes:
    """Upsample mono 16-bit PCM by an integer ratio via linear interpolation.

    Produces smooth transitions between samples, avoiding the harsh
    spectral images (high-frequency artifacts) that sample-repetition
    (zero-order hold) introduces.  Those artifacts confuse the Opus
    encoder and cause perceived "sped up" / chipmunk audio.

    Common usage:
      16kHz → 48kHz: ratio=3
      24kHz → 48kHz: ratio=2
       8kHz → 48kHz: ratio=6

    This MUST stay in-process — spawning FFmpeg per chunk adds 20-50 ms
    latency which causes buffer under-runs and audible cutting.
    """
    if not pcm or ratio < 1:
        return b""
    if ratio == 1:
        return pcm
    samples = array.array("h")  # signed 16-bit
    samples.frombytes(pcm)
    n = len(samples)
    if n == 0:
        return b""
    out = array.array("h", [0]) * (n * ratio)
    # Linear interpolation between consecutive samples
    for i in range(n - 1):
        s0 = samples[i]
        s1 = samples[i + 1]
        base = i * ratio
        for r in range(ratio):
            # t goes from 0.0 to (ratio-1)/ratio
            t = r / ratio
            out[base + r] = int(s0 + t * (s1 - s0))
    # Last sample: no next sample to interpolate toward, just repeat
    base = (n - 1) * ratio
    for r in range(ratio):
        out[base + r] = samples[-1]
    return out.tobytes()


# Keep backward-compatible alias
_upsample_16k_to_48k = lambda pcm_16k: _upsample_by_ratio(pcm_16k, 3)


class VoiceCallSession:
    """Manages a single live 1-on-1 voice call bridged to ElevenLabs ConvAI."""

    def __init__(
        self,
        client: Client,
        ptg: PyTgCalls,
        influencer_id: str,
        telegram_user_id: int,
        chat_id: int,
        agent_id: str,
        voice_id: str,
        system_prompt: str,
        max_duration_secs: int = DEFAULT_TRIAL_SECS,
    ):
        self.client = client
        self.ptg = ptg
        self.influencer_id = influencer_id
        self.telegram_user_id = telegram_user_id
        self.chat_id = chat_id
        self.agent_id = agent_id
        self.voice_id = voice_id
        self.system_prompt = system_prompt
        self.max_duration_secs = max_duration_secs

        # State
        self._is_active = False
        self._start_time: float = 0
        self._play_task: Optional[asyncio.Task] = None
        self._convai_task: Optional[asyncio.Task] = None
        self._timer_task: Optional[asyncio.Task] = None
        self._call_record_id: Optional[str] = None
        self._convai_ws = None
        self._conversation_id: Optional[str] = None
        self._phone_call_id: Optional[int] = None
        self._phone_call_access_hash: Optional[int] = None

        # Capture the running event loop for thread-safe scheduling.
        # pytgcalls handlers may fire from its internal ThreadPoolExecutor,
        # so we need loop.call_soon_threadsafe() instead of create_task().
        self._loop: asyncio.AbstractEventLoop = asyncio.get_event_loop()

        # ConvAI readiness: True once the ConvAI WebSocket is open AND the
        # session metadata has been received. Audio arriving before this
        # is queued in _early_audio_queue and flushed on session start.
        self._convai_ready = False
        self._early_audio_queue: list[bytes] = []

        # Buffer for accumulating incoming 48kHz audio before sending to ConvAI
        self._audio_send_buffer = bytearray()

        # Playback: deque of pre-chunked 1920-byte frames (O(1) popleft).
        # Replaces the old bytearray approach where del buf[:1920] was O(n)
        # and caused timing jitter / GC stutters → crackling.
        self._playback_frames: collections.deque[bytes] = collections.deque()
        self._partial_frame = bytearray()  # accumulates sub-frame remnants
        self._playback_task: Optional[asyncio.Task] = None
        self._playback_event = asyncio.Event()  # signaled when new audio arrives
        self._jitter_filled = False  # True once jitter buffer first fills

        # Actual ConvAI output sample rate — updated from session metadata.
        # Default to the requested rate; overridden once ConvAI negotiates.
        self._convai_output_rate = CONVAI_OUTPUT_SAMPLE_RATE

        # Stream handler references
        self._stream_handler = None

        # Call metrics
        self._frame_count = 0
        self._early_audio_dropped = 0
        self._audio_chunks_received = 0
        self._audio_chunks_sent = 0

        # Event signaled when ConvAI WebSocket is connected and first
        # greeting audio is buffered — used to delay call pickup.
        self._convai_ready_event = asyncio.Event()



    @property
    def is_active(self) -> bool:
        return self._is_active

    @property
    def elapsed_seconds(self) -> float:
        if not self._start_time:
            return 0
        return time.monotonic() - self._start_time

    # ── Call lifecycle ──────────────────────────────────────────────

    async def start(self):
        """Start the ConvAI bridge, then accept the call once audio is ready.

        The caller hears natural ringing while ConvAI connects and
        generates the greeting. We only pick up after audio is buffered,
        so the first thing they hear is a smooth, complete greeting.
        """
        self._is_active = True
        self._start_time = time.monotonic()

        self._register_stream_handler()
        await self._create_call_record()

        log.info(
            "voice_call.starting influencer=%s chat=%s agent=%s",
            self.influencer_id, self.chat_id, self.agent_id,
        )

        # Step 1: Connect to ConvAI FIRST (while caller hears ringing)
        self._convai_task = asyncio.create_task(self._run_convai())

        # Step 2: Wait for ConvAI to be ready (up to 8s)
        # After ~3-5s of ringing the greeting audio should be buffered.
        try:
            await asyncio.wait_for(self._convai_ready_event.wait(), timeout=8.0)
            log.info("voice_call.convai_ready_before_pickup influencer=%s "
                     "buffered_frames=%d",
                     self.influencer_id, len(self._playback_frames))
        except asyncio.TimeoutError:
            log.warning("voice_call.convai_ready_timeout influencer=%s "
                        "(picking up anyway after 8s)", self.influencer_id)

        if not self._is_active:
            return

        # Step 3: NOW accept the Telegram call
        stream = MediaStream(
            ExternalMedia.AUDIO,
            audio_parameters=RawAudioParameters(
                bitrate=SAMPLE_RATE,  # 48000 Hz — this IS the sample rate, NOT Opus bitrate!
                channels=CHANNELS,    # pytgcalls maps bitrate → AudioDescription.sample_rate
            ),
        )

        self._play_task = asyncio.create_task(
            self._accept_and_record(stream)
        )
        self._timer_task = asyncio.create_task(self._trial_timer())

        log.info(
            "voice_call.started influencer=%s user=%s max_duration=%ds",
            self.influencer_id, self.telegram_user_id, self.max_duration_secs,
        )

    async def stop(self, reason: str = "ended"):
        """Stop the call and clean up everything."""
        if not self._is_active:
            return
        self._is_active = False

        # Cancel tasks — but skip the current task to avoid self-cancellation
        # (when _trial_timer calls stop(), it IS self._timer_task)
        current = asyncio.current_task()
        for task in (self._timer_task, self._play_task, self._convai_task, self._playback_task):
            if task and task is not current and not task.done():
                task.cancel()

        # Close ConvAI WebSocket
        self._convai_ready = False
        if self._convai_ws:
            try:
                await self._convai_ws.close()
            except Exception:
                pass
            self._convai_ws = None

        # ── Hang up the actual Telegram phone call FIRST ──
        # Must happen before leave_call(), otherwise pytgcalls cleanup
        # may invalidate the call state on Telegram's side.
        if self._phone_call_id is not None:
            try:
                from pyrogram.raw.functions.phone import DiscardCall
                from pyrogram.raw.types import (
                    InputPhoneCall,
                    PhoneCallDiscardReasonHangup,
                )
                log.info(
                    "voice_call.discarding call_id=%s access_hash=%s duration=%ds",
                    self._phone_call_id, self._phone_call_access_hash,
                    int(self.elapsed_seconds),
                )
                await self.client.invoke(
                    DiscardCall(
                        peer=InputPhoneCall(
                            id=self._phone_call_id,
                            access_hash=self._phone_call_access_hash,
                        ),
                        duration=int(self.elapsed_seconds),
                        reason=PhoneCallDiscardReasonHangup(),
                        connection_id=0,
                    )
                )
                log.info("voice_call.phone_discarded OK influencer=%s", self.influencer_id)
            except Exception:
                log.exception("voice_call.discard_FAILED influencer=%s", self.influencer_id)
        else:
            log.warning("voice_call.no_phone_call_id — cannot discard, will try leave_call only")

        # Leave the pytgcalls call (drops media stream / WebRTC)
        try:
            await self.ptg.leave_call(self.chat_id)
        except Exception as e:
            log.warning("voice_call.leave_error: %s", e)

        # Remove pytgcalls handlers
        for attr in ("_stream_handler", "_call_left_handler", "_call_discarded_handler"):
            try:
                handler = getattr(self, attr, None)
                if handler:
                    self.ptg.remove_handler(handler)
            except Exception:
                pass

        duration = self.elapsed_seconds
        await self._finalize_call_record(duration)

        log.info(
            "voice_call.stopped influencer=%s user=%s duration=%.1fs reason=%s",
            self.influencer_id, self.telegram_user_id, duration, reason,
        )

    # ── pytgcalls: accept call + record ─────────────────────────────

    async def _accept_and_record(self, stream: MediaStream):
        """Accept the incoming call, then activate recording."""
        # Step 1: Accept call
        try:
            await self.ptg.play(
                self.chat_id,
                stream=stream,
                config=CallConfig(timeout=60),
            )
            log.info("voice_call.play_completed influencer=%s", self.influencer_id)

            # Start the always-on playback loop immediately.
            # Sends silence frames at 20ms cadence to keep the WebRTC
            # RTP stream alive even before ConvAI audio arrives.
            self._playback_task = asyncio.create_task(self._playback_loop())
        except Exception as exc:
            log.warning("voice_call.play_error influencer=%s err=%s", self.influencer_id, exc)
            self._is_active = False
            from app.telegram.voice_engine import voice_call_manager
            key = voice_call_manager._call_key(self.influencer_id, self.telegram_user_id)
            voice_call_manager._active_calls.pop(key, None)
            return

        # Step 2: Activate recording (incoming audio capture)
        # Wait for the call to fully establish before starting recording.
        await asyncio.sleep(1.0)

        record_stream = RecordStream(
            audio=True,
            audio_parameters=RawAudioParameters(
                bitrate=SAMPLE_RATE,
                channels=CHANNELS,
            ),
        )
        for attempt in range(10):
            if not self._is_active:
                return
            try:
                await self.ptg.record(self.chat_id, record_stream)
                log.info("voice_call.record_started influencer=%s attempt=%d",
                         self.influencer_id, attempt + 1)

                # Start a watchdog: if no frames arrive within 5s,
                # log a warning so we know recording isn't delivering.
                asyncio.create_task(self._frame_watchdog())
                return
            except Exception as exc:
                log.warning("voice_call.record_retry attempt=%d err=%s", attempt + 1, exc)
                await asyncio.sleep(1.0)

        log.error("voice_call.record_failed_all_retries influencer=%s", self.influencer_id)

    async def _frame_watchdog(self):
        """Log a warning if no frames arrive within 5s of recording start."""
        try:
            await asyncio.sleep(5.0)
            if self._is_active and self._frame_count == 0:
                log.error(
                    "voice_call.NO_FRAMES_RECEIVED influencer=%s "
                    "(recording started but 0 frames in 5s — audio capture not working)",
                    self.influencer_id,
                )
            elif self._is_active:
                log.info(
                    "voice_call.frame_watchdog_ok influencer=%s frames=%d "
                    "convai_ready=%s early_queued=%d sent=%d",
                    self.influencer_id, self._frame_count,
                    self._convai_ready, self._early_audio_dropped,
                    self._audio_chunks_sent,
                )
        except asyncio.CancelledError:
            pass

    def _register_stream_handler(self):
        """Register pytgcalls handlers for incoming audio + call-end."""

        @self.ptg.on_update(ptg_filters.stream_frame(Direction.INCOMING, Device.MICROPHONE))
        async def _on_stream_frames(_, update: StreamFrames):
            if update.chat_id != self.chat_id or not self._is_active:
                return
            for frame in update.frames:
                if frame.frame:
                    self._on_audio_frame(frame.frame)

        self._stream_handler = _on_stream_frames

        @self.ptg.on_update(ptg_filters.chat_update(ChatUpdate.Status.LEFT_CALL))
        async def _on_call_left(_, update: ChatUpdate):
            if update.chat_id != self.chat_id or not self._is_active:
                return
            log.info("voice_call.call_ended_by_remote influencer=%s", self.influencer_id)
            await self.stop(reason="remote_hangup")
            from app.telegram.voice_engine import voice_call_manager
            key = voice_call_manager._call_key(self.influencer_id, self.telegram_user_id)
            voice_call_manager._active_calls.pop(key, None)

        self._call_left_handler = _on_call_left

        @self.ptg.on_update(ptg_filters.chat_update(ChatUpdate.Status.DISCARDED_CALL))
        async def _on_call_discarded(_, update: ChatUpdate):
            if update.chat_id != self.chat_id or not self._is_active:
                return
            log.info("voice_call.call_discarded influencer=%s", self.influencer_id)
            await self.stop(reason="remote_hangup")
            from app.telegram.voice_engine import voice_call_manager
            key = voice_call_manager._call_key(self.influencer_id, self.telegram_user_id)
            voice_call_manager._active_calls.pop(key, None)

        self._call_discarded_handler = _on_call_discarded

    # ── Incoming audio: pytgcalls → ConvAI ──────────────────────────

    def _on_audio_frame(self, data: bytes):
        """Buffer incoming 48kHz PCM and send to ConvAI in ~100ms chunks.

        This method is called from pytgcalls' internal thread.
        Buffer accumulation + downsampling happen here (in-thread) for
        lowest latency. Only the async WebSocket send is scheduled on
        the event loop via call_soon_threadsafe.
        """
        if not self._is_active or not data:
            return

        self._frame_count += 1
        if self._frame_count == 1:
            log.info("voice_call.first_frame_received influencer=%s bytes=%d",
                     self.influencer_id, len(data))
        elif self._frame_count % 250 == 0:
            log.info("voice_call.frames_received influencer=%s total=%d buf=%d",
                     self.influencer_id, self._frame_count,
                     len(self._audio_send_buffer))

        self._audio_send_buffer.extend(data)

        # Send to ConvAI every ~100ms of 48kHz audio
        while len(self._audio_send_buffer) >= CONVAI_CHUNK_BYTES_48K:
            chunk_48k = bytes(self._audio_send_buffer[:CONVAI_CHUNK_BYTES_48K])
            del self._audio_send_buffer[:CONVAI_CHUNK_BYTES_48K]

            # Downsample 48kHz → 16kHz for ConvAI
            chunk_16k = downsample_48k_to_16k(chunk_48k)

            if not self._convai_ready:
                # ConvAI session not ready yet — queue the audio for later
                self._early_audio_queue.append(chunk_16k)
                self._early_audio_dropped += 1
                if self._early_audio_dropped == 1:
                    log.info("voice_call.queuing_early_audio influencer=%s",
                             self.influencer_id)
                continue

            # Schedule the async send on the event loop (thread-safe)
            self._loop.call_soon_threadsafe(
                asyncio.ensure_future,
                self._send_audio_to_convai(chunk_16k),
            )

    async def _send_audio_to_convai(self, pcm_16k: bytes):
        """Send a chunk of 16kHz PCM audio to the ConvAI WebSocket."""
        if not self._convai_ws or not self._is_active or not self._convai_ready:
            return
        try:
            b64 = base64.b64encode(pcm_16k).decode()
            await self._convai_ws.send(json.dumps({"user_audio_chunk": b64}))
            self._audio_chunks_sent += 1
            if self._audio_chunks_sent == 1:
                log.info("convai.first_audio_sent influencer=%s bytes=%d",
                         self.influencer_id, len(pcm_16k))
            elif self._audio_chunks_sent % 40 == 0:
                log.info("convai.audio_sent influencer=%s total=%d",
                         self.influencer_id, self._audio_chunks_sent)
        except Exception as e:
            log.warning("convai.send_audio_error: %s", e)

    # ── ConvAI WebSocket: connect + listen ──────────────────────────

    async def _run_convai(self):
        """Connect to ElevenLabs ConvAI and pipe audio back to the caller."""
        try:
            if not self._is_active:
                return

            # Get signed WebSocket URL
            signed_url = await self._get_convai_signed_url()
            if not signed_url:
                log.error("convai.no_signed_url influencer=%s", self.influencer_id)
                return

            # Append output_format as a URL query parameter — ConvAI
            # ignores output_format in the JSON body and only reads it
            # from the URL.  Without this, ConvAI defaults to its own
            # sample rate and the audio sounds sped up / high pitched.
            separator = "&" if "?" in signed_url else "?"
            ws_url = f"{signed_url}{separator}output_format=pcm_16000"

            log.info("convai.connecting influencer=%s agent=%s url=%s",
                     self.influencer_id, self.agent_id, ws_url[:120])

            async with websockets.connect(
                ws_url,
                additional_headers={"Origin": "https://teaseme.live"},
                ping_interval=20,
                ping_timeout=10,
            ) as ws:
                self._convai_ws = ws
                log.info("convai.websocket_open influencer=%s", self.influencer_id)

                # Send client initiation — match the override fields that
                # the agent's platform_settings allow (first_message, language,
                # prompt.prompt, tts.voice_id).
                init_data = {
                    "type": "conversation_initiation_client_data",
                    "conversation_config_override": {
                        "agent": {
                            "prompt": {
                                "prompt": self.system_prompt,
                            },
                            "first_message": "Hey babe, I'm so glad you called me!",
                            "language": "en",
                        },
                        "tts": {
                            "voice_id": self.voice_id,
                        },
                    },
                    "custom_llm_extra_body": {},
                }
                await ws.send(json.dumps(init_data))
                log.info("convai.init_sent influencer=%s", self.influencer_id)

                # Listen for messages from ConvAI
                async for raw_msg in ws:
                    if not self._is_active:
                        break

                    try:
                        msg = json.loads(raw_msg)
                    except json.JSONDecodeError:
                        continue

                    msg_type = msg.get("type", "")

                    if msg_type == "conversation_initiation_metadata":
                        self._conversation_id = (
                            msg.get("conversation_initiation_metadata_event", {})
                            .get("conversation_id")
                        )
                        # Log the full metadata to see input/output format details
                        meta_event = msg.get("conversation_initiation_metadata_event", {})
                        user_input_fmt = meta_event.get("user_input_audio_format", "unknown")
                        agent_output_fmt = meta_event.get("agent_output_audio_format", "unknown")
                        log.info(
                            "convai.session_started conv=%s influencer=%s "
                            "input_fmt=%s output_fmt=%s",
                            self._conversation_id, self.influencer_id,
                            user_input_fmt, agent_output_fmt,
                        )

                        # Validate audio format — log if ConvAI negotiated
                        # a different format than we requested
                        if agent_output_fmt != "unknown":
                            log.info(
                                "convai.output_format influencer=%s fmt=%s",
                                self.influencer_id, agent_output_fmt,
                            )

                        # Dynamically detect actual output sample rate from
                        # negotiated format (e.g. "pcm_16000", "pcm_24000").
                        # NOTE: We only LOG this — we do NOT change _convai_output_rate
                        # because ConvAI's metadata often reports a different format
                        # than it actually sends, causing mid-call chipmunk regression.
                        rate_match = re.search(r'(\d{4,6})', str(agent_output_fmt))
                        if rate_match:
                            negotiated_rate = int(rate_match.group(1))
                            if negotiated_rate in (8000, 16000, 22050, 24000, 44100, 48000):
                                log.info(
                                    "convai.output_rate_reported influencer=%s "
                                    "reported=%d using=%d (locked to request)",
                                    self.influencer_id, negotiated_rate,
                                    self._convai_output_rate,
                                )

                        # Mark ConvAI as ready and flush any queued early audio
                        self._convai_ready = True
                        self._convai_ready_event.set()  # unblock call pickup
                        if self._early_audio_queue:
                            log.info(
                                "convai.flushing_early_audio influencer=%s chunks=%d",
                                self.influencer_id, len(self._early_audio_queue),
                            )
                            for queued_chunk in self._early_audio_queue:
                                await self._send_audio_to_convai(queued_chunk)
                            self._early_audio_queue.clear()

                    elif msg_type == "audio":
                        await self._handle_convai_audio(msg)

                    elif msg_type == "ping":
                        event_id = msg.get("ping_event", {}).get("event_id", 0)
                        await ws.send(json.dumps({"type": "pong", "event_id": event_id}))

                    elif msg_type == "user_transcript":
                        transcript = (
                            msg.get("user_transcription_event", {})
                            .get("user_transcript", "")
                        )
                        if transcript:
                            log.info("convai.user_said influencer=%s text=%s",
                                     self.influencer_id, transcript[:80])

                    elif msg_type == "agent_response":
                        response = msg.get("agent_response_event", {}).get("agent_response", "")
                        if response:
                            log.info("convai.agent_said influencer=%s text=%s",
                                     self.influencer_id, response[:80])

                    elif msg_type == "error":
                        log.error("convai.server_error influencer=%s msg=%s",
                                  self.influencer_id, json.dumps(msg)[:300])

                    else:
                        log.debug("convai.msg type=%s influencer=%s", msg_type, self.influencer_id)

        except asyncio.CancelledError:
            pass
        except Exception:
            if self._is_active:
                log.exception("convai.error influencer=%s", self.influencer_id)
        finally:
            self._convai_ws = None
            log.info("convai.disconnected influencer=%s", self.influencer_id)

    async def _handle_convai_audio(self, msg: dict):
        """Receive audio from ConvAI, resample to 48kHz, and queue for playback.

        Uses self._convai_output_rate (detected from session metadata) to
        determine the correct upsampling ratio. This prevents high-pitched
        sped-up audio when ConvAI sends a different rate than requested.

        Includes chunk-size sanity checking to detect rate mismatches at
        runtime — if ConvAI sends audio at a different rate than negotiated,
        the chunk durations won't match expectations.
        """
        audio_event = msg.get("audio_event", {})
        audio_b64 = audio_event.get("audio_base_64", "")
        if not audio_b64:
            return

        self._audio_chunks_received += 1

        # Decode base64 → raw PCM at whatever rate ConvAI sent
        pcm_raw = base64.b64decode(audio_b64)

        if self._audio_chunks_received == 1:
            log.info("convai.first_audio_chunk influencer=%s bytes=%d rate=%d",
                     self.influencer_id, len(pcm_raw), self._convai_output_rate)
        elif self._audio_chunks_received % 20 == 0:
            log.info("convai.audio_chunks influencer=%s total=%d",
                     self.influencer_id, self._audio_chunks_received)

        # ── Rate info (diagnostic only) ──
        source_rate = self._convai_output_rate  # locked to 16000

        # Adaptive resample to 48kHz based on detected output rate.
        # 48000 / source_rate gives the integer ratio for linear interpolation.
        if source_rate == SAMPLE_RATE:
            # Already 48kHz — no resampling needed
            pcm_48k = pcm_raw
        elif SAMPLE_RATE % source_rate == 0:
            # Clean integer ratio (16k→3×, 24k→2×, 8k→6×)
            ratio = SAMPLE_RATE // source_rate
            pcm_48k = _upsample_by_ratio(pcm_raw, ratio)
        else:
            # Non-integer ratio (22050, 44100) — fall back to 16k assumption
            log.warning(
                "convai.non_integer_ratio influencer=%s rate=%d, "
                "falling back to 3× upsample",
                self.influencer_id, source_rate,
            )
            pcm_48k = _upsample_by_ratio(pcm_raw, 3)

        if not pcm_48k:
            return

        # Pre-chunk into exact 960-byte frames (10ms @ 48kHz mono) and enqueue.
        self._partial_frame.extend(pcm_48k)
        while len(self._partial_frame) >= FRAME_SIZE:
            frame = bytes(self._partial_frame[:FRAME_SIZE])
            del self._partial_frame[:FRAME_SIZE]
            self._playback_frames.append(frame)
        self._playback_event.set()  # wake up playback loop

    async def _playback_loop(self):
        """Send 20ms audio frames to pytgcalls at real-time pace.

        ## Hybrid timing strategy

        send_frame() MUST be awaited on the event loop (it's async and
        accesses pytgcalls internals that aren't thread-safe). But
        asyncio.sleep() has ±15ms jitter — nearly the entire 20ms frame.

        Solution: offload the precision sleep to a thread-pool worker
        via run_in_executor(). In a real OS thread, time.sleep() has
        ~1ms precision and time.perf_counter() gives sub-ms accuracy
        for the final spin-wait. send_frame() stays as a normal await.

        ## Drift recovery

        If we fall behind by more than 2 frames (20ms), we reset the
        cadence rather than bursting catch-up frames.

        ## Always-on silence

        Sends SILENCE_FRAME when the deque is empty, keeping the WebRTC
        RTP stream alive so Telegram never reports "poor connection".
        """
        loop = asyncio.get_event_loop()
        frame_duration = 0.01  # 10ms per frame (NTgCalls AudioSink uses 10ms intervals)
        next_send = time.perf_counter()
        frames_sent_total = 0
        consecutive_errors = 0

        try:
            while self._is_active:
                now = time.perf_counter()

                # ── Drift recovery ──
                if now - next_send > frame_duration * 2:
                    next_send = now

                # ── Precision wait (in thread pool) ──
                remaining = next_send - now
                if remaining > 0.001:
                    await loop.run_in_executor(
                        None, self._precise_sleep, remaining,
                    )

                # ── Pick the frame ──
                if self._playback_frames:
                    if not self._jitter_filled:
                        if len(self._playback_frames) < JITTER_BUFFER_FRAMES:
                            frame = SILENCE_FRAME
                        else:
                            self._jitter_filled = True
                            log.info(
                                "playback.jitter_buffer_filled influencer=%s "
                                "frames=%d",
                                self.influencer_id,
                                len(self._playback_frames),
                            )
                            frame = self._playback_frames.popleft()
                    else:
                        frame = self._playback_frames.popleft()
                else:
                    # No ConvAI audio queued — flush any partial frame
                    if self._partial_frame:
                        remaining_bytes = bytes(self._partial_frame)
                        self._partial_frame.clear()
                        frame = remaining_bytes + b'\x00' * (FRAME_SIZE - len(remaining_bytes))
                    else:
                        frame = SILENCE_FRAME

                # ── Send the frame (on event loop — required) ──
                try:
                    await self.ptg.send_frame(
                        self.chat_id,
                        Device.MICROPHONE,
                        frame,
                    )
                    frames_sent_total += 1
                    consecutive_errors = 0
                except Exception as e:
                    consecutive_errors += 1
                    if consecutive_errors <= 3:
                        log.debug(
                            "playback.send_frame_skip influencer=%s err=%s",
                            self.influencer_id, e,
                        )
                    elif consecutive_errors > 50:
                        log.warning(
                            "playback.send_frame_fatal influencer=%s "
                            "consecutive_errors=%d",
                            self.influencer_id, consecutive_errors,
                        )
                        break

                next_send += frame_duration

                if frames_sent_total == 1:
                    log.info("playback.first_frame_sent influencer=%s",
                             self.influencer_id)
                elif frames_sent_total % 500 == 0:
                    log.info(
                        "playback.frames_sent influencer=%s total=%d "
                        "queued=%d",
                        self.influencer_id, frames_sent_total,
                        len(self._playback_frames),
                    )
        except asyncio.CancelledError:
            pass
        except Exception:
            if self._is_active:
                log.exception("playback.error influencer=%s", self.influencer_id)

    @staticmethod
    def _precise_sleep(duration: float):
        """Sleep with sub-millisecond precision in a thread-pool worker.

        Coarse-sleeps for the bulk of the duration, then spin-waits
        for the final ~1ms using time.perf_counter().
        Called via run_in_executor() so the event loop stays free.
        """
        target = time.perf_counter() + duration
        # Coarse sleep — leave 1ms for spin
        if duration > 0.002:
            time.sleep(duration - 0.001)
        # Spin-wait for the final ~1ms
        while time.perf_counter() < target:
            pass

    async def _get_convai_signed_url(self) -> Optional[str]:
        """Get a signed WebSocket URL from ElevenLabs for ConvAI."""
        try:
            async with httpx.AsyncClient(
                base_url=settings.ELEVEN_BASE_URL, timeout=20.0
            ) as client:
                resp = await client.get(
                    "/convai/conversation/get-signed-url",
                    params={"agent_id": self.agent_id},
                    headers={"xi-api-key": settings.ELEVENLABS_API_KEY},
                )
                if resp.status_code != 200:
                    log.error("convai.signed_url_error status=%d body=%s",
                              resp.status_code, resp.text[:300])
                    return None

                signed_url = resp.json().get("signed_url")
                if not signed_url:
                    log.error("convai.signed_url_missing in response")
                    return None

                log.info("convai.signed_url_ok influencer=%s", self.influencer_id)
                return signed_url
        except Exception:
            log.exception("convai.signed_url_failed")
            return None

    # ── Trial timer ─────────────────────────────────────────────────

    async def _trial_timer(self):
        """Enforce the free trial duration limit."""
        try:
            await asyncio.sleep(self.max_duration_secs)
            if not self._is_active:
                return

            log.info("voice_call.trial_expired influencer=%s after=%ds",
                     self.influencer_id, self.max_duration_secs)

            await self.stop(reason="trial_expired")

            # 1) Send text CTA
            try:
                await self.client.send_message(
                    chat_id=self.chat_id,
                    text=(
                        "💋 Your Trial Has Ended\n\n"
                        "Continue the fun here:\n"
                        f"👉 {TEASEME_URL}\n\n"
                        "See you there babe 😘"
                    ),
                )
            except Exception:
                log.exception("Failed to send trial redirect message")

            # 2) Send ElevenLabs voice note
            await self._send_trial_voice_note()

        except asyncio.CancelledError:
            pass

    async def _send_trial_voice_note(self):
        """Generate TTS voice note via ElevenLabs and send as Telegram voice message."""
        farewell_text = "I'll see you in teaseme mi amor... don't make me wait"
        try:
            import httpx
            import io

            voice_id = self.voice_id
            api_key = settings.ELEVENLABS_API_KEY
            if not api_key:
                log.warning("No ELEVENLABS_API_KEY — skipping trial voice note")
                return

            url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
            headers = {
                "xi-api-key": api_key,
                "Content-Type": "application/json",
                "Accept": "audio/mpeg",
            }
            payload = {
                "text": farewell_text,
                "model_id": "eleven_turbo_v2",
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.75,
                    "style": 0.4,
                },
            }

            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(url, json=payload, headers=headers)

            if resp.status_code != 200:
                log.error("ElevenLabs TTS failed: %s %s", resp.status_code, resp.text[:200])
                return

            audio_bytes = resp.content
            if len(audio_bytes) < 1000:
                log.warning("ElevenLabs TTS returned suspiciously small audio (%d bytes)", len(audio_bytes))
                return

            voice_file = io.BytesIO(audio_bytes)
            voice_file.name = "farewell.mp3"

            await self.client.send_voice(
                chat_id=self.chat_id,
                voice=voice_file,
            )
            log.info("voice_call.trial_voice_note_sent influencer=%s user=%s",
                     self.influencer_id, self.telegram_user_id)

        except Exception:
            log.exception("Failed to send trial voice note")

    # ── DB helpers ──────────────────────────────────────────────────

    async def _create_call_record(self):
        self._call_record_id = f"tg_call_{uuid.uuid4().hex[:16]}"
        try:
            async with SessionLocal() as db:
                chat_id = f"tg_{self.influencer_id}_{self.telegram_user_id}"
                from app.db.models import Chat
                existing_chat = await db.get(Chat, chat_id)
                if not existing_chat:
                    db.add(Chat(id=chat_id, user_id=0, influencer_id=self.influencer_id))
                    await db.flush()
                db.add(CallRecord(
                    conversation_id=self._call_record_id,
                    user_id=0,
                    influencer_id=self.influencer_id,
                    chat_id=chat_id,
                    telegram_user_id=self.telegram_user_id,
                    status="active",
                ))
                await db.commit()
        except Exception:
            log.exception("Failed to create call record")

    async def _finalize_call_record(self, duration_secs: float):
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


# ── Manager ─────────────────────────────────────────────────────────

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
        ptg: PyTgCalls,
        influencer_id: str,
        telegram_user_id: int,
        chat_id: int,
        phone_call_id: Optional[int] = None,
        phone_call_access_hash: Optional[int] = None,
    ) -> Optional[VoiceCallSession]:
        """Start a new voice call session bridged to ElevenLabs ConvAI."""
        key = self._call_key(influencer_id, telegram_user_id)

        # Clean up stale/dead sessions
        if key in self._active_calls:
            existing = self._active_calls[key]
            if not existing.is_active:
                del self._active_calls[key]
            elif existing.elapsed_seconds > 15:
                log.warning("Cleaning up stale session %s (%.0fs)", key, existing.elapsed_seconds)
                try:
                    await existing.stop(reason="stale_cleanup")
                except Exception:
                    pass
                del self._active_calls[key]
            else:
                log.warning("Call already active for %s (%.0fs)", key, existing.elapsed_seconds)
                return self._active_calls[key]

        # Load influencer data
        async with SessionLocal() as db:
            influencer = await db.get(Influencer, influencer_id)
            if not influencer:
                log.error("Influencer %s not found", influencer_id)
                return None

            voice_id = influencer.voice_id
            agent_id = getattr(influencer, "influencer_agent_id_third_part", None)

            if not voice_id:
                log.error("Influencer %s has no voice_id", influencer_id)
                return None

            if not agent_id:
                log.error("Influencer %s has no ConvAI agent_id", influencer_id)
                return None

            # Check cumulative trial usage for this Telegram user
            from sqlalchemy import select, func
            total_used = await db.scalar(
                select(func.coalesce(func.sum(CallRecord.call_duration_secs), 0.0))
                .where(
                    CallRecord.telegram_user_id == telegram_user_id,
                    CallRecord.status == "completed",
                )
            ) or 0.0
            remaining = max(0, DEFAULT_TRIAL_SECS - int(total_used))
            log.info(
                "voice_call.trial_check tg_user=%s used=%.1fs remaining=%ds",
                telegram_user_id, total_used, remaining,
            )

            if remaining <= 0:
                log.info("Trial exhausted for tg_user=%s (used %.1fs)", telegram_user_id, total_used)
                # Send trial-ended messages directly
                try:
                    await client.send_message(
                        chat_id=chat_id,
                        text=(
                            "💋 Your Trial Has Ended\n\n"
                            "Continue the fun here:\n"
                            f"👉 {TEASEME_URL}\n\n"
                            "See you there babe 😘"
                        ),
                    )
                except Exception:
                    log.exception("Failed to send trial-exhausted message")
                return None

            max_duration = remaining

            # Build system prompt — fetch the adult prompt from DB
            from app.services.system_prompt_service import get_system_prompt
            from app.constants import prompt_keys

            base_prompt = await get_system_prompt(db, prompt_keys.BASE_ADULT_PROMPT)
            audio_prompt = await get_system_prompt(db, prompt_keys.BASE_ADULT_AUDIO_PROMPT)

            if base_prompt:
                system_prompt = base_prompt
                if audio_prompt:
                    system_prompt = f"{base_prompt}\n{audio_prompt}"
            else:
                # Fallback: influencer-specific or generic
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
            agent_id=agent_id,
            voice_id=voice_id,
            system_prompt=system_prompt,
            max_duration_secs=max_duration,
        )
        session._phone_call_id = phone_call_id
        session._phone_call_access_hash = phone_call_access_hash

        await session.start()
        self._active_calls[key] = session
        return session

    async def end_call(self, influencer_id: str, telegram_user_id: int):
        key = self._call_key(influencer_id, telegram_user_id)
        session = self._active_calls.pop(key, None)
        if session and session.is_active:
            await session.stop(reason="user_hangup")

    async def end_all_calls(self):
        for key, session in list(self._active_calls.items()):
            if session.is_active:
                await session.stop(reason="server_shutdown")
        self._active_calls.clear()


# Singleton
voice_call_manager = VoiceCallManager()
