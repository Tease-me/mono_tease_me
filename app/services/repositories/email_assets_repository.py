from __future__ import annotations

from io import BytesIO

from app.core.config import settings
from app.utils.storage.s3 import s3

EMAIL_ASSET_PREFIX = "email-assets"
RESET_PASSWORD_HEADER_KEY = f"{EMAIL_ASSET_PREFIX}/reset_password_header.jpg"


def get_email_asset_public_url(key: str) -> str:
    return f"{settings.BUCKET_PUBLIC_URL.rstrip('/')}/{key}"


async def upload_reset_password_header(file_obj: BytesIO) -> str:
    file_obj.seek(0)
    s3.upload_fileobj(
        file_obj,
        settings.PUBLIC_ASSET_BUCKET_NAME,
        RESET_PASSWORD_HEADER_KEY,
        ExtraArgs={"ContentType": "image/jpeg"},
    )
    return RESET_PASSWORD_HEADER_KEY


__all__ = [
    "RESET_PASSWORD_HEADER_KEY",
    "get_email_asset_public_url",
    "upload_reset_password_header",
]
