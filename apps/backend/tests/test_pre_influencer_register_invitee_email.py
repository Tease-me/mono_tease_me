from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import pre_influencers as pre_influencers_route
from app.core.session import get_db


class FakeExecuteResult:
    def scalar(self):
        return None


class FakeSession:
    def __init__(self) -> None:
        self.added: list[object] = []
        self.committed = False
        self.refreshed = False

    async def execute(self, _stmt):
        return FakeExecuteResult()

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.committed = True
        for idx, obj in enumerate(self.added, start=1):
            if getattr(obj, "id", None) is None:
                obj.id = idx

    async def refresh(self, _obj):
        self.refreshed = True


def _build_app(db: FakeSession) -> FastAPI:
    app = FastAPI()
    app.include_router(pre_influencers_route.router)

    async def _override_db():
        yield db

    app.dependency_overrides[get_db] = _override_db
    return app


def test_register_stores_invitee_email_in_survey_meta(monkeypatch) -> None:
    db = FakeSession()
    app = _build_app(db)
    sent_emails: list[tuple[str, str, str]] = []

    monkeypatch.setattr(pre_influencers_route.secrets, "token_urlsafe", lambda _n: "survey-token")
    monkeypatch.setattr(
        pre_influencers_route,
        "send_profile_survey_email",
        lambda email, token, password: sent_emails.append((email, token, password)),
    )

    response = TestClient(app).post(
        "/pre-influencers/register",
        json={
            "full_name": "Jane Doe",
            "location": "Australia",
            "username": "janedoe",
            "email": "jane@example.com",
            "password": "ABC123",
            "parent_ref_id": "jorlyn",
            "invite_code": "Us28bym-oQ",
            "invitee_email": "jwmhujpqrsryjitzhi@kjkpc.net",
            "inviter_email": "jorlyn@example.com",
            "account_manager_email": "jorlyn@example.com",
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "user_id": 1,
        "email": "jane@example.com",
        "message": "Check your email.",
    }
    created = db.added[0]
    assert created.survey_answers == {
        "__meta": {
            "invite_code": "Us28bym-oQ",
            "invitee_email": "jwmhujpqrsryjitzhi@kjkpc.net",
            "inviter_email": "jorlyn@example.com",
            "account_manager_email": "jorlyn@example.com",
            "parent_ref_id": "jorlyn",
        }
    }
    assert "new_user_email" not in created.survey_answers["__meta"]
    assert sent_emails == [("jane@example.com", "survey-token", "ABC123")]
    assert db.committed is True
    assert db.refreshed is True
