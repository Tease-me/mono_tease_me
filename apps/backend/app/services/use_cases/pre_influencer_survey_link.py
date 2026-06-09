from __future__ import annotations

from urllib.parse import urlencode

from app.core.config import settings

PROFILE_SURVEY_ONBOARDING_ROUTE = "/join/onboarding"


def build_pre_influencer_onboarding_path(
    *,
    token: str | None,
    temp_password: str | None,
    start_step: str | None = None,
) -> str | None:
    if not token or not temp_password:
        return None

    params: dict[str, str] = {"token": token, "temp_password": temp_password}
    if start_step and start_step.strip():
        params["start_step"] = start_step.strip()
    query = urlencode(params)
    return f"{PROFILE_SURVEY_ONBOARDING_ROUTE}?{query}"


def build_pre_influencer_survey_link(
    *,
    token: str | None,
    temp_password: str | None,
    start_step: str | None = None,
) -> str | None:
    path = build_pre_influencer_onboarding_path(
        token=token,
        temp_password=temp_password,
        start_step=start_step,
    )
    if not path:
        return None

    base_url = settings.FRONTEND_URL.rstrip("/")
    return f"{base_url}{path}"
