"""Repository for deterministic influencer-character asset storage."""

from __future__ import annotations

import io

from PIL import Image, UnidentifiedImageError
import pillow_heif

from app.core.config import settings
from app.gateways import s3_gateway


def _character_asset_prefix(influencer_id: str, character_id: int) -> str:
    return (
        f"{settings.INFLUENCER_BUCKET_PREFIX}/"
        f"{influencer_id}/characters/{character_id}"
    )


def build_influencer_character_photo_key(influencer_id: str, character_id: int) -> str:
    return f"{_character_asset_prefix(influencer_id, character_id)}/photo.png"


def build_influencer_character_photo_2x_key(influencer_id: str, character_id: int) -> str:
    return f"{_character_asset_prefix(influencer_id, character_id)}/photo@2x.png"


def build_influencer_character_video_mp4_key(influencer_id: str, character_id: int) -> str:
    return f"{_character_asset_prefix(influencer_id, character_id)}/video.mp4"


def build_influencer_character_video_webm_key(influencer_id: str, character_id: int) -> str:
    return f"{_character_asset_prefix(influencer_id, character_id)}/video.webm"


def build_influencer_character_video_preview_png_key(influencer_id: str, character_id: int) -> str:
    return f"{_character_asset_prefix(influencer_id, character_id)}/video.png"


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
    if not _is_heic(filename, content_type) and (content_type or "").split(";", 1)[0].strip().lower() == "image/png":
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


async def upload_influencer_character_photo(
    file_obj,
    filename: str | None,
    content_type: str | None,
    influencer_id: str,
    character_id: int,
    *,
    variant: str = "photo",
) -> str:
    normalized_file, final_content_type = _convert_to_png(file_obj, filename, content_type)
    key = (
        build_influencer_character_photo_key(influencer_id, character_id)
        if variant == "photo"
        else build_influencer_character_photo_2x_key(influencer_id, character_id)
    )
    normalized_file.seek(0)
    s3_gateway.upload_fileobj(
        normalized_file,
        settings.BUCKET_NAME,
        key,
        content_type=final_content_type,
    )
    return key


async def upload_influencer_character_video(
    file_obj,
    content_type: str,
    influencer_id: str,
    character_id: int,
    *,
    variant: str,
) -> str:
    key_builders = {
        "video_mp4": build_influencer_character_video_mp4_key,
        "video_webm": build_influencer_character_video_webm_key,
        "video_preview_png": build_influencer_character_video_preview_png_key,
    }
    key = key_builders[variant](influencer_id, character_id)
    file_obj.seek(0)
    s3_gateway.upload_fileobj(
        file_obj,
        settings.BUCKET_NAME,
        key,
        content_type=content_type,
    )
    return key


def get_influencer_character_asset_keys(influencer_id: str, character_id: int) -> dict[str, str]:
    return {
        "photo": build_influencer_character_photo_key(influencer_id, character_id),
        "photo_2x": build_influencer_character_photo_2x_key(influencer_id, character_id),
        "video_mp4": build_influencer_character_video_mp4_key(influencer_id, character_id),
        "video_webm": build_influencer_character_video_webm_key(influencer_id, character_id),
        "video_preview_png": build_influencer_character_video_preview_png_key(influencer_id, character_id),
    }


def get_influencer_character_asset_presence(influencer_id: str, character_id: int) -> dict[str, bool]:
    keys = get_influencer_character_asset_keys(influencer_id, character_id)
    return {
        name: s3_gateway.object_exists(bucket=settings.BUCKET_NAME, key=key)
        for name, key in keys.items()
    }


def get_influencer_character_asset_state(influencer_id: str, character_id: int) -> dict[str, str | bool | None]:
    keys = get_influencer_character_asset_keys(influencer_id, character_id)
    exists = get_influencer_character_asset_presence(influencer_id, character_id)
    return {
        "photo_url": s3_gateway.generate_presigned_get_url(bucket=settings.BUCKET_NAME, key=keys["photo"])
        if exists["photo"]
        else None,
        "photo_2x_url": s3_gateway.generate_presigned_get_url(bucket=settings.BUCKET_NAME, key=keys["photo_2x"])
        if exists["photo_2x"]
        else None,
        "video_mp4_url": s3_gateway.generate_presigned_get_url(bucket=settings.BUCKET_NAME, key=keys["video_mp4"])
        if exists["video_mp4"]
        else None,
        "video_webm_url": s3_gateway.generate_presigned_get_url(bucket=settings.BUCKET_NAME, key=keys["video_webm"])
        if exists["video_webm"]
        else None,
        "video_preview_png_url": s3_gateway.generate_presigned_get_url(
            bucket=settings.BUCKET_NAME,
            key=keys["video_preview_png"],
        )
        if exists["video_preview_png"]
        else None,
        "has_photo": exists["photo"] and exists["photo_2x"],
        "has_complete_video_set": (
            exists["video_mp4"] and exists["video_webm"] and exists["video_preview_png"]
        ),
    }


async def delete_influencer_character_asset(key: str) -> None:
    s3_gateway.delete_object(bucket=settings.BUCKET_NAME, key=key)
