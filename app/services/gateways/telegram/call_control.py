"""Telegram raw call-control helpers."""

from __future__ import annotations

import logging

log = logging.getLogger(__name__)


async def reject_incoming_call(
    client,
    phone_call_id: int | None,
    access_hash: int | None,
    *,
    reason: str = "busy",
) -> bool:
    """Explicitly reject an incoming Telegram phone call."""
    if phone_call_id is None or access_hash is None:
        log.warning(
            "telegram.call_reject_skipped reason=missing_call_identity phone_call_id=%s access_hash=%s reject_reason=%s",
            phone_call_id,
            access_hash,
            reason,
        )
        return False

    try:
        from pyrogram.raw.functions.phone import DiscardCall
        from pyrogram.raw.types import (
            InputPhoneCall,
            PhoneCallDiscardReasonBusy,
            PhoneCallDiscardReasonDisconnect,
            PhoneCallDiscardReasonHangup,
            PhoneCallDiscardReasonMissed,
        )
    except Exception:
        log.exception(
            "telegram.call_reject_failed reason=raw_api_unavailable phone_call_id=%s reject_reason=%s",
            phone_call_id,
            reason,
        )
        return False

    reason_type = {
        "busy": PhoneCallDiscardReasonBusy,
        "disconnect": PhoneCallDiscardReasonDisconnect,
        "hangup": PhoneCallDiscardReasonHangup,
        "missed": PhoneCallDiscardReasonMissed,
    }.get(reason, PhoneCallDiscardReasonBusy)

    log.info(
        "telegram.call_reject_start phone_call_id=%s reject_reason=%s",
        phone_call_id,
        reason,
    )

    try:
        await client.invoke(
            DiscardCall(
                peer=InputPhoneCall(
                    id=phone_call_id,
                    access_hash=access_hash,
                ),
                duration=0,
                reason=reason_type(),
                connection_id=0,
                video=False,
            )
        )
        log.info(
            "telegram.call_reject_ok phone_call_id=%s reject_reason=%s",
            phone_call_id,
            reason,
        )
        return True
    except Exception:
        log.exception(
            "telegram.call_reject_failed phone_call_id=%s reject_reason=%s",
            phone_call_id,
            reason,
        )
        return False
