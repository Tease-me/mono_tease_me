from __future__ import annotations

import asyncio
import logging

from app.core.session import SessionLocal
from app.gateways.elevenlabs.agents_gateway import compute_max_duration
from app.gateways.elevenlabs.conversation_gateway import ElevenLabsConversationGateway
from app.services.billing import get_remaining_units, resolve_voice_billing_mode

log = logging.getLogger(__name__)

_conversation_gateway = ElevenLabsConversationGateway()


async def end_conversation_after_credits(
    conversation_id: str,
    user_id: int,
    influencer_id: str,
) -> None:
    """Sleep until the user's credit balance is exhausted, then end the call."""
    try:
        async with SessionLocal() as db:
            feature, is_18 = await resolve_voice_billing_mode(
                db, user_id, influencer_id
            )
            remaining = await get_remaining_units(
                db, user_id, influencer_id, feature=feature, is_18=is_18
            )

        max_secs = compute_max_duration(remaining)
        if max_secs <= 0:
            max_secs = 1

        log.info(
            "credit_guard.scheduled conv=%s user=%s secs=%d",
            conversation_id,
            user_id,
            max_secs,
        )
        await asyncio.sleep(max_secs)

        try:
            snapshot = await _conversation_gateway.get_conversation_snapshot(
                conversation_id
            )
            status = (snapshot.get("status") or "").lower()
            if status in ("done", "failed"):
                log.info(
                    "credit_guard.already_ended conv=%s status=%s",
                    conversation_id,
                    status,
                )
                return
        except Exception:
            pass

        try:
            status_code = await _conversation_gateway.end_conversation(conversation_id)
            log.info(
                "credit_guard.ended conv=%s status=%d",
                conversation_id,
                status_code,
            )
        except Exception as exc:
            log.warning("credit_guard.end_failed conv=%s err=%s", conversation_id, exc)
    except Exception as exc:
        log.exception("credit_guard.fatal conv=%s err=%s", conversation_id, exc)
