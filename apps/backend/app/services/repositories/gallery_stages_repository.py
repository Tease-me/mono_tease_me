"""Per-character gallery stages config for video generation and live scene matching."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.services.gateways import s3_gateway

log = logging.getLogger(__name__)

STAGE_COUNT = 5
CHARACTER_CONFIGS_DIR = (
    Path(__file__).resolve().parents[2] / "data" / "configs" / "gallery_stages"
)
LEGACY_INFLUENCER_CONFIG_FILENAME = "stages-config.json"


def parse_tags_from_scene_description(scene_description: str) -> list[str]:
    return [
        part.strip().lower()
        for part in scene_description.split(",")
        if part.strip()
    ]


def tags_to_scene_description(tags: list[str]) -> str:
    return ", ".join(tag.strip().lower() for tag in tags if tag.strip())


def normalize_stage_tags(raw_tags: Any, scene_description: str = "") -> list[str]:
    if isinstance(raw_tags, list):
        tags = [str(tag).strip().lower() for tag in raw_tags if str(tag).strip()]
        if tags:
            return tags
    normalized = (scene_description or "").strip()
    if normalized:
        return parse_tags_from_scene_description(normalized)
    return []


def build_character_stages_config_key(influencer_id: str, character_id: int) -> str:
    return (
        f"{settings.INFLUENCER_BUCKET_PREFIX}/"
        f"{influencer_id}/characters/{character_id}/gallery/stages-config.json"
    )


def build_legacy_influencer_stages_config_key(influencer_id: str) -> str:
    return (
        f"{settings.INFLUENCER_BUCKET_PREFIX}/"
        f"{influencer_id}/gallery/{LEGACY_INFLUENCER_CONFIG_FILENAME}"
    )


def _load_character_default_file(character_slug: str) -> dict[str, Any]:
    slug = (character_slug or "").strip().lower()
    slug_path = CHARACTER_CONFIGS_DIR / f"{slug}.json"
    if slug and slug_path.exists():
        return json.loads(slug_path.read_text(encoding="utf-8"))
    default_path = CHARACTER_CONFIGS_DIR / "default.json"
    return json.loads(default_path.read_text(encoding="utf-8"))


def _normalize_stage(raw: dict[str, Any], stage_index: int, defaults: dict[str, Any]) -> dict[str, Any]:
    default_stage = defaults["stages"][stage_index - 1]
    scene_description = str(
        raw.get("scene_description") or default_stage.get("scene_description") or ""
    ).strip()
    raw_tags = raw.get("tags")
    if raw_tags is None:
        raw_tags = default_stage.get("tags")
    tags = normalize_stage_tags(raw_tags, scene_description)
    if not scene_description and tags:
        scene_description = tags_to_scene_description(tags)
    return {
        "stage_index": stage_index,
        "title": str(raw.get("title") or default_stage.get("title") or f"Stage {stage_index}").strip(),
        "description": str(
            raw.get("description") or default_stage.get("description") or ""
        ).strip(),
        "scene_description": scene_description,
        "tags": tags,
        "video_prompt": str(
            raw.get("video_prompt") or default_stage.get("video_prompt") or ""
        ).strip(),
    }


def normalize_stages_config(
    payload: dict[str, Any] | None,
    *,
    character_slug: str = "default",
) -> dict[str, Any]:
    defaults_file = _load_character_default_file(character_slug)
    defaults = normalize_stages_config_from_defaults(defaults_file)
    incoming = {item["stage_index"]: item for item in (payload or {}).get("stages", [])}
    stages = [
        _normalize_stage(incoming.get(index, {}), index, defaults)
        for index in range(1, STAGE_COUNT + 1)
    ]
    source = payload.get("source") if payload else "character_default"
    return {
        "character_slug": character_slug,
        "stages": stages,
        "source": source or "character_default",
    }


def normalize_stages_config_from_defaults(defaults_file: dict[str, Any]) -> dict[str, Any]:
    incoming = {item["stage_index"]: item for item in defaults_file.get("stages", [])}
    base_stage = {
        "title": "",
        "description": "",
        "scene_description": "",
        "tags": [],
        "video_prompt": "",
    }
    stages = []
    for index in range(1, STAGE_COUNT + 1):
        raw = incoming.get(index, {})
        scene_description = str(raw.get("scene_description") or "").strip()
        tags = normalize_stage_tags(raw.get("tags"), scene_description)
        if not scene_description and tags:
            scene_description = tags_to_scene_description(tags)
        stages.append(
            {
                "stage_index": index,
                "title": str(raw.get("title") or f"Stage {index}").strip(),
                "description": str(raw.get("description") or "").strip(),
                "scene_description": scene_description,
                "tags": tags,
                "video_prompt": str(raw.get("video_prompt") or base_stage["video_prompt"]).strip(),
            }
        )
    return {"stages": stages}


def build_generation_prompt(stage: dict[str, Any]) -> str:
    video_prompt = stage.get("video_prompt", "").strip()
    if video_prompt:
        return video_prompt
    index = stage.get("stage_index", 1)
    return (
        f"Create a natural looping video variation for stage {index}. "
        "Subtle idle motion that repeats seamlessly."
    )


def get_character_default_stages_config(character_slug: str) -> dict[str, Any]:
    normalized = normalize_stages_config(None, character_slug=character_slug)
    normalized["source"] = "character_default"
    return normalized


def get_default_gallery_stages_config() -> dict[str, Any]:
    """Backward-compatible alias for generic default stages."""
    return get_character_default_stages_config("default")


async def _load_s3_config(key: str) -> dict[str, Any] | None:
    if not s3_gateway.object_exists(bucket=settings.BUCKET_NAME, key=key):
        return None
    try:
        raw_bytes = s3_gateway.get_object_bytes(bucket=settings.BUCKET_NAME, key=key)
        return json.loads(raw_bytes.decode("utf-8"))
    except Exception:
        log.exception("gallery_stages.load_failed key=%s", key)
        return None


async def get_gallery_stages_config(
    influencer_id: str,
    character_id: int,
    character_slug: str,
) -> dict[str, Any]:
    """Resolved stages: influencer+character override → character slug default file."""
    character_key = build_character_stages_config_key(influencer_id, character_id)
    payload = await _load_s3_config(character_key)
    if payload is not None:
        normalized = normalize_stages_config(payload, character_slug=character_slug)
        normalized["source"] = "override"
        return normalized

    legacy_key = build_legacy_influencer_stages_config_key(influencer_id)
    legacy_payload = await _load_s3_config(legacy_key)
    if legacy_payload is not None:
        normalized = normalize_stages_config(legacy_payload, character_slug=character_slug)
        normalized["source"] = "legacy_influencer"
        return normalized

    normalized = normalize_stages_config(None, character_slug=character_slug)
    normalized["source"] = "character_default"
    return normalized


async def save_gallery_stages_config(
    influencer_id: str,
    character_id: int,
    character_slug: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    normalized = normalize_stages_config(payload, character_slug=character_slug)
    normalized["source"] = "override"
    normalized["character_slug"] = character_slug
    key = build_character_stages_config_key(influencer_id, character_id)
    body = json.dumps(normalized, indent=2, ensure_ascii=False).encode("utf-8")
    s3_gateway.put_object(
        bucket=settings.BUCKET_NAME,
        key=key,
        body=body,
        content_type="application/json",
    )
    return normalized


def get_stage_from_config(config: dict[str, Any], stage_index: int) -> dict[str, Any]:
    for stage in config.get("stages", []):
        if stage.get("stage_index") == stage_index:
            return stage
    return normalize_stages_config(None, character_slug=config.get("character_slug", "default"))[
        "stages"
    ][stage_index - 1]


async def get_influencer_stages_config(influencer_id: str) -> dict[str, Any]:
    """Deprecated: kept for backward compatibility; returns generic default only."""
    return get_default_gallery_stages_config()


async def save_influencer_stages_config(
    influencer_id: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Deprecated: writes legacy influencer-level config."""
    normalized = normalize_stages_config(payload, character_slug="default")
    normalized["source"] = "legacy_influencer"
    key = build_legacy_influencer_stages_config_key(influencer_id)
    body = json.dumps(normalized, indent=2, ensure_ascii=False).encode("utf-8")
    s3_gateway.put_object(
        bucket=settings.BUCKET_NAME,
        key=key,
        body=body,
        content_type="application/json",
    )
    return normalized
