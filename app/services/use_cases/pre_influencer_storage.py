from __future__ import annotations

import uuid

from app.core.config import settings
from app.services.gateways import s3_gateway

PRE_INFLUENCER_AUDIO_PREFIX = "pre-influencers/{pre_id}/audio/"


def _normalize_ext(filename: str | None, default: str = "webm") -> str:
    if filename and "." in filename:
        return filename.rsplit(".", 1)[-1].lower()
    return default


def build_audio_key(pre_id: str, filename: str | None) -> str:
    ext = _normalize_ext(filename)
    prefix = PRE_INFLUENCER_AUDIO_PREFIX.format(pre_id=pre_id)
    return f"{prefix}{uuid.uuid4()}.{ext}"


def audio_prefix(pre_id: str) -> str:
    return PRE_INFLUENCER_AUDIO_PREFIX.format(pre_id=pre_id)


def is_audio_key_for_pre_influencer(pre_id: str, key: str) -> bool:
    return key.startswith(audio_prefix(pre_id))


async def save_audio(
    file_obj,
    filename: str | None,
    content_type: str,
    pre_id: str,
) -> str:
    key = build_audio_key(pre_id, filename)
    file_obj.seek(0)
    s3_gateway.upload_fileobj(
        file_obj,
        settings.BUCKET_NAME,
        key,
        content_type=content_type,
    )
    return key


async def list_audio_keys(pre_id: str) -> list[str]:
    return s3_gateway.list_objects(
        bucket=settings.BUCKET_NAME,
        prefix=audio_prefix(pre_id),
    )


def generate_audio_download_url(key: str, expires: int = 3600) -> str:
    return s3_gateway.generate_presigned_get_url(
        bucket=settings.BUCKET_NAME,
        key=key,
        expires=expires,
    )


async def delete_audio(pre_id: str, key: str) -> None:
    if not is_audio_key_for_pre_influencer(pre_id, key):
        raise ValueError("Invalid audio key for this pre-influencer")
    s3_gateway.delete_object(bucket=settings.BUCKET_NAME, key=key)
