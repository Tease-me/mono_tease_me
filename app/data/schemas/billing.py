from pydantic import BaseModel
from typing import Literal


class LatestAdultCallSummaryOut(BaseModel):
    duration_seconds: float | None = None
    cost_cents: int | None = None


class AdultCharacterSummaryOut(BaseModel):
    influencer_id: str
    balance_cents: int
    balance_credits: int
    estimated_remaining_call_seconds: int | None = None
    latest_adult_call_summary: LatestAdultCallSummaryOut | None = None


class TopUpRequest(BaseModel):
    influencer_id: str
    cents: int


# ── External Checkout (tmservice) ──────────────────────────────────


class CreateCheckoutRequest(BaseModel):
    """Frontend request to initiate a credit top-up checkout."""

    influencer_id: str
    provider: Literal["stripe", "paypal"]
    amount_cents: int


class CheckoutResponse(BaseModel):
    """Returned to the frontend after creating a checkout session."""

    checkout_id: str
    payment_url: str
    provider: str
    amount_cents: int
    credited_credits: int
    conversion_rate: dict[str, int]


class VerifyCheckoutRequest(BaseModel):
    """Frontend request to verify payment after user completes checkout."""

    checkout_id: str
