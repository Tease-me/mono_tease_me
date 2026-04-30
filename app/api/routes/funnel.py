"""Public funnel reporting endpoint for frontend-reported events.

No auth required — the frontend fires these when a user clicks an invite
link or starts registration, before they have a session.
"""

import logging

from fastapi import APIRouter, BackgroundTasks, Request

from app.data.schemas.funnel import FunnelEventReport
from app.services.funnel_tracking_service import track, lookup_invite
from app.utils.infrastructure.rate_limiter import rate_limit

log = logging.getLogger(__name__)

router = APIRouter(prefix="/funnel", tags=["Funnel"])


@router.post("/event")
@rate_limit(max_requests=30, window_seconds=60, key_prefix="funnel:event")
async def report_funnel_event(
    request: Request,
    body: FunnelEventReport,
    bg: BackgroundTasks,
):
    """Record a frontend funnel event (link click, registration start).

    Always returns ``{"ok": true}`` — never leaks whether an invite
    code is valid.
    """
    invite = await lookup_invite(body.invite_code)
    if invite:
        bg.add_task(
            track,
            body.event_type,
            telegram_user_id=invite.telegram_user_id,
            influencer_id=invite.influencer_id,
            invite_code=invite.code,
        )
    else:
        log.debug("funnel.event: unknown invite_code=%s — ignoring", body.invite_code)

    return {"ok": True}
