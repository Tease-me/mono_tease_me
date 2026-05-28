"""Survey markdown + prompt generation use case for pre-influencer onboarding."""

from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.prompts import SURVEY_SUMMARIZER
from app.data.enums import prompt_keys
from app.services.system_prompt_service import get_system_prompt
from app.services.token_tracker import track_usage_bg

log = logging.getLogger(__name__)
_APP_DIR = Path(__file__).resolve().parents[2]
_REPO_ROOT = Path(__file__).resolve().parents[3]
_SURVEY_QUESTIONS_CANDIDATE_PATHS = (
    _APP_DIR / "data" / "configs" / "survey_questions.json",
    _REPO_ROOT / "docs" / "onboarding-survey.json",
)


def format_survey_markdown(
    sections: list[dict[str, Any]],
    answers: dict[str, Any],
    username: str | None = None,
) -> str:
    lines = []
    if username:
        lines.append(f"# {username}'s Survey")
        lines.append("")

    def _format_answer(question: dict[str, Any], value: Any) -> str:
        options = question.get("options") or []
        label_map = {
            str(opt.get("value")): opt.get("label", opt.get("value"))
            for opt in options
            if isinstance(opt, dict)
        }
        if isinstance(value, list):
            mapped = [str(label_map.get(str(v), v)) for v in value]
            return ", ".join(mapped)
        return str(label_map.get(str(value), value))

    for section in sections:
        lines.append(f"## {section.get('title', section.get('id', ''))}")
        for q in section.get("questions", []):
            qid = q.get("id")
            label = q.get("label", qid)
            val = answers.get(qid) if isinstance(answers, dict) else None
            if val is None or val == "":
                ans_text = "_Not answered_"
            elif isinstance(val, list):
                ans_text = _format_answer(q, val)
            elif isinstance(val, dict):
                ans_text = json.dumps(val, ensure_ascii=False)
            else:
                ans_text = _format_answer(q, val)
            lines.append(f"- **{label}**: {ans_text}")
        lines.append("")
    return "\n".join(lines).strip() + "\n"


def _unwrap_json(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
        if text.endswith("```"):
            text = text.rsplit("```", 1)[0]
    return text.strip()


async def generate_prompt_from_markdown(
    markdown: str,
    additional_prompt: str | None,
    db: AsyncSession,
) -> dict[str, Any]:
    sys_msg = await get_system_prompt(db, prompt_keys.SURVEY_PROMPT_JSON_SCHEMA)
    if not sys_msg:
        raise HTTPException(500, "Missing system prompt: SURVEY_PROMPT_JSON_SCHEMA")
    user_msg = (
        f"Survey markdown:\n{markdown}\n\n"
        f"Extra instructions for style/tone:\n{additional_prompt or '(none)'}"
    )

    try:
        t0 = time.perf_counter()
        resp = await SURVEY_SUMMARIZER.ainvoke(
            [
                {"role": "system", "content": sys_msg},
                {"role": "user", "content": user_msg},
            ]
        )
        survey_ms = int((time.perf_counter() - t0) * 1000)

        usage = getattr(resp, "usage_metadata", None) or {}
        model_name = getattr(resp, "response_metadata", {}).get("model_name", "gpt-4o")
        provider = "alibaba" if "qwen" in model_name.lower() else "openai"
        track_usage_bg(
            "analysis",
            provider,
            model_name,
            "survey_summarization",
            input_tokens=usage.get("input_tokens"),
            output_tokens=usage.get("output_tokens"),
            total_tokens=usage.get("total_tokens"),
            latency_ms=survey_ms,
        )

        raw = getattr(resp, "content", "") or ""
    except Exception as exc:
        log.warning("survey_prompt.llm_failed err=%s", exc)
        raw = ""
    try:
        parsed = json.loads(_unwrap_json(raw))
        log.info("survey_prompt.parsed ok keys=%s", list(parsed.keys()))
    except Exception as exc:
        log.warning("survey_prompt.parse_failed err=%s raw=%s", exc, raw[:2000])
        parsed = {}

    if not isinstance(parsed, dict):
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "Prompt generation returned non-object JSON.",
        )

    parsed.setdefault("likes", [])
    parsed.setdefault("dislikes", [])

    # Accept common model output typo/variant and normalize to API field.
    parsed["mbti_architype"] = parsed.get("mbti_architype") or parsed.get("mbti_archetype") or ""
    parsed.setdefault("mbti_rules", "")
    parsed.setdefault("personality_rules", "")
    parsed.setdefault("tone", "")

    def _to_str(val: Any) -> str:
        if val is None:
            return ""
        if isinstance(val, str):
            return val
        return str(val)

    stages_raw = parsed.get("stages")
    stages = stages_raw if isinstance(stages_raw, dict) else {}
    hate = _to_str(stages.get("hate", ""))
    dislike = _to_str(stages.get("dislike", ""))
    strangers = _to_str(stages.get("strangers", ""))
    # Support both old and new key names from LLM/system prompt variants.
    friendly_or_friends = _to_str(stages.get("friendly", stages.get("friends", "")))
    flirting = _to_str(stages.get("flirting", ""))
    dating = _to_str(stages.get("dating", ""))
    in_love_or_girlfriend = _to_str(stages.get("in_love", stages.get("girlfriend", "")))
    parsed["stages"] = {
        "hate": hate,
        "dislike": dislike,
        "strangers": strangers,
        "friends": friendly_or_friends,
        "friendly": friendly_or_friends,
        "flirting": flirting,
        "dating": dating,
        "girlfriend": in_love_or_girlfriend,
        "in_love": in_love_or_girlfriend,
    }

    def _as_str_list(val: Any) -> list[str]:
        if isinstance(val, list):
            return [str(x) for x in val]
        if val is None:
            return []
        return [str(val)]

    parsed["likes"] = _as_str_list(parsed.get("likes"))
    parsed["dislikes"] = _as_str_list(parsed.get("dislikes"))
    parsed["mbti_architype"] = _to_str(parsed.get("mbti_architype"))
    parsed["mbti_rules"] = _to_str(parsed.get("mbti_rules"))
    parsed["personality_rules"] = _to_str(parsed.get("personality_rules"))
    parsed["tone"] = _to_str(parsed.get("tone"))
    return parsed


async def load_survey_questions(db: AsyncSession) -> list[dict[str, Any]]:
    _ = db
    raw: str | None = None
    for path in _SURVEY_QUESTIONS_CANDIDATE_PATHS:
        try:
            raw = path.read_text()
            break
        except OSError:
            continue
    if raw is None:
        raise HTTPException(
            500,
            "Missing survey questions config: checked app/data/configs/survey_questions.json and docs/onboarding-survey.json",
        )
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(500, f"Survey questions JSON invalid: {exc}")
    if not isinstance(data, list):
        raise HTTPException(500, "Survey questions JSON must be a list")
    return data
