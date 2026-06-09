from __future__ import annotations

import os
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

os.environ.setdefault("OPENAI_API_KEY", "test-key")

from app.api.admin import influencers as admin_influencers_route
from app.core.session import get_db
from app.data.enums import InfluencerPublicationStatus
from app.utils.auth.dependencies import get_current_user


class _FakeScalars:
    def __init__(self, rows: list):
        self._rows = rows

    def all(self):
        return self._rows


class _FakeResult:
    def __init__(self, rows: list | None = None):
        self._rows = rows or []

    def scalars(self):
        return _FakeScalars(self._rows)


class FakeSession:
    def __init__(self, influencer=None):
        self.influencer = influencer
        self.added = None
        self.committed = False
        self.refreshed = None

    async def execute(self, _stmt):
        """Routes that load related rows after commit; publication tests omit pre-influencers."""
        return _FakeResult([])

    async def get(self, _model, key: str):
        if self.influencer and key == self.influencer.id:
            return self.influencer
        return None

    def add(self, obj) -> None:
        self.added = obj

    async def commit(self) -> None:
        self.committed = True

    async def refresh(self, obj) -> None:
        self.refreshed = obj


def _build_app(db: FakeSession, user_id: int = 1) -> FastAPI:
    app = FastAPI()
    app.include_router(admin_influencers_route.router, prefix="/admin")

    async def _override_db():
        yield db

    async def _override_current_user():
        return SimpleNamespace(id=user_id)

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_user] = _override_current_user
    return app


def test_admin_can_publish_influencer() -> None:
    influencer = SimpleNamespace(
        id="creatorname",
        publication_status=InfluencerPublicationStatus.DRAFT.value,
    )
    db = FakeSession(influencer)
    client = TestClient(_build_app(db))

    response = client.post(
        "/admin/influencers/creatorname/publication",
        json={"published": True},
    )

    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "influencer_id": "creatorname",
        "publication_status": "published",
    }
    assert influencer.publication_status == InfluencerPublicationStatus.PUBLISHED.value
    assert db.added is influencer
    assert db.committed is True
    assert db.refreshed is influencer


def test_admin_can_unpublish_influencer_to_draft() -> None:
    influencer = SimpleNamespace(
        id="creatorname",
        publication_status=InfluencerPublicationStatus.PUBLISHED.value,
    )
    db = FakeSession(influencer)
    client = TestClient(_build_app(db))

    response = client.post(
        "/admin/influencers/creatorname/publication",
        json={"published": False},
    )

    assert response.status_code == 200
    assert response.json()["publication_status"] == "draft"
    assert influencer.publication_status == InfluencerPublicationStatus.DRAFT.value
    assert db.committed is True


def test_publication_update_returns_404_for_missing_influencer() -> None:
    db = FakeSession()
    client = TestClient(_build_app(db))

    response = client.post(
        "/admin/influencers/missing/publication",
        json={"published": True},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Influencer not found"}
    assert db.committed is False


def test_publication_update_requires_admin_user() -> None:
    influencer = SimpleNamespace(
        id="creatorname",
        publication_status=InfluencerPublicationStatus.DRAFT.value,
    )
    db = FakeSession(influencer)
    client = TestClient(_build_app(db, user_id=2))

    response = client.post(
        "/admin/influencers/creatorname/publication",
        json={"published": True},
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "Admin only"}
    assert influencer.publication_status == InfluencerPublicationStatus.DRAFT.value
    assert db.committed is False
