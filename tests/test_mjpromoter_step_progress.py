from __future__ import annotations

from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.mjpromoter import router as mjpromoter_router
from app.api.mjpromoter import pre_influencers as mj_pre_influencers_route
from app.core.config import settings
from app.core.session import get_db


class FakeSession:
    def __init__(self) -> None:
        self.committed = False

    async def commit(self) -> None:
        self.committed = True


def _build_app(db: FakeSession) -> FastAPI:
    app = FastAPI()
    app.include_router(mjpromoter_router)

    async def _override_db():
        yield db

    app.dependency_overrides[get_db] = _override_db
    return app


def test_step_progress_requires_valid_internal_token(monkeypatch) -> None:
    db = FakeSession()
    client = TestClient(_build_app(db))
    monkeypatch.setattr(settings, "MJFP_TOKEN", "internal-secret")

    response = client.post(
        "/mjpromoter/pre-influencers/step-progress",
        json={"invite_code": "invite-123", "invitee_email": "user@example.com"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid MJ promoter token"


def test_step_progress_rejects_invalid_internal_token(monkeypatch) -> None:
    db = FakeSession()
    client = TestClient(_build_app(db))
    monkeypatch.setattr(settings, "MJFP_TOKEN", "internal-secret")

    response = client.post(
        "/mjpromoter/pre-influencers/step-progress",
        json={"invite_code": "invite-123", "invitee_email": "user@example.com"},
        headers={"X-Internal-Token": "wrong-token"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid MJ promoter token"


def test_step_progress_returns_step_two_without_asset_link(monkeypatch) -> None:
    db = FakeSession()
    client = TestClient(_build_app(db))
    captured: dict[str, str] = {}
    pre = SimpleNamespace(
        id=123,
        username="creatorname",
        survey_step=99,
        survey_answers={},
        status="pending",
    )

    async def _fake_lookup(db_arg, *, invite_code: str, invitee_email: str):
        assert db_arg is db
        captured["invite_code"] = invite_code
        captured["invitee_email"] = invitee_email
        return pre

    monkeypatch.setattr(settings, "MJFP_TOKEN", "internal-secret")
    monkeypatch.setattr(
        mj_pre_influencers_route,
        "get_pre_influencer_by_progress_identity",
        _fake_lookup,
    )

    response = client.post(
        "/mjpromoter/pre-influencers/step-progress",
        json={
            "invite_code": "  invite-123  ",
            "invitee_email": "  User@Example.COM  ",
        },
        headers={"X-Internal-Token": "internal-secret"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "exists": True,
        "pre_influencer_id": 123,
        "username": "creatorname",
        "survey_step": 2,
        "status": "pending",
    }
    assert captured == {
        "invite_code": "invite-123",
        "invitee_email": "user@example.com",
    }
    assert pre.survey_step == 99
    assert db.committed is False


def test_step_progress_returns_step_three_with_asset_link(monkeypatch) -> None:
    db = FakeSession()
    client = TestClient(_build_app(db))
    pre = SimpleNamespace(
        id=123,
        username="creatorname",
        survey_step=0,
        survey_answers={"asset_link": "https://googledrive/assetlinktest"},
        status="pending",
    )

    async def _fake_lookup(_db_arg, *, invite_code: str, invitee_email: str):
        return pre

    monkeypatch.setattr(settings, "MJFP_TOKEN", "internal-secret")
    monkeypatch.setattr(
        mj_pre_influencers_route,
        "get_pre_influencer_by_progress_identity",
        _fake_lookup,
    )

    response = client.post(
        "/mjpromoter/pre-influencers/step-progress",
        json={"invite_code": "invite-123", "invitee_email": "user@example.com"},
        headers={"X-Internal-Token": "internal-secret"},
    )

    assert response.status_code == 200
    assert response.json()["survey_step"] == 3
    assert pre.survey_step == 0
    assert db.committed is False


def test_step_progress_returns_step_two_with_blank_asset_link(monkeypatch) -> None:
    db = FakeSession()
    client = TestClient(_build_app(db))
    pre = SimpleNamespace(
        id=123,
        username="creatorname",
        survey_step=0,
        survey_answers={"asset_link": "   "},
        status="pending",
    )

    async def _fake_lookup(_db_arg, *, invite_code: str, invitee_email: str):
        return pre

    monkeypatch.setattr(settings, "MJFP_TOKEN", "internal-secret")
    monkeypatch.setattr(
        mj_pre_influencers_route,
        "get_pre_influencer_by_progress_identity",
        _fake_lookup,
    )

    response = client.post(
        "/mjpromoter/pre-influencers/step-progress",
        json={"invite_code": "invite-123", "invitee_email": "user@example.com"},
        headers={"X-Internal-Token": "internal-secret"},
    )

    assert response.status_code == 200
    assert response.json()["survey_step"] == 2
    assert pre.survey_step == 0
    assert db.committed is False


def test_step_progress_returns_404_for_missing_progress_target(monkeypatch) -> None:
    db = FakeSession()
    client = TestClient(_build_app(db))

    async def _fake_lookup(_db_arg, *, invite_code: str, invitee_email: str):
        return None

    monkeypatch.setattr(settings, "MJFP_TOKEN", "internal-secret")
    monkeypatch.setattr(
        mj_pre_influencers_route,
        "get_pre_influencer_by_progress_identity",
        _fake_lookup,
    )

    response = client.post(
        "/mjpromoter/pre-influencers/step-progress",
        json={"invite_code": "missing", "invitee_email": "user@example.com"},
        headers={"X-Internal-Token": "internal-secret"},
    )

    assert response.status_code == 404
    assert response.json() == {
        "detail": "Pre-influencer progress target not found",
    }
    assert db.committed is False


def test_step_progress_rejects_blank_invite_code(monkeypatch) -> None:
    db = FakeSession()
    client = TestClient(_build_app(db))
    monkeypatch.setattr(settings, "MJFP_TOKEN", "internal-secret")

    response = client.post(
        "/mjpromoter/pre-influencers/step-progress",
        json={"invite_code": "   ", "invitee_email": "user@example.com"},
        headers={"X-Internal-Token": "internal-secret"},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "invite_code is required"
    assert db.committed is False
