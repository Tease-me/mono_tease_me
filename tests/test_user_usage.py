from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api.routes.user import get_user_usage


class FakeScalarsResult:
    def __init__(self, items):
        self._items = list(items)

    def all(self):
        return list(self._items)

    def first(self):
        return self._items[0] if self._items else None


class FakeExecuteResult:
    def __init__(self, *, scalars_items=None, rows=None):
        self._scalars_items = [] if scalars_items is None else scalars_items
        self._rows = [] if rows is None else rows

    def scalars(self):
        return FakeScalarsResult(self._scalars_items)

    def all(self):
        return list(self._rows)


class FakeAsyncSession:
    def __init__(self, results):
        self._results = list(results)

    async def execute(self, _stmt):
        if not self._results:
            raise AssertionError("Unexpected execute call")
        return self._results.pop(0)


def _wallet(*, influencer_id: str, is_18: bool, balance_cents: int):
    return SimpleNamespace(
        influencer_id=influencer_id,
        is_18=is_18,
        balance_cents=balance_cents,
    )


def _pricing(*, feature: str, price_cents: int, free_allowance: int):
    return SimpleNamespace(
        feature=feature,
        price_cents=price_cents,
        free_allowance=free_allowance,
        is_active=True,
    )


def _call(
    *,
    conversation_id: str,
    created_at: datetime,
    status: str = "billed",
    duration_seconds: float | None = None,
    adult_character_id: int | None = None,
):
    return SimpleNamespace(
        conversation_id=conversation_id,
        created_at=created_at,
        status=status,
        call_duration_secs=duration_seconds,
        adult_character_id=adult_character_id,
    )


@pytest.mark.anyio
async def test_get_user_usage_returns_null_latest_adult_call_summary_when_absent() -> None:
    db = FakeAsyncSession(
        [
            FakeExecuteResult(scalars_items=[]),
            FakeExecuteResult(rows=[]),
            FakeExecuteResult(scalars_items=[]),
            FakeExecuteResult(scalars_items=[]),
            FakeExecuteResult(scalars_items=[]),
            FakeExecuteResult(rows=[]),
        ]
    )
    current_user = SimpleNamespace(id=7)

    result = await get_user_usage(
        id=7,
        influencer_id=None,
        current_user=current_user,
        db=db,
    )

    assert result["latest_adult_call_summary"] is None
    assert result["totals"]["adult"]["voice"]["last_call_seconds"] == 0


@pytest.mark.anyio
async def test_get_user_usage_returns_latest_global_adult_call_summary() -> None:
    created_at = datetime(2026, 3, 30, 12, 34, 56, tzinfo=timezone.utc)
    db = FakeAsyncSession(
        [
            FakeExecuteResult(
                scalars_items=[
                    _wallet(influencer_id="inf_1", is_18=True, balance_cents=2500),
                    _wallet(influencer_id="inf_1", is_18=False, balance_cents=1000),
                ]
            ),
            FakeExecuteResult(rows=[]),
            FakeExecuteResult(
                scalars_items=[
                    _pricing(feature="text", price_cents=100, free_allowance=0),
                    _pricing(feature="voice", price_cents=50, free_allowance=0),
                    _pricing(feature="live_chat", price_cents=20, free_allowance=0),
                    _pricing(feature="text_18", price_cents=150, free_allowance=0),
                    _pricing(feature="voice_18", price_cents=75, free_allowance=0),
                ]
            ),
            FakeExecuteResult(
                scalars_items=[
                    _call(
                        conversation_id="conv_latest",
                        created_at=created_at,
                        status="billed",
                        duration_seconds=42.7,
                        adult_character_id=9,
                    )
                ]
            ),
            FakeExecuteResult(scalars_items=[-160]),
            FakeExecuteResult(rows=[]),
        ]
    )
    current_user = SimpleNamespace(id=7)

    result = await get_user_usage(
        id=7,
        influencer_id=None,
        current_user=current_user,
        db=db,
    )

    assert result["latest_adult_call_summary"] == {
        "conversation_id": "conv_latest",
        "status": "billed",
        "duration_seconds": 42.7,
        "created_at": "2026-03-30T12:34:56+00:00",
        "adult_character_id": 9,
        "cost_cents": 160,
    }


@pytest.mark.anyio
async def test_get_user_usage_with_influencer_filter_keeps_global_latest_adult_summary() -> None:
    created_at = datetime(2026, 3, 31, 8, 0, 0, tzinfo=timezone.utc)
    db = FakeAsyncSession(
        [
            FakeExecuteResult(
                scalars_items=[
                    _wallet(influencer_id="inf_1", is_18=True, balance_cents=3200),
                    _wallet(influencer_id="inf_1", is_18=False, balance_cents=500),
                ]
            ),
            FakeExecuteResult(rows=[]),
            FakeExecuteResult(
                scalars_items=[
                    _pricing(feature="text", price_cents=100, free_allowance=0),
                    _pricing(feature="voice", price_cents=50, free_allowance=0),
                    _pricing(feature="live_chat", price_cents=20, free_allowance=0),
                    _pricing(feature="text_18", price_cents=150, free_allowance=0),
                    _pricing(feature="voice_18", price_cents=80, free_allowance=0),
                ]
            ),
            FakeExecuteResult(
                scalars_items=[
                    _call(
                        conversation_id="conv_global_latest",
                        created_at=created_at,
                        status="pending",
                        duration_seconds=None,
                        adult_character_id=4,
                    )
                ]
            ),
            FakeExecuteResult(scalars_items=[]),
            FakeExecuteResult(
                rows=[
                    SimpleNamespace(
                        influencer_id="inf_1",
                        feature="live_chat_18",
                        units=-61,
                        created_at=created_at,
                    )
                ]
            ),
        ]
    )
    current_user = SimpleNamespace(id=7)

    result = await get_user_usage(
        id=7,
        influencer_id="inf_1",
        current_user=current_user,
        db=db,
    )

    assert result["influencer_id"] == "inf_1"
    assert result["adult"]["voice"]["last_call_seconds"] == 61
    assert result["latest_adult_call_summary"] == {
        "conversation_id": "conv_global_latest",
        "status": "pending",
        "duration_seconds": None,
        "created_at": "2026-03-31T08:00:00+00:00",
        "adult_character_id": 4,
        "cost_cents": None,
    }


@pytest.mark.anyio
async def test_get_user_usage_forbidden_for_other_user() -> None:
    current_user = SimpleNamespace(id=8)

    with pytest.raises(HTTPException) as exc:
        await get_user_usage(
            id=7,
            influencer_id=None,
            current_user=current_user,
            db=FakeAsyncSession([]),
        )

    assert exc.value.status_code == 403
