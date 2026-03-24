from __future__ import annotations

from dataclasses import dataclass, field

from app.data.models import Influencer


@dataclass(slots=True)
class InfluencerBioContext:
    likes: list[str] = field(default_factory=list)
    dislikes: list[str] = field(default_factory=list)
    stages: dict[str, str] = field(default_factory=dict)
    personality_rules: str = ""
    tone: str = ""
    mbti_archetype: str = ""
    mbti_rules_addon: str = ""


def _normalize_list(raw_value: object) -> list[str]:
    if not isinstance(raw_value, list):
        return []
    return [item.strip() for item in raw_value if isinstance(item, str) and item.strip()]


def _normalize_text(raw_value: object) -> str:
    if isinstance(raw_value, str):
        return raw_value.strip()
    return ""


def _normalize_stages(raw_value: object) -> dict[str, str]:
    if not isinstance(raw_value, dict):
        return {}

    normalized: dict[str, str] = {}
    for key, value in raw_value.items():
        key_text = str(key).strip().upper()
        if not key_text:
            continue
        if not isinstance(value, str):
            continue
        value_text = value.strip()
        if not value_text:
            continue
        normalized[key_text] = value_text
    return normalized


def extract_influencer_bio_context(influencer: Influencer) -> InfluencerBioContext:
    bio = influencer.bio_json if isinstance(influencer.bio_json, dict) else {}
    return InfluencerBioContext(
        likes=_normalize_list(bio.get("likes")),
        dislikes=_normalize_list(bio.get("dislikes")),
        stages=_normalize_stages(bio.get("stages")),
        personality_rules=_normalize_text(bio.get("personality_rules")),
        tone=_normalize_text(bio.get("tone")),
        mbti_archetype=_normalize_text(bio.get("mbti_architype")),
        mbti_rules_addon=_normalize_text(bio.get("mbti_rules")),
    )
