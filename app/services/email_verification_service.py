"""Email verification token business logic."""

from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.schemas.auth import CheckEmailTokenResponse
from app.services.repositories.user_repository import get_by_email


async def check_email_verification_token(
    db: AsyncSession,
    email: str,
    token: str,
) -> CheckEmailTokenResponse:
    """Validate that an email verification token matches the given user."""
    user = await get_by_email(db, email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.is_verified:
        raise HTTPException(status_code=400, detail="Email is already verified")

    if not user.email_token or not user.email_token_expires_at:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    if user.email_token != token:
        raise HTTPException(status_code=400, detail="Token and email didn't match")

    if user.email_token_expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=410,
            detail="Verification link has expired. Please request a new one.",
        )

    return CheckEmailTokenResponse(
        ok=True,
        valid=True,
        message="Token is valid.",
    )
