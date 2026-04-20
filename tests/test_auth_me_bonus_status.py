from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import auth as auth_route
from app.utils.auth.dependencies import get_current_user


def _build_app(user) -> FastAPI:
    app = FastAPI()
    app.include_router(auth_route.router)

    async def _override_current_user():
        return user

    app.dependency_overrides[get_current_user] = _override_current_user
    return app


def _user(**overrides):
    base = {
        "id": 1,
        "email": "user@example.com",
        "username": None,
        "profile_photo_key": None,
        "is_verified": True,
        "full_name": "Jane User",
        "gender": None,
        "date_of_birth": None,
        "is_identity_verified": False,
        "is_age_verified": False,
        "verification_level": None,
        "login_bonus_pending": False,
        "login_bonus_granted_at": None,
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def test_auth_me_returns_none_login_bonus_status(monkeypatch) -> None:
    app = _build_app(_user(login_bonus_pending=False, login_bonus_granted_at=None))
    monkeypatch.setattr(
        auth_route,
        "is_request_from_age_verification_required_country",
        lambda request: False,
    )

    client = TestClient(app)
    response = client.get("/auth/me")

    assert response.status_code == 200
    assert response.json()["login_bonus_status"] == "none"


def test_auth_me_returns_pending_login_bonus_status(monkeypatch) -> None:
    app = _build_app(_user(login_bonus_pending=True, login_bonus_granted_at=None))
    monkeypatch.setattr(
        auth_route,
        "is_request_from_age_verification_required_country",
        lambda request: False,
    )

    client = TestClient(app)
    response = client.get("/auth/me")

    assert response.status_code == 200
    assert response.json()["login_bonus_status"] == "pending"


def test_auth_me_returns_granted_login_bonus_status(monkeypatch) -> None:
    app = _build_app(
        _user(
            login_bonus_pending=True,
            login_bonus_granted_at=datetime.now(timezone.utc),
        )
    )
    monkeypatch.setattr(
        auth_route,
        "is_request_from_age_verification_required_country",
        lambda request: False,
    )

    client = TestClient(app)
    response = client.get("/auth/me")

    assert response.status_code == 200
    assert response.json()["login_bonus_status"] == "granted"
