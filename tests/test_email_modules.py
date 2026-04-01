from types import SimpleNamespace

import pytest

from app.services.email import header_images, mailers
from app.utils.messaging import email as compat_email


def test_compat_email_exports_match_new_modules():
    assert callable(compat_email.send_verification_email)
    assert callable(compat_email.send_profile_survey_email)
    assert callable(compat_email.send_password_reset_email)
    assert callable(compat_email.send_new_influencer_email)
    assert callable(compat_email.send_new_influencer_email_with_picture)
    assert callable(compat_email.send_influencer_survey_completed_email_to_promoter)
    assert callable(compat_email.send_email_via_ses)
    assert callable(compat_email.image_data_url)
    assert callable(compat_email.compose_email_header_image_url)
    assert compat_email.EMAIL_VERIFY_HEADER_URL == header_images.EMAIL_VERIFY_HEADER_URL
    assert compat_email.EMAIL_RESET_HEADER_URL == header_images.EMAIL_RESET_HEADER_URL
    assert (
        compat_email.EMAIL_INFLUENCER_HEADER_BG_URL
        == header_images.EMAIL_INFLUENCER_HEADER_BG_URL
    )
    assert compat_email.EMAIL_HEADER_SIZE == header_images.EMAIL_HEADER_SIZE


def test_image_data_url_uses_presigned_url_helper(monkeypatch):
    captured = {}

    def fake_generate_user_presigned_url(key: str, expires: int):
        captured["key"] = key
        captured["expires"] = expires
        return "https://signed.example/image.png"

    monkeypatch.setattr(
        header_images,
        "generate_user_presigned_url",
        fake_generate_user_presigned_url,
    )

    url = header_images.image_data_url("influencers/loli/profile.jpg")

    assert url == "https://signed.example/image.png"
    assert captured == {
        "key": "influencers/loli/profile.jpg",
        "expires": 60 * 60 * 24 * 7,
    }


@pytest.mark.anyio
async def test_send_verification_email_uses_transport(monkeypatch):
    captured = {}

    def fake_send_email_via_ses(to_email, subject, body_html, body_text=None):
        captured["to_email"] = to_email
        captured["subject"] = subject
        captured["body_html"] = body_html
        captured["body_text"] = body_text
        return {"MessageId": "ses-1"}

    monkeypatch.setattr(mailers, "send_email_via_ses", fake_send_email_via_ses)

    result = await mailers.send_verification_email("user@example.com", "verify-token")

    assert result == {"MessageId": "ses-1"}
    assert captured["to_email"] == "user@example.com"
    assert captured["subject"] == "Confirm your email on TeaseMe!"
    assert "/verify-email?token=verify-token" in captured["body_html"]
    assert "/verify-email?token=verify-token" in captured["body_text"]


def test_send_password_reset_email_uses_transport(monkeypatch):
    captured = {}

    def fake_send_email_via_ses(to_email, subject, body_html, body_text=None):
        captured["to_email"] = to_email
        captured["subject"] = subject
        captured["body_html"] = body_html
        captured["body_text"] = body_text
        return {"MessageId": "ses-2"}

    monkeypatch.setattr(mailers, "send_email_via_ses", fake_send_email_via_ses)

    result = mailers.send_password_reset_email("user@example.com", "reset-token")

    assert result == {"MessageId": "ses-2"}
    assert captured["to_email"] == "user@example.com"
    assert captured["subject"] == "Redefine your TeaseMe password"
    assert "/reset-password?token=reset-token" in captured["body_html"]
    assert "/reset-password?token=reset-token" in captured["body_text"]


def test_send_new_influencer_email_builds_and_sends(monkeypatch):
    captured = {}

    def fake_send_email_via_ses(to_email, subject, body_html, body_text=None):
        captured["to_email"] = to_email
        captured["subject"] = subject
        captured["body_html"] = body_html
        captured["body_text"] = body_text
        return {"MessageId": "ses-3"}

    monkeypatch.setattr(mailers, "send_email_via_ses", fake_send_email_via_ses)

    influencer = SimpleNamespace(
        id="loli",
        profile_picture_key="influencers/loli/profile.jpg",
    )

    result = mailers.send_new_influencer_email(
        "creator@example.com",
        influencer,
        fp_ref_id="promo-123",
    )

    assert result == {"MessageId": "ses-3"}
    assert captured["to_email"] == "creator@example.com"
    assert captured["subject"] == "🎉 Your TeaseMe profile is live!"
    assert "/loli" in captured["body_html"]
    assert "promo-123" in captured["body_html"]


def test_send_new_influencer_email_with_picture_builds_and_sends(monkeypatch):
    captured = {}

    def fake_send_email_via_ses(to_email, subject, body_html, body_text=None):
        captured["to_email"] = to_email
        captured["subject"] = subject
        captured["body_html"] = body_html
        captured["body_text"] = body_text
        return {"MessageId": "ses-4"}

    monkeypatch.setattr(mailers, "send_email_via_ses", fake_send_email_via_ses)
    monkeypatch.setattr(
        mailers,
        "compose_email_header_image_url",
        lambda **_: "https://signed.example/composed-header.jpg",
    )

    influencer = SimpleNamespace(
        id="loli",
        profile_photo_key="influencers/loli/profile.jpg",
    )

    result = mailers.send_new_influencer_email_with_picture(
        "creator@example.com",
        influencer,
    )

    assert result == {"MessageId": "ses-4"}
    assert captured["to_email"] == "creator@example.com"
    assert captured["subject"] == "🎉 Your TeaseMe profile is live!"
    assert "https://signed.example/composed-header.jpg" in captured["body_html"]
