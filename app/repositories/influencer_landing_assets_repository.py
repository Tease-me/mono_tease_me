"""Repository helpers for deterministic influencer landing and telegram assets."""

from __future__ import annotations

import io
from collections.abc import Mapping

from PIL import Image, UnidentifiedImageError
import pillow_heif

from app.core.config import settings
from app.gateways import s3_gateway

LANDING_IMAGE_SLOTS = {
    "hero_png": "landing/hero.png",
    "hero_png_2x": "landing/hero@2x.png",
    "signature_png": "landing/signature.png",
    "signature_png_2x": "landing/signature@2x.png",
    "background_image_1": "landing/background-1.png",
    "background_image_1_2x": "landing/background-1@2x.png",
    "background_image_2": "landing/background-2.png",
    "background_image_2_2x": "landing/background-2@2x.png",
    "background_image_3": "landing/background-3.png",
    "background_image_3_2x": "landing/background-3@2x.png",
    "background_video_1_poster_jpg": "landing/background-video-1-poster.jpg",
    "background_video_2_poster_jpg": "landing/background-video-2-poster.jpg",
}

LANDING_VIDEO_SLOTS = {
    "background_video_1_mp4": "landing/background-video-1.mp4",
    "background_video_1_webm": "landing/background-video-1.webm",
    "background_video_2_mp4": "landing/background-video-2.mp4",
    "background_video_2_webm": "landing/background-video-2.webm",
}

TELEGRAM_AUDIO_SLOT = "telegram_welcome_audio"
TELEGRAM_VIDEO_SLOT = "telegram_welcome_video"
LEGACY_TELEGRAM_MEDIA_SLOT = "telegram_welcome_media"
TELEGRAM_AUDIO_PREFIX = "telegram/welcome-audio"
TELEGRAM_VIDEO_PREFIX = "telegram/welcome-video"

_CONTENT_TYPE_TO_EXTENSION = {
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/aac": "aac",
    "audio/mp4": "m4a",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "video/x-msvideo": "avi",
    "video/mpeg": "mpeg",
}


def _asset_prefix(influencer_id: str) -> str:
    return f"{settings.INFLUENCER_BUCKET_PREFIX}/{influencer_id}"


def _is_heic(filename: str | None, content_type: str | None) -> bool:
    ext = (filename.rsplit(".", 1)[-1] if filename and "." in filename else "").lower()
    if ext in {"heic", "heif"}:
        return True
    if content_type:
        ct = content_type.lower().split(";", 1)[0].strip()
        if ct in {"image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"}:
            return True
    return False


def _convert_to_png(
    file_obj,
    filename: str | None,
    content_type: str | None,
) -> tuple[io.BytesIO, str]:
    normalized_type = (content_type or "").split(";", 1)[0].strip().lower()
    if not _is_heic(filename, content_type) and normalized_type == "image/png":
        file_obj.seek(0)
        return file_obj, "image/png"

    file_obj.seek(0)
    try:
        if _is_heic(filename, content_type):
            heif_file = pillow_heif.read_heif(file_obj)
            image = Image.frombytes(
                heif_file.mode,
                heif_file.size,
                heif_file.data,
                "raw",
            )
        else:
            image = Image.open(file_obj)
    except (UnidentifiedImageError, OSError):
        file_obj.seek(0)
        return file_obj, content_type or "image/png"

    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGBA" if "A" in image.mode else "RGB")

    output = io.BytesIO()
    image.save(output, format="PNG")
    output.seek(0)
    return output, "image/png"


def _convert_to_jpeg(
    file_obj,
    filename: str | None,
    content_type: str | None,
) -> tuple[io.BytesIO, str]:
    normalized_type = (content_type or "").split(";", 1)[0].strip().lower()
    if not _is_heic(filename, content_type) and normalized_type in {"image/jpeg", "image/jpg"}:
        file_obj.seek(0)
        return file_obj, "image/jpeg"

    file_obj.seek(0)
    try:
        if _is_heic(filename, content_type):
            heif_file = pillow_heif.read_heif(file_obj)
            image = Image.frombytes(
                heif_file.mode,
                heif_file.size,
                heif_file.data,
                "raw",
            )
        else:
            image = Image.open(file_obj)
    except (UnidentifiedImageError, OSError):
        file_obj.seek(0)
        return file_obj, content_type or "image/jpeg"

    if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
        image = image.convert("RGB")
    elif image.mode != "RGB":
        image = image.convert("RGB")

    output = io.BytesIO()
    image.save(output, format="JPEG", quality=92)
    output.seek(0)
    return output, "image/jpeg"


def _normalize_binary_extension(filename: str | None, content_type: str | None, fallback: str) -> str:
    if filename and "." in filename:
        ext = filename.rsplit(".", 1)[-1].lower()
        if ext:
            return "mp3" if ext == "mpeg" else ext

    normalized_type = (content_type or "").split(";", 1)[0].strip().lower()
    if normalized_type in _CONTENT_TYPE_TO_EXTENSION:
        return _CONTENT_TYPE_TO_EXTENSION[normalized_type]
    return fallback


def build_landing_asset_key(influencer_id: str, slot: str, *, filename: str | None = None, content_type: str | None = None) -> str:
    if slot in LANDING_IMAGE_SLOTS:
        return f"{_asset_prefix(influencer_id)}/{LANDING_IMAGE_SLOTS[slot]}"

    if slot in LANDING_VIDEO_SLOTS:
        return f"{_asset_prefix(influencer_id)}/{LANDING_VIDEO_SLOTS[slot]}"

    if slot == TELEGRAM_AUDIO_SLOT:
        ext = _normalize_binary_extension(filename, content_type, "mp3")
        return f"{_asset_prefix(influencer_id)}/{TELEGRAM_AUDIO_PREFIX}.{ext}"

    if slot == TELEGRAM_VIDEO_SLOT:
        ext = _normalize_binary_extension(filename, content_type, "mp4")
        return f"{_asset_prefix(influencer_id)}/{TELEGRAM_VIDEO_PREFIX}.{ext}"

    raise KeyError(f"Unsupported landing asset slot: {slot}")


async def upload_landing_image(
    file_obj,
    filename: str | None,
    content_type: str | None,
    influencer_id: str,
    slot: str,
) -> tuple[str, str]:
    key = build_landing_asset_key(influencer_id, slot)
    normalized_file, final_content_type = _convert_to_png(file_obj, filename, content_type)
    normalized_file.seek(0)
    s3_gateway.upload_fileobj(
        normalized_file,
        settings.BUCKET_NAME,
        key,
        content_type=final_content_type,
    )
    return key, final_content_type


async def upload_landing_poster_jpg(
    file_obj,
    filename: str | None,
    content_type: str | None,
    influencer_id: str,
    slot: str,
) -> tuple[str, str]:
    key = build_landing_asset_key(influencer_id, slot)
    normalized_file, final_content_type = _convert_to_jpeg(file_obj, filename, content_type)
    normalized_file.seek(0)
    s3_gateway.upload_fileobj(
        normalized_file,
        settings.BUCKET_NAME,
        key,
        content_type=final_content_type,
    )
    return key, final_content_type


async def upload_landing_binary(
    file_obj,
    filename: str | None,
    content_type: str | None,
    influencer_id: str,
    slot: str,
    *,
    fallback_extension: str,
) -> tuple[str, str]:
    normalized_type = (content_type or "").split(";", 1)[0].strip().lower() or None
    key = build_landing_asset_key(
        influencer_id,
        slot,
        filename=filename,
        content_type=normalized_type,
    )
    file_obj.seek(0)
    s3_gateway.upload_fileobj(
        file_obj,
        settings.BUCKET_NAME,
        key,
        content_type=normalized_type or f"application/octet-stream",
    )
    final_type = normalized_type
    if not final_type:
        ext = key.rsplit(".", 1)[-1].lower() if "." in key else fallback_extension
        if slot == TELEGRAM_AUDIO_SLOT:
            final_type = f"audio/{ext}"
        elif slot == TELEGRAM_VIDEO_SLOT:
            final_type = f"video/{ext}"
        else:
            final_type = f"video/{ext}"
    return key, final_type


def get_landing_asset_entry(meta_json: Mapping[str, object] | None, slot: str) -> dict | None:
    if not isinstance(meta_json, Mapping):
        return None
    value = meta_json.get(slot)
    return value if isinstance(value, dict) else None


def get_landing_asset_key(meta_json: Mapping[str, object] | None, slot: str) -> str | None:
    entry = get_landing_asset_entry(meta_json, slot)
    key = entry.get("s3_key") if entry else None
    return key if isinstance(key, str) and key else None


def get_presigned_url(key: str) -> str:
    return s3_gateway.generate_presigned_get_url(
        bucket=settings.BUCKET_NAME,
        key=key,
        expires=settings.S3_PRESIGNED_URL_TTL_SECONDS,
    )


async def object_exists(key: str) -> bool:
    return s3_gateway.object_exists(bucket=settings.BUCKET_NAME, key=key)


async def delete_asset(key: str) -> None:
    s3_gateway.delete_object(bucket=settings.BUCKET_NAME, key=key)
