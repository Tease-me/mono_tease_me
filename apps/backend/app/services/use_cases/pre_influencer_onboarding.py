from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.use_cases.pre_influencer_survey_prompt import load_survey_questions

MERGED_REGISTER_QUESTION_IDS = frozenset(
    {
        "q3_social_name",
        "q4_country",
        "q5_main_language",
        "q6_secondary_language",
    }
)
REMOVED_ONBOARDING_SECTION_ID = "basic-info"


def filter_active_onboarding_sections(
    sections: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    filtered_sections: list[dict[str, Any]] = []
    carryover_questions: list[dict[str, Any]] = []
    for section in sections:
        questions = section.get("questions")
        if not isinstance(questions, list):
            filtered_section = dict(section)
            if carryover_questions:
                filtered_section["questions"] = [*carryover_questions]
                carryover_questions = []
            filtered_sections.append(filtered_section)
            continue

        filtered_questions = [
            dict(question)
            for question in questions
            if not (
                isinstance(question, dict)
                and question.get("id") in MERGED_REGISTER_QUESTION_IDS
            )
        ]
        if not filtered_questions:
            continue

        if section.get("id") == REMOVED_ONBOARDING_SECTION_ID:
            carryover_questions.extend(filtered_questions)
            continue

        filtered_section = dict(section)
        if carryover_questions:
            filtered_section["questions"] = [*carryover_questions, *filtered_questions]
            carryover_questions = []
        else:
            filtered_section["questions"] = filtered_questions
        filtered_sections.append(filtered_section)

    if carryover_questions:
        filtered_sections.append(
            {
                "id": REMOVED_ONBOARDING_SECTION_ID,
                "title": "Basic Info",
                "questions": carryover_questions,
            }
        )
    return filtered_sections


async def load_active_onboarding_sections(
    db: AsyncSession,
) -> list[dict[str, Any]]:
    sections = await load_survey_questions(db)
    return filter_active_onboarding_sections(sections)


def _has_answer(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (list, tuple, set, dict)):
        return bool(value)
    return True


def _is_truthy_flag(value: Any) -> bool:
    if value is True:
        return True
    if isinstance(value, str):
        return value.strip().lower() in {"true", "1", "yes", "on"}
    if isinstance(value, (int, float)):
        return value == 1
    return False


_ASSET_LINK_ANSWER_KEYS = (
    "asset_link",
    "assetLink",
    "assets_link",
    "assetsLink",
)


def extract_asset_link_from_answers(answers: dict[str, Any] | None) -> str | None:
    if not isinstance(answers, dict):
        return None
    for key in _ASSET_LINK_ANSWER_KEYS:
        value = answers.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    meta = answers.get("__meta")
    if isinstance(meta, dict):
        for key in _ASSET_LINK_ANSWER_KEYS:
            value = meta.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    return None


def normalize_asset_link_in_survey_answers(answers: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(answers)
    link = extract_asset_link_from_answers(normalized)
    if link:
        normalized["asset_link"] = link
    return normalized


def survey_answers_indicate_terms_accepted(answers: dict[str, Any] | None) -> bool:
    if not isinstance(answers, dict):
        return False
    if _is_truthy_flag(answers.get("terms_agreement")):
        return True
    if _is_truthy_flag(answers.get("terms_accepted")):
        return True
    meta = answers.get("__meta")
    if isinstance(meta, dict):
        if _is_truthy_flag(meta.get("terms_agreement")):
            return True
        if _is_truthy_flag(meta.get("terms_accepted")):
            return True
    return False


def is_onboarding_survey_completed(
    survey_step: Any,
    *,
    total_sections: int,
) -> bool:
    if total_sections <= 0:
        return False
    try:
        return int(survey_step or 0) >= max(total_sections - 1, 0)
    except (TypeError, ValueError):
        return False


def derive_initial_onboarding_step(
    survey_answers: dict[str, Any] | None,
    *,
    sections: list[dict[str, Any]],
) -> int:
    if not sections:
        return 0

    answers = survey_answers if isinstance(survey_answers, dict) else {}
    for index, section in enumerate(sections):
        questions = section.get("questions")
        if not isinstance(questions, list) or not questions:
            continue

        question_ids = [
            question.get("id")
            for question in questions
            if isinstance(question, dict) and isinstance(question.get("id"), str)
        ]
        if any(not _has_answer(answers.get(question_id)) for question_id in question_ids):
            return index

    return max(len(sections) - 1, 0)


def seed_register_survey_answers(
    *,
    location: str | None,
    survey_answers: dict[str, Any] | None,
    registration_meta: dict[str, Any],
) -> dict[str, Any] | None:
    answers = dict(survey_answers) if isinstance(survey_answers, dict) else {}
    raw_meta = answers.get("__meta")
    meta = dict(raw_meta) if isinstance(raw_meta, dict) else {}
    meta.update(registration_meta)

    if location and not _has_answer(answers.get("q4_country")):
        answers["q4_country"] = location

    if meta:
        answers["__meta"] = meta

    return answers or None
