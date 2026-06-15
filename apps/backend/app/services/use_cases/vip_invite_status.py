"""VIP invite status for MJ Promoter (preregister → complete-profile → verify-email)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal

from app.data.models import User
from app.utils.mjpromoter_email import is_mjpromoter_placeholder_email
from app.utils.vip_invite_code import VIP_INVITE_TTL, is_vip_invite_code

VipInviteStatus = Literal["pending", "in_progress", "completed", "expired"]


def response_email_for_user(user: User) -> str | None:
    """Real inbox only — omit MJ Promoter placeholder addresses."""
    email = getattr(user, "email", None)
    if not email or not str(email).strip():
        return None
    if is_mjpromoter_placeholder_email(str(email)):
        return None
    return str(email).strip()


@dataclass(frozen=True)
class VipInviteStatusResult:
    user_id: int
    status: VipInviteStatus
    invite_code: str | None
    instagram_username: str | None
    full_name: str | None
    email: str | None
    expires_at: datetime
    is_verified: bool

    def as_dict(self) -> dict:
        return {
            "user_id": self.user_id,
            "status": self.status,
            "invite_code": self.invite_code,
            "instagram_username": self.instagram_username,
            "full_name": self.full_name,
            "email": self.email,
            "expires_at": self.expires_at,
            "is_verified": self.is_verified,
        }


def _as_utc_naive(value: datetime) -> datetime:
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def _invite_expires_at(user: User) -> datetime:
    created = getattr(user, "created_at", None)
    if created is None:
        return datetime.utcnow() + VIP_INVITE_TTL
    return _as_utc_naive(created) + VIP_INVITE_TTL


def _profile_started(user: User) -> bool:
    if user.date_of_birth is not None:
        return True
    return not is_mjpromoter_placeholder_email(user.email)


def derive_vip_invite_status(
    user: User,
    *,
    now: datetime | None = None,
) -> VipInviteStatus:
    """Map a preregistered user row to an MJ Promoter invite status."""
    current = _as_utc_naive(now or datetime.utcnow())

    if user.is_verified:
        return "completed"

    if _profile_started(user):
        return "in_progress"

    if _invite_expires_at(user) < current:
        return "expired"

    return "pending"


def build_vip_invite_status_result(
    user: User,
    *,
    now: datetime | None = None,
) -> VipInviteStatusResult:
    stored_code = getattr(user, "vip_invite_code", None)
    if isinstance(stored_code, str) and stored_code.strip():
        invite_code = stored_code.strip().upper()
    else:
        invite_code = normalize_invite_code_for_response(user.email_token)
    return VipInviteStatusResult(
        user_id=user.id,
        status=derive_vip_invite_status(user, now=now),
        invite_code=invite_code,
        instagram_username=user.username,
        full_name=user.full_name,
        email=response_email_for_user(user),
        expires_at=_invite_expires_at(user),
        is_verified=bool(user.is_verified),
    )


def normalize_invite_code_for_response(token: str | None) -> str | None:
    if is_vip_invite_code(token):
        return str(token).strip().upper()
    return None
