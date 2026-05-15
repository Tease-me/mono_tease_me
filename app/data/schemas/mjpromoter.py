from pydantic import BaseModel, EmailStr, field_validator


class MjpromoterPreregisterRequest(BaseModel):
    email: EmailStr | None = None
    influencer_id: str
    telegram_id: int
    full_name: str | None = None

    @field_validator("email", mode="before")
    @classmethod
    def empty_email_means_omitted(cls, v: object) -> object:
        if v is None:
            return None
        if isinstance(v, str) and not v.strip():
            return None
        return v.strip() if isinstance(v, str) else v


class MjpromoterPreregisterResponse(BaseModel):
    ok: bool
    user_id: int
    email: str | None
    message: str
    verification_url: str
