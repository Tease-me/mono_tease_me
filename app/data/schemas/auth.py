from datetime import date

from fastapi import Form
from pydantic import BaseModel, HttpUrl, field_validator

class LoginRequest(BaseModel):
    email: str
    password: str

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
    
class Token(BaseModel):
    access_token: str
    refresh_token: str

class PasswordResetRequest(BaseModel):
    token: str
    new_password: str
