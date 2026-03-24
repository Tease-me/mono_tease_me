from __future__ import annotations

import asyncio
from io import BytesIO
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.services.repositories import influencer_landing_assets_repository as asset_repo
from app.services.use_cases import admin_influencer_assets as asset_use_case


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
    monkeypatch.setattr(asset_use_case, "object_exists", _async_return(True))
    monkeypatch.setattr(asset_use_case, "get_presigned_url", lambda key: f"https://cdn.test/{key}")

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
    monkeypatch.setattr(asset_use_case, "object_exists", _async_return(True))
    monkeypatch.setattr(asset_use_case, "get_presigned_url", lambda key: f"https://cdn.test/{key}")

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
    monkeypatch.setattr(asset_use_case, "object_exists", _async_return(True))
    monkeypatch.setattr(asset_use_case, "get_presigned_url", lambda key: f"https://cdn.test/{key}")
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
    monkeypatch.setattr(asset_use_case, "object_exists", _async_return(True))
    monkeypatch.setattr(asset_use_case, "get_presigned_url", lambda key: f"https://cdn.test/{key}")
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
    monkeypatch.setattr(asset_use_case, "object_exists", _async_return(True))
    monkeypatch.setattr(asset_use_case, "get_presigned_url", lambda key: f"https://cdn.test/{key}")
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


def _async_return(value):
    async def _inner(*args, **kwargs):
        return value

    return _inner


def _record_delete(deleted_keys: list[str]):
    async def _inner(key: str) -> None:
        deleted_keys.append(key)

    return _inner
