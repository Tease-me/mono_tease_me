import os
from io import BytesIO
from types import SimpleNamespace

import pytest
from starlette.datastructures import UploadFile

os.environ.setdefault("OPENAI_API_KEY", "test-key")

from app.api.admin.characters import (
    create_admin_adult_character,
    delete_admin_adult_character,
    _build_admin_influencer_adult_characters,
    delete_admin_influencer_character_asset,
    list_admin_adult_characters,
    patch_admin_adult_character,
    upsert_admin_influencer_character_assets,
)
from app.db.models import AdultCharacter, Influencer, InfluencerCharacterMeta
from app.schemas.admin import AdminAdultCharacterCreate, AdminAdultCharacterUpdate


@pytest.fixture
def anyio_backend():
    return "asyncio"


class _FakeScalarResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return list(self._rows)

    def first(self):
        return self._rows[0] if self._rows else None


class _FakeExecuteResult:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return _FakeScalarResult(self._rows)


class _FakeAsyncSession:
    def __init__(self, *, influencers=None, characters=None, execute_responses=None):
        self.influencers = influencers or {}
        self.characters = characters or {}
        self.execute_responses = list(execute_responses or [])
        self.added = []
        self.deleted = []
        self.did_commit = False
        self.did_refresh = False
        self.did_rollback = False

    async def get(self, model, key):
        if model is Influencer:
            return self.influencers.get(key)
        if model is AdultCharacter:
            return self.characters.get(key)
        raise AssertionError(f"Unexpected get model {model}")

    async def execute(self, _query):
        if not self.execute_responses:
            raise AssertionError("Unexpected execute call")
        return _FakeExecuteResult(self.execute_responses.pop(0))

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.did_commit = True

    async def refresh(self, _obj):
        if isinstance(_obj, AdultCharacter) and getattr(_obj, "id", None) is None:
            _obj.id = 1
        if isinstance(_obj, AdultCharacter) and getattr(_obj, "created_at", None) is None:
            _obj.created_at = None
        if isinstance(_obj, AdultCharacter) and getattr(_obj, "updated_at", None) is None:
            _obj.updated_at = None
        self.did_refresh = True

    async def rollback(self):
        self.did_rollback = True

    async def delete(self, obj):
        self.deleted.append(obj)


def _admin_user():
    return SimpleNamespace(id=1)


def _non_admin_user():
    return SimpleNamespace(id=2)


@pytest.mark.anyio
async def test_list_admin_adult_characters_orders_rows():
    later = SimpleNamespace(
        id=9,
        slug="later",
        name="Later",
        description=None,
        short_description=None,
        prompt_template="later-template",
        default_artwork_key=None,
        lottie_text=None,
        is_active=True,
        display_order=3,
        created_at=None,
        updated_at=None,
    )
    earlier = SimpleNamespace(
        id=3,
        slug="earlier",
        name="Earlier",
        description="desc",
        short_description="short",
        prompt_template="early-template",
        default_artwork_key="art.png",
        lottie_text="lot.json",
        is_active=False,
        display_order=1,
        created_at=None,
        updated_at=None,
    )
    db = _FakeAsyncSession(execute_responses=[[later, earlier]])

    items = await list_admin_adult_characters(current_user=_admin_user(), db=db)

    assert [item.id for item in items] == [3, 9]
    assert items[0].slug == "earlier"


@pytest.mark.anyio
async def test_create_admin_adult_character_creates_row():
    db = _FakeAsyncSession(execute_responses=[[]])
    payload = AdminAdultCharacterCreate(
        slug="nurse",
        name="Nurse",
        prompt_template="template",
        description="desc",
        short_description="short desc",
        default_artwork_key="art.png",
        lottie_text="lot.json",
        is_active=True,
        display_order=2,
    )

    created = await create_admin_adult_character(
        payload=payload,
        current_user=_admin_user(),
        db=db,
    )

    row = db.added[0]

    assert isinstance(row, AdultCharacter)
    assert row.slug == "nurse"
    assert row.short_description == "short desc"
    assert created.slug == "nurse"
    assert created.id == 1
    assert db.did_commit is True


@pytest.mark.anyio
async def test_create_admin_adult_character_rejects_duplicate_slug():
    existing = SimpleNamespace(id=5, slug="nurse")
    db = _FakeAsyncSession(execute_responses=[[existing]])
    payload = AdminAdultCharacterCreate(
        slug="nurse",
        name="Nurse",
        prompt_template="template",
    )

    with pytest.raises(Exception) as exc:
        await create_admin_adult_character(
            payload=payload,
            current_user=_admin_user(),
            db=db,
        )

    assert getattr(exc.value, "status_code", None) == 400


@pytest.mark.anyio
async def test_delete_admin_adult_character_deletes_row():
    character = SimpleNamespace(id=7)
    db = _FakeAsyncSession(characters={7: character})

    result = await delete_admin_adult_character(
        character_id=7,
        current_user=_admin_user(),
        db=db,
    )

    assert result.ok is True
    assert result.id == 7
    assert db.deleted == [character]
    assert db.did_commit is True


@pytest.mark.anyio
async def test_patch_admin_adult_character_updates_row():
    character = SimpleNamespace(
        id=7,
        slug="nurse",
        name="Nurse",
        description="old",
        short_description="old-short",
        prompt_template="old-template",
        default_artwork_key=None,
        lottie_text=None,
        is_active=True,
        display_order=1,
        created_at=None,
        updated_at=None,
    )
    db = _FakeAsyncSession(characters={7: character})

    result = await patch_admin_adult_character(
        character_id=7,
        payload=AdminAdultCharacterUpdate(
            name="Updated Nurse",
            description="new",
            short_description="new-short",
        ),
        current_user=_admin_user(),
        db=db,
    )

    assert character.name == "Updated Nurse"
    assert character.description == "new"
    assert character.short_description == "new-short"
    assert result.name == "Updated Nurse"
    assert result.short_description == "new-short"
    assert db.did_commit is True


@pytest.mark.anyio
async def test_patch_admin_adult_character_rejects_disable_when_active_for_influencer():
    character = SimpleNamespace(
        id=7,
        slug="nurse",
        name="Nurse",
        description="old",
        short_description="old-short",
        prompt_template="old-template",
        default_artwork_key=None,
        lottie_text=None,
        is_active=True,
        display_order=1,
        created_at=None,
        updated_at=None,
    )
    active_overlay = SimpleNamespace(character_id=7, is_active=True)
    db = _FakeAsyncSession(characters={7: character}, execute_responses=[[active_overlay]])

    with pytest.raises(Exception) as exc:
        await patch_admin_adult_character(
            character_id=7,
            payload=AdminAdultCharacterUpdate(is_active=False),
            current_user=_admin_user(),
            db=db,
        )

    assert getattr(exc.value, "status_code", None) == 400
    assert character.is_active is True


@pytest.mark.anyio
async def test_list_admin_adult_characters_requires_admin():
    db = _FakeAsyncSession(execute_responses=[[]])

    with pytest.raises(Exception) as exc:
        await list_admin_adult_characters(current_user=_non_admin_user(), db=db)

    assert getattr(exc.value, "status_code", None) == 403


@pytest.mark.anyio
async def test_build_admin_influencer_adult_characters_returns_base_override_and_resolved(monkeypatch):
    monkeypatch.setattr(
        "app.api.admin.characters.get_influencer_character_asset_state",
        lambda influencer_id, character_id: {
            "photo_url": "https://cdn.test/influencer/juliana/characters/7/photo.png",
            "photo_2x_url": "https://cdn.test/influencer/juliana/characters/7/photo@2x.png",
            "video_mp4_url": "https://cdn.test/influencer/juliana/characters/7/video.mp4",
            "video_webm_url": "https://cdn.test/influencer/juliana/characters/7/video.webm",
            "video_preview_png_url": "https://cdn.test/influencer/juliana/characters/7/video.png",
            "has_photo": True,
            "has_complete_video_set": True,
        },
    )

    character = SimpleNamespace(
        id=7,
        slug="nurse",
        name="Nurse",
        description="desc",
        short_description="short desc",
        is_active=True,
        display_order=1,
        default_artwork_key="base/photo.png",
        lottie_text="base/lottie.json",
    )
    overlay = SimpleNamespace(
        character_id=7,
        meta_json={"accent": "red"},
        is_active=True,
    )
    db = _FakeAsyncSession(execute_responses=[[character], [overlay]])

    items = await _build_admin_influencer_adult_characters(db, "juliana")

    assert len(items) == 1
    item = items[0]
    assert item.short_description == "short desc"
    assert item.base_lottie_text == "base/lottie.json"
    assert item.photo_url == "https://cdn.test/influencer/juliana/characters/7/photo.png"
    assert item.photo_2x_url == "https://cdn.test/influencer/juliana/characters/7/photo@2x.png"
    assert item.video_mp4_url == "https://cdn.test/influencer/juliana/characters/7/video.mp4"
    assert item.video_webm_url == "https://cdn.test/influencer/juliana/characters/7/video.webm"
    assert item.video_preview_png_url == "https://cdn.test/influencer/juliana/characters/7/video.png"
    assert item.has_photo is True
    assert item.has_complete_video_set is True
    assert item.resolved_lottie_text == "base/lottie.json"


@pytest.mark.anyio
async def test_upsert_admin_influencer_character_assets_uploads_photo_without_overlay_write(monkeypatch):
    async def _save_photo(*_args, **_kwargs):
        return "influencer/juliana/characters/7/photo.png"

    monkeypatch.setattr(
        "app.api.admin.characters.upload_influencer_character_photo",
        _save_photo,
    )
    monkeypatch.setattr(
        "app.api.admin.characters.get_influencer_character_asset_state",
        lambda influencer_id, character_id: {
            "photo_url": "https://cdn.test/influencer/juliana/characters/7/photo.png",
            "photo_2x_url": None,
            "video_mp4_url": None,
            "video_webm_url": None,
            "video_preview_png_url": None,
            "has_photo": False,
            "has_complete_video_set": False,
        },
    )

    influencer = SimpleNamespace(id="juliana")
    character = SimpleNamespace(id=7, is_active=True)
    db = _FakeAsyncSession(
        influencers={"juliana": influencer},
        characters={7: character},
        execute_responses=[[]],
    )

    result = await upsert_admin_influencer_character_assets(
        "juliana",
        7,
        photo=UploadFile(file=BytesIO(b"photo"), filename="photo.png"),
        photo_2x=None,
        video_mp4=None,
        video_webm=None,
        video_preview_png=None,
        current_user=_admin_user(),
        db=db,
    )

    assert result.influencer_id == "juliana"
    assert result.character_id == 7
    assert result.photo_url == "https://cdn.test/influencer/juliana/characters/7/photo.png"
    assert result.photo_2x_url is None
    assert result.has_photo is False
    assert db.added == []
    assert db.did_commit is False


@pytest.mark.anyio
async def test_delete_admin_influencer_character_asset_clears_grouped_video(monkeypatch):
    deleted_keys = []

    async def _delete_file(key):
        deleted_keys.append(key)

    monkeypatch.setattr(
        "app.api.admin.characters.delete_influencer_character_asset",
        _delete_file,
    )
    monkeypatch.setattr(
        "app.api.admin.characters.get_influencer_character_asset_keys",
        lambda influencer_id, character_id: {
            "photo": "influencer/juliana/characters/7/photo.png",
            "photo_2x": "influencer/juliana/characters/7/photo@2x.png",
            "video_mp4": "influencer/juliana/characters/7/video.mp4",
            "video_webm": "influencer/juliana/characters/7/video.webm",
            "video_preview_png": "influencer/juliana/characters/7/video.png",
        },
    )
    monkeypatch.setattr(
        "app.api.admin.characters.get_influencer_character_asset_presence",
        lambda influencer_id, character_id: {
            "photo": True,
            "photo_2x": True,
            "video_mp4": True,
            "video_webm": True,
            "video_preview_png": False,
        },
    )
    monkeypatch.setattr(
        "app.api.admin.characters.get_influencer_character_asset_state",
        lambda influencer_id, character_id: {
            "photo_url": "https://cdn.test/influencer/juliana/characters/7/photo.png",
            "photo_2x_url": "https://cdn.test/influencer/juliana/characters/7/photo@2x.png",
            "video_mp4_url": None,
            "video_webm_url": None,
            "video_preview_png_url": None,
            "has_photo": True,
            "has_complete_video_set": False,
        },
    )

    influencer = SimpleNamespace(id="juliana")
    character = SimpleNamespace(id=7, is_active=True)
    overlay = SimpleNamespace(
        influencer_id="juliana",
        character_id=7,
        meta_json=None,
        is_active=True,
    )
    db = _FakeAsyncSession(
        influencers={"juliana": influencer},
        characters={7: character},
        execute_responses=[[overlay]],
    )

    result = await delete_admin_influencer_character_asset(
        "juliana",
        7,
        "video",
        current_user=_admin_user(),
        db=db,
    )

    assert result.photo_url == "https://cdn.test/influencer/juliana/characters/7/photo.png"
    assert result.video_mp4_url is None
    assert result.has_influencer_override is True
    assert deleted_keys == [
        "influencer/juliana/characters/7/video.mp4",
        "influencer/juliana/characters/7/video.webm",
    ]
    assert db.deleted == []
