from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.models.influencer import PreInfluencer


def _username_normalized_to_influencer_id_expr():
    """Match ``mj_pre_influencer_progress._normalize_influencer_id`` (PostgreSQL)."""
    return func.regexp_replace(
        func.lower(PreInfluencer.username),
        "[^a-z0-9_]",
        "",
        "g",
    )


async def list_pre_influencer_ids_for_influencer_id(
    db: AsyncSession,
    *,
    influencer_id: str,
) -> list[int]:
    """IDs of pre-influencers whose normalized username equals ``influencer_id`` (influencers PK)."""
    norm = _username_normalized_to_influencer_id_expr()
    result = await db.execute(select(PreInfluencer.id).where(norm == influencer_id))
    return list(result.scalars().all())


async def get_pre_influencer_for_influencer_id(
    db: AsyncSession,
    *,
    influencer_id: str,
) -> PreInfluencer | None:
    norm = _username_normalized_to_influencer_id_expr()
    result = await db.execute(
        select(PreInfluencer)
        .where(norm == influencer_id)
        .order_by(PreInfluencer.id.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_pre_influencer_for_email(
    db: AsyncSession,
    *,
    email: str,
) -> PreInfluencer | None:
    result = await db.execute(
        select(PreInfluencer)
        .where(func.lower(PreInfluencer.email) == email.lower())
        .order_by(PreInfluencer.id.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def list_pre_influencers(
    db: AsyncSession,
    *,
    status: str | None = None,
) -> list[PreInfluencer]:
    query = select(PreInfluencer).order_by(PreInfluencer.created_at.desc(), PreInfluencer.id.desc())
    if status:
        query = query.where(PreInfluencer.status == status)

    result = await db.execute(query)
    return list(result.scalars().all())


async def get_pre_influencer_by_progress_identity(
    db: AsyncSession,
    *,
    invite_code: str,
    invitee_email: str,
) -> PreInfluencer | None:
    query = select(PreInfluencer).where(
        PreInfluencer.survey_answers["__meta"]["invite_code"].as_string()
        == invite_code,
        or_(
            func.lower(PreInfluencer.email) == invitee_email,
            func.lower(
                PreInfluencer.survey_answers["__meta"]["invitee_email"].as_string()
            )
            == invitee_email,
            func.lower(
                PreInfluencer.survey_answers["__meta"]["new_user_email"].as_string()
            )
            == invitee_email,
        ),
    )

    result = await db.execute(query)
    return result.scalar_one_or_none()
