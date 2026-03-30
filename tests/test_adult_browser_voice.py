from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.data.schemas.adult.adult_conversation import AdultConversationTokenRequest
from app.services.gateways.elevenlabs import browser_voice_session as browser_session
from app.services.use_cases.adult import adult_browser_voice as adult_voice_use_case
from app.services.use_cases.adult import adult_conversation_token as adult_token_use_case


class DummyWebSocket:
    def __init__(self) -> None:
        self.messages: list[dict] = []

    async def send_json(self, payload: dict) -> None:
        self.messages.append(payload)


class DummyAsyncSessionContext:
    async def __aenter__(self):
        return object()

    async def __aexit__(self, exc_type, exc, tb):
        return False


def _async_return(value):
    async def _inner(*args, **kwargs):
        return value

    return _inner


def test_prepare_adult_browser_voice_call_requires_follow(monkeypatch) -> None:
    monkeypatch.setattr(adult_voice_use_case, "get_follow", _async_return(None))

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            adult_voice_use_case.prepare_adult_browser_voice_call(
                db=object(),
                user_id=7,
                payload=AdultConversationTokenRequest(
                    influencer_id="inf_1",
                    character_id=4,
                ),
            )
        )

    assert exc.value.status_code == 403


def test_prepare_adult_browser_voice_call_returns_browser_session_config(monkeypatch) -> None:
    monkeypatch.setattr(adult_voice_use_case, "get_follow", _async_return(object()))
    monkeypatch.setattr(
        adult_voice_use_case,
        "get_influencer_by_id",
        _async_return(
            SimpleNamespace(
                influencer_agent_id_third_part="agent_1",
                display_name="Sofi",
                voice_id="voice_1",
                native_language="es",
            )
        ),
    )
    monkeypatch.setattr(
        adult_voice_use_case,
        "get_adult_character_by_id",
        _async_return(
            SimpleNamespace(
                is_active=True,
                first_messages=["hola"],
                prompt_template="Hi {user_name}, I am {influencer_name}",
            )
        ),
    )
    monkeypatch.setattr(
        adult_voice_use_case,
        "get_active_influencer_character_meta",
        _async_return(object()),
    )
    monkeypatch.setattr(
        adult_voice_use_case,
        "get_user_by_id",
        _async_return(SimpleNamespace(full_name="Alex", username="alex")),
    )
    monkeypatch.setattr(
        adult_voice_use_case,
        "can_afford_adult_character_voice",
        _async_return((True, 0, 0)),
    )
    monkeypatch.setattr(
        adult_voice_use_case,
        "get_remaining_adult_character_voice_secs",
        _async_return(123),
    )
    monkeypatch.setattr(adult_voice_use_case, "pick_random_first_message", lambda values: values[0])
    monkeypatch.setattr(adult_voice_use_case, "get_or_create_chat", _async_return("chat_1"))
    monkeypatch.setattr(adult_voice_use_case, "compute_max_duration", lambda secs: 99)

    result = asyncio.run(
        adult_voice_use_case.prepare_adult_browser_voice_call(
            db=object(),
            user_id=7,
            payload=AdultConversationTokenRequest(
                influencer_id="inf_1",
                character_id=4,
            ),
        )
    )

    assert result.agent_id == "agent_1"
    assert result.chat_id == "chat_1"
    assert result.credits_remainder_secs == 123
    assert result.max_duration_secs == 99
    assert result.greeting_used == "hola"
    assert result.voice_id == "voice_1"
    assert result.native_language == "es"
    assert result.prompt == "Hi Alex, I am Sofi"


def test_create_adult_conversation_token_returns_unit_price_cents(monkeypatch) -> None:
    monkeypatch.setattr(
        adult_token_use_case,
        "get_influencer_by_id",
        _async_return(
            SimpleNamespace(
                influencer_agent_id_third_part="agent_1",
                display_name="Sofi",
                voice_id="voice_1",
                native_language="es",
            )
        ),
    )
    monkeypatch.setattr(
        adult_token_use_case,
        "get_adult_character_by_id",
        _async_return(
            SimpleNamespace(
                id=4,
                is_active=True,
                first_messages=["hola"],
                prompt_template="Hi {user_name}, I am {influencer_name}",
            )
        ),
    )
    monkeypatch.setattr(
        adult_token_use_case,
        "get_active_influencer_character_meta",
        _async_return(object()),
    )
    monkeypatch.setattr(
        adult_token_use_case,
        "get_user_by_id",
        _async_return(SimpleNamespace(full_name="Alex", username="alex")),
    )
    monkeypatch.setattr(
        adult_token_use_case,
        "can_afford_adult_character_voice",
        _async_return((True, 0, 0)),
    )
    monkeypatch.setattr(
        adult_token_use_case,
        "get_remaining_adult_character_voice_secs",
        _async_return(123),
    )
    monkeypatch.setattr(
        adult_token_use_case,
        "get_adult_character_voice_unit_price_cents",
        _async_return(3),
    )
    monkeypatch.setattr(
        adult_token_use_case,
        "pick_random_first_message",
        lambda values: values[0],
    )

    class DummyGateway:
        async def get_conversation_token(self, _agent_id: str) -> str:
            return "token_1"

    result = asyncio.run(
        adult_token_use_case.create_adult_conversation_token(
            db=object(),
            user_id=7,
            payload=AdultConversationTokenRequest(
                influencer_id="inf_1",
                character_id=4,
            ),
            gateway=DummyGateway(),
        )
    )

    assert result.token == "token_1"
    assert result.credits_remainder_secs == 123
    assert result.unit_price_cents == 3
    assert result.prompt == "Hi Alex, I am Sofi"


def test_browser_voice_session_builds_turn_detection_override() -> None:
    session = browser_session.AdultBrowserVoiceSession(
        client_ws=DummyWebSocket(),
        user_id=7,
        influencer_id="inf_1",
        character_id=4,
        agent_id="agent_1",
        voice_id="voice_1",
        prompt="prompt text",
        greeting_used="hello",
        language="en",
        chat_id="chat_1",
        credits_remainder_secs=120,
        max_duration_secs=100,
    )

    payload = session._build_init_payload()

    assert payload["type"] == "conversation_initiation_client_data"
    override = payload["conversation_config_override"]
    assert override["agent"]["prompt"]["prompt"] == "prompt text"
    assert override["agent"]["first_message"] == "hello"
    assert override["tts"]["voice_id"] == "voice_1"
    assert override["turn_detection"] == {
        "type": "server_vad",
        "silence_duration_ms": 120,
        "threshold": 0.6,
    }


def test_browser_voice_session_registers_conversation_without_blocking_client(monkeypatch) -> None:
    ws = DummyWebSocket()
    session = browser_session.AdultBrowserVoiceSession(
        client_ws=ws,
        user_id=7,
        influencer_id="inf_1",
        character_id=4,
        agent_id="agent_1",
        voice_id="voice_1",
        prompt="prompt text",
        greeting_used="hello",
        language="en",
        chat_id="chat_1",
        credits_remainder_secs=120,
        max_duration_secs=100,
    )

    registration_started = asyncio.Event()
    registration_released = asyncio.Event()
    registered: list[str] = []
    polled: list[tuple] = []
    guarded: list[tuple] = []

    async def fake_register_pending(conversation_id: str) -> None:
        registered.append(conversation_id)
        registration_started.set()
        await registration_released.wait()

    async def fake_poll(*args, **kwargs):
        polled.append((args, kwargs))

    async def fake_guard(*args, **kwargs):
        guarded.append((args, kwargs))

    monkeypatch.setattr(session, "_register_pending_conversation", fake_register_pending)
    monkeypatch.setattr(browser_session, "poll_and_persist_conversation", fake_poll)
    monkeypatch.setattr(browser_session, "end_conversation_after_credits", fake_guard)

    async def _run() -> None:
        await session._handle_conversation_metadata(
            {
                "conversation_initiation_metadata_event": {
                    "conversation_id": "conv_1",
                }
            }
        )
        await registration_started.wait()

        assert ws.messages[-2] == {
            "type": "call_started",
            "chat_id": "chat_1",
            "conversation_id": "conv_1",
            "credits_remainder_secs": 120,
        }
        assert ws.messages[-1] == {"type": "state", "state": "listening"}
        assert registered == ["conv_1"]

        registration_released.set()
        await asyncio.sleep(0)

    asyncio.run(_run())

    assert session.conversation_id == "conv_1"
    assert polled
    assert guarded


def test_browser_voice_session_flushes_held_audio_after_ai_stops(monkeypatch) -> None:
    ws = DummyWebSocket()
    session = browser_session.AdultBrowserVoiceSession(
        client_ws=ws,
        user_id=7,
        influencer_id="inf_1",
        character_id=4,
        agent_id="agent_1",
        voice_id="voice_1",
        prompt="prompt text",
        greeting_used="hello",
        language="en",
        chat_id="chat_1",
        credits_remainder_secs=120,
        max_duration_secs=100,
    )
    session._is_active = True
    session._ai_speaking = True
    session._held_audio_queue = ["chunk_a", "chunk_b"]

    sent: list[str] = []

    async def fake_send_audio(chunk: str) -> None:
        sent.append(chunk)

    async def fake_sleep(_: float) -> None:
        return None

    monkeypatch.setattr(session, "_send_audio_to_convai", fake_send_audio)
    monkeypatch.setattr(browser_session.asyncio, "sleep", fake_sleep)

    asyncio.run(session._flush_held_audio_after_delay())

    assert sent == ["chunk_a", "chunk_b"]
    assert session._held_audio_queue == []
    assert session._ai_speaking is False
    assert ws.messages[-1] == {"type": "state", "state": "listening"}
