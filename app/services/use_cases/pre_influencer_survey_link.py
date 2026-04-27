from __future__ import annotations

from urllib.parse import urlencode

from app.core.config import settings

PROFILE_SURVEY_ONBOARDING_ROUTE = "/join/onboarding"


def build_pre_influencer_survey_link(
    *,
    token: str | None,
    temp_password: str | None,
) -> str | None:
    if not token or not temp_password:
        return None

    base_url = settings.FRONTEND_URL.rstrip("/")
    query = urlencode({"token": token, "temp_password": temp_password})
    return f"{base_url}{PROFILE_SURVEY_ONBOARDING_ROUTE}?{query}"
