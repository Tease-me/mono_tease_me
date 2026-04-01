from __future__ import annotations

import asyncio
from io import BytesIO
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.admin import email_assets as email_assets_route
from app.services.email import header_images
from app.services.repositories import email_assets_repository as email_asset_repo
from app.services.use_cases import admin_email_assets as email_asset_use_case
from app.utils.auth.dependencies import get_current_user


class DummyUploadFile:
    def __init__(self, data: bytes, *, filename: str, content_type: str | None) -> None:
        self._data = data
        self.filename = filename
        self.content_type = content_type

    async def read(self) -> bytes:
        return self._data


def test_upload_reset_password_header_uses_fixed_s3_key(monkeypatch) -> None:
    captured = {}

    class FakeS3Client:
        def upload_fileobj(self, file_obj, bucket, key, extra_args=None, **kwargs) -> None:
            captured["body"] = file_obj.read()
            captured["bucket"] = bucket
            captured["key"] = key
            captured["extra_args"] = extra_args if extra_args is not None else kwargs.get("ExtraArgs")

    monkeypatch.setattr(email_asset_repo, "s3", FakeS3Client())

    key = asyncio.run(email_asset_repo.upload_reset_password_header(BytesIO(b"jpeg-bytes")))

    assert key == "email-assets/reset_password_header.jpg"
    assert captured["body"] == b"jpeg-bytes"
    assert captured["bucket"] == email_asset_repo.settings.PUBLIC_ASSET_BUCKET_NAME
    assert captured["key"] == "email-assets/reset_password_header.jpg"
    assert captured["extra_args"] == {"ContentType": "image/jpeg"}


@pytest.mark.anyio
async def test_upload_admin_reset_password_header_rejects_non_jpeg() -> None:
    with pytest.raises(email_asset_use_case.HTTPException) as exc_info:
        await email_asset_use_case.upload_admin_reset_password_header(
            DummyUploadFile(b"png-bytes", filename="reset.png", content_type="image/png")
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Reset password header must be a JPG or JPEG image"


@pytest.mark.anyio
async def test_upload_admin_reset_password_header_returns_fixed_public_url(monkeypatch) -> None:
    async def fake_upload_reset_password_header(file_obj: BytesIO) -> str:
        assert file_obj.read() == b"jpeg-bytes"
        return "email-assets/reset_password_header.jpg"

    monkeypatch.setattr(
        email_asset_use_case,
        "upload_reset_password_header",
        fake_upload_reset_password_header,
    )

    result = await email_asset_use_case.upload_admin_reset_password_header(
        DummyUploadFile(
            b"jpeg-bytes",
            filename="reset.jpg",
            content_type="image/jpeg",
        )
    )

    assert result.model_dump() == {
        "ok": True,
        "reset_password_header_key": "email-assets/reset_password_header.jpg",
        "reset_password_header_url": (
            f"{email_asset_use_case.get_email_asset_public_url('email-assets/reset_password_header.jpg')}"
        ),
        "content_type": "image/jpeg",
    }


@pytest.mark.anyio
async def test_get_admin_email_assets_returns_fixed_public_url() -> None:
    result = await email_asset_use_case.get_admin_email_assets()

    assert result.model_dump() == {
        "ok": True,
        "reset_password_header_key": "email-assets/reset_password_header.jpg",
        "reset_password_header_url": (
            f"{email_asset_use_case.get_email_asset_public_url('email-assets/reset_password_header.jpg')}"
        ),
        "content_type": "image/jpeg",
    }


def test_get_email_assets_route_success(monkeypatch) -> None:
    app = FastAPI()
    app.include_router(email_assets_route.router, prefix="/admin")

    async def _override_current_user():
        return SimpleNamespace(id=1)

    async def _fake_get_admin_email_assets():
        return {
            "ok": True,
            "reset_password_header_key": "email-assets/reset_password_header.jpg",
            "reset_password_header_url": "https://cdn.test/email-assets/reset_password_header.jpg",
            "content_type": "image/jpeg",
        }

    app.dependency_overrides[get_current_user] = _override_current_user
    monkeypatch.setattr(
        email_assets_route,
        "get_admin_email_assets",
        _fake_get_admin_email_assets,
    )

    client = TestClient(app)
    response = client.get("/admin/email-assets")

    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "reset_password_header_key": "email-assets/reset_password_header.jpg",
        "reset_password_header_url": "https://cdn.test/email-assets/reset_password_header.jpg",
        "content_type": "image/jpeg",
    }


def test_get_email_assets_route_rejects_non_admin() -> None:
    app = FastAPI()
    app.include_router(email_assets_route.router, prefix="/admin")

    async def _override_current_user():
        return SimpleNamespace(id=2)

    app.dependency_overrides[get_current_user] = _override_current_user

    client = TestClient(app)
    response = client.get("/admin/email-assets")

    assert response.status_code == 403
    assert response.json() == {"detail": "Admin only"}


def test_post_email_assets_route_success(monkeypatch) -> None:
    app = FastAPI()
    app.include_router(email_assets_route.router, prefix="/admin")

    async def _override_current_user():
        return SimpleNamespace(id=1)

    async def _fake_upload_admin_reset_password_header(reset_password_header):
        assert reset_password_header.filename == "reset.jpg"
        assert reset_password_header.content_type == "image/jpeg"
        return {
            "ok": True,
            "reset_password_header_key": "email-assets/reset_password_header.jpg",
            "reset_password_header_url": "https://cdn.test/email-assets/reset_password_header.jpg",
            "content_type": "image/jpeg",
        }

    app.dependency_overrides[get_current_user] = _override_current_user
    monkeypatch.setattr(
        email_assets_route,
        "upload_admin_reset_password_header",
        _fake_upload_admin_reset_password_header,
    )

    client = TestClient(app)
    response = client.post(
        "/admin/email-assets",
        files={"reset_password_header": ("reset.jpg", b"jpeg-bytes", "image/jpeg")},
    )

    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "reset_password_header_key": "email-assets/reset_password_header.jpg",
        "reset_password_header_url": "https://cdn.test/email-assets/reset_password_header.jpg",
        "content_type": "image/jpeg",
    }


def test_post_email_assets_route_rejects_non_admin() -> None:
    app = FastAPI()
    app.include_router(email_assets_route.router, prefix="/admin")

    async def _override_current_user():
        return SimpleNamespace(id=2)

    app.dependency_overrides[get_current_user] = _override_current_user

    client = TestClient(app)
    response = client.post(
        "/admin/email-assets",
        files={"reset_password_header": ("reset.jpg", b"jpeg-bytes", "image/jpeg")},
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "Admin only"}


def test_post_email_assets_route_requires_file() -> None:
    app = FastAPI()
    app.include_router(email_assets_route.router, prefix="/admin")

    async def _override_current_user():
        return SimpleNamespace(id=1)

    app.dependency_overrides[get_current_user] = _override_current_user

    client = TestClient(app)
    response = client.post("/admin/email-assets")

    assert response.status_code == 422


def test_email_reset_header_url_points_to_fixed_jpg_asset() -> None:
    assert header_images.EMAIL_RESET_HEADER_URL == (
        f"{email_asset_repo.settings.BUCKET_PUBLIC_URL.rstrip('/')}/email-assets/reset_password_header.jpg"
    )
