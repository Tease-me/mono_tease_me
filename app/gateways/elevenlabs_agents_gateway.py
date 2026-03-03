"""Gateway for ElevenLabs agent creation."""

from __future__ import annotations

import logging
from typing import Any, Optional

import httpx
from fastapi import HTTPException

from app.core.config import settings
from app.gateways.elevenlabs_endpoints import ElevenLabsEndpoints
from app.gateways.elevenlabs_naming import apply_environment_label

log = logging.getLogger(__name__)


class ElevenLabsAgentsGateway:
    def __init__(self) -> None:
        self._base_url = settings.ELEVEN_BASE_URL
        self._api_key = settings.ELEVENLABS_API_KEY

    def _headers(self) -> dict[str, str]:
        if not self._api_key:
            raise HTTPException(500, "ELEVENLABS_API_KEY is not configured.")
        return {"xi-api-key": self._api_key}

    @staticmethod
    def _build_agent_create_payload(
        *,
        name: Optional[str],
        voice_id: str,
        prompt_text: str,
        language: str = "en",
        llm: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> dict[str, Any]:
        if not voice_id:
            raise HTTPException(400, "voice_id is required to create an ElevenLabs agent.")

        agent_cfg: dict[str, Any] = {
            "language": language,
            "prompt": {
                "prompt": prompt_text or "",
            },
            "tools": [
                {
                    "name": "updateRelationship",
                    "type": "webhook",
                    "description": "MANDATORY: Call on EVERY user message to track relationship changes. Returns instantly - continue your reply without waiting.",
                    "webhook": {
                        "url": f"{settings.PUBLIC_BASE_URL.rstrip('/')}/webhooks/update_relationship",
                        "method": "POST",
                        "request_headers": {
                            "X-Webhook-Token": settings.ELEVENLABS_CONVAI_WEBHOOK_SECRET or ""
                        },
                    },
                },
                {
                    "name": "getMemories",
                    "type": "webhook",
                    "description": "Call when user references past conversations or asks what you remember. Retrieves relevant memories - wait for response before replying.",
                    "webhook": {
                        "url": f"{settings.PUBLIC_BASE_URL.rstrip('/')}/webhooks/memories",
                        "method": "POST",
                        "request_headers": {
                            "X-Webhook-Token": settings.ELEVENLABS_CONVAI_WEBHOOK_SECRET or ""
                        },
                    },
                },
            ],
        }

        if llm is not None:
            agent_cfg["prompt"]["llm"] = llm
        if temperature is not None:
            agent_cfg["prompt"]["temperature"] = temperature
        if max_tokens is not None:
            agent_cfg["prompt"]["max_tokens"] = max_tokens

        return {
            "name": name,
            "conversation_config": {
                "agent": agent_cfg,
                "tts": {
                    "voice_id": voice_id,
                },
                "client": {
                    "overrides": {
                        "agent": {
                            "first_message": True,
                            "language": True,
                            "prompt": {
                                "prompt": True,
                            },
                        },
                        "tts": {
                            "voice_id": True,
                        },
                    }
                },
            },
        }

    async def create_agent(
        self,
        *,
        name: Optional[str],
        voice_id: str,
        prompt_text: str,
        language: str = "en",
        llm: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        post_call_webhook_id: Optional[str] = None,
    ) -> str:
        payload = self._build_agent_create_payload(
            name=apply_environment_label(name) if name else None,
            voice_id=voice_id,
            prompt_text=prompt_text,
            language=language,
            llm=llm,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        if post_call_webhook_id:
            payload["platform_settings"] = {
                "post_call_webhook_ids": [post_call_webhook_id],
            }

        try:
            async with httpx.AsyncClient(base_url=self._base_url, timeout=20.0) as client:
                resp = await client.post(
                    ElevenLabsEndpoints.CONVAI_AGENTS_CREATE,
                    headers=self._headers(),
                    json=payload,
                )
        except httpx.RequestError as e:
            log.exception("Network error creating ElevenLabs agent: %s", e)
            raise HTTPException(status_code=502, detail="Upstream unavailable")

        if resp.status_code >= 400:
            error_text = resp.text[:500] if resp.text else "No error details"
            log.error("ElevenLabs agent creation failed: %s %s", resp.status_code, error_text)
            error_detail = f"Failed to create ElevenLabs agent: {resp.status_code}"
            try:
                error_json = resp.json()
                if isinstance(error_json, dict) and "detail" in error_json:
                    error_detail = f"ElevenLabs API error: {error_json['detail']}"
                elif isinstance(error_json, dict) and "message" in error_json:
                    error_detail = f"ElevenLabs API error: {error_json['message']}"
            except Exception:
                pass
            raise HTTPException(status_code=resp.status_code, detail=error_detail)

        data = resp.json()
        new_agent_id = data.get("agent_id")
        if not new_agent_id:
            log.error("ElevenLabs agent creation response missing agent_id: %s", data)
            raise HTTPException(
                status_code=502,
                detail="ElevenLabs agent creation succeeded but returned no agent_id.",
            )
        return new_agent_id
