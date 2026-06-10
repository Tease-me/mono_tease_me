import secrets
from datetime import datetime

from fastapi import HTTPException
from passlib.context import CryptContext
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.data.models import Influencer, User
from app.data.schemas.mjpromoter import (
    MjpromoterPreregisterRequest,
    MjpromoterPreregisterResponse,
)
from app.services.follow import create_follow_if_missing
from app.utils.vip_invite_code import VIP_INVITE_TTL, generate_vip_invite_code

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
TOKEN_TTL = VIP_INVITE_TTL
MAX_INVITE_CODE_ATTEMPTS = 12


def _internal_email_for_telegram(telegram_id: int) -> str:
    """Synthetic unique value for users.email when client omits email (Telegram flow)."""
    return f"telegram-{telegram_id}@mjpromoter.placeholder.invalid"


def _internal_email_for_instagram(instagram_username: str) -> str:
    """Synthetic unique value for users.email when client omits email (Instagram flow)."""
    return f"instagram-{instagram_username}@mjpromoter.placeholder.invalid"


def _resolve_stored_email(data: MjpromoterPreregisterRequest) -> str:
    if data.email is not None:
        return str(data.email)
    if data.instagram_username:
        return _internal_email_for_instagram(data.instagram_username)
    if data.telegram_id is not None:
        return _internal_email_for_telegram(data.telegram_id)
    raise HTTPException(status_code=422, detail="telegram_id or instagram_username is required")


async def _allocate_unique_invite_code(db: AsyncSession) -> str:
    for _ in range(MAX_INVITE_CODE_ATTEMPTS):
        code = generate_vip_invite_code()
        existing = await db.execute(
            select(User.id).where(
                func.upper(User.email_token) == code,
            ).limit(1)
        )
        if existing.scalar_one_or_none() is None:
            return code
    raise HTTPException(status_code=500, detail="Failed to generate unique invite code")


async def preregister_mjpromoter_user(
    db: AsyncSession,
    data: MjpromoterPreregisterRequest,
) -> MjpromoterPreregisterResponse:
    influencer = await db.get(Influencer, data.influencer_id)
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer not found")

    invite_code = await _allocate_unique_invite_code(db)
    token_expires_at = datetime.utcnow() + TOKEN_TTL
    stored_email = _resolve_stored_email(data)

    existing_user = await db.execute(select(User).where(User.email == stored_email))
    if existing_user.scalar():
        raise HTTPException(status_code=409, detail="Email already registered")

    if data.telegram_id is not None:
        existing_telegram_user = await db.execute(
            select(User).where(User.telegram_id == data.telegram_id)
        )
        if existing_telegram_user.scalar():
            raise HTTPException(status_code=409, detail="Telegram ID already registered")

    if data.instagram_username:
        existing_instagram_user = await db.execute(
            select(User).where(
                func.lower(User.username) == data.instagram_username.lower()
            )
        )
        if existing_instagram_user.scalar():
            raise HTTPException(
                status_code=409,
                detail="Instagram username already registered",
            )

    user = User(
        email=stored_email,
        password_hash=pwd_context.hash(secrets.token_urlsafe(32)),
        is_verified=False,
        email_token=invite_code,
        vip_invite_code=invite_code,
        email_token_expires_at=token_expires_at,
        full_name=data.full_name,
        telegram_id=data.telegram_id,
        username=data.instagram_username,
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
        if "telegram_id" in message:
            raise HTTPException(
                status_code=409,
                detail="Telegram ID already registered",
            ) from exc
        raise
    await db.refresh(user)
    await create_follow_if_missing(db, data.influencer_id, user.id)

    response_email = None if data.email is None else user.email
    return MjpromoterPreregisterResponse(
        ok=True,
        user_id=user.id,
        email=response_email,
        message="User preregistered successfully.",
        invite_code=invite_code,
        expires_at=token_expires_at,
        instagram_username=data.instagram_username,
    )
