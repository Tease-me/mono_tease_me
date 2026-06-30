"""Gateway for ElevenLabs conversation operations."""

from __future__ import annotations

import logging
from typing import Any

import httpx
from fastapi import HTTPException

from app.core.config import settings

log = logging.getLogger(__name__)


class ElevenLabsConversationGateway:
    def __init__(self) -> None:
        self._base_url = settings.ELEVEN_BASE_URL
        self._api_key = settings.ELEVENLABS_API_KEY

    def _headers(self) -> dict[str, str]:
        if not self._api_key:
            raise HTTPException(500, "ELEVENLABS_API_KEY is not configured.")
        return {"xi-api-key": self._api_key}

    async def get_conversation_token(self, agent_id: str) -> str:
        try:
            async with httpx.AsyncClient(
                base_url=self._base_url, timeout=15.0
            ) as client:
                resp = await client.get(
                    "/convai/conversation/token",
                    params={"agent_id": agent_id},
                    headers=self._headers(),
                )
        except httpx.RequestError as exc:
            log.warning(
                "conversation_token.network_error agent=%s type=%s err=%r",
                agent_id,
                type(exc).__name__,
                exc,
            )
            raise HTTPException(status_code=502, detail="Upstream unavailable")

        if resp.status_code >= 400:
            log.error(
                "conversation_token.failed agent=%s status=%s body=%s",
                agent_id,
                resp.status_code,
                resp.text[:500] if resp.text else "",
            )
            raise HTTPException(
                status_code=resp.status_code, detail="Failed to get conversation token"
            )

        token = (resp.json() or {}).get("token")
        if not token:
            raise HTTPException(
                status_code=502, detail="Token not returned by ElevenLabs"
            )
        return token

    async def get_conversation_signed_url(self, agent_id: str) -> str:
        try:
            async with httpx.AsyncClient(
                base_url=self._base_url, timeout=20.0
            ) as client:
                resp = await client.get(
                    "/convai/conversation/get-signed-url",
                    params={"agent_id": agent_id},
                    headers=self._headers(),
                )
        except httpx.RequestError as exc:
            log.warning(
                "conversation_signed_url.network_error agent=%s type=%s err=%r",
                agent_id,
                type(exc).__name__,
                exc,
            )
            raise HTTPException(status_code=502, detail="Upstream unavailable")

        if resp.status_code != 200:
            log.error(
                "ElevenLabs signed-url failed: %s %s", resp.status_code, resp.text[:500]
            )
            raise HTTPException(status_code=400, detail="Failed to get signed url")

        payload = resp.json() or {}
        signed_url = payload.get("signed_url")
        if not signed_url:
            raise HTTPException(
                status_code=502, detail="Signed URL not returned by ElevenLabs"
            )
        return signed_url

    async def get_conversation_snapshot(self, conversation_id: str) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient(
                base_url=self._base_url, timeout=20.0
            ) as client:
                resp = await client.get(
                    f"/convai/conversations/{conversation_id}",
                    headers=self._headers(),
                )
        except httpx.RequestError as exc:
            log.warning(
                "conversation_snapshot.network_error conversation_id=%s type=%s err=%r",
                conversation_id,
                type(exc).__name__,
                exc,
            )
            raise HTTPException(status_code=502, detail="Upstream unavailable")

        if resp.status_code == 404:
            raise HTTPException(404, "Conversation not found on ElevenLabs")
        if resp.status_code >= 400:
            log.error(
                "ElevenLabs GET conversation failed: %s %s",
                resp.status_code,
                resp.text[:500],
            )
            raise HTTPException(
                424, f"Failed to fetch conversation: {resp.status_code}"
            )
        return resp.json()

    async def end_conversation(self, conversation_id: str) -> int:
        try:
            async with httpx.AsyncClient(
                base_url=self._base_url, timeout=15.0
            ) as client:
                resp = await client.delete(
                    f"/convai/conversations/{conversation_id}",
                    headers=self._headers(),
                )
        except httpx.RequestError as exc:
            log.warning(
                "conversation_end.network_error conv=%s type=%s err=%r",
                conversation_id,
                type(exc).__name__,
                exc,
            )
            raise HTTPException(status_code=502, detail="Upstream unavailable")

        if resp.status_code >= 400:
            log.error(
                "conversation_end.failed conv=%s status=%s body=%s",
                conversation_id,
                resp.status_code,
                resp.text[:500] if resp.text else "",
            )
            raise HTTPException(
                status_code=resp.status_code,
                detail="Failed to end conversation",
            )

        return resp.status_code
