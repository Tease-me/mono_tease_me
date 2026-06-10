import re
from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator, model_validator

INSTAGRAM_USERNAME_PATTERN = re.compile(r"^[a-z0-9._]+$")


class MjpromoterPreregisterRequest(BaseModel):
    email: EmailStr | None = None
    influencer_id: str
    telegram_id: int | None = None
    instagram_username: str | None = None
    full_name: str | None = None

    @field_validator("email", mode="before")
    @classmethod
    def empty_email_means_omitted(cls, v: object) -> object:
        if v is None:
            return None
        if isinstance(v, str) and not v.strip():
            return None
        return v.strip() if isinstance(v, str) else v

    @field_validator("instagram_username", mode="before")
    @classmethod
    def normalize_instagram_username(cls, v: object) -> object:
        if v is None:
            return None
        if not isinstance(v, str):
            return v
        normalized = v.strip().lstrip("@").lower()
        if not normalized:
            return None
        return normalized

    @model_validator(mode="after")
    def require_telegram_or_instagram(self) -> "MjpromoterPreregisterRequest":
        if self.telegram_id is None and not self.instagram_username:
            raise ValueError("telegram_id or instagram_username is required")
        if self.instagram_username and not INSTAGRAM_USERNAME_PATTERN.fullmatch(
            self.instagram_username
        ):
            raise ValueError(
                "instagram_username must contain only lowercase letters, numbers, dots, and underscores"
            )
        return self


class MjpromoterPreregisterResponse(BaseModel):
    ok: bool
    user_id: int
    email: str | None
    message: str
    invite_code: str
    expires_at: datetime | None = None
    instagram_username: str | None = None
