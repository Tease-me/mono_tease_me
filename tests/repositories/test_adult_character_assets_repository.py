import pytest

from io import BytesIO

from app.repositories.adult_character_assets_repository import (
    build_adult_character_default_artwork_key,
    build_adult_character_lottie_key,
    get_adult_character_asset_state,
    upload_adult_character_default_artwork,
    upload_adult_character_lottie,
)


@pytest.fixture
def anyio_backend():
    return "asyncio"


def test_build_adult_character_asset_keys():
    assert build_adult_character_default_artwork_key(7) == "adult-characters/7/default-artwork.png"
    assert build_adult_character_lottie_key(7) == "adult-characters/7/lottie.json"


@pytest.mark.anyio
async def test_upload_adult_character_default_artwork_normalizes_and_uploads(monkeypatch):
    uploaded = {}

    def _upload_fileobj(file_obj, bucket, key, *, content_type=None):
        uploaded["bucket"] = bucket
        uploaded["key"] = key
        uploaded["content_type"] = content_type
        uploaded["body"] = file_obj.read()

    monkeypatch.setattr(
        "app.repositories.adult_character_assets_repository.s3_gateway.upload_fileobj",
        _upload_fileobj,
    )

    key = await upload_adult_character_default_artwork(
        BytesIO(b"fake-image"),
        "artwork.png",
        "image/png",
        7,
    )

    assert key == "adult-characters/7/default-artwork.png"
    assert uploaded["key"] == key
    assert uploaded["content_type"] == "image/png"


@pytest.mark.anyio
async def test_upload_adult_character_lottie_uploads_json(monkeypatch):
    uploaded = {}

    def _upload_fileobj(file_obj, bucket, key, *, content_type=None):
        uploaded["bucket"] = bucket
        uploaded["key"] = key
        uploaded["content_type"] = content_type
        uploaded["body"] = file_obj.read()

    monkeypatch.setattr(
        "app.repositories.adult_character_assets_repository.s3_gateway.upload_fileobj",
        _upload_fileobj,
    )

    key = await upload_adult_character_lottie(BytesIO(b'{"v":"5.0"}'), 9)

    assert key == "adult-characters/9/lottie.json"
    assert uploaded["key"] == key
    assert uploaded["content_type"] == "application/json"


def test_get_adult_character_asset_state_returns_signed_urls_when_objects_exist(monkeypatch):
    monkeypatch.setattr(
        "app.repositories.adult_character_assets_repository.s3_gateway.object_exists",
        lambda *, bucket, key: True,
    )
    monkeypatch.setattr(
        "app.repositories.adult_character_assets_repository.s3_gateway.generate_presigned_get_url",
        lambda *, bucket, key, expires=3600: f"https://cdn.test/{key}",
    )

    state = get_adult_character_asset_state(
        "adult-characters/7/default-artwork.png",
        "adult-characters/7/lottie.json",
    )

    assert state == {
        "default_artwork_url": "https://cdn.test/adult-characters/7/default-artwork.png",
        "lottie_text_url": "https://cdn.test/adult-characters/7/lottie.json",
    }


def test_get_adult_character_asset_state_returns_null_urls_when_missing(monkeypatch):
    monkeypatch.setattr(
        "app.repositories.adult_character_assets_repository.s3_gateway.object_exists",
        lambda *, bucket, key: False,
    )

    state = get_adult_character_asset_state(
        "adult-characters/7/default-artwork.png",
        "adult-characters/7/lottie.json",
    )

    assert state == {
        "default_artwork_url": None,
        "lottie_text_url": None,
    }
