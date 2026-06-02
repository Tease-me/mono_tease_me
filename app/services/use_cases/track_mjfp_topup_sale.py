"""MJ Promoter sale tracking after wallet top-up (checkout / Armloop webhooks)."""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.data.models import Influencer, User
from app.services.mjpromoter import MJFP_DEFAULT_SALE_PLAN, fp_track_sale_v2
from app.services.repositories.pre_influencer_repository import (
    get_pre_influencer_for_influencer_id,
)

log = logging.getLogger(__name__)


async def resolve_mjfp_promoter_username(
    db: AsyncSession,
    influencer: Influencer,
) -> str | None:
    """MJFP promoter username (e.g. pre_influencer.username), not normalized influencer id."""
    pre = await get_pre_influencer_for_influencer_id(db, influencer_id=influencer.id)
    if pre and pre.username:
        return pre.username.strip()
    return None


async def track_mjfp_topup_sale(
    db: AsyncSession,
    *,
    user: User,
    influencer: Influencer | None,
    amount_cents: int,
    event_id: str,
) -> bool:
    """
    POST /v2/track/sale with email, amount, event_id, username, plan=premium.

    Returns True when MJFP accepted the sale (caller should set fp_tracked).
    """
    if not influencer:
        log.warning("MJFP sale skipped: no influencer for event_id=%s", event_id)
        return False

    username = await resolve_mjfp_promoter_username(db, influencer)
    if not username:
        log.warning(
            "MJFP sale skipped: no promoter username for influencer_id=%s event_id=%s",
            influencer.id,
            event_id,
        )
        return False

    result = await fp_track_sale_v2(
        email=user.email,
        uid=str(user.id),
        amount_cents=amount_cents,
        event_id=event_id,
        username=username,
        plan=MJFP_DEFAULT_SALE_PLAN,
    )
    if not result:
        log.warning(
            "MJFP sale not recorded for event_id=%s influencer_id=%s username=%s",
            event_id,
            influencer.id,
            username,
        )
        return False

    log.info(
        "MJFP sale tracked event_id=%s influencer_id=%s username=%s amount_cents=%s",
        event_id,
        influencer.id,
        username,
        amount_cents,
    )
    return True
