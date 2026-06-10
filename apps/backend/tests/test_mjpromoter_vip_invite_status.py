from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.mjpromoter import router as mjpromoter_router
from app.api.mjpromoter import vip_invites as vip_invites_route
from app.core.config import settings
from app.core.session import get_db


class FakeAsyncSession:
    def __init__(self, users_by_id: dict[int, object], users_by_code: dict[str, object]):
        self.users_by_id = users_by_id
        self.users_by_code = users_by_code

    async def get(self, _model, key):
        return self.users_by_id.get(key)


def _user(**overrides):
    base = {
        "id": 42,
        "email": "instagram-glaucomp@mjpromoter.placeholder.invalid",
        "is_verified": False,
        "email_token": "HYC4K8",
        "username": "glaucomp",
        "full_name": "Glauco",
        "date_of_birth": None,
        "created_at": datetime(2026, 6, 10, 10, 0, 0),
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def _build_app(db: FakeAsyncSession) -> FastAPI:
    app = FastAPI()
    app.include_router(mjpromoter_router)

    async def _override_db():
        yield db

    app.dependency_overrides[get_db] = _override_db
    return app


def test_vip_invite_status_by_user_id(monkeypatch) -> None:
    user = _user()
    db = FakeAsyncSession(users_by_id={42: user}, users_by_code={})
    app = _build_app(db)

    async def _fake_get_users_by_ids(_db, user_ids):
        return [db.users_by_id[user_id] for user_id in user_ids if user_id in db.users_by_id]

    async def _fake_get_users_by_invite_codes(_db, _invite_codes):
        return []

    monkeypatch.setattr(settings, "MJFP_TOKEN", "internal-secret")
    monkeypatch.setattr(vip_invites_route, "get_users_by_ids", _fake_get_users_by_ids)
    monkeypatch.setattr(
        vip_invites_route,
        "get_users_by_invite_codes",
        _fake_get_users_by_invite_codes,
    )

    client = TestClient(app)
    response = client.post(
        "/mjpromoter/vip-invites/status",
        headers={"X-Internal-Token": "internal-secret"},
        json={"user_ids": [42]},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert len(payload["items"]) == 1
    assert payload["items"][0]["user_id"] == 42
    assert payload["items"][0]["status"] == "pending"
    assert payload["items"][0]["invite_code"] == "HYC4K8"
    assert payload["items"][0]["instagram_username"] == "glaucomp"


def test_vip_user_status_by_user_id(monkeypatch) -> None:
    user = _user(email="glaucomp@gmail.com", is_verified=True)
    db = FakeAsyncSession(users_by_id={42: user}, users_by_code={})
    app = _build_app(db)

    async def _fake_get_users_by_ids(_db, user_ids):
        return [db.users_by_id[user_id] for user_id in user_ids if user_id in db.users_by_id]

    monkeypatch.setattr(settings, "MJFP_TOKEN", "internal-secret")
    monkeypatch.setattr(
        "app.api.mjpromoter.vip_user_status.get_users_by_ids",
        _fake_get_users_by_ids,
    )

    client = TestClient(app)
    response = client.get(
        "/mjpromoter/vip-user-status/42",
        headers={"X-Internal-Token": "internal-secret"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["user_id"] == 42
    assert payload["status"] == "completed"
    assert payload["email"] == "glaucomp@gmail.com"


def test_vip_invite_status_by_invite_code(monkeypatch) -> None:
    user = _user(
        email="test@jamieeeee.com",
        date_of_birth=datetime(1999, 1, 2),
        email_token="VERIFYTOKEN",
        vip_invite_code="HYC4K8",
    )
    db = FakeAsyncSession(users_by_id={}, users_by_code={"HYC4K8": user})
    app = _build_app(db)

    async def _fake_get_users_by_ids(_db, _user_ids):
        return []

    async def _fake_get_users_by_invite_codes(_db, invite_codes):
        return [
            db.users_by_code[code.strip().upper()]
            for code in invite_codes
            if code.strip().upper() in db.users_by_code
        ]

    monkeypatch.setattr(settings, "MJFP_TOKEN", "internal-secret")
    monkeypatch.setattr(vip_invites_route, "get_users_by_ids", _fake_get_users_by_ids)
    monkeypatch.setattr(
        vip_invites_route,
        "get_users_by_invite_codes",
        _fake_get_users_by_invite_codes,
    )

    client = TestClient(app)
    response = client.post(
        "/mjpromoter/vip-invites/status",
        headers={"X-Internal-Token": "internal-secret"},
        json={"invite_codes": ["hyc4k8"]},
    )

    assert response.status_code == 200
    assert response.json()["items"][0]["status"] == "in_progress"
    assert response.json()["items"][0]["invite_code"] == "HYC4K8"


def test_vip_invite_status_requires_lookup_keys(monkeypatch) -> None:
    app = _build_app(FakeAsyncSession(users_by_id={}, users_by_code={}))
    monkeypatch.setattr(settings, "MJFP_TOKEN", "internal-secret")
    client = TestClient(app)
    response = client.post(
        "/mjpromoter/vip-invites/status",
        headers={"X-Internal-Token": "internal-secret"},
        json={},
    )
    assert response.status_code == 422
