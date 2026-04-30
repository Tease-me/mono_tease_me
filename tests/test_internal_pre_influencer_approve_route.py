from __future__ import annotations

from types import SimpleNamespace

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.api.mjpromoter import router as internal_router
from app.api.mjpromoter import pre_influencers as mj_pre_influencers_route
from app.api.routes import pre_influencers as pre_influencers_route
from app.core.config import settings
from app.core.session import get_db


class _Session:
    pass


def _build_app() -> FastAPI:
    app = FastAPI()
    app.include_router(internal_router)
    app.include_router(pre_influencers_route.router)

    async def _override_db():
        yield _Session()

    app.dependency_overrides[get_db] = _override_db
    return app


def test_internal_pre_influencer_approve_requires_valid_internal_token(
    monkeypatch,
) -> None:
    app = _build_app()
    client = TestClient(app)
    calls: list[tuple[object, int]] = []

    async def _fake_approve(db, pre_id: int):
        calls.append((db, pre_id))
        return {
            "ok": True,
            "influencer_id": "creatorname",
            "fp_ref_id": "fp-ref-123",
            "fp_promoter_id": "fp-promoter-123",
        }

    monkeypatch.setattr(settings, "MJFP_TOKEN", "internal-secret")
    monkeypatch.setattr(
        "app.api.mjpromoter.pre_influencers.run_pre_influencer_approval",
        _fake_approve,
    )

    response = client.post(
        "/mjpromoter/pre-influencers/123/approve",
        headers={"X-Internal-Token": "internal-secret"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "pre_influencer_id": 123,
        "status": "approved",
    }
    assert len(calls) == 1
    assert calls[0][1] == 123


def test_internal_pre_influencer_approve_by_invite_identity(monkeypatch) -> None:
    app = _build_app()
    client = TestClient(app)
    pre = SimpleNamespace(id=456)
    captured_lookup: dict[str, object] = {}
    captured_approval: dict[str, object] = {}

    async def _fake_lookup(db, *, invite_code: str, invitee_email: str):
        captured_lookup["db"] = db
        captured_lookup["invite_code"] = invite_code
        captured_lookup["invitee_email"] = invitee_email
        return pre

    async def _fake_approve(db, pre_id: int):
        captured_approval["db"] = db
        captured_approval["pre_id"] = pre_id
        return {
            "ok": True,
            "influencer_id": "creatorname",
            "fp_ref_id": "fp-ref-456",
            "fp_promoter_id": "fp-promoter-456",
        }

    monkeypatch.setattr(settings, "MJFP_TOKEN", "internal-secret")
    monkeypatch.setattr(
        mj_pre_influencers_route,
        "get_pre_influencer_by_progress_identity",
        _fake_lookup,
    )
    monkeypatch.setattr(
        "app.api.mjpromoter.pre_influencers.run_pre_influencer_approval",
        _fake_approve,
    )

    response = client.post(
        "/mjpromoter/pre-influencers/approve",
        json={
            "invite_code": "  invite-123  ",
            "invitee_email": "  User@Example.COM  ",
        },
        headers={"X-Internal-Token": "internal-secret"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "pre_influencer_id": 456,
        "status": "approved",
    }
    assert captured_lookup["invite_code"] == "invite-123"
    assert captured_lookup["invitee_email"] == "user@example.com"
    assert captured_approval["pre_id"] == 456
    assert captured_lookup["db"] is captured_approval["db"]


def test_internal_pre_influencer_approve_by_invite_identity_returns_404(
    monkeypatch,
) -> None:
    app = _build_app()
    client = TestClient(app)
    approve_called = False

    async def _fake_lookup(_db, *, invite_code: str, invitee_email: str):
        return None

    async def _fake_approve(_db, _pre_id: int):
        nonlocal approve_called
        approve_called = True

    monkeypatch.setattr(settings, "MJFP_TOKEN", "internal-secret")
    monkeypatch.setattr(
        mj_pre_influencers_route,
        "get_pre_influencer_by_progress_identity",
        _fake_lookup,
    )
    monkeypatch.setattr(
        "app.api.mjpromoter.pre_influencers.run_pre_influencer_approval",
        _fake_approve,
    )

    response = client.post(
        "/mjpromoter/pre-influencers/approve",
        json={"invite_code": "invite-123", "invitee_email": "user@example.com"},
        headers={"X-Internal-Token": "internal-secret"},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Pre-influencer approval target not found"}
    assert approve_called is False


def test_internal_pre_influencer_approve_by_invite_identity_rejects_missing_token(
    monkeypatch,
) -> None:
    app = _build_app()
    client = TestClient(app)

    monkeypatch.setattr(settings, "MJFP_TOKEN", "internal-secret")

    response = client.post(
        "/mjpromoter/pre-influencers/approve",
        json={"invite_code": "invite-123", "invitee_email": "user@example.com"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid MJ promoter token"


def test_internal_pre_influencer_approve_by_invite_identity_rejects_invalid_token(
    monkeypatch,
) -> None:
    app = _build_app()
    client = TestClient(app)

    monkeypatch.setattr(settings, "MJFP_TOKEN", "internal-secret")

    response = client.post(
        "/mjpromoter/pre-influencers/approve",
        json={"invite_code": "invite-123", "invitee_email": "user@example.com"},
        headers={"X-Internal-Token": "wrong-token"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid MJ promoter token"


def test_internal_pre_influencer_approve_rejects_missing_token(monkeypatch) -> None:
    app = _build_app()
    client = TestClient(app)

    monkeypatch.setattr(settings, "MJFP_TOKEN", "internal-secret")

    response = client.post("/mjpromoter/pre-influencers/123/approve")

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid MJ promoter token"


def test_internal_pre_influencer_approve_by_id_returns_404(monkeypatch) -> None:
    app = _build_app()
    client = TestClient(app)

    async def _fake_approve(_db, _pre_id: int):
        raise HTTPException(status_code=404, detail="PreInfluencer not found")

    monkeypatch.setattr(settings, "MJFP_TOKEN", "internal-secret")
    monkeypatch.setattr(
        "app.api.mjpromoter.pre_influencers.run_pre_influencer_approval",
        _fake_approve,
    )

    response = client.post(
        "/mjpromoter/pre-influencers/999/approve",
        headers={"X-Internal-Token": "internal-secret"},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "PreInfluencer not found"}


def test_internal_pre_influencer_approve_rejects_invalid_token(monkeypatch) -> None:
    app = _build_app()
    client = TestClient(app)

    monkeypatch.setattr(settings, "MJFP_TOKEN", "internal-secret")

    response = client.post(
        "/mjpromoter/pre-influencers/123/approve",
        headers={"X-Internal-Token": "wrong-token"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid MJ promoter token"


def test_old_internal_pre_influencer_approve_route_is_removed(monkeypatch) -> None:
    app = _build_app()
    client = TestClient(app)

    monkeypatch.setattr(settings, "MJFP_TOKEN", "internal-secret")

    response = client.post(
        "/pre-influencers/123/internal-approve",
        headers={"X-Internal-Token": "internal-secret"},
    )

    assert response.status_code == 404
