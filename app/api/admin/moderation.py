from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.admin.common import ensure_admin
from app.db.models import ContentViolation, User
from app.db.session import get_db
from app.utils.auth.dependencies import get_current_user

router = APIRouter(tags=["admin-moderation"])


@router.get(
    "/moderation",
    summary="Get moderation dashboard",
    description="Return flagged users and moderation violations for the admin moderation dashboard.",
)
async def get_moderation_dashboard(
    page: int = 1,
    page_size: int = 20,
    category: str | None = None,
    current_user: User = Depends(get_current_user),
    user_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    users_stmt = select(User).where(User.moderation_status != "CLEAN").order_by(desc(User.last_violation_at))
    users_result = await db.execute(users_stmt)
    flagged_users = users_result.scalars().all()

    violations_stmt = select(ContentViolation)
    if category:
        violations_stmt = violations_stmt.where(ContentViolation.category == category)
    if user_id:
        violations_stmt = violations_stmt.where(ContentViolation.user_id == user_id)

    count_stmt = select(func.count()).select_from(violations_stmt.subquery())
    total_violations = (await db.execute(count_stmt)).scalar() or 0
    violations_stmt = violations_stmt.order_by(desc(ContentViolation.created_at)).offset((page - 1) * page_size).limit(page_size)
    violations_result = await db.execute(violations_stmt)
    violations = violations_result.scalars().all()

    return {
        "flagged_users": [
            {
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "moderation_status": u.moderation_status,
                "violation_count": u.violation_count,
                "first_violation_at": u.first_violation_at.isoformat() if u.first_violation_at else None,
                "last_violation_at": u.last_violation_at.isoformat() if u.last_violation_at else None,
            }
            for u in flagged_users
        ],
        "violations": {
            "total": total_violations,
            "page": page,
            "page_size": page_size,
            "items": [
                {
                    "id": v.id,
                    "user_id": v.user_id,
                    "chat_id": v.chat_id,
                    "influencer_id": v.influencer_id,
                    "message_content": v.message_content,
                    "category": v.category,
                    "severity": v.severity,
                    "keyword_matched": v.keyword_matched,
                    "ai_confidence": v.ai_confidence,
                    "detection_tier": v.detection_tier,
                    "created_at": v.created_at.isoformat() if v.created_at else None,
                }
                for v in violations
            ],
        },
    }
