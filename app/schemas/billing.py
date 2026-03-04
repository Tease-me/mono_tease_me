from pydantic import BaseModel
from typing import Literal


class TopUpRequest(BaseModel):
    influencer_id: str
    cents: int


# ── External Checkout (tmservice) ──────────────────────────────────


class CreateCheckoutRequest(BaseModel):
    """Frontend request to initiate a payment checkout."""

    influencer_id: str
    purpose: Literal["subscription", "addon", "topup"]
    provider: Literal["stripe", "paypal"]
    plan_id: int | None = None       # required for subscription / addon
    amount_cents: int | None = None   # required for topup (plan price used otherwise)


class CheckoutResponse(BaseModel):
    """Returned to the frontend after creating a checkout session."""

    checkout_id: str
    payment_url: str
    provider: str
    purpose: str
    amount_cents: int


class VerifyCheckoutRequest(BaseModel):
    """Frontend request to verify payment after user completes checkout."""

    checkout_id: str