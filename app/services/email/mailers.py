from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional
from urllib.parse import urlencode

from fastapi.concurrency import run_in_threadpool

from app.core.config import settings
from app.data.models import Influencer
from app.services.email.header_images import (
    EMAIL_HEADER_SIZE,
    EMAIL_INFLUENCER_HEADER_BG_URL,
    EMAIL_RESET_HEADER_URL,
    EMAIL_VERIFY_HEADER_URL,
    compose_email_header_image_url,
    image_data_url,
)
from app.services.gateways.email_gateway import send_email_via_ses

log = logging.getLogger(__name__)

# Frontend routes used by mailer-generated links.
VERIFY_EMAIL_ROUTE = "/verify-email"
PASSWORD_RESET_ROUTE = "/reset-password"
PROFILE_SURVEY_ONBOARDING_ROUTE = "/join/onboarding"
INFLUENCER_PROFILE_ROUTE = "/{influencer_id}"


def _frontend_base_url() -> str:
    return settings.FRONTEND_URL.rstrip("/")


def _frontend_url(path: str, query: dict[str, str] | None = None) -> str:
    url = f"{_frontend_base_url()}{path}"
    if query:
        url = f"{url}?{urlencode(query)}"
    return url


def _verify_email_url(token: str) -> str:
    return _frontend_url(VERIFY_EMAIL_ROUTE, {"token": token})


def _profile_survey_onboarding_url(token: str, temp_password: str) -> str:
    return _frontend_url(
        PROFILE_SURVEY_ONBOARDING_ROUTE,
        {"token": token, "temp_password": temp_password},
    )


def _password_reset_url(token: str) -> str:
    return _frontend_url(PASSWORD_RESET_ROUTE, {"token": token})


def _influencer_profile_url(influencer_id: str) -> str:
    return _frontend_url(INFLUENCER_PROFILE_ROUTE.format(influencer_id=influencer_id))


def _influencer_referral_url(influencer_id: str, fp_ref_id: str) -> str:
    return _frontend_url(
        INFLUENCER_PROFILE_ROUTE.format(influencer_id=influencer_id),
        {"fpr": fp_ref_id},
    )


async def send_verification_email(
    to_email: str,
    token: str,
    *,
    influencer_id: str | None = None,
    influencer_display_name: str | None = None,
    influencer_verification_header_url: str | None = None,
    influencer_profile_photo_key: Optional[str] = None,
):
    subject = "Just One More Step – Confirm Your Email"
    confirm_url = _verify_email_url(token)
    logo_url = influencer_verification_header_url or EMAIL_VERIFY_HEADER_URL

    if (
        not influencer_verification_header_url
        and influencer_id
        and influencer_profile_photo_key
    ):
        try:
            logo_url = compose_email_header_image_url(
                photo_key=influencer_profile_photo_key,
                background_url=EMAIL_INFLUENCER_HEADER_BG_URL,
                influencer_id=str(influencer_id),
            )
        except Exception:
            log.warning(
                "send_verification_email: failed to compose influencer header influencer_id=%s",
                influencer_id,
                exc_info=True,
            )

    heading_text = "Hi! Welcome to TeaseMe"
    if influencer_display_name and influencer_display_name.strip():
        heading_text = f"Hi! Welcome to your {influencer_display_name.strip()}"

    body_html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{subject}</title>
</head>
<body style="margin:0;padding:0;background:#f1f1f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f1f5;padding:28px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;background:#050505;border-radius:28px;overflow:hidden;box-shadow:0 18px 48px rgba(0,0,0,0.28);">
          <tr>
            <td align="center" style="padding:0;background:#050505;">
              <img
                src="{logo_url}"
                alt="TeaseMe"
                style="display:block;width:100%;max-width:560px;height:auto;border:0;outline:none;text-decoration:none;"
              />
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:36px 42px 18px 42px;background:#050505;">
              <h1 style="margin:0 0 18px 0;font-family:Arial,sans-serif;font-size:32px;line-height:1.2;font-weight:700;color:#ffffff;">
                {heading_text}
              </h1>
              <p style="margin:0 0 34px 0;font-size:16px;line-height:1.55;color:#b8b8be;text-align:center;">
                You are almost done! Before we get started, please verify your email
                address to activate your account. It's quick and helps us keep your account
                safe.
              </p>
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 34px auto;">
                <tr>
                  <td align="center" bgcolor="#ff2f7d" style="border-radius:999px;box-shadow:0 10px 28px rgba(255,47,125,0.35);">
                    <a
                      href="{confirm_url}"
                      style="display:inline-block;padding:18px 44px;font-size:20px;line-height:1;font-weight:700;font-family:Arial,sans-serif;color:#ffffff;text-decoration:none;border-radius:999px;background:#ff2f7d;"
                    >
                      Confirm Email
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 88px 0;font-size:15px;line-height:1.6;color:#a2a2aa;text-align:center;">
                This link will expire in 24 hours.<br/>
                If you didn't sign up for TeaseMe, please ignore this message.<br/>
                Can't wait to talk to you!
              </p>
              <p style="margin:0;font-size:14px;line-height:1.4;color:#76767d;text-align:center;">
                © {datetime.now().year} TeaseMe. All rights reserved
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""
    body_text = (
        "Welcome to TeaseMe!\n"
        f"Please confirm your email by clicking this link: {confirm_url}"
    )
    return await run_in_threadpool(
        send_email_via_ses,
        to_email,
        subject,
        body_html,
        body_text,
    )


def send_pre_influencer_signup_complete_email(
    *,
    to_email: str,
    full_name: str | None = None,
    profile_picture_key: str | None = None,
    pre_influencer_id: str | int | None = None,
):
    subject = "You're all signed up!"
    logo_url = EMAIL_VERIFY_HEADER_URL
    header_id = str(pre_influencer_id or "pre-influencer")
    if profile_picture_key and str(profile_picture_key).strip():
        try:
            logo_url = compose_email_header_image_url(
                photo_key=str(profile_picture_key).strip(),
                background_url=EMAIL_INFLUENCER_HEADER_BG_URL,
                influencer_id=header_id,
            )
        except Exception:
            log.warning(
                "send_pre_influencer_signup_complete_email: failed to compose header pre_influencer_id=%s",
                header_id,
                exc_info=True,
            )

    greeting = f"Hi {full_name}," if full_name and full_name.strip() else "Hi there,"

    body_html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Signup complete</title>
</head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;padding:28px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;background:#050505;border-radius:28px;overflow:hidden;box-shadow:0 18px 48px rgba(0,0,0,0.28);">
          <tr>
            <td align="center" style="padding:0;background:#050505;">
              <img
                src="{logo_url}"
                alt="TeaseMe"
                height="{EMAIL_HEADER_SIZE[1]}"
                style="display:block;width:100%;max-width:560px;height:{EMAIL_HEADER_SIZE[1]}px;border:0;outline:none;text-decoration:none;object-fit:cover;"
              />
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:36px 42px 18px 42px;background:#050505;">
              <h1 style="margin:0 0 18px 0;font-family:Arial,sans-serif;font-size:32px;line-height:1.2;font-weight:700;color:#ffffff;">
                Signup complete
              </h1>
              <p style="margin:0 0 18px 0;font-size:16px;line-height:1.55;color:#b8b8be;text-align:center;">
                {greeting}
              </p>
              <p style="margin:0 0 34px 0;font-size:16px;line-height:1.55;color:#b8b8be;text-align:center;">
                You've finished your TeaseMe signup. Our designer team is now creating
                your AI persona — sit tight and we'll reach out as soon as everything
                is ready.
              </p>
              <p style="margin:0 0 88px 0;font-size:15px;line-height:1.6;color:#a2a2aa;text-align:center;">
                Thanks for joining TeaseMe. ❤️
              </p>
              <p style="margin:0;font-size:14px;line-height:1.4;color:#76767d;text-align:center;">
                © {datetime.now().year} TeaseMe. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""
    body_text = f"""
{greeting}

You've finished your TeaseMe signup. Our designer team is now creating your AI persona — sit tight and we'll reach out as soon as everything is ready.

Thanks for joining TeaseMe. ❤️

© {datetime.now().year} TeaseMe. All rights reserved.
    """.strip()
    return send_email_via_ses(to_email, subject, body_html, body_text)


send_profile_survey_email = send_pre_influencer_signup_complete_email


def send_password_reset_email(to_email: str, token: str):
    subject = "Redefine your TeaseMe password"
    reset_url = _password_reset_url(token)
    logo_url = EMAIL_RESET_HEADER_URL

    body_html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background:#f1f1f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f1f5;padding:28px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;background:#050505;border-radius:28px;overflow:hidden;box-shadow:0 18px 48px rgba(0,0,0,0.28);">
          <tr>
            <td align="center" style="padding:0;background:#050505;">
              <img
                src="{logo_url}"
                alt="TeaseMe"
                style="display:block;width:100%;max-width:560px;height:auto;border:0;outline:none;text-decoration:none;"
              />
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:36px 42px 18px 42px;background:#050505;">
              <h1 style="margin:0 0 18px 0;font-family:Arial,sans-serif;font-size:32px;line-height:1.2;font-weight:700;color:#ffffff;">
                Forgot Your Password?
              </h1>
              <p style="margin:0 0 34px 0;font-size:16px;line-height:1.55;color:#b8b8be;text-align:center;">
                We received a request to reset the password for your TeaseMe account.<br/>
                To create a new password, just click the button below:
              </p>
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 34px auto;">
                <tr>
                  <td align="center" bgcolor="#ff2f7d" style="border-radius:999px;box-shadow:0 10px 28px rgba(255,47,125,0.35);">
                    <a
                      href="{reset_url}"
                      style="display:inline-block;padding:18px 44px;font-size:20px;line-height:1;font-weight:700;font-family:Arial,sans-serif;color:#ffffff;text-decoration:none;border-radius:999px;background:#ff2f7d;"
                    >
                      Reset My Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 88px 0;font-size:15px;line-height:1.6;color:#a2a2aa;text-align:center;">
                This link will expire in 30 minutes to keep your account safe. If you didn't<br/>
                request a password reset, you can safely ignore this email.
              </p>
              <p style="margin:0;font-size:14px;line-height:1.4;color:#76767d;text-align:center;">
                © {datetime.now().year} TeaseMe. All rights reserved
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""
    body_text = f"Reset your TeaseMe password by clicking this link: {reset_url}"
    return send_email_via_ses(to_email, subject, body_html, body_text)


def send_new_influencer_email(
    to_email: str,
    influencer: Influencer,
    fp_ref_id: str | None = None,
):
    subject = "🎉 Your TeaseMe profile is live!"
    public_url = _influencer_profile_url(str(influencer.id))
    referral_url = (
        _influencer_referral_url(str(influencer.id), fp_ref_id) if fp_ref_id else None
    )

    logo_url = EMAIL_VERIFY_HEADER_URL
    if influencer.profile_picture_key:
        try:
            logo_url = image_data_url(influencer.profile_picture_key)
        except Exception:
            log.warning("Failed to load pre-influencer image for email", exc_info=True)

    referral_block = ""
    if referral_url:
        referral_block = f"""
          <p style="font-size:14px;color:#b8b8be;margin:8px 0 10px 0;">
            Your referral link:
          </p>
          <div style="display:inline-block;padding:10px 18px;border-radius:10px;background:#1a1a22;
                      font-family:monospace;font-size:13px;color:#e0e0e8;word-break:break-all;max-width:460px;">
            {referral_url}
          </div>
          <p style="font-size:12px;color:#a2a2aa;margin:10px 0 0 0;">
            Share this link if you want your manager / parent promoter to get credit too.
          </p>
        """

    temp_pw_block = ""
    body_html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Your TeaseMe profile is live</title>
</head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;padding:28px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;background:#050505;border-radius:28px;overflow:hidden;box-shadow:0 18px 48px rgba(0,0,0,0.28);">
          <tr>
            <td align="center" style="padding:0;background:#050505;">
              <img src="{logo_url}" alt="TeaseMe"
                style="display:block;width:100%;max-width:560px;height:auto;border:0;outline:none;text-decoration:none;" />
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:36px 42px 18px 42px;background:#050505;">
              <h1 style="margin:0 0 18px 0;font-family:Arial,sans-serif;font-size:32px;line-height:1.2;font-weight:700;color:#ffffff;">
                You're live on TeaseMe 🎉
              </h1>
              <p style="margin:0 0 34px 0;font-size:16px;line-height:1.55;color:#b8b8be;text-align:center;">
                Your influencer profile is now active. Fans can find you and join your page instantly.
              </p>
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 18px auto;">
                <tr>
                  <td align="center" bgcolor="#ff2f7d" style="border-radius:999px;box-shadow:0 10px 28px rgba(255,47,125,0.35);">
                    <a
                      href="{public_url}"
                      style="display:inline-block;padding:18px 44px;font-size:20px;line-height:1;font-weight:700;font-family:Arial,sans-serif;color:#ffffff;text-decoration:none;border-radius:999px;background:#ff2f7d;"
                    >
                      Open My Profile
                    </a>
                  </td>
                </tr>
              </table>
              <div style="margin-top:10px;font-size:13px;color:#a2a2aa;word-break:break-all;text-align:center;">
                {public_url}
              </div>
              {referral_block}
              {temp_pw_block}
              <p style="margin:34px 0 88px 0;font-size:15px;line-height:1.6;color:#a2a2aa;text-align:center;">
                If you didn't request this, you can safely ignore the email.<br/>
                Let's get you discovered. ❤️
              </p>
              <p style="margin:0;font-size:14px;line-height:1.4;color:#76767d;text-align:center;">
                © {datetime.now().year} TeaseMe. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""
    body_text = (
        f"""
Your TeaseMe profile is live 🎉

Open your profile:
{public_url}
"""
        + (f"\nReferral link:\n{referral_url}\n" if referral_url else "")
        + f"""

© {datetime.now().year} TeaseMe. All rights reserved.
""".strip()
    )
    return send_email_via_ses(to_email, subject, body_html, body_text)


def send_new_influencer_email_with_picture(
    to_email: str,
    influencer: Influencer,
):
    subject = "🎉 Your TeaseMe profile is live!"
    public_url = _influencer_profile_url(str(influencer.id))
    image_background_url = EMAIL_INFLUENCER_HEADER_BG_URL
    key = getattr(influencer, "profile_photo_key", None)
    log.info(
        "send_new_influencer_email_with_picture: building email influencer_id=%s has_profile_photo_key=%s",
        influencer.id,
        bool(key),
        extra={
            "to_email": to_email,
            "influencer_id": str(influencer.id),
            "has_profile_photo_key": bool(key),
            "profile_photo_key": key,
        },
    )
    logo_url = EMAIL_VERIFY_HEADER_URL
    if key:
        try:
            logo_url = compose_email_header_image_url(
                photo_key=key,
                background_url=image_background_url,
                influencer_id=str(influencer.id),
            )
            log.info(
                "send_new_influencer_email_with_picture: using influencer profile photo influencer_id=%s key=%s",
                influencer.id,
                key,
                extra={"influencer_id": str(influencer.id), "key": key},
            )
        except Exception:
            log.warning("Failed to load influencer image for email", exc_info=True)
    else:
        log.info(
            "send_new_influencer_email_with_picture: using default header image influencer_id=%s",
            influencer.id,
            extra={"influencer_id": str(influencer.id)},
        )

    temp_pw_block = ""
    body_html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Your TeaseMe profile is live</title>
</head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;padding:28px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;background:#050505;border-radius:28px;overflow:hidden;box-shadow:0 18px 48px rgba(0,0,0,0.28);">
          <tr>
            <td align="center" style="padding:0;background:#050505;">
              <img
                src="{logo_url}"
                alt="TeaseMe"
                height="{EMAIL_HEADER_SIZE[1]}"
                style="display:block;width:100%;max-width:560px;height:{EMAIL_HEADER_SIZE[1]}px;border:0;outline:none;text-decoration:none;object-fit:cover;"
              />
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:36px 42px 18px 42px;background:#050505;">
              <h1 style="margin:0 0 18px 0;font-family:Arial,sans-serif;font-size:32px;line-height:1.2;font-weight:700;color:#ffffff;">
                You're live on TeaseMe 🎉
              </h1>
              <p style="margin:0 0 34px 0;font-size:16px;line-height:1.55;color:#b8b8be;text-align:center;">
                Your influencer profile is now active. Fans can find you and join your page instantly.
              </p>
              {temp_pw_block}
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 18px auto;">
                <tr>
                  <td align="center" bgcolor="#ff2f7d" style="border-radius:999px;box-shadow:0 10px 28px rgba(255,47,125,0.35);">
                    <a
                      href="{public_url}"
                      style="display:inline-block;padding:18px 44px;font-size:20px;line-height:1;font-weight:700;font-family:Arial,sans-serif;color:#ffffff;text-decoration:none;border-radius:999px;background:#ff2f7d;"
                    >
                      View my profile
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:26px 0 88px 0;font-size:15px;line-height:1.6;color:#a2a2aa;text-align:center;">
                If you didn't request this, you can safely ignore the email.<br/>
                Let's get you discovered. ❤️
              </p>
              <p style="margin:0;font-size:14px;line-height:1.4;color:#76767d;text-align:center;">
                © {datetime.now().year} TeaseMe. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""
    body_text = f"""
Your TeaseMe profile is live 🎉

Open your profile:
{public_url}

© {datetime.now().year} TeaseMe. All rights reserved.
""".strip()
    return send_email_via_ses(to_email, subject, body_html, body_text)


def send_influencer_published_email(
    *,
    to_email: str,
    influencer: Influencer,
):
    subject = "You are published — your profile is now live on TeaseMe."
    public_url = _influencer_profile_url(str(influencer.id))
    published_message = subject
    logo_url = EMAIL_VERIFY_HEADER_URL
    photo_key = getattr(influencer, "profile_photo_key", None)
    if photo_key:
        try:
            logo_url = compose_email_header_image_url(
                photo_key=photo_key,
                background_url=EMAIL_INFLUENCER_HEADER_BG_URL,
                influencer_id=str(influencer.id),
            )
        except Exception:
            log.warning(
                "send_influencer_published_email: failed to compose header influencer_id=%s",
                influencer.id,
                exc_info=True,
            )

    body_html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>You are published</title>
</head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;padding:28px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;background:#050505;border-radius:28px;overflow:hidden;box-shadow:0 18px 48px rgba(0,0,0,0.28);">
          <tr>
            <td align="center" style="padding:0;background:#050505;">
              <img
                src="{logo_url}"
                alt="TeaseMe"
                height="{EMAIL_HEADER_SIZE[1]}"
                style="display:block;width:100%;max-width:560px;height:{EMAIL_HEADER_SIZE[1]}px;border:0;outline:none;text-decoration:none;object-fit:cover;"
              />
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:36px 42px 18px 42px;background:#050505;">
              <h1 style="margin:0 0 18px 0;font-family:Arial,sans-serif;font-size:32px;line-height:1.2;font-weight:700;color:#ffffff;">
                You're live on TeaseMe 🎉
              </h1>
              <p style="margin:0 0 34px 0;font-size:16px;line-height:1.55;color:#b8b8be;text-align:center;">
                {published_message}
              </p>
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 18px auto;">
                <tr>
                  <td align="center" bgcolor="#ff2f7d" style="border-radius:999px;box-shadow:0 10px 28px rgba(255,47,125,0.35);">
                    <a
                      href="{public_url}"
                      style="display:inline-block;padding:18px 44px;font-size:20px;line-height:1;font-weight:700;font-family:Arial,sans-serif;color:#ffffff;text-decoration:none;border-radius:999px;background:#ff2f7d;"
                    >
                      View my profile
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:26px 0 88px 0;font-size:15px;line-height:1.6;color:#a2a2aa;text-align:center;">
                Let's get you discovered. ❤️
              </p>
              <p style="margin:0;font-size:14px;line-height:1.4;color:#76767d;text-align:center;">
                © {datetime.now().year} TeaseMe. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""
    body_text = f"""
{published_message}

Open your profile:
{public_url}

© {datetime.now().year} TeaseMe. All rights reserved.
""".strip()
    return send_email_via_ses(to_email, subject, body_html, body_text)


def send_influencer_survey_completed_email_to_promoter(
    *,
    to_email: str,
    influencer_username: str,
    influencer_full_name: str | None = None,
    influencer_email: str | None = None,
):
    subject = "Influencer completed TeaseMe survey"
    public_url = _influencer_profile_url(influencer_username)
    influencer_line = influencer_username
    if influencer_full_name:
        influencer_line = f"{influencer_full_name} (@{influencer_username})"

    body_html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Influencer survey completed</title>
</head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;padding:28px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;background:#050505;border-radius:28px;overflow:hidden;box-shadow:0 18px 48px rgba(0,0,0,0.28);">
          <tr>
            <td align="center" style="padding:36px 42px 18px 42px;background:#050505;">
              <h1 style="margin:0 0 18px 0;font-family:Arial,sans-serif;font-size:28px;line-height:1.2;font-weight:700;color:#ffffff;">
                Influencer survey completed
              </h1>
              <p style="margin:0 0 16px 0;font-size:16px;line-height:1.55;color:#b8b8be;text-align:center;">
                {influencer_line} has finished their TeaseMe profile survey.
              </p>
              <p style="font-size:14px;color:#b8b8be;margin:0 0 16px 0;text-align:center;">
                Profile link: <a href="{public_url}" style="color:#ff2f7d;text-decoration:none;">{public_url}</a>
              </p>
              {f'<p style="font-size:14px;color:#b8b8be;margin:0 0 16px 0;text-align:center;">Influencer email: {influencer_email}</p>' if influencer_email else ""}
              <p style="margin:34px 0 0 0;font-size:12px;color:#76767d;text-align:center;">
                This is an automated message from TeaseMe.
              </p>
              <p style="margin:16px 0 0 0;font-size:14px;line-height:1.4;color:#76767d;text-align:center;">
                © {datetime.now().year} TeaseMe. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""
    lines = [
        "Influencer survey completed",
        "",
        f"Influencer: {influencer_line}",
        f"Profile link: {public_url}",
    ]
    if influencer_email:
        lines.append(f"Influencer email: {influencer_email}")
    body_text = "\n".join(lines)
    return send_email_via_ses(to_email, subject, body_html, body_text)


def send_pre_influencer_converted_admin_email(
    *,
    to_email: str,
    pre_influencer_id: int,
    influencer_id: str,
    display_name: str | None = None,
    creator_email: str | None = None,
    publication_status: str | None = None,
):
    subject = "Pre-influencer converted to influencer"
    public_url = _influencer_profile_url(influencer_id)
    display_label = display_name or influencer_id
    status_label = publication_status or "unknown"
    creator_email_row = (
        f'<p style="font-size:14px;color:#b8b8be;margin:0 0 6px 0;">Creator email: <span style="color:#ffffff;">{creator_email}</span></p>'
        if creator_email
        else ""
    )

    body_html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{subject}</title>
</head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;padding:28px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;background:#050505;border-radius:28px;overflow:hidden;box-shadow:0 18px 48px rgba(0,0,0,0.28);">
          <tr>
            <td align="center" style="padding:36px 42px 18px 42px;background:#050505;">
              <h1 style="margin:0 0 18px 0;font-family:Arial,sans-serif;font-size:28px;line-height:1.2;font-weight:700;color:#ffffff;">
                Pre-influencer converted
              </h1>
              <p style="margin:0 0 24px 0;font-size:16px;line-height:1.55;color:#b8b8be;text-align:center;">
                {display_label} has been converted into an influencer profile.
              </p>
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 24px auto;border-left:3px solid #ff2f7d;background:#111111;border-radius:0 8px 8px 0;">
                <tr>
                  <td style="padding:14px 20px;">
                    <p style="font-size:14px;color:#b8b8be;margin:0 0 6px 0;">Pre-influencer ID: <span style="color:#ffffff;">{pre_influencer_id}</span><span style="display:none;mso-hide:all;">Pre-influencer ID: {pre_influencer_id}</span></p>
                    <p style="font-size:14px;color:#b8b8be;margin:0 0 6px 0;">Influencer ID: <span style="color:#ffffff;">{influencer_id}</span><span style="display:none;mso-hide:all;">Influencer ID: {influencer_id}</span></p>
                    {creator_email_row}
                    <p style="font-size:14px;color:#b8b8be;margin:0 0 6px 0;">Publication status: <span style="color:#ffffff;">{status_label}</span><span style="display:none;mso-hide:all;">Publication status: {status_label}</span></p>
                    <p style="font-size:14px;color:#b8b8be;margin:0;">Profile link: <a href="{public_url}" style="color:#ff2f7d;text-decoration:none;">{public_url}</a></p>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 0 0;font-size:12px;color:#76767d;text-align:center;">
                This is an automated message from TeaseMe.
              </p>
              <p style="margin:16px 0 0 0;font-size:14px;line-height:1.4;color:#76767d;text-align:center;">
                © {datetime.now().year} TeaseMe. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""
    lines = [
        "Pre-influencer converted",
        "",
        f"Pre-influencer ID: {pre_influencer_id}",
        f"Influencer ID: {influencer_id}",
        f"Display name: {display_label}",
    ]
    if creator_email:
        lines.append(f"Creator email: {creator_email}")
    lines.extend(
        [
            f"Publication status: {status_label}",
            f"Profile link: {public_url}",
        ]
    )
    body_text = "\n".join(lines)
    return send_email_via_ses(to_email, subject, body_html, body_text)


__all__ = [
    "send_influencer_published_email",
    "send_influencer_survey_completed_email_to_promoter",
    "send_new_influencer_email",
    "send_new_influencer_email_with_picture",
    "send_password_reset_email",
    "send_profile_survey_email",
    "send_pre_influencer_converted_admin_email",
    "send_pre_influencer_signup_complete_email",
    "send_verification_email",
]
