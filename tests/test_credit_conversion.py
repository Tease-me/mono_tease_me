from __future__ import annotations

import json
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import billing as billing_route
from app.api.routes import checkout as checkout_route
from app.core.config import settings
from app.core.session import get_db
from app.data.models import Influencer, InfluencerWallet, PayPalTopUp, User
from app.services.credit_conversion import (
    amount_cents_to_credits,
    balance_cents_to_credits,
    get_conversion_rate,
)
from app.utils.auth.dependencies import get_current_user


class DummyAsyncSession:
    def __init__(
        self,
        *,
        influencer: object | None = None,
        user: object | None = None,
        scalar_values: list[object] | None = None,
    ) -> None:
        self._influencer = influencer
        self._user = user
        self._scalar_values = list(scalar_values or [])
        self.added: list[object] = []
        self.committed = False

    async def get(self, model, key):
        if model is Influencer:
            return self._influencer
        if model is User:
            return self._user
        return None

    async def scalar(self, _statement):
        if self._scalar_values:
            return self._scalar_values.pop(0)
        return None

    def add(self, value):
        self.added.append(value)

    async def flush(self):
        return None

    async def commit(self):
        self.committed = True

    async def refresh(self, _value):
        return None

    async def rollback(self):
        return None


def test_amount_cents_to_credits() -> None:
    assert amount_cents_to_credits(100) == 60
    assert amount_cents_to_credits(250) == 150
    assert amount_cents_to_credits(99) == 59


def test_balance_cents_to_credits() -> None:
    assert balance_cents_to_credits(0) == 0
    assert balance_cents_to_credits(500) == 300
    assert balance_cents_to_credits(2669) == 1601


def test_credit_conversion_rejects_negative_values() -> None:
    with pytest.raises(ValueError):
        amount_cents_to_credits(-1)
    with pytest.raises(ValueError):
        balance_cents_to_credits(-1)


def test_get_balance_returns_balance_credits(monkeypatch) -> None:
    app = FastAPI()
    app.include_router(billing_route.router)

    async def _override_db():
        yield DummyAsyncSession(
            influencer=SimpleNamespace(id="loli", display_name="Loli")
        )

    async def _override_current_user():
        return SimpleNamespace(id=1)

    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)
    monkeypatch.setattr(
        billing_route,
        "get_wallet_balance_cents",
        _async_return(500),
    )
    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_user] = _override_current_user

    client = TestClient(app)
    response = client.get("/billing/balance", params={"influencer_id": "loli"})

    assert response.status_code == 200
    assert response.json() == {
        "influencer_id": "loli",
        "balance_cents": 500,
        "balance_credits": 300,
    }


def test_topup_returns_credit_fields(monkeypatch) -> None:
    app = FastAPI()
    app.include_router(billing_route.router)
    wallet = SimpleNamespace(influencer_id="loli", balance_cents=0)

    async def _override_db():
        yield DummyAsyncSession(scalar_values=[wallet])

    async def _override_current_user():
        return SimpleNamespace(id=1)

    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)
    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_user] = _override_current_user

    client = TestClient(app)
    response = client.post(
        "/billing/topup",
        json={"influencer_id": "loli", "cents": 100},
    )

    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "user_id": 1,
        "influencer_id": "loli",
        "balance_cents": 100,
        "credited_credits": 60,
        "balance_credits": 60,
        "conversion_rate": get_conversion_rate(),
    }


def test_create_checkout_returns_credited_credits(monkeypatch) -> None:
    app = FastAPI()
    app.include_router(billing_route.router)

    async def _override_db():
        yield DummyAsyncSession(
            influencer=SimpleNamespace(id="loli", display_name="Loli")
        )

    async def _override_current_user():
        return SimpleNamespace(id=1)

    async def _fake_create(*args, **kwargs):
        return {
            "checkout_id": "chk_123",
            "payment_url": "https://pay.example/123",
            "provider": "stripe",
            "amount_cents": 100,
        }

    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)
    monkeypatch.setattr("app.services.checkout.create_checkout", _fake_create)
    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_user] = _override_current_user

    client = TestClient(app)
    response = client.post(
        "/billing/create-checkout",
        json={
            "influencer_id": "loli",
            "provider": "stripe",
            "amount_cents": 100,
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "checkout_id": "chk_123",
        "payment_url": "https://pay.example/123",
        "provider": "stripe",
        "amount_cents": 100,
        "credited_credits": 60,
        "conversion_rate": get_conversion_rate(),
    }


def test_verify_checkout_returns_amount_and_credited_credits(monkeypatch) -> None:
    app = FastAPI()
    app.include_router(billing_route.router)
    topup = SimpleNamespace(order_id="chk_123", user_id=1, cents=100)

    async def _override_db():
        yield DummyAsyncSession(scalar_values=[topup])

    async def _override_current_user():
        return SimpleNamespace(id=1)

    async def _fake_verify(*args, **kwargs):
        return "succeeded"

    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)
    monkeypatch.setattr("app.services.checkout.verify_checkout", _fake_verify)
    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_user] = _override_current_user

    client = TestClient(app)
    response = client.post("/billing/verify-checkout", json={"checkout_id": "chk_123"})

    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "checkout_id": "chk_123",
        "status": "succeeded",
        "amount_cents": 100,
        "credited_credits": 60,
        "conversion_rate": get_conversion_rate(),
    }


@pytest.mark.anyio
async def test_payment_webhook_returns_credit_fields(monkeypatch) -> None:
    db = DummyAsyncSession(
        influencer=SimpleNamespace(id="loli", fp_ref_id=None),
        user=SimpleNamespace(id=1, email="test@example.com"),
        scalar_values=[
            SimpleNamespace(
                order_id="chk_123",
                user_id=1,
                influencer_id="loli",
                cents=100,
                credited=False,
                fp_tracked=False,
                status="CREATED",
            )
        ],
    )

    async def _fake_topup_wallet(*args, **kwargs):
        return 500

    monkeypatch.setattr(checkout_route, "topup_wallet", _fake_topup_wallet)
    monkeypatch.setattr(settings, "PAYMENT_WEBHOOK_SECRET", None)

    scope = {
        "type": "http",
        "method": "POST",
        "path": "/checkout/webhook",
        "headers": [],
    }
    body = json.dumps(
        {
            "event": "payment.completed",
            "checkout_id": "chk_123",
            "user_email": "test@example.com",
            "user_id": 1,
            "amount_cents": 100,
            "balance_cents": 500,
            "influencer_id": "loli",
            "provider": "stripe",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    ).encode()

    async def receive():
        return {"type": "http.request", "body": body, "more_body": False}

    request = checkout_route.Request(scope, receive)
    response = await checkout_route.payment_webhook(request, db=db)

    assert response == {
        "ok": True,
        "user_id": 1,
        "influencer_id": "loli",
        "credited_cents": 100,
        "credited_credits": 60,
        "new_balance_cents": 500,
        "new_balance_credits": 300,
        "conversion_rate": get_conversion_rate(),
    }


def _async_return(value):
    async def _inner(*args, **kwargs):
        return value

    return _inner
