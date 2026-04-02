from __future__ import annotations

from io import BytesIO
from typing import Any

from app.core.config import settings
from app.utils.storage.s3 import s3

VERIFICATION_EMAIL_HEADER_SLOT = "verification_email_header"


def build_influencer_email_header_key(influencer_id: str) -> str:
    return f"{settings.INFLUENCER_BUCKET_PREFIX}/{influencer_id}/email/verification-header.jpg"


def get_influencer_email_header_entry(
    assets_json: dict[str, Any] | None,
) -> dict[str, Any] | None:
    if not isinstance(assets_json, dict):
        return None
    entry = assets_json.get(VERIFICATION_EMAIL_HEADER_SLOT)
    return entry if isinstance(entry, dict) else None


def get_influencer_email_header_key(
    assets_json: dict[str, Any] | None,
) -> str | None:
    entry = get_influencer_email_header_entry(assets_json)
    s3_key = entry.get("s3_key") if entry else None
    return s3_key if isinstance(s3_key, str) and s3_key else None


def get_influencer_email_header_public_url(s3_key: str) -> str:
    return f"{settings.BUCKET_PUBLIC_URL.rstrip('/')}/{s3_key}"


async def upload_influencer_email_header(
    file_obj: BytesIO,
    influencer_id: str,
) -> tuple[str, str]:
    key = build_influencer_email_header_key(influencer_id)
    file_obj.seek(0)
    s3.upload_fileobj(
        file_obj,
        settings.PUBLIC_ASSET_BUCKET_NAME,
        key,
        ExtraArgs={"ContentType": "image/jpeg"},
    )
    return key, "image/jpeg"


__all__ = [
    "VERIFICATION_EMAIL_HEADER_SLOT",
    "build_influencer_email_header_key",
    "get_influencer_email_header_entry",
    "get_influencer_email_header_key",
    "get_influencer_email_header_public_url",
    "upload_influencer_email_header",
]
