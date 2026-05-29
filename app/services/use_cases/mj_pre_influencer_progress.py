from __future__ import annotations

import re
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.data.enums import InfluencerPublicationStatus
from app.data.models import Influencer
from app.services.use_cases import pre_influencer_storage
from app.services.use_cases.pre_influencer_mj_funnel import (
    derive_mj_funnel_progress_step,
    is_mj_referral_pre_influencer,
)
from app.services.use_cases.pre_influencer_onboarding import (
    extract_asset_link_from_answers,
    is_onboarding_survey_completed,
    load_active_onboarding_sections,
    survey_answers_indicate_terms_accepted,
)


def _normalize_influencer_id(username: str | None) -> str:
    return re.sub(r"[^a-z0-9_]", "", (username or "").lower())


def normalize_influencer_id_from_username(username: str | None) -> str:
    """Normalize username to influencer id (matches Influencer.id / admin routes)."""
    return _normalize_influencer_id(username)


def _has_nonblank_asset_link(answers: dict[str, Any]) -> bool:
    return extract_asset_link_from_answers(answers) is not None


def _has_profile_picture(answers: dict[str, Any]) -> bool:
    picture_key = answers.get("profile_picture_key")
    return isinstance(picture_key, str) and bool(picture_key.strip())


async def _has_uploaded_audio(pre: Any) -> bool:
    username = getattr(pre, "username", None)
    pre_id = getattr(pre, "id", None)
    if pre_id in (None, "") and not (isinstance(username, str) and username.strip()):
        return False
    try:
        keys = await pre_influencer_storage.list_audio_keys_with_legacy_id(
            username.strip() if isinstance(username, str) and username.strip() else None,
            str(pre_id) if pre_id not in (None, "") else None,
        )
    except Exception:
        return False
    return bool(keys)


def has_accepted_terms(pre: Any) -> bool:
    if bool(getattr(pre, "terms_agreement", False)):
        return True
    answers = pre.survey_answers if isinstance(pre.survey_answers, dict) else {}
    return survey_answers_indicate_terms_accepted(answers)


def _has_accepted_terms(pre: Any) -> bool:
    return has_accepted_terms(pre)


async def assets_are_complete(pre: Any, answers: dict[str, Any]) -> bool:
    """Picture+audio uploads or external asset_link — independent of terms."""
    if _has_nonblank_asset_link(answers):
        return True
    if not _has_profile_picture(answers):
        return False
    return await _has_uploaded_audio(pre)


async def _has_completed_assets(pre: Any, answers: dict[str, Any]) -> bool:
    return await assets_are_complete(pre, answers)


def _is_survey_step_complete_legacy(survey_step: Any) -> bool:
    try:
        return int(survey_step or 0) >= 4
    except (TypeError, ValueError):
        return False


async def _is_survey_step_complete(db: AsyncSession, survey_step: Any) -> bool:
    try:
        sections = await load_active_onboarding_sections(db)
    except Exception:
        return _is_survey_step_complete_legacy(survey_step)
    return is_onboarding_survey_completed(
        survey_step,
        total_sections=len(sections),
    )


def _is_published_influencer(influencer: Any) -> bool:
    return (
        getattr(influencer, "publication_status", None)
        == InfluencerPublicationStatus.PUBLISHED.value
    )


async def derive_mj_survey_step(db: AsyncSession, pre: Any) -> int:
    answers = pre.survey_answers if isinstance(pre.survey_answers, dict) else {}
    influencer_id = _normalize_influencer_id(getattr(pre, "username", None))
    influencer = await db.get(Influencer, influencer_id) if influencer_id else None

    if influencer and _is_published_influencer(influencer):
        return 5

    if getattr(pre, "status", None) == "approved":
        return 4

    if is_mj_referral_pre_influencer(pre):
        return await derive_mj_funnel_progress_step(pre, answers)

    if await _has_completed_assets(pre, answers):
        return 3

    if await _is_survey_step_complete(db, getattr(pre, "survey_step", 0)):
        return 2

    if pre.survey_token:
        return 1

    return 0
