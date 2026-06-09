"""Armloop payment gateway schemas."""
# ruff: noqa: N815

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ArmloopSessionRequest(BaseModel):
    """Request to create Armloop payment session."""

    transactionId: str = Field(..., description="Unique transaction reference")
    amount: int = Field(..., ge=1, description="Payment amount in cents")
    returnUrl: str | None = Field(
        None, max_length=8000, description="URL to redirect after payment"
    )
    surchargeAmount: int | None = Field(
        None, ge=0, description="Surcharge/tip amount in cents"
    )
    mode: str = Field(
        default="hosted", description="Integration mode: embedded or hosted"
    )


class ArmloopAmount(BaseModel):
    """Amount object in Armloop response."""

    currency: str = Field(
        ..., min_length=3, max_length=3, description="ISO currency code"
    )
    value: int = Field(..., description="Amount in minor units (cents)")


class ArmloopSessionResponse(BaseModel):
    """Response from creating Armloop payment session."""

    id: str = Field(..., description="Session ID")
    sessionData: str | None = Field(
        None, description="Encrypted session data for embedded mode"
    )
    amount: ArmloopAmount
    countryCode: str | None = None
    expiresAt: datetime
    merchantAccount: str
    reference: str
    returnUrl: str | None = None
    url: str | None = Field(None, description="Hosted checkout URL (for hosted mode)")


class ArmloopWebhookNotificationItemAmount(BaseModel):
    """Amount in webhook notification."""

    currency: str
    value: int


class ArmloopWebhookNotificationItemData(BaseModel):
    """Notification request item from webhook."""

    additionalData: dict[str, Any] | None = None
    amount: ArmloopWebhookNotificationItemAmount
    eventCode: str
    eventDate: datetime
    merchantAccountCode: str
    merchantReference: str
    operations: list[str] | None = None
    paymentMethod: str | None = None
    pspReference: str
    reason: str | None = None
    success: str  # "true" or "false" as string


class ArmloopWebhookNotificationItem(BaseModel):
    """Notification item wrapper."""

    NotificationRequestItem: ArmloopWebhookNotificationItemData


class ArmloopWebhookPayload(BaseModel):
    """Complete webhook payload from Armloop."""

    live: str  # "true" or "false" as string
    notificationItems: list[ArmloopWebhookNotificationItem]
