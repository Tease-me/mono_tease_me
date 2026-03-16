"""Repository for influencer-character asset persistence."""

from __future__ import annotations

import io

from PIL import Image
import pillow_heif

from app.core.config import settings
from app.gateways import s3_gateway


def build_influencer_character_photo_key(influencer_id: str, character_id: int, ext: str) -> str:
    return f"{settings.INFLUENCER_PREFIX}/{influencer_id}/characters/{character_id}/photo.{ext}"


def build_influencer_character_video_key(influencer_id: str, character_id: int, ext: str) -> str:
    return f"{settings.INFLUENCER_PREFIX}/{influencer_id}/characters/{character_id}/video.{ext}"


def _is_heic(filename: str | None, content_type: str | None) -> bool:
    ext = (filename.rsplit(".", 1)[-1] if filename and "." in filename else "").lower()
    if ext in {"heic", "heif"}:
        return True
    if content_type:
        ct = content_type.lower().split(";", 1)[0].strip()
        if ct in {"image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"}:
            return True
    return False


def _normalize_image_ext(filename: str | None, content_type: str | None) -> str:
    ext = (filename.rsplit(".", 1)[-1] if filename and "." in filename else "").lower()
    if ext == "jpeg":
        return "jpg"
    if ext in {"jpg", "png", "webp", "heic", "heif"}:
        return ext if ext not in {"heic", "heif"} else "jpg"

    if content_type:
        ct = content_type.lower().split(";", 1)[0].strip()
        if ct == "image/jpeg":
            return "jpg"
        if ct == "image/png":
            return "png"
        if ct == "image/webp":
            return "webp"
        if ct in {"image/heic", "image/heif"}:
            return "jpg"

    return "jpg"


def _convert_heic_to_jpeg(
    file_obj,
    filename: str | None,
    content_type: str | None,
) -> tuple[io.BytesIO, str, str]:
    if not _is_heic(filename, content_type):
        return file_obj, content_type or "image/jpeg", _normalize_image_ext(filename, content_type)

    file_obj.seek(0)
    heif_file = pillow_heif.read_heif(file_obj)
    image = Image.frombytes(
        heif_file.mode,
        heif_file.size,
        heif_file.data,
        "raw",
    )

    if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
        image = image.convert("RGB")

    output = io.BytesIO()
    image.save(output, format="JPEG", quality=92)
    output.seek(0)
    return output, "image/jpeg", "jpg"


async def upload_influencer_character_photo(
    file_obj,
    filename: str | None,
    content_type: str,
    influencer_id: str,
    character_id: int,
) -> str:
    converted_file, final_content_type, ext = _convert_heic_to_jpeg(file_obj, filename, content_type)
    key = build_influencer_character_photo_key(influencer_id, character_id, ext)
    converted_file.seek(0)
    s3_gateway.upload_fileobj(
        converted_file,
        settings.BUCKET_NAME,
        key,
        content_type=final_content_type,
    )
    return key


async def upload_influencer_character_video(
    file_obj,
    filename: str | None,
    content_type: str,
    influencer_id: str,
    character_id: int,
) -> str:
    ext = (filename.rsplit(".", 1)[-1] if filename and "." in filename else "mp4").lower()
    key = build_influencer_character_video_key(influencer_id, character_id, ext)
    file_obj.seek(0)
    s3_gateway.upload_fileobj(
        file_obj,
        settings.BUCKET_NAME,
        key,
        content_type=content_type,
    )
    return key


async def delete_influencer_character_asset(key: str) -> None:
    s3_gateway.delete_object(bucket=settings.BUCKET_NAME, key=key)
