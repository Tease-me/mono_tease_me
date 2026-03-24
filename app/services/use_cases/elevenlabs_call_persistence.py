from __future__ import annotations

import asyncio
import logging
import math
from typing import Any

from fastapi import HTTPException

from app.data.models import CallRecord
from app.core.session import SessionLocal
from app.services.gateways.elevenlabs.conversation_gateway import ElevenLabsConversationGateway
from app.services.repositories.call_record import (
    claim_billing_slot,
    mark_billing_done,
    reset_billing_slot,
)
from app.services.adult_character_billing import charge_adult_character_voice_call
from app.services.billing import charge_feature, resolve_voice_billing_mode
from app.services.chat_service import get_or_create_chat
from app.services.use_cases.elevenlabs_transcript_persistence import persist_transcript_to_chat
from app.utils.elevenlabs_conversation import extract_total_seconds, normalize_transcript

log = logging.getLogger(__name__)

_conversation_gateway = ElevenLabsConversationGateway()


async def ensure_transcript_snapshot(
    conversation_id: str,
    snapshot: dict[str, Any],
) -> dict[str, Any]:
    if snapshot.get("transcript"):
        return snapshot
    try:
        refreshed = await _conversation_gateway.get_conversation_snapshot(
            conversation_id
        )
        if refreshed.get("transcript"):
            return refreshed
    except Exception as exc:
        log.warning(
            "ensure_transcript.refetch_failed conv=%s err=%s", conversation_id, exc
        )
    return snapshot


async def wait_until_terminal_status(
    conversation_id: str,
    *,
    max_wait_secs: int = 180,
    initial_delay: float = 0.8,
    max_delay: float = 5.0,
) -> dict[str, Any]:
    elapsed = 0.0
    delay = initial_delay
    last = await _conversation_gateway.get_conversation_snapshot(conversation_id)
    status = (last.get("status") or "").lower()

    while status not in {"done", "failed"} and elapsed < max_wait_secs:
        await asyncio.sleep(delay)
        elapsed += delay
        delay = min(max_delay, delay * 1.7)
        last = await _conversation_gateway.get_conversation_snapshot(conversation_id)
        status = (last.get("status") or "").lower()
    return last


async def poll_and_persist_conversation(
    conversation_id: str,
    *,
    user_id: int | None,
    influencer_id: str | None,
    chat_id: str | None,
) -> None:
    async with SessionLocal() as db:
        try:
            snapshot = await wait_until_terminal_status(
                conversation_id, max_wait_secs=180
            )
            snapshot = await ensure_transcript_snapshot(conversation_id, snapshot)
        except Exception as exc:
            log.warning(
                "background.wait_failed conv=%s err=%s",
                conversation_id,
                exc,
            )
            return

        status = (snapshot.get("status") or "").lower()
        total_seconds = extract_total_seconds(snapshot)
        normalized_transcript = normalize_transcript(snapshot)

        if not chat_id and user_id and influencer_id:
            try:
                chat_id = await get_or_create_chat(db, user_id, influencer_id)
            except Exception as exc:
                log.warning(
                    "background.chat_id_fallback_failed conv=%s user=%s infl=%s err=%s",
                    conversation_id,
                    user_id,
                    influencer_id,
                    exc,
                )

        if status == "done" and user_id and chat_id:
            try:
                if not influencer_id:
                    from app.services.billing import _get_influencer_id_from_chat

                    influencer_id = await _get_influencer_id_from_chat(db, chat_id)

                if await claim_billing_slot(db, conversation_id):
                    try:
                        call_record = await db.get(CallRecord, conversation_id)
                        meta = {
                            "conversation_id": conversation_id,
                            "status": status,
                            "source": "poll",
                        }
                        if call_record and call_record.is_adult_call:
                            from app.services.repositories.adult.adult_conversation_repository import (
                                get_adult_character_by_id,
                            )

                            if call_record.adult_character_id is None:
                                raise HTTPException(
                                    400,
                                    "Missing adult_character_id for adult call billing",
                                )
                            character = await get_adult_character_by_id(
                                db, call_record.adult_character_id
                            )
                            if not character:
                                raise HTTPException(
                                    404, "Adult character not found for billing"
                                )
                            cost_charged = await charge_adult_character_voice_call(
                                db,
                                user_id=user_id,
                                influencer_id=influencer_id,
                                character=character,
                                units=math.ceil(total_seconds),
                                meta=meta,
                                allow_partial=True,
                                auto_commit=False,
                            )
                        else:
                            feature, is_18 = await resolve_voice_billing_mode(
                                db, user_id, influencer_id
                            )
                            cost_charged = await charge_feature(
                                db,
                                user_id=user_id,
                                influencer_id=influencer_id,
                                feature=feature,
                                units=math.ceil(total_seconds),
                                is_18=is_18,
                                meta=meta,
                                allow_partial=True,
                                auto_commit=False,
                            )
                        await mark_billing_done(db, conversation_id)
                        await db.commit()
                        log.info(
                            "poll.billing.success conv=%s user=%s secs=%s cost=%s",
                            conversation_id,
                            user_id,
                            total_seconds,
                            cost_charged,
                        )

                        from app.api.routes.webhooks import _extract_cost_micros
                        from app.services.token_tracker import track_usage_bg

                        cost_micros = _extract_cost_micros(snapshot)
                        track_usage_bg(
                            category="voice",
                            provider="elevenlabs",
                            model="elevenlabs_convai",
                            purpose="call_conversation",
                            user_id=user_id,
                            influencer_id=influencer_id,
                            chat_id=chat_id,
                            duration_secs=float(total_seconds),
                            latency_ms=0,
                            exact_cost_micros=cost_micros,
                        )

                        try:
                            from sqlalchemy import and_
                            from sqlalchemy import select as sa_select

                            from app.api.routes.notify_ws import notify_call_billed
                            from app.data.models import InfluencerWallet
                            from app.data.models import User as UserModel

                            user_obj = await db.get(UserModel, user_id)
                            wallet = await db.scalar(
                                sa_select(InfluencerWallet).where(
                                    and_(
                                        InfluencerWallet.user_id == user_id,
                                        InfluencerWallet.influencer_id == influencer_id,
                                        InfluencerWallet.is_18.is_(is_18),
                                    )
                                )
                            )
                            if user_obj and user_obj.email:
                                await notify_call_billed(
                                    user_obj.email,
                                    balance_cents=int(wallet.balance_cents)
                                    if wallet
                                    else 0,
                                    cost_cents=cost_charged,
                                    duration_secs=total_seconds,
                                    conversation_id=conversation_id,
                                )
                        except Exception as ws_exc:
                            log.warning(
                                "poll.billing.ws_notify_failed conv=%s err=%s",
                                conversation_id,
                                ws_exc,
                            )

                    except Exception as charge_exc:
                        log.exception(
                            "poll.billing.charge_failed conv=%s err=%s — resetting billing slot",
                            conversation_id,
                            charge_exc,
                        )
                        await reset_billing_slot(db, conversation_id)
                else:
                    log.info(
                        "poll.billing.skipped already_billed conv=%s", conversation_id
                    )
            except Exception as billing_exc:
                log.exception(
                    "poll.billing.error conv=%s user=%s err=%s",
                    conversation_id,
                    user_id,
                    billing_exc,
                )

        try:
            if chat_id:
                await persist_transcript_to_chat(
                    db,
                    conversation_json=snapshot,
                    chat_id=chat_id,
                    conversation_id=conversation_id,
                    influencer_id=influencer_id,
                )
        except Exception as exc:
            log.warning(
                "background.persist_transcript_failed conv=%s chat=%s err=%s",
                conversation_id,
                chat_id,
                exc,
            )

        try:
            call_record = await db.get(CallRecord, conversation_id)
            if not call_record:
                call_record = CallRecord(
                    conversation_id=conversation_id,
                    user_id=user_id,
                    influencer_id=influencer_id,
                    chat_id=chat_id,
                )
            call_record.status = (
                status if status != "done" else (call_record.status or status)
            )
            call_record.call_duration_secs = total_seconds
            call_record.transcript = normalized_transcript or call_record.transcript
            if influencer_id:
                call_record.influencer_id = influencer_id
            if chat_id:
                call_record.chat_id = chat_id
            db.add(call_record)
            await db.commit()
        except Exception as exc:
            log.warning(
                "background.update_call_record_failed conv=%s err=%s",
                conversation_id,
                exc,
            )
