from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.admin.common import ensure_admin
from app.data.enums.relationship_stages import STAGE_POINTS_MAX, STAGE_POINTS_MIN
from app.data.models import RelationshipState, User
from app.core.session import get_db
from app.utils.auth.dependencies import get_current_user

router = APIRouter(tags=["Admin Relationships"])


def sentiment_label(score: float) -> str:
    if score < 25:
        return "EARLY"
    if score < 50:
        return "DEVELOPING"
    if score < 75:
        return "PROGRESSING"
    return "ADVANCED"


class RelationshipPatch(BaseModel):
    user_id: int
    influencer_id: str
    trust: Optional[float] = Field(default=None, ge=0, le=100)
    closeness: Optional[float] = Field(default=None, ge=0, le=100)
    attraction: Optional[float] = Field(default=None, ge=0, le=100)
    safety: Optional[float] = Field(default=None, ge=0, le=100)
    state: Optional[str] = None
    stage_points: Optional[float] = Field(default=None, ge=STAGE_POINTS_MIN, le=STAGE_POINTS_MAX)
    sentiment_score: Optional[float] = Field(default=None, ge=0, le=100)
    sentiment_delta: Optional[float] = Field(default=None, ge=-15, le=15)
    exclusive_agreed: Optional[bool] = None
    girlfriend_confirmed: Optional[bool] = None
    dtr_stage: Optional[int] = Field(default=None, ge=0)
    dtr_cooldown_until: Optional[datetime] = None
    last_interaction_at: Optional[datetime] = None


@router.get(
    "/relationships",
    summary="List relationships",
    description="Return relationship state records for a user across influencers.",
)
async def list_relationships(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    q = select(RelationshipState).where(RelationshipState.user_id == user_id)
    res = await db.execute(q)
    rows = res.scalars().all()
    return [
        {
            "id": r.id,
            "user_id": r.user_id,
            "influencer_id": r.influencer_id,
            "trust": r.trust,
            "closeness": r.closeness,
            "attraction": r.attraction,
            "safety": r.safety,
            "state": r.state,
            "stage_points": r.stage_points,
            "sentiment": sentiment_label(r.sentiment_score),
            "exclusive_agreed": r.exclusive_agreed,
            "girlfriend_confirmed": r.girlfriend_confirmed,
            "sentiment_score": r.sentiment_score,
            "sentiment_delta": r.sentiment_delta,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        }
        for r in rows
    ]


@router.patch(
    "/relationships",
    summary="Patch a relationship",
    description="Apply a partial admin update to a relationship state record.",
)
async def patch_relationship(
    payload: RelationshipPatch,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    q = select(RelationshipState).where(
        RelationshipState.user_id == payload.user_id,
        RelationshipState.influencer_id == payload.influencer_id,
    )
    res = await db.execute(q)
    rel = res.scalar_one_or_none()
    if not rel:
        raise HTTPException(status_code=404, detail="Relationship not found")

    if payload.trust is not None:
        rel.trust = payload.trust
    if payload.closeness is not None:
        rel.closeness = payload.closeness
    if payload.attraction is not None:
        rel.attraction = payload.attraction
    if payload.safety is not None:
        rel.safety = payload.safety
    if payload.state is not None:
        rel.state = payload.state
    if payload.stage_points is not None:
        rel.stage_points = payload.stage_points
    if payload.sentiment_score is not None:
        rel.sentiment_score = payload.sentiment_score
    if payload.sentiment_delta is not None:
        rel.sentiment_delta = payload.sentiment_delta
    if payload.exclusive_agreed is not None:
        rel.exclusive_agreed = payload.exclusive_agreed
    if payload.girlfriend_confirmed is not None:
        rel.girlfriend_confirmed = payload.girlfriend_confirmed
    if payload.dtr_stage is not None:
        rel.dtr_stage = payload.dtr_stage
    if payload.dtr_cooldown_until is not None:
        rel.dtr_cooldown_until = payload.dtr_cooldown_until
    if payload.last_interaction_at is not None:
        rel.last_interaction_at = payload.last_interaction_at
    if rel.girlfriend_confirmed:
        rel.state = "GIRLFRIEND"
        rel.exclusive_agreed = True

    rel.updated_at = datetime.now(timezone.utc)
    db.add(rel)
    await db.commit()
    await db.refresh(rel)
    return {
        "ok": True,
        "relationship": {
            "id": rel.id,
            "user_id": rel.user_id,
            "influencer_id": rel.influencer_id,
            "trust": rel.trust,
            "closeness": rel.closeness,
            "attraction": rel.attraction,
            "safety": rel.safety,
            "state": rel.state,
            "stage_points": rel.stage_points,
            "sentiment_score": rel.sentiment_score,
            "sentiment_delta": rel.sentiment_delta,
            "exclusive_agreed": rel.exclusive_agreed,
            "girlfriend_confirmed": rel.girlfriend_confirmed,
            "updated_at": rel.updated_at.isoformat() if rel.updated_at else None,
        },
    }


@router.post(
    "/relationships/update",
    summary="Update a relationship",
    description="Apply an admin relationship update using the legacy update endpoint.",
)
async def update_relationship(
    payload: RelationshipPatch,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_admin(current_user)
    q = select(RelationshipState).where(
        RelationshipState.user_id == payload.user_id,
        RelationshipState.influencer_id == payload.influencer_id,
    )
    res = await db.execute(q)
    rel = res.scalar_one_or_none()
    if not rel:
        raise HTTPException(status_code=404, detail="Relationship not found")
    if payload.trust is not None:
        rel.trust = payload.trust
    if payload.closeness is not None:
        rel.closeness = payload.closeness
    if payload.attraction is not None:
        rel.attraction = payload.attraction
    if payload.safety is not None:
        rel.safety = payload.safety
    if payload.state is not None:
        rel.state = payload.state
    if payload.stage_points is not None:
        rel.stage_points = payload.stage_points
    if payload.sentiment_score is not None:
        rel.sentiment_score = payload.sentiment_score
    if payload.sentiment_delta is not None:
        rel.sentiment_delta = payload.sentiment_delta
    if payload.exclusive_agreed is not None:
        rel.exclusive_agreed = payload.exclusive_agreed
    if payload.girlfriend_confirmed is not None:
        rel.girlfriend_confirmed = payload.girlfriend_confirmed
    if rel.girlfriend_confirmed:
        rel.state = "GIRLFRIEND"
        rel.exclusive_agreed = True
    rel.updated_at = datetime.now(timezone.utc)
    db.add(rel)
    await db.commit()
    await db.refresh(rel)
    return {"ok": True}
