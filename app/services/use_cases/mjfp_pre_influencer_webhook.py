"""Fire-and-forget MJFP step webhooks when pre-influencer derived step changes."""

from __future__ import annotations

import asyncio
import logging

from app.core.config import settings
from app.core.session import SessionLocal
from app.data.models.influencer import PreInfluencer
from app.services.gateways.mjfp_webhook_gateway import post_mjfp_teaseme_step_webhook
from app.services.use_cases.mj_pre_influencer_progress import derive_mj_survey_step

log = logging.getLogger(__name__)


def _invite_code_from_pre(pre: PreInfluencer) -> str | None:
    answers = pre.survey_answers if isinstance(pre.survey_answers, dict) else {}
    meta = answers.get("__meta")
    if not isinstance(meta, dict):
        return None
    raw = meta.get("invite_code")
    if isinstance(raw, str) and raw.strip():
        return raw.strip()
    return None


async def _run_mjfp_pre_influencer_step_webhook(pre_id: int) -> None:
    url = (settings.MJFP_WEBHOOK_URL or "").strip()
    secret = settings.MJFP_WEBHOOK_SECRET or ""
    if not url or not secret:
        return

    async with SessionLocal() as db:
        pre = await db.get(PreInfluencer, pre_id)
        if not pre:
            return
        derived = await derive_mj_survey_step(db, pre)
        stored = pre.mjfp_last_notified_derived_step
        if stored is not None and stored == derived:
            return
        invite = _invite_code_from_pre(pre)
        payload: dict = {
            "email": pre.email,
            "currentStep": derived,
            "status": pre.status,
        }
        if invite:
            payload["inviteCode"] = invite

    delivered = await post_mjfp_teaseme_step_webhook(url=url, secret=secret, payload=payload)
    if not delivered:
        return

    async with SessionLocal() as db:
        pre2 = await db.get(PreInfluencer, pre_id)
        if not pre2:
            return
        pre2.mjfp_last_notified_derived_step = await derive_mj_survey_step(db, pre2)
        await db.commit()


def schedule_mjfp_pre_influencer_step_webhook(pre_id: int) -> None:
    """Schedule webhook delivery; never blocks or raises to callers."""
    if not (settings.MJFP_WEBHOOK_URL or "").strip() or not (settings.MJFP_WEBHOOK_SECRET or ""):
        return

    async def _wrapper() -> None:
        try:
            await _run_mjfp_pre_influencer_step_webhook(pre_id)
        except Exception:
            log.exception("[mjfp-webhook] failed pre_id=%s", pre_id)

    asyncio.create_task(_wrapper())
