from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.notify_ws import notify_influencer_published as notify_influencer_published_ws
from app.data.models import Influencer
from app.services.email.mailers import send_influencer_published_email
from app.services.gateways.sms_gateway import send_sms_via_sns
from app.services.repositories.pre_influencer_repository import (
    get_pre_influencer_for_influencer_id,
)

log = logging.getLogger(__name__)

INFLUENCER_PUBLISHED_MESSAGE = (
    "You are published — your profile is now live on TeaseMe."
)

_PHONE_ANSWER_KEYS = (
    "phone_number",
    "phone",
    "mobile",
    "q_phone",
    "q_phone_number",
)


def extract_creator_phone_from_survey_answers(
    answers: dict[str, Any] | None,
) -> str | None:
    if not isinstance(answers, dict):
        return None

    for key in _PHONE_ANSWER_KEYS:
        value = answers.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    meta = answers.get("__meta")
    if isinstance(meta, dict):
        for key in _PHONE_ANSWER_KEYS:
            value = meta.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()

    return None


async def notify_creator_influencer_published(
    db: AsyncSession,
    *,
    influencer: Influencer,
) -> None:
    creator_email = (influencer.email or "").strip()
    if not creator_email:
        log.warning(
            "Skipping creator publish notifications: missing influencer email influencer_id=%s",
            influencer.id,
        )
        return

    try:
        resp = send_influencer_published_email(
            to_email=creator_email,
            influencer=influencer,
        )
        if not resp:
            log.warning(
                "Published email not sent for influencer_id=%s email=%s",
                influencer.id,
                creator_email,
            )
    except Exception:
        log.exception(
            "Failed to send published email influencer_id=%s email=%s",
            influencer.id,
            creator_email,
        )

    pre = await get_pre_influencer_for_influencer_id(db, influencer_id=influencer.id)
    phone_number = extract_creator_phone_from_survey_answers(
        pre.survey_answers if pre else None
    )
    if phone_number:
        try:
            sms_resp = send_sms_via_sns(
                phone_number=phone_number,
                message=INFLUENCER_PUBLISHED_MESSAGE,
            )
            if not sms_resp:
                log.warning(
                    "Published SMS not sent for influencer_id=%s",
                    influencer.id,
                )
        except Exception:
            log.exception(
                "Failed to send published SMS influencer_id=%s",
                influencer.id,
            )

    try:
        await notify_influencer_published_ws(
            creator_email,
            influencer_id=str(influencer.id),
            message=INFLUENCER_PUBLISHED_MESSAGE,
        )
    except Exception:
        log.exception(
            "Failed to send published websocket notification influencer_id=%s email=%s",
            influencer.id,
            creator_email,
        )
