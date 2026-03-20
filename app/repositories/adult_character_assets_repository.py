"""Repository for deterministic base adult-character asset storage."""

from __future__ import annotations

import io

from PIL import Image, UnidentifiedImageError
import pillow_heif

from app.core.config import settings
from app.gateways import s3_gateway
from app.services.asset_cache_service import (
    get_cached_presence,
    get_cached_presigned_url,
    invalidate_presence,
    invalidate_presigned_url,
    set_cached_presence,
    set_cached_presigned_url,
)


def _adult_character_asset_prefix(character_id: int) -> str:
    return f"adult-characters/{character_id}"


def build_adult_character_default_artwork_key(character_id: int) -> str:
    return f"{_adult_character_asset_prefix(character_id)}/default-artwork.png"


def build_adult_character_lottie_key(character_id: int) -> str:
    return f"{_adult_character_asset_prefix(character_id)}/lottie.json"


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


async def upload_adult_character_default_artwork(
    file_obj,
    filename: str | None,
    content_type: str | None,
    character_id: int,
) -> str:
    normalized_file, final_content_type = _convert_to_png(file_obj, filename, content_type)
    key = build_adult_character_default_artwork_key(character_id)
    normalized_file.seek(0)
    s3_gateway.upload_fileobj(
        normalized_file,
        settings.BUCKET_NAME,
        key,
        content_type=final_content_type,
    )
    await invalidate_adult_character_asset_cache(character_id)
    return key


async def upload_adult_character_lottie(
    file_obj,
    character_id: int,
) -> str:
    key = build_adult_character_lottie_key(character_id)
    file_obj.seek(0)
    s3_gateway.upload_fileobj(
        file_obj,
        settings.BUCKET_NAME,
        key,
        content_type="application/json",
    )
    await invalidate_adult_character_asset_cache(character_id)
    return key


async def get_adult_character_asset_presence(
    character_id: int,
    default_artwork_key: str | None,
    lottie_text_key: str | None,
) -> dict[str, bool]:
    cache_key = str(character_id)
    cached = await get_cached_presence("adult_character", cache_key)
    if cached is not None:
        return {
            "default_artwork": bool(cached.get("default_artwork")),
            "lottie_text": bool(cached.get("lottie_text")),
        }

    prefix = _adult_character_asset_prefix(character_id)
    object_keys = set(s3_gateway.list_objects(bucket=settings.BUCKET_NAME, prefix=prefix))
    presence = {
        "default_artwork": bool(default_artwork_key) and default_artwork_key in object_keys,
        "lottie_text": bool(lottie_text_key) and lottie_text_key in object_keys,
    }
    await set_cached_presence("adult_character", cache_key, presence)
    return presence


async def _get_presigned_url_for_key(key: str) -> str:
    cached = await get_cached_presigned_url(key)
    if cached:
        return cached

    url = s3_gateway.generate_presigned_get_url(
        bucket=settings.BUCKET_NAME,
        key=key,
        expires=settings.S3_PRESIGNED_URL_TTL_SECONDS,
    )
    await set_cached_presigned_url(key, url)
    return url


async def get_adult_character_asset_state(
    character_id: int,
    default_artwork_key: str | None,
    lottie_text_key: str | None,
) -> dict[str, str | None]:
    presence = await get_adult_character_asset_presence(
        character_id,
        default_artwork_key,
        lottie_text_key,
    )
    return {
        "default_artwork_url": await _get_presigned_url_for_key(default_artwork_key)
        if presence["default_artwork"] and default_artwork_key
        else None,
        "lottie_text_url": await _get_presigned_url_for_key(lottie_text_key)
        if presence["lottie_text"] and lottie_text_key
        else None,
    }


async def invalidate_adult_character_asset_cache(character_id: int) -> None:
    await invalidate_presence("adult_character", str(character_id))
    await invalidate_presigned_url(build_adult_character_default_artwork_key(character_id))
    await invalidate_presigned_url(build_adult_character_lottie_key(character_id))
