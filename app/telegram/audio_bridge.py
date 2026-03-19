"""
Audio Bridge
=============
Format conversion utilities for the Telegram voice call pipeline.

pytgcalls private calls: PCM 16-bit signed LE, 48kHz MONO.
ElevenLabs ConvAI WebSocket: PCM 16-bit signed LE, 16kHz MONO.
ElevenLabs TTS REST API: PCM 16-bit signed LE, 24kHz MONO.

Conversion chains:
  ConvAI capture:  pytgcalls 48kHz → downsample 3x → ConvAI 16kHz
  ConvAI playback: ConvAI 16kHz → upsample 3x → pytgcalls 48kHz
  TTS playback:    ElevenLabs 24kHz → FFmpeg 2x → pytgcalls 48kHz
"""

import asyncio
import io
import logging
import struct
import subprocess
import tempfile
import os
from typing import Optional

import httpx

from app.core.config import settings

log = logging.getLogger(__name__)

# Telegram private calls negotiate WebRTC as MONO (1 channel), 48kHz, 16-bit.
SAMPLE_RATE = 48000
CHANNELS = 1  # Private calls are mono
SAMPLE_WIDTH = 2  # 16-bit = 2 bytes
BYTES_PER_SECOND = SAMPLE_RATE * CHANNELS * SAMPLE_WIDTH  # 96000 bytes/sec

# ElevenLabs ConvAI uses 16kHz mono 16-bit PCM
CONVAI_SAMPLE_RATE = 16000
CONVAI_BYTES_PER_SECOND = CONVAI_SAMPLE_RATE * CHANNELS * SAMPLE_WIDTH  # 32000


def downsample_48k_to_16k(pcm_48k: bytes) -> bytes:
    """Downsample 48kHz mono PCM to 16kHz mono PCM (3x decimation).

    Uses averaging of each group of 3 samples as a basic anti-aliasing
    filter before decimation. Good enough for voice audio.
    """
    if len(pcm_48k) < 6:
        return b""
    n = len(pcm_48k) // 2
    samples = struct.unpack(f"<{n}h", pcm_48k[:n * 2])
    out = []
    for i in range(0, n - 2, 3):
        avg = (samples[i] + samples[i + 1] + samples[i + 2]) // 3
        out.append(max(-32768, min(32767, avg)))
    return struct.pack(f"<{len(out)}h", *out)


def upsample_16k_to_48k(pcm_16k: bytes) -> bytes:
    """Upsample 16kHz mono PCM to 48kHz mono PCM (3x interpolation).

    Uses linear interpolation to produce 3 output samples per input
    sample pair, avoiding the buzzy sound of zero-order hold (sample
    repetition).
    """
    if len(pcm_16k) < 4:
        return b""
    n = len(pcm_16k) // 2
    samples = struct.unpack(f"<{n}h", pcm_16k[:n * 2])
    out = []
    for i in range(n - 1):
        s0 = samples[i]
        s1 = samples[i + 1]
        out.append(s0)
        out.append(s0 + (s1 - s0) // 3)
        out.append(s0 + 2 * (s1 - s0) // 3)
    # Last sample: repeat
    out.append(samples[-1])
    out.append(samples[-1])
    out.append(samples[-1])
    return struct.pack(f"<{len(out)}h", *out)


def pcm_to_wav(pcm_bytes: bytes, sample_rate: int = SAMPLE_RATE, channels: int = 1) -> bytes:
    """Convert raw PCM bytes to WAV format (for Whisper input).

    Args:
        pcm_bytes: Raw PCM 16-bit signed little-endian audio (mono).
        sample_rate: Sample rate in Hz (default 48000).
        channels: Number of channels in the output WAV (default 1 = mono).

    Returns:
        WAV file bytes with proper header.
    """
    buf = io.BytesIO()
    data_size = len(pcm_bytes)
    # WAV header
    buf.write(b"RIFF")
    buf.write(struct.pack("<I", 36 + data_size))
    buf.write(b"WAVE")
    buf.write(b"fmt ")
    buf.write(struct.pack("<I", 16))  # chunk size
    buf.write(struct.pack("<H", 1))   # PCM format
    buf.write(struct.pack("<H", channels))
    buf.write(struct.pack("<I", sample_rate))
    buf.write(struct.pack("<I", sample_rate * channels * SAMPLE_WIDTH))  # byte rate
    buf.write(struct.pack("<H", channels * SAMPLE_WIDTH))  # block align
    buf.write(struct.pack("<H", 16))  # bits per sample
    buf.write(b"data")
    buf.write(struct.pack("<I", data_size))
    buf.write(pcm_bytes)
    return buf.getvalue()


def mp3_to_pcm(mp3_bytes: bytes) -> bytes:
    """Convert MP3 audio to PCM 16-bit 48kHz mono via FFmpeg.

    Args:
        mp3_bytes: Raw MP3 file bytes.

    Returns:
        PCM bytes in pytgcalls-compatible format (48kHz mono).
    """
    try:
        result = subprocess.run(
            [
                "ffmpeg", "-hide_banner", "-loglevel", "error",
                "-i", "pipe:0",
                "-f", "s16le",
                "-ac", str(CHANNELS),
                "-ar", str(SAMPLE_RATE),
                "-acodec", "pcm_s16le",
                "pipe:1",
            ],
            input=mp3_bytes,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=30,
        )
        if result.returncode != 0:
            log.error("FFmpeg MP3→PCM failed: %s", result.stderr.decode()[:500])
            return b""
        return result.stdout
    except subprocess.TimeoutExpired:
        log.error("FFmpeg MP3→PCM timed out")
        return b""
    except FileNotFoundError:
        log.error("FFmpeg not found. Install with: apt-get install ffmpeg")
        return b""


def pcm_resample_to_48k_mono(raw_pcm: bytes, input_rate: int = 24000) -> bytes:
    """Resample raw mono PCM to 48kHz mono PCM via FFmpeg.

    Uses FFmpeg's high-quality polyphase resampler. For 24kHz→48kHz
    (exact 2x integer ratio), this produces artifact-free output.

    Args:
        raw_pcm: Raw PCM 16-bit signed LE mono audio.
        input_rate: Sample rate of the input PCM (default 24000 for ElevenLabs).

    Returns:
        PCM 48kHz mono 16-bit signed LE bytes.
    """
    if not raw_pcm:
        return b""
    try:
        result = subprocess.run(
            [
                "ffmpeg", "-hide_banner", "-loglevel", "error",
                "-f", "s16le",
                "-ar", str(input_rate),
                "-ac", "1",
                "-i", "pipe:0",
                "-f", "s16le",
                "-ar", str(SAMPLE_RATE),
                "-ac", str(CHANNELS),
                "-acodec", "pcm_s16le",
                "pipe:1",
            ],
            input=raw_pcm,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=30,
        )
        if result.returncode != 0:
            log.error("FFmpeg PCM resample failed: %s", result.stderr.decode()[:500])
            return b""
        return result.stdout
    except subprocess.TimeoutExpired:
        log.error("FFmpeg PCM resample timed out")
        return b""
    except FileNotFoundError:
        log.error("FFmpeg not found. Install with: apt-get install ffmpeg")
        return b""


async def transcribe_audio(wav_bytes: bytes) -> str:
    """Transcribe WAV audio using OpenAI Whisper API.

    Args:
        wav_bytes: WAV format audio bytes.

    Returns:
        Transcribed text string.
    """
    if not settings.OPENAI_API_KEY:
        log.error("OPENAI_API_KEY not set, cannot transcribe")
        return ""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                files={"file": ("audio.wav", wav_bytes, "audio/wav")},
                data={"model": "whisper-1", "language": "en"},
            )
            if resp.status_code != 200:
                log.error("Whisper API error %d: %s", resp.status_code, resp.text[:300])
                return ""
            return resp.json().get("text", "").strip()
    except Exception:
        log.exception("Whisper transcription failed")
        return ""


async def elevenlabs_tts_to_pcm(text: str, voice_id: str) -> bytes:
    """Generate speech using ElevenLabs and convert to PCM for pytgcalls.

    Uses raw PCM output from ElevenLabs (24kHz mono 16-bit) to avoid
    lossy MP3 encoding artifacts. Then resamples to 48kHz mono via
    FFmpeg (exact 2x integer ratio = artifact-free resampling).

    Args:
        text: Text to synthesize.
        voice_id: ElevenLabs voice ID for the influencer.

    Returns:
        PCM bytes in pytgcalls-compatible format (16-bit 48kHz mono).
    """
    if not settings.ELEVENLABS_API_KEY:
        log.error("ELEVENLABS_API_KEY not set, cannot synthesize")
        return b""

    try:
        # Request raw PCM 24kHz mono — avoids MP3 compression artifacts entirely
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{settings.ELEVEN_BASE_URL}/text-to-speech/{voice_id}/stream?output_format=pcm_24000",
                headers={
                    "xi-api-key": settings.ELEVENLABS_API_KEY,
                    "Content-Type": "application/json",
                },
                json={
                    "text": text,
                    "model_id": "eleven_turbo_v2_5",
                    "voice_settings": {
                        "stability": 0.5,
                        "similarity_boost": 0.75,
                    },
                },
            )
            if resp.status_code != 200:
                log.error("ElevenLabs TTS error %d: %s", resp.status_code, resp.text[:300])
                return b""

            raw_pcm_24k = resp.content
            log.debug(
                "elevenlabs.pcm_received bytes=%d duration=%.1fs",
                len(raw_pcm_24k),
                len(raw_pcm_24k) / (24000 * 1 * 2),  # 24kHz mono 16-bit
            )

        # Resample 24kHz mono → 48kHz mono (exact 2x integer ratio)
        pcm = await asyncio.get_event_loop().run_in_executor(
            None, pcm_resample_to_48k_mono, raw_pcm_24k, 24000
        )
        return pcm

    except Exception:
        log.exception("ElevenLabs TTS failed")
        return b""


def seconds_of_pcm(pcm_bytes: bytes) -> float:
    """Calculate the duration of PCM audio in seconds."""
    return len(pcm_bytes) / BYTES_PER_SECOND
