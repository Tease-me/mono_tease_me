"""Fire-and-forget first-deposit gift code generation."""

import logging

from app.core.session import SessionLocal
from app.services.repositories import gift_code_repository as repo

log = logging.getLogger(__name__)


async def generate_first_deposit_gift(user_id: int, influencer_id: str | None) -> None:
    """Create a pending gift code after a user's first credited topup with an influencer.

    Opens its own DB session and never raises.
    """
    if not influencer_id:
        return

    try:
        async with SessionLocal() as db:
            existing = await repo.get_by_user_and_influencer(db, user_id, influencer_id)
            if existing:
                return

            credited_count = await repo.count_credited_topups_for_influencer(
                db,
                user_id,
                influencer_id,
            )
            if credited_count != 1:
                return

            await repo.create_gift_code(
                db,
                user_id=user_id,
                influencer_id=influencer_id,
            )
            await db.commit()
            log.info(
                "generate_first_deposit_gift: created pending gift for user=%s influencer=%s",
                user_id,
                influencer_id,
            )
    except Exception:
        log.warning(
            "generate_first_deposit_gift failed for user=%s influencer=%s",
            user_id,
            influencer_id,
            exc_info=True,
        )
