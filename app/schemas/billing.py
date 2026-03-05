from pydantic import BaseModel
from typing import Literal


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


class VerifyCheckoutRequest(BaseModel):
    """Frontend request to verify payment after user completes checkout."""

    checkout_id: str