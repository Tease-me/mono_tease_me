import io
import os

os.environ.setdefault("OPENAI_API_KEY", "test-key")

import pytest

from app.repositories import influencer_character_assets_repository as repo


@pytest.fixture
def anyio_backend():
    return "asyncio"


def test_build_influencer_character_photo_key():
    assert (
        repo.build_influencer_character_photo_key("juliana", 7, "png")
        == "influencer/juliana/characters/7/photo.png"
    )


def test_build_influencer_character_video_key():
    assert (
        repo.build_influencer_character_video_key("juliana", 7, "mp4")
        == "influencer/juliana/characters/7/video.mp4"
    )


def test_convert_heic_to_jpeg_leaves_non_heic_unchanged():
    file_obj = io.BytesIO(b"abc")
    converted, content_type, ext = repo._convert_heic_to_jpeg(file_obj, "avatar.png", "image/png")

    assert converted is file_obj
    assert content_type == "image/png"
    assert ext == "png"


@pytest.mark.anyio
async def test_upload_influencer_character_photo_uses_gateway(monkeypatch):
    captured = {}

    def _upload(file_obj, bucket, key, *, content_type=None):
        captured["bucket"] = bucket
        captured["key"] = key
        captured["content_type"] = content_type
        captured["bytes"] = file_obj.read()

    monkeypatch.setattr(repo.s3_gateway, "upload_fileobj", _upload)

    key = await repo.upload_influencer_character_photo(
        io.BytesIO(b"photo"),
        "avatar.png",
        "image/png",
        "juliana",
        7,
    )

    assert key == "influencer/juliana/characters/7/photo.png"
    assert captured["bucket"]
    assert captured["key"] == key
    assert captured["content_type"] == "image/png"
    assert captured["bytes"] == b"photo"
