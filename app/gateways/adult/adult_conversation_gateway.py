import logging

import httpx
from fastapi import HTTPException

from app.core.config import settings

log = logging.getLogger(__name__)


class ElevenLabsAdultConversationGateway:
    def __init__(self) -> None:
        self._base_url = settings.ELEVEN_BASE_URL
        self._api_key = settings.ELEVENLABS_API_KEY

    def _headers(self) -> dict[str, str]:
        if not self._api_key:
            raise HTTPException(500, "ELEVENLABS_API_KEY is not configured.")
        return {"xi-api-key": self._api_key}

    async def get_conversation_token(self, agent_id: str) -> str:
        try:
            async with httpx.AsyncClient(base_url=self._base_url, timeout=15.0) as client:
                resp = await client.get(
                    "/convai/conversation/token",
                    params={"agent_id": agent_id},
                    headers=self._headers(),
                )
        except httpx.RequestError as exc:
            log.exception("adult_conversation_token.network_error agent=%s err=%s", agent_id, exc)
            raise HTTPException(status_code=502, detail="Upstream unavailable")

        if resp.status_code >= 400:
            log.error(
                "adult_conversation_token.failed agent=%s status=%s body=%s",
                agent_id,
                resp.status_code,
                resp.text[:500] if resp.text else "",
            )
            raise HTTPException(status_code=resp.status_code, detail="Failed to get conversation token")

        token = (resp.json() or {}).get("token")
        if not token:
            raise HTTPException(status_code=502, detail="Token not returned by ElevenLabs")
        return token
