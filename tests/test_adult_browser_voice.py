from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.data.schemas.adult.adult_conversation import AdultConversationTokenRequest
from app.services.gateways.elevenlabs import browser_voice_session as browser_session
from app.services.use_cases.adult import adult_browser_voice as adult_voice_use_case


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
    monkeypatch.setattr(adult_voice_use_case, "get_valid_subscription", _async_return(object()))
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
        "silence_duration_ms": 200,
        "threshold": 0.6,
    }


def test_browser_voice_session_registers_conversation_and_notifies_client(monkeypatch) -> None:
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

    registered: list[tuple] = []
    polled: list[tuple] = []
    guarded: list[tuple] = []

    async def fake_save_pending(*args, **kwargs):
        registered.append((args, kwargs))
        return "chat_1"

    async def fake_poll(*args, **kwargs):
        polled.append((args, kwargs))

    async def fake_guard(*args, **kwargs):
        guarded.append((args, kwargs))

    monkeypatch.setattr(browser_session, "SessionLocal", lambda: DummyAsyncSessionContext())
    monkeypatch.setattr(browser_session, "save_pending_conversation", fake_save_pending)
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
        await asyncio.sleep(0)

    asyncio.run(_run())

    assert session.conversation_id == "conv_1"
    assert registered
    assert ws.messages[-2] == {
        "type": "call_started",
        "chat_id": "chat_1",
        "conversation_id": "conv_1",
        "credits_remainder_secs": 120,
    }
    assert ws.messages[-1] == {"type": "state", "state": "listening"}

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
