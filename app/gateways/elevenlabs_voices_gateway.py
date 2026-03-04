"""Gateway for ElevenLabs voice operations."""

from __future__ import annotations

import json
import logging

import httpx
from fastapi import HTTPException

from app.core.config import settings
from app.gateways.elevenlabs_naming import apply_environment_label

log = logging.getLogger(__name__)


class ElevenLabsVoicesGateway:
    def __init__(self) -> None:
        self._base_url = settings.ELEVEN_BASE_URL
        self._api_key = settings.ELEVENLABS_API_KEY

    def _headers(self) -> dict[str, str]:
        if not self._api_key:
            raise HTTPException(500, "ELEVENLABS_API_KEY is not configured.")
        return {"xi-api-key": self._api_key}

    @staticmethod
    def parse_labels(labels_json: str | None) -> str | None:
        if not labels_json:
            return None
        try:
            obj = json.loads(labels_json)
            if not isinstance(obj, dict):
                raise ValueError("labels_json must be a JSON object")
            return json.dumps(obj)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Invalid labels_json: {exc}")

    async def create_voice(
        self,
        *,
        name: str,
        description: str | None,
        labels_str: str | None,
        remove_background_noise: bool,
        multipart_files: list[tuple[str, tuple[str, bytes, str]]],
    ) -> dict:
        data = {
            "name": apply_environment_label(name),
            "remove_background_noise": "true" if remove_background_noise else "false",
        }
        if description is not None:
            data["description"] = description
        if labels_str is not None:
            data["labels"] = labels_str

        try:
            async with httpx.AsyncClient(base_url=self._base_url, timeout=60.0) as client:
                resp = await client.post(
                    "/voices/add",
                    headers=self._headers(),
                    data=data,
                    files=multipart_files,
                )
        except httpx.RequestError as exc:
            log.exception("Network error creating ElevenLabs voice: %s", exc)
            raise HTTPException(status_code=502, detail="Upstream unavailable")

        if resp.status_code >= 400:
            log.error("ElevenLabs /v1/voices/add failed: %s %s", resp.status_code, resp.text[:1500])
            raise HTTPException(status_code=resp.status_code, detail=resp.text)

        payload = resp.json() or {}
        if not payload.get("voice_id"):
            raise HTTPException(status_code=502, detail="ElevenLabs returned no voice_id")
        return payload

    async def voice_exists(self, voice_id: str) -> bool:
        if not voice_id:
            return False

        log.info("Validating voice_id: %s", voice_id)
        try:
            async with httpx.AsyncClient(base_url=self._base_url, timeout=15.0) as client:
                resp = await client.get(
                    f"/voices/{voice_id}",
                    headers=self._headers(),
                )
        except Exception as exc:
            log.warning("Voice validation error for %s: %s", voice_id, exc)
            return False

        log.info("Voice validation response: %s", resp.status_code)
        if resp.status_code == 200:
            return True
        if resp.status_code == 404:
            log.warning("Voice %s not found in ElevenLabs", voice_id)
            return False

        log.warning("Voice validation returned %s: %s", resp.status_code, resp.text[:200])
        return False

    async def delete_voice(self, voice_id: str) -> None:
        if not voice_id:
            return
        try:
            async with httpx.AsyncClient(base_url=self._base_url, timeout=20.0) as client:
                resp = await client.delete(
                    f"/voices/{voice_id}",
                    headers=self._headers(),
                )
        except httpx.RequestError as exc:
            log.exception("Network error deleting ElevenLabs voice %s: %s", voice_id, exc)
            raise HTTPException(status_code=502, detail="Upstream unavailable")

        if resp.status_code in (200, 204, 404):
            return

        log.error(
            "ElevenLabs voice delete failed voice_id=%s status=%s body=%s",
            voice_id,
            resp.status_code,
            resp.text[:1000],
        )
        raise HTTPException(status_code=resp.status_code, detail=resp.text or "Failed to delete voice")
