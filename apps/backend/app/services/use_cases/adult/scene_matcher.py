"""Match live conversation text to gallery stage videos."""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.models import CharacterStageVideo
from app.services.embeddings import get_embedding
from app.services.repositories.character_stage_video_repository import (
    find_best_scene_variant,
    get_first_available_scene_variant,
    resolve_scene_variant_for_stage,
)
from app.services.repositories.gallery_stages_repository import (
    get_gallery_stages_config,
    get_stage_from_config,
    normalize_stage_tags,
)

log = logging.getLogger(__name__)

SCENE_MATCH_MAX_DISTANCE = 0.65
KEYWORD_MIN_SCORE = 1
KEYWORD_STRONG_SCORE = 3
AGENT_KEYWORD_WEIGHT = 2
USER_KEYWORD_WEIGHT = 1


def _score_tags(text: str, tags: list[str]) -> int:
    text_lower = text.lower()
    score = 0
    for raw_tag in tags:
        tag = raw_tag.strip().lower()
        if not tag:
            continue
        if tag in text_lower:
            score += 1
            continue
        if len(tag) >= 4:
            for word in text_lower.split():
                if tag in word or word in tag:
                    score += 1
                    break
    return score


def _score_keywords(text: str, scene_description: str) -> int:
    return _score_tags(text, normalize_stage_tags(None, scene_description))


def _resolve_forward_stage(
    matched_stage: int,
    current_stage: int | None,
    *,
    match_score: int = 0,
) -> int | None:
    """Only advance stages forward so the visual narrative never rewinds."""
    if current_stage is None:
        return matched_stage
    if matched_stage <= current_stage:
        return None
    if match_score >= KEYWORD_STRONG_SCORE:
        return matched_stage
    return min(matched_stage, current_stage + 1)


def _build_match_text(
    *,
    agent_text: str = "",
    user_text: str = "",
    transcript: str = "",
) -> str:
    parts = [agent_text.strip(), user_text.strip(), transcript.strip()]
    return " ".join(part for part in parts if part).strip()


async def _get_stage_tag_catalog(
    db: AsyncSession,
    *,
    influencer_id: str,
    character_id: int,
    character_slug: str,
) -> list[tuple[int, list[str]]]:
    result = await db.execute(
        select(
            CharacterStageVideo.stage_index,
            CharacterStageVideo.tags,
            CharacterStageVideo.scene_description,
        )
        .where(
            CharacterStageVideo.influencer_id == influencer_id,
            CharacterStageVideo.character_id == character_id,
        )
        .order_by(
            CharacterStageVideo.stage_index.asc(),
            CharacterStageVideo.variant_index.asc(),
        )
    )
    catalog: dict[int, list[str]] = {}
    for stage_index, tags, scene_description in result.all():
        if stage_index in catalog:
            continue
        normalized_tags = tags or normalize_stage_tags(None, scene_description or "")
        if normalized_tags:
            catalog[stage_index] = normalized_tags

    if catalog:
        return sorted(catalog.items())

    stages_config = await get_gallery_stages_config(
        influencer_id, character_id, character_slug
    )
    return [
        (
            stage["stage_index"],
            normalize_stage_tags(
                stage.get("tags"),
                stage.get("scene_description", ""),
            ),
        )
        for stage in stages_config.get("stages", [])
        if stage.get("stage_index") is not None
        and normalize_stage_tags(stage.get("tags"), stage.get("scene_description", ""))
    ]


async def _match_stage_by_keywords(
    db: AsyncSession,
    *,
    influencer_id: str,
    character_id: int,
    character_slug: str,
    agent_text: str = "",
    user_text: str = "",
    transcript: str = "",
    current_stage_index: int | None = None,
    current_variant_index: int | None = None,
) -> dict | None:
    combined = _build_match_text(
        agent_text=agent_text,
        user_text=user_text,
        transcript=transcript,
    )
    if not combined:
        return None

    stage_catalog = await _get_stage_tag_catalog(
        db,
        influencer_id=influencer_id,
        character_id=character_id,
        character_slug=character_slug,
    )
    best_stage_index: int | None = None
    best_score = 0
    for stage_index, tags in stage_catalog:
        score = 0
        if agent_text.strip():
            score += _score_tags(agent_text, tags) * AGENT_KEYWORD_WEIGHT
        if user_text.strip():
            score += _score_tags(user_text, tags) * USER_KEYWORD_WEIGHT
        if not agent_text.strip() and not user_text.strip():
            score += _score_tags(combined, tags)

        if score > best_score or (
            score == best_score
            and score > 0
            and (best_stage_index is None or stage_index > best_stage_index)
        ):
            best_score = score
            best_stage_index = stage_index

    if best_stage_index is None or best_score < KEYWORD_MIN_SCORE:
        return None

    target_stage = _resolve_forward_stage(
        best_stage_index,
        current_stage_index,
        match_score=best_score,
    )
    if target_stage is None:
        return None

    exclude_variant = (
        current_variant_index if target_stage == current_stage_index else None
    )
    variant = await resolve_scene_variant_for_stage(
        db,
        influencer_id=influencer_id,
        character_id=character_id,
        stage_index=target_stage,
        min_stage_index=current_stage_index or 1,
        exclude_variant_index=exclude_variant,
    )
    if not variant:
        return None

    resolved_stage = variant["stage_index"]
    if current_stage_index is not None and resolved_stage <= current_stage_index:
        if (
            resolved_stage != current_stage_index
            or variant["variant_index"] == current_variant_index
        ):
            return None

    return {
        "stage_index": resolved_stage,
        "variant_index": variant["variant_index"],
        "distance": None,
        "match_method": "keyword",
        "keyword_score": best_score,
    }


async def build_scene_update_payload(
    db: AsyncSession,
    *,
    influencer_id: str,
    character_id: int,
    character_slug: str,
    stage_index: int,
    variant_index: int,
    match_distance: float | None = None,
    match_method: str | None = None,
) -> dict | None:
    variant = await get_first_available_scene_variant(
        db,
        influencer_id=influencer_id,
        character_id=character_id,
        stage_index=stage_index,
        variant_index=variant_index,
    )
    if not variant or not variant.get("video_mp4_url"):
        return None

    stages_config = await get_gallery_stages_config(
        influencer_id, character_id, character_slug
    )
    stage_config = get_stage_from_config(stages_config, stage_index)
    title = (variant.get("title") or stage_config.get("title") or f"Stage {stage_index}").strip()
    description = (
        variant.get("description") or stage_config.get("description") or ""
    ).strip()

    tags = variant.get("tags") or normalize_stage_tags(
        stage_config.get("tags"),
        stage_config.get("scene_description", ""),
    )
    stage_tag = variant.get("stage_tag") or (tags[0] if tags else None)

    payload: dict = {
        "type": "scene_update",
        "stage_index": stage_index,
        "variant_index": variant_index,
        "stage_tag": stage_tag,
        "tags": tags,
        "title": title,
        "description": description,
        "video_mp4_url": variant.get("video_mp4_url"),
        "video_webm_url": variant.get("video_webm_url"),
        "poster_url": variant.get("poster_url"),
    }
    if match_distance is not None:
        payload["match_distance"] = round(match_distance, 4)
    if match_method:
        payload["match_method"] = match_method
    return payload


async def get_initial_scene_update(
    db: AsyncSession,
    *,
    influencer_id: str,
    character_id: int,
    character_slug: str,
) -> dict | None:
    variant = await get_first_available_scene_variant(
        db,
        influencer_id=influencer_id,
        character_id=character_id,
        stage_index=1,
    )
    if not variant:
        variant = await get_first_available_scene_variant(
            db,
            influencer_id=influencer_id,
            character_id=character_id,
        )
    if not variant:
        return None
    return await build_scene_update_payload(
        db,
        influencer_id=influencer_id,
        character_id=character_id,
        character_slug=character_slug,
        stage_index=variant["stage_index"],
        variant_index=variant["variant_index"],
        match_method="initial",
    )


async def match_scene_from_transcript(
    db: AsyncSession,
    *,
    influencer_id: str,
    character_id: int,
    character_slug: str,
    transcript: str = "",
    agent_text: str = "",
    user_text: str = "",
    current_stage_index: int | None = None,
    current_variant_index: int | None = None,
) -> dict | None:
    combined = _build_match_text(
        agent_text=agent_text,
        user_text=user_text,
        transcript=transcript,
    )
    if len(combined) < 3:
        return None

    keyword_match = await _match_stage_by_keywords(
        db,
        influencer_id=influencer_id,
        character_id=character_id,
        character_slug=character_slug,
        agent_text=agent_text,
        user_text=user_text,
        transcript=transcript,
        current_stage_index=current_stage_index,
        current_variant_index=current_variant_index,
    )
    if keyword_match:
        stage_index = keyword_match["stage_index"]
        variant_index = keyword_match["variant_index"]
        if (
            stage_index != current_stage_index
            or variant_index != current_variant_index
        ):
            return await build_scene_update_payload(
                db,
                influencer_id=influencer_id,
                character_id=character_id,
                character_slug=character_slug,
                stage_index=stage_index,
                variant_index=variant_index,
                match_method="keyword",
            )

    embedding_source = agent_text.strip() or combined
    if len(embedding_source) < 8:
        return None

    try:
        query_embedding = await get_embedding(embedding_source)
    except Exception:
        log.debug(
            "scene_matcher.embedding_skipped influencer=%s character=%s",
            influencer_id,
            character_id,
            exc_info=True,
        )
        return None

    match = await find_best_scene_variant(
        db,
        influencer_id=influencer_id,
        character_id=character_id,
        query_embedding=query_embedding,
        max_distance=SCENE_MATCH_MAX_DISTANCE,
    )
    if not match:
        return None

    stage_index = _resolve_forward_stage(
        match["stage_index"],
        current_stage_index,
        match_score=0,
    )
    if stage_index is None:
        return None

    exclude_variant = (
        current_variant_index if stage_index == current_stage_index else None
    )
    variant = await resolve_scene_variant_for_stage(
        db,
        influencer_id=influencer_id,
        character_id=character_id,
        stage_index=stage_index,
        min_stage_index=current_stage_index or 1,
        exclude_variant_index=exclude_variant,
    )
    if not variant:
        return None

    stage_index = variant["stage_index"]
    variant_index = variant["variant_index"]
    if (
        stage_index == current_stage_index
        and variant_index == current_variant_index
    ):
        return None

    return await build_scene_update_payload(
        db,
        influencer_id=influencer_id,
        character_id=character_id,
        character_slug=character_slug,
        stage_index=stage_index,
        variant_index=variant_index,
        match_distance=match.get("distance"),
        match_method="embedding",
    )
