"""Telegram link builder utilities.

Builds signup URLs and Telegram-formatted hyperlinks for invite codes.
"""

import html

from app.core.config import settings


def build_signup_link(invite_code: str, influencer_id: str = "") -> str:
    """Build a full signup URL with the invite code as a query parameter."""
    base = settings.FRONTEND_URL.rstrip("/")
    if influencer_id:
        return f"{base}/{influencer_id}?ref=tg&invite={invite_code}"
    return f"{base}/register?invite={invite_code}"


def build_telegram_cta_html(invite_code: str, influencer_id: str = "") -> str:
    """Build an HTML-formatted call-to-action message for Telegram.

    Uses HTML parse mode (safer than MarkdownV2 with special chars).
    Returns the full CTA block ready to be embedded in a message.
    """
    link = html.escape(build_signup_link(invite_code, influencer_id))
    return f'<a href="{link}">talk to me</a>'

