"""
Twilio Phone Number Provisioning Gateway.

Wraps Twilio APIs for:
- Searching available phone numbers
- Buying / releasing phone numbers
- Listing owned numbers
- Sending / checking OTP via Verify (utility)
"""

import logging
from typing import Any

from app.core.config import settings

log = logging.getLogger(__name__)

_client: Any = None


def _get_client():
    """Lazily create a Twilio REST client."""
    global _client
    if _client:
        return _client
    try:
        from twilio.rest import Client
    except ImportError:
        raise RuntimeError(
            "twilio package is not installed. "
            "Run: pip install twilio  (or poetry add twilio)"
        )
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        raise RuntimeError(
            "Twilio credentials not configured. "
            "Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env"
        )
    _client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
    return _client


def _twilio_exception():
    """Import TwilioRestException lazily."""
    from twilio.base.exceptions import TwilioRestException
    return TwilioRestException


# ─────────────────── Phone Number Provisioning ───────────────────


async def search_available_numbers(
    country_code: str = "US",
    number_type: str = "local",
    area_code: str | None = None,
    contains: str | None = None,
    sms_enabled: bool = True,
    limit: int = 10,
) -> list[dict]:
    """Search Twilio's catalog for available phone numbers.

    Args:
        country_code: ISO 2-letter country code (e.g. US, AU, GB).
        number_type: One of 'local', 'mobile', 'toll_free'.
        area_code: Optional area code filter.
        contains: Optional pattern the number should contain.
        sms_enabled: If True, only return SMS-capable numbers.
        limit: Max results to return.

    Returns:
        List of dicts with phone_number, friendly_name, capabilities, etc.
    """
    from fastapi.concurrency import run_in_threadpool

    client = _get_client()

    def _search():
        # Get the right resource based on number type
        country = client.available_phone_numbers(country_code)
        if number_type == "mobile":
            resource = country.mobile
        elif number_type == "toll_free":
            resource = country.toll_free
        else:
            resource = country.local

        kwargs = {"limit": limit}
        if sms_enabled:
            kwargs["sms_enabled"] = True
        if area_code:
            kwargs["area_code"] = area_code
        if contains:
            kwargs["contains"] = contains

        numbers = resource.list(**kwargs)
        return [
            {
                "phone_number": n.phone_number,
                "friendly_name": n.friendly_name,
                "locality": getattr(n, "locality", None),
                "region": getattr(n, "region", None),
                "iso_country": n.iso_country,
                "capabilities": {
                    "sms": getattr(n.capabilities, "sms", None) if hasattr(n, "capabilities") and n.capabilities else None,
                    "voice": getattr(n.capabilities, "voice", None) if hasattr(n, "capabilities") and n.capabilities else None,
                    "mms": getattr(n.capabilities, "mms", None) if hasattr(n, "capabilities") and n.capabilities else None,
                },
            }
            for n in numbers
        ]

    try:
        return await run_in_threadpool(_search)
    except _twilio_exception() as exc:
        log.error("twilio.search_numbers failed: %s", exc.msg)
        raise ValueError(f"Twilio error: {exc.msg}") from exc


async def buy_phone_number(
    phone_number: str,
    sms_url: str | None = None,
    friendly_name: str | None = None,
) -> dict:
    """Purchase a phone number and configure its SMS webhook.

    Args:
        phone_number: The E.164 number to purchase (from search results).
        sms_url: Webhook URL that Twilio will POST incoming SMS to.
        friendly_name: Optional label for the number.

    Returns:
        Dict with sid, phone_number, friendly_name, status.
    """
    from fastapi.concurrency import run_in_threadpool

    client = _get_client()

    def _buy():
        kwargs = {"phone_number": phone_number}
        if sms_url:
            kwargs["sms_url"] = sms_url
            kwargs["sms_method"] = "POST"
        if friendly_name:
            kwargs["friendly_name"] = friendly_name

        number = client.incoming_phone_numbers.create(**kwargs)
        return {
            "sid": number.sid,
            "phone_number": number.phone_number,
            "friendly_name": number.friendly_name,
            "status": "active",
        }

    try:
        result = await run_in_threadpool(_buy)
        log.info("twilio.buy_number phone=%s sid=%s", phone_number, result["sid"])
        return result
    except _twilio_exception() as exc:
        log.error("twilio.buy_number failed: %s", exc.msg)
        raise ValueError(f"Twilio error: {exc.msg}") from exc


async def release_phone_number(phone_sid: str) -> bool:
    """Release (delete) a purchased phone number.

    Args:
        phone_sid: The Twilio SID of the phone number (e.g. PN...).

    Returns:
        True if successfully released.
    """
    from fastapi.concurrency import run_in_threadpool

    client = _get_client()

    def _release():
        client.incoming_phone_numbers(phone_sid).delete()

    try:
        await run_in_threadpool(_release)
        log.info("twilio.release_number sid=%s", phone_sid)
        return True
    except _twilio_exception() as exc:
        log.error("twilio.release_number failed: %s", exc.msg)
        raise ValueError(f"Twilio error: {exc.msg}") from exc


async def list_owned_numbers() -> list[dict]:
    """List all phone numbers owned by this Twilio account."""
    from fastapi.concurrency import run_in_threadpool

    client = _get_client()

    def _list():
        numbers = client.incoming_phone_numbers.list(limit=100)
        return [
            {
                "sid": n.sid,
                "phone_number": n.phone_number,
                "friendly_name": n.friendly_name,
                "sms_url": n.sms_url,
                "date_created": str(n.date_created) if n.date_created else None,
            }
            for n in numbers
        ]

    try:
        return await run_in_threadpool(_list)
    except _twilio_exception() as exc:
        log.error("twilio.list_numbers failed: %s", exc.msg)
        raise ValueError(f"Twilio error: {exc.msg}") from exc


# ─────────────────── Verify (OTP utility) ───────────────────


async def send_verification(phone: str, channel: str = "sms") -> dict:
    """Send an OTP code via Twilio Verify."""
    from fastapi.concurrency import run_in_threadpool

    client = _get_client()
    service_sid = settings.TWILIO_VERIFY_SERVICE_SID
    if not service_sid:
        raise RuntimeError("TWILIO_VERIFY_SERVICE_SID not configured.")

    try:
        verification = await run_in_threadpool(
            lambda: client.verify.v2
            .services(service_sid)
            .verifications
            .create(to=phone, channel=channel)
        )
        return {
            "status": verification.status,
            "sid": verification.sid,
            "channel": verification.channel,
            "to": verification.to,
        }
    except _twilio_exception() as exc:
        log.error("twilio.send_verification failed: %s", exc.msg)
        raise ValueError(f"Twilio error: {exc.msg}") from exc


async def check_verification(phone: str, code: str) -> dict:
    """Check an OTP code via Twilio Verify."""
    from fastapi.concurrency import run_in_threadpool

    client = _get_client()
    service_sid = settings.TWILIO_VERIFY_SERVICE_SID
    if not service_sid:
        raise RuntimeError("TWILIO_VERIFY_SERVICE_SID not configured.")

    try:
        check = await run_in_threadpool(
            lambda: client.verify.v2
            .services(service_sid)
            .verification_checks
            .create(to=phone, code=code)
        )
        return {
            "status": check.status,
            "valid": check.valid,
            "sid": check.sid,
        }
    except _twilio_exception() as exc:
        log.error("twilio.check_verification failed: %s", exc.msg)
        raise ValueError(f"Twilio error: {exc.msg}") from exc
