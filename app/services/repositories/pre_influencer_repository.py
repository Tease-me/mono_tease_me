from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.models.influencer import PreInfluencer


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
