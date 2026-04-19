from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError

from app.api.routes import auth as auth_route
from app.core.config import settings
from app.core.session import get_db
from app.data.schemas.auth import CheckEmailTokenResponse
from app.services.email_verification_service import check_email_verification_token


class FakeExecuteResult:
    def __init__(self, scalar_value=None):
        self._scalar_value = scalar_value

    def scalar(self):
        return self._scalar_value

    def scalar_one_or_none(self):
        return self._scalar_value


class FakeAsyncSession:
    def __init__(self, *, existing_user=None, fail_on_commit: bool = False):
        self._existing_user = existing_user
        self._fail_on_commit = fail_on_commit
        self.added: list[object] = []
        self.committed = False
        self.rolled_back = False
        self.refreshed = False

    async def execute(self, _stmt):
        return FakeExecuteResult(self._existing_user)

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        if self._fail_on_commit:
            raise IntegrityError("insert", None, Exception("email already exists"))
        self.committed = True
        for idx, obj in enumerate(self.added, start=1):
            if getattr(obj, "id", None) is None:
                obj.id = idx

    async def rollback(self):
        self.rolled_back = True

    async def refresh(self, _obj):
        self.refreshed = True


def _build_app(db: FakeAsyncSession) -> FastAPI:
    app = FastAPI()
    app.include_router(auth_route.router)

    async def _override_db():
        yield db

    app.dependency_overrides[get_db] = _override_db
    return app


def test_preregister_creates_unverified_user_and_returns_minimal_response(monkeypatch) -> None:
    db = FakeAsyncSession()
    app = _build_app(db)
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)

    client = TestClient(app)
    response = client.post(
        "/auth/preregister",
        json={
            "email": "user@example.com",
            "email_token": "verify-token",
            "full_name": "Jane User",
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "user_id": 1,
        "email": "user@example.com",
        "message": "User preregistered successfully.",
    }
    assert len(db.added) == 1

    created_user = db.added[0]
    assert created_user.email == "user@example.com"
    assert created_user.email_token == "verify-token"
    assert created_user.full_name == "Jane User"
    assert created_user.is_verified is False
    assert created_user.password_hash
    assert created_user.password_hash != "verify-token"
    assert created_user.email_token_expires_at is not None
    ttl = created_user.email_token_expires_at - datetime.utcnow()
    assert 23 * 3600 <= ttl.total_seconds() <= 24 * 3600
    assert "email_token" not in response.json()
    assert "password_hash" not in response.json()
    assert db.committed is True
    assert db.refreshed is True


def test_preregister_rejects_duplicate_email(monkeypatch) -> None:
    db = FakeAsyncSession(existing_user=SimpleNamespace(id=99, email="user@example.com"))
    app = _build_app(db)
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)

    client = TestClient(app)
    response = client.post(
        "/auth/preregister",
        json={
            "email": "user@example.com",
            "email_token": "verify-token",
        },
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Email already registered"}
    assert db.added == []


def test_preregister_allows_missing_full_name(monkeypatch) -> None:
    db = FakeAsyncSession()
    app = _build_app(db)
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)

    client = TestClient(app)
    response = client.post(
        "/auth/preregister",
        json={
            "email": "user@example.com",
            "email_token": "verify-token",
        },
    )

    assert response.status_code == 200
    created_user = db.added[0]
    assert created_user.full_name is None


def test_preregister_maps_commit_race_to_duplicate_email(monkeypatch) -> None:
    db = FakeAsyncSession(fail_on_commit=True)
    app = _build_app(db)
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)

    client = TestClient(app)
    response = client.post(
        "/auth/preregister",
        json={
            "email": "user@example.com",
            "email_token": "verify-token",
        },
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Email already registered"}
    assert db.rolled_back is True


@pytest.mark.anyio
async def test_preregistered_user_is_compatible_with_check_token() -> None:
    user = SimpleNamespace(
        email="user@example.com",
        email_token="verify-token",
        email_token_expires_at=datetime.utcnow().replace(microsecond=0),
        is_verified=False,
    )

    async def _fake_get_by_email(_db, email: str):
        if email == "user@example.com":
            return user
        return None

    from app.services import email_verification_service as email_verification_service_module

    original_expiry = user.email_token_expires_at
    user.email_token_expires_at = original_expiry.replace(year=original_expiry.year + 1)
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(email_verification_service_module, "get_by_email", _fake_get_by_email)
    try:
        result = await check_email_verification_token(
            db=None,
            email="user@example.com",
            token="verify-token",
        )
    finally:
        monkeypatch.undo()

    assert result == CheckEmailTokenResponse(
        ok=True,
        valid=True,
        message="Token is valid.",
    )
