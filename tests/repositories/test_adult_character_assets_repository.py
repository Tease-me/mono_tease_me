from io import BytesIO

import pytest

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

    async def _invalidate(*_args, **_kwargs):
        uploaded["invalidated"] = True

    def _upload_fileobj(file_obj, bucket, key, *, content_type=None):
        uploaded["bucket"] = bucket
        uploaded["key"] = key
        uploaded["content_type"] = content_type
        uploaded["body"] = file_obj.read()

    monkeypatch.setattr(
        "app.repositories.adult_character_assets_repository.invalidate_adult_character_asset_cache",
        _invalidate,
    )
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
    assert uploaded["invalidated"] is True


@pytest.mark.anyio
async def test_upload_adult_character_lottie_uploads_json(monkeypatch):
    uploaded = {}

    async def _invalidate(*_args, **_kwargs):
        uploaded["invalidated"] = True

    def _upload_fileobj(file_obj, bucket, key, *, content_type=None):
        uploaded["bucket"] = bucket
        uploaded["key"] = key
        uploaded["content_type"] = content_type
        uploaded["body"] = file_obj.read()

    monkeypatch.setattr(
        "app.repositories.adult_character_assets_repository.invalidate_adult_character_asset_cache",
        _invalidate,
    )
    monkeypatch.setattr(
        "app.repositories.adult_character_assets_repository.s3_gateway.upload_fileobj",
        _upload_fileobj,
    )

    key = await upload_adult_character_lottie(BytesIO(b'{"v":"5.0"}'), 9)

    assert key == "adult-characters/9/lottie.json"
    assert uploaded["key"] == key
    assert uploaded["content_type"] == "application/json"
    assert uploaded["invalidated"] is True


@pytest.mark.anyio
async def test_get_adult_character_asset_state_returns_signed_urls_when_objects_exist(monkeypatch):
    async def _cached_presence(*_args, **_kwargs):
        return None

    async def _set_cached_presence(*_args, **_kwargs):
        return None

    async def _cached_url(*_args, **_kwargs):
        return None

    async def _set_cached_url(*_args, **_kwargs):
        return None

    monkeypatch.setattr(
        "app.repositories.adult_character_assets_repository.get_cached_presence",
        _cached_presence,
    )
    monkeypatch.setattr(
        "app.repositories.adult_character_assets_repository.set_cached_presence",
        _set_cached_presence,
    )
    monkeypatch.setattr(
        "app.repositories.adult_character_assets_repository.get_cached_presigned_url",
        _cached_url,
    )
    monkeypatch.setattr(
        "app.repositories.adult_character_assets_repository.set_cached_presigned_url",
        _set_cached_url,
    )
    monkeypatch.setattr(
        "app.repositories.adult_character_assets_repository.s3_gateway.list_objects",
        lambda *, bucket, prefix: [
            "adult-characters/7/default-artwork.png",
            "adult-characters/7/lottie.json",
        ],
    )
    monkeypatch.setattr(
        "app.repositories.adult_character_assets_repository.s3_gateway.generate_presigned_get_url",
        lambda *, bucket, key, expires=3600: f"https://cdn.test/{key}",
    )

    state = await get_adult_character_asset_state(
        7,
        "adult-characters/7/default-artwork.png",
        "adult-characters/7/lottie.json",
    )

    assert state == {
        "default_artwork_url": "https://cdn.test/adult-characters/7/default-artwork.png",
        "lottie_text_url": "https://cdn.test/adult-characters/7/lottie.json",
    }


@pytest.mark.anyio
async def test_get_adult_character_asset_state_returns_null_urls_when_missing(monkeypatch):
    async def _cached_presence(namespace, identifier):
        return None

    async def _set_cached_presence(*args, **kwargs):
        return None

    monkeypatch.setattr(
        "app.repositories.adult_character_assets_repository.get_cached_presence",
        _cached_presence,
    )
    monkeypatch.setattr(
        "app.repositories.adult_character_assets_repository.set_cached_presence",
        _set_cached_presence,
    )
    monkeypatch.setattr(
        "app.repositories.adult_character_assets_repository.s3_gateway.list_objects",
        lambda *, bucket, prefix: [],
    )

    state = await get_adult_character_asset_state(
        7,
        "adult-characters/7/default-artwork.png",
        "adult-characters/7/lottie.json",
    )

    assert state == {
        "default_artwork_url": None,
        "lottie_text_url": None,
    }


@pytest.mark.anyio
async def test_get_adult_character_asset_state_uses_cached_presence_and_url(monkeypatch):
    async def _cached_presence(namespace, identifier):
        assert namespace == "adult_character"
        assert identifier == "7"
        return {
            "default_artwork": True,
            "lottie_text": False,
        }

    async def _set_cached_presence(*_args, **_kwargs):
        raise AssertionError("Presence cache should not be rewritten on cache hit")

    async def _cached_url(key):
        return f"https://cached.test/{key}"

    async def _set_cached_url(*_args, **_kwargs):
        raise AssertionError("URL cache should not be rewritten on cache hit")

    monkeypatch.setattr(
        "app.repositories.adult_character_assets_repository.get_cached_presence",
        _cached_presence,
    )
    monkeypatch.setattr(
        "app.repositories.adult_character_assets_repository.set_cached_presence",
        _set_cached_presence,
    )
    monkeypatch.setattr(
        "app.repositories.adult_character_assets_repository.get_cached_presigned_url",
        _cached_url,
    )
    monkeypatch.setattr(
        "app.repositories.adult_character_assets_repository.set_cached_presigned_url",
        _set_cached_url,
    )
    monkeypatch.setattr(
        "app.repositories.adult_character_assets_repository.s3_gateway.list_objects",
        lambda **kwargs: (_ for _ in ()).throw(AssertionError("S3 listing should not be used")),
    )

    state = await get_adult_character_asset_state(
        7,
        "adult-characters/7/default-artwork.png",
        "adult-characters/7/lottie.json",
    )

    assert state["default_artwork_url"] == "https://cached.test/adult-characters/7/default-artwork.png"
    assert state["lottie_text_url"] is None
