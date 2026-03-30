"""
Pydantic schemas for phone number provisioning and Telegram account creation.
"""

from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


# ─────────────────── Search ───────────────────


class NumberSearchRequest(BaseModel):
    """Search Twilio's catalog for available phone numbers."""
    country_code: str = Field(default="US", description="ISO 2-letter country (e.g. US, AU, GB)")
    number_type: str = Field(default="local", description="local | mobile | toll_free")
    area_code: str | None = Field(default=None, description="Area code filter")
    contains: str | None = Field(default=None, description="Pattern the number should contain")
    limit: int = Field(default=10, ge=1, le=50)


class AvailableNumber(BaseModel):
    phone_number: str
    friendly_name: str
    locality: str | None = None
    region: str | None = None
    iso_country: str
    capabilities: dict | None = None


class NumberSearchResponse(BaseModel):
    numbers: list[AvailableNumber]
    count: int


# ─────────────────── Provision ───────────────────


class ProvisionRequest(BaseModel):
    """One-click: buy number + create Telegram user account."""
    phone_number: str = Field(..., description="E.164 number to buy (from search results)")
    influencer_id: str | None = Field(default=None, description="Optionally link to an influencer")
    first_name: str = Field(
        default="User",
        description="Display name for the Telegram account (e.g. Instagram handle like 'sofia.rose')",
    )
    last_name: str = Field(
        default="",
        description="Optional last name for the Telegram account",
    )


class ProvisionedNumberResponse(BaseModel):
    """Response representing a provisioned number."""
    id: int
    phone_number: str
    twilio_sid: str
    country_code: str
    influencer_id: str | None = None
    telegram_session_status: str
    telegram_user_id: int | None = None
    telegram_username: str | None = None
    telegram_first_name: str | None = None
    telegram_last_name: str | None = None
    is_active: bool
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProvisionedNumberListResponse(BaseModel):
    numbers: list[ProvisionedNumberResponse]
    count: int


class ProvisionStatusResponse(BaseModel):
    """Status update after a provisioning action."""
    ok: bool
    phone_number: str
    status: str
    message: str
