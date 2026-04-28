import secrets
from datetime import datetime, timedelta
from urllib.parse import urlencode

from fastapi import HTTPException
from passlib.context import CryptContext
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.data.models import Influencer, User
from app.data.schemas.auth import PreregisterRequest, PreregisterResponse
from app.services.follow import create_follow_if_missing

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
EMAIL_VERIFICATION_TOKEN_BYTES = 12


def generate_email_verification_token() -> str:
    return secrets.token_urlsafe(EMAIL_VERIFICATION_TOKEN_BYTES)


async def preregister_user(
    db: AsyncSession,
    data: PreregisterRequest,
) -> PreregisterResponse:
    influencer = await db.get(Influencer, data.influencer_id)
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer not found")

    verify_token = generate_email_verification_token()

    existing_user = await db.execute(select(User).where(User.email == data.email))
    if existing_user.scalar():
        raise HTTPException(status_code=409, detail="Email already registered")

    existing_telegram_user = await db.execute(
        select(User).where(User.telegram_id == data.telegram_id)
    )
    if existing_telegram_user.scalar():
        raise HTTPException(status_code=409, detail="Telegram ID already registered")

    user = User(
        email=data.email,
        password_hash=pwd_context.hash(secrets.token_urlsafe(32)),
        is_verified=False,
        email_token=verify_token,
        email_token_expires_at=datetime.utcnow() + timedelta(hours=24),
        full_name=data.full_name,
        telegram_id=data.telegram_id,
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        message = str(exc.orig).lower()
        if "email" in message:
            raise HTTPException(
                status_code=409,
                detail="Email already registered",
            ) from exc
        raise
    await db.refresh(user)
    await create_follow_if_missing(db, data.influencer_id, user.id)

    verification_query = {"t": verify_token}
    verification_url = (
        f"{settings.FRONTEND_URL.rstrip('/')}/{data.influencer_id}?"
        f"{urlencode(verification_query)}"
    )

    return PreregisterResponse(
        ok=True,
        user_id=user.id,
        email=user.email,
        message="User preregistered successfully.",
        verification_url=verification_url,
    )
