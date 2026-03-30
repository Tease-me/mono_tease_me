"""
Twilio SMS webhook endpoint.

Public (no auth) — Twilio POSTs incoming SMS messages here.
Delegates to auto_provision_service to parse and auto-verify Telegram codes.

Security: Validates X-Twilio-Signature in production to prove
the request genuinely came from Twilio.
"""

import logging
from fastapi import APIRouter, Request, Depends, Response, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.session import get_db
from app.services.use_cases import auto_provision_use_case

log = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _is_dev_mode() -> bool:
    """Check if we're running in local development (skip signature validation)."""
    base = (settings.PUBLIC_BASE_URL or "").lower()
    return not base or "localhost" in base or "127.0.0.1" in base


async def _validate_twilio_signature(request: Request) -> None:
    """Validate that the incoming request was signed by Twilio.

    Uses the X-Twilio-Signature header and the TWILIO_AUTH_TOKEN
    to verify authenticity. Skips validation in dev mode.
    """
    if _is_dev_mode():
        log.debug("twilio_webhook: dev mode — skipping signature validation")
        return

    auth_token = settings.TWILIO_AUTH_TOKEN
    if not auth_token:
        log.warning(
            "twilio_webhook: TWILIO_AUTH_TOKEN not configured — "
            "cannot validate webhook signature. Allowing request."
        )
        return

    signature = request.headers.get("X-Twilio-Signature", "")
    if not signature:
        log.warning("twilio_webhook: missing X-Twilio-Signature header")
        raise HTTPException(status_code=403, detail="Missing Twilio signature")

    try:
        from twilio.request_validator import RequestValidator

        validator = RequestValidator(auth_token)
        form = await request.form()

        # Use the PUBLIC_BASE_URL — behind a reverse proxy, request.url
        # returns the internal URL (http://localhost:8001/...) but Twilio
        # signed against the public URL. This mismatch causes 403s.
        base = (settings.PUBLIC_BASE_URL or "").rstrip("/")
        url = f"{base}{request.url.path}" if base else str(request.url)

        # Convert form data to a dict of str -> str
        params = {k: str(v) for k, v in form.items()}

        if not validator.validate(url, params, signature):
            log.warning(
                "twilio_webhook: invalid signature for url=%s", url,
            )
            raise HTTPException(status_code=403, detail="Invalid Twilio signature")

        log.debug("twilio_webhook: signature validated successfully")

    except HTTPException:
        raise
    except ImportError:
        log.warning("twilio_webhook: twilio SDK not installed — skipping validation")
    except Exception:
        log.exception("twilio_webhook: signature validation error")
        raise HTTPException(status_code=403, detail="Signature validation failed")


@router.post("/twilio-sms")
async def twilio_sms_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Receive incoming SMS from Twilio.

    Twilio sends form-encoded data with keys like:
    - From: sender phone number
    - To: our Twilio number
    - Body: SMS text content
    - MessageSid, AccountSid, etc.

    Security: Validates X-Twilio-Signature in production.
    """
    # Validate Twilio request signature (production only)
    await _validate_twilio_signature(request)

    form = await request.form()

    from_number = form.get("From", "")
    to_number = form.get("To", "")
    body = form.get("Body", "")
    message_sid = form.get("MessageSid", "")

    log.info(
        "twilio_sms_webhook: sid=%s from=%s to=%s body=%s",
        message_sid, from_number, to_number, body[:60],
    )

    # Delegate to auto-provision service
    result = await auto_provision_use_case.handle_incoming_sms(
        db=db,
        from_number=from_number,
        to_number=to_number,
        body=body,
    )

    log.info("twilio_sms_webhook: result=%s", result)

    # Return empty TwiML response (don't reply to the SMS)
    return Response(
        content='<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        media_type="application/xml",
    )
