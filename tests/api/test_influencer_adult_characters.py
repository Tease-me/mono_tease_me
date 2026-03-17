import os
from types import SimpleNamespace

import pytest

os.environ.setdefault("OPENAI_API_KEY", "test-key")

from app.api.influencer import _build_influencer_adult_characters


@pytest.fixture
def anyio_backend():
    return "asyncio"


class _FakeScalarResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return list(self._rows)


class _FakeExecuteResult:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return _FakeScalarResult(self._rows)


class _FakeAsyncSession:
    def __init__(self, responses):
        self._responses = list(responses)

    async def execute(self, _query):
        if not self._responses:
            raise AssertionError("Unexpected execute call")
        return _FakeExecuteResult(self._responses.pop(0))


@pytest.mark.anyio
async def test_build_influencer_adult_characters_includes_lottie_text_key(monkeypatch):
    async def _base_asset_state(character_id, default_artwork_key, lottie_text_key):
        return {
            "default_artwork_url": "https://example.test/base/2/default-artwork.png",
            "lottie_text_url": "https://example.test/base/2/lottie.json",
        }

    async def _influencer_asset_state(influencer_id, character_id):
        return {
            "photo_url": f"https://example.test/{influencer_id}/{character_id}/photo.png",
            "photo_2x_url": f"https://example.test/{influencer_id}/{character_id}/photo@2x.png",
            "video_mp4_url": None,
            "video_webm_url": None,
            "video_preview_png_url": None,
            "has_photo": True,
            "has_complete_video_set": False,
        }

    monkeypatch.setattr(
        "app.api.influencer.get_adult_character_asset_state",
        _base_asset_state,
    )
    monkeypatch.setattr(
        "app.api.influencer.get_influencer_character_asset_state",
        _influencer_asset_state,
    )

    character = SimpleNamespace(
        id=2,
        slug="nurse",
        name="Horny Nurse",
        description="A playful nurse character",
        short_description="Quick nurse teaser",
        prompt_template="template",
        is_active=True,
        display_order=7,
        default_artwork_key="artwork/nurse.png",
        lottie_text="lottie/nurse.json",
    )
    overlay = SimpleNamespace(
        character_id=2,
        meta_json={"theme": "medical"},
        is_active=True,
    )
    db = _FakeAsyncSession([[character], [overlay]])

    items = await _build_influencer_adult_characters(db, "juliana")

    assert len(items) == 1
    item = items[0]
    assert item.short_description == "Quick nurse teaser"
    assert item.lottie_text == "lottie/nurse.json"
    assert item.default_artwork_url == "https://example.test/base/2/default-artwork.png"
    assert item.lottie_text_url == "https://example.test/base/2/lottie.json"
    assert item.photo_url == "https://example.test/juliana/2/photo.png"
    assert item.photo_2x_url == "https://example.test/juliana/2/photo@2x.png"
    assert item.video_mp4_url is None
    assert item.has_photo is True
    assert item.meta_json == {"theme": "medical"}


@pytest.mark.anyio
async def test_build_influencer_adult_characters_keeps_null_lottie_text(monkeypatch):
    async def _base_asset_state(character_id, default_artwork_key, lottie_text_key):
        return {
            "default_artwork_url": f"https://example.test/base/{default_artwork_key}"
            if default_artwork_key
            else None,
            "lottie_text_url": f"https://example.test/base/{lottie_text_key}"
            if lottie_text_key
            else None,
        }

    async def _influencer_asset_state(influencer_id, character_id):
        return {
            "photo_url": f"https://example.test/{influencer_id}/{character_id}/photo.png"
            if character_id == 3
            else None,
            "photo_2x_url": f"https://example.test/{influencer_id}/{character_id}/photo@2x.png"
            if character_id == 3
            else None,
            "video_mp4_url": None,
            "video_webm_url": None,
            "video_preview_png_url": None,
            "has_photo": character_id == 3,
            "has_complete_video_set": False,
        }

    monkeypatch.setattr(
        "app.api.influencer.get_adult_character_asset_state",
        _base_asset_state,
    )
    monkeypatch.setattr(
        "app.api.influencer.get_influencer_character_asset_state",
        _influencer_asset_state,
    )

    first = SimpleNamespace(
        id=9,
        slug="alpha",
        name="Alpha",
        description=None,
        short_description=None,
        prompt_template="one",
        is_active=True,
        display_order=2,
        default_artwork_key=None,
        lottie_text=None,
    )
    second = SimpleNamespace(
        id=3,
        slug="beta",
        name="Beta",
        description=None,
        short_description="Beta short",
        prompt_template="two",
        is_active=True,
        display_order=1,
        default_artwork_key="artwork/beta.png",
        lottie_text="lottie/beta.json",
    )
    db = _FakeAsyncSession([[first, second], []])

    items = await _build_influencer_adult_characters(db, "juliana")

    assert [item.id for item in items] == [3, 9]
    assert items[0].short_description == "Beta short"
    assert items[1].short_description is None
    assert items[0].lottie_text == "lottie/beta.json"
    assert items[1].lottie_text is None
    assert items[0].default_artwork_url == "https://example.test/base/artwork/beta.png"
    assert items[0].lottie_text_url == "https://example.test/base/lottie/beta.json"
    assert items[1].default_artwork_url is None
    assert items[1].lottie_text_url is None
    assert items[0].photo_url == "https://example.test/juliana/3/photo.png"
    assert items[1].photo_url is None
