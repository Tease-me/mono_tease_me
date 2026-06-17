"""Fire-and-forget MJFP webhook when a first-deposit promo code is redeemed."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from app.core.config import settings
from app.services.gateways.mjfp_webhook_gateway import post_mjfp_teaseme_step_webhook

log = logging.getLogger(__name__)


def _gift_redeemed_webhook_url() -> str | None:
    explicit = (settings.MJFP_GIFT_REDEEMED_WEBHOOK_URL or "").strip()
    if explicit:
        return explicit
    base = (settings.MJFP_API_URL or "").strip().rstrip("/")
    if base:
        return f"{base}/webhooks/teaseme/promo-code-redeemed"
    return None


async def notify_mjfp_promo_code_redeemed(*, promo_code: str, redeemed_at: datetime | None = None) -> None:
    """Notify MJFP that a promo code was redeemed. Never raises."""
    url = _gift_redeemed_webhook_url()
    secret = settings.MJFP_WEBHOOK_SECRET or ""
    if not url or not secret:
        return

    when = redeemed_at or datetime.now(timezone.utc)
    payload = {
        "promo_code": promo_code,
        "redeemed_at": when.isoformat(),
    }

    try:
        delivered = await post_mjfp_teaseme_step_webhook(
            url=url,
            secret=secret,
            payload=payload,
        )
        if not delivered:
            log.warning(
                "[mjfp-gift-redeemed-webhook] delivery failed promo_code=%s",
                promo_code,
            )
    except Exception:
        log.warning(
            "[mjfp-gift-redeemed-webhook] unexpected error promo_code=%s",
            promo_code,
            exc_info=True,
        )
