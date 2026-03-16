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
    monkeypatch.setattr(
        "app.api.influencer.get_influencer_character_asset_state",
        lambda influencer_id, character_id: {
            "photo_url": f"https://example.test/{influencer_id}/{character_id}/photo.png",
            "photo_2x_url": f"https://example.test/{influencer_id}/{character_id}/photo@2x.png",
            "video_mp4_url": None,
            "video_webm_url": None,
            "video_preview_png_url": None,
            "has_photo": True,
            "has_complete_video_set": False,
        },
    )

    character = SimpleNamespace(
        id=2,
        slug="nurse",
        name="Horny Nurse",
        description="A playful nurse character",
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
    assert item.lottie_text == "lottie/nurse.json"
    assert item.photo_url == "https://example.test/juliana/2/photo.png"
    assert item.photo_2x_url == "https://example.test/juliana/2/photo@2x.png"
    assert item.video_mp4_url is None
    assert item.has_photo is True
    assert item.meta_json == {"theme": "medical"}


@pytest.mark.anyio
async def test_build_influencer_adult_characters_keeps_null_lottie_text(monkeypatch):
    monkeypatch.setattr(
        "app.api.influencer.get_influencer_character_asset_state",
        lambda influencer_id, character_id: {
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
        },
    )

    first = SimpleNamespace(
        id=9,
        slug="alpha",
        name="Alpha",
        description=None,
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
        prompt_template="two",
        is_active=True,
        display_order=1,
        default_artwork_key="artwork/beta.png",
        lottie_text="lottie/beta.json",
    )
    db = _FakeAsyncSession([[first, second], []])

    items = await _build_influencer_adult_characters(db, "juliana")

    assert [item.id for item in items] == [3, 9]
    assert items[0].lottie_text == "lottie/beta.json"
    assert items[1].lottie_text is None
    assert items[0].photo_url == "https://example.test/juliana/3/photo.png"
    assert items[1].photo_url is None
