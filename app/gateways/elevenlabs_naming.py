"""Shared naming helpers for ElevenLabs resources."""

from app.core.config import settings


def apply_environment_label(name: str) -> str:
    app_env = (settings.APP_ENV or "local").strip().lower()
    if app_env == "production":
        env_label = "Production"
    elif app_env == "staging":
        env_label = "Staging"
    else:
        env_label = "Dev"
    return f"[{env_label}] {name}"
