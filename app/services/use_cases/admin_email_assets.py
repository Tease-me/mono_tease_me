from __future__ import annotations

import io
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.data.schemas.admin import AdminEmailAssetOut
from app.services.repositories.email_assets_repository import (
    RESET_PASSWORD_HEADER_KEY,
    get_email_asset_public_url,
    upload_reset_password_header,
)

_ALLOWED_EXTENSIONS = {".jpg", ".jpeg"}
_ALLOWED_CONTENT_TYPES = {"image/jpeg"}


def _is_allowed_jpeg_upload(upload: UploadFile) -> bool:
    content_type = (upload.content_type or "").split(";", 1)[0].strip().lower()
    suffix = Path(upload.filename or "").suffix.lower()
    return content_type in _ALLOWED_CONTENT_TYPES or suffix in _ALLOWED_EXTENSIONS


async def upload_admin_reset_password_header(
    reset_password_header: UploadFile,
) -> AdminEmailAssetOut:
    if not _is_allowed_jpeg_upload(reset_password_header):
        raise HTTPException(
            status_code=400,
            detail="Reset password header must be a JPG or JPEG image",
        )

    file_bytes = await reset_password_header.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty reset password header file")

    s3_key = await upload_reset_password_header(io.BytesIO(file_bytes))
    return AdminEmailAssetOut(
        ok=True,
        reset_password_header_key=s3_key,
        reset_password_header_url=get_email_asset_public_url(s3_key),
        content_type="image/jpeg",
    )


async def get_admin_email_assets() -> AdminEmailAssetOut:
    return AdminEmailAssetOut(
        ok=True,
        reset_password_header_key=RESET_PASSWORD_HEADER_KEY,
        reset_password_header_url=get_email_asset_public_url(RESET_PASSWORD_HEADER_KEY),
        content_type="image/jpeg",
    )


__all__ = ["get_admin_email_assets", "upload_admin_reset_password_header"]
