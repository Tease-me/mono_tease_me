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
        "app.api.influencer.generate_presigned_url",
        lambda key: f"https://example.test/{key}",
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
        photo_key="overlay/nurse.png",
        video_key=None,
        meta_json={"theme": "medical"},
        is_active=True,
    )
    db = _FakeAsyncSession([[character], [overlay]])

    items = await _build_influencer_adult_characters(db, "juliana")

    assert len(items) == 1
    item = items[0]
    assert item.lottie_text == "lottie/nurse.json"
    assert item.photo_key == "overlay/nurse.png"
    assert item.photo_url == "https://example.test/overlay/nurse.png"
    assert item.video_key is None
    assert item.meta_json == {"theme": "medical"}


@pytest.mark.anyio
async def test_build_influencer_adult_characters_keeps_null_lottie_text(monkeypatch):
    monkeypatch.setattr(
        "app.api.influencer.generate_presigned_url",
        lambda key: f"https://example.test/{key}",
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
    assert items[0].photo_key == "artwork/beta.png"
    assert items[0].photo_url == "https://example.test/artwork/beta.png"
