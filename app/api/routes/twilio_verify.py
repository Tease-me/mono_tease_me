"""
Twilio Verify API routes.

Endpoints for sending and checking phone OTP codes via Twilio Verify.
Protected behind admin-only access (user_id == 1).
"""

import logging
from fastapi import APIRouter, Depends, HTTPException

from app.api.admin.common import ensure_admin
from app.data.models import User
from app.utils.auth.dependencies import get_current_user
from app.services.gateways import twilio_gateway
from app.data.schemas.twilio import (
    TwilioSendCodeRequest,
    TwilioSendCodeResponse,
    TwilioCheckCodeRequest,
    TwilioCheckCodeResponse,
)

log = logging.getLogger(__name__)

router = APIRouter(prefix="/twilio", tags=["twilio-verify"])




@router.post(
    "/send-code",
    response_model=TwilioSendCodeResponse,
    summary="Send OTP verification code",
)
async def send_code(
    payload: TwilioSendCodeRequest,
    current_user: User = Depends(get_current_user),
):
    """Send a one-time verification code to the given phone number.

    Supported channels: ``sms``, ``call``, ``whatsapp``, ``email``.
    """
    ensure_admin(current_user)

    try:
        result = await twilio_gateway.send_verification(
            phone=payload.phone,
            channel=payload.channel,
        )
        return TwilioSendCodeResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        log.exception("twilio.send_code failed")
        raise HTTPException(status_code=500, detail=f"Send code failed: {exc}")


@router.post(
    "/check-code",
    response_model=TwilioCheckCodeResponse,
    summary="Check OTP verification code",
)
async def check_code(
    payload: TwilioCheckCodeRequest,
    current_user: User = Depends(get_current_user),
):
    """Verify the OTP code entered by the user.

    Returns ``valid=true`` and ``status='approved'`` on success.
    """
    ensure_admin(current_user)

    try:
        result = await twilio_gateway.check_verification(
            phone=payload.phone,
            code=payload.code,
        )
        return TwilioCheckCodeResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        log.exception("twilio.check_code failed")
        raise HTTPException(status_code=500, detail=f"Check code failed: {exc}")
