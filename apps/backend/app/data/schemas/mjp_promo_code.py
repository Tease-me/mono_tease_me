"""Pydantic schemas for MJ Promoter gifted promo code redemption."""

from pydantic import BaseModel, Field


class RedeemMjpPromoCodeRequest(BaseModel):
    promo_code: str = Field(min_length=1, max_length=32)
    influencer_id: str = Field(min_length=1)


class RedeemMjpPromoCodeResponse(BaseModel):
    ok: bool = True
    diamonds: int
    new_balance_cents: int
    new_balance_credits: int
    payer_name: str | None = None
