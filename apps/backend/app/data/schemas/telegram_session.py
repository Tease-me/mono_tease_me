"""Pydantic schemas for Telegram session management endpoints."""

from pydantic import BaseModel, Field


# ─────────────────── Requests ───────────────────


class SendCodeRequest(BaseModel):
    """Start Telegram auth — send verification code to a phone number."""

    influencer_id: str = Field(..., description="ID of the influencer to auth")
    phone_number: str = Field(
        ...,
        description="Phone number in E.164 format",
        min_length=8,
        max_length=16,
    )


class ResendCodeRequest(BaseModel):
    """Resend the Telegram verification code via a fallback channel."""

    influencer_id: str = Field(..., description="ID of the influencer to resend code for")


class VerifyCodeRequest(BaseModel):
    """Complete Telegram auth with the verification code."""

    influencer_id: str = Field(..., description="ID of the influencer to verify")
    code: str = Field(
        ...,
        description="Telegram verification code",
        min_length=4,
        max_length=8,
    )
    password: str | None = Field(
        default=None,
        description="Optional 2FA password if account has two-step verification",
    )


# ─────────────────── Responses ───────────────────


class SendCodeResponse(BaseModel):
    """Response after initiating Telegram auth."""

    ok: bool
    status: str = Field(description="Auth status (e.g. 'code_sent', 'resumed')")
    phone_code_hash: str | None = Field(
        default=None,
        description="Telegram phone code hash (internal)",
    )


class VerifyCodeResponse(BaseModel):
    """Response after successful Telegram code verification."""

    ok: bool
    status: str = Field(default="authenticated")
    influencer_id: str
    telegram_user: str = Field(description="Telegram username or first name")
    telegram_id: int = Field(description="Telegram user ID")


class SessionInfo(BaseModel):
    """Info about a single Telegram session."""

    influencer_id: str
    connected: bool
    telegram_user: str | None = None
    telegram_id: int | None = None
    has_session_file: bool = False


class SessionListResponse(BaseModel):
    """Response listing all Telegram sessions."""

    sessions: list[SessionInfo]
    count: int


class SessionActionResponse(BaseModel):
    """Generic response for session actions (stop, delete)."""

    ok: bool
    influencer_id: str
    message: str
    logged_out_from_telegram: bool | None = None


class TrialResetUserInfo(BaseModel):
    """Per-user info in a trial reset response."""

    telegram_user_id: int
    calls: int
    used_secs: float


class TrialResetResponse(BaseModel):
    """Response after resetting all Telegram trial call records."""

    ok: bool
    deleted: int
    users_reset: list[TrialResetUserInfo]
