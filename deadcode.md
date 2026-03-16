# Dead Code Audit Report

**Date:** 2026-03-16
**Scope:** Full codebase scan of `teaseme-backend-starter`
**Method:** Static analysis — every function definition was cross-referenced against all imports, calls, and references across the entire project.

---

## Table of Contents

1. [Unused Functions — memory.py](#1-unused-functions--memorpy)
2. [Unused Function — prompt_utils.py](#2-unused-function--prompt_utilspy)
3. [Unused Time Utilities — time.py](#3-unused-time-utilities--timepy)
4. [Ghost Export — models/__init__.py](#4-ghost-export--models__init__py)
5. [Duplicate Field Bug — billing.py](#5-duplicate-field-bug--billingpy)
6. [Unused Pydantic Schemas](#6-unused-pydantic-schemas)
7. [Unused Config Value — config.py](#7-unused-config-value--configpy)
8. [Commented-Out Code Blocks](#8-commented-out-code-blocks)

---

## 1. Unused Functions — `app/agents/memory.py`

### `get_summarized_memories()` — Lines 270-280

```python
async def get_summarized_memories(db, user_id, influencer_id, max_items=400) -> str:
```

**Status:** Not called anywhere in app code.
**What it does:** Fetches all memories for a user-influencer pair via `get_all_memory_list()` and feeds them through `summarize_memory_list()` to produce an LLM-generated summary.
**Why it's dead:** This was the original approach to providing memory context — dump everything and summarize. It was superseded by the semantic similarity search approach (`find_similar_memories()`) which retrieves only the most relevant memories for the current conversation context, organized by day. The old "summarize everything" approach was less efficient (expensive LLM call on up to 400 items) and less contextually relevant.
**Note:** Still imported and used in `scripts/get_all_memory_list.py`, a developer utility script. The function itself works correctly — it's just not part of any production code path.

---

### `get_all_memory_list()` — Lines 283-350

```python
async def get_all_memory_list(db, user_id, influencer_id, exclude_sender=None, limit=200) -> list[str]:
```

**Status:** Only caller is `get_summarized_memories()` (above) and `scripts/get_all_memory_list.py`.
**What it does:** Combines extracted long-term memories from the `memories` table and chat messages from the `messages` table into a single chronological timeline. Uses `UNION ALL` to merge both sources, ordered newest-first, capped at `limit` rows.
**Why it's dead:** Same reason as above — replaced by the day-aware semantic search approach. The old approach returned a flat list of timestamped strings without any relevance filtering. The new `find_similar_memories()` function searches by embedding similarity and groups results by calendar day, which gives the AI much better context.
**Note:** Kept alive by the developer utility script for debugging/inspection purposes.

---

### `find_similar_messages()` — Lines 406-434

```python
async def find_similar_messages(db, chat_id, message, influencer_id=None, top_k=10, embedding=None, max_distance=None):
```

**Status:** Zero callers anywhere in the codebase.
**What it does:** Performs semantic search over the `messages` table only using embedding similarity. Takes a user message, generates (or reuses) an embedding, and calls `search_similar_messages()` to find the most similar past messages.
**Why it's dead:** This was an intermediate step in the memory system evolution. Originally, memory search and message search were separate operations. This function searched only messages. It was replaced by `find_similar_memories()` (lines 531-577), which searches the `memories` table with day-aware formatting. The messages table is no longer searched separately for context — extracted facts/memories are the primary source of recall.
**Recommendation:** Safe to remove. The underlying `search_similar_messages()` repository function it calls may also be unused (verify before removing).

---

### `find_similar_memories_and_messages()` — Lines 580-633

```python
async def find_similar_memories_and_messages(db, chat_id, message, influencer_id=None, top_k=10, embedding=None, max_distance=None, memories_weight=1.0, messages_weight=1.0):
```

**Status:** Zero callers in production app code. Only mentioned in a comment in `scripts/test_get_memories.py`.
**What it does:** A more advanced version of `find_similar_messages()` that searches BOTH the `memories` and `messages` tables using `UNION`, with configurable weighting between the two sources. It was designed to let callers prioritize memories over messages or vice versa.
**Why it's dead:** This was built as a replacement for `find_similar_messages()` but was itself never adopted. The production code path uses `find_similar_memories()` instead, which only searches the memories table and formats results with day-aware labels. The dual-source union approach added complexity without clear benefit — extracted memories already capture the important information from messages.
**Recommendation:** Safe to remove. It has a well-documented docstring and example usage, suggesting it was intended for future use but never integrated.

---

### `store_fact()` — Lines 666-687

```python
async def store_fact(db, chat_id, fact, sender="user"):
```

**Status:** Zero callers. Explicitly marked as "legacy function for backward compatibility" in its docstring.
**What it does:** Stores a single fact by normalizing it, checking for duplicates via `_already_have()`, generating an embedding, and upserting into the `memories` table.
**Why it's dead:** Replaced by `store_facts_batch()` (line 690+), which processes multiple facts in a single operation with batch embeddings and a single-query dedup check (`_batch_already_have()`). The batch version is significantly more efficient — one embedding API call and one DB query instead of N of each. All fact extraction code paths (chat turn handler, call transcript processing) were updated to use the batch version.
**Recommendation:** Safe to remove along with `_already_have()`.

---

### `_already_have()` — Lines 640-648

```python
async def _already_have(db, chat_id, fact) -> bool:
```

**Status:** Only called by `store_fact()` (above), which is itself dead.
**What it does:** Checks if a normalized fact string already exists in the `memories` table for a given `chat_id`. Single-fact dedup check.
**Why it's dead:** Replaced by `_batch_already_have()` (lines 651-663), which checks multiple facts in a single DB round-trip using an `IN` clause. The batch version is used by `store_facts_batch()`.
**Recommendation:** Safe to remove.

---

## 2. Unused Function — `app/agents/prompt_utils.py`

### `get_today_script()` — Lines 363-375

```python
async def get_today_script(db: AsyncSession = Depends(get_db), influencer_id: str = None) -> str:
```

**Status:** Zero callers anywhere in the codebase.
**What it does:** A FastAPI dependency-injectable function that fetches an influencer's `daily_scripts` array from the database, then selects one based on the day of the year (rotating through the list). Returns the script string for today.
**Why it's dead:** This appears to have been designed as a daily rotating script/greeting system for influencers, but it was never wired into any endpoint or prompt builder. The `Depends(get_db)` signature suggests it was intended as a FastAPI route dependency, but no route uses it. The influencer `daily_scripts` field may or may not be populated — regardless, nothing reads it through this function.
**Collateral dead code:** This function is the sole reason for importing `Depends` from `fastapi` and `get_db` from `app.db.session` in this file (line 13-14). Both imports become unused if this function is removed.
**Recommendation:** Safe to remove along with the two unused imports.

---

## 3. Unused Time Utilities — `app/utils/time.py`

### `range_span()` — Lines 56-59

```python
def range_span(start: int, end: int) -> int:
```

**Status:** Zero callers anywhere in the codebase.
**What it does:** Calculates the number of hours in a time range, correctly handling overnight ranges that wrap past midnight (e.g., 10 PM to 6 AM = 9 hours).
**Why it's dead:** Part of a time-range calculation toolkit that was likely built for the time-of-day vibe system (`get_time_context()` in `prompt_utils.py`). The actual implementation in `prompt_utils.py` uses its own inline logic via `_default_time_vibe_ranges()` and `_pick_vibes_for_hour()` instead of these utility functions.

### `hour_in_range()` — Lines 62-65

```python
def hour_in_range(hour: int, start: int, end: int) -> bool:
```

**Status:** Zero callers anywhere in the codebase.
**What it does:** Checks if a given hour falls within a time range, handling overnight wrap (e.g., `hour_in_range(2, 22, 6)` returns `True`).
**Why it's dead:** Same reason as `range_span()` — the prompt utils module handles hour-in-range logic inline.

### `parse_time_range()` — Lines 68-75

```python
def parse_time_range(label: str):
```

**Status:** Zero callers anywhere in the codebase.
**What it does:** Parses human-readable time range strings like `"9 AM - 5 PM"` into a tuple of 24-hour integers `(9, 17)` using the `_TIME_RANGE_RE` regex.
**Why it's dead:** This was likely intended for parsing time ranges from influencer configuration, but the system uses hardcoded hour ranges in `_default_time_vibe_ranges()` instead.

### Supporting dead code (only used by the above):
- **`_hour_from_12h()`** (lines 49-53) — Converts 12-hour time to 24-hour. Only called by `parse_time_range()`.
- **`_TIME_RANGE_RE`** (line 8) — Regex pattern for matching time range strings. Only used by `parse_time_range()`.

**Recommendation:** All five items (`range_span`, `hour_in_range`, `parse_time_range`, `_hour_from_12h`, `_TIME_RANGE_RE`) can be safely removed together. The remaining functions in `time.py` (`resolve_timezone`, `check_is_weekend`, `format_timezone_location`) are actively used.

---

## 4. Ghost Export — `app/db/models/__init__.py`

### `ApiUsageMonthly` in `__all__` — Line 107

```python
__all__ = [
    ...
    "ApiUsageLog",
    "ApiUsageMonthly",  # <-- this class does not exist
]
```

**Status:** The string `"ApiUsageMonthly"` is listed in `__all__` but no class with this name exists anywhere in the codebase.
**What it does:** Nothing — it's a reference to a non-existent class.
**Why it's dead:** The `ApiUsageLog` model exists in `app/db/models/api_usage.py` and works correctly. `ApiUsageMonthly` was likely planned as a monthly aggregation table (rolling up daily API usage into monthly summaries for faster dashboard queries) but was never implemented. The export was added to `__all__` in anticipation but the model class was never created.
**Impact:** This won't cause a runtime error unless someone does `from app.db.models import ApiUsageMonthly` explicitly — the `__all__` list only affects `from module import *` behavior, and even then it would fail at import time only if that specific name is accessed.
**Recommendation:** Remove from `__all__` to avoid confusion.

---

## 5. Duplicate Field Bug — `app/db/models/billing.py`

### `InfluencerCreditTransaction.amount_cents` — Lines 97 and 101

```python
# Line 97:
amount_cents: Mapped[int] = mapped_column(Integer)

# Line 101:
amount_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
```

**Status:** This is a **bug**, not just dead code.
**What's happening:** The field `amount_cents` is defined twice on the same SQLAlchemy model. In Python, when a class attribute is defined twice, the second definition silently overrides the first. So the first definition (line 97, no constraints) is completely ignored, and the second (line 101, with `nullable=False, default=0`) is the one that takes effect.
**Why it happened:** Likely a merge artifact or an incomplete refactor. Someone added the stricter definition (with `nullable=False` and `default=0`) but forgot to remove the original.
**Current behavior:** The model works correctly because the second definition is the stricter/better one. But it's confusing to read and a code smell.
**Recommendation:** Remove line 97 (the first, looser definition), keeping line 101 (the stricter version with `nullable=False, default=0`).

---

## 6. Unused Pydantic Schemas

### `SignedUrlRequest` — `app/schemas/elevenlabs.py` Lines 4-6

```python
class SignedUrlRequest(BaseModel):
    influencer_id: str
    first_message: str | None = None
```

**Status:** Zero imports or references anywhere in the codebase.
**What it does:** Defines a request body schema with `influencer_id` and an optional `first_message`.
**Why it's dead:** This was likely created for a signed URL generation endpoint for ElevenLabs conversations. The endpoint either was never built, or was built using inline parameter extraction instead of this schema. The actual ElevenLabs call endpoints use different parameter patterns.
**Recommendation:** Safe to remove.

---

### `FinalizeConversationBody` — `app/schemas/elevenlabs.py` Lines 13-18

```python
class FinalizeConversationBody(BaseModel):
    user_id: int
    influencer_id: Optional[str] = None
    sid: Optional[str] = None
    timeout_secs: int = 180
    charge_if_not_billed: bool = True
```

**Status:** Only used by the commented-out `finalize_conversation()` endpoint in `app/api/elevenlabs.py`.
**What it does:** Defines the request body for a conversation finalization endpoint that would wait for ElevenLabs to finish processing, then apply billing.
**Why it's dead:** The finalize endpoint was commented out as an optimization decision — the system now uses quick status checks and webhook-driven processing instead of blocking waits. See the commented-out code section below for details.
**Recommendation:** Remove if the finalize endpoint is permanently abandoned. Keep if there are plans to revive it.

---

### `FollowerResponse` — `app/api/social.py` Lines 83-87

```python
class FollowerResponse(BaseModel):
    count: int
    service: str
    username: str
    success: bool
```

**Status:** Defined in the same file as the `/api/followers` endpoint, but the endpoint returns a plain dictionary instead.
**What it does:** Defines a structured response schema for the follower count endpoint.
**Why it's dead:** The endpoint at line 40+ (`get_instagram_followers`) constructs and returns a plain `dict` with `count`, `service`, `username`, and `followers_count` fields. The schema was likely created during initial endpoint design but wasn't used as the `response_model` on the route decorator. The field names also don't fully match (schema has `success`, endpoint returns `followers_count`).
**Recommendation:** Either remove the unused class, or adopt it as the proper `response_model` to get automatic validation and OpenAPI documentation.

---

## 7. Unused Config Value — `app/core/config.py`

### `DEFAULT_SUMMARIZATION_MODEL` — Line 101

```python
DEFAULT_SUMMARIZATION_MODEL: str = "gpt-3.5-turbo"
```

**Status:** Zero references anywhere in the codebase outside its definition.
**What it does:** Defines a default model name for summarization tasks.
**Why it's dead:** The summarization code in `memory.py` (`summarize_memory_list()`) uses the `MODEL` instance from `app/agents/prompts.py`, not this config value. The config was likely added during early development when the summarization model was configurable, but the code was later refactored to use a centralized model definition. Additionally, the value `"gpt-3.5-turbo"` is outdated — the project now uses GPT-5.2 for most operations.
**Recommendation:** Safe to remove.

---

## 8. Commented-Out Code Blocks

### Old V2 TTS Function — `app/utils/messaging/chat.py` Lines 109-139

```python
# async def synthesize_audio_with_elevenlabs(text, db, influencer_id=None):
#     ...  (~31 lines of commented-out code)
```

**What it was:** The original ElevenLabs text-to-speech function using the `eleven_multilingual_v2` model with direct HTTP calls via `httpx`.
**Why it's commented out:** Replaced by `synthesize_audio_with_elevenlabs_V3()` which uses ElevenLabs V3 style tags, better voice settings, and the updated API patterns. The V3 version supports style-tagged speech (warm, playful, sad, etc.) which the V2 version did not.
**Risk of removal:** None — the V3 function is the active code path and the old function signature is commented out from `app/utils/__init__.py` exports as well.

---

### `finalize_conversation()` Endpoint — `app/api/elevenlabs.py` ~Lines 1440-1539

```python
# @router.post("/conversations/{conversation_id}/finalize")
# async def finalize_conversation(...):
#     ...  (~100 lines of commented-out implementation)
```

**What it was:** A POST endpoint that would block until an ElevenLabs conversation was fully processed, then apply billing charges. It polled the conversation status in a loop with configurable timeout.
**Why it's commented out:** An explicit optimization decision. The blocking-wait approach tied up a server worker for up to 3 minutes per call finalization. The system was redesigned to use webhooks and quick status checks instead, which is non-blocking and more scalable.
**Risk of removal:** Low — the webhook-based approach is working in production. However, this code documents the old approach and could be useful reference if the webhook system needs a fallback.

---

### `get_influencer_media()` — `app/services/re_engagement.py` Lines 139-164

```python
# async def get_influencer_media(db, influencer_id):
#     ...  (~25 lines of commented-out implementation)
```

**What it was:** A function to fetch influencer media (images/videos) from S3 for use in re-engagement messages.
**Why it's commented out:** Intentionally disabled with a TODO note: "Re-enable when ready to send images/videos." The re-engagement system currently sends text-only messages. Media support is a planned future feature.
**Supporting dead code:** Line 20 has a commented-out import: `# from app.utils.s3 import generate_presigned_url` with comment "text only for now."
**Risk of removal:** Medium — this represents planned feature work. Removing it means the implementation would need to be rewritten when media support is added.
