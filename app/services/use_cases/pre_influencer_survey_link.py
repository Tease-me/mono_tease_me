from __future__ import annotations

from urllib.parse import urlencode

from app.core.config import settings

PROFILE_SURVEY_ONBOARDING_ROUTE = "/join/onboarding"


def build_pre_influencer_onboarding_path(
    *,
    token: str | None,
    temp_password: str | None,
) -> str | None:
    if not token or not temp_password:
        return None

    query = urlencode({"token": token, "temp_password": temp_password})
    return f"{PROFILE_SURVEY_ONBOARDING_ROUTE}?{query}"


def build_pre_influencer_survey_link(
    *,
    token: str | None,
    temp_password: str | None,
) -> str | None:
    path = build_pre_influencer_onboarding_path(
        token=token,
        temp_password=temp_password,
    )
    if not path:
        return None

    base_url = settings.FRONTEND_URL.rstrip("/")
    return f"{base_url}{path}"
