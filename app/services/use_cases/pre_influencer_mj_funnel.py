"""MJ Promoter referral onboarding (register → photo/voice → assets + terms)."""

from __future__ import annotations

import re
from typing import Any

from app.services.use_cases import pre_influencer_storage
from app.services.use_cases.pre_influencer_onboarding import (
    _has_answer,
    survey_answers_indicate_terms_accepted,
)

USERNAME_PATTERN = re.compile(r"^[a-z0-9_.]+$")

# Stored on pre_influencer.survey_step for MJ funnel rows only.
MJ_FUNNEL_STEP_PHOTO_VOICE = 0
MJ_FUNNEL_STEP_ASSETS = 1

# Derived MJ currentStep mapping (see derive_mj_survey_step).
MJ_PROGRESS_STEP_REGISTER = 1
MJ_PROGRESS_STEP_PHOTO_VOICE = 2
MJ_PROGRESS_STEP_ASSETS_TERMS = 3


def is_mj_referral_pre_influencer(pre: Any) -> bool:
    answers = getattr(pre, "survey_answers", None)
    if not isinstance(answers, dict):
        return False
    meta = answers.get("__meta")
    if isinstance(meta, dict):
        if meta.get("mj_funnel") is True:
            return True
        invite = meta.get("invite_code")
        if isinstance(invite, str) and invite.strip():
            return True
    return False


def _has_country(*, answers: dict[str, Any], location: str | None) -> bool:
    if location and str(location).strip():
        return True
    return _has_answer(answers.get("q4_country"))


def _has_language(answers: dict[str, Any]) -> bool:
    if _has_answer(answers.get("q5_main_language")):
        return True
    languages = answers.get("q5_languages")
    if isinstance(languages, list):
        return any(_has_answer(item) for item in languages)
    if isinstance(languages, str):
        return _has_answer(languages)
    return _has_answer(answers.get("q6_secondary_language"))


def _has_social(answers: dict[str, Any]) -> bool:
    if _has_answer(answers.get("q3_social_name")):
        return True
    return any(
        _has_answer(value)
        for key, value in answers.items()
        if isinstance(key, str) and key.startswith("social_")
    )


def validate_mj_promoter_register(
    *,
    email: str,
    username: str,
    location: str | None,
    survey_answers: dict[str, Any] | None,
    invitee_email: str | None,
) -> None:
    """Raise ValueError when MJ referral register payload is invalid."""
    if invitee_email is not None:
        invitee = invitee_email.strip().lower()
        if invitee != str(email).strip().lower():
            raise ValueError("invitee_email must match email")

    if not USERNAME_PATTERN.fullmatch(username):
        raise ValueError(
            "username must contain only lowercase letters, numbers, underscores, and dots"
        )

    answers = survey_answers if isinstance(survey_answers, dict) else {}
    if not _has_country(answers=answers, location=location):
        raise ValueError("country is required (q4_country or location)")
    if not _has_language(answers):
        raise ValueError(
            "at least one language is required (q5_main_language, q5_languages, or q6_secondary_language)"
        )
    if not _has_social(answers):
        raise ValueError(
            "at least one social handle is required (q3_social_name or social_* fields)"
        )


def mark_mj_funnel_survey_meta(
    answers: dict[str, Any] | None,
    *,
    registration_meta: dict[str, Any],
) -> dict[str, Any]:
    merged = dict(answers) if isinstance(answers, dict) else {}
    raw_meta = merged.get("__meta")
    meta = dict(raw_meta) if isinstance(raw_meta, dict) else {}
    meta.update(registration_meta)
    meta["mj_funnel"] = True
    merged["__meta"] = meta
    return merged


def _has_profile_picture(answers: dict[str, Any]) -> bool:
    picture_key = answers.get("profile_picture_key")
    return isinstance(picture_key, str) and bool(picture_key.strip())


async def photo_voice_are_complete(pre: Any, answers: dict[str, Any]) -> bool:
    if not _has_profile_picture(answers):
        return False
    pre_id = getattr(pre, "id", None)
    if pre_id in (None, ""):
        return False
    try:
        keys = await pre_influencer_storage.list_audio_keys(str(pre_id))
    except Exception:
        return False
    return bool(keys)


def _has_accepted_terms(pre: Any) -> bool:
    if bool(getattr(pre, "terms_agreement", False)):
        return True
    answers = pre.survey_answers if isinstance(pre.survey_answers, dict) else {}
    return survey_answers_indicate_terms_accepted(answers)


async def mj_funnel_assets_are_complete(pre: Any, answers: dict[str, Any]) -> bool:
    from app.services.use_cases.pre_influencer_onboarding import (
        extract_asset_link_from_answers,
    )

    if extract_asset_link_from_answers(answers):
        return True
    return await photo_voice_are_complete(pre, answers)


async def mj_funnel_assets_and_terms_complete(pre: Any, answers: dict[str, Any]) -> bool:
    return await mj_funnel_assets_are_complete(pre, answers) and _has_accepted_terms(pre)


async def derive_mj_funnel_progress_step(pre: Any, answers: dict[str, Any]) -> int:
    if await mj_funnel_assets_and_terms_complete(pre, answers):
        return MJ_PROGRESS_STEP_ASSETS_TERMS
    if await photo_voice_are_complete(pre, answers):
        return MJ_PROGRESS_STEP_PHOTO_VOICE
    if getattr(pre, "survey_token", None):
        return MJ_PROGRESS_STEP_REGISTER
    return 0
