from __future__ import annotations

import io

import pytest

from app.services.use_cases import pre_influencer_storage


def test_build_audio_key_uses_pre_influencer_domain_path(monkeypatch) -> None:
    monkeypatch.setattr(pre_influencer_storage.uuid, "uuid4", lambda: "fixed-uuid")

    key = pre_influencer_storage.build_audio_key("123", "voice.webm")

    assert key == "pre-influencers/123/audio/fixed-uuid.webm"


@pytest.mark.anyio
async def test_save_audio_uploads_to_pre_influencer_domain_path(monkeypatch) -> None:
    captured: dict = {}

    def _fake_upload_fileobj(file_obj, bucket: str, key: str, *, content_type: str):
        captured["bytes"] = file_obj.read()
        captured["bucket"] = bucket
        captured["key"] = key
        captured["content_type"] = content_type

    monkeypatch.setattr(pre_influencer_storage.uuid, "uuid4", lambda: "fixed-uuid")
    monkeypatch.setattr(pre_influencer_storage.settings, "BUCKET_NAME", "test-bucket")
    monkeypatch.setattr(
        pre_influencer_storage.s3_gateway,
        "upload_fileobj",
        _fake_upload_fileobj,
    )

    key = await pre_influencer_storage.save_audio(
        io.BytesIO(b"audio-bytes"),
        "voice.webm",
        "audio/webm",
        "123",
    )

    assert key == "pre-influencers/123/audio/fixed-uuid.webm"
    assert captured == {
        "bytes": b"audio-bytes",
        "bucket": "test-bucket",
        "key": "pre-influencers/123/audio/fixed-uuid.webm",
        "content_type": "audio/webm",
    }


@pytest.mark.anyio
async def test_list_audio_keys_reads_new_prefix_only(monkeypatch) -> None:
    calls: list[str] = []

    def _fake_list_objects(*, bucket: str, prefix: str):
        assert bucket == "test-bucket"
        calls.append(prefix)
        if prefix == "pre-influencers/123/audio/":
            return ["pre-influencers/123/audio/new.webm"]
        return []

    monkeypatch.setattr(pre_influencer_storage.settings, "BUCKET_NAME", "test-bucket")
    monkeypatch.setattr(
        pre_influencer_storage.s3_gateway,
        "list_objects",
        _fake_list_objects,
    )

    keys = await pre_influencer_storage.list_audio_keys("123")

    assert keys == ["pre-influencers/123/audio/new.webm"]
    assert calls == ["pre-influencers/123/audio/"]


def test_is_audio_key_for_pre_influencer_accepts_new_prefix_only() -> None:
    assert pre_influencer_storage.is_audio_key_for_pre_influencer(
        "123",
        "pre-influencers/123/audio/new.webm",
    )
    assert not pre_influencer_storage.is_audio_key_for_pre_influencer(
        "123",
        "pre-influencer-audio/123/legacy.webm",
    )
    assert not pre_influencer_storage.is_audio_key_for_pre_influencer(
        "123",
        "influencer-audio/123/file.webm",
    )


def test_is_audio_key_for_pre_influencer_owner_falls_back_to_legacy_id() -> None:
    assert pre_influencer_storage.is_audio_key_for_pre_influencer_owner(
        "pre-influencers/legacy-id/audio/file.webm",
        username=None,
        legacy_pre_id="legacy-id",
    )
    assert pre_influencer_storage.is_audio_key_for_pre_influencer_owner(
        "pre-influencers/legacy-id/audio/file.webm",
        username="",
        legacy_pre_id="legacy-id",
    )
    assert pre_influencer_storage.is_audio_key_for_pre_influencer_owner(
        "pre-influencers/legacy-id/audio/file.webm",
        username="   ",
        legacy_pre_id="legacy-id",
    )


@pytest.mark.anyio
async def test_list_audio_keys_with_legacy_id_prefers_username_keys(monkeypatch) -> None:
    calls: list[str] = []

    async def _fake_list_audio_keys(owner: str) -> list[str]:
        calls.append(owner)
        if owner == "username":
            return ["pre-influencers/username/audio/new.webm"]
        if owner == "legacy-id":
            return ["pre-influencers/legacy-id/audio/legacy.webm"]
        return []

    monkeypatch.setattr(pre_influencer_storage, "list_audio_keys", _fake_list_audio_keys)

    keys = await pre_influencer_storage.list_audio_keys_with_legacy_id(
        username="username",
        legacy_pre_id="legacy-id",
    )

    assert keys == ["pre-influencers/username/audio/new.webm"]
    assert calls == ["username"]


@pytest.mark.anyio
async def test_list_audio_keys_with_legacy_id_uses_legacy_for_empty_or_whitespace_username(
    monkeypatch,
) -> None:
    calls: list[str] = []

    async def _fake_list_audio_keys(owner: str) -> list[str]:
        calls.append(owner)
        if owner == "legacy-id":
            return ["pre-influencers/legacy-id/audio/legacy.webm"]
        return []

    monkeypatch.setattr(pre_influencer_storage, "list_audio_keys", _fake_list_audio_keys)

    keys_none = await pre_influencer_storage.list_audio_keys_with_legacy_id(
        username=None,
        legacy_pre_id="legacy-id",
    )
    keys_empty = await pre_influencer_storage.list_audio_keys_with_legacy_id(
        username="",
        legacy_pre_id="legacy-id",
    )
    keys_whitespace = await pre_influencer_storage.list_audio_keys_with_legacy_id(
        username="   ",
        legacy_pre_id="legacy-id",
    )

    assert keys_none == ["pre-influencers/legacy-id/audio/legacy.webm"]
    assert keys_empty == ["pre-influencers/legacy-id/audio/legacy.webm"]
    assert keys_whitespace == ["pre-influencers/legacy-id/audio/legacy.webm"]
    assert calls == ["legacy-id", "legacy-id", "   ", "legacy-id"]
