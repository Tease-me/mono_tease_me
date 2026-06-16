"""Database access for first-deposit gift codes."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.models import GiftCode, PayPalTopUp, User
from app.utils.gift_code_generator import generate_gift_code, normalize_gift_code

DEFAULT_DIAMONDS = 120
DEFAULT_EXPIRES_DAYS = 7
MAX_CODE_GENERATION_ATTEMPTS = 10


async def create_gift_code(
    db: AsyncSession,
    *,
    user_id: int,
    influencer_id: str,
    diamonds: int = DEFAULT_DIAMONDS,
    expires_days: int = DEFAULT_EXPIRES_DAYS,
) -> GiftCode:
    """Create a pending gift code with a unique random code."""
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=expires_days)

    for _ in range(MAX_CODE_GENERATION_ATTEMPTS):
        code = generate_gift_code()
        existing = await db.scalar(select(GiftCode).where(GiftCode.code == code))
        if existing:
            continue

        gift = GiftCode(
            code=code,
            user_id=user_id,
            influencer_id=influencer_id,
            diamonds=diamonds,
            status="pending",
            expires_at=expires_at,
        )
        db.add(gift)
        await db.flush()
        return gift

    raise RuntimeError("Failed to generate unique gift code")


async def get_by_code(db: AsyncSession, code: str) -> GiftCode | None:
    normalized = normalize_gift_code(code)
    return await db.scalar(select(GiftCode).where(GiftCode.code == normalized))


async def get_by_user_id(db: AsyncSession, user_id: int) -> GiftCode | None:
    return await db.scalar(select(GiftCode).where(GiftCode.user_id == user_id))


async def get_by_user_and_influencer(
    db: AsyncSession,
    user_id: int,
    influencer_id: str,
) -> GiftCode | None:
    return await db.scalar(
        select(GiftCode).where(
            GiftCode.user_id == user_id,
            GiftCode.influencer_id == influencer_id,
        )
    )


async def count_credited_topups_for_influencer(
    db: AsyncSession,
    user_id: int,
    influencer_id: str,
) -> int:
    result = await db.scalar(
        select(func.count())
        .select_from(PayPalTopUp)
        .where(
            PayPalTopUp.user_id == user_id,
            PayPalTopUp.influencer_id == influencer_id,
            PayPalTopUp.credited.is_(True),
            PayPalTopUp.status == "COMPLETED",
        )
    )
    return int(result or 0)


async def count_pending(db: AsyncSession, influencer_id: str | None = None) -> int:
    now = datetime.now(timezone.utc)
    stmt = (
        select(func.count())
        .select_from(GiftCode)
        .where(GiftCode.status == "pending", GiftCode.expires_at >= now)
    )
    if influencer_id:
        stmt = stmt.where(GiftCode.influencer_id == influencer_id)
    result = await db.scalar(stmt)
    return int(result or 0)


async def mark_sent(db: AsyncSession, gift: GiftCode) -> GiftCode:
    now = datetime.now(timezone.utc)
    gift.status = "sent"
    gift.sent_at = now
    db.add(gift)
    await db.flush()
    return gift


async def claim_sent(db: AsyncSession, gift: GiftCode) -> bool:
    """Atomically transition the gift code from 'sent' to 'accepted'.

    Issues a conditional UPDATE that only matches rows still in the 'sent'
    state, so at most one concurrent request can win the race.  The caller
    must check the return value; False means another request already claimed
    the code.  The UPDATE acquires a row-level lock for the remainder of the
    caller's transaction, so subsequent wallet-credit work is protected.
    """
    now = datetime.now(timezone.utc)
    result = await db.execute(
        update(GiftCode)
        .where(GiftCode.id == gift.id, GiftCode.status == "sent")
        .values(status="accepted", redeemed_at=now)
    )
    await db.flush()
    return result.rowcount == 1


async def mark_redeemed(db: AsyncSession, gift: GiftCode) -> GiftCode:
    now = datetime.now(timezone.utc)
    gift.status = "accepted"
    gift.redeemed_at = now
    db.add(gift)
    await db.flush()
    return gift


async def mark_expired(db: AsyncSession, gift: GiftCode) -> GiftCode:
    gift.status = "expired"
    db.add(gift)
    await db.flush()
    return gift


async def is_first_credited_topup(db: AsyncSession, user_id: int) -> bool:
    """True when the user has exactly one completed credited topup."""
    count = await db.scalar(
        select(func.count())
        .select_from(PayPalTopUp)
        .where(
            PayPalTopUp.user_id == user_id,
            PayPalTopUp.credited.is_(True),
            PayPalTopUp.status == "COMPLETED",
        )
    )
    return int(count or 0) == 1


async def get_activity_list(
    db: AsyncSession,
    *,
    influencer_id: str | None = None,
    search: str | None = None,
) -> list[dict]:
    """Build activity rows for the MJ Dashboard gift view."""
    topup_stmt = (
        select(PayPalTopUp)
        .where(
            PayPalTopUp.credited.is_(True),
            PayPalTopUp.status == "COMPLETED",
        )
        .order_by(PayPalTopUp.updated_at.desc())
    )
    if influencer_id:
        topup_stmt = topup_stmt.where(PayPalTopUp.influencer_id == influencer_id)

    topups = (await db.scalars(topup_stmt)).all()
    if not topups:
        return []

    user_ids = list({t.user_id for t in topups})
    users = {
        u.id: u
        for u in (await db.scalars(select(User).where(User.id.in_(user_ids)))).all()
    }
    gifts = {
        (g.user_id, g.influencer_id): g
        for g in (
            await db.scalars(select(GiftCode).where(GiftCode.user_id.in_(user_ids)))
        ).all()
    }

    aggregates: dict[tuple[int, str], dict] = {}
    for topup in topups:
        user = users.get(topup.user_id)
        if not user:
            continue

        if search:
            term = search.strip().lower()
            haystack = " ".join(
                filter(
                    None,
                    [
                        user.full_name or "",
                        user.username or "",
                        user.email or "",
                    ],
                )
            ).lower()
            if term not in haystack:
                continue

        bucket_key = (topup.user_id, topup.influencer_id)
        bucket = aggregates.setdefault(
            bucket_key,
            {
                "user_id": topup.user_id,
                "influencer_id": topup.influencer_id,
                "name": user.full_name or user.username,
                "email": user.email,
                "date": topup.updated_at or topup.created_at,
                "ref": topup.order_id,
                "lifetime_cents": 0,
                "last_deposit_cents": 0,
                "deposit_count": 0,
            },
        )
        bucket["lifetime_cents"] += topup.cents
        bucket["deposit_count"] += 1
        if bucket["deposit_count"] == 1:
            bucket["last_deposit_cents"] = topup.cents
            bucket["date"] = topup.updated_at or topup.created_at
            bucket["ref"] = topup.order_id

    now = datetime.now(timezone.utc)
    items: list[dict] = []
    for (user_id, influencer_id), row in aggregates.items():
        gift = gifts.get((user_id, influencer_id))
        gift_status = "none"
        gift_code = None
        gift_id = None
        diamonds = None
        is_first_deposit = row["deposit_count"] == 1

        if gift:
            gift_id = gift.id
            diamonds = gift.diamonds
            gift_status = gift.status
            if gift.status in ("pending", "sent") and gift.expires_at < now:
                gift_status = "expired"
            if gift_status == "sent":
                gift_code = gift.code
        elif row["deposit_count"] > 1:
            gift_status = "deposit"

        row.update(
            {
                "gift_status": gift_status,
                "gift_code": gift_code,
                "gift_id": gift_id,
                "diamonds": diamonds,
                "is_first_deposit": is_first_deposit,
            }
        )
        items.append(row)

    items.sort(key=lambda x: x["date"] or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return items
