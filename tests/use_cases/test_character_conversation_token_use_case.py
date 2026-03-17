from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.data.schemas.adult.character_conversation import CharacterConversationTokenRequest
from app.services.use_cases.adult.character_conversation_token import create_character_conversation_token


@pytest.fixture
def anyio_backend():
    return "asyncio"


class _Gateway:
    def __init__(self, token: str):
        self.token = token
        self.agent_ids: list[str] = []

    async def get_conversation_token(self, agent_id: str) -> str:
        self.agent_ids.append(agent_id)
        return self.token


@pytest.mark.anyio
async def test_create_character_conversation_token_success(monkeypatch):
    influencer = SimpleNamespace(
        influencer_agent_id_third_part="agent_123",
        voice_id="voice_123",
        native_language="es",
    )
    character = SimpleNamespace(
        is_active=True,
        prompt_template="character prompt",
        first_messages=["one", "two"],
    )
    overlay = SimpleNamespace(is_active=True)
    gateway = _Gateway("token_123")

    async def _get_influencer(_db, influencer_id):
        assert influencer_id == "jules"
        return influencer

    async def _get_character(_db, character_id):
        assert character_id == 7
        return character

    async def _get_overlay(_db, influencer_id, character_id):
        assert influencer_id == "jules"
        assert character_id == 7
        return overlay

    monkeypatch.setattr(
        "app.services.use_cases.adult.character_conversation_token.get_influencer_by_id",
        _get_influencer,
    )
    monkeypatch.setattr(
        "app.services.use_cases.adult.character_conversation_token.get_adult_character_by_id",
        _get_character,
    )
    monkeypatch.setattr(
        "app.services.use_cases.adult.character_conversation_token.get_active_influencer_character_meta",
        _get_overlay,
    )
    monkeypatch.setattr(
        "app.services.use_cases.adult.character_conversation_token.pick_random_first_message",
        lambda messages: messages[1],
    )

    result = await create_character_conversation_token(
        db=object(),
        payload=CharacterConversationTokenRequest(influencer_id="jules", character_id=7),
        gateway=gateway,
    )

    assert result.token == "token_123"
    assert result.agent_id == "agent_123"
    assert result.prompt == "character prompt"
    assert result.greeting_used == "two"
    assert result.voice_id == "voice_123"
    assert result.native_language == "es"
    assert result.influencer_id == "jules"
    assert result.character_id == 7
    assert gateway.agent_ids == ["agent_123"]


@pytest.mark.anyio
async def test_create_character_conversation_token_returns_null_greeting_when_empty(monkeypatch):
    influencer = SimpleNamespace(
        influencer_agent_id_third_part="agent_123",
        voice_id=None,
        native_language=None,
    )
    character = SimpleNamespace(
        is_active=True,
        prompt_template="character prompt",
        first_messages=[],
    )
    gateway = _Gateway("token_123")

    async def _get_influencer(*_args, **_kwargs):
        return influencer

    async def _get_character(*_args, **_kwargs):
        return character

    async def _get_overlay(*_args, **_kwargs):
        return SimpleNamespace(is_active=True)

    monkeypatch.setattr(
        "app.services.use_cases.adult.character_conversation_token.get_influencer_by_id",
        _get_influencer,
    )
    monkeypatch.setattr(
        "app.services.use_cases.adult.character_conversation_token.get_adult_character_by_id",
        _get_character,
    )
    monkeypatch.setattr(
        "app.services.use_cases.adult.character_conversation_token.get_active_influencer_character_meta",
        _get_overlay,
    )

    result = await create_character_conversation_token(
        db=object(),
        payload=CharacterConversationTokenRequest(influencer_id="jules", character_id=7),
        gateway=gateway,
    )

    assert result.greeting_used is None
    assert result.voice_id == settings.ELEVENLABS_VOICE_ID
    assert result.native_language == "en"


@pytest.mark.anyio
async def test_create_character_conversation_token_raises_for_missing_influencer(monkeypatch):
    async def _get_influencer(*_args, **_kwargs):
        return None

    monkeypatch.setattr(
        "app.services.use_cases.adult.character_conversation_token.get_influencer_by_id",
        _get_influencer,
    )

    with pytest.raises(HTTPException) as exc:
        await create_character_conversation_token(
            db=object(),
            payload=CharacterConversationTokenRequest(influencer_id="jules", character_id=7),
            gateway=_Gateway("token_123"),
        )

    assert exc.value.status_code == 404
    assert exc.value.detail == "Influencer not found"
