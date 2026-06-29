import logging

from fastapi import APIRouter, Depends, HTTPException, WebSocket
from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.websockets import WebSocketDisconnect

from app.agents.turn_handler import inject_session_break
from app.core.config import settings
from app.data.schemas.adult.adult_conversation import (
    AdultBrowserVoiceStartRequest,
    AdultConversationTokenRequest,
    AdultConversationTokenResponse,
)
from app.data.models import User
from app.core.session import get_db
from app.services.gateways.elevenlabs.browser_voice_session import (
    AdultBrowserVoiceSession,
)
from app.services.use_cases.adult.adult_browser_voice import (
    prepare_adult_browser_voice_call,
)
from app.services.use_cases.adult.adult_conversation_token import (
    create_adult_conversation_token,
)
from app.utils.auth.dependencies import get_current_user

router = APIRouter(prefix="/adult", tags=["Adult Calls"])
log = logging.getLogger(__name__)


@router.get(
    "/conversation-token",
    response_model=AdultConversationTokenResponse,
)
async def get_adult_conversation_token(
    influencer_id: str,
    character_id: int,
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    payload = AdultConversationTokenRequest(
        influencer_id=influencer_id,
        character_id=character_id,
    )
    return await create_adult_conversation_token(
        db=db,
        user_id=_current_user.id,
        payload=payload,
    )


@router.websocket("/ws/voice/{influencer_id}")
async def websocket_adult_voice(
    ws: WebSocket,
    influencer_id: str,
    db: AsyncSession = Depends(get_db),
):
    await ws.accept()

    token = ws.query_params.get("token")
    if not token:
        await ws.close(code=4001)
        return

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        user_id = int(payload.get("sub"))
    except WebSocketDisconnect:
        log.info("[ADULT-VOICE] Client disconnected before auth influencer=%s", influencer_id)
        return
    except jwt.ExpiredSignatureError:
        await ws.close(code=4401)
        return
    except Exception:
        await ws.close(code=4002)
        return

    session: AdultBrowserVoiceSession | None = None

    try:
        raw = await ws.receive_json()
        start_payload = AdultBrowserVoiceStartRequest.model_validate(raw)
        if start_payload.type != "start_call":
            await ws.send_json(
                {
                    "type": "error",
                    "error": "INVALID_START",
                    "message": "First message must be start_call.",
                }
            )
            await ws.close(code=4400)
            return

        session_config = await prepare_adult_browser_voice_call(
            db=db,
            user_id=user_id,
            payload=AdultConversationTokenRequest(
                influencer_id=influencer_id,
                character_id=start_payload.character_id,
            ),
        )
        inject_session_break(session_config.chat_id)

        session = AdultBrowserVoiceSession(
            client_ws=ws,
            user_id=user_id,
            influencer_id=influencer_id,
            character_id=session_config.character_id,
            character_slug=session_config.character_slug,
            agent_id=session_config.agent_id,
            voice_id=session_config.voice_id,
            prompt=session_config.prompt,
            greeting_used=session_config.greeting_used,
            language=session_config.native_language,
            chat_id=session_config.chat_id,
            credits_remainder_secs=session_config.credits_remainder_secs,
            max_duration_secs=session_config.max_duration_secs,
        )
        await session.start()

        while True:
            raw = await ws.receive_json()
            msg_type = raw.get("type")

            if msg_type == "input_audio_chunk":
                audio_b64 = raw.get("audio")
                if not isinstance(audio_b64, str) or not audio_b64:
                    await ws.send_json(
                        {
                            "type": "error",
                            "error": "INVALID_AUDIO",
                            "message": "audio must be a base64 PCM string.",
                        }
                    )
                    continue
                await session.handle_client_audio(audio_b64)
                continue

            if msg_type == "ping":
                await ws.send_json({"type": "pong"})
                continue

            if msg_type == "stop_call":
                await session.stop(reason="client_stop")
                return

            await ws.send_json(
                {
                    "type": "error",
                    "error": "UNKNOWN_MESSAGE_TYPE",
                    "message": "Unsupported websocket message type.",
                }
            )
    except WebSocketDisconnect:
        if session:
            await session.stop(reason="client_disconnect")
    except HTTPException as exc:
        detail = exc.detail
        if session:
            await session.stop(reason="setup_error")
        payload = {
            "type": "error",
            "error": "HTTP_ERROR",
            "message": detail if isinstance(detail, str) else "Adult voice setup failed.",
        }
        if isinstance(detail, dict):
            payload["error"] = detail.get("error", "HTTP_ERROR")
            payload["message"] = detail.get("message", "Adult voice setup failed.")
            for key in ("needed_cents", "free_left", "influencer_id"):
                if key in detail:
                    payload[key] = detail[key]
        try:
            await ws.send_json(payload)
        except Exception:
            pass
        try:
            close_code = 4403 if exc.status_code in (402, 403) else 4400
            await ws.close(code=close_code)
        except Exception:
            pass
    except Exception as exc:
        log.exception(
            "[ADULT-VOICE] Unexpected error influencer=%s user=%s",
            influencer_id,
            user_id,
        )
        if session:
            await session.stop(reason="server_error")
        try:
            await ws.send_json(
                {
                    "type": "error",
                    "error": "SERVER_ERROR",
                    "message": str(exc),
                }
            )
        except Exception:
            pass
        try:
            await ws.close(code=4003)
        except Exception:
            pass
