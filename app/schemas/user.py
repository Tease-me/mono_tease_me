from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    full_name: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    email: Optional[str] = None

class UserUpdate(BaseModel):
    username: Optional[str] = None
    full_name: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[datetime] = None

    @field_validator('username', mode='before')
    @classmethod
    def normalize_username(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            username = v.strip()
            return username or None
        return v

    @field_validator('date_of_birth', mode='before')
    @classmethod
    def strip_timezone(cls, v):
        if v is None:
            return v
        if isinstance(v, datetime):
            return v.replace(tzinfo=None)
        if isinstance(v, str):
            dt = datetime.fromisoformat(v.replace('Z', '+00:00'))
            return dt.replace(tzinfo=None)
        return v


class UserAdultPromptUpdate(BaseModel):
    custom_adult_prompt: Optional[str] = None


class UserAdultPromptOut(BaseModel):
    custom_adult_prompt: Optional[str] = None

class UserRead(UserBase):
    id: int
    email: str
    username: Optional[str] = None
    profile_photo_url: Optional[str] = None
    is_verified: bool
    verification_required: bool = False
    is_identity_verified: bool = False
    is_age_verified: bool = False
    verification_level: Optional[str] = None

    class Config:
        from_attributes = True
# Alias for backward compatibility or clarity
UserOut = UserRead
