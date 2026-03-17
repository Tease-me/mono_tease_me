from types import SimpleNamespace

import pytest

from app.db.models import AdultCharacter, Influencer, InfluencerCharacterMeta
from app.scripts.seed_adult_characters import seed_adult_characters_and_overlays


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
    def __init__(self, *, characters=None, influencers=None, overlays=None):
        self.characters = dict(characters or {})
        self.influencers = list(influencers or [])
        self.overlays = dict(overlays or {})
        self.added = []
        self.deleted = []
        self.flush_called = False
        self._next_character_id = max(self.characters.values(), key=lambda item: item.id).id + 1 if self.characters else 1

    async def scalar(self, query):
        entity = query.column_descriptions[0].get("entity")
        criteria = {}
        for criterion in query._where_criteria:
            criteria[getattr(criterion.left, "key", None)] = getattr(criterion.right, "value", None)

        if entity is AdultCharacter:
            return self.characters.get(criteria.get("slug"))
        if entity is InfluencerCharacterMeta:
            return self.overlays.get((criteria.get("influencer_id"), criteria.get("character_id")))
        raise AssertionError(f"Unexpected scalar entity {entity}")

    async def execute(self, query):
        entity = query.column_descriptions[0].get("entity")
        if entity is Influencer:
            return _FakeExecuteResult(self.influencers)
        raise AssertionError(f"Unexpected execute entity {entity}")

    def add(self, obj):
        self.added.append(obj)
        if isinstance(obj, AdultCharacter):
            if getattr(obj, "id", None) is None:
                obj.id = self._next_character_id
                self._next_character_id += 1
            self.characters[obj.slug] = obj
        elif isinstance(obj, InfluencerCharacterMeta):
            self.overlays[(obj.influencer_id, obj.character_id)] = obj

    async def flush(self):
        self.flush_called = True


@pytest.mark.anyio
async def test_seed_inserts_missing_adult_characters_and_overlays():
    db = _FakeAsyncSession(
        influencers=[
            SimpleNamespace(id="juliana"),
            SimpleNamespace(id="bella"),
        ]
    )

    summary = await seed_adult_characters_and_overlays(db)

    assert summary["adult_characters_inserted"] >= 1
    assert "nurse" in db.characters
    assert db.flush_called is True
    assert ("juliana", db.characters["nurse"].id) in db.overlays
    assert ("bella", db.characters["nurse"].id) in db.overlays


@pytest.mark.anyio
async def test_seed_updates_existing_adult_character_by_slug():
    existing = AdultCharacter(
        id=7,
        slug="nurse",
        name="Old Nurse",
        description="old",
        short_description="old short",
        first_messages=["old hello"],
        prompt_template="old prompt",
        default_artwork_key=None,
        lottie_text=None,
        is_active=False,
        display_order=99,
    )
    db = _FakeAsyncSession(
        characters={"nurse": existing},
        influencers=[],
    )

    summary = await seed_adult_characters_and_overlays(db)

    assert summary["adult_characters_updated"] >= 1
    assert existing.name == "Nurse"
    assert existing.short_description == "Soft bedside care with a teasing smile."
    assert existing.first_messages == [
        "Hey, lie back for me and tell me where you want my attention first.",
        "You look tense already, sweetheart. Want your nurse to take over?",
        "Mmm, I have a little time before rounds. Tell me what kind of care you need.",
    ]
    assert existing.is_active is True
    assert existing.display_order == 1


@pytest.mark.anyio
async def test_seed_preserves_existing_overlay_meta_json_on_rerun():
    character = AdultCharacter(
        id=7,
        slug="nurse",
        name="Nurse",
        description="A caring medical roleplay character with a soft but confident bedside manner.",
        short_description=None,
        first_messages=None,
        prompt_template="You are playing the role of a flirtatious nurse. Stay in character, speak warmly, and keep the tone playful, intimate, and role-focused.",
        default_artwork_key=None,
        lottie_text="influencer/bella/adult-characters/lotties/adultTitlePlaceholder.json",
        is_active=True,
        display_order=1,
    )
    overlay = InfluencerCharacterMeta(
        influencer_id="juliana",
        character_id=7,
        meta_json={"accent": "red"},
        is_active=False,
    )
    db = _FakeAsyncSession(
        characters={"nurse": character},
        influencers=[SimpleNamespace(id="juliana")],
        overlays={("juliana", 7): overlay},
    )

    summary = await seed_adult_characters_and_overlays(db)

    assert summary["overlays_updated"] == 1
    assert overlay.meta_json == {"accent": "red"}
    assert overlay.is_active is True


@pytest.mark.anyio
async def test_seed_does_not_delete_unrelated_rows():
    unrelated_character = AdultCharacter(
        id=99,
        slug="custom",
        name="Custom",
        description=None,
        short_description=None,
        first_messages=None,
        prompt_template="custom",
        default_artwork_key=None,
        lottie_text=None,
        is_active=True,
        display_order=50,
    )
    unrelated_overlay = InfluencerCharacterMeta(
        influencer_id="juliana",
        character_id=99,
        meta_json={"keep": True},
        is_active=True,
    )
    db = _FakeAsyncSession(
        characters={"custom": unrelated_character},
        influencers=[SimpleNamespace(id="juliana")],
        overlays={("juliana", 99): unrelated_overlay},
    )

    await seed_adult_characters_and_overlays(db)

    assert db.characters["custom"] is unrelated_character
    assert db.overlays[("juliana", 99)] is unrelated_overlay
    assert db.deleted == []
