"""
Telegram Admin API
==================
Admin endpoints for managing Telegram Userbot sessions.
Protected behind admin-only access (user_id == 1).

Authentication is done in two API calls:
  1. POST /telegram/sessions/send-code   — sends verification code to Telegram
  2. POST /telegram/sessions/verify-code — completes sign-in with the code
"""

import logging
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.admin.common import ensure_admin
from app.data.models import User
from app.core.session import get_db
from app.utils.auth.dependencies import get_current_user
from app.core.config import settings
from app.services.gateways.telegram.session_manager import session_manager
from app.services.gateways.telegram import lifecycle as tg_lifecycle
from app.services.repositories import call_record_repository
from app.data.schemas.telegram_session import (
    SendCodeRequest,
    SendCodeResponse,
    ResendCodeRequest,
    VerifyCodeRequest,
    VerifyCodeResponse,
    SessionInfo,
    SessionListResponse,
    SessionActionResponse,
    TrialResetResponse,
    TrialResetUserInfo,
)

log = logging.getLogger(__name__)

router = APIRouter(prefix="/telegram", tags=["telegram-admin"])


# ─────────────────────── guards ───────────────────────


def _require_enabled():
    if not settings.TELEGRAM_USERBOT_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="Telegram Userbot is disabled. Set TELEGRAM_USERBOT_ENABLED=true",
        )


# ─────────────────────── 2-step auth endpoints ───────────────────────

@router.post(
    "/sessions/send-code",
    response_model=SendCodeResponse,
    summary="Send Telegram verification code",
)
async def send_code(
    payload: SendCodeRequest,
    current_user: User = Depends(get_current_user),
):
    """Step 1: Send a verification code to the phone number.

    If a session file already exists, it will auto-resume instead.
    Otherwise, Telegram sends a code to the phone's Telegram app.
    """
    ensure_admin(current_user)
    _require_enabled()

    try:
        result = await session_manager.send_code(
            influencer_id=payload.influencer_id,
            phone_number=payload.phone_number,
        )

        # If session was auto-resumed, register handlers now
        if result.get("status") == "resumed":
            client = await session_manager.get_session(payload.influencer_id)
            if client:
                from app.services.gateways.telegram.handlers import TelegramMessageHandler
                handler = TelegramMessageHandler(client, payload.influencer_id)
                handler.register()
                log.info("Handlers registered for resumed session %s", payload.influencer_id)

        return SendCodeResponse(ok=True, **result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        log.exception("Failed to send code for %s", payload.influencer_id)
        raise HTTPException(status_code=500, detail=f"Send code failed: {str(e)}")


@router.post(
    "/sessions/resend-code",
    response_model=SendCodeResponse,
    summary="Resend Telegram verification code",
)
async def resend_code(
    payload: ResendCodeRequest,
    current_user: User = Depends(get_current_user),
):
    """Resend the verification code via the fallback delivery method.

    Call this after send-code if the initial code wasn't received.
    Telegram will try the next delivery method (e.g. SMS instead of in-app).
    """
    ensure_admin(current_user)
    _require_enabled()

    try:
        result = await session_manager.resend_code(
            influencer_id=payload.influencer_id,
        )
        return SendCodeResponse(ok=True, **result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        log.exception("Failed to resend code for %s", payload.influencer_id)
        raise HTTPException(status_code=500, detail=f"Resend code failed: {str(e)}")


@router.post(
    "/sessions/verify-code",
    response_model=VerifyCodeResponse,
    summary="Verify Telegram auth code",
)
async def verify_code(
    payload: VerifyCodeRequest,
    current_user: User = Depends(get_current_user),
):
    """Step 2: Complete authentication with the verification code.

    If the account has 2FA, provide the password field too.
    After success, the session is saved and will auto-resume on restarts.
    """
    ensure_admin(current_user)
    _require_enabled()

    try:
        client = await session_manager.verify_code(
            influencer_id=payload.influencer_id,
            code=payload.code,
            password=payload.password,
        )
        me = await client.get_me()

        # Register handlers on the new session
        from app.services.gateways.telegram.handlers import TelegramMessageHandler
        handler = TelegramMessageHandler(client, payload.influencer_id)
        handler.register()

        return VerifyCodeResponse(
            ok=True,
            status="authenticated",
            influencer_id=payload.influencer_id,
            telegram_user=me.username or me.first_name,
            telegram_id=me.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except Exception as e:
        log.exception("Failed to verify code for %s", payload.influencer_id)
        raise HTTPException(status_code=500, detail=f"Verify code failed: {str(e)}")


# ─────────────────────── session management ───────────────────────

@router.get(
    "/sessions",
    response_model=SessionListResponse,
    summary="List all Telegram sessions",
)
async def list_telegram_sessions(
    current_user: User = Depends(get_current_user),
):
    """List all active and saved Telegram sessions."""
    ensure_admin(current_user)
    _require_enabled()

    active = session_manager.list_sessions()
    saved = session_manager.list_saved_sessions()

    active_ids = {s["influencer_id"] for s in active}
    all_sessions = []

    for s in active:
        all_sessions.append(SessionInfo(
            influencer_id=s["influencer_id"],
            connected=s.get("connected", True),
            telegram_user=s.get("telegram_user"),
            telegram_id=s.get("telegram_id"),
            has_session_file=s["influencer_id"] in saved,
        ))

    for iid in saved:
        if iid not in active_ids:
            all_sessions.append(SessionInfo(
                influencer_id=iid,
                connected=False,
                has_session_file=True,
            ))

    return SessionListResponse(sessions=all_sessions, count=len(all_sessions))


@router.post(
    "/sessions/stop/{influencer_id}",
    response_model=SessionActionResponse,
    summary="Stop a Telegram session",
)
async def stop_telegram_session(
    influencer_id: str,
    current_user: User = Depends(get_current_user),
):
    """Stop a specific influencer's Telegram session."""
    ensure_admin(current_user)
    _require_enabled()

    stopped = await tg_lifecycle.stop_session(influencer_id)
    return SessionActionResponse(
        ok=stopped,
        influencer_id=influencer_id,
        message="Session stopped" if stopped else "No active session found",
    )


@router.delete(
    "/sessions/{influencer_id}",
    response_model=SessionActionResponse,
    summary="Delete a Telegram session",
)
async def delete_telegram_session(
    influencer_id: str,
    terminate_on_telegram: bool = False,
    current_user: User = Depends(get_current_user),
):
    """Fully wipe a session: stop connection, delete session file, clear pending auth.

    Pass ``terminate_on_telegram=true`` to also call Telegram's log_out API,
    which terminates the session on Telegram's servers and frees up the
    active-sessions slot (max 10 per account).  Without this flag the session
    is only removed locally.

    After deletion, the influencer will need to go through send-code/verify-code again.
    """
    ensure_admin(current_user)
    _require_enabled()

    result = await session_manager.delete_session(
        influencer_id, terminate_on_telegram=terminate_on_telegram,
    )
    msg = (
        "Session terminated on Telegram and wiped locally."
        if result.get("logged_out_from_telegram")
        else "Session wiped locally. Use send-code to re-authenticate."
    )
    return SessionActionResponse(
        ok=True,
        influencer_id=influencer_id,
        message=msg,
        logged_out_from_telegram=result.get("logged_out_from_telegram"),
    )


@router.get(
    "/sessions/{influencer_id}",
    response_model=SessionInfo,
    summary="Get Telegram session status",
)
async def get_telegram_session_status(
    influencer_id: str,
    current_user: User = Depends(get_current_user),
):
    """Get the status of a specific influencer's Telegram session."""
    ensure_admin(current_user)
    _require_enabled()

    client = await session_manager.get_session(influencer_id)
    if client:
        me = await client.get_me()
        return SessionInfo(
            influencer_id=influencer_id,
            connected=True,
            telegram_user=me.username or me.first_name,
            telegram_id=me.id,
        )

    return SessionInfo(
        influencer_id=influencer_id,
        connected=False,
        has_session_file=influencer_id in session_manager.list_saved_sessions(),
    )


# ─────────────────────── trial management ───────────────────────

@router.post(
    "/trials/reset",
    response_model=TrialResetResponse,
    summary="Reset all Telegram trial budgets",
)
async def reset_all_telegram_trials(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete all Telegram call records, resetting every user's trial budget."""
    ensure_admin(current_user)

    deleted, rows = await call_record_repository.delete_telegram_trials(db)

    log.info("admin.reset_all_trials deleted=%d by_user=%s", deleted, current_user.id)

    return TrialResetResponse(
        ok=True,
        deleted=deleted,
        users_reset=[
            TrialResetUserInfo(
                telegram_user_id=tg_id,
                calls=calls,
                used_secs=round(secs, 1),
            )
            for tg_id, calls, secs in rows
        ],
    )


# End of Telegram Admin API
