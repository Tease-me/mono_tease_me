"""Email verification token business logic."""

from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.schemas.auth import CheckEmailTokenResponse
from app.services.follow import get_follow
from app.services.repositories.user_repository import get_by_email_token
from app.utils.storage.s3 import resolve_user_photo_url


async def check_email_verification_token(
    db: AsyncSession,
    token: str,
    *,
    influencer_id: str | None = None,
) -> CheckEmailTokenResponse:
    """Validate that an email verification token or VIP invite code matches a user."""
    user = await get_by_email_token(db, token)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    if user.is_verified:
        raise HTTPException(status_code=400, detail="Email is already verified")

    if not user.email_token or not user.email_token_expires_at:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    if user.email_token_expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=410,
            detail="Verification link has expired. Please request a new one.",
        )

    if influencer_id:
        follow = await get_follow(db, influencer_id, user.id)
        if not follow:
            raise HTTPException(status_code=400, detail="Invalid code for this influencer")

    profile_photo_url = None
    if user.profile_photo_key:
        profile_photo_url = resolve_user_photo_url(user.profile_photo_key)

    date_of_birth = user.date_of_birth
    if hasattr(date_of_birth, "date"):
        date_of_birth = date_of_birth.date()

    return CheckEmailTokenResponse(
        ok=True,
        valid=True,
        message="Token is valid.",
        email=user.email,
        full_name=user.full_name,
        user_name=user.username,
        profile_photo_url=profile_photo_url,
        gender=user.gender,
        date_of_birth=date_of_birth,
    )
