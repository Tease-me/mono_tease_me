from types import SimpleNamespace

import pytest

from app.services.email import header_images, mailers


def test_email_modules_export_expected_public_symbols():
    assert callable(mailers.send_verification_email)
    assert callable(mailers.send_profile_survey_email)
    assert callable(mailers.send_password_reset_email)
    assert callable(mailers.send_new_influencer_email)
    assert callable(mailers.send_new_influencer_email_with_picture)
    assert callable(mailers.send_influencer_survey_completed_email_to_promoter)
    assert callable(mailers.send_pre_influencer_converted_admin_email)
    assert callable(header_images.image_data_url)
    assert callable(header_images.compose_email_header_image_url)
    assert isinstance(header_images.EMAIL_VERIFY_HEADER_URL, str)
    assert isinstance(header_images.EMAIL_RESET_HEADER_URL, str)
    assert isinstance(header_images.EMAIL_INFLUENCER_HEADER_BG_URL, str)
    assert isinstance(header_images.EMAIL_HEADER_SIZE, tuple)


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
    assert captured["subject"] == "Just One More Step – Confirm Your Email"
    assert header_images.EMAIL_VERIFY_HEADER_URL in captured["body_html"]
    assert "Hi! Welcome to TeaseMe" in captured["body_html"]
    assert "Confirm Email" in captured["body_html"]
    assert "/verify-email?token=verify-token" in captured["body_html"]
    assert "/verify-email?token=verify-token" in captured["body_text"]


@pytest.mark.anyio
async def test_send_verification_email_uses_dynamic_influencer_heading(monkeypatch):
    captured = {}

    def fake_send_email_via_ses(to_email, subject, body_html, body_text=None):
        captured["to_email"] = to_email
        captured["subject"] = subject
        captured["body_html"] = body_html
        captured["body_text"] = body_text
        return {"MessageId": "ses-1b"}

    monkeypatch.setattr(mailers, "send_email_via_ses", fake_send_email_via_ses)

    result = await mailers.send_verification_email(
        "user@example.com",
        "verify-token",
        influencer_id="juliana",
        influencer_display_name="Juliana",
    )

    assert result == {"MessageId": "ses-1b"}
    assert captured["subject"] == "Just One More Step – Confirm Your Email"
    assert "Hi! Welcome to your Juliana" in captured["body_html"]


@pytest.mark.anyio
async def test_send_verification_email_prefers_uploaded_header_url(monkeypatch):
    captured = {}

    def fake_send_email_via_ses(to_email, subject, body_html, body_text=None):
        captured["body_html"] = body_html
        return {"MessageId": "ses-1c"}

    def fail_compose_email_header_image_url(**kwargs):
        raise AssertionError("compose_email_header_image_url should not be used")

    monkeypatch.setattr(mailers, "send_email_via_ses", fake_send_email_via_ses)
    monkeypatch.setattr(
        mailers,
        "compose_email_header_image_url",
        fail_compose_email_header_image_url,
    )

    result = await mailers.send_verification_email(
        "user@example.com",
        "verify-token",
        influencer_id="juliana",
        influencer_verification_header_url="https://cdn.test/influencer/juliana/email/verification-header.jpg",
        influencer_profile_photo_key="influencers/juliana/profile.jpg",
    )

    assert result == {"MessageId": "ses-1c"}
    assert "https://cdn.test/influencer/juliana/email/verification-header.jpg" in captured["body_html"]


@pytest.mark.anyio
async def test_send_verification_email_falls_back_to_composed_header(monkeypatch):
    captured = {}

    def fake_send_email_via_ses(to_email, subject, body_html, body_text=None):
        captured["body_html"] = body_html
        return {"MessageId": "ses-1d"}

    monkeypatch.setattr(mailers, "send_email_via_ses", fake_send_email_via_ses)
    monkeypatch.setattr(
        mailers,
        "compose_email_header_image_url",
        lambda **_: "https://signed.example/composed-verification-header.jpg",
    )

    result = await mailers.send_verification_email(
        "user@example.com",
        "verify-token",
        influencer_id="juliana",
        influencer_profile_photo_key="influencers/juliana/profile.jpg",
    )

    assert result == {"MessageId": "ses-1d"}
    assert "https://signed.example/composed-verification-header.jpg" in captured["body_html"]


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
    assert header_images.EMAIL_RESET_HEADER_URL in captured["body_html"]
    assert "Forgot Your Password?" in captured["body_html"]
    assert "Reset My Password" in captured["body_html"]
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


def test_send_pre_influencer_converted_admin_email_builds_and_sends(monkeypatch):
    captured = {}

    def fake_send_email_via_ses(to_email, subject, body_html, body_text=None):
        captured["to_email"] = to_email
        captured["subject"] = subject
        captured["body_html"] = body_html
        captured["body_text"] = body_text
        return {"MessageId": "ses-admin-1"}

    monkeypatch.setattr(mailers, "send_email_via_ses", fake_send_email_via_ses)

    result = mailers.send_pre_influencer_converted_admin_email(
        to_email="admin@example.com",
        pre_influencer_id=123,
        influencer_id="creatorname",
        display_name="Creator Name",
        creator_email="creator@example.com",
        publication_status="draft",
    )

    assert result == {"MessageId": "ses-admin-1"}
    assert captured["to_email"] == "admin@example.com"
    assert captured["subject"] == "Pre-influencer converted to influencer"
    assert "Creator Name" in captured["body_html"]
    assert "Pre-influencer ID: 123" in captured["body_html"]
    assert "Influencer ID: creatorname" in captured["body_html"]
    assert "creator@example.com" in captured["body_html"]
    assert "Publication status: draft" in captured["body_html"]
    assert "/creatorname" in captured["body_html"]
    assert "Profile link:" in captured["body_text"]
    assert "/creatorname" in captured["body_text"]
