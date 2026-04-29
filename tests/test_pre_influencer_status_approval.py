from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.data.models import PreInfluencer
from app.services.use_cases.approve_pre_influencer_status import (
    approve_pre_influencer_status_only,
)


class FakeSession:
    def __init__(self, pre=None):
        self.pre = pre
        self.added = None
        self.committed = False
        self.refreshed = None
        self.get_calls: list[tuple[object, int]] = []

    async def get(self, model, key: int):
        self.get_calls.append((model, key))
        if model is PreInfluencer and self.pre and key == self.pre.id:
            return self.pre
        return None

    def add(self, obj) -> None:
        self.added = obj

    async def commit(self) -> None:
        self.committed = True

    async def refresh(self, obj) -> None:
        self.refreshed = obj


@pytest.mark.anyio
async def test_status_only_approval_marks_pre_influencer_approved() -> None:
    pre = SimpleNamespace(id=123, status="pending")
    db = FakeSession(pre)

    result = await approve_pre_influencer_status_only(db, 123)

    assert result.model_dump() == {
        "ok": True,
        "pre_influencer_id": 123,
        "status": "approved",
    }
    assert pre.status == "approved"
    assert db.get_calls == [(PreInfluencer, 123)]
    assert db.added is pre
    assert db.committed is True
    assert db.refreshed is pre


@pytest.mark.anyio
async def test_status_only_approval_is_idempotent_for_approved_rows() -> None:
    pre = SimpleNamespace(id=123, status="approved")
    db = FakeSession(pre)

    result = await approve_pre_influencer_status_only(db, 123)

    assert result.status == "approved"
    assert pre.status == "approved"
    assert db.committed is True


@pytest.mark.anyio
async def test_status_only_approval_returns_404_for_missing_pre_influencer() -> None:
    db = FakeSession()

    with pytest.raises(HTTPException) as exc_info:
        await approve_pre_influencer_status_only(db, 123)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "PreInfluencer not found"
    assert db.committed is False
    assert db.added is None
