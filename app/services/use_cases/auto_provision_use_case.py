"""
Auto-provisioning use case — orchestrates the full Telegram account creation pipeline.

This is a multi-step workflow that coordinates:
  1. Twilio gateway (buy phone number)
  2. Telegram session manager (send_code / verify_code / sign_up)
  3. Provisioned number repository (persistence)

Flow:
  Admin → provision_and_create() → buy number → send_code → webhook delivers SMS
  → handle_incoming_sms() → extract code → verify_code or sign_up → session ready

The admin specifies the display name for the Telegram user account
(e.g. the influencer's Instagram handle) via the first_name / last_name params.
"""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.services.gateways import twilio_gateway
from app.services.gateways.telegram.session_manager import session_manager
from app.services.repositories import provisioned_number_repository as pn_repo
from app.data.models.provisioned_number import ProvisionedNumber
from app.utils.telegram_code import extract_telegram_code, derive_country_code
from app.data.enums.telegram_session_status import TelegramSessionStatus

log = logging.getLogger(__name__)

# Track handlers registered via auto-provision to avoid double-registration
_auto_registered_handlers: dict[str, object] = {}


def _register_handlers_on_session(session_id: str, client) -> None:
    """Register TelegramMessageHandler on a newly authenticated session.

    This ensures auto-provisioned sessions can process incoming messages
    immediately, matching the behavior of the manual admin verify-code flow.
    """
    if session_id in _auto_registered_handlers:
        log.debug("Handlers already registered for session=%s", session_id)
        return

    try:
        from app.services.gateways.telegram.handlers import TelegramMessageHandler
        handler = TelegramMessageHandler(client, session_id)
        handler.register()
        _auto_registered_handlers[session_id] = handler
        log.info("auto_provision: handlers registered for session=%s", session_id)
    except Exception:
        log.exception("auto_provision: failed to register handlers for session=%s", session_id)


def _build_webhook_url() -> str:
    """Build the full public URL for the Twilio SMS webhook."""
    base = settings.PUBLIC_BASE_URL.rstrip("/") if settings.PUBLIC_BASE_URL else ""
    if not base:
        log.warning(
            "PUBLIC_BASE_URL not configured — Twilio SMS webhook URL will be empty. "
            "Set PUBLIC_BASE_URL in .env to your public domain."
        )
        return ""
    return f"{base}/webhooks/twilio-sms"


def _session_id_for(record: ProvisionedNumber) -> str:
    """Derive the Telegram session ID from a provisioned number record."""
    return record.influencer_id or f"auto_{record.id}"


# ─────────────────── Search ───────────────────


async def search_numbers(
    country_code: str = "US",
    number_type: str = "local",
    area_code: str | None = None,
    contains: str | None = None,
    limit: int = 10,
) -> list[dict]:
    """Search available Twilio phone numbers (delegates to gateway)."""
    return await twilio_gateway.search_available_numbers(
        country_code=country_code,
        number_type=number_type,
        area_code=area_code,
        contains=contains,
        limit=limit,
    )


# ─────────────────── Provision (one-click) ───────────────────


async def provision_and_create(
    db: AsyncSession,
    phone_number: str,
    influencer_id: str | None = None,
    first_name: str = "User",
    last_name: str = "",
) -> ProvisionedNumber:
    """Full pipeline: buy number → start Telegram auth → wait for auto-verify.

    Args:
        db: Async database session.
        phone_number: E.164 phone number to purchase.
        influencer_id: Optional influencer ID to link.
        first_name: Display name for the Telegram account
                    (e.g. Instagram handle like 'sofia.rose').
        last_name: Optional last name for the Telegram account.

    The verification code capture happens asynchronously via the webhook.
    This function returns immediately after starting the auth process.
    The webhook handler completes the verification when Telegram's SMS arrives.
    """
    webhook_url = _build_webhook_url()

    # Step 1: Buy the phone number from Twilio (gateway)
    log.info("provision: buying number %s", phone_number)
    purchase = await twilio_gateway.buy_phone_number(
        phone_number=phone_number,
        sms_url=webhook_url,
        friendly_name=f"TG-{influencer_id or 'auto'}",
    )

    # Derive country code (utils)
    country_code = derive_country_code(phone_number)

    # Step 2: Create DB record (repository)
    record = await pn_repo.create(
        db,
        phone_number=phone_number,
        twilio_sid=purchase["sid"],
        country_code=country_code,
        influencer_id=influencer_id,
        telegram_first_name=first_name,
        telegram_last_name=last_name,
    )

    # Step 3: Start Telegram auth (gateway)
    session_id = _session_id_for(record)

    try:
        result = await session_manager.send_code(
            influencer_id=session_id,
            phone_number=phone_number,
        )
        log.info("provision: send_code result for %s: %s", phone_number, result.get("status"))
        record = await pn_repo.update_status(db, record, status=TelegramSessionStatus.CODE_SENT)

    except Exception as exc:
        log.exception("provision: send_code failed for %s", phone_number)
        record = await pn_repo.update_status(
            db, record, status=TelegramSessionStatus.FAILED, error_message=str(exc),
        )

    return record


# ─────────────────── Webhook Handler ───────────────────


async def handle_incoming_sms(
    db: AsyncSession,
    from_number: str,
    to_number: str,
    body: str,
) -> dict:
    """Handle an incoming SMS from Twilio (called by the webhook endpoint).

    Looks up the phone number in the DB to correlate with the active session,
    then parses the Telegram verification code and auto-completes the auth.
    """
    log.info("incoming_sms: from=%s to=%s body=%s", from_number, to_number, body[:80])

    # Look up which provisioned number record is waiting for this SMS (DB lookup)
    record = await pn_repo.get_by_phone(db, to_number)
    if not record or record.telegram_session_status not in (
        TelegramSessionStatus.CODE_SENT, TelegramSessionStatus.PENDING,
    ):
        log.warning("incoming_sms: no pending provision for %s", to_number)
        return {"handled": False, "reason": "no_pending_verification"}

    session_id = _session_id_for(record)

    # Extract the code (utils)
    code = extract_telegram_code(body)
    if not code:
        log.warning("incoming_sms: could not extract code from body: %s", body[:80])
        return {"handled": False, "reason": "no_code_found"}

    log.info("incoming_sms: extracted code=%s for session=%s", code, session_id)

    # Verify the code with Telegram (gateway)
    try:
        client = await session_manager.verify_code(
            influencer_id=session_id,
            code=code,
        )

        me = await client.get_me()

        # Register message handlers on the new session so it can
        # process incoming messages immediately (without waiting for
        # a server restart).
        _register_handlers_on_session(session_id, client)

        # Update DB (repository)
        await pn_repo.update_status(
            db, record,
            status=TelegramSessionStatus.VERIFIED,
            telegram_user_id=me.id,
            telegram_username=me.username,
        )

        log.info(
            "incoming_sms: Telegram account verified! phone=%s user_id=%s username=%s",
            to_number, me.id, me.username,
        )
        return {
            "handled": True,
            "telegram_user_id": me.id,
            "telegram_username": me.username,
        }

    except ValueError as exc:
        # Sign-up required for new accounts
        if "SIGN_UP_REQUIRED" in str(exc):
            return await _handle_signup(db, record, session_id)

        log.error("incoming_sms: verify_code failed: %s", exc)
        await pn_repo.update_status(
            db, record, status=TelegramSessionStatus.FAILED, error_message=str(exc),
        )
        return {"handled": False, "reason": str(exc)}

    except Exception as exc:
        log.exception("incoming_sms: unexpected error verifying %s", to_number)
        await pn_repo.update_status(
            db, record, status=TelegramSessionStatus.FAILED, error_message=str(exc),
        )
        return {"handled": False, "reason": str(exc)}


async def _handle_signup(
    db: AsyncSession,
    record: ProvisionedNumber,
    session_id: str,
) -> dict:
    """Handle Telegram new-account sign-up via the public session_manager.sign_up() method.

    Uses the admin-specified first_name / last_name from the provision request
    (e.g. the influencer's Instagram handle).
    """
    log.info("incoming_sms: new account — attempting sign-up for %s", record.phone_number)

    first_name = record.telegram_first_name or "User"
    last_name = record.telegram_last_name or ""

    try:
        client = await session_manager.sign_up(
            influencer_id=session_id,
            first_name=first_name,
            last_name=last_name,
        )

        me = await client.get_me()

        # Register message handlers so the new account is live immediately
        _register_handlers_on_session(session_id, client)

        await pn_repo.update_status(
            db, record,
            status=TelegramSessionStatus.VERIFIED,
            telegram_user_id=me.id,
            telegram_username=me.username,
        )

        log.info(
            "incoming_sms: new account created! phone=%s user_id=%s name='%s %s'",
            record.phone_number, me.id, first_name, last_name,
        )
        return {
            "handled": True,
            "telegram_user_id": me.id,
            "telegram_username": me.username,
            "new_account": True,
        }

    except Exception as signup_exc:
        log.exception("incoming_sms: sign-up failed for %s", record.phone_number)
        await pn_repo.update_status(
            db, record,
            status=TelegramSessionStatus.FAILED,
            error_message=f"Sign-up failed: {signup_exc}",
        )
        return {"handled": False, "reason": f"signup_failed: {signup_exc}"}


# ─────────────────── Management ───────────────────


async def list_provisioned(db: AsyncSession) -> list[ProvisionedNumber]:
    """List all provisioned numbers (delegates to repository)."""
    return await pn_repo.list_all(db)


async def get_provisioned(db: AsyncSession, number_id: int) -> ProvisionedNumber | None:
    """Get a single provisioned number by ID."""
    return await pn_repo.get_by_id(db, number_id)


async def release_number(db: AsyncSession, number_id: int) -> bool:
    """Release a Twilio number and clean up the session."""
    record = await pn_repo.get_by_id(db, number_id)
    if not record:
        return False

    # Release from Twilio (gateway)
    try:
        await twilio_gateway.release_phone_number(record.twilio_sid)
    except Exception as exc:
        log.warning("release_number: Twilio release failed (may already be released): %s", exc)

    # Stop Telegram session if active (gateway)
    session_id = _session_id_for(record)
    try:
        await session_manager.stop_session(session_id)
    except Exception:
        pass

    # Delete record (repository)
    await pn_repo.delete(db, record)
    log.info("release_number: id=%d phone=%s released", number_id, record.phone_number)
    return True


async def retry_verification(
    db: AsyncSession,
    number_id: int,
) -> ProvisionedNumber | None:
    """Retry the Telegram verification for a failed number."""
    record = await pn_repo.get_by_id(db, number_id)
    if not record:
        return None

    session_id = _session_id_for(record)

    try:
        # Clean up any stale pending auth via the gateway's public API
        if session_manager.has_pending_auth(session_id):
            try:
                await session_manager.cancel_pending_auth(session_id)
            except Exception:
                pass

        await session_manager.send_code(
            influencer_id=session_id,
            phone_number=record.phone_number,
        )
        record = await pn_repo.update_status(db, record, status=TelegramSessionStatus.CODE_SENT)

    except Exception as exc:
        log.exception("retry_verification: send_code failed for %s", record.phone_number)
        record = await pn_repo.update_status(
            db, record, status=TelegramSessionStatus.FAILED, error_message=str(exc),
        )

    return record
