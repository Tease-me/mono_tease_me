from __future__ import annotations

from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import pre_influencers as pre_influencers_route
from app.core.session import get_db


class FakeSession:
    async def execute(self, _stmt):
        raise AssertionError("resume endpoint should use repository helpers")


def _build_app() -> FastAPI:
    app = FastAPI()
    app.include_router(pre_influencers_route.router)

    async def _override_db():
        yield FakeSession()

    app.dependency_overrides[get_db] = _override_db
    return app


def test_invite_resume_returns_onboarding_url(monkeypatch) -> None:
    pre = SimpleNamespace(
        survey_token="existing-token",
        password="Temp123",
        survey_answers={"__meta": {"invite_code": "invite-123", "mj_funnel": True}},
    )

    async def _fake_lookup(_db, *, invite_code: str, invitee_email: str):
        assert invite_code == "invite-123"
        assert invitee_email == "user@example.com"
        return pre

    monkeypatch.setattr(
        pre_influencers_route,
        "get_pre_influencer_by_progress_identity",
        _fake_lookup,
    )

    response = TestClient(_build_app()).get(
        "/pre-influencers/invite/resume",
        params={"invitee_email": "user@example.com", "invite_code": "invite-123"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "registered": True,
        "onboarding_url": (
            "/join/onboarding?token=existing-token&temp_password=Temp123&start_step=picture"
        ),
    }
