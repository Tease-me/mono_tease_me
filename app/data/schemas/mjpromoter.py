from pydantic import BaseModel, EmailStr


class MjpromoterPreregisterRequest(BaseModel):
    email: EmailStr | None = None
    influencer_id: str
    telegram_id: int
    full_name: str | None = None


class MjpromoterPreregisterResponse(BaseModel):
    ok: bool
    user_id: int
    email: str | None
    message: str
    verification_url: str
