from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

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

CONFIRM_BASE_URL = settings.FRONTEND_URL


async def send_verification_email(
    to_email: str,
    token: str,
    *,
    influencer_id: str | None = None,
    influencer_profile_photo_key: Optional[str] = None,
):
    subject = "Confirm your email on TeaseMe!"
    confirm_url = f"{CONFIRM_BASE_URL}/verify-email?token={token}"
    logo_url = EMAIL_VERIFY_HEADER_URL

    if influencer_id and influencer_profile_photo_key:
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

    body_html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Confirm your email</title>
</head>
<body style="background:#f7f8fc;padding:0;margin:0;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f8fc;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border-radius:24px;box-shadow:0 10px 32px 0 rgba(50,50,93,0.10),0 2px 4px 0 rgba(0,0,0,0.07);overflow:hidden;">
          <tr>
            <td align="center" style="background:#23293b;padding:0;">
              <img
                src="{logo_url}"
                alt="TeaseMe"
                style="width:100%;max-width:520px;display:block;border-top-left-radius:24px;border-top-right-radius:24px;"
              />
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:32px 30px 8px 30px;">
              <h2 style="font-family: 'Arial Rounded MT Bold', Arial, sans-serif; font-size:32px; font-weight:bold; margin:0 0 12px 0; color:#444;">Hi! Welcome to TeaseMe</h2>
              <p style="font-size:16px;color:#666;margin:0 0 32px 0;">
                You are almost done! Before we get started, please verify your email address to activate your account. It's quick and helps us keep your account safe.
              </p>
              <a href="{confirm_url}"
                style="background:#FF5C74;border-radius:8px;color:#fff;text-decoration:none;display:inline-block;padding:18px 50px;font-size:22px;font-weight:bold;box-shadow:0 6px 24px #ffb5c7;margin-bottom:20px;">
                Confirm Email
              </a>
              <p style="margin:24px 0 0 0; font-size:14px; color:#bbb;">
                This link will expire in 24 hours.<br/>
                If you didn't sign up for TeaseMe, please ignore this message.<br/>
                Can't wait to talk to you!
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 0 12px 0;background:#e5e5e5;color:#bbb;font-size:14px;border-bottom-left-radius:24px;border-bottom-right-radius:24px;">
              © {datetime.now().year} TeaseMe. All rights reserved.
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


def send_profile_survey_email(to_email: str, token: str, temp_password: str):
    subject = "Complete Your TeaseMe Profile Survey"
    survey_url = f"{CONFIRM_BASE_URL}/profile-survey-form?token={token}&temp_password={temp_password}"
    logo_url = EMAIL_VERIFY_HEADER_URL

    body_html = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Complete Your Profile</title>
    </head>
    <body style="background:#f7f8fc;padding:0;margin:0;font-family:Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f8fc;padding:40px 0;">
        <tr>
          <td align="center">
            <table width="520" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border-radius:24px;box-shadow:0 10px 32px rgba(50,50,93,0.10),0 2px 4px rgba(0,0,0,0.07);overflow:hidden;">
              <tr>
                <td align="center" style="background:#23293b;padding:0;">
                  <img
                    src="{logo_url}"
                    alt="TeaseMe"
                    style="width:100%;max-width:520px;display:block;border-top-left-radius:24px;border-top-right-radius:24px;"
                  />
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:32px 30px 8px 30px;">
                  <h2 style="font-family:'Arial Rounded MT Bold', Arial, sans-serif; font-size:30px; font-weight:bold; margin:0 0 14px 0; color:#444;">
                    Let's Build Your Perfect AI Persona
                  </h2>
                  <p style="font-size:16px;color:#666;margin:0 0 24px 0;">
                    You're all set! Before your AI companion goes live, we just need a
                    little more information from you.
                    This short survey helps us personalize your experience and tailor
                    the persona to your unique style.
                  </p>
                  <a href="{survey_url}"
                    style="background:#FF5C74; border-radius:8px; color:#fff; text-decoration:none; display:inline-block;
                          padding:18px 50px; font-size:22px; font-weight:bold; box-shadow:0 6px 24px #ffb5c7; margin-bottom:20px;">
                    Start Profile Survey
                  </a>
                  <p style="margin:24px 0 0 0; font-size:14px; color:#bbb;">
                    If you didn’t request this, you can safely ignore the email.<br/>
                    Your persona can't wait to meet you. ❤️
                  </p>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:20px 0 12px 0;background:#e5e5e5;color:#bbb;font-size:14px;border-bottom-left-radius:24px;border-bottom-right-radius:24px;">
                  © {datetime.now().year} TeaseMe. All rights reserved.
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
Complete Your TeaseMe Profile

You're all set! Before your AI companion goes live, we just need a little more info.

Start your profile survey here:
{survey_url}

If you didn’t request this, you can safely ignore this email.
Your persona can't wait to meet you. ❤️

© {datetime.now().year} TeaseMe. All rights reserved.
    """.strip()
    return send_email_via_ses(to_email, subject, body_html, body_text)


def send_password_reset_email(to_email: str, token: str):
    subject = "Redefine your TeaseMe password"
    reset_url = f"{CONFIRM_BASE_URL}/reset-password?token={token}"
    logo_url = EMAIL_RESET_HEADER_URL

    body_html = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Reset your password</title>
        </head>
        <body style="background:#f7f8fc;padding:0;margin:0;font-family:Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f8fc;padding:40px 0;">
            <tr>
            <td align="center">
                <table width="520" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border-radius:24px;box-shadow:0 10px 32px 0 rgba(50,50,93,0.10),0 2px 4px 0 rgba(0,0,0,0.07);overflow:hidden;">
                <tr>
                    <td align="center" style="padding:0;">
                    <img
                        src="{logo_url}"
                        alt="TeaseMe"
                        style="width:100%;max-width:520px;display:block;border-top-left-radius:24px;border-top-right-radius:24px;"
                    />
                    </td>
                </tr>
                <tr>
                    <td align="center" style="padding:32px 30px 8px 30px;">
                    <h2 style="font-family: 'Arial Rounded MT Bold', Arial, sans-serif; font-size:28px; font-weight:bold; margin:0 0 12px 0; color:#444;">Forgot Your Password?</h2>
                    <p style="font-size:16px;color:#666;margin:0 0 32px 0;">
                        We received a request to reset the password for your TeaseMe account.<br/>
                        To create a new password, just click the button below:
                    </p>
                    <a href="{reset_url}"
                        style="background:#FF5C74;border-radius:8px;color:#fff;text-decoration:none;display:inline-block;padding:18px 50px;font-size:22px;font-weight:bold;box-shadow:0 6px 24px #ffb5c7;margin-bottom:20px;">
                        Reset My Password
                    </a>
                    <p style="margin:24px 0 0 0; font-size:14px; color:#bbb;">
                        This link will expire in 30 minutes to keep your account safe.<br/>
                        If you didn't request a password reset, you can safely ignore this email.
                    </p>
                    </td>
                </tr>
                <tr>
                    <td align="center" style="padding:20px 0 12px 0;background:#e5e5e5;color:#bbb;font-size:14px;border-bottom-left-radius:24px;border-bottom-right-radius:24px;">
                    © {datetime.now().year} TeaseMe. All rights reserved.
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
    public_url = f"{settings.FRONTEND_URL.rstrip('/')}/{influencer.id}"
    referral_url = f"{public_url}?fpr={fp_ref_id}" if fp_ref_id else None

    logo_url = EMAIL_VERIFY_HEADER_URL
    if influencer.profile_picture_key:
        try:
            logo_url = image_data_url(influencer.profile_picture_key)
        except Exception:
            log.warning("Failed to load pre-influencer image for email", exc_info=True)

    referral_block = ""
    if referral_url:
        referral_block = f"""
          <p style="font-size:14px;color:#666;margin:8px 0 10px 0;">
            Your referral link:
          </p>
          <div style="display:inline-block;padding:10px 18px;border-radius:10px;background:#f3f4ff;
                      font-family:monospace;font-size:13px;color:#333;word-break:break-all;max-width:460px;">
            {referral_url}
          </div>
          <p style="font-size:12px;color:#777;margin:10px 0 0 0;">
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
    <body style="background:#f7f8fc;padding:0;margin:0;font-family:Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f8fc;padding:40px 0;">
        <tr>
          <td align="center">
            <table width="520" cellpadding="0" cellspacing="0" border="0"
              style="background:#fff;border-radius:24px;box-shadow:0 10px 32px rgba(50,50,93,0.10),0 2px 4px rgba(0,0,0,0.07);overflow:hidden;">
              <tr>
                <td align="center" style="background:#23293b;padding:0;">
                  <img src="{logo_url}" alt="TeaseMe"
                    style="width:100%;max-width:520px;display:block;border-top-left-radius:24px;border-top-right-radius:24px;" />
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:32px 30px 16px 30px;">
                  <h2 style="font-family:'Arial Rounded MT Bold', Arial, sans-serif; font-size:30px; font-weight:bold; margin:0 0 12px 0; color:#444;">
                    You’re live on TeaseMe 🎉
                  </h2>
                  <p style="font-size:16px;color:#666;margin:0 0 22px 0;">
                    Your influencer profile is now active. Fans can find you and join your page instantly.
                  </p>
                  <a href="{public_url}"
                    style="background:#FF5C74; border-radius:10px; color:#fff; text-decoration:none; display:inline-block;
                           padding:16px 44px; font-size:20px; font-weight:bold; box-shadow:0 6px 24px #ffb5c7; margin-bottom:18px;">
                    Open My Profile
                  </a>
                  <div style="margin-top:10px; font-size:13px; color:#777; word-break:break-all;">
                    {public_url}
                  </div>
                  {referral_block}
                  {temp_pw_block}
                  <p style="margin:26px 0 0 0; font-size:14px; color:#bbb;">
                    If you didn’t request this, you can safely ignore the email.<br/>
                    Let’s get you discovered. ❤️
                  </p>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:20px 0 12px 0;background:#e5e5e5;color:#bbb;font-size:14px;border-bottom-left-radius:24px;border-bottom-right-radius:24px;">
                  © {datetime.now().year} TeaseMe. All rights reserved.
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
    public_url = f"{settings.FRONTEND_URL.rstrip('/')}/{influencer.id}"
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
    <body style="background:#f7f8fc;padding:0;margin:0;font-family:Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f8fc;padding:40px 0;">
        <tr>
          <td align="center">
            <table width="520" cellpadding="0" cellspacing="0" border="0"
              style="background:#fff;border-radius:24px;box-shadow:0 10px 32px rgba(50,50,93,0.10),0 2px 4px rgba(0,0,0,0.07);overflow:hidden;">
              <tr>
                <td align="center" style="background:#23293b;padding:0;">
                  <img
                    src="{logo_url}"
                    alt="TeaseMe"
                    height="{EMAIL_HEADER_SIZE[1]}"
                    style="width:100%;max-width:520px;height:{EMAIL_HEADER_SIZE[1]}px;display:block;border-top-left-radius:24px;border-top-right-radius:24px;object-fit:cover;"
                  />
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:32px 30px 16px 30px;">
                  <h2 style="font-family:'Arial Rounded MT Bold', Arial, sans-serif; font-size:30px; font-weight:bold; margin:0 0 12px 0; color:#444;">
                    You’re live on TeaseMe 🎉
                  </h2>
                  <p style="font-size:16px;color:#666;margin:0 0 22px 0;">
                    Your influencer profile is now active. Fans can find you and join your page instantly.
                  </p>
                  {temp_pw_block}
                  <a href="{public_url}"
                    style="background:#FF5C74;border-radius:8px;color:#fff;text-decoration:none;display:inline-block;padding:16px 42px;font-size:20px;font-weight:bold;box-shadow:0 6px 24px #ffb5c7;margin:10px 0 6px 0;">
                    View my profile
                  </a>
                  <p style="margin:26px 0 0 0; font-size:14px; color:#bbb;">
                    If you didn’t request this, you can safely ignore the email.<br/>
                    Let’s get you discovered. ❤️
                  </p>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:20px 0 12px 0;background:#e5e5e5;color:#bbb;font-size:14px;border-bottom-left-radius:24px;border-bottom-right-radius:24px;">
                  © {datetime.now().year} TeaseMe. All rights reserved.
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


def send_influencer_survey_completed_email_to_promoter(
    *,
    to_email: str,
    influencer_username: str,
    influencer_full_name: str | None = None,
    influencer_email: str | None = None,
):
    subject = "Influencer completed TeaseMe survey"
    public_url = f"{settings.FRONTEND_URL.rstrip('/')}/{influencer_username}"
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
<body style="background:#f7f8fc;padding:0;margin:0;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f8fc;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" border="0"
          style="background:#fff;border-radius:24px;box-shadow:0 10px 32px rgba(50,50,93,0.10),0 2px 4px rgba(0,0,0,0.07);overflow:hidden;">
          <tr>
            <td align="center" style="padding:28px 30px 10px 30px;">
              <h2 style="font-family:'Arial Rounded MT Bold', Arial, sans-serif; font-size:26px; font-weight:bold; margin:0 0 12px 0; color:#444;">
                Influencer survey completed
              </h2>
              <p style="font-size:16px;color:#666;margin:0 0 16px 0;">
                {influencer_line} has finished their TeaseMe profile survey.
              </p>
              <p style="font-size:14px;color:#666;margin:0 0 16px 0;">
                Profile link: <a href="{public_url}" style="color:#FF5C74;text-decoration:none;">{public_url}</a>
              </p>
              {f'<p style="font-size:14px;color:#666;margin:0 0 16px 0;">Influencer email: {influencer_email}</p>' if influencer_email else ""}
              <p style="margin:22px 0 0 0; font-size:12px; color:#999;">
                This is an automated message from TeaseMe.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:18px 0 12px 0;background:#e5e5e5;color:#bbb;font-size:14px;border-bottom-left-radius:24px;border-bottom-right-radius:24px;">
              © {datetime.now().year} TeaseMe. All rights reserved.
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


__all__ = [
    "send_influencer_survey_completed_email_to_promoter",
    "send_new_influencer_email",
    "send_new_influencer_email_with_picture",
    "send_password_reset_email",
    "send_profile_survey_email",
    "send_verification_email",
]
