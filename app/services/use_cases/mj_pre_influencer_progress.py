from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession


def _has_nonblank_asset_link(answers: dict[str, Any]) -> bool:
    asset_link = answers.get("asset_link")
    return isinstance(asset_link, str) and bool(asset_link.strip())


async def derive_mj_survey_step(_db: AsyncSession, pre: Any) -> int:
    answers = pre.survey_answers if isinstance(pre.survey_answers, dict) else {}

    if _has_nonblank_asset_link(answers):
        return 3

    if bool(getattr(pre, "terms_agreement", False)):
        return 2

    if pre.survey_token:
        return 1

    return 0
