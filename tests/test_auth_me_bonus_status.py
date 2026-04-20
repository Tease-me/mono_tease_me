from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import auth as auth_route
from app.core.session import get_db
from app.utils.auth.dependencies import get_current_user


class FakeAsyncSession:
    def __init__(self, user):
        self.user = user
        self.added: list[object] = []
        self.commits = 0

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.commits += 1


def _build_app(user, db: FakeAsyncSession) -> FastAPI:
    app = FastAPI()
    app.include_router(auth_route.router)

    async def _override_current_user():
        return user

    async def _override_db():
        yield db

    app.dependency_overrides[get_current_user] = _override_current_user
    app.dependency_overrides[get_db] = _override_db
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
    user = _user(login_bonus_pending=False, login_bonus_granted_at=None)
    db = FakeAsyncSession(user)
    app = _build_app(user, db)
    monkeypatch.setattr(
        auth_route,
        "is_request_from_age_verification_required_country",
        lambda request: False,
    )

    client = TestClient(app)
    response = client.get("/auth/me")

    assert response.status_code == 200
    assert response.json()["login_bonus_status"] == "none"
    assert db.commits == 0


def test_auth_me_returns_pending_login_bonus_status(monkeypatch) -> None:
    user = _user(login_bonus_pending=True, login_bonus_granted_at=None)
    db = FakeAsyncSession(user)
    app = _build_app(user, db)
    monkeypatch.setattr(
        auth_route,
        "is_request_from_age_verification_required_country",
        lambda request: False,
    )

    client = TestClient(app)
    response = client.get("/auth/me")

    assert response.status_code == 200
    assert response.json()["login_bonus_status"] == "pending"
    assert db.commits == 0


def test_auth_me_returns_granted_once_then_none(monkeypatch) -> None:
    user = _user(
        login_bonus_pending=False,
        login_bonus_granted_at=datetime.now(timezone.utc),
    )
    db = FakeAsyncSession(user)
    app = _build_app(user, db)
    monkeypatch.setattr(
        auth_route,
        "is_request_from_age_verification_required_country",
        lambda request: False,
    )

    client = TestClient(app)

    first_response = client.get("/auth/me")
    assert first_response.status_code == 200
    assert first_response.json()["login_bonus_status"] == "granted"
    assert user.login_bonus_granted_at is None
    assert db.commits == 1

    second_response = client.get("/auth/me")
    assert second_response.status_code == 200
    assert second_response.json()["login_bonus_status"] == "none"
    assert db.commits == 1
