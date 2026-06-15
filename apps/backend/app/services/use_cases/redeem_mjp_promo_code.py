"""Verify and redeem an MJ Promoter gifted promo code, then credit diamonds."""

import logging

import httpx
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.models import User
from app.services.billing import topup_wallet
from app.services.credit_conversion import balance_cents_to_credits
from app.services.gateways.mjp_promo_gateway import verify_mjp_promo_code

log = logging.getLogger(__name__)

_CENTS_PER_USD = 100
_CREDITS_PER_USD = 60

# Maps MJ Promoter ``reason`` values to (HTTP status, user-facing message).
_REASON_TO_HTTP: dict[str, tuple[int, str]] = {
    "code_not_found": (404, "Promo code not found"),
    "already_redeemed": (409, "This promo code has already been redeemed"),
    "expired": (410, "This promo code has expired"),
    "email_mismatch": (403, "This promo code belongs to a different account"),
    "not_available": (400, "This promo code is not available for redemption"),
}


def _diamonds_to_cents(diamonds: int) -> int:
    return (diamonds * _CENTS_PER_USD) // _CREDITS_PER_USD


async def redeem_mjp_promo_code(
    db: AsyncSession,
    *,
    user: User,
    promo_code: str,
    influencer_id: str,
) -> dict:
    """Verify the promo code with MJ Promoter and credit the user's wallet.

    The MJ Promoter endpoint marks the code as used atomically on the first
    successful call, so this function must not be called more than once per
    user submission (the route layer is responsible for that guarantee).
    """
    normalized = promo_code.strip().upper()

    try:
        result = await verify_mjp_promo_code(promo_code=normalized, email=user.email)
    except httpx.RequestError as exc:
        cause = exc.__cause__ or exc.__context__
        log.warning(
            "[mjp-promo] transport error promo_code=%s type=%s cause=%r",
            normalized,
            type(exc).__name__,
            cause,
        )
        raise HTTPException(
            status_code=503,
            detail="Could not verify promo code. Please try again shortly.",
        ) from exc
    except httpx.HTTPStatusError as exc:
        log.warning(
            "[mjp-promo] upstream error promo_code=%s status=%s body=%s",
            normalized,
            exc.response.status_code,
            exc.response.text[:500],
        )
        raise HTTPException(
            status_code=502,
            detail="Promo code service returned an unexpected error.",
        ) from exc

    if not result.get("valid"):
        reason = result.get("reason", "unknown")
        status_code, detail = _REASON_TO_HTTP.get(reason, (400, "Invalid promo code"))
        raise HTTPException(status_code=status_code, detail=detail)

    diamonds = int(result.get("diamonds") or 0)
    cents = _diamonds_to_cents(diamonds)
    source = f"mjp_promo:{normalized}"

    new_balance = await topup_wallet(
        db,
        user_id=user.id,
        influencer_id=influencer_id,
        cents=cents,
        source=source,
        is_18=False,
    )
    await db.commit()

    log.info(
        "[mjp-promo] redeemed promo_code=%s user_id=%s diamonds=%s",
        normalized,
        user.id,
        diamonds,
    )

    return {
        "ok": True,
        "diamonds": diamonds,
        "new_balance_cents": new_balance,
        "new_balance_credits": balance_cents_to_credits(int(new_balance)),
        "payer_name": result.get("payer_name"),
    }
