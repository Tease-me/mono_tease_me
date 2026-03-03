import asyncio

import httpx
from fastapi import HTTPException

from app.gateways.elevenlabs_voices_gateway import ElevenLabsVoicesGateway


class _FakeResponse:
    def __init__(self, status_code: int, payload: dict | None = None, text: str = ""):
        self.status_code = status_code
        self._payload = payload or {}
        self.text = text

    def json(self):
        return self._payload


class _FakeAsyncClient:
    def __init__(self, *, post_response=None, get_response=None, get_error: Exception | None = None):
        self._post_response = post_response
        self._get_response = get_response
        self._get_error = get_error

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return None

    async def post(self, *_args, **_kwargs):
        return self._post_response

    async def get(self, *_args, **_kwargs):
        if self._get_error:
            raise self._get_error
        return self._get_response


def _patch_async_client(monkeypatch, client: _FakeAsyncClient):
    def _factory(*_args, **_kwargs):
        return client

    monkeypatch.setattr("app.gateways.elevenlabs_voices_gateway.httpx.AsyncClient", _factory)


def test_create_voice_success_returns_payload(monkeypatch):
    gateway = ElevenLabsVoicesGateway()
    gateway._api_key = "test-key"
    _patch_async_client(
        monkeypatch,
        _FakeAsyncClient(post_response=_FakeResponse(200, payload={"voice_id": "voice_123"})),
    )

    result = asyncio.run(
        gateway.create_voice(
            name="Ava",
            description=None,
            labels_str=None,
            remove_background_noise=True,
            multipart_files=[("files", ("sample.mp3", b"audio", "audio/mpeg"))],
        )
    )

    assert result["voice_id"] == "voice_123"


def test_create_voice_upstream_error_preserves_status(monkeypatch):
    gateway = ElevenLabsVoicesGateway()
    gateway._api_key = "test-key"
    _patch_async_client(
        monkeypatch,
        _FakeAsyncClient(post_response=_FakeResponse(429, payload={}, text="rate limited")),
    )

    try:
        asyncio.run(
            gateway.create_voice(
                name="Ava",
                description=None,
                labels_str=None,
                remove_background_noise=False,
                multipart_files=[("files", ("sample.mp3", b"audio", "audio/mpeg"))],
            )
        )
        assert False, "Expected HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 429


def test_create_voice_missing_voice_id_raises_502(monkeypatch):
    gateway = ElevenLabsVoicesGateway()
    gateway._api_key = "test-key"
    _patch_async_client(
        monkeypatch,
        _FakeAsyncClient(post_response=_FakeResponse(200, payload={"ok": True})),
    )

    try:
        asyncio.run(
            gateway.create_voice(
                name="Ava",
                description=None,
                labels_str=None,
                remove_background_noise=False,
                multipart_files=[("files", ("sample.mp3", b"audio", "audio/mpeg"))],
            )
        )
        assert False, "Expected HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 502


def test_voice_exists_true_on_200(monkeypatch):
    gateway = ElevenLabsVoicesGateway()
    gateway._api_key = "test-key"
    _patch_async_client(
        monkeypatch,
        _FakeAsyncClient(get_response=_FakeResponse(200, payload={"voice_id": "voice_123"})),
    )

    exists = asyncio.run(gateway.voice_exists("voice_123"))
    assert exists is True


def test_voice_exists_false_on_404(monkeypatch):
    gateway = ElevenLabsVoicesGateway()
    gateway._api_key = "test-key"
    _patch_async_client(monkeypatch, _FakeAsyncClient(get_response=_FakeResponse(404, payload={})))

    exists = asyncio.run(gateway.voice_exists("voice_123"))
    assert exists is False


def test_voice_exists_false_on_other_status_or_network_error(monkeypatch):
    gateway = ElevenLabsVoicesGateway()
    gateway._api_key = "test-key"
    _patch_async_client(monkeypatch, _FakeAsyncClient(get_response=_FakeResponse(500, payload={})))
    assert asyncio.run(gateway.voice_exists("voice_123")) is False

    _patch_async_client(
        monkeypatch,
        _FakeAsyncClient(get_error=httpx.RequestError("boom")),
    )
    assert asyncio.run(gateway.voice_exists("voice_123")) is False