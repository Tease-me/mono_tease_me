from datetime import date

from fastapi import Form
from pydantic import BaseModel, Field, HttpUrl, field_validator


class LoginRequest(BaseModel):
    email: str
    password: str


class PreregisterRequest(BaseModel):
    email: str
    influencer_id: str
    telegram_id: int
    full_name: str | None = None


class PreregisterResponse(BaseModel):
    ok: bool
    user_id: int
    email: str
    message: str
    verification_url: str


class RegisterRequest(BaseModel):
    password: str
    email: str
    influencer_id: str | None = None
    full_name: str | None = None
    user_name: str | None = None
    profile_photo_url: str | None = None
    gender: str | None = None
    date_of_birth: date | None = None
    fp_tid: str | None = None
    invite_code: str | None = None

    @field_validator("profile_photo_url", mode="before")
    @classmethod
    def normalize_profile_photo_url(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            value = v.strip()
            return value or None
        return v

    @field_validator("profile_photo_url")
    @classmethod
    def validate_profile_photo_url(cls, v):
        if v is None:
            return v
        return str(HttpUrl(v))

    @classmethod
    def as_form(
        cls,
        password: str = Form(...),
        email: str = Form(...),
        influencer_id: str | None = Form(default=None),
        full_name: str | None = Form(default=None),
        user_name: str | None = Form(default=None),
        profile_photo_url: str | None = Form(default=None),
        gender: str | None = Form(default=None),
        date_of_birth: date | None = Form(default=None),
        fp_tid: str | None = Form(default=None),
        invite_code: str | None = Form(default=None),
    ) -> "RegisterRequest":
        return cls(
            password=password,
            email=email,
            influencer_id=influencer_id,
            full_name=full_name,
            user_name=user_name,
            profile_photo_url=profile_photo_url,
            gender=gender,
            date_of_birth=date_of_birth,
            fp_tid=fp_tid,
            invite_code=invite_code,
        )


class CompleteProfileRequest(RegisterRequest):
    email: str | None = None
    token: str

    @classmethod
    def as_form(
        cls,
        token: str = Form(...),
        password: str = Form(...),
        influencer_id: str | None = Form(default=None),
        full_name: str | None = Form(default=None),
        user_name: str | None = Form(default=None),
        profile_photo_url: str | None = Form(default=None),
        gender: str | None = Form(default=None),
        date_of_birth: date | None = Form(default=None),
        fp_tid: str | None = Form(default=None),
        invite_code: str | None = Form(default=None),
    ) -> "CompleteProfileRequest":
        return cls(
            token=token,
            password=password,
            influencer_id=influencer_id,
            full_name=full_name,
            user_name=user_name,
            profile_photo_url=profile_photo_url,
            gender=gender,
            date_of_birth=date_of_birth,
            fp_tid=fp_tid,
            invite_code=invite_code,
        )


class CompleteProfileResponse(BaseModel):
    ok: bool
    user_id: int
    email: str
    message: str


class Token(BaseModel):
    access_token: str
    refresh_token: str


class VerifyEmailResponse(BaseModel):
    ok: bool
    message: str
    access_token: str
    refresh_token: str


class CheckEmailTokenRequest(BaseModel):
    token: str = Field(min_length=1)


class CheckEmailTokenResponse(BaseModel):
    ok: bool
    valid: bool
    message: str
    email: str
    full_name: str | None = None
    user_name: str | None = None
    profile_photo_url: str | None = None
    gender: str | None = None
    date_of_birth: date | None = None


class PasswordResetRequest(BaseModel):
    token: str
    new_password: str
