from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import auth as auth_route
from app.core.config import settings
from app.core.session import get_db


class FakeExecuteResult:
    def __init__(self, scalar_value=None):
        self._scalar_value = scalar_value

    def scalar_one_or_none(self):
        return self._scalar_value


class FakeAsyncSession:
    def __init__(self, user):
        self.user = user
        self.added: list[object] = []
        self.commits = 0
        self.rollbacks = 0

    async def execute(self, _stmt):
        return FakeExecuteResult(self.user)

    async def get(self, model, key):
        return self.user if getattr(self.user, "id", None) == key else None

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.commits += 1

    async def rollback(self):
        self.rollbacks += 1


def _build_app(db: FakeAsyncSession) -> FastAPI:
    app = FastAPI()
    app.include_router(auth_route.router)

    async def _override_db():
        yield db

    app.dependency_overrides[get_db] = _override_db
    return app


def _user(**overrides):
    base = {
        "id": 1,
        "email": "user@example.com",
        "password_hash": "stored-hash",
        "is_verified": False,
        "email_token": "verify-token",
        "email_token_expires_at": datetime.utcnow() + timedelta(hours=1),
        "first_login_at": None,
        "login_bonus_granted_at": None,
        "login_bonus_pending": False,
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def test_verify_email_grants_bonus_on_first_success(monkeypatch) -> None:
    db = FakeAsyncSession(_user())
    app = _build_app(db)
    topup_calls: list[dict] = []

    async def _fake_topup_wallet(_db, *, user_id: int, influencer_id: str, cents: int, source: str, is_18: bool = False):
        topup_calls.append(
            {
                "user_id": user_id,
                "influencer_id": influencer_id,
                "cents": cents,
                "source": source,
                "is_18": is_18,
            }
        )
        return cents

    async def _fake_notify_email_verified(_email: str):
        return None

    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)
    monkeypatch.setattr(settings, "FIRST_LOGIN_BONUS_CENTS", 500)
    monkeypatch.setattr(settings, "FIRST_LOGIN_BONUS_INFLUENCER_ID", "loli")
    monkeypatch.setattr(auth_route, "topup_wallet", _fake_topup_wallet)
    monkeypatch.setattr(auth_route, "notify_email_verified", _fake_notify_email_verified)
    monkeypatch.setattr(auth_route.asyncio, "create_task", lambda coro: coro.close())

    client = TestClient(app)
    response = client.get("/auth/verify-email", params={"token": "verify-token"})

    assert response.status_code == 200
    assert topup_calls == [
        {
            "user_id": 1,
            "influencer_id": "loli",
            "cents": 500,
            "source": "first_login_bonus",
            "is_18": False,
        }
    ]
    assert db.user.is_verified is True
    assert db.user.email_token is None
    assert db.user.email_token_expires_at is None
    assert db.user.first_login_at is not None
    assert db.user.login_bonus_granted_at is not None
    assert db.user.login_bonus_pending is False


def test_verify_email_bonus_failure_does_not_block_verification_and_marks_pending(monkeypatch) -> None:
    db = FakeAsyncSession(_user())
    app = _build_app(db)

    async def _failing_topup_wallet(*args, **kwargs):
        raise RuntimeError("wallet failed")

    async def _fake_notify_email_verified(_email: str):
        return None

    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)
    monkeypatch.setattr(settings, "FIRST_LOGIN_BONUS_CENTS", 500)
    monkeypatch.setattr(settings, "FIRST_LOGIN_BONUS_INFLUENCER_ID", "loli")
    monkeypatch.setattr(auth_route, "topup_wallet", _failing_topup_wallet)
    monkeypatch.setattr(auth_route, "notify_email_verified", _fake_notify_email_verified)
    monkeypatch.setattr(auth_route.asyncio, "create_task", lambda coro: coro.close())

    client = TestClient(app)
    response = client.get("/auth/verify-email", params={"token": "verify-token"})

    assert response.status_code == 200
    assert db.user.is_verified is True
    assert db.user.first_login_at is not None
    assert db.user.login_bonus_granted_at is None
    assert db.user.login_bonus_pending is True
    assert db.rollbacks == 1


def test_verify_email_does_not_grant_bonus_twice(monkeypatch) -> None:
    now = datetime.now(timezone.utc)
    db = FakeAsyncSession(
        _user(
            first_login_at=now,
            login_bonus_granted_at=now,
            login_bonus_pending=False,
        )
    )
    app = _build_app(db)
    topup_calls: list[dict] = []

    async def _fake_topup_wallet(*args, **kwargs):
        topup_calls.append({"args": args, "kwargs": kwargs})
        return 500

    async def _fake_notify_email_verified(_email: str):
        return None

    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)
    monkeypatch.setattr(settings, "FIRST_LOGIN_BONUS_CENTS", 500)
    monkeypatch.setattr(settings, "FIRST_LOGIN_BONUS_INFLUENCER_ID", "loli")
    monkeypatch.setattr(auth_route, "topup_wallet", _fake_topup_wallet)
    monkeypatch.setattr(auth_route, "notify_email_verified", _fake_notify_email_verified)
    monkeypatch.setattr(auth_route.asyncio, "create_task", lambda coro: coro.close())

    client = TestClient(app)
    response = client.get("/auth/verify-email", params={"token": "verify-token"})

    assert response.status_code == 200
    assert topup_calls == []


def test_login_no_longer_grants_initial_bonus(monkeypatch) -> None:
    db = FakeAsyncSession(
        _user(
            is_verified=True,
            email_token=None,
            email_token_expires_at=None,
            first_login_at=None,
            login_bonus_granted_at=None,
            login_bonus_pending=False,
        )
    )
    app = _build_app(db)
    topup_calls: list[dict] = []

    async def _fake_topup_wallet(*args, **kwargs):
        topup_calls.append({"args": args, "kwargs": kwargs})
        return 500

    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)
    monkeypatch.setattr(settings, "FIRST_LOGIN_BONUS_CENTS", 500)
    monkeypatch.setattr(settings, "FIRST_LOGIN_BONUS_INFLUENCER_ID", "loli")
    monkeypatch.setattr(auth_route, "topup_wallet", _fake_topup_wallet)
    monkeypatch.setattr(
        auth_route.pwd_context,
        "verify",
        lambda plain, hashed: plain == "pw" and hashed == "stored-hash",
    )

    client = TestClient(app)
    response = client.post("/auth/login", json={"email": "user@example.com", "password": "pw"})

    assert response.status_code == 200
    assert topup_calls == []
    assert db.user.first_login_at is None
    assert db.user.login_bonus_granted_at is None
    assert db.user.login_bonus_pending is False
