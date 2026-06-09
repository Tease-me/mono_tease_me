from __future__ import annotations

from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.mjpromoter import router as mjpromoter_router
from app.api.mjpromoter import pre_influencers as mj_pre_influencers_route
from app.core.config import settings
from app.core.session import get_db
from app.data.enums import InfluencerPublicationStatus
from app.data.models import Influencer


class FakeSession:
    def __init__(self, influencers: dict[str, object] | None = None) -> None:
        self.committed = False
        self.influencers = influencers or {}

    async def commit(self) -> None:
        self.committed = True

    async def get(self, model, key: str):
        if model is Influencer:
            return self.influencers.get(key)
        return None


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


def test_step_progress_returns_step_one_with_survey_token_only(monkeypatch) -> None:
    db = FakeSession()
    client = TestClient(_build_app(db))
    captured: dict[str, str] = {}
    pre = SimpleNamespace(
        id=123,
        username="creatorname",
        survey_step=0,
        survey_token="survey-token",
        password="temporary password",
        survey_answers={},
        terms_agreement=False,
        status="pending",
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
        "survey_step": 1,
        "status": "pending",
        "asset_link": None,
        "survey_link": (
            "https://www.teaseme.live/join/onboarding?"
            "token=survey-token&temp_password=temporary+password"
        ),
    }
    assert captured == {
        "invite_code": "invite-123",
        "invitee_email": "user@example.com",
    }
    assert pre.survey_step == 0
    assert db.committed is False


def test_step_progress_returns_step_two_when_survey_step_is_four(monkeypatch) -> None:
    db = FakeSession()
    client = TestClient(_build_app(db))
    pre = SimpleNamespace(
        id=123,
        username="creatorname",
        survey_step=4,
        survey_token="survey-token",
        password="temporary-password",
        survey_answers={"q_about_me": "Blah Blah"},
        status="pending",
    )

    async def _fake_lookup(_db_arg, *, invite_code: str, invitee_email: str):
        return pre

    monkeypatch.setattr(settings, "MJFP_TOKEN", "internal-secret")
    monkeypatch.setattr(settings, "FRONTEND_URL", "https://www.teaseme.live/")
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
    body = response.json()
    assert body["survey_step"] == 2
    assert body["asset_link"] is None
    assert body["survey_link"] == (
        "https://www.teaseme.live/join/onboarding?"
        "token=survey-token&temp_password=temporary-password"
    )
    assert pre.survey_step == 4
    assert db.committed is False


def test_step_progress_returns_step_three_with_asset_link(monkeypatch) -> None:
    db = FakeSession()
    client = TestClient(_build_app(db))
    pre = SimpleNamespace(
        id=123,
        username="creatorname",
        survey_step=0,
        survey_token="survey-token",
        password="temporary-password",
        survey_answers={"asset_link": "  https://googledrive/assetlinktest  "},
        terms_agreement=True,
        status="pending",
    )

    async def _fake_lookup(_db_arg, *, invite_code: str, invitee_email: str):
        return pre

    monkeypatch.setattr(settings, "MJFP_TOKEN", "internal-secret")
    monkeypatch.setattr(settings, "FRONTEND_URL", "https://www.teaseme.live/")
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
    body = response.json()
    assert body["survey_step"] == 3
    assert body["asset_link"] == "https://googledrive/assetlinktest"
    assert body["survey_link"] == (
        "https://www.teaseme.live/join/onboarding?"
        "token=survey-token&temp_password=temporary-password"
    )
    assert pre.survey_step == 0
    assert db.committed is False


def test_step_progress_returns_step_one_when_asset_link_exists_without_terms(
    monkeypatch,
) -> None:
    db = FakeSession()
    client = TestClient(_build_app(db))
    pre = SimpleNamespace(
        id=123,
        username="creatorname",
        survey_step=0,
        survey_token="survey-token",
        password="temporary-password",
        survey_answers={"asset_link": "https://googledrive/assetlinktest"},
        terms_agreement=False,
        status="pending",
    )

    async def _fake_lookup(_db_arg, *, invite_code: str, invitee_email: str):
        return pre

    monkeypatch.setattr(settings, "MJFP_TOKEN", "internal-secret")
    monkeypatch.setattr(settings, "FRONTEND_URL", "https://www.teaseme.live/")
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
    body = response.json()
    assert body["survey_step"] == 1
    assert body["asset_link"] == "https://googledrive/assetlinktest"
    assert body["survey_link"] == (
        "https://www.teaseme.live/join/onboarding?"
        "token=survey-token&temp_password=temporary-password"
    )
    assert pre.survey_step == 0
    assert db.committed is False


def test_step_progress_returns_step_two_when_asset_link_exists_without_terms_after_survey(
    monkeypatch,
) -> None:
    db = FakeSession()
    client = TestClient(_build_app(db))
    pre = SimpleNamespace(
        id=123,
        username="creatorname",
        survey_step=4,
        survey_token="survey-token",
        password="temporary-password",
        survey_answers={"asset_link": "https://googledrive/assetlinktest"},
        terms_agreement=False,
        status="pending",
    )

    async def _fake_lookup(_db_arg, *, invite_code: str, invitee_email: str):
        return pre

    monkeypatch.setattr(settings, "MJFP_TOKEN", "internal-secret")
    monkeypatch.setattr(settings, "FRONTEND_URL", "https://www.teaseme.live/")
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
    body = response.json()
    assert body["survey_step"] == 2
    assert body["asset_link"] == "https://googledrive/assetlinktest"
    assert body["survey_link"] == (
        "https://www.teaseme.live/join/onboarding?"
        "token=survey-token&temp_password=temporary-password"
    )
    assert pre.survey_step == 4
    assert db.committed is False


def test_step_progress_returns_step_four_when_approved_without_influencer(
    monkeypatch,
) -> None:
    db = FakeSession()
    client = TestClient(_build_app(db))
    pre = SimpleNamespace(
        id=123,
        username="Creator Name",
        survey_step=4,
        survey_token="survey-token",
        password="temporary-password",
        survey_answers={"asset_link": "https://googledrive/assetlinktest"},
        status="approved",
    )

    async def _fake_lookup(_db_arg, *, invite_code: str, invitee_email: str):
        return pre

    monkeypatch.setattr(settings, "MJFP_TOKEN", "internal-secret")
    monkeypatch.setattr(settings, "FRONTEND_URL", "https://www.teaseme.live/")
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
    body = response.json()
    assert body["survey_step"] == 4
    assert body["status"] == "approved"
    assert body["asset_link"] == "https://googledrive/assetlinktest"
    assert pre.survey_step == 4
    assert db.committed is False


def test_step_progress_returns_step_four_when_corresponding_influencer_is_draft(
    monkeypatch,
) -> None:
    db = FakeSession(
        influencers={
            "creatorname": SimpleNamespace(
                id="creatorname",
                publication_status=InfluencerPublicationStatus.DRAFT.value,
            )
        }
    )
    client = TestClient(_build_app(db))
    pre = SimpleNamespace(
        id=123,
        username="Creator Name",
        survey_step=4,
        survey_token="survey-token",
        password="temporary-password",
        survey_answers={"asset_link": "https://googledrive/assetlinktest"},
        status="approved",
    )

    async def _fake_lookup(_db_arg, *, invite_code: str, invitee_email: str):
        return pre

    monkeypatch.setattr(settings, "MJFP_TOKEN", "internal-secret")
    monkeypatch.setattr(settings, "FRONTEND_URL", "https://www.teaseme.live/")
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
    body = response.json()
    assert body["survey_step"] == 4
    assert body["status"] == "approved"
    assert body["asset_link"] == "https://googledrive/assetlinktest"
    assert pre.survey_step == 4
    assert db.committed is False


def test_step_progress_returns_step_five_when_corresponding_influencer_is_published(
    monkeypatch,
) -> None:
    db = FakeSession(
        influencers={
            "creatorname": SimpleNamespace(
                id="creatorname",
                publication_status=InfluencerPublicationStatus.PUBLISHED.value,
            )
        }
    )
    client = TestClient(_build_app(db))
    pre = SimpleNamespace(
        id=123,
        username="Creator Name",
        survey_step=4,
        survey_token="survey-token",
        password="temporary-password",
        survey_answers={"asset_link": "https://googledrive/assetlinktest"},
        status="approved",
    )

    async def _fake_lookup(_db_arg, *, invite_code: str, invitee_email: str):
        return pre

    monkeypatch.setattr(settings, "MJFP_TOKEN", "internal-secret")
    monkeypatch.setattr(settings, "FRONTEND_URL", "https://www.teaseme.live/")
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
    body = response.json()
    assert body["survey_step"] == 5
    assert body["status"] == "approved"
    assert body["asset_link"] == "https://googledrive/assetlinktest"
    assert pre.survey_step == 4
    assert db.committed is False


def test_step_progress_returns_step_two_with_blank_asset_link(monkeypatch) -> None:
    db = FakeSession()
    client = TestClient(_build_app(db))
    pre = SimpleNamespace(
        id=123,
        username="creatorname",
        survey_step=4,
        survey_token="survey-token",
        password=None,
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
    body = response.json()
    assert body["survey_step"] == 2
    assert body["asset_link"] is None
    assert body["survey_link"] is None
    assert pre.survey_step == 4
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
