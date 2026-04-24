from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.mjpromoter import router as internal_router
from app.api.routes import pre_influencers as pre_influencers_route
from app.core.config import settings
from app.core.session import get_db


class _Session:
    pass


def _build_app() -> FastAPI:
    app = FastAPI()
    app.include_router(internal_router)
    app.include_router(pre_influencers_route.router)

    async def _override_db():
        yield _Session()

    app.dependency_overrides[get_db] = _override_db
    return app


def test_internal_pre_influencer_approve_requires_valid_internal_token(
    monkeypatch,
) -> None:
    app = _build_app()
    client = TestClient(app)
    calls: list[tuple[object, int]] = []

    async def _fake_approve(db, pre_id: int):
        calls.append((db, pre_id))
        return {"ok": True, "influencer_id": "loli"}

    monkeypatch.setattr(settings, "MJFP_TOKEN", "internal-secret")
    monkeypatch.setattr(
        "app.api.mjpromoter.pre_influencers.run_pre_influencer_approval",
        _fake_approve,
    )

    response = client.post(
        "/mjpromoter/pre-influencers/123/approve",
        headers={"X-Internal-Token": "internal-secret"},
    )

    assert response.status_code == 200
    assert response.json() == {"ok": True, "influencer_id": "loli"}
    assert len(calls) == 1
    assert calls[0][1] == 123


def test_internal_pre_influencer_approve_rejects_missing_token(monkeypatch) -> None:
    app = _build_app()
    client = TestClient(app)

    monkeypatch.setattr(settings, "MJFP_TOKEN", "internal-secret")

    response = client.post("/mjpromoter/pre-influencers/123/approve")

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid MJ promoter token"


def test_internal_pre_influencer_approve_rejects_invalid_token(monkeypatch) -> None:
    app = _build_app()
    client = TestClient(app)

    monkeypatch.setattr(settings, "MJFP_TOKEN", "internal-secret")

    response = client.post(
        "/mjpromoter/pre-influencers/123/approve",
        headers={"X-Internal-Token": "wrong-token"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid MJ promoter token"


def test_old_internal_pre_influencer_approve_route_is_removed(monkeypatch) -> None:
    app = _build_app()
    client = TestClient(app)

    monkeypatch.setattr(settings, "MJFP_TOKEN", "internal-secret")

    response = client.post(
        "/pre-influencers/123/internal-approve",
        headers={"X-Internal-Token": "internal-secret"},
    )

    assert response.status_code == 404
