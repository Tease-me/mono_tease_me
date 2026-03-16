import io
import os

os.environ.setdefault("OPENAI_API_KEY", "test-key")

import pytest
from PIL import Image

from app.repositories import influencer_character_assets_repository as repo


@pytest.fixture
def anyio_backend():
    return "asyncio"


def _png_bytes() -> bytes:
    output = io.BytesIO()
    Image.new("RGBA", (1, 1), (255, 0, 0, 255)).save(output, format="PNG")
    return output.getvalue()


def _jpeg_bytes() -> bytes:
    output = io.BytesIO()
    Image.new("RGB", (1, 1), (0, 255, 0)).save(output, format="JPEG")
    return output.getvalue()


def test_build_influencer_character_asset_keys():
    assert repo.build_influencer_character_photo_key("juliana", 7) == "influencer/juliana/characters/7/photo.png"
    assert repo.build_influencer_character_photo_2x_key("juliana", 7) == "influencer/juliana/characters/7/photo@2x.png"
    assert repo.build_influencer_character_video_mp4_key("juliana", 7) == "influencer/juliana/characters/7/video.mp4"
    assert repo.build_influencer_character_video_webm_key("juliana", 7) == "influencer/juliana/characters/7/video.webm"
    assert repo.build_influencer_character_video_preview_png_key("juliana", 7) == "influencer/juliana/characters/7/video.png"


def test_get_influencer_character_asset_state_uses_s3_presence(monkeypatch):
    monkeypatch.setattr(
        repo.s3_gateway,
        "object_exists",
        lambda *, bucket, key: key.endswith("photo.png") or key.endswith("photo@2x.png") or key.endswith("video.mp4"),
    )
    monkeypatch.setattr(
        repo.s3_gateway,
        "generate_presigned_get_url",
        lambda *, bucket, key, expires=3600: f"https://cdn.test/{key}",
    )

    state = repo.get_influencer_character_asset_state("juliana", 7)

    assert state["photo_url"] == "https://cdn.test/influencer/juliana/characters/7/photo.png"
    assert state["photo_2x_url"] == "https://cdn.test/influencer/juliana/characters/7/photo@2x.png"
    assert state["video_mp4_url"] == "https://cdn.test/influencer/juliana/characters/7/video.mp4"
    assert state["video_webm_url"] is None
    assert state["video_preview_png_url"] is None
    assert state["has_photo"] is True
    assert state["has_complete_video_set"] is False


def test_convert_image_to_png_converts_jpeg():
    converted, content_type = repo._convert_to_png(io.BytesIO(_jpeg_bytes()), "avatar.jpg", "image/jpeg")

    assert content_type == "image/png"
    image = Image.open(converted)
    assert image.format == "PNG"


@pytest.mark.anyio
async def test_upload_influencer_character_photo_uses_fixed_png_key(monkeypatch):
    captured = {}

    def _upload(file_obj, bucket, key, *, content_type=None):
        captured["bucket"] = bucket
        captured["key"] = key
        captured["content_type"] = content_type
        captured["bytes"] = file_obj.read()

    monkeypatch.setattr(repo.s3_gateway, "upload_fileobj", _upload)

    key = await repo.upload_influencer_character_photo(
        io.BytesIO(_png_bytes()),
        "avatar.png",
        "image/png",
        "juliana",
        7,
        variant="photo_2x",
    )

    assert key == "influencer/juliana/characters/7/photo@2x.png"
    assert captured["bucket"]
    assert captured["key"] == key
    assert captured["content_type"] == "image/png"
    assert captured["bytes"]
