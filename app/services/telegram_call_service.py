"""Telegram call service.

Business logic for Telegram voice call eligibility checks and
trial-expired messaging. Delegates DB access to repositories
and external calls to gateways/utils.
"""

import asyncio
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.data.models import Influencer
from app.services.repositories.call_record_repository import (
    get_cumulative_trial_usage,
)

log = logging.getLogger(__name__)

# Cumulative free trial duration for Telegram users (seconds)
DEFAULT_TRIAL_SECS = 60


async def check_telegram_trial_eligibility(
    db: AsyncSession,
    telegram_user_id: int,
) -> int:
    """Return the number of trial seconds remaining for a Telegram user.

    Checks cumulative usage across all completed calls.
    Returns 0 if trial is exhausted.
    """
    total_used = await get_cumulative_trial_usage(db, telegram_user_id)
    remaining = max(0, DEFAULT_TRIAL_SECS - int(total_used))

    log.info(
        "trial_check tg_user=%s used=%.1fs remaining=%ds",
        telegram_user_id, total_used, remaining,
    )
    return remaining


async def send_trial_expired_messages(
    client,
    db: AsyncSession,
    chat_id: int,
    telegram_user_id: int,
    influencer_id: str,
) -> None:
    """Send promo media + CTA invite link when a Telegram user's trial ends.

    Reusable across handlers.py (pre-call gate) and voice_engine.py (mid-call expiry).
    """
    from app.services.telegram_invite_service import get_or_create_invite_code
    from app.utils.telegram_link_builder import build_telegram_cta_html
    from app.utils.telegram_media_sender import send_influencer_promo_media
    from pyrogram import enums

    invite_code = await get_or_create_invite_code(
        db, telegram_user_id, influencer_id,
    )

    from app.services.funnel_tracking_service import track_invite_sent
    asyncio.create_task(track_invite_sent(telegram_user_id, influencer_id, invite_code))

    cta_html = build_telegram_cta_html(invite_code, influencer_id)

    # Fetch influencer media keys for promo content
    influencer = await db.get(Influencer, influencer_id)
    video_key = influencer.profile_video_key if influencer else None
    photo_key = influencer.profile_photo_key if influencer else None

    # Send promo video/photo from S3
    await send_influencer_promo_media(
        client,
        chat_id,
        profile_video_key=video_key,
        profile_photo_key=photo_key,
    )

    await client.send_message(
        chat_id=chat_id,
        text=(
            "💋 Your Trial Has Ended\n\n"
            "Continue the fun here:\n"
            f"{cta_html}\n\n"
            "See you there babe 😘"
        ),
        parse_mode=enums.ParseMode.HTML,
    )

    log.info(
        "trial_expired_messages_sent tg_user=%s influencer=%s",
        telegram_user_id, influencer_id,
    )
