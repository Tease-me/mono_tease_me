import json
from datetime import date, datetime
import random
from typing import Any, Optional

from app.constants import prompt_keys
from app.services.prompting.influencer_bio import InfluencerBioContext
from langchain_core.prompts import (
    ChatPromptTemplate,
)
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import Influencer
from fastapi import Depends, HTTPException
from app.db.session import get_db
from app.services.system_prompt_service import get_system_prompt
from app.utils.time import (
    check_is_weekend,
    format_timezone_location,
    resolve_timezone,
)

import logging
log = logging.getLogger(__name__)

def _default_time_vibe_ranges() -> list[dict[str, Any]]:
    return [
        {
            "start_hour": 0,
            "end_hour": 5,
            "vibes": [
                "late night hours",
                "deep night, most people asleep",
                "quiet hours",
                "very late, winding down",
                "after-hours calm",
            ],
        },
        {
            "start_hour": 6,
            "end_hour": 8,
            "vibes": [
                "early morning, just waking up",
                "morning starting",
                "beginning of the day",
                "fresh morning energy",
                "sunrise hours",
            ],
        },
        {
            "start_hour": 9,
            "end_hour": 11,
            "vibes": [
                "mid-morning",
                "morning in full swing",
                "active morning hours",
                "getting things done",
                "busy morning time",
            ],
        },
        {
            "start_hour": 12,
            "end_hour": 14,
            "vibes": [
                "midday",
                "afternoon starting",
                "middle of the day",
                "lunch time hours",
                "afternoon energy",
            ],
        },
        {
            "start_hour": 15,
            "end_hour": 17,
            "vibes": [
                "late afternoon",
                "afternoon winding down",
                "transitioning to evening",
                "end of afternoon",
                "golden hour time",
            ],
        },
        {
            "start_hour": 18,
            "end_hour": 20,
            "vibes": [
                "evening",
                "night beginning",
                "relaxed evening hours",
                "dinner time vibe",
                "early night",
            ],
        },
        {
            "start_hour": 21,
            "end_hour": 23,
            "vibes": [
                "night time",
                "late evening hours",
                "late night vibe",
                "nighttime energy",
                "after dark",
            ],
        },
    ]


def _validate_and_normalize_time_vibe_config(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, dict):
        raise ValueError("config must be an object")

    ranges = raw.get("ranges")
    if not isinstance(ranges, list) or not ranges:
        raise ValueError("ranges must be a non-empty list")

    normalized: list[dict[str, Any]] = []
    covered_hours: set[int] = set()

    for idx, item in enumerate(ranges):
        if not isinstance(item, dict):
            raise ValueError(f"ranges[{idx}] must be an object")

        start = item.get("start_hour")
        end = item.get("end_hour")
        vibes = item.get("vibes")

        if not isinstance(start, int) or not isinstance(end, int):
            raise ValueError(f"ranges[{idx}] start_hour/end_hour must be integers")
        if start < 0 or start > 23 or end < 0 or end > 23:
            raise ValueError(f"ranges[{idx}] hour values must be between 0 and 23")
        if start > end:
            raise ValueError(f"ranges[{idx}] start_hour must be <= end_hour")
        if not isinstance(vibes, list) or not vibes:
            raise ValueError(f"ranges[{idx}] vibes must be a non-empty list")

        cleaned_vibes = [str(v).strip() for v in vibes if str(v).strip()]
        if not cleaned_vibes:
            raise ValueError(f"ranges[{idx}] vibes must contain non-empty strings")

        for hour in range(start, end + 1):
            if hour in covered_hours:
                raise ValueError(f"hour overlap detected at {hour}")
            covered_hours.add(hour)

        normalized.append(
            {"start_hour": start, "end_hour": end, "vibes": cleaned_vibes}
        )

    missing = [h for h in range(24) if h not in covered_hours]
    if missing:
        raise ValueError(f"hours not covered: {missing}")

    return normalized


def _pick_vibes_for_hour(hour: int, ranges: list[dict[str, Any]]) -> list[str]:
    for item in ranges:
        if item["start_hour"] <= hour <= item["end_hour"]:
            return item["vibes"]
    return _default_time_vibe_ranges()[-1]["vibes"]


async def get_time_context(db: AsyncSession, user_timezone: str | None) -> str:
    """
    Generate simple time context for AI to naturally incorporate.
    Returns a concise time description instead of pre-written mood scripts.
    """
    tz = resolve_timezone(user_timezone)
    now = datetime.now(tz)
    
    hour = now.hour
    day_name = now.strftime("%A")
    is_weekend = check_is_weekend(user_timezone)
    
    vibe_ranges = _default_time_vibe_ranges()
    cfg = await get_system_prompt(db, prompt_keys.TIME_VIBE_CONFIG_JSON)
    if cfg:
        try:
            parsed = json.loads(cfg)
            vibe_ranges = _validate_and_normalize_time_vibe_config(parsed)
        except Exception as exc:
            log.warning("Invalid TIME_VIBE_CONFIG_JSON, falling back to defaults: %s", exc)

    vibes = _pick_vibes_for_hour(hour, vibe_ranges)
    
    weekend_type = "weekend" if is_weekend else "weekday"
    selected_vibe = random.choice(vibes)
    location = format_timezone_location(user_timezone)
    
    return (
        f"{now.strftime('%I:%M %p')}, {day_name} {now.strftime('%d %B %Y')} "
        f"in {location} ({weekend_type}) - {selected_vibe}"
    )

 

_mbti_cache: Optional[dict] = None
_stage_prompts_cache: Optional[dict] = None


async def get_relationship_stage_prompts(db: AsyncSession) -> dict:
    """
    Fetches relationship stage prompts from the database and returns them as a dict.
    The prompts are cached after the first fetch.
    Returns a dict mapping relationship state (uppercase) to prompt string.
    """
    global _stage_prompts_cache
    
    if _stage_prompts_cache is not None:
        return _stage_prompts_cache
    
    stage_json_str = await get_system_prompt(db, prompt_keys.RELATIONSHIP_STAGE_PROMPTS)
    if stage_json_str:
        try:
            raw = json.loads(stage_json_str)
            _stage_prompts_cache = {}
            for key, value in raw.items():
                if isinstance(value, list):
                    _stage_prompts_cache[key.upper()] = "\n".join(str(v) for v in value)
                else:
                    _stage_prompts_cache[key.upper()] = str(value)
        except json.JSONDecodeError as exc:
            log.warning("Failed to parse RELATIONSHIP_STAGE_PROMPTS: %s", exc)
            _stage_prompts_cache = {}
    else:
        log.warning("RELATIONSHIP_STAGE_PROMPTS system prompt not found")
        _stage_prompts_cache = {}
    
    return _stage_prompts_cache


async def get_mbti_rules_for_archetype(
    db: AsyncSession,
    mbti_archetype: str,
    mbti_addon: str = "",
) -> str:
    global _mbti_cache
    
    if not mbti_archetype:
        return mbti_addon.strip() if mbti_addon else ""
    
    if _mbti_cache is None:
        mbti_json_str = await get_system_prompt(db, "MBTI_JSON")
        if mbti_json_str:
            try:
                _mbti_cache = json.loads(mbti_json_str)
            except json.JSONDecodeError as exc:
                log.warning("Failed to parse MBTI_JSON: %s", exc)
                _mbti_cache = {}
        else:
            log.warning("MBTI_JSON system prompt not found")
            _mbti_cache = {}
    
    base_rules = ""
    personalities = _mbti_cache.get("personalities", [])
    archetype_upper = mbti_archetype.strip().upper()
    
    for personality in personalities:
        if personality.get("code", "").upper() == archetype_upper:
            name = personality.get("name", "")
            rules_list = personality.get("rules", [])
            if rules_list:
                rules_str = "\n".join(f"- {rule}" for rule in rules_list)
                base_rules = f"**{archetype_upper} - {name}**\n{rules_str}"
            break
    
    parts = []
    if base_rules:
        parts.append(base_rules)
    if mbti_addon and mbti_addon.strip():
        parts.append(f"\n**Additional personality notes:**\n{mbti_addon.strip()}")
    
    return "\n".join(parts)

async def get_base_system(db: AsyncSession, is_audio: bool) -> str:
    base = await get_system_prompt(db, prompt_keys.BASE_SYSTEM)
    if is_audio:
        audio_base = await get_system_prompt(db, prompt_keys.BASE_AUDIO_SYSTEM)
        base += "\n" + audio_base
    return base

async def get_global_prompt(
    db: AsyncSession,
    is_audio: bool = False,
) -> ChatPromptTemplate:
    system_prompt = await get_base_system(db, is_audio=is_audio)

    return ChatPromptTemplate.from_messages(
        [
            ("system", system_prompt),
            ("user", "{input}"),
        ]
    )


def build_relationship_prompt(
    prompt_template: ChatPromptTemplate,
    rel,
    days_idle: float,
    dtr_goal: str,
    personality_rules: str = "",
    stages: dict | None = None,
    persona_likes: list[str] | None = None,
    persona_dislikes: list[str] | None = None,
    mbti_rules: str = "",
    memories: str = "",
    ai_memories: str = "",
    knowledge_context: str = "",
    daily_context: str = "",
    last_user_message: str = "",
    tone: str = "",
    mood: str = "",
    analysis: str | None = None,
    influencer_name: str = "",
    users_name: str = "",
    influencer_stages: InfluencerBioContext | None = None,
):
    stages = stages or {}
    rel_state = (getattr(rel, "state", "") or "").strip().upper()
    stage_prompt = ""
    influencer_stage_prompt = ""

    if stages:
        # Try uppercase key first (DB format), then lowercase (bio_json format)
        stage_prompt = stages.get(rel_state, "") or stages.get(rel_state.lower(), "")
        
    if influencer_stages:
        influencer_stage_prompt = influencer_stages.get(rel_state, "") or influencer_stages.get(rel_state.lower(), "")

    partial_vars = {
        "relationship_state": rel.state,
        "influencer_name": influencer_name,
        "users_name": users_name,
        "stage_prompt": stage_prompt,
        "influencer_stage_prompt": influencer_stage_prompt,
        "trust": int(rel.trust or 0),
        "closeness": int(rel.closeness or 0),
        "attraction": int(rel.attraction or 0),
        "safety": int(rel.safety or 0),
        "exclusive_agreed": bool(rel.exclusive_agreed),
        "girlfriend_confirmed": bool(rel.girlfriend_confirmed),
        "days_idle_before_message": round(float(days_idle or 0.0), 1),
        "dtr_goal": dtr_goal,
        "personality_rules": personality_rules,
        "likes": ", ".join(map(str, persona_likes or [])),
        "dislikes": ", ".join(map(str, persona_dislikes or [])),
        "mbti_rules": mbti_rules,
        "memories": memories,
        "ai_memories": ai_memories,
        "knowledge_context": knowledge_context,
        "daily_context": daily_context,
        "last_user_message": last_user_message,
        "tone": tone,
        "mood": mood,
    }
    
    if analysis is not None:
        partial_vars["analysis"] = analysis

    expected = set(getattr(prompt_template, "input_variables", []) or [])
    filtered = {k: v for k, v in partial_vars.items() if k in expected}
    return prompt_template.partial(**filtered)

async def get_today_script(
    db: AsyncSession = Depends(get_db),
    influencer_id: str = None
) -> str:
    if not influencer_id:
        raise HTTPException(400, "influencer_id is required")
    influencer = await db.get(Influencer, influencer_id)
    scripts = influencer.daily_scripts if influencer and influencer.daily_scripts else []
    if not scripts:
        return ""
    idx = date.today().timetuple().tm_yday % len(scripts)
    frase = scripts[idx]
    return frase
