from __future__ import annotations

from typing import Any


def extract_total_seconds(conversation_json: dict[str, Any]) -> float:
    """
    Primary: metadata.call_duration_secs
    Fallback: max transcript[*].time_in_call_secs
    """
    md = conversation_json.get("metadata") or {}
    dur = md.get("call_duration_secs")
    if isinstance(dur, (int, float)) and dur >= 0:
        return float(dur)
    transcript = conversation_json.get("transcript") or []
    try:
        max_sec = (
            max(int(t.get("time_in_call_secs") or 0) for t in transcript)
            if transcript
            else 0
        )
    except Exception:
        max_sec = 0
    return float(max_sec) if max_sec else 0.0


def normalize_transcript(conversation_json: dict[str, Any]) -> list[dict[str, Any]]:
    """Return a simple transcript list with sender/text/time_in_call_secs."""
    transcript = conversation_json.get("transcript") or []
    normalized: list[dict[str, Any]] = []
    for entry in transcript:
        text = str(
            entry.get("text") or entry.get("content") or entry.get("message") or ""
        ).strip()
        if not text:
            continue
        role_raw = str(
            entry.get("sender") or entry.get("role") or entry.get("speaker") or ""
        ).lower()
        is_user_flag = entry.get("is_user") or entry.get("from_user")
        if role_raw in {"user", "human", "caller", "client"} or is_user_flag:
            sender = "user"
        elif role_raw in {"ai", "assistant", "agent", "bot", "system"}:
            sender = "ai"
        else:
            sender = "ai"

        normalized.append(
            {
                "sender": sender,
                "text": text,
                "time_in_call_secs": entry.get("time_in_call_secs"),
            }
        )
    return normalized
