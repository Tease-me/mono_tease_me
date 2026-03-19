"""Redis-backed cache helpers for asset presence and signed URLs."""

from __future__ import annotations

import json
import logging
from typing import Any

from app.core.config import settings
from app.utils.infrastructure.redis_pool import get_redis

log = logging.getLogger(__name__)


def _presence_key(namespace: str, identifier: str) -> str:
    return f"asset_presence:{namespace}:{identifier}"


def _url_key(key: str) -> str:
    return f"asset_url:{key}"


async def get_cached_presence(namespace: str, identifier: str) -> dict[str, Any] | None:
    try:
        redis = await get_redis()
        cached = await redis.get(_presence_key(namespace, identifier))
        return json.loads(cached) if cached else None
    except Exception as exc:
        log.warning("asset_presence_cache_read_failed namespace=%s identifier=%s err=%s", namespace, identifier, exc)
        return None


async def set_cached_presence(namespace: str, identifier: str, value: dict[str, Any]) -> None:
    try:
        redis = await get_redis()
        await redis.setex(
            _presence_key(namespace, identifier),
            settings.ASSET_PRESENCE_CACHE_TTL_SECONDS,
            json.dumps(value),
        )
    except Exception as exc:
        log.warning("asset_presence_cache_write_failed namespace=%s identifier=%s err=%s", namespace, identifier, exc)


async def invalidate_presence(namespace: str, identifier: str) -> None:
    try:
        redis = await get_redis()
        await redis.delete(_presence_key(namespace, identifier))
    except Exception as exc:
        log.warning("asset_presence_cache_delete_failed namespace=%s identifier=%s err=%s", namespace, identifier, exc)


async def get_cached_presigned_url(key: str) -> str | None:
    try:
        redis = await get_redis()
        return await redis.get(_url_key(key))
    except Exception as exc:
        log.warning("asset_url_cache_read_failed key=%s err=%s", key, exc)
        return None


async def set_cached_presigned_url(key: str, url: str) -> None:
    try:
        redis = await get_redis()
        ttl = min(
            settings.ASSET_URL_CACHE_TTL_SECONDS,
            max(settings.S3_PRESIGNED_URL_TTL_SECONDS - 60, 1),
        )
        await redis.setex(_url_key(key), ttl, url)
    except Exception as exc:
        log.warning("asset_url_cache_write_failed key=%s err=%s", key, exc)


async def invalidate_presigned_url(key: str) -> None:
    try:
        redis = await get_redis()
        await redis.delete(_url_key(key))
    except Exception as exc:
        log.warning("asset_url_cache_delete_failed key=%s err=%s", key, exc)


async def invalidate_presigned_urls(keys: list[str]) -> None:
    for key in keys:
        await invalidate_presigned_url(key)
