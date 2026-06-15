from __future__ import annotations

from datetime import datetime, timedelta
from types import SimpleNamespace

from app.services.use_cases.vip_invite_status import (
    build_vip_invite_status_result,
    derive_vip_invite_status,
)


def _user(**overrides):
    base = {
        "id": 1,
        "email": "instagram-glaucomp@mjpromoter.placeholder.invalid",
        "is_verified": False,
        "email_token": "HYC4K8",
        "username": "glaucomp",
        "full_name": "Glauco",
        "date_of_birth": None,
        "created_at": datetime(2026, 6, 10, 10, 0, 0),
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def test_derive_vip_invite_status_pending_within_ttl() -> None:
    user = _user()
    now = user.created_at + timedelta(hours=1)
    assert derive_vip_invite_status(user, now=now) == "pending"


def test_derive_vip_invite_status_expired_after_two_days() -> None:
    user = _user()
    now = user.created_at + timedelta(days=2, minutes=1)
    assert derive_vip_invite_status(user, now=now) == "expired"


def test_derive_vip_invite_status_in_progress_after_profile_completion() -> None:
    user = _user(
        email="test@jamieeeee.com",
        date_of_birth=datetime(1999, 1, 2),
        email_token="long-email-verification-token",
    )
    assert derive_vip_invite_status(user) == "in_progress"


def test_derive_vip_invite_status_completed_when_verified() -> None:
    user = _user(is_verified=True, email="test@jamieeeee.com")
    assert derive_vip_invite_status(user) == "completed"


def test_build_vip_invite_status_result_returns_invite_code_when_unredeemed() -> None:
    result = build_vip_invite_status_result(_user())
    assert result.invite_code == "HYC4K8"
    assert result.status == "pending"
    assert result.expires_at == _user().created_at + timedelta(days=2)


def test_build_vip_invite_status_result_keeps_stored_invite_code_after_redemption() -> None:
    result = build_vip_invite_status_result(
        _user(
            email="test@jamieeeee.com",
            date_of_birth=datetime(1999, 1, 2),
            email_token="long-email-verification-token",
            vip_invite_code="HYC4K8",
        )
    )
    assert result.invite_code == "HYC4K8"
    assert result.status == "in_progress"
    assert result.email == "test@jamieeeee.com"


def test_build_vip_invite_status_result_omits_placeholder_email() -> None:
    result = build_vip_invite_status_result(_user())
    assert result.email is None
