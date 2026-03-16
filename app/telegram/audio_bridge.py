"""
Audio Bridge
=============
Format conversion utilities for the Telegram voice call pipeline.

All pytgcalls audio must be PCM 16-bit signed little-endian, 48kHz.
ElevenLabs outputs MP3 or PCM. Whisper accepts WAV/MP3.

Conversion chain:
  Capture:  pytgcalls PCM 48kHz → WAV → Whisper
  Playback: ElevenLabs MP3 → FFmpeg → PCM 48kHz → pytgcalls
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

# pytgcalls expects: PCM signed 16-bit LE, 48000 Hz, mono (1 channel)
SAMPLE_RATE = 48000
CHANNELS = 1
SAMPLE_WIDTH = 2  # 16-bit = 2 bytes
BYTES_PER_SECOND = SAMPLE_RATE * CHANNELS * SAMPLE_WIDTH  # 96000 bytes/sec


def pcm_to_wav(pcm_bytes: bytes, sample_rate: int = SAMPLE_RATE, channels: int = CHANNELS) -> bytes:
    """Convert raw PCM bytes to WAV format (for Whisper input).

    Args:
        pcm_bytes: Raw PCM 16-bit signed little-endian audio.
        sample_rate: Sample rate in Hz (default 48000).
        channels: Number of channels (default 1 = mono).

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
        PCM bytes in pytgcalls-compatible format.
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

    Uses the streaming TTS endpoint for lower latency.

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
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{settings.ELEVEN_BASE_URL}/v1/text-to-speech/{voice_id}/stream",
                headers={
                    "xi-api-key": settings.ELEVENLABS_API_KEY,
                    "Content-Type": "application/json",
                },
                json={
                    "text": text,
                    "model_id": "eleven_v3_conversational",
                    "output_format": "mp3_44100_128",
                    "voice_settings": {
                        "stability": 0.5,
                        "similarity_boost": 0.75,
                    },
                },
            )
            if resp.status_code != 200:
                log.error("ElevenLabs TTS error %d: %s", resp.status_code, resp.text[:300])
                return b""

            mp3_bytes = resp.content

        # Convert MP3 → PCM in a thread to avoid blocking the event loop
        pcm = await asyncio.get_event_loop().run_in_executor(
            None, mp3_to_pcm, mp3_bytes
        )
        return pcm

    except Exception:
        log.exception("ElevenLabs TTS failed")
        return b""


def seconds_of_pcm(pcm_bytes: bytes) -> float:
    """Calculate the duration of PCM audio in seconds."""
    return len(pcm_bytes) / BYTES_PER_SECOND
