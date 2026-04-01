"""Backward-compatible email exports.

The implementation now lives under ``app.services.email`` and
``app.services.gateways.email_gateway``. This module remains as a shim so
existing imports do not break during the refactor.
"""


async def send_verification_email(*args, **kwargs):
    from app.services.email.mailers import send_verification_email as impl

    return await impl(*args, **kwargs)


def send_profile_survey_email(*args, **kwargs):
    from app.services.email.mailers import send_profile_survey_email as impl

    return impl(*args, **kwargs)


def send_email_via_ses(*args, **kwargs):
    from app.services.gateways.email_gateway import send_email_via_ses as impl

    return impl(*args, **kwargs)


def send_password_reset_email(*args, **kwargs):
    from app.services.email.mailers import send_password_reset_email as impl

    return impl(*args, **kwargs)


def send_new_influencer_email(*args, **kwargs):
    from app.services.email.mailers import send_new_influencer_email as impl

    return impl(*args, **kwargs)


def send_new_influencer_email_with_picture(*args, **kwargs):
    from app.services.email.mailers import send_new_influencer_email_with_picture as impl

    return impl(*args, **kwargs)


def send_influencer_survey_completed_email_to_promoter(*args, **kwargs):
    from app.services.email.mailers import (
        send_influencer_survey_completed_email_to_promoter as impl,
    )

    return impl(*args, **kwargs)


def image_data_url(*args, **kwargs):
    from app.services.email.header_images import image_data_url as impl

    return impl(*args, **kwargs)


def compose_email_header_image_url(*args, **kwargs):
    from app.services.email.header_images import compose_email_header_image_url as impl

    return impl(*args, **kwargs)


def __getattr__(name: str):
    if name in {
        "EMAIL_HEADER_SIZE",
        "EMAIL_INFLUENCER_HEADER_BG_URL",
        "EMAIL_RESET_HEADER_URL",
        "EMAIL_VERIFY_HEADER_URL",
    }:
        from app.services.email import header_images

        return getattr(header_images, name)
    raise AttributeError(name)

__all__ = [
    "compose_email_header_image_url",
    "image_data_url",
    "send_email_via_ses",
    "send_influencer_survey_completed_email_to_promoter",
    "send_new_influencer_email",
    "send_new_influencer_email_with_picture",
    "send_password_reset_email",
    "send_profile_survey_email",
    "send_verification_email",
]
