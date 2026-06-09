from __future__ import annotations

from datetime import datetime, timedelta
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError

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
    def __init__(
        self,
        *,
        user=None,
        influencer: object | None = None,
        fail_on_commit: bool = False,
    ):
        self.user = user
        self._influencer = influencer
        self._fail_on_commit = fail_on_commit
        self.added: list[object] = []
        self.commits = 0
        self.rollbacks = 0
        self.refreshed = False

    async def execute(self, _stmt):
        return FakeExecuteResult(self.user)

    async def get(self, model, key):
        if model is Influencer and self._influencer is not None:
            return self._influencer
        return None

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        if self._fail_on_commit:
            raise IntegrityError("update", None, Exception("username already exists"))
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
        "full_name": "Linked Name",
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


def test_complete_profile_updates_existing_user_verifies_and_signs_in(monkeypatch) -> None:
    db = FakeAsyncSession(user=_user(), influencer=SimpleNamespace(id="loli"))
    app = _build_app(db)
    follow_calls: list[tuple[str, int]] = []
    claim_calls: list[tuple[str, str | None]] = []
    fp_calls: list[dict] = []
    email_calls: list[dict] = []

    async def _fake_claim_and_bind_telegram(_db, invite_code: str, user, influencer_id: str | None):
        claim_calls.append((invite_code, influencer_id))
        return SimpleNamespace(influencer_id="juliana", telegram_id=123456789, bound=False)

    async def _fake_fp_track_signup(*, email: str, uid: str, tid: str):
        fp_calls.append({"email": email, "uid": uid, "tid": tid})

    async def _fake_track_influencer_followed(*args, **kwargs):
        return None

    async def _fake_send_verification_email(
        email: str,
        token: str,
        influencer_id: str | None = None,
        influencer_display_name: str | None = None,
        influencer_verification_header_url: str | None = None,
        influencer_profile_photo_key: str | None = None,
    ):
        email_calls.append(
            {
                "email": email,
                "token": token,
                "influencer_id": influencer_id,
                "influencer_display_name": influencer_display_name,
            }
        )

    from app.services import funnel_tracking_service, telegram_invite_service

    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)
    monkeypatch.setattr(auth_route.pwd_context, "hash", lambda value: f"hashed::{value}")
    monkeypatch.setattr(auth_route.secrets, "token_urlsafe", lambda _n: "fresh-verify-token")
    monkeypatch.setattr(auth_route, "create_follow_if_missing", _fake_follow_recorder(follow_calls))
    monkeypatch.setattr(auth_route.asyncio, "create_task", _close_task)
    monkeypatch.setattr(auth_route, "fp_track_signup", _fake_fp_track_signup)
    monkeypatch.setattr(auth_route, "send_verification_email", _fake_send_verification_email)
    monkeypatch.setattr(telegram_invite_service, "claim_and_bind_telegram", _fake_claim_and_bind_telegram)
    monkeypatch.setattr(funnel_tracking_service, "track_influencer_followed", _fake_track_influencer_followed)

    client = TestClient(app)
    response = client.post(
        "/auth/complete-profile",
        data={
            "token": "verify-token",
            "password": "new-password",
            "influencer_id": "loli",
            "full_name": "Jane User",
            "user_name": "janeuser",
            "profile_photo_url": "https://cdn.example.com/photo.jpg",
            "gender": "female",
            "date_of_birth": "1999-01-02",
            "fp_tid": "fp-123",
            "invite_code": "invite-abc",
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "user_id": 1,
        "email": "user@example.com",
        "message": "Check your email to verify your account before logging in.",
    }
    assert "set-cookie" not in response.headers

    user = db.user
    assert user.password_hash == "hashed::new-password"
    assert user.full_name == "Jane User"
    assert user.username == "janeuser"
    assert user.gender == "female"
    assert str(user.date_of_birth) == "1999-01-02"
    assert user.profile_photo_key == "https://cdn.example.com/photo.jpg"
    assert user.is_verified is False
    assert user.email_token == "fresh-verify-token"
    assert user.email_token != "verify-token"
    assert user.email_token_expires_at is not None
    ttl = user.email_token_expires_at - datetime.utcnow()
    assert 23 * 3600 <= ttl.total_seconds() <= 24 * 3600
    assert db.refreshed is True
    assert follow_calls == [("juliana", 1)]
    assert claim_calls == [("invite-abc", "loli")]
    assert fp_calls == [
        {
            "email": "user@example.com",
            "uid": "1",
            "tid": "fp-123",
        }
    ]
    assert email_calls == [
        {
            "email": "user@example.com",
            "token": "fresh-verify-token",
            "influencer_id": "juliana",
            "influencer_display_name": None,
        }
    ]


def test_complete_profile_supports_uploaded_photo(monkeypatch) -> None:
    db = FakeAsyncSession(user=_user())
    app = _build_app(db)
    email_calls: list[str] = []

    async def _fake_upload(_file, _filename, _content_type, _user_id):
        return "users/1/profile.jpg"

    async def _fake_send_verification_email(email: str, token: str, **kwargs):
        email_calls.append(token)

    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)
    monkeypatch.setattr(auth_route.pwd_context, "hash", lambda value: f"hashed::{value}")
    monkeypatch.setattr(auth_route.secrets, "token_urlsafe", lambda _n: "fresh-verify-token")
    monkeypatch.setattr(auth_route, "save_user_photo_to_s3", _fake_upload)
    monkeypatch.setattr(auth_route, "send_verification_email", _fake_send_verification_email)

    client = TestClient(app)
    response = client.post(
        "/auth/complete-profile",
        data={
            "token": "verify-token",
            "password": "new-password",
        },
        files={"file": ("avatar.jpg", b"fake-image", "image/jpeg")},
    )

    assert response.status_code == 200
    assert db.user.profile_photo_key == "users/1/profile.jpg"
    assert db.user.email_token == "fresh-verify-token"
    assert email_calls == ["fresh-verify-token"]


def test_complete_profile_rejects_mismatched_token(monkeypatch) -> None:
    db = FakeAsyncSession(user=None)
    app = _build_app(db)
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)

    client = TestClient(app)
    response = client.post(
        "/auth/complete-profile",
        data={
            "token": "wrong-token",
            "password": "new-password",
        },
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Invalid or expired token"}


def test_complete_profile_rejects_expired_token(monkeypatch) -> None:
    db = FakeAsyncSession(
        user=_user(email_token_expires_at=datetime.utcnow() - timedelta(minutes=1))
    )
    app = _build_app(db)
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)

    client = TestClient(app)
    response = client.post(
        "/auth/complete-profile",
        data={
            "token": "verify-token",
            "password": "new-password",
        },
    )

    assert response.status_code == 410
    assert response.json() == {
        "detail": "Verification link has expired. Please request a new one."
    }


def test_complete_profile_rejects_already_verified_user(monkeypatch) -> None:
    db = FakeAsyncSession(user=_user(is_verified=True))
    app = _build_app(db)
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)

    client = TestClient(app)
    response = client.post(
        "/auth/complete-profile",
        data={
            "token": "verify-token",
            "password": "new-password",
        },
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "User is already verified"}


def test_complete_profile_maps_integrity_error_to_conflict(monkeypatch) -> None:
    db = FakeAsyncSession(user=_user(), fail_on_commit=True)
    app = _build_app(db)
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)
    monkeypatch.setattr(auth_route.pwd_context, "hash", lambda value: f"hashed::{value}")

    client = TestClient(app)
    response = client.post(
        "/auth/complete-profile",
        data={
            "token": "verify-token",
            "password": "new-password",
            "user_name": "taken-name",
        },
    )

    assert response.status_code == 409
    assert response.json() == {
        "detail": "Profile completion violates a database constraint"
    }
    assert db.rollbacks == 1


def _fake_follow_recorder(calls: list[tuple[str, int]]):
    async def _inner(db, influencer_id: str, user_id: int):
        calls.append((influencer_id, user_id))
        return SimpleNamespace(influencer_id=influencer_id, user_id=user_id)

    return _inner
