"""
Telegram Admin API
==================
Admin endpoints for managing Telegram Userbot sessions.
Protected behind admin-only access (user_id == 1).
"""

import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.db.models import User
from app.utils.auth.dependencies import get_current_user
from app.core.config import settings
from app.telegram.session_manager import session_manager
from app.telegram import lifecycle as tg_lifecycle

log = logging.getLogger(__name__)

router = APIRouter(prefix="/telegram", tags=["telegram-admin"])


class StartSessionRequest(BaseModel):
    influencer_id: str
    phone_number: str | None = None


class SessionStatusResponse(BaseModel):
    influencer_id: str
    connected: bool


# ─────────────────────── guards ───────────────────────

def _require_admin(user: User):
    if user.id != 1:
        raise HTTPException(status_code=403, detail="Admin only")


def _require_enabled():
    if not settings.TELEGRAM_USERBOT_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="Telegram Userbot is disabled. Set TELEGRAM_USERBOT_ENABLED=true",
        )


# ─────────────────────── endpoints ───────────────────────

@router.get("/sessions")
async def list_telegram_sessions(
    current_user: User = Depends(get_current_user),
):
    """List all active and saved Telegram sessions."""
    _require_admin(current_user)
    _require_enabled()

    active = session_manager.list_sessions()
    saved = session_manager.list_saved_sessions()

    # Merge: show all known sessions with their active status
    active_ids = {s["influencer_id"] for s in active}
    all_sessions = []

    for s in active:
        all_sessions.append({
            **s,
            "has_session_file": s["influencer_id"] in saved,
        })

    for iid in saved:
        if iid not in active_ids:
            all_sessions.append({
                "influencer_id": iid,
                "connected": False,
                "has_session_file": True,
            })

    return {"sessions": all_sessions, "count": len(all_sessions)}


@router.post("/sessions/start")
async def start_telegram_session(
    payload: StartSessionRequest,
    current_user: User = Depends(get_current_user),
):
    """Start a Telegram session for an influencer.

    If no session file exists, phone_number is required for first-time auth.
    The Pyrogram client will prompt for a verification code via Telegram,
    which needs to be handled separately.
    """
    _require_admin(current_user)
    _require_enabled()

    try:
        client = await tg_lifecycle.start_session(
            influencer_id=payload.influencer_id,
            phone_number=payload.phone_number,
        )
        me = await client.get_me()
        return {
            "ok": True,
            "influencer_id": payload.influencer_id,
            "telegram_user": me.username or me.first_name,
            "telegram_id": me.id,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except Exception as e:
        log.exception("Failed to start Telegram session")
        raise HTTPException(status_code=500, detail=f"Session start failed: {str(e)}")


@router.post("/sessions/stop/{influencer_id}")
async def stop_telegram_session(
    influencer_id: str,
    current_user: User = Depends(get_current_user),
):
    """Stop a specific influencer's Telegram session."""
    _require_admin(current_user)
    _require_enabled()

    stopped = await tg_lifecycle.stop_session(influencer_id)
    return {
        "ok": stopped,
        "influencer_id": influencer_id,
        "message": "Session stopped" if stopped else "No active session found",
    }


@router.get("/sessions/{influencer_id}")
async def get_telegram_session_status(
    influencer_id: str,
    current_user: User = Depends(get_current_user),
):
    """Get the status of a specific influencer's Telegram session."""
    _require_admin(current_user)
    _require_enabled()

    client = await session_manager.get_session(influencer_id)
    if client:
        me = await client.get_me()
        return {
            "influencer_id": influencer_id,
            "connected": True,
            "telegram_user": me.username or me.first_name,
            "telegram_id": me.id,
        }

    return {
        "influencer_id": influencer_id,
        "connected": False,
        "has_session_file": influencer_id in session_manager.list_saved_sessions(),
    }
