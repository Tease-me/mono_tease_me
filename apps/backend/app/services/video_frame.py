"""Extract still frames from scenario videos for image merge pipelines."""

from __future__ import annotations

import io
import logging
import os
import subprocess
import tempfile

from PIL import Image, ImageFilter

log = logging.getLogger(__name__)

SHARPNESS_SAMPLE_FRACTIONS = (0.08, 0.2, 0.35, 0.5, 0.65)


def _laplacian_sharpness(image: Image.Image) -> float:
    gray = image.convert("L")
    edges = gray.filter(ImageFilter.FIND_EDGES)
    pixels = edges.getdata()
    if not pixels:
        return 0.0
    return sum(pixels) / len(pixels)


def _probe_duration_seconds(video_path: str) -> float:
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        video_path,
    ]
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )
        return max(0.0, float((result.stdout or "").strip()))
    except (ValueError, subprocess.TimeoutExpired):
        return 0.0


def extract_sharpest_frame_png(video_bytes: bytes) -> bytes:
    """Sample several timestamps and return the sharpest PNG frame."""
    if not video_bytes:
        raise ValueError("Empty video payload")

    with tempfile.TemporaryDirectory() as tmp:
        video_path = os.path.join(tmp, "input.mp4")
        with open(video_path, "wb") as video_file:
            video_file.write(video_bytes)

        duration = _probe_duration_seconds(video_path)
        best_score = -1.0
        best_png: bytes | None = None

        for fraction in SHARPNESS_SAMPLE_FRACTIONS:
            timestamp = max(0.0, duration * fraction) if duration else 0.5
            frame_path = os.path.join(tmp, f"frame_{fraction:.2f}.png")
            cmd = [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-ss",
                f"{timestamp:.3f}",
                "-i",
                video_path,
                "-frames:v",
                "1",
                "-f",
                "image2",
                frame_path,
            ]
            result = subprocess.run(
                cmd,
                capture_output=True,
                timeout=30,
                check=False,
            )
            if result.returncode != 0 or not os.path.isfile(frame_path):
                log.debug(
                    "video_frame.extract_failed timestamp=%.3f stderr=%s",
                    timestamp,
                    (result.stderr or b"").decode("utf-8", errors="replace")[:200],
                )
                continue

            with Image.open(frame_path) as image:
                score = _laplacian_sharpness(image)
                if score > best_score:
                    best_score = score
                    buffer = io.BytesIO()
                    image.save(buffer, format="PNG")
                    best_png = buffer.getvalue()

        if best_png is None:
            raise RuntimeError("Failed to extract a frame from scenario video")

        return best_png
