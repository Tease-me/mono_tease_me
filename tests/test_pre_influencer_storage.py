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
