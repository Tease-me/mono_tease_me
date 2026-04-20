import asyncio
import secrets
import logging

from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode
from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile, status

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from jose import jwt, JWTError
from passlib.context import CryptContext
from app.core.session import get_db
from app.data.models import User
from app.data.schemas.auth import (
    CheckEmailTokenRequest,
    CheckEmailTokenResponse,
    CompleteProfileRequest,
    CompleteProfileResponse,
    LoginRequest,
    PasswordResetRequest,
    PreregisterRequest,
    PreregisterResponse,
    RegisterRequest,
    Token,
    VerifyEmailResponse,
)
from app.core.config import settings
from app.services.email.mailers import (
    send_password_reset_email,
    send_verification_email,
)
from app.services.repositories.influencer_email_assets_repository import (
    get_influencer_email_header_key,
    get_influencer_email_header_public_url,
)
from app.utils.auth.dependencies import get_current_user
from app.utils.auth.tokens import create_token
from app.api.routes.notify_ws import notify_email_verified
from app.services.firstpromoter import fp_track_signup
from app.data.schemas.user import UserOut
from app.utils.storage.s3 import (
    delete_file_from_s3,
    resolve_user_photo_url,
    save_user_photo_to_s3,
)
from app.services.follow import create_follow_if_missing
from app.services.billing import topup_wallet
from app.services.email_verification_service import check_email_verification_token
from app.api.deps.influencer import ensure_influencer
from app.api.deps.internal_auth import require_internal_token
from app.utils.infrastructure.rate_limiter import rate_limit
from app.utils.infrastructure.country import (
    is_request_from_age_verification_required_country,
)

log = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _get_login_bonus_status(user: User) -> str:
    if user.login_bonus_granted_at is not None:
        return "granted"
    if user.login_bonus_pending:
        return "pending"
    return "none"


async def _apply_first_login_bonus(db: AsyncSession, user: User) -> None:
    now = datetime.now(timezone.utc)
    first_login_detected = user.first_login_at is None

    if first_login_detected:
        user.first_login_at = now

    should_attempt_bonus = (
        user.login_bonus_granted_at is None
        and (first_login_detected or user.login_bonus_pending)
    )
    if not should_attempt_bonus:
        if first_login_detected:
            db.add(user)
            await db.commit()
        return

    bonus_cents = int(settings.FIRST_LOGIN_BONUS_CENTS or 0)
    bonus_influencer_id = (settings.FIRST_LOGIN_BONUS_INFLUENCER_ID or "").strip()
    if bonus_cents <= 0 or not bonus_influencer_id:
        user.login_bonus_pending = True
        db.add(user)
        await db.commit()
        log.warning(
            "first_login_bonus.misconfigured user=%s cents=%s influencer_id=%s",
            user.id,
            bonus_cents,
            bonus_influencer_id or None,
        )
        return

    try:
        await topup_wallet(
            db,
            user_id=user.id,
            influencer_id=bonus_influencer_id,
            cents=bonus_cents,
            source="first_login_bonus",
        )
        user.login_bonus_granted_at = now
        user.login_bonus_pending = False
        db.add(user)
        await db.commit()
    except Exception:
        log.exception("first_login_bonus.failed user=%s", user.id)
        await db.rollback()
        try:
            fresh_user = await db.get(User, user.id)
            if fresh_user is None:
                return
            if fresh_user.first_login_at is None:
                fresh_user.first_login_at = now
            fresh_user.login_bonus_pending = True
            db.add(fresh_user)
            await db.commit()
        except Exception:
            log.exception("first_login_bonus.pending_mark_failed user=%s", user.id)

def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    access_max_age = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    refresh_max_age = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
    response.set_cookie(
        key=settings.ACCESS_TOKEN_COOKIE_NAME,
        value=access_token,
        max_age=access_max_age,
        httponly=settings.ACCESS_TOKEN_HTTPONLY,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        path="/",
    )
    response.set_cookie(
        key=settings.REFRESH_TOKEN_COOKIE_NAME,
        value=refresh_token,
        max_age=refresh_max_age,
        httponly=settings.REFRESH_TOKEN_HTTPONLY,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        path="/",
    )

def _clear_auth_cookies(response: Response) -> None:
    for name, httponly in (
        (settings.ACCESS_TOKEN_COOKIE_NAME, settings.ACCESS_TOKEN_HTTPONLY),
        (settings.REFRESH_TOKEN_COOKIE_NAME, settings.REFRESH_TOKEN_HTTPONLY),
    ):
        response.set_cookie(
            key=name,
            value="",
            max_age=0,
            httponly=httponly,
            secure=settings.COOKIE_SECURE,
            samesite=settings.COOKIE_SAMESITE,
            domain=settings.COOKIE_DOMAIN,
            path="/",
        )

@router.get("/check_email")
async def check_email(email: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    return {
        "exists": user is not None,
        "email": email,
    }


@router.post("/check-token", response_model=CheckEmailTokenResponse)
async def check_token(
    data: CheckEmailTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    return await check_email_verification_token(db, data.email, data.token)


@router.post("/preregister", response_model=PreregisterResponse)
@rate_limit(
    max_requests=settings.RATE_LIMIT_AUTH_MAX,
    window_seconds=settings.RATE_LIMIT_AUTH_WINDOW,
    key_prefix="auth:preregister",
)
async def preregister(
    request: Request,
    data: PreregisterRequest,
    db: AsyncSession = Depends(get_db),
    _internal_auth: None = Depends(require_internal_token),
):
    await ensure_influencer(db, data.influencer_id)
    verify_token = secrets.token_urlsafe(32)

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
    verification_query = {
        "email": user.email,
        "token": verify_token,
    }
    if user.full_name:
        verification_query["full_name"] = user.full_name
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


@router.post("/complete-profile", response_model=CompleteProfileResponse)
@rate_limit(
    max_requests=settings.RATE_LIMIT_AUTH_MAX,
    window_seconds=settings.RATE_LIMIT_AUTH_WINDOW,
    key_prefix="auth:complete-profile",
)
async def complete_profile(
    request: Request,
    data: CompleteProfileRequest = Depends(CompleteProfileRequest.as_form),
    db: AsyncSession = Depends(get_db),
    file: UploadFile | None = File(default=None),
):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not user.email_token or not user.email_token_expires_at:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    if user.is_verified:
        raise HTTPException(status_code=403, detail="User is already verified")
    if user.email_token != data.token:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    if user.email_token_expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=410,
            detail="Verification link has expired. Please request a new one.",
        )

    if data.influencer_id:
        await ensure_influencer(db, data.influencer_id)

    fp_tid = getattr(data, "fp_tid", None) or request.cookies.get("_fprom_tid") or None
    previous_key = user.profile_photo_key

    user.password_hash = pwd_context.hash(data.password)
    if data.full_name is not None:
        user.full_name = data.full_name
    if data.user_name is not None:
        user.username = data.user_name
    if data.gender is not None:
        user.gender = data.gender
    if data.date_of_birth is not None:
        user.date_of_birth = data.date_of_birth
    if data.profile_photo_url is not None:
        user.profile_photo_key = data.profile_photo_url

    if file:
        try:
            key = await save_user_photo_to_s3(
                file.file,
                file.filename or "profile.jpg",
                file.content_type or "image/jpeg",
                user.id,
            )
            user.profile_photo_key = key
        except Exception as exc:
            log.error(
                "Failed to upload profile photo during profile completion: %s",
                exc,
                exc_info=True,
            )
            raise HTTPException(500, "Failed to upload profile photo")

    verify_token = secrets.token_urlsafe(32)
    user.is_verified = False
    user.email_token = verify_token
    user.email_token_expires_at = datetime.utcnow() + timedelta(hours=24)

    db.add(user)
    try:
        await db.commit()
        await db.refresh(user)
    except IntegrityError as exc:
        await db.rollback()
        if file and user.profile_photo_key and user.profile_photo_key != previous_key:
            try:
                await delete_file_from_s3(user.profile_photo_key)
            except Exception:
                log.warning(
                    "Failed to rollback uploaded S3 photo during profile completion",
                    exc_info=True,
                )
        raise HTTPException(
            status_code=409,
            detail="Profile completion violates a database constraint",
        ) from exc
    except Exception:
        await db.rollback()
        if file and user.profile_photo_key and user.profile_photo_key != previous_key:
            try:
                await delete_file_from_s3(user.profile_photo_key)
            except Exception:
                log.warning(
                    "Failed to rollback uploaded S3 photo during profile completion",
                    exc_info=True,
                )
        raise

    if data.invite_code:
        try:
            from app.services.telegram_invite_service import claim_and_bind_telegram

            bind_result = await claim_and_bind_telegram(
                db,
                data.invite_code,
                user,
                data.influencer_id,
            )
            if bind_result:
                data.influencer_id = bind_result.influencer_id
                if bind_result.bound:
                    from app.services.funnel_tracking_service import (
                        track_registration_completed,
                    )

                    asyncio.create_task(
                        track_registration_completed(
                            bind_result.telegram_id,
                            bind_result.influencer_id,
                            user.id,
                            data.invite_code,
                        )
                    )
        except Exception:
            log.exception(
                "complete_profile.invite_claim_error code=%s",
                data.invite_code,
            )

    if data.influencer_id:
        await create_follow_if_missing(db, data.influencer_id, user.id)
        from app.services.funnel_tracking_service import track_influencer_followed

        asyncio.create_task(track_influencer_followed(user.id, data.influencer_id))

    try:
        log.info(
            "FP complete profile: tid_body=%s tid_cookie=%s chosen=%s",
            getattr(data, "fp_tid", None),
            request.cookies.get("_fprom_tid"),
            fp_tid,
        )

        if fp_tid:
            await fp_track_signup(
                email=user.email,
                uid=str(user.id),
                tid=fp_tid,
            )
    except Exception:
        log.exception("FirstPromoter track/signup failed during profile completion")

    try:
        influencer_verification_header_url = None
        influencer = None
        if data.influencer_id:
            influencer = await ensure_influencer(db, data.influencer_id)
            verification_header_key = get_influencer_email_header_key(
                getattr(influencer, "assets_json", None)
            )
            if verification_header_key:
                influencer_verification_header_url = (
                    get_influencer_email_header_public_url(verification_header_key)
                )

        await send_verification_email(
            user.email,
            verify_token,
            influencer_id=data.influencer_id,
            influencer_display_name=getattr(influencer, "display_name", None),
            influencer_verification_header_url=influencer_verification_header_url,
            influencer_profile_photo_key=getattr(influencer, "profile_photo_key", None),
        )
    except Exception:
        log.exception("Failed to send verification email during profile completion for user %s", user.id)

    return {
        "ok": True,
        "user_id": user.id,
        "email": user.email,
        "message": "Check your email to verify your account before logging in.",
    }


@router.post("/register")
@rate_limit(max_requests=settings.RATE_LIMIT_AUTH_MAX, window_seconds=settings.RATE_LIMIT_AUTH_WINDOW, key_prefix="auth:register")
async def register(
    request: Request,
    data: RegisterRequest = Depends(RegisterRequest.as_form),
    db: AsyncSession = Depends(get_db),
    file: UploadFile | None = File(default=None),
):
    influencer = None
    existing_user = await db.execute(select(User).where(User.email == data.email))
    if existing_user.scalar():
        raise HTTPException(status_code=409, detail="Email already registered")

    if data.influencer_id:
        influencer = await ensure_influencer(db, data.influencer_id)

    verify_token = secrets.token_urlsafe(32)
    token_expires = datetime.utcnow() + timedelta(hours=24)

    fp_tid = getattr(data, "fp_tid", None) or request.cookies.get("_fprom_tid") or None

    user = User(
        password_hash=pwd_context.hash(data.password),
        email=data.email,
        is_verified=False,
        email_token=verify_token,
        email_token_expires_at=token_expires,
        full_name=data.full_name,
        username=data.user_name,
        gender=data.gender,
        date_of_birth=data.date_of_birth,
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

    if file:
        try:
            key = await save_user_photo_to_s3(
                file.file,
                file.filename or "profile.jpg",
                file.content_type or "image/jpeg",
                user.id
            )
            user.profile_photo_key = key
            db.add(user)
            try:
                await db.commit()
                await db.refresh(user)
            except Exception:
                await db.rollback()
                try:
                    await delete_file_from_s3(key)
                except Exception:
                    log.warning("Failed to rollback uploaded S3 photo %s", key, exc_info=True)
                raise
        except Exception as e:
            log.error(f"Failed to upload profile photo during registration: {e}", exc_info=True)
            raise HTTPException(500, "Failed to upload profile photo")
    elif data.profile_photo_url:
        user.profile_photo_key = data.profile_photo_url
        db.add(user)
        try:
            await db.commit()
            await db.refresh(user)
        except IntegrityError as exc:
            await db.rollback()
            message = str(exc.orig).lower()
            if "email" in message:
                raise HTTPException(
                    status_code=409,
                    detail="Email already registered",
                ) from exc
            raise

    # Claim Telegram invite code and bind telegram_id
    if data.invite_code:
        try:
            from app.services.telegram_invite_service import claim_and_bind_telegram
            bind_result = await claim_and_bind_telegram(
                db, data.invite_code, user, data.influencer_id,
            )
            if bind_result:
                data.influencer_id = bind_result.influencer_id
                if bind_result.bound:
                    from app.services.funnel_tracking_service import track_registration_completed
                    asyncio.create_task(track_registration_completed(
                        bind_result.telegram_id,
                        bind_result.influencer_id,
                        user.id,
                        data.invite_code,
                    ))
        except Exception:
            log.exception("register.invite_claim_error code=%s", data.invite_code)

    if data.influencer_id:
        await create_follow_if_missing(db, data.influencer_id, user.id)
        from app.services.funnel_tracking_service import track_influencer_followed
        asyncio.create_task(track_influencer_followed(user.id, data.influencer_id))

    try:
        log.info(
            "FP signup: tid_body=%s tid_cookie=%s chosen=%s",
            getattr(data, "fp_tid", None),
            request.cookies.get("_fprom_tid"),
            fp_tid,
        )

        if fp_tid:
            await fp_track_signup(
                email=user.email,
                uid=str(user.id),
                tid=fp_tid,
            )
    except Exception:
        log.exception("FirstPromoter track/signup failed")
    
    try:
        influencer_verification_header_url = None
        if influencer is not None:
            verification_header_key = get_influencer_email_header_key(
                getattr(influencer, "assets_json", None)
            )
            if verification_header_key:
                influencer_verification_header_url = (
                    get_influencer_email_header_public_url(verification_header_key)
                )

        await send_verification_email(
            user.email,
            verify_token,
            influencer_id=data.influencer_id,
            influencer_display_name=getattr(influencer, "display_name", None),
            influencer_verification_header_url=influencer_verification_header_url,
            influencer_profile_photo_key=getattr(influencer, "profile_photo_key", None),
        )
    except Exception:
        log.exception("Failed to send verification email for user %s", user.id)

    return {
        "ok": True,
        "user_id": user.id,
        "email": user.email,
        "message": "Check your email to verify your account before logging in."
    }


@router.post("/login", response_model=Token)
@rate_limit(max_requests=settings.RATE_LIMIT_AUTH_MAX, window_seconds=settings.RATE_LIMIT_AUTH_WINDOW, key_prefix="auth:login")
async def login(
    request: Request,
    data: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not pwd_context.verify(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    
    if not user.is_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Verify Email First")
    
    access_token = create_token(
        {"sub": str(user.id)}, settings.SECRET_KEY, timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    refresh_token = create_token(
        {"sub": str(user.id)}, settings.REFRESH_SECRET_KEY, timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )

    _set_auth_cookies(response, access_token, refresh_token)

    return Token(access_token=access_token, refresh_token=refresh_token)

@router.post("/refresh", response_model=Token)
async def refresh_token(
    request: Request,
    response: Response,
    refresh_token: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    token_value = refresh_token or request.cookies.get(settings.REFRESH_TOKEN_COOKIE_NAME)
    if not token_value:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    try:
        payload = jwt.decode(token_value, settings.REFRESH_SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid refresh token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user = await db.get(User, int(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    new_access_token = create_token(
        {"sub": str(user.id)}, settings.SECRET_KEY, timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    new_refresh_token = create_token(
        {"sub": str(user.id)}, settings.REFRESH_SECRET_KEY, timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )

    _set_auth_cookies(response, new_access_token, new_refresh_token)

    return Token(access_token=new_access_token, refresh_token=new_refresh_token)

@router.post("/logout")
async def logout(response: Response) -> dict:
    _clear_auth_cookies(response)
    return {"ok": True, "message": "Logged out"}

@router.get("/me", response_model=UserOut)
async def get_me(request: Request, user: User = Depends(get_current_user)):
    is_age_verified = user.is_age_verified or (
        user.is_identity_verified and user.verification_level in ["full", "premium"]
    )
    verification_required = (not is_age_verified) and (
        is_request_from_age_verification_required_country(request)
    )
    user_out = UserOut.model_validate(user)
    user_out.verification_required = verification_required
    user_out.login_bonus_status = _get_login_bonus_status(user)
    if user.profile_photo_key:
        user_out.profile_photo_url = resolve_user_photo_url(user.profile_photo_key)
    return user_out
    
@router.get("/verify-email", response_model=VerifyEmailResponse)
async def verify_email(
    token: str,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email_token == token))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    if user.email_token_expires_at and user.email_token_expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Verification link has expired. Please request a new one.")
    user.is_verified = True
    user.email_token = None
    user.email_token_expires_at = None
    await db.commit()
    await _apply_first_login_bonus(db, user)

    access_token = create_token(
        {"sub": str(user.id)},
        settings.SECRET_KEY,
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    refresh_token = create_token(
        {"sub": str(user.id)},
        settings.REFRESH_SECRET_KEY,
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    _set_auth_cookies(response, access_token, refresh_token)

    await notify_email_verified(user.email)

    try:
        from app.services.funnel_tracking_service import track_email_verified
        asyncio.create_task(track_email_verified(user.id))
    except Exception:
        log.exception("Failed to schedule track_email_verified for user %s", user.id)

    return VerifyEmailResponse(
        ok=True,
        message="Email verified! You are now signed in.",
        access_token=access_token,
        refresh_token=refresh_token,
    )

@router.post("/resend-verification-email")
@rate_limit(max_requests=3, window_seconds=300, key_prefix="auth:resend-verify")
async def resend_verification_email(request: Request, email: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.is_verified:
        raise HTTPException(status_code=400, detail="Email is already verified")

    verify_token = secrets.token_urlsafe(32)
    user.email_token = verify_token
    user.email_token_expires_at = datetime.utcnow() + timedelta(hours=24)
    await db.commit()

    await send_verification_email(user.email, verify_token)

    return {
        "ok": True,
        "message": "A new verification email has been sent."
    }

@router.post("/forgot-password")
@rate_limit(max_requests=3, window_seconds=300, key_prefix="auth:forgot-password")
async def forgot_password(request: Request, email: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user:
        reset_token = secrets.token_urlsafe(32)
        user.password_reset_token = reset_token
        user.password_reset_token_expires_at = datetime.utcnow() + timedelta(hours=1)
        await db.commit()

        try:
            from fastapi.concurrency import run_in_threadpool
            await run_in_threadpool(send_password_reset_email, user.email, reset_token)
        except Exception:
            log.exception("Failed to send password reset email for user %s", user.id)

    return {"ok": True, "message": "If an account exists, we've sent a reset link."}

@router.post("/reset-password")
async def reset_password(data: PasswordResetRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.password_reset_token == data.token))
    user = result.scalar_one_or_none()

    if not user or not user.password_reset_token_expires_at or user.password_reset_token_expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Token inválido ou expirado.")

    user.password_hash = pwd_context.hash(data.new_password)
    user.password_reset_token = None
    user.password_reset_token_expires_at = None
    await db.commit()

    return {"ok": True, "message": "Password updated successfully!"}
