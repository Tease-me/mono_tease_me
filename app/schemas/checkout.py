from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel


class PaymentWebhookPayload(BaseModel):
    event: str
    order_id: Optional[str] = None       # PayPal order_id
    session_id: Optional[str] = None     # Stripe session_id
    checkout_id: str                     # Idempotency key
    user_email: str
    user_id: Optional[int] = None
    amount_cents: int
    balance_cents: int
    influencer_id: str
    provider: Literal["paypal", "stripe"]
    timestamp: datetime
