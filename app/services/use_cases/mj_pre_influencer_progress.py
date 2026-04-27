from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.use_cases.pre_influencer_survey_prompt import load_survey_questions


def _has_nonblank_asset_link(answers: dict[str, Any]) -> bool:
    asset_link = answers.get("asset_link")
    return isinstance(asset_link, str) and bool(asset_link.strip())


def _survey_is_completed(survey_step: int, total_sections: int) -> bool:
    if total_sections <= 0:
        return False
    return int(survey_step) >= max(total_sections - 1, 0)


async def derive_mj_survey_step(db: AsyncSession, pre: Any) -> int:
    answers = pre.survey_answers if isinstance(pre.survey_answers, dict) else {}

    if _has_nonblank_asset_link(answers):
        return 3

    total_sections = len(await load_survey_questions(db))
    if _survey_is_completed(int(pre.survey_step or 0), total_sections):
        return 2

    if pre.survey_token:
        return 1

    return 0
