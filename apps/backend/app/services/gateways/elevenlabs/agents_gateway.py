"""Gateway for ElevenLabs agent creation."""

from __future__ import annotations

import logging
from copy import deepcopy
from typing import Any, Optional

import httpx
from fastapi import HTTPException

from app.core.config import settings
from app.services.gateways.elevenlabs.common import ElevenLabsEndpoints, apply_environment_label

log = logging.getLogger(__name__)

DEFAULT_AGENT_LLM = "claude-sonnet-4-5"
DEFAULT_ASR_PROVIDER = "scribe_realtime"
DEFAULT_TURN_EAGERNESS = "eager"
DEFAULT_TURN_TIMEOUT_SECS = 5
DEFAULT_MAX_CONVERSATION_SECS = 3600
DEFAULT_CASCADE_TIMEOUT_SECS = 4
DEFAULT_TTS_MODEL_ID = "eleven_v3_conversational"


def compute_max_duration(credits_remainder_secs: int | float) -> int:
    return int(min(credits_remainder_secs, DEFAULT_MAX_CONVERSATION_SECS))


DEFAULT_FIRST_MESSAGE_TEMPLATE = "{{first_message}}"
DEFAULT_CONVERSATION_CONFIG_OVERRIDE = {
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
    "turn_detection": {
        "type": True,
        "silence_duration_ms": True,
        "threshold": True,
    },
}


def build_conversation_config_override() -> dict[str, Any]:
    """Return the allowed conversation override config for client initiation."""
    return deepcopy(DEFAULT_CONVERSATION_CONFIG_OVERRIDE)


def _build_agent_patch_payload(
    *,
    prompt_text: Optional[str] = None,
    llm: Optional[str] = None,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
) -> dict[str, Any]:
    agent_cfg: dict[str, Any] = {}

    prompt_cfg: dict[str, Any] = {}
    if prompt_text is not None:
        prompt_cfg["prompt"] = prompt_text
    if llm is not None:
        prompt_cfg["llm"] = llm
    if temperature is not None:
        prompt_cfg["temperature"] = temperature
    if max_tokens is not None:
        prompt_cfg["max_tokens"] = max_tokens
    if prompt_cfg:
        agent_cfg["prompt"] = prompt_cfg

    return {
        "conversation_config": {
            "agent": agent_cfg,
        }
    }


class ElevenLabsAgentsGateway:
    def __init__(self) -> None:
        self._base_url = settings.ELEVEN_BASE_URL
        self._api_key = settings.ELEVENLABS_API_KEY

    def _headers(self) -> dict[str, str]:
        if not self._api_key:
            raise HTTPException(500, "ELEVENLABS_API_KEY is not configured.")
        return {"xi-api-key": self._api_key}

    async def patch_agent(
        self,
        agent_id: str,
        *,
        prompt_text: Optional[str] = None,
        llm: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> None:
        payload = _build_agent_patch_payload(
            prompt_text=prompt_text,
            llm=llm,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        if not payload["conversation_config"]["agent"]:
            return

        try:
            async with httpx.AsyncClient(
                base_url=self._base_url, timeout=20.0
            ) as client:
                resp = await client.patch(
                    f"/convai/agents/{agent_id}",
                    headers=self._headers(),
                    json=payload,
                )
        except httpx.RequestError as exc:
            log.exception("Network error PATCHing ElevenLabs agent: %s", exc)
            raise HTTPException(status_code=502, detail="Upstream unavailable")

        if resp.status_code >= 400:
            error_text = resp.text[:500] if resp.text else "No error details"
            log.error("ElevenLabs PATCH failed: %s %s", resp.status_code, error_text)

            error_detail = f"Failed to update ElevenLabs agent: {resp.status_code}"
            try:
                error_json = resp.json()
                if isinstance(error_json, dict) and "detail" in error_json:
                    error_detail = f"ElevenLabs API error: {error_json['detail']}"
                elif isinstance(error_json, dict) and "message" in error_json:
                    error_detail = f"ElevenLabs API error: {error_json['message']}"
            except Exception:
                pass

            raise HTTPException(status_code=resp.status_code, detail=error_detail)

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
            raise HTTPException(
                400, "voice_id is required to create an ElevenLabs agent."
            )

        agent_cfg: dict[str, Any] = {
            "first_message": DEFAULT_FIRST_MESSAGE_TEMPLATE,
            "language": language,
            "prompt": {
                "prompt": prompt_text or "",
                "llm": llm or DEFAULT_AGENT_LLM,
                "cascade_timeout_seconds": DEFAULT_CASCADE_TIMEOUT_SECS,
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
                            "X-Webhook-Token": settings.ELEVENLABS_CONVAI_WEBHOOK_SECRET
                            or ""
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
                            "X-Webhook-Token": settings.ELEVENLABS_CONVAI_WEBHOOK_SECRET
                            or ""
                        },
                    },
                },
            ],
        }

        if temperature is not None:
            agent_cfg["prompt"]["temperature"] = temperature
        if max_tokens is not None:
            agent_cfg["prompt"]["max_tokens"] = max_tokens

        return {
            "name": name,
            "conversation_config": {
                # The public API does not currently expose a dedicated
                # "filter_background_speech" field; Scribe is the closest setting.
                "asr": {
                    "provider": DEFAULT_ASR_PROVIDER,
                },
                "turn": {
                    "turn_timeout": DEFAULT_TURN_TIMEOUT_SECS,
                    "turn_eagerness": DEFAULT_TURN_EAGERNESS,
                },
                "conversation": {
                    "max_duration_seconds": DEFAULT_MAX_CONVERSATION_SECS,
                },
                "agent": agent_cfg,
                "tts": {
                    "model_id": DEFAULT_TTS_MODEL_ID,
                    "voice_id": voice_id,
                },
            },
            "platform_settings": {
                "overrides": {
                    "conversation_config_override": build_conversation_config_override()
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
            payload.setdefault("platform_settings", {})
            payload["platform_settings"]["post_call_webhook_ids"] = [
                post_call_webhook_id
            ]

        try:
            async with httpx.AsyncClient(
                base_url=self._base_url, timeout=20.0
            ) as client:
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
            log.error(
                "ElevenLabs agent creation failed: %s %s", resp.status_code, error_text
            )
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

    async def upsert_agent_prompt(
        self,
        *,
        agent_id: str | None,
        prompt_text: str,
        voice_id: str,
        agent_name: str | None,
        language: str = "en",
        llm: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        post_call_webhook_id: str | None = None,
    ) -> str:
        if agent_id:
            try:
                log.info("Patching existing ElevenLabs agent %s", agent_id)
                await self.patch_agent(
                    agent_id,
                    prompt_text=prompt_text,
                    llm=llm,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                return agent_id
            except HTTPException as exc:
                if exc.status_code != 404:
                    raise
                log.warning(
                    "ElevenLabs agent %s not found; creating a new one (agent_name=%s).",
                    agent_id,
                    agent_name or "unknown",
                )

        if not voice_id:
            raise HTTPException(
                status_code=400,
                detail="voice_id is required to create a new ElevenLabs agent.",
            )

        return await self.create_agent(
            name=agent_name,
            voice_id=voice_id,
            prompt_text=prompt_text,
            language=language,
            llm=llm,
            temperature=temperature,
            max_tokens=max_tokens,
            post_call_webhook_id=post_call_webhook_id,
        )

    async def delete_agent(self, agent_id: str) -> None:
        if not agent_id:
            return
        try:
            async with httpx.AsyncClient(
                base_url=self._base_url, timeout=20.0
            ) as client:
                resp = await client.delete(
                    f"/convai/agents/{agent_id}",
                    headers=self._headers(),
                )
        except httpx.RequestError as exc:
            log.exception(
                "Network error deleting ElevenLabs agent %s: %s", agent_id, exc
            )
            raise HTTPException(status_code=502, detail="Upstream unavailable")

        if resp.status_code in (200, 204, 404):
            return

        log.error(
            "ElevenLabs agent delete failed agent_id=%s status=%s body=%s",
            agent_id,
            resp.status_code,
            resp.text[:1000],
        )
        raise HTTPException(
            status_code=resp.status_code, detail=resp.text or "Failed to delete agent"
        )
