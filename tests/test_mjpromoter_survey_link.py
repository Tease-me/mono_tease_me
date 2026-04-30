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


def test_survey_link_requires_valid_internal_token(monkeypatch) -> None:
    db = FakeSession()
    client = TestClient(_build_app(db))
    monkeypatch.setattr(settings, "MJFP_TOKEN", "internal-secret")

    response = client.post(
        "/mjpromoter/pre-influencers/survey-link",
        json={"invite_code": "invite-123", "invitee_email": "user@example.com"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid MJ promoter token"


def test_survey_link_returns_onboarding_url(monkeypatch) -> None:
    db = FakeSession()
    client = TestClient(_build_app(db))
    captured: dict[str, str] = {}
    pre = SimpleNamespace(
        id=123,
        username="creatorname",
        survey_token="survey-token",
        password="temporary password",
    )

    async def _fake_lookup(db_arg, *, invite_code: str, invitee_email: str):
        assert db_arg is db
        captured["invite_code"] = invite_code
        captured["invitee_email"] = invitee_email
        return pre

    monkeypatch.setattr(settings, "MJFP_TOKEN", "internal-secret")
    monkeypatch.setattr(settings, "FRONTEND_URL", "https://www.teaseme.live/")
    monkeypatch.setattr(
        mj_pre_influencers_route,
        "get_pre_influencer_by_progress_identity",
        _fake_lookup,
    )

    response = client.post(
        "/mjpromoter/pre-influencers/survey-link",
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
        "survey_link": (
            "https://www.teaseme.live/join/onboarding?"
            "token=survey-token&temp_password=temporary+password"
        ),
    }
    assert captured == {
        "invite_code": "invite-123",
        "invitee_email": "user@example.com",
    }
    assert db.committed is False


def test_survey_link_returns_null_without_token_or_password(monkeypatch) -> None:
    db = FakeSession()
    client = TestClient(_build_app(db))
    pre = SimpleNamespace(
        id=123,
        username="creatorname",
        survey_token=None,
        password="temporary-password",
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
        "/mjpromoter/pre-influencers/survey-link",
        json={"invite_code": "invite-123", "invitee_email": "user@example.com"},
        headers={"X-Internal-Token": "internal-secret"},
    )

    assert response.status_code == 200
    assert response.json()["survey_link"] is None
    assert db.committed is False


def test_survey_link_returns_404_for_missing_target(monkeypatch) -> None:
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
        "/mjpromoter/pre-influencers/survey-link",
        json={"invite_code": "missing", "invitee_email": "user@example.com"},
        headers={"X-Internal-Token": "internal-secret"},
    )

    assert response.status_code == 404
    assert response.json() == {
        "detail": "Pre-influencer survey link target not found",
    }
    assert db.committed is False
