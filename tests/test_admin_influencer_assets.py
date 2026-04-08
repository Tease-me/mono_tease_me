from __future__ import annotations

import asyncio
from io import BytesIO
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.api.admin import influencer_assets as admin_influencer_assets_route
from app.api.routes import influencer as influencer_route
from app.core.session import get_db
from app.data.models import Influencer
from app.services.repositories import influencer_email_assets_repository as email_asset_repo
from app.services.repositories import influencer_landing_assets_repository as asset_repo
from app.services.use_cases import admin_influencer_assets as asset_use_case
from app.utils.auth.dependencies import get_current_user


class DummyUploadFile:
    def __init__(self, data: bytes, *, filename: str, content_type: str | None) -> None:
        self._data = data
        self.filename = filename
        self.content_type = content_type

    async def read(self) -> bytes:
        return self._data


class DummySession:
    def __init__(self) -> None:
        self.added = []
        self.commits = 0
        self.refreshes = 0
        self.rollbacks = 0

    def add(self, value) -> None:
        self.added.append(value)

    async def commit(self) -> None:
        self.commits += 1

    async def refresh(self, value) -> None:
        self.refreshes += 1

    async def rollback(self) -> None:
        self.rollbacks += 1

    async def get(self, model, key):
        if model is Influencer:
            return SimpleNamespace(id=key, assets_json={})
        return None


def test_build_landing_asset_key_uses_telegram_audio_prefix() -> None:
    key = asset_repo.build_landing_asset_key(
        "inf_123",
        asset_repo.TELEGRAM_AUDIO_SLOT,
        filename="welcome.mp3",
        content_type="audio/mpeg",
    )

    assert key.endswith("/telegram/welcome-audio.mp3")


def test_build_landing_asset_key_uses_telegram_video_prefix() -> None:
    key = asset_repo.build_landing_asset_key(
        "inf_123",
        asset_repo.TELEGRAM_VIDEO_SLOT,
        filename="welcome.mp4",
        content_type="video/mp4",
    )

    assert key.endswith("/telegram/welcome-video.mp4")


def test_build_influencer_email_header_key_uses_fixed_prefix() -> None:
    key = email_asset_repo.build_influencer_email_header_key("juliana")

    assert key.endswith("/juliana/email/verification-header.jpg")


def test_upload_influencer_email_header_uses_public_asset_bucket(monkeypatch) -> None:
    captured = {}

    class FakeS3Client:
        def upload_fileobj(self, file_obj, bucket, key, extra_args=None, **kwargs) -> None:
            captured["body"] = file_obj.read()
            captured["bucket"] = bucket
            captured["key"] = key
            captured["extra_args"] = (
                extra_args if extra_args is not None else kwargs.get("ExtraArgs")
            )

    monkeypatch.setattr(email_asset_repo, "s3", FakeS3Client())

    key, content_type = asyncio.run(
        email_asset_repo.upload_influencer_email_header(
            BytesIO(b"jpeg-bytes"),
            "juliana",
        )
    )

    assert key == "influencer/juliana/email/verification-header.jpg"
    assert content_type == "image/jpeg"
    assert captured["body"] == b"jpeg-bytes"
    assert captured["bucket"] == email_asset_repo.settings.PUBLIC_ASSET_BUCKET_NAME
    assert captured["key"] == "influencer/juliana/email/verification-header.jpg"
    assert captured["extra_args"] == {"ContentType": "image/jpeg"}


def test_build_admin_influencer_email_header_out_returns_missing_asset() -> None:
    influencer = SimpleNamespace(id="juliana", assets_json={})

    result = asyncio.run(asset_use_case.build_admin_influencer_email_header_out(influencer))

    assert result == {
        "influencer_id": "juliana",
        "verification_email_header_key": None,
        "verification_email_header_url": None,
        "content_type": None,
        "has_verification_email_header": False,
        "updated_at": None,
    }


def test_build_admin_influencer_email_header_out_returns_existing_asset() -> None:
    influencer = SimpleNamespace(
        id="juliana",
        assets_json={
            email_asset_repo.VERIFICATION_EMAIL_HEADER_SLOT: {
                "s3_key": "influencer/juliana/email/verification-header.jpg",
                "content_type": "image/jpeg",
                "updated_at": "2026-04-01T12:00:00+00:00",
            }
        },
    )

    result = asyncio.run(asset_use_case.build_admin_influencer_email_header_out(influencer))

    assert result == {
        "influencer_id": "juliana",
        "verification_email_header_key": "influencer/juliana/email/verification-header.jpg",
        "verification_email_header_url": (
            "https://bucket-image-tease-me.s3.us-east-1.amazonaws.com/"
            "influencer/juliana/email/verification-header.jpg"
        ),
        "content_type": "image/jpeg",
        "has_verification_email_header": True,
        "updated_at": "2026-04-01T12:00:00+00:00",
    }


def test_upsert_admin_influencer_email_header_updates_assets_json(monkeypatch) -> None:
    influencer = SimpleNamespace(id="juliana", assets_json={})
    db = DummySession()

    async def fake_upload_influencer_email_header(file_obj, influencer_id):
        assert isinstance(file_obj, BytesIO)
        assert file_obj.read() == b"jpeg-bytes"
        assert influencer_id == "juliana"
        return "influencer/juliana/email/verification-header.jpg", "image/jpeg"

    monkeypatch.setattr(
        asset_use_case,
        "upload_influencer_email_header",
        fake_upload_influencer_email_header,
    )
    monkeypatch.setattr(asset_use_case, "_utcnow_iso", lambda: "2026-04-01T12:00:00+00:00")

    result = asyncio.run(
        asset_use_case.upsert_admin_influencer_email_header(
            db=db,
            influencer=influencer,
            verification_email_header=DummyUploadFile(
                b"jpeg-bytes",
                filename="header.jpg",
                content_type="image/jpeg",
            ),
        )
    )

    assert influencer.assets_json == {
        email_asset_repo.VERIFICATION_EMAIL_HEADER_SLOT: {
            "s3_key": "influencer/juliana/email/verification-header.jpg",
            "content_type": "image/jpeg",
            "updated_at": "2026-04-01T12:00:00+00:00",
        }
    }
    assert db.commits == 1
    assert result["verification_email_header_key"] == "influencer/juliana/email/verification-header.jpg"


def test_get_influencer_email_header_route_success(monkeypatch) -> None:
    app = FastAPI()
    app.include_router(admin_influencer_assets_route.router, prefix="/admin")

    async def _override_current_user():
        return SimpleNamespace(id=1)

    class _Session:
        async def get(self, model, key):
            if model is Influencer:
                return SimpleNamespace(id=key, assets_json={})
            return None

    async def _override_db():
        yield _Session()

    async def _fake_build_admin_influencer_email_header_out(influencer):
        assert influencer.id == "juliana"
        return {
            "influencer_id": "juliana",
            "verification_email_header_key": "influencer/juliana/email/verification-header.jpg",
            "verification_email_header_url": "https://cdn.test/influencer/juliana/email/verification-header.jpg",
            "content_type": "image/jpeg",
            "has_verification_email_header": True,
            "updated_at": "2026-04-01T12:00:00+00:00",
        }

    app.dependency_overrides[get_current_user] = _override_current_user
    app.dependency_overrides[get_db] = _override_db
    monkeypatch.setattr(
        admin_influencer_assets_route,
        "build_admin_influencer_email_header_out",
        _fake_build_admin_influencer_email_header_out,
    )

    client = TestClient(app)
    response = client.get("/admin/influencer/juliana/email-header")

    assert response.status_code == 200
    assert response.json()["has_verification_email_header"] is True


def test_get_influencer_email_header_route_returns_404() -> None:
    app = FastAPI()
    app.include_router(admin_influencer_assets_route.router, prefix="/admin")

    async def _override_current_user():
        return SimpleNamespace(id=1)

    class _Session:
        async def get(self, model, key):
            return None

    async def _override_db():
        yield _Session()

    app.dependency_overrides[get_current_user] = _override_current_user
    app.dependency_overrides[get_db] = _override_db

    client = TestClient(app)
    response = client.get("/admin/influencer/missing/email-header")

    assert response.status_code == 404
    assert response.json() == {"detail": "Influencer not found"}


def test_get_influencer_email_header_route_rejects_non_admin() -> None:
    app = FastAPI()
    app.include_router(admin_influencer_assets_route.router, prefix="/admin")

    async def _override_current_user():
        return SimpleNamespace(id=2)

    app.dependency_overrides[get_current_user] = _override_current_user

    client = TestClient(app)
    response = client.get("/admin/influencer/juliana/email-header")

    assert response.status_code == 403
    assert response.json() == {"detail": "Admin only"}


def test_post_influencer_email_header_route_success(monkeypatch) -> None:
    app = FastAPI()
    app.include_router(admin_influencer_assets_route.router, prefix="/admin")

    async def _override_current_user():
        return SimpleNamespace(id=1)

    class _Session:
        async def get(self, model, key):
            if model is Influencer:
                return SimpleNamespace(id=key, assets_json={})
            return None

    async def _override_db():
        yield _Session()

    async def _fake_upsert_admin_influencer_email_header(db, influencer, verification_email_header):
        assert influencer.id == "juliana"
        assert verification_email_header.filename == "header.jpg"
        return {
            "influencer_id": "juliana",
            "verification_email_header_key": "influencer/juliana/email/verification-header.jpg",
            "verification_email_header_url": "https://cdn.test/influencer/juliana/email/verification-header.jpg",
            "content_type": "image/jpeg",
            "has_verification_email_header": True,
            "updated_at": "2026-04-01T12:00:00+00:00",
        }

    app.dependency_overrides[get_current_user] = _override_current_user
    app.dependency_overrides[get_db] = _override_db
    monkeypatch.setattr(
        admin_influencer_assets_route,
        "upsert_admin_influencer_email_header",
        _fake_upsert_admin_influencer_email_header,
    )

    client = TestClient(app)
    response = client.post(
        "/admin/influencer/juliana/email-header",
        files={"verification_email_header": ("header.jpg", b"jpeg-bytes", "image/jpeg")},
    )

    assert response.status_code == 200
    assert response.json()["verification_email_header_key"] == "influencer/juliana/email/verification-header.jpg"


def test_post_influencer_email_header_route_rejects_non_admin() -> None:
    app = FastAPI()
    app.include_router(admin_influencer_assets_route.router, prefix="/admin")

    async def _override_current_user():
        return SimpleNamespace(id=2)

    app.dependency_overrides[get_current_user] = _override_current_user

    client = TestClient(app)
    response = client.post(
        "/admin/influencer/juliana/email-header",
        files={"verification_email_header": ("header.jpg", b"jpeg-bytes", "image/jpeg")},
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "Admin only"}


def test_post_influencer_email_header_route_requires_file() -> None:
    app = FastAPI()
    app.include_router(admin_influencer_assets_route.router, prefix="/admin")

    async def _override_current_user():
        return SimpleNamespace(id=1)

    app.dependency_overrides[get_current_user] = _override_current_user

    client = TestClient(app)
    response = client.post("/admin/influencer/juliana/email-header")

    assert response.status_code == 422


def test_build_admin_telegram_welcome_media_out_returns_both_assets(monkeypatch) -> None:
    influencer = SimpleNamespace(
        id="inf_123",
        assets_json={
            asset_repo.TELEGRAM_AUDIO_SLOT: {
                "s3_key": "bucket/audio.mp3",
                "content_type": "audio/mpeg",
                "updated_at": "2026-03-24T00:00:00+00:00",
            },
            asset_repo.TELEGRAM_VIDEO_SLOT: {
                "s3_key": "bucket/video.mp4",
                "content_type": "video/mp4",
                "updated_at": "2026-03-24T01:00:00+00:00",
            },
        },
    )
    monkeypatch.setattr(
        asset_use_case,
        "get_landing_asset_presence",
        _async_return(
            {
                asset_repo.TELEGRAM_AUDIO_SLOT: True,
                asset_repo.TELEGRAM_VIDEO_SLOT: True,
                asset_repo.LEGACY_TELEGRAM_MEDIA_SLOT: False,
            }
        ),
    )
    monkeypatch.setattr(
        asset_use_case,
        "get_cached_presigned_url_for_key",
        _async_prefix("https://cdn.test/"),
    )

    result = asyncio.run(asset_use_case.build_admin_telegram_welcome_media_out(influencer))

    assert result == {
        "influencer_id": "inf_123",
        "telegram_audio_key": "bucket/audio.mp3",
        "telegram_audio_url": "https://cdn.test/bucket/audio.mp3",
        "telegram_audio_content_type": "audio/mpeg",
        "telegram_video_key": "bucket/video.mp4",
        "telegram_video_url": "https://cdn.test/bucket/video.mp4",
        "telegram_video_content_type": "video/mp4",
        "has_audio": True,
        "has_video": True,
        "updated_at": "2026-03-24T01:00:00+00:00",
    }


def test_build_admin_telegram_welcome_media_out_reads_legacy_video_slot(monkeypatch) -> None:
    influencer = SimpleNamespace(
        id="inf_123",
        assets_json={
            asset_repo.LEGACY_TELEGRAM_MEDIA_SLOT: {
                "s3_key": "bucket/legacy-video.mp4",
                "content_type": "video/mp4",
                "updated_at": "2026-03-24T00:00:00+00:00",
            }
        },
    )
    monkeypatch.setattr(
        asset_use_case,
        "get_landing_asset_presence",
        _async_return(
            {
                asset_repo.TELEGRAM_AUDIO_SLOT: False,
                asset_repo.TELEGRAM_VIDEO_SLOT: False,
                asset_repo.LEGACY_TELEGRAM_MEDIA_SLOT: True,
            }
        ),
    )
    monkeypatch.setattr(
        asset_use_case,
        "get_cached_presigned_url_for_key",
        _async_prefix("https://cdn.test/"),
    )

    result = asyncio.run(asset_use_case.build_admin_telegram_welcome_media_out(influencer))

    assert result["telegram_audio_key"] is None
    assert result["telegram_video_key"] == "bucket/legacy-video.mp4"
    assert result["has_audio"] is False
    assert result["has_video"] is True


def test_upsert_admin_telegram_welcome_media_updates_audio_only(monkeypatch) -> None:
    influencer = SimpleNamespace(
        id="inf_123",
        assets_json={
            asset_repo.TELEGRAM_VIDEO_SLOT: {
                "s3_key": "bucket/video.mp4",
                "content_type": "video/mp4",
                "updated_at": "2026-03-24T00:00:00+00:00",
            }
        },
    )
    db = DummySession()
    deleted_keys: list[str] = []

    async def fake_upload_landing_binary(file_obj, filename, content_type, influencer_id, slot, *, fallback_extension):
        assert isinstance(file_obj, BytesIO)
        assert filename == "welcome.mp3"
        assert content_type == "audio/mpeg"
        assert influencer_id == "inf_123"
        assert slot == asset_repo.TELEGRAM_AUDIO_SLOT
        assert fallback_extension == "mp3"
        return "bucket/audio.mp3", "audio/mpeg"

    monkeypatch.setattr(asset_use_case, "upload_landing_binary", fake_upload_landing_binary)
    monkeypatch.setattr(asset_use_case, "delete_asset", _record_delete(deleted_keys))
    monkeypatch.setattr(asset_use_case, "invalidate_landing_asset_cache", _async_noop())
    monkeypatch.setattr(
        asset_use_case,
        "get_landing_asset_presence",
        _async_return(
            {
                asset_repo.TELEGRAM_AUDIO_SLOT: True,
                asset_repo.TELEGRAM_VIDEO_SLOT: True,
                asset_repo.LEGACY_TELEGRAM_MEDIA_SLOT: False,
            }
        ),
    )
    monkeypatch.setattr(
        asset_use_case,
        "get_cached_presigned_url_for_key",
        _async_prefix("https://cdn.test/"),
    )
    monkeypatch.setattr(asset_use_case, "_utcnow_iso", lambda: "2026-03-24T01:02:03+00:00")

    result = asyncio.run(
        asset_use_case.upsert_admin_telegram_welcome_media(
            db=db,
            influencer=influencer,
            audio=DummyUploadFile(b"audio-bytes", filename="welcome.mp3", content_type="audio/mpeg"),
            video=None,
        )
    )

    assert influencer.assets_json == {
        asset_repo.TELEGRAM_VIDEO_SLOT: {
            "s3_key": "bucket/video.mp4",
            "content_type": "video/mp4",
            "updated_at": "2026-03-24T00:00:00+00:00",
        },
        asset_repo.TELEGRAM_AUDIO_SLOT: {
            "s3_key": "bucket/audio.mp3",
            "content_type": "audio/mpeg",
            "updated_at": "2026-03-24T01:02:03+00:00",
        },
    }
    assert db.commits == 1
    assert deleted_keys == []
    assert result["telegram_audio_key"] == "bucket/audio.mp3"
    assert result["telegram_video_key"] == "bucket/video.mp4"


def test_upsert_admin_telegram_welcome_media_updates_video_and_removes_legacy_slot(monkeypatch) -> None:
    influencer = SimpleNamespace(
        id="inf_123",
        assets_json={
            asset_repo.TELEGRAM_AUDIO_SLOT: {
                "s3_key": "bucket/audio.mp3",
                "content_type": "audio/mpeg",
                "updated_at": "2026-03-24T00:00:00+00:00",
            },
            asset_repo.LEGACY_TELEGRAM_MEDIA_SLOT: {
                "s3_key": "bucket/legacy-video.mp4",
                "content_type": "video/mp4",
                "updated_at": "2026-03-24T00:30:00+00:00",
            },
        },
    )
    db = DummySession()
    deleted_keys: list[str] = []

    async def fake_upload_landing_binary(file_obj, filename, content_type, influencer_id, slot, *, fallback_extension):
        assert isinstance(file_obj, BytesIO)
        assert filename == "welcome.mp4"
        assert content_type == "video/mp4"
        assert influencer_id == "inf_123"
        assert slot == asset_repo.TELEGRAM_VIDEO_SLOT
        assert fallback_extension == "mp4"
        return "bucket/video.mp4", "video/mp4"

    monkeypatch.setattr(asset_use_case, "upload_landing_binary", fake_upload_landing_binary)
    monkeypatch.setattr(asset_use_case, "delete_asset", _record_delete(deleted_keys))
    monkeypatch.setattr(asset_use_case, "invalidate_landing_asset_cache", _async_noop())
    monkeypatch.setattr(
        asset_use_case,
        "get_landing_asset_presence",
        _async_return(
            {
                asset_repo.TELEGRAM_AUDIO_SLOT: True,
                asset_repo.TELEGRAM_VIDEO_SLOT: True,
                asset_repo.LEGACY_TELEGRAM_MEDIA_SLOT: False,
            }
        ),
    )
    monkeypatch.setattr(
        asset_use_case,
        "get_cached_presigned_url_for_key",
        _async_prefix("https://cdn.test/"),
    )
    monkeypatch.setattr(asset_use_case, "_utcnow_iso", lambda: "2026-03-24T01:02:03+00:00")

    result = asyncio.run(
        asset_use_case.upsert_admin_telegram_welcome_media(
            db=db,
            influencer=influencer,
            audio=None,
            video=DummyUploadFile(b"video-bytes", filename="welcome.mp4", content_type="video/mp4"),
        )
    )

    assert asset_repo.LEGACY_TELEGRAM_MEDIA_SLOT not in influencer.assets_json
    assert influencer.assets_json[asset_repo.TELEGRAM_VIDEO_SLOT]["s3_key"] == "bucket/video.mp4"
    assert deleted_keys == ["bucket/legacy-video.mp4"]
    assert result["telegram_audio_key"] == "bucket/audio.mp3"
    assert result["telegram_video_key"] == "bucket/video.mp4"


def test_upsert_admin_telegram_welcome_media_updates_both_assets(monkeypatch) -> None:
    influencer = SimpleNamespace(id="inf_123", assets_json={})
    db = DummySession()
    deleted_keys: list[str] = []

    async def fake_upload_landing_binary(file_obj, filename, content_type, influencer_id, slot, *, fallback_extension):
        assert isinstance(file_obj, BytesIO)
        if slot == asset_repo.TELEGRAM_AUDIO_SLOT:
            return "bucket/audio.mp3", "audio/mpeg"
        return "bucket/video.mp4", "video/mp4"

    monkeypatch.setattr(asset_use_case, "upload_landing_binary", fake_upload_landing_binary)
    monkeypatch.setattr(asset_use_case, "delete_asset", _record_delete(deleted_keys))
    monkeypatch.setattr(asset_use_case, "invalidate_landing_asset_cache", _async_noop())
    monkeypatch.setattr(
        asset_use_case,
        "get_landing_asset_presence",
        _async_return(
            {
                asset_repo.TELEGRAM_AUDIO_SLOT: True,
                asset_repo.TELEGRAM_VIDEO_SLOT: True,
                asset_repo.LEGACY_TELEGRAM_MEDIA_SLOT: False,
            }
        ),
    )
    monkeypatch.setattr(
        asset_use_case,
        "get_cached_presigned_url_for_key",
        _async_prefix("https://cdn.test/"),
    )
    monkeypatch.setattr(asset_use_case, "_utcnow_iso", lambda: "2026-03-24T01:02:03+00:00")

    result = asyncio.run(
        asset_use_case.upsert_admin_telegram_welcome_media(
            db=db,
            influencer=influencer,
            audio=DummyUploadFile(b"audio-bytes", filename="welcome.mp3", content_type="audio/mpeg"),
            video=DummyUploadFile(b"video-bytes", filename="welcome.mp4", content_type="video/mp4"),
        )
    )

    assert result["has_audio"] is True
    assert result["has_video"] is True
    assert deleted_keys == []


def test_upsert_admin_telegram_welcome_media_rejects_missing_files() -> None:
    influencer = SimpleNamespace(id="inf_123", assets_json={})
    db = DummySession()

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            asset_use_case.upsert_admin_telegram_welcome_media(
                db=db,
                influencer=influencer,
                audio=None,
                video=None,
            )
        )

    assert exc.value.status_code == 400
    assert exc.value.detail == "At least one telegram media file is required"


def test_upsert_admin_telegram_welcome_media_rejects_non_audio_file() -> None:
    influencer = SimpleNamespace(id="inf_123", assets_json={})
    db = DummySession()

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            asset_use_case.upsert_admin_telegram_welcome_media(
                db=db,
                influencer=influencer,
                audio=DummyUploadFile(b"video-bytes", filename="welcome.mp4", content_type="video/mp4"),
                video=None,
            )
        )

    assert exc.value.status_code == 400
    assert exc.value.detail == "Telegram welcome audio must be an audio file"


def test_upsert_admin_telegram_welcome_media_rejects_non_video_file() -> None:
    influencer = SimpleNamespace(id="inf_123", assets_json={})
    db = DummySession()

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            asset_use_case.upsert_admin_telegram_welcome_media(
                db=db,
                influencer=influencer,
                audio=None,
                video=DummyUploadFile(b"audio-bytes", filename="welcome.mp3", content_type="audio/mpeg"),
            )
        )

    assert exc.value.status_code == 400
    assert exc.value.detail == "Telegram welcome video must be a video file"


def test_get_cached_presigned_url_for_key_uses_cache(monkeypatch) -> None:
    set_calls: list[tuple[str, str]] = []
    generated_keys: list[str] = []

    monkeypatch.setattr(asset_repo, "get_cached_presigned_url", _async_return("https://cached.test/hero.png"))

    def _fail_generate(_key: str) -> str:
        generated_keys.append(_key)
        return f"https://generated.test/{_key}"

    async def _record_set(key: str, url: str) -> None:
        set_calls.append((key, url))

    monkeypatch.setattr(asset_repo, "get_presigned_url", _fail_generate)
    monkeypatch.setattr(asset_repo, "set_cached_presigned_url", _record_set)

    result = asyncio.run(asset_repo.get_cached_presigned_url_for_key("hero.png"))

    assert result == "https://cached.test/hero.png"
    assert generated_keys == []
    assert set_calls == []


def test_build_admin_landing_assets_out_uses_cached_urls_without_object_exists(monkeypatch) -> None:
    influencer = SimpleNamespace(
        id="inf_123",
        assets_json={
            "hero_png": {
                "s3_key": "bucket/hero.png",
                "content_type": "image/png",
                "updated_at": "2026-03-24T00:00:00+00:00",
            },
            "hero_png_2x": {
                "s3_key": "bucket/hero@2x.png",
                "content_type": "image/png",
                "updated_at": "2026-03-24T00:00:00+00:00",
            },
        },
    )

    async def _presence(_influencer_id: str, _assets_json) -> dict[str, bool]:
        return {slot: slot in {"hero_png", "hero_png_2x"} for slot in asset_use_case.LANDING_ALL_SLOTS}

    async def _cached_url(key: str) -> str:
        return f"https://cdn.test/{key}"

    async def _boom(*args, **kwargs):
        raise AssertionError("object_exists should not be used")

    monkeypatch.setattr(asset_use_case, "get_landing_asset_presence", _presence)
    monkeypatch.setattr(asset_use_case, "get_cached_presigned_url_for_key", _cached_url)
    monkeypatch.setattr(asset_use_case, "object_exists", _boom, raising=False)

    result = asyncio.run(asset_use_case.build_admin_landing_assets_out(influencer))

    assert result["hero_png_url"] == "https://cdn.test/bucket/hero.png"
    assert result["hero_png_2x_url"] == "https://cdn.test/bucket/hero@2x.png"
    assert result["has_hero"] is True


def test_upsert_admin_landing_assets_invalidates_cache(monkeypatch) -> None:
    influencer = SimpleNamespace(
        id="inf_123",
        assets_json={
            "hero_png": {
                "s3_key": "bucket/old-hero.png",
                "content_type": "image/png",
                "updated_at": "2026-03-24T00:00:00+00:00",
            }
        },
    )
    db = DummySession()
    invalidated: list[tuple[str, list[str]]] = []

    async def _fake_upload(*args, **kwargs):
        return "bucket/new-hero.png", "image/png"

    async def _fake_invalidate(influencer_id: str, keys: list[str]) -> None:
        invalidated.append((influencer_id, keys))

    monkeypatch.setattr(asset_use_case, "upload_landing_image", _fake_upload)
    monkeypatch.setattr(asset_use_case, "delete_asset", _async_noop())
    monkeypatch.setattr(asset_use_case, "invalidate_landing_asset_cache", _fake_invalidate)
    monkeypatch.setattr(asset_use_case, "_utcnow_iso", lambda: "2026-03-24T01:02:03+00:00")
    monkeypatch.setattr(
        asset_use_case,
        "build_admin_landing_assets_out",
        _async_return({"influencer_id": "inf_123", "hero_png_url": "https://cdn.test/bucket/new-hero.png"}),
    )

    result = asyncio.run(
        asset_use_case.upsert_admin_landing_assets(
            db=db,
            influencer=influencer,
            files_by_slot={
                "hero_png": DummyUploadFile(
                    b"image-bytes",
                    filename="hero.png",
                    content_type="image/png",
                )
            },
        )
    )

    assert result["hero_png_url"] == "https://cdn.test/bucket/new-hero.png"
    assert invalidated == [("inf_123", ["bucket/old-hero.png", "bucket/new-hero.png"])]


def test_get_influencer_landing_assets_route_shape_is_unchanged(monkeypatch) -> None:
    app = FastAPI()
    app.include_router(influencer_route.router)

    async def _override_db():
        yield DummySession()

    async def _fake_public_landing_assets(_influencer):
        return {
            "influencer_id": "loli",
            "hero_png_url": "https://cdn.test/hero.png",
            "hero_png_2x_url": None,
            "signature_png_url": None,
            "signature_png_2x_url": None,
            "background_video_1_mp4_url": None,
            "background_video_1_mp4_content_type": None,
            "background_video_1_webm_url": None,
            "background_video_1_webm_content_type": None,
            "background_video_1_poster_jpg_url": None,
            "background_video_2_mp4_url": None,
            "background_video_2_mp4_content_type": None,
            "background_video_2_webm_url": None,
            "background_video_2_webm_content_type": None,
            "background_video_2_poster_jpg_url": None,
            "background_image_1_url": None,
            "background_image_1_2x_url": None,
            "background_image_2_url": None,
            "background_image_2_2x_url": None,
            "background_image_3_url": None,
            "background_image_3_2x_url": None,
            "has_hero": True,
            "has_signature": False,
            "has_background_videos": False,
            "has_complete_background_images": False,
            "updated_at": "2026-03-24T01:02:03+00:00",
        }

    app.dependency_overrides[get_db] = _override_db
    monkeypatch.setattr(
        influencer_route,
        "build_public_landing_assets_out",
        _fake_public_landing_assets,
    )

    client = TestClient(app)
    response = client.get("/influencer/loli/landing-assets")

    assert response.status_code == 200
    body = response.json()
    assert body["influencer_id"] == "loli"
    assert body["hero_png_url"] == "https://cdn.test/hero.png"
    assert "has_hero" in body
    assert "updated_at" in body


def _async_return(value):
    async def _inner(*args, **kwargs):
        return value

    return _inner


def _record_delete(deleted_keys: list[str]):
    async def _inner(key: str) -> None:
        deleted_keys.append(key)

    return _inner


def _async_prefix(prefix: str):
    async def _inner(key: str) -> str:
        return f"{prefix}{key}"

    return _inner


def _async_noop():
    async def _inner(*args, **kwargs) -> None:
        return None

    return _inner
