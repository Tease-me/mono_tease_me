from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import auth as auth_route
from app.core.config import settings
from app.core.session import get_db
from app.data.models import Influencer


class FakeExecuteResult:
    def __init__(self, scalar_value=None):
        self._scalar_value = scalar_value

    def scalar_one_or_none(self):
        return self._scalar_value


class FakeAsyncSession:
    def __init__(self, user, influencer: object | None = None):
        self.user = user
        self._influencer = influencer
        self.added: list[object] = []
        self.commits = 0
        self.rollbacks = 0
        self.refreshed = False

    async def execute(self, _stmt):
        return FakeExecuteResult(self.user)

    async def get(self, model, key):
        if model is Influencer and self._influencer is not None:
            return self._influencer
        return self.user if getattr(self.user, "id", None) == key else None

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.commits += 1

    async def rollback(self):
        self.rollbacks += 1

    async def refresh(self, _obj):
        self.refreshed = True


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
        "password_hash": "placeholder-hash",
        "is_verified": False,
        "email_token": "verify-token",
        "email_token_expires_at": datetime.utcnow() + timedelta(hours=1),
        "full_name": None,
        "username": None,
        "gender": None,
        "date_of_birth": None,
        "profile_photo_key": None,
        "telegram_id": 987654321,
        "first_login_at": None,
        "login_bonus_granted_at": None,
        "login_bonus_pending": False,
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def _close_task(coro):
    coro.close()
    return None


def test_complete_profile_grants_bonus_using_final_influencer(monkeypatch) -> None:
    db = FakeAsyncSession(_user(), influencer=SimpleNamespace(id="loli"))
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

    async def _fake_claim_and_bind_telegram(_db, invite_code: str, user, influencer_id: str | None):
        return SimpleNamespace(influencer_id="juliana", telegram_id=123456789, bound=False)

    async def _fake_send_verification_email(*args, **kwargs):
        return None

    async def _fake_track_influencer_followed(*args, **kwargs):
        return None

    from app.services import funnel_tracking_service, telegram_invite_service

    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)
    monkeypatch.setattr(settings, "FIRST_LOGIN_BONUS_CENTS", 500)
    monkeypatch.setattr(auth_route.pwd_context, "hash", lambda value: f"hashed::{value}")
    monkeypatch.setattr(auth_route.secrets, "token_urlsafe", lambda _n: "fresh-verify-token")
    monkeypatch.setattr(auth_route, "topup_wallet", _fake_topup_wallet)
    monkeypatch.setattr(auth_route, "send_verification_email", _fake_send_verification_email)
    monkeypatch.setattr(auth_route.asyncio, "create_task", _close_task)
    monkeypatch.setattr(telegram_invite_service, "claim_and_bind_telegram", _fake_claim_and_bind_telegram)
    monkeypatch.setattr(funnel_tracking_service, "track_influencer_followed", _fake_track_influencer_followed)

    client = TestClient(app)
    response = client.post(
        "/auth/complete-profile",
        data={
            "email": "user@example.com",
            "token": "verify-token",
            "password": "new-password",
            "influencer_id": "loli",
            "invite_code": "invite-abc",
        },
    )

    assert response.status_code == 200
    assert topup_calls == [
        {
            "user_id": 1,
            "influencer_id": "juliana",
            "cents": 500,
            "source": "first_login_bonus",
            "is_18": False,
        }
    ]
    assert db.user.first_login_at is not None
    assert db.user.login_bonus_granted_at is not None
    assert db.user.login_bonus_pending is False


def test_complete_profile_bonus_failure_does_not_block_and_marks_pending(monkeypatch) -> None:
    db = FakeAsyncSession(_user(), influencer=SimpleNamespace(id="loli"))
    app = _build_app(db)

    async def _failing_topup_wallet(*args, **kwargs):
        raise RuntimeError("wallet failed")

    async def _fake_send_verification_email(*args, **kwargs):
        return None

    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)
    monkeypatch.setattr(settings, "FIRST_LOGIN_BONUS_CENTS", 500)
    monkeypatch.setattr(auth_route.pwd_context, "hash", lambda value: f"hashed::{value}")
    monkeypatch.setattr(auth_route.secrets, "token_urlsafe", lambda _n: "fresh-verify-token")
    monkeypatch.setattr(auth_route, "topup_wallet", _failing_topup_wallet)
    monkeypatch.setattr(auth_route, "send_verification_email", _fake_send_verification_email)

    client = TestClient(app)
    response = client.post(
        "/auth/complete-profile",
        data={
            "email": "user@example.com",
            "token": "verify-token",
            "password": "new-password",
            "influencer_id": "loli",
        },
    )

    assert response.status_code == 200
    assert db.user.first_login_at is not None
    assert db.user.login_bonus_granted_at is None
    assert db.user.login_bonus_pending is True
    assert db.rollbacks == 1


def test_complete_profile_does_not_grant_bonus_twice(monkeypatch) -> None:
    now = datetime.now(timezone.utc)
    db = FakeAsyncSession(
        _user(
            first_login_at=now,
            login_bonus_granted_at=now,
            login_bonus_pending=False,
        ),
        influencer=SimpleNamespace(id="loli"),
    )
    app = _build_app(db)
    topup_calls: list[dict] = []

    async def _fake_topup_wallet(*args, **kwargs):
        topup_calls.append({"args": args, "kwargs": kwargs})
        return 500

    async def _fake_send_verification_email(*args, **kwargs):
        return None

    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)
    monkeypatch.setattr(settings, "FIRST_LOGIN_BONUS_CENTS", 500)
    monkeypatch.setattr(auth_route.pwd_context, "hash", lambda value: f"hashed::{value}")
    monkeypatch.setattr(auth_route.secrets, "token_urlsafe", lambda _n: "fresh-verify-token")
    monkeypatch.setattr(auth_route, "topup_wallet", _fake_topup_wallet)
    monkeypatch.setattr(auth_route, "send_verification_email", _fake_send_verification_email)

    client = TestClient(app)
    response = client.post(
        "/auth/complete-profile",
        data={
            "email": "user@example.com",
            "token": "verify-token",
            "password": "new-password",
            "influencer_id": "loli",
        },
    )

    assert response.status_code == 200
    assert topup_calls == []


def test_verify_email_no_longer_grants_bonus(monkeypatch) -> None:
    db = FakeAsyncSession(_user())
    app = _build_app(db)
    topup_calls: list[dict] = []

    async def _fake_topup_wallet(*args, **kwargs):
        topup_calls.append({"args": args, "kwargs": kwargs})
        return 500

    async def _fake_notify_email_verified(_email: str):
        return None

    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)
    monkeypatch.setattr(settings, "FIRST_LOGIN_BONUS_CENTS", 500)
    monkeypatch.setattr(auth_route, "topup_wallet", _fake_topup_wallet)
    monkeypatch.setattr(auth_route, "notify_email_verified", _fake_notify_email_verified)
    monkeypatch.setattr(auth_route.asyncio, "create_task", _close_task)

    client = TestClient(app)
    response = client.get("/auth/verify-email", params={"token": "verify-token"})

    assert response.status_code == 200
    assert topup_calls == []
    assert db.user.first_login_at is None
    assert db.user.login_bonus_granted_at is None
    assert db.user.login_bonus_pending is False
