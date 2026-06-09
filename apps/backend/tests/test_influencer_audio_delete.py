from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.testclient import TestClient

os.environ.setdefault("OPENAI_API_KEY", "test-key")

from app.api.routes import influencer as influencer_route


def _build_app() -> FastAPI:
    app = FastAPI()
    app.include_router(influencer_route.router)
    return app


def test_delete_influencer_audio_accepts_influencer_prefix(monkeypatch) -> None:
    client = TestClient(_build_app())
    captured: list[str] = []

    async def _fake_delete(key: str):
        captured.append(key)

    monkeypatch.setattr(influencer_route, "delete_file_from_s3", _fake_delete)

    response = client.request(
        "DELETE",
        "/influencer/influencer-audio/creator123",
        json={"key": "influencer-audio/creator123/test.webm"},
    )

    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert captured == ["influencer-audio/creator123/test.webm"]


def test_delete_influencer_audio_rejects_pre_influencer_prefix(monkeypatch) -> None:
    client = TestClient(_build_app())
    called = False

    async def _fake_delete(_key: str):
        nonlocal called
        called = True

    monkeypatch.setattr(influencer_route, "delete_file_from_s3", _fake_delete)

    response = client.request(
        "DELETE",
        "/influencer/influencer-audio/creator123",
        json={"key": "pre-influencer-audio/creator123/test.webm"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid audio key for this influencer"
    assert called is False
