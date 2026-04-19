from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import billing as billing_route
from app.core.session import get_db
from app.data.models import Influencer
from app.services.use_cases import adult_character_summary as adult_summary_use_case
from app.utils.auth.dependencies import get_current_user


class DummyAsyncSession:
    def __init__(
        self,
        *,
        influencer: object | None = None,
        scalar_values: list[object] | None = None,
    ) -> None:
        self._influencer = influencer
        self._scalar_values = list(scalar_values or [])

    async def get(self, model, key):
        if model is Influencer:
            return self._influencer
        return None

    async def scalar(self, _statement):
        if self._scalar_values:
            return self._scalar_values.pop(0)
        return None


def _call(
    *,
    conversation_id: str,
    created_at: datetime,
    status: str = "done",
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
async def test_get_adult_character_summary_with_latest_call_and_character(
    monkeypatch,
) -> None:
    created_at = datetime(2026, 3, 31, 9, 30, 0, tzinfo=timezone.utc)
    db = DummyAsyncSession(
        scalar_values=[
            SimpleNamespace(price_cents=2),
            _call(
                conversation_id="conv_1",
                created_at=created_at,
                status="billed",
                duration_seconds=42.0,
                adult_character_id=9,
            ),
            -160,
        ]
    )
    monkeypatch.setattr(
        adult_summary_use_case,
        "get_wallet_balance_cents",
        _async_return(2669),
    )

    result = await adult_summary_use_case.get_adult_character_summary(
        db,
        user_id=7,
        influencer_id="loli",
    )

    assert result.influencer_id == "loli"
    assert result.balance_cents == 2669
    assert result.balance_credits == 1601
    assert result.estimated_remaining_call_seconds == 1334
    assert result.latest_adult_call_summary.model_dump() == {
        "duration_seconds": 42.0,
        "cost_cents": 160,
        "cost_credits": 96,
    }


@pytest.mark.anyio
async def test_get_adult_character_summary_uses_pricing_even_when_character_is_missing(
    monkeypatch,
) -> None:
    created_at = datetime(2026, 3, 31, 9, 30, 0, tzinfo=timezone.utc)
    db = DummyAsyncSession(
        scalar_values=[
            SimpleNamespace(price_cents=5),
            _call(
                conversation_id="conv_1",
                created_at=created_at,
                adult_character_id=99,
            ),
            None,
        ],
    )
    monkeypatch.setattr(
        adult_summary_use_case,
        "get_wallet_balance_cents",
        _async_return(1000),
    )

    result = await adult_summary_use_case.get_adult_character_summary(
        db,
        user_id=7,
        influencer_id="loli",
    )

    assert result.balance_cents == 1000
    assert result.balance_credits == 600
    assert result.estimated_remaining_call_seconds == 200
    assert result.latest_adult_call_summary is not None
    assert result.latest_adult_call_summary.duration_seconds is None
    assert result.latest_adult_call_summary.cost_cents is None
    assert result.latest_adult_call_summary.cost_credits is None


@pytest.mark.anyio
async def test_get_adult_character_summary_returns_estimate_without_latest_call(
    monkeypatch,
) -> None:
    db = DummyAsyncSession(scalar_values=[SimpleNamespace(price_cents=2), None])
    monkeypatch.setattr(
        adult_summary_use_case,
        "get_wallet_balance_cents",
        _async_return(500),
    )

    result = await adult_summary_use_case.get_adult_character_summary(
        db,
        user_id=7,
        influencer_id="loli",
    )

    assert result.balance_cents == 500
    assert result.balance_credits == 300
    assert result.estimated_remaining_call_seconds == 250
    assert result.latest_adult_call_summary is None


def test_get_adult_character_summary_route_success(monkeypatch) -> None:
    app = FastAPI()
    app.include_router(billing_route.router)

    async def _override_db():
        yield DummyAsyncSession(
            influencer=SimpleNamespace(id="loli", display_name="Loli")
        )

    async def _override_current_user():
        return SimpleNamespace(id=1)

    async def _fake_summary(db, *, user_id: int, influencer_id: str):
        return {
            "influencer_id": influencer_id,
            "balance_cents": 2669,
            "balance_credits": 1601,
            "estimated_remaining_call_seconds": 1334,
            "latest_adult_call_summary": {
                "duration_seconds": 149.0,
                "cost_cents": 160,
                "cost_credits": 96,
            },
        }

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_user] = _override_current_user
    monkeypatch.setattr(
        billing_route,
        "get_adult_character_summary",
        _fake_summary,
    )

    client = TestClient(app)
    response = client.get("/billing/loli/adult-character-summary")

    assert response.status_code == 200
    assert response.json() == {
        "influencer_id": "loli",
        "balance_cents": 2669,
        "balance_credits": 1601,
        "estimated_remaining_call_seconds": 1334,
        "latest_adult_call_summary": {
            "duration_seconds": 149.0,
            "cost_cents": 160,
            "cost_credits": 96,
        },
    }


def test_get_adult_character_summary_route_returns_404_for_unknown_influencer() -> None:
    app = FastAPI()
    app.include_router(billing_route.router)

    async def _override_db():
        yield DummyAsyncSession(influencer=None)

    async def _override_current_user():
        return SimpleNamespace(id=1)

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_user] = _override_current_user

    client = TestClient(app)
    response = client.get("/billing/missing/adult-character-summary")

    assert response.status_code == 404
    assert response.json() == {"detail": "Influencer not found"}


def test_get_adult_character_summary_route_requires_auth() -> None:
    app = FastAPI()
    app.include_router(billing_route.router)

    async def _override_db():
        yield DummyAsyncSession(
            influencer=SimpleNamespace(id="loli", display_name="Loli")
        )

    app.dependency_overrides[get_db] = _override_db

    client = TestClient(app)
    response = client.get("/billing/loli/adult-character-summary")

    assert response.status_code in {401, 403}


def _async_return(value):
    async def _inner(*args, **kwargs):
        return value

    return _inner
