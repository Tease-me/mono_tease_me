from __future__ import annotations

import importlib

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import settings


def _build_app_with_mj_router(monkeypatch, app_env: str) -> FastAPI:
    monkeypatch.setattr(settings, "APP_ENV", app_env)
    router_module = importlib.import_module("app.api.mjpromoter.router")
    router_module = importlib.reload(router_module)

    app = FastAPI()
    app.include_router(router_module.router)
    return app


def test_mjpromoter_routes_are_hidden_from_openapi_in_production(monkeypatch) -> None:
    client = TestClient(_build_app_with_mj_router(monkeypatch, "production"))

    response = client.get("/openapi.json")

    assert response.status_code == 200
    paths = response.json()["paths"]
    assert not any(path.startswith("/mjpromoter/") for path in paths)


def test_mjpromoter_routes_are_visible_in_openapi_outside_production(monkeypatch) -> None:
    client = TestClient(_build_app_with_mj_router(monkeypatch, "local"))

    response = client.get("/openapi.json")

    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/mjpromoter/pre-influencers/step-progress" in paths


def test_mjpromoter_routes_still_work_when_hidden_from_openapi(monkeypatch) -> None:
    monkeypatch.setattr(settings, "MJFP_TOKEN", "internal-secret")
    client = TestClient(_build_app_with_mj_router(monkeypatch, "production"))

    response = client.post(
        "/mjpromoter/pre-influencers/step-progress",
        json={"invite_code": "invite-123", "invitee_email": "user@example.com"},
        headers={"X-Internal-Token": "wrong-token"},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid MJ promoter token"}
