"""Utility to send influencer promo media (photo/video) via Telegram."""

import io
import logging
from typing import Optional

from pyrogram import Client

from app.utils.storage.s3 import get_s3_object_bytes

log = logging.getLogger(__name__)


async def send_influencer_promo_media(
    client: Client,
    chat_id: int,
    *,
    profile_video_key: Optional[str] = None,
    profile_photo_key: Optional[str] = None,
    caption: str = "",
) -> str | None:
    """Download an influencer's video or photo from S3 and send it to a Telegram user.

    Tries video first, falls back to photo.
    Returns the media type sent or None if nothing was sent.
    """
    # Try video first
    if profile_video_key:
        try:
            log.info("Sending promo video from S3 key=%s to chat=%s", profile_video_key, chat_id)
            video_bytes = await get_s3_object_bytes(profile_video_key)
            if video_bytes:
                if not client.me:
                    await client.get_me()
                await client.send_video(
                    chat_id=chat_id,
                    video=io.BytesIO(video_bytes),
                    caption=caption or None,
                    file_name="promo.mp4",
                )
                log.info(
                    "promo_media_sent chat=%s media_type=profile_video key=%s",
                    chat_id,
                    profile_video_key,
                )
                return "profile_video"
            else:
                log.warning("S3 returned empty bytes for video key=%s", profile_video_key)
        except Exception:
            log.exception("Failed to send promo video (key=%s)", profile_video_key)

    # Fall back to photo
    if profile_photo_key:
        try:
            log.info("Sending promo photo from S3 key=%s to chat=%s", profile_photo_key, chat_id)
            photo_bytes = await get_s3_object_bytes(profile_photo_key)
            if photo_bytes:
                if not client.me:
                    await client.get_me()
                await client.send_photo(
                    chat_id=chat_id,
                    photo=io.BytesIO(photo_bytes),
                    caption=caption or None,
                )
                log.info(
                    "promo_media_sent chat=%s media_type=profile_photo key=%s",
                    chat_id,
                    profile_photo_key,
                )
                return "profile_photo"
            else:
                log.warning("S3 returned empty bytes for photo key=%s", profile_photo_key)
        except Exception:
            log.exception("Failed to send promo photo (key=%s)", profile_photo_key)

    if not profile_video_key and not profile_photo_key:
        log.warning("No promo media keys set for chat=%s — skipping media send", chat_id)

    return None
