import asyncio

import httpx
from fastapi import HTTPException

from app.gateways.elevenlabs_agents_gateway import ElevenLabsAgentsGateway


class _FakeResponse:
    def __init__(self, status_code: int, payload: dict | None = None, text: str = ""):
        self.status_code = status_code
        self._payload = payload or {}
        self.text = text

    def json(self):
        return self._payload


class _FakeAsyncClient:
    def __init__(self, *, post_response=None, post_error: Exception | None = None):
        self._post_response = post_response
        self._post_error = post_error
        self.last_json = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return None

    async def post(self, *_args, **kwargs):
        self.last_json = kwargs.get("json")
        if self._post_error:
            raise self._post_error
        return self._post_response


def _patch_async_client(monkeypatch, client: _FakeAsyncClient):
    def _factory(*_args, **_kwargs):
        return client

    monkeypatch.setattr("app.gateways.elevenlabs_agents_gateway.httpx.AsyncClient", _factory)


def test_create_agent_success_and_payload_defaults(monkeypatch):
    gateway = ElevenLabsAgentsGateway()
    gateway._api_key = "test-key"
    fake_client = _FakeAsyncClient(post_response=_FakeResponse(200, payload={"agent_id": "agent_123"}))
    _patch_async_client(monkeypatch, fake_client)

    result = asyncio.run(
        gateway.create_agent(
            name="Sophia",
            voice_id="voice_123",
            prompt_text="hello",
        )
    )

    assert result == "agent_123"
    assert fake_client.last_json["conversation_config"]["asr"]["provider"] == "scribe_realtime"
    assert fake_client.last_json["conversation_config"]["turn"]["turn_eagerness"] == "eager"
    assert fake_client.last_json["conversation_config"]["turn"]["turn_timeout"] == 5
    assert fake_client.last_json["conversation_config"]["conversation"]["max_duration_seconds"] == 3600
    assert fake_client.last_json["conversation_config"]["tts"]["model_id"] == "eleven_v3_conversational"
    assert fake_client.last_json["conversation_config"]["agent"]["first_message"] == "{{first_message}}"
    assert fake_client.last_json["conversation_config"]["agent"]["prompt"]["llm"] == "claude-sonnet-4-5"
    assert fake_client.last_json["conversation_config"]["agent"]["prompt"]["cascade_timeout_seconds"] == 4
    assert len(fake_client.last_json["conversation_config"]["agent"]["tools"]) == 2
    assert "client" not in fake_client.last_json["conversation_config"]
    override_cfg = fake_client.last_json["platform_settings"]["overrides"]["conversation_config_override"]
    assert override_cfg["agent"]["first_message"] is True
    assert override_cfg["agent"]["prompt"]["prompt"] is True
    assert override_cfg["tts"]["voice_id"] is True


def test_create_agent_upstream_error_preserves_status(monkeypatch):
    gateway = ElevenLabsAgentsGateway()
    gateway._api_key = "test-key"
    _patch_async_client(
        monkeypatch,
        _FakeAsyncClient(post_response=_FakeResponse(429, payload={}, text="rate limited")),
    )

    try:
        asyncio.run(
            gateway.create_agent(
                name="Sophia",
                voice_id="voice_123",
                prompt_text="hello",
            )
        )
        assert False, "Expected HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 429


def test_create_agent_missing_agent_id_raises_502(monkeypatch):
    gateway = ElevenLabsAgentsGateway()
    gateway._api_key = "test-key"
    _patch_async_client(monkeypatch, _FakeAsyncClient(post_response=_FakeResponse(200, payload={"ok": True})))

    try:
        asyncio.run(
            gateway.create_agent(
                name="Sophia",
                voice_id="voice_123",
                prompt_text="hello",
            )
        )
        assert False, "Expected HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 502


def test_create_agent_network_error_raises_502(monkeypatch):
    gateway = ElevenLabsAgentsGateway()
    gateway._api_key = "test-key"
    _patch_async_client(
        monkeypatch,
        _FakeAsyncClient(post_error=httpx.RequestError("boom")),
    )

    try:
        asyncio.run(
            gateway.create_agent(
                name="Sophia",
                voice_id="voice_123",
                prompt_text="hello",
            )
        )
        assert False, "Expected HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 502


def test_build_agent_create_payload_requires_voice_id():
    try:
        ElevenLabsAgentsGateway._build_agent_create_payload(  # noqa: SLF001
            name="Sophia",
            voice_id="",
            prompt_text="hello",
        )
        assert False, "Expected HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 400
