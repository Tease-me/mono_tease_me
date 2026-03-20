"""Gateway for ElevenLabs knowledge base document and agent KB updates."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

from app.core.config import settings
from app.errors.knowledge_errors import KnowledgeSyncError

log = logging.getLogger(__name__)


def _get_nested(data: dict[str, Any], paths: list[tuple[str, ...]], default: Any = None) -> Any:
    for path in paths:
        cursor: Any = data
        ok = True
        for key in path:
            if isinstance(cursor, dict) and key in cursor:
                cursor = cursor[key]
            else:
                ok = False
                break
        if ok:
            return cursor
    return default


class ElevenLabsKnowledgeGateway:
    def __init__(self) -> None:
        if not settings.ELEVENLABS_API_KEY:
            raise KnowledgeSyncError("ELEVENLABS_API_KEY is not configured")
        self._base_url = settings.ELEVEN_BASE_URL
        self._api_key = settings.ELEVENLABS_API_KEY

    def _headers(self) -> dict[str, str]:
        return {"xi-api-key": self._api_key}

    async def _request(self, method: str, path: str, **kwargs) -> httpx.Response:
        try:
            async with httpx.AsyncClient(base_url=self._base_url, timeout=30.0) as client:
                resp = await client.request(method, path, headers=self._headers(), **kwargs)
        except httpx.RequestError as exc:
            raise KnowledgeSyncError(f"ElevenLabs network error: {exc}") from exc
        if resp.status_code >= 400:
            raise KnowledgeSyncError(
                f"ElevenLabs request failed method={method} path={path} status={resp.status_code} body={resp.text[:300]}"
            )
        return resp

    async def create_text_document(self, *, text_value: str, name: str) -> dict[str, str]:
        primary_path = "/convai/knowledge-base/text"
        legacy_path = "/convai/knowledge-base/documents/text"
        payload = {"text": text_value, "name": name}

        try:
            resp = await self._request("POST", primary_path, json=payload)
        except KnowledgeSyncError as exc:
            msg = str(exc)
            if f"path={primary_path}" not in msg or "status=404" not in msg:
                raise
            log.warning(
                "knowledge_sync.create_text_document_fallback path=%s fallback=%s",
                primary_path,
                legacy_path,
            )
            resp = await self._request("POST", legacy_path, json=payload)

        payload = resp.json() if resp.content else {}
        doc_id = payload.get("id") or payload.get("document_id")
        if not doc_id:
            raise KnowledgeSyncError("ElevenLabs document creation returned no id")
        return {"id": str(doc_id), "name": str(payload.get("name") or name), "type": "text"}

    async def delete_document(self, document_id: str) -> None:
        primary_path = f"/convai/knowledge-base/{document_id}"
        legacy_path = f"/convai/knowledge-base/documents/{document_id}"

        try:
            await self._request("DELETE", primary_path, params={"force": "true"})
            return
        except KnowledgeSyncError as exc:
            msg = str(exc)
            if f"path={primary_path}" not in msg or "status=404" not in msg:
                raise
            log.warning(
                "knowledge_sync.delete_document_fallback path=%s fallback=%s",
                primary_path,
                legacy_path,
            )
            await self._request("DELETE", legacy_path)

    async def get_agent_knowledge_base(self, agent_id: str) -> list[dict[str, Any]]:
        agent = await self.get_agent(agent_id)
        return agent["knowledge_base"]

    async def get_agent(self, agent_id: str, *, branch_id: str | None = None) -> dict[str, Any]:
        params = {"branch_id": branch_id} if branch_id else None
        resp = await self._request("GET", f"/convai/agents/{agent_id}", params=params)
        payload = resp.json() if resp.content else {}
        kb = _get_nested(
            payload,
            [("conversation_config", "agent", "prompt", "knowledge_base")],
            default=[],
        )
        knowledge_base = kb if isinstance(kb, list) else []
        return {
            "knowledge_base": knowledge_base,
            "branch_id": payload.get("branch_id"),
            "main_branch_id": payload.get("main_branch_id"),
        }

    def _normalize_kb_items(self, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        normalized: list[dict[str, Any]] = []
        for item in items:
            payload_item = dict(item)
            payload_item.setdefault("usage_mode", "auto")
            normalized.append(payload_item)
        return normalized

    async def _resolve_branch_id(
        self,
        *,
        agent_id: str,
        explicit_branch_id: str | None,
        fetched_branch_id: str | None = None,
    ) -> str | None:
        if explicit_branch_id:
            return explicit_branch_id
        if settings.ELEVENLABS_AGENT_BRANCH_ID:
            return settings.ELEVENLABS_AGENT_BRANCH_ID
        if fetched_branch_id:
            return fetched_branch_id
        agent = await self.get_agent(agent_id)
        return agent.get("branch_id")

    async def _verify_doc_membership(
        self,
        *,
        agent_id: str,
        verify_doc_id: str,
        expected_present: bool,
        branch_id: str | None,
    ) -> bool:
        for attempt in range(2):
            if attempt == 1:
                await asyncio.sleep(0.4)
            agent = await self.get_agent(agent_id, branch_id=branch_id)
            item_ids = {
                str(item.get("id") or item.get("document_id"))
                for item in agent["knowledge_base"]
                if item.get("id") or item.get("document_id")
            }
            present = verify_doc_id in item_ids
            if present == expected_present:
                return True
        return False

    async def set_agent_knowledge_base(
        self,
        agent_id: str,
        items: list[dict[str, Any]],
        *,
        branch_id: str | None = None,
        fetched_branch_id: str | None = None,
        verify_doc_id: str | None = None,
        expect_present: bool | None = None,
    ) -> str | None:
        resolved_branch_id = await self._resolve_branch_id(
            agent_id=agent_id,
            explicit_branch_id=branch_id,
            fetched_branch_id=fetched_branch_id,
        )
        params = {"branch_id": resolved_branch_id} if resolved_branch_id else None
        try:
            await self._request(
                "PATCH",
                f"/convai/agents/{agent_id}",
                params=params,
                json={
                    "conversation_config": {
                        "agent": {
                            "prompt": {
                                "knowledge_base": self._normalize_kb_items(items),
                            }
                        }
                    }
                },
            )
        except KnowledgeSyncError as exc:
            raise KnowledgeSyncError(
                f"Failed to patch agent knowledge base agent_id={agent_id} branch_id={resolved_branch_id}: {exc}"
            ) from exc

        if verify_doc_id is not None and expect_present is not None:
            verified = await self._verify_doc_membership(
                agent_id=agent_id,
                verify_doc_id=verify_doc_id,
                expected_present=expect_present,
                branch_id=resolved_branch_id,
            )
            if not verified:
                if expect_present:
                    reason = "verification mismatch: document not attached after patch (possible branch mismatch)"
                else:
                    reason = "verification mismatch: document still attached after patch (possible branch mismatch)"
                raise KnowledgeSyncError(
                    f"{reason} agent_id={agent_id} branch_id={resolved_branch_id} doc_id={verify_doc_id}"
                )

        return resolved_branch_id

    async def safe_delete_document(self, document_id: str | None) -> None:
        if not document_id:
            return
        try:
            await self.delete_document(document_id)
        except Exception as exc:
            log.warning("knowledge_sync.delete_document_failed doc_id=%s err=%s", document_id, exc)
