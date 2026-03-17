import asyncio

import httpx
from fastapi import HTTPException

from app.gateways.adult.adult_conversation_gateway import ElevenLabsAdultConversationGateway


class _FakeResponse:
    def __init__(self, status_code: int, payload: dict | None = None, text: str = ""):
        self.status_code = status_code
        self._payload = payload or {}
        self.text = text

    def json(self):
        return self._payload


class _FakeAsyncClient:
    def __init__(self, *, get_response=None, get_error: Exception | None = None):
        self._get_response = get_response
        self._get_error = get_error

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return None

    async def get(self, *_args, **_kwargs):
        if self._get_error:
            raise self._get_error
        return self._get_response


def _patch_async_client(monkeypatch, client: _FakeAsyncClient):
    def _factory(*_args, **_kwargs):
        return client

    monkeypatch.setattr(
        "app.gateways.adult.adult_conversation_gateway.httpx.AsyncClient",
        _factory,
    )


def test_get_conversation_token_success(monkeypatch):
    gateway = ElevenLabsAdultConversationGateway()
    gateway._api_key = "test-key"
    _patch_async_client(monkeypatch, _FakeAsyncClient(get_response=_FakeResponse(200, {"token": "tok_123"})))

    result = asyncio.run(gateway.get_conversation_token("agent_123"))

    assert result == "tok_123"


def test_get_conversation_token_upstream_error(monkeypatch):
    gateway = ElevenLabsAdultConversationGateway()
    gateway._api_key = "test-key"
    _patch_async_client(monkeypatch, _FakeAsyncClient(get_response=_FakeResponse(429, text="rate limited")))

    try:
        asyncio.run(gateway.get_conversation_token("agent_123"))
        assert False, "Expected HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 429


def test_get_conversation_token_network_error(monkeypatch):
    gateway = ElevenLabsAdultConversationGateway()
    gateway._api_key = "test-key"
    _patch_async_client(monkeypatch, _FakeAsyncClient(get_error=httpx.RequestError("boom")))

    try:
        asyncio.run(gateway.get_conversation_token("agent_123"))
        assert False, "Expected HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 502
