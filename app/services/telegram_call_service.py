"""Telegram call service.

Business logic for Telegram voice call eligibility checks and
trial-expired messaging. Delegates DB access to repositories
and external calls to gateways/utils.
"""

import asyncio
import io
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.data.models import Influencer
from app.services.repositories.call_record_repository import (
    get_cumulative_trial_usage,
)
from pyrogram.errors import FloodWait

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
    """Send trial-ended sequence when a Telegram user's trial ends.

    Order: voice note → promo image/video → CTA text with invite link.
    Reusable across handlers.py (pre-call gate) and voice_engine.py (mid-call/hangup).
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

    # Ensure client.me is populated — Pyrogram's save_file needs
    # self.me.is_premium and will crash if client.me is None.
    try:
        if not client.me:
            await client.get_me()
    except Exception:
        log.warning("trial_expired: get_me() failed — sends may fail")

    # Fetch influencer for media
    influencer = await db.get(Influencer, influencer_id)

    # 1) Voice note first (wait 3.5s after call ends so it feels natural)
    await asyncio.sleep(3.5)
    try:
        if influencer:
            await send_telegram_welcome_audio(client, chat_id, influencer)
    except FloodWait as e:
        log.warning("trial_expired: voice note flood wait %ds", e.value)
        await asyncio.sleep(e.value)
        try:
            if influencer:
                await send_telegram_welcome_audio(client, chat_id, influencer)
        except Exception:
            log.exception("trial_expired: voice note retry failed")
    except Exception:
        log.exception("trial_expired: failed to send voice note")

    await asyncio.sleep(3.5)

    # 2) Image / video promo
    try:
        welcome_video_sent = False
        if influencer:
            welcome_video_sent = await send_telegram_welcome_video(
                client, chat_id, influencer,
            )

        if not welcome_video_sent:
            video_key = influencer.profile_video_key if influencer else None
            photo_key = influencer.profile_photo_key if influencer else None
            await send_influencer_promo_media(
                client,
                chat_id,
                profile_video_key=video_key,
                profile_photo_key=photo_key,
            )
    except FloodWait as e:
        log.warning("trial_expired: promo media flood wait %ds", e.value)
        await asyncio.sleep(e.value)
    except Exception:
        log.exception("trial_expired: failed to send promo media")

    await asyncio.sleep(3.5)

    # 3) Second voice note
    try:
        if influencer:
            await send_telegram_welcome_audio(client, chat_id, influencer, slot="audio_2")
    except FloodWait as e:
        log.warning("trial_expired: voice note 2 flood wait %ds", e.value)
        await asyncio.sleep(e.value)
        try:
            if influencer:
                await send_telegram_welcome_audio(client, chat_id, influencer, slot="audio_2")
        except Exception:
            log.exception("trial_expired: voice note 2 retry failed")
    except Exception:
        log.exception("trial_expired: failed to send voice note 2")

    await asyncio.sleep(4.5)

    # 4) CTA text with invite link
    try:
        await client.send_message(
            chat_id=chat_id,
            text=(
                f"Cum in papi~ let's finish what we started pleeease 🍆💦\n\n"
                f"👉 {cta_html}"
            ),
            parse_mode=enums.ParseMode.HTML,
        )
    except FloodWait as e:
        log.warning("trial_expired: CTA text flood wait %ds", e.value)
        await asyncio.sleep(e.value)
        try:
            await client.send_message(
                chat_id=chat_id,
                text=(
                    f"Cum in papi~ let's finish what we started pleeease 🍆💦\n\n"
                    f"👉 {cta_html}"
                ),
                parse_mode=enums.ParseMode.HTML,
            )
        except Exception:
            log.exception("trial_expired: CTA text retry failed")
    except Exception:
        log.exception("trial_expired: failed to send CTA text")

    log.info(
        "trial_expired_messages_sent tg_user=%s influencer=%s",
        telegram_user_id, influencer_id,
    )


async def send_telegram_welcome_video(
    client,
    chat_id: int,
    influencer: Influencer,
) -> bool:
    """Send telegram welcome video from assets_json.

    Checks telegram_welcome_video slot first, falls back to legacy slot.
    Returns True if video was sent.
    """
    from app.services.repositories.influencer_landing_assets_repository import (
        LEGACY_TELEGRAM_MEDIA_SLOT,
        TELEGRAM_VIDEO_SLOT,
        get_landing_asset_key,
    )
    from app.utils.storage.s3 import get_s3_object_bytes

    assets_json = influencer.assets_json if isinstance(influencer.assets_json, dict) else {}

    video_key = (
        get_landing_asset_key(assets_json, TELEGRAM_VIDEO_SLOT)
        or get_landing_asset_key(assets_json, LEGACY_TELEGRAM_MEDIA_SLOT)
    )
    if not video_key:
        return False

    try:
        video_bytes = await get_s3_object_bytes(video_key)
        if video_bytes:
            if not client.me:
                await client.get_me()
            await client.send_video(
                chat_id=chat_id,
                video=io.BytesIO(video_bytes),
                file_name="welcome.mp4",
            )
            log.info("welcome_video_sent chat=%s key=%s", chat_id, video_key)
            return True
        log.warning("S3 returned empty bytes for welcome video key=%s", video_key)
    except Exception:
        log.exception("Failed to send welcome video (key=%s)", video_key)

    return False


async def send_telegram_welcome_audio(
    client,
    chat_id: int,
    influencer: Influencer,
    slot: str = "audio",
) -> bool:
    """Send telegram welcome audio as a voice note from assets_json.

    Args:
        slot: Which audio to send — "audio" for the primary welcome audio,
              "audio_2" for the second voice note.

    Returns True if audio was sent.
    """
    from app.services.repositories.influencer_landing_assets_repository import (
        TELEGRAM_AUDIO_2_SLOT,
        TELEGRAM_AUDIO_SLOT,
        get_landing_asset_key,
    )
    from app.utils.storage.s3 import get_s3_object_bytes

    assets_json = influencer.assets_json if isinstance(influencer.assets_json, dict) else {}

    asset_slot = TELEGRAM_AUDIO_2_SLOT if slot == "audio_2" else TELEGRAM_AUDIO_SLOT
    audio_key = get_landing_asset_key(assets_json, asset_slot)
    if not audio_key:
        return False

    try:
        audio_bytes = await get_s3_object_bytes(audio_key)
        if audio_bytes:
            if not client.me:
                await client.get_me()
            voice_file = io.BytesIO(audio_bytes)
            voice_file.name = "welcome.mp3"
            await client.send_voice(
                chat_id=chat_id,
                voice=voice_file,
            )
            log.info("welcome_audio_sent chat=%s slot=%s key=%s", chat_id, slot, audio_key)
            return True
        log.warning("S3 returned empty bytes for welcome audio slot=%s key=%s", slot, audio_key)
    except Exception:
        log.exception("Failed to send welcome audio (slot=%s key=%s)", slot, audio_key)

    return False
