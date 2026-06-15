"""Fire-and-forget MJFP webhooks when VIP invite status changes."""

from __future__ import annotations

import asyncio
import logging
from typing import Literal

from app.core.config import settings
from app.core.session import SessionLocal
from app.data.models import User
from app.services.gateways.mjfp_webhook_gateway import post_mjfp_teaseme_step_webhook
from app.services.use_cases.vip_invite_status import (
    VipInviteStatus,
    build_vip_invite_status_result,
)

log = logging.getLogger(__name__)

VipInviteWebhookEvent = Literal[
    "profile_completed",
    "email_verified",
    "vip_invite_status",
]


def _vip_invite_webhook_url() -> str | None:
    explicit = (settings.MJFP_VIP_INVITE_WEBHOOK_URL or "").strip()
    if explicit:
        return explicit
    base = (settings.MJFP_API_URL or "").strip().rstrip("/")
    if base:
        return f"{base}/webhooks/teaseme/vip-preregister"
    return None


def _default_event_for_status(status: VipInviteStatus) -> VipInviteWebhookEvent:
    if status == "completed":
        return "email_verified"
    if status == "in_progress":
        return "profile_completed"
    return "vip_invite_status"


async def _run_mjfp_vip_invite_status_webhook(
    user_id: int,
    *,
    status: VipInviteStatus | None = None,
    event: VipInviteWebhookEvent | None = None,
) -> None:
    url = _vip_invite_webhook_url()
    secret = settings.MJFP_WEBHOOK_SECRET or ""
    if not url or not secret:
        return

    async with SessionLocal() as db:
        user = await db.get(User, user_id)
        if not user:
            return
        result = build_vip_invite_status_result(user)
        resolved_status = status or result.status

    resolved_event = event or _default_event_for_status(resolved_status)
    payload = {
        "event": resolved_event,
        "user_id": result.user_id,
        "status": resolved_status,
        "invite_code": result.invite_code,
        "instagram_username": result.instagram_username,
        "full_name": result.full_name,
        "email": result.email,
        "expires_at": result.expires_at.isoformat(),
        "is_verified": result.is_verified,
    }

    delivered = await post_mjfp_teaseme_step_webhook(url=url, secret=secret, payload=payload)
    if delivered is not True:
        log.warning(
            "[mjfp-vip-webhook] delivery failed user_id=%s status=%s event=%s",
            user_id,
            resolved_status,
            resolved_event,
        )


def schedule_mjfp_vip_invite_status_webhook(
    user_id: int,
    *,
    status: VipInviteStatus | None = None,
    event: VipInviteWebhookEvent | None = None,
) -> None:
    """Schedule webhook delivery; never blocks or raises to callers."""
    if not _vip_invite_webhook_url() or not (settings.MJFP_WEBHOOK_SECRET or ""):
        return

    async def _wrapper() -> None:
        try:
            await _run_mjfp_vip_invite_status_webhook(
                user_id,
                status=status,
                event=event,
            )
        except Exception:
            log.exception("[mjfp-vip-webhook] failed user_id=%s", user_id)

    try:
        asyncio.create_task(_wrapper())
    except RuntimeError:
        log.exception("[mjfp-vip-webhook] failed to schedule user_id=%s", user_id)
