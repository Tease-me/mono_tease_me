from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.data.models import Influencer
from sqlalchemy.exc import IntegrityError

from app.api.routes import auth as auth_route
from app.core.config import settings
from app.core.session import get_db
from app.data.schemas.auth import CheckEmailTokenResponse
from app.services.email_verification_service import check_email_verification_token

INTERNAL_TOKEN = "test-mj-promoter-token"


class FakeExecuteResult:
    def __init__(self, scalar_value=None):
        self._scalar_value = scalar_value

    def scalar(self):
        return self._scalar_value

    def scalar_one_or_none(self):
        return self._scalar_value


class FakeAsyncSession:
    def __init__(
        self,
        *,
        existing_user=None,
        existing_telegram_user=None,
        influencer: object | None = None,
        fail_on_commit: bool = False,
    ):
        self._execute_results = [existing_user, existing_telegram_user]
        self._influencer = influencer
        self._fail_on_commit = fail_on_commit
        self.added: list[object] = []
        self.committed = False
        self.rolled_back = False
        self.refreshed = False

    async def execute(self, _stmt):
        if self._execute_results:
            return FakeExecuteResult(self._execute_results.pop(0))
        return FakeExecuteResult(None)

    async def get(self, model, key):
        if model is Influencer and self._influencer is not None:
            return self._influencer
        return None

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
    db = FakeAsyncSession(influencer=SimpleNamespace(id="loli"))
    app = _build_app(db)
    follow_calls: list[tuple[str, int]] = []
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)
    monkeypatch.setattr(settings, "MJFP_TOKEN", INTERNAL_TOKEN)
    monkeypatch.setattr(settings, "FRONTEND_URL", "https://www.teaseme.live")
    monkeypatch.setattr(auth_route.secrets, "token_urlsafe", lambda _n: "generated-verify-token")
    monkeypatch.setattr(
        auth_route,
        "create_follow_if_missing",
        _fake_follow_recorder(follow_calls),
    )

    client = TestClient(app)
    response = client.post(
        "/auth/preregister",
        headers={"X-Internal-Token": INTERNAL_TOKEN},
        json={
            "email": "user@example.com",
            "influencer_id": "loli",
            "telegram_id": 987654321,
            "full_name": "Jane User",
        },
    )

    assert response.status_code == 200
    response_json = response.json()
    assert response_json == {
        "ok": True,
        "user_id": 1,
        "email": "user@example.com",
        "message": "User preregistered successfully.",
        "verification_url": "https://www.teaseme.live/verify-email?email=user%40example.com&token=generated-verify-token",
    }
    assert len(db.added) == 1

    created_user = db.added[0]
    assert created_user.email == "user@example.com"
    assert created_user.email_token == "generated-verify-token"
    assert created_user.full_name == "Jane User"
    assert created_user.telegram_id == 987654321
    assert created_user.is_verified is False
    assert created_user.password_hash
    assert created_user.password_hash != "verify-token"
    assert created_user.email_token_expires_at is not None
    ttl = created_user.email_token_expires_at - datetime.utcnow()
    assert 23 * 3600 <= ttl.total_seconds() <= 24 * 3600
    assert "email_token" not in response_json
    assert "password_hash" not in response_json
    assert db.committed is True
    assert db.refreshed is True
    assert follow_calls == [("loli", 1)]


def test_preregister_verification_url_is_url_encoded(monkeypatch) -> None:
    db = FakeAsyncSession(influencer=SimpleNamespace(id="loli"))
    app = _build_app(db)
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)
    monkeypatch.setattr(settings, "MJFP_TOKEN", INTERNAL_TOKEN)
    monkeypatch.setattr(settings, "FRONTEND_URL", "https://www.teaseme.live/")
    monkeypatch.setattr(auth_route.secrets, "token_urlsafe", lambda _n: "verify token/123")
    monkeypatch.setattr(
        auth_route,
        "create_follow_if_missing",
        _fake_follow_recorder([]),
    )

    client = TestClient(app)
    response = client.post(
        "/auth/preregister",
        headers={"X-Internal-Token": INTERNAL_TOKEN},
        json={
            "email": "user+alias@example.com",
            "influencer_id": "loli",
            "telegram_id": 987654321,
        },
    )

    assert response.status_code == 200
    verification_url = response.json()["verification_url"]
    parsed = urlparse(verification_url)
    query = parse_qs(parsed.query)
    assert parsed.scheme == "https"
    assert parsed.netloc == "www.teaseme.live"
    assert parsed.path == "/verify-email"
    assert query == {
        "email": ["user+alias@example.com"],
        "token": ["verify token/123"],
    }


def test_preregister_rejects_duplicate_email(monkeypatch) -> None:
    db = FakeAsyncSession(
        existing_user=SimpleNamespace(id=99, email="user@example.com"),
        influencer=SimpleNamespace(id="loli"),
    )
    app = _build_app(db)
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)
    monkeypatch.setattr(settings, "MJFP_TOKEN", INTERNAL_TOKEN)

    client = TestClient(app)
    response = client.post(
        "/auth/preregister",
        headers={"X-Internal-Token": INTERNAL_TOKEN},
        json={
            "email": "user@example.com",
            "influencer_id": "loli",
            "telegram_id": 987654321,
        },
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Email already registered"}
    assert db.added == []


def test_preregister_allows_missing_full_name(monkeypatch) -> None:
    db = FakeAsyncSession(influencer=SimpleNamespace(id="loli"))
    app = _build_app(db)
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)
    monkeypatch.setattr(settings, "MJFP_TOKEN", INTERNAL_TOKEN)
    monkeypatch.setattr(auth_route.secrets, "token_urlsafe", lambda _n: "generated-verify-token")
    monkeypatch.setattr(
        auth_route,
        "create_follow_if_missing",
        _fake_follow_recorder([]),
    )

    client = TestClient(app)
    response = client.post(
        "/auth/preregister",
        headers={"X-Internal-Token": INTERNAL_TOKEN},
        json={
            "email": "user@example.com",
            "influencer_id": "loli",
            "telegram_id": 987654321,
        },
    )

    assert response.status_code == 200
    created_user = db.added[0]
    assert created_user.full_name is None


def test_preregister_maps_commit_race_to_duplicate_email(monkeypatch) -> None:
    db = FakeAsyncSession(fail_on_commit=True, influencer=SimpleNamespace(id="loli"))
    app = _build_app(db)
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)
    monkeypatch.setattr(settings, "MJFP_TOKEN", INTERNAL_TOKEN)

    client = TestClient(app)
    response = client.post(
        "/auth/preregister",
        headers={"X-Internal-Token": INTERNAL_TOKEN},
        json={
            "email": "user@example.com",
            "influencer_id": "loli",
            "telegram_id": 987654321,
        },
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Email already registered"}
    assert db.rolled_back is True


def test_preregister_rejects_existing_telegram_id(monkeypatch) -> None:
    db = FakeAsyncSession(
        existing_telegram_user=SimpleNamespace(id=77, telegram_id=987654321),
        influencer=SimpleNamespace(id="loli"),
    )
    app = _build_app(db)
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)
    monkeypatch.setattr(settings, "MJFP_TOKEN", INTERNAL_TOKEN)

    client = TestClient(app)
    response = client.post(
        "/auth/preregister",
        headers={"X-Internal-Token": INTERNAL_TOKEN},
        json={
            "email": "user@example.com",
            "influencer_id": "loli",
            "telegram_id": 987654321,
        },
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Telegram ID already registered"}
    assert db.added == []


def test_preregister_rejects_unknown_influencer(monkeypatch) -> None:
    db = FakeAsyncSession(influencer=None)
    app = _build_app(db)
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)
    monkeypatch.setattr(settings, "MJFP_TOKEN", INTERNAL_TOKEN)

    client = TestClient(app)
    response = client.post(
        "/auth/preregister",
        headers={"X-Internal-Token": INTERNAL_TOKEN},
        json={
            "email": "user@example.com",
            "influencer_id": "missing",
            "telegram_id": 987654321,
        },
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Influencer not found"}


def test_preregister_requires_influencer_id_and_telegram_id(monkeypatch) -> None:
    db = FakeAsyncSession(influencer=SimpleNamespace(id="loli"))
    app = _build_app(db)
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)
    monkeypatch.setattr(settings, "MJFP_TOKEN", INTERNAL_TOKEN)

    client = TestClient(app)
    response = client.post(
        "/auth/preregister",
        headers={"X-Internal-Token": INTERNAL_TOKEN},
        json={
            "email": "user@example.com",
        },
    )

    assert response.status_code == 422


def test_preregister_requires_internal_token(monkeypatch) -> None:
    db = FakeAsyncSession(influencer=SimpleNamespace(id="loli"))
    app = _build_app(db)
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)
    monkeypatch.setattr(settings, "MJFP_TOKEN", INTERNAL_TOKEN)

    client = TestClient(app)
    response = client.post(
        "/auth/preregister",
        json={
            "email": "user@example.com",
            "influencer_id": "loli",
            "telegram_id": 987654321,
        },
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid MJ promoter token"}


def test_preregister_rejects_wrong_internal_token(monkeypatch) -> None:
    db = FakeAsyncSession(influencer=SimpleNamespace(id="loli"))
    app = _build_app(db)
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)
    monkeypatch.setattr(settings, "MJFP_TOKEN", INTERNAL_TOKEN)

    client = TestClient(app)
    response = client.post(
        "/auth/preregister",
        headers={"X-Internal-Token": "wrong-token"},
        json={
            "email": "user@example.com",
            "influencer_id": "loli",
            "telegram_id": 987654321,
        },
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid MJ promoter token"}


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


def _fake_follow_recorder(calls: list[tuple[str, int]]):
    async def _inner(db, influencer_id: str, user_id: int):
        calls.append((influencer_id, user_id))
        return SimpleNamespace(influencer_id=influencer_id, user_id=user_id)

    return _inner
