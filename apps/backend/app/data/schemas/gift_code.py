"""Pydantic schemas for first-deposit gift codes."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class RedeemGiftCodeRequest(BaseModel):
    code: str = Field(min_length=1, max_length=16)


class RedeemGiftCodeResponse(BaseModel):
    ok: bool = True
    diamonds: int
    new_balance_cents: int
    new_balance_credits: int


class SendGiftCodeResponse(BaseModel):
    ok: bool = True
    code: str
    status: str
    diamonds: int
    expires_at: datetime


class GiftActivityItem(BaseModel):
    user_id: int
    influencer_id: str
    name: str | None
    email: str
    date: datetime | None
    ref: str | None
    lifetime_cents: int
    last_deposit_cents: int
    gift_status: str
    gift_code: str | None = None
    gift_id: int | None = None
    diamonds: int | None = None
    is_first_deposit: bool = False
    deposit_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class GiftActivityResponse(BaseModel):
    items: list[GiftActivityItem]
    pending_count: int


class PendingGiftCountResponse(BaseModel):
    pending_count: int
