from __future__ import annotations

import re
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.data.enums import InfluencerPublicationStatus
from app.data.models import Influencer


def _normalize_influencer_id(username: str | None) -> str:
    return re.sub(r"[^a-z0-9_]", "", (username or "").lower())


def normalize_influencer_id_from_username(username: str | None) -> str:
    """Normalize username to influencer id (matches Influencer.id / admin routes)."""
    return _normalize_influencer_id(username)


def _has_nonblank_asset_link(answers: dict[str, Any]) -> bool:
    asset_link = answers.get("asset_link")
    return isinstance(asset_link, str) and bool(asset_link.strip())


def _has_accepted_terms(pre: Any) -> bool:
    return getattr(pre, "terms_agreement", False) is True


def _is_survey_step_complete(survey_step: Any) -> bool:
    try:
        return int(survey_step or 0) >= 4
    except (TypeError, ValueError):
        return False


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

    if _has_nonblank_asset_link(answers) and _has_accepted_terms(pre):
        return 3

    if _is_survey_step_complete(getattr(pre, "survey_step", 0)):
        return 2

    if pre.survey_token:
        return 1

    return 0
