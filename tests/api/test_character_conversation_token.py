import os

import pytest

os.environ.setdefault("OPENAI_API_KEY", "test-key")

from app.api.adult.character_conversation import get_character_conversation_token
from app.data.schemas.adult.character_conversation import CharacterConversationTokenResponse


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_get_character_conversation_token_delegates_to_use_case(monkeypatch):
    expected = CharacterConversationTokenResponse(
        token="tok_123",
        agent_id="agent_123",
        prompt="character prompt",
        greeting_used="hello there",
        voice_id="voice_123",
        native_language="en",
        influencer_id="jules",
        character_id=7,
    )

    async def _use_case(*, db, payload):
        assert payload.influencer_id == "jules"
        assert payload.character_id == 7
        assert db is fake_db
        return expected

    fake_db = object()
    monkeypatch.setattr(
        "app.api.adult.character_conversation.create_character_conversation_token",
        _use_case,
    )

    result = await get_character_conversation_token(
        influencer_id="jules",
        character_id=7,
        _current_user=object(),
        db=fake_db,
    )

    assert result == expected
