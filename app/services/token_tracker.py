"""
Fire-and-forget API usage tracking service.

All tracking is non-blocking — failures are logged but never propagate to callers.
Usage is persisted to the `api_usage_logs` table for analytics.

Supported Providers:
- OpenAI: GPT models (gpt-5.2, gpt-4.1, gpt-4o, gpt-4o-mini),
          embeddings (text-embedding-3-small),
          Whisper transcription
- XAI: Grok models (grok-4-1-fast-reasoning)
- ElevenLabs: ConvAI voice calls, TTS (eleven_v3)

Categories:
- "text": Regular chat messages
- "18_chat": Adult chat messages
- "call": Voice calls (ElevenLabs ConvAI)
- "18_voice": Adult voice messages (TTS)
- "embedding": Text embeddings for vector search
- "moderation": Content moderation and safety checks
- "transcription": Audio-to-text conversion (Whisper)
- "analysis": Conversation analysis, survey summarization
- "extraction": Fact extraction from user messages
- "assistant": OpenAI assistants functionality

Usage Example:
    from app.services.token_tracker import track_usage_bg

    # After LLM call:
    usage = getattr(response, "usage_metadata", None) or {}
    track_usage_bg(
        category="text",
        provider="openai",
        model="gpt-5.2",
        purpose="main_reply",
        input_tokens=usage.get("input_tokens"),
        output_tokens=usage.get("output_tokens"),
        latency_ms=timer.ms,
        user_id=user_id,
        chat_id=chat_id,
    )
"""

import asyncio
import logging
import re
import time
from typing import Optional

from app.data.models.api_usage import ApiUsageLog
from app.core.session import SessionLocal

log = logging.getLogger(__name__)


# ── Model Pricing (micro-dollars per token) ──────────────────────
# 1 micro-dollar = $0.000001
# Last updated: 2026-02-13
#
# Sources:
# - OpenAI: https://openai.com/api/pricing/
# - XAI: https://docs.x.ai/developers/models
# - ElevenLabs: https://elevenlabs.io/pricing/api
_PRICING_INPUT = {
    # OpenAI
    "gpt-5.2":                  2_500,   # $2.50 / 1M input tokens
    "gpt-4.1":                  2_000,   # $2.00 / 1M input tokens
    "gpt-4.1-mini":               150,   # $0.15 / 1M input tokens
    "gpt-4o":                   2_500,   # $2.50 / 1M input tokens
    "gpt-4o-mini":                150,   # $0.15 / 1M input tokens
    "text-embedding-3-small":      20,   # $0.02 / 1M input tokens
    "text-embedding-v3":           20,   # $0.02 / 1M input tokens
    "text-embedding-v2":           20,   # $0.02 / 1M input tokens
    # XAI
    "grok-4-1-fast-reasoning":        200,   # $0.20 / 1M input tokens
    "grok-4-1-fast-non-reasoning":    200,   # $0.20 / 1M input tokens
    # Alibaba / Qwen
    "qwen-max":                 1_200,   # $1.20 / 1M input tokens
    "qwen-plus":                  400,   # $0.40 / 1M input tokens
    "qwen-turbo":                  50,   # $0.05 / 1M input tokens
}

_PRICING_OUTPUT = {
    # OpenAI
    "gpt-5.2":                 10_000,   # $10.00 / 1M output tokens
    "gpt-4.1":                  8_000,   # $8.00 / 1M output tokens
    "gpt-4.1-mini":               600,   # $0.60 / 1M output tokens
    "gpt-4o":                  10_000,   # $10.00 / 1M output tokens 
    "gpt-4o-mini":                600,   # $0.60 / 1M output tokens
    "text-embedding-3-small":       0,   # embeddings have no output tokens
    "text-embedding-v3":            0,   # embeddings have no output tokens
    "text-embedding-v2":            0,   # embeddings have no output tokens
    # XAI
    "grok-4-1-fast-reasoning":        500,   # $0.50 / 1M output tokens
    "grok-4-1-fast-non-reasoning":    500,   # $0.50 / 1M output tokens
    # Alibaba / Qwen
    "qwen-max":                 6_000,   # $6.00 / 1M output tokens
    "qwen-plus":                1_200,   # $1.20 / 1M output tokens
    "qwen-turbo":                 200,   # $0.20 / 1M output tokens
}

# Optional exact snapshot overrides (nano-dollars per token).
# Keep empty by default and add entries if a specific snapshot diverges.
_OPENAI_SNAPSHOT_OVERRIDES_INPUT: dict[str, int] = {}
_OPENAI_SNAPSHOT_OVERRIDES_OUTPUT: dict[str, int] = {}

# ElevenLabs: charged per character for TTS, per minute for ConvAI
# Official pricing (Pro plan):
#   - ConvAI: ~$0.10/min (used as fallback; webhook provides exact credits)
#   - TTS:    ~$0.20/1000 characters = 200 microdollars per character
#   - TTS time-based fallback: ~$0.18/min when only audio duration is known
_ELEVENLABS_CONVAI_COST_PER_SEC = 1_667    # $0.001667/sec ≈ $0.10/min in microdollars
_ELEVENLABS_TTS_COST_PER_CHAR   = 200      # $0.0002/char = $0.20/1000 chars in microdollars
_ELEVENLABS_TTS_COST_PER_SEC    = 3_000    # ~$0.18/min fallback when only duration is known

# Whisper: charged per minute of audio
_WHISPER_COST_PER_MINUTE = 6_000  # $0.006/min in microdollars
_DATE_SUFFIX_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _is_date_suffix(text: str) -> bool:
    return bool(_DATE_SUFFIX_RE.fullmatch(text))


def _canonicalize_model_for_pricing(model: str, provider: str) -> str:
    """
    Canonicalize runtime model IDs for pricing lookups.

    OpenAI can return snapshot IDs like "gpt-4o-mini-2024-07-18".
    We map those to canonical family IDs ("gpt-4o-mini") unless
    an explicit snapshot override is configured.
    """
    normalized_model = (model or "").strip().lower()
    normalized_provider = (provider or "").strip().lower()

    if normalized_provider != "openai":
        return normalized_model

    if (
        normalized_model in _OPENAI_SNAPSHOT_OVERRIDES_INPUT
        or normalized_model in _OPENAI_SNAPSHOT_OVERRIDES_OUTPUT
    ):
        return normalized_model

    if (
        len(normalized_model) > 11
        and normalized_model[-11] == "-"
        and _is_date_suffix(normalized_model[-10:])
    ):
        return normalized_model[:-11]

    return normalized_model


def _estimate_cost(
    model: str,
    provider: str,
    input_tokens: Optional[int],
    output_tokens: Optional[int],
    duration_secs: Optional[float],
    purpose: str,
    char_count: Optional[int] = None,
) -> Optional[int]:
    """
    Estimate cost in micro-dollars.

    Returns cost value where:
    - 1,000,000 units = 1 USD

    Convert to USD at display time by dividing by 1 million.
    """
    raw_model = (model or "").strip()
    normalized_provider = (provider or "").strip().lower()
    pricing_model = _canonicalize_model_for_pricing(raw_model, normalized_provider)

    # Handle ElevenLabs pricing
    if normalized_provider == "elevenlabs":
        if purpose == "call_conversation" and duration_secs is not None:
            return int(duration_secs * _ELEVENLABS_CONVAI_COST_PER_SEC)
        # TTS: prefer character-based pricing, fallback to duration estimate
        if char_count is not None:
            return int(char_count * _ELEVENLABS_TTS_COST_PER_CHAR)
        if duration_secs is not None:
            return int(duration_secs * _ELEVENLABS_TTS_COST_PER_SEC)

    # Handle Whisper time-based pricing
    if pricing_model == "whisper-1" and duration_secs is not None:
        duration_mins = duration_secs / 60.0
        return int(duration_mins * _WHISPER_COST_PER_MINUTE)

    # Handle token-based pricing
    # Pricing constants store nano-dollars per token (i.e. micro-dollars per 1000 tokens).
    # We accumulate in nano-dollars, then divide by 1000 to return micro-dollars.
    cost = 0.0
    has_pricing = False
    token_cost_nano = 0

    if input_tokens:
        input_rate = None
        if normalized_provider == "openai":
            input_rate = _OPENAI_SNAPSHOT_OVERRIDES_INPUT.get(pricing_model)
        if input_rate is None:
            input_rate = _PRICING_INPUT.get(pricing_model)

        if input_rate is not None:
            token_cost_nano += input_tokens * input_rate
            has_pricing = True
        else:
            log.warning(
                "Unknown model '%s' (pricing key='%s', provider=%s) - no input pricing available. "
                "Add pricing to _PRICING_INPUT in token_tracker.py",
                raw_model, pricing_model, provider
            )

    if output_tokens:
        output_rate = None
        if normalized_provider == "openai":
            output_rate = _OPENAI_SNAPSHOT_OVERRIDES_OUTPUT.get(pricing_model)
        if output_rate is None:
            output_rate = _PRICING_OUTPUT.get(pricing_model)

        if output_rate is not None:
            token_cost_nano += output_tokens * output_rate
            has_pricing = True
        else:
            log.warning(
                "Unknown model '%s' (pricing key='%s', provider=%s) - no output pricing available. "
                "Add pricing to _PRICING_OUTPUT in token_tracker.py",
                raw_model, pricing_model, provider
            )

    if has_pricing:
        cost += token_cost_nano / 1000.0

    return int(cost) if has_pricing else None


async def track_usage(
    category: str,
    provider: str,
    model: str,
    purpose: str,
    *,
    exact_cost_micros: Optional[int] = None,
    input_tokens: Optional[int] = None,
    output_tokens: Optional[int] = None,
    total_tokens: Optional[int] = None,
    duration_secs: Optional[float] = None,
    char_count: Optional[int] = None,
    latency_ms: Optional[int] = None,
    user_id: Optional[int] = None,
    influencer_id: Optional[str] = None,
    chat_id: Optional[str] = None,
    conversation_id: Optional[str] = None,
    success: bool = True,
    error_message: Optional[str] = None,
) -> None:
    """
    Track API usage with cost estimation.

    This function NEVER raises — all errors are logged and swallowed
    so it can't disrupt the main request flow.

    Note: estimated_cost_micros stores micro-dollars (1 million units = 1 USD).

    Args:
        category: "text" | "call" | "18_chat" | "18_voice" | "embedding" | "moderation" | "transcription" | "analysis" | "extraction" | "assistant"
        provider: "openai" | "xai" | "elevenlabs"
        model: Model name (e.g. "gpt-5.2", "grok-4-1-fast-reasoning", "whisper-1")
        purpose: Purpose of call (e.g. "main_reply", "moderation", "tts", "transcription")
        exact_cost_micros: Exact cost in micro-dollars from provider (overrides _estimate_cost when set)
        input_tokens: Number of input tokens (for LLMs)
        output_tokens: Number of output tokens (for LLMs)
        total_tokens: Total tokens (input + output)
        duration_secs: Duration in seconds (for audio services like Whisper, ElevenLabs)
        char_count: Character count for ElevenLabs TTS (preferred over duration for cost)
        latency_ms: API call latency in milliseconds
        user_id: User ID for attribution (optional)
        influencer_id: Influencer ID for attribution (optional)
        chat_id: Chat ID for attribution (optional)
        conversation_id: Conversation ID for attribution (optional)
        success: Whether the API call succeeded (default: True)
        error_message: Error message if success=False (truncated to 500 chars)
    """
    try:
        # Auto-compute total_tokens if not provided
        if total_tokens is None and input_tokens is not None:
            total_tokens = (input_tokens or 0) + (output_tokens or 0)

        if exact_cost_micros is not None:
            estimated_cost = exact_cost_micros
        else:
            estimated_cost = _estimate_cost(
                model, provider, input_tokens, output_tokens, duration_secs, purpose,
                char_count=char_count,
            )

        row = ApiUsageLog(
            category=category,
            provider=provider,
            model=model,
            purpose=purpose,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            estimated_cost_micros=estimated_cost,
            duration_secs=duration_secs,
            latency_ms=latency_ms,
            user_id=user_id,
            influencer_id=influencer_id,
            chat_id=chat_id,
            conversation_id=conversation_id,
            success=success,
            error_message=error_message[:500] if error_message else None,
        )

        async with SessionLocal() as db:
            db.add(row)
            await db.commit()

    except Exception as exc:
        log.warning("track_usage failed: %s", exc, exc_info=False)


def track_usage_bg(
    category: str,
    provider: str,
    model: str,
    purpose: str,
    **kwargs,
) -> None:
    """
    Schedule track_usage as a background task (fire-and-forget).

    Use this when you don't want to await the tracking call.
    """
    try:
        asyncio.create_task(
            track_usage(category, provider, model, purpose, **kwargs)
        )
    except RuntimeError:
        # No running event loop — skip silently
        log.debug("track_usage_bg: no event loop, skipping")


class UsageTimer:
    """Context manager to measure latency for API calls.
    
    Usage:
        timer = UsageTimer()
        timer.start()
        result = await llm.ainvoke(...)
        timer.stop()
        
        await track_usage(..., latency_ms=timer.ms)
    """

    def __init__(self) -> None:
        self._start: float = 0
        self._end: float = 0

    def start(self) -> "UsageTimer":
        self._start = time.perf_counter()
        return self

    def stop(self) -> "UsageTimer":
        self._end = time.perf_counter()
        return self

    @property
    def ms(self) -> int:
        return int((self._end - self._start) * 1000)
