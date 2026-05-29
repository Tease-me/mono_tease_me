from __future__ import annotations

import uuid

from app.core.config import settings
from app.services.gateways import s3_gateway

PRE_INFLUENCER_AUDIO_PREFIX = "pre-influencers/{owner}/audio/"


def _normalize_ext(filename: str | None, default: str = "webm") -> str:
    if filename and "." in filename:
        return filename.rsplit(".", 1)[-1].lower()
    return default


def build_audio_key(owner: str, filename: str | None) -> str:
    ext = _normalize_ext(filename)
    prefix = PRE_INFLUENCER_AUDIO_PREFIX.format(owner=owner)
    return f"{prefix}{uuid.uuid4()}.{ext}"


def audio_prefix(owner: str) -> str:
    return PRE_INFLUENCER_AUDIO_PREFIX.format(owner=owner)


def is_audio_key_for_pre_influencer(owner: str, key: str) -> bool:
    return key.startswith(audio_prefix(owner))


def is_audio_key_for_pre_influencer_owner(
    key: str,
    *,
    username: str | None,
    legacy_pre_id: str | None = None,
) -> bool:
    if username and is_audio_key_for_pre_influencer(username, key):
        return True
    if legacy_pre_id and is_audio_key_for_pre_influencer(legacy_pre_id, key):
        return True
    return False


async def save_audio(
    file_obj,
    filename: str | None,
    content_type: str,
    owner: str,
) -> str:
    key = build_audio_key(owner, filename)
    file_obj.seek(0)
    s3_gateway.upload_fileobj(
        file_obj,
        settings.BUCKET_NAME,
        key,
        content_type=content_type,
    )
    return key


async def list_audio_keys(owner: str) -> list[str]:
    return s3_gateway.list_objects(
        bucket=settings.BUCKET_NAME,
        prefix=audio_prefix(owner),
    )


async def list_audio_keys_with_legacy_id(
    username: str | None,
    legacy_pre_id: str | None = None,
) -> list[str]:
    normalized_username = username.strip() if username else None
    if normalized_username:
        keys = await list_audio_keys(normalized_username)
        if keys:
            return keys
    if legacy_pre_id:
        return await list_audio_keys(legacy_pre_id)
    return []


def generate_audio_download_url(key: str, expires: int = 3600) -> str:
    return s3_gateway.generate_presigned_get_url(
        bucket=settings.BUCKET_NAME,
        key=key,
        expires=expires,
    )


async def delete_audio(
    owner: str,
    key: str,
    *,
    legacy_pre_id: str | None = None,
) -> None:
    if not is_audio_key_for_pre_influencer_owner(
        key,
        username=owner,
        legacy_pre_id=legacy_pre_id,
    ):
        raise ValueError("Invalid audio key for this pre-influencer")
    s3_gateway.delete_object(bucket=settings.BUCKET_NAME, key=key)
