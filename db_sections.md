# Database Architecture: Complete Section Analysis

**29 tables** across **10 model files** in `app/db/models/`, grouped into **7 logical domains**.

> [!IMPORTANT]
> This report includes per-table column counts, file locations, every consumer (service/API/repo/use_case), and code-level issues flagged for cleanup.

---

## Group 1 — Core Identity & Users
**File**: [user.py](file:///Users/yoda/projects/teaseme-backend-starter/app/db/models/user.py) (57 lines)

| Table | Model Class | Columns | Purpose |
|---|---|---|---|
| `users` | `User` | 18 | Core user accounts — auth, profile, moderation status, identity verification flags |

**Consumers**: `api/auth.py`, `api/user.py`, `api/chat.py`, `api/chat_18.py`, `api/elevenlabs.py`, `api/influencer.py`, `api/checkout.py`, `api/push.py`, `api/re_engagement.py`, `api/system_prompts.py`, `api/verification.py`, `api/pre_influencers.py`, `api/follow.py`, `services/billing.py`, `services/checkout.py`, `services/user.py`, `moderation/actions.py`, `use_cases/elevenlabs_greeting.py`

> [!NOTE]
> `User` is the single most referenced model in the entire codebase. It has **embedded moderation fields** (lines 39-43) and **embedded verification flags** (lines 45-49) that duplicate concerns from their respective dedicated tables (`content_violations`, `identity_verifications`). These could be candidates for extraction during refactoring.

---

## Group 2 — Influencer / AI Persona Management
**File**: [influencer.py](file:///Users/yoda/projects/teaseme-backend-starter/app/db/models/influencer.py) (120 lines)

| Table | Model Class | Columns | Purpose |
|---|---|---|---|
| `influencers` | `Influencer` | 17 | Creator/AI persona profiles — voice, bio, prompt template, samples, FirstPromoter refs |
| `influencer_followers` | `InfluencerFollower` | 3 | Many-to-many join table: which users follow which influencers |
| `pre_influencers` | `PreInfluencer` | 14 | Onboarding pipeline for prospective influencers — survey, IG auth, status tracking |

**Consumers**: `api/influencer.py`, `api/pre_influencers.py`, `api/follow.py`, `api/social.py`, `api/elevenlabs.py`, `services/influencer.py`, `services/follow.py`, `services/influencer_cleanup.py`, `services/billing.py`, `relationship/processor.py`, `relationship/inactivity.py`, `use_cases/knowledge_sync.py`, `use_cases/elevenlabs_greeting.py`

> [!WARNING]
> `Influencer.influencer_agent_id_third_part` (line 35) — typo in column name (`third_part` → `third_party`). `PreInfluencer` stores a **plaintext `password`** field (line 94) — potential security concern during refactoring.

---

## Group 3 — Chat & Communication Engine
**File**: [chat.py](file:///Users/yoda/projects/teaseme-backend-starter/app/db/models/chat.py) (125 lines)

| Table | Model Class | Columns | Purpose |
|---|---|---|---|
| `chats` | `Chat` | 4 | Standard chat sessions between user ↔ influencer |
| `messages` | `Message` | 8 | Individual messages within standard chats (includes pgvector `embedding`) |
| `chats_18` | `Chat18` | 4 | Adult/NSFW chat sessions — **structurally identical** to `Chat` |
| `messages_18` | `Message18` | 7 | Adult messages — **structurally identical** to `Message` (minus `conversation_id` FK) |
| `memories` | `Memory` | 5 | Long-term extracted facts/knowledge from conversations (pgvector embeddings) |
| `calls` | `CallRecord` | 8 | Voice/video call session records — duration, transcript, ElevenLabs SID |

**Consumers**: `api/chat.py`, `api/chat_18.py`, `api/elevenlabs.py`, `api/admin.py`, `api/webhooks.py`, `services/chat_service.py`, `services/chat_buffer_service.py`, `services/embeddings.py`, `services/influencer_cleanup.py`, `repositories/admin_chat_info_repository.py`, `repositories/history_cleanup_repository.py`, `use_cases/elevenlabs_greeting.py`, `use_cases/admin_user_analytics.py`

> [!CAUTION]
> **Schema duplication**: `Chat18` / `Message18` are near-identical clones of `Chat` / `Message`. During refactoring, consider merging them with a discriminator column (e.g., `is_18: bool`) to halve this group's table count. `Message.created_at` uses the deprecated `datetime.utcnow` (line 46) while `Message18.created_at` correctly uses `datetime.now(timezone.utc)` — inconsistency.

---

## Group 4 — AI Knowledge Base & RAG Pipeline
**File**: [knowledge.py](file:///Users/yoda/projects/teaseme-backend-starter/app/db/models/knowledge.py) (103 lines)

| Table | Model Class | Columns | Purpose |
|---|---|---|---|
| `influencer_knowledge_documents` | `InfluencerKnowledgeDocument` | 6 | Source-of-truth raw text per influencer (1:1 unique constraint) |
| `influencer_knowledge_chunks` | `InfluencerKnowledgeChunk` | 6 | Vectorized chunks of documents for pgvector semantic retrieval |
| `influencer_knowledge_sync` | `InfluencerKnowledgeSync` | 6 | Maps local knowledge docs → ElevenLabs knowledge document IDs |

**Consumers**: `services/knowledge_rag.py`, `services/embeddings.py`, `repositories/knowledge_repository.py`, `repositories/knowledge_sync_repository.py`, `use_cases/knowledge_sync.py`

> [!NOTE]
> This is the cleanest, most well-contained domain group. Has proper cascading deletes, unique constraints, and dedicated repository layer. Low refactoring priority.

---

## Group 5 — Billing, Payments & Subscriptions
**File**: [billing.py](file:///Users/yoda/projects/teaseme-backend-starter/app/db/models/billing.py) (388 lines — **largest model file**)

| Table | Model Class | Columns | Purpose |
|---|---|---|---|
| `subscriptions` | `Subscription` | 4 | ⚠️ **LEGACY** — docstring says "Legacy subscription model". Stores raw JSON blob |
| `pricing` | `Pricing` | 5 | Feature pricing table (text/voice/live_chat per-unit costs) |
| `influencer_wallets` | `InfluencerWallet` | 7 | Per-user-per-influencer credit balance (with `is_18` mode split) |
| `influencer_credit_transactions` | `InfluencerCreditTransaction` | 7 | Immutable ledger of credit burns/earnings |
| `daily_usage` | `DailyUsage` | 6 | Composite PK per-user daily usage counters (text, voice, live) |
| `influencer_subscription_plans` | `InfluencerSubscriptionPlan` | 11 | Subscription tier definitions (Basic/Plus/Premium, recurring vs addon) |
| `influencer_subscriptions` | `InfluencerSubscription` | 19 | Active user subscriptions with payment provider integration |
| `influencer_subscription_addon_purchases` | `InfluencerSubscriptionAddonPurchase` | 11 | One-time credit top-up purchases tied to a subscription |
| `influencer_subscription_payments` | `InfluencerSubscriptionPayment` | 13 | Payment/invoice records with provider event deduplication |
| `paypal_topups` | `PayPalTopUp` | 9 | Fiat-to-credit conversion records (PayPal + Stripe) |

**Consumers**: `api/billing.py`, `api/user.py`, `api/checkout.py`, `api/influencer_subscriptions.py`, `api/push.py`, `api/elevenlabs.py`, `services/billing.py`, `services/checkout.py`, `services/user.py`, `services/influencer_subscriptions.py`, `relationship/inactivity.py`, `use_cases/admin_user_analytics.py`

> [!CAUTION]
> **Critical issues found in this group:**
> 1. **Duplicate column**: `InfluencerCreditTransaction.amount_cents` is defined **twice** (lines 97 and 101) — the second definition silently overwrites the first.
> 2. **Legacy table**: `Subscription` (line 14) is explicitly labeled "Legacy subscription model" — only imported by `api/push.py` and `relationship/inactivity.py`. Candidate for removal.
> 3. **Misleading name**: `PayPalTopUp` also handles Stripe (has `provider` column for "paypal" | "stripe") — the class and table name are misleading.
> 4. **File bloat**: 10 models in a single 388-line file. Consider splitting into `billing_core.py` (wallets, transactions, pricing) and `billing_subscriptions.py` (plans, subscriptions, addons, payments).

---

## Group 6 — Conversational Context & Relationship State
**Files**: [relationship.py](file:///Users/yoda/projects/teaseme-backend-starter/app/db/models/relationship.py) (57 lines) + [system.py](file:///Users/yoda/projects/teaseme-backend-starter/app/db/models/system.py) (31 lines)

| Table | Model Class | Columns | Purpose |
|---|---|---|---|
| `relationship_state` | `RelationshipState` | 14 | Trust/closeness/attraction/safety dimensions + DTR stage + sentiment scoring |
| `system_prompts` | `SystemPrompt` | 6 | Versioned system prompt templates stored in the DB (keyed by string PK) |

**Consumers**: `api/relationship.py`, `api/admin.py`, `api/system_prompts.py`, `services/relationship_dimension_service.py`, `services/system_prompt_service.py`, `relationship/repo.py`, `relationship/inactivity.py`

> [!NOTE]
> `system_prompts` was grouped here because it defines AI behavioral context, not admin config. If preferred, it could live in a standalone "System Config" group.

---

## Group 7 — Trust, Safety & Moderation
**Files**: [verification.py](file:///Users/yoda/projects/teaseme-backend-starter/app/db/models/verification.py) (85 lines) + [content.py](file:///Users/yoda/projects/teaseme-backend-starter/app/db/models/content.py) (100 lines)

| Table | Model Class | Columns | Purpose |
|---|---|---|---|
| `identity_verifications` | `IdentityVerification` | 18 | KYC/age verification sessions via Didit (status lifecycle, AML, risk score) |
| `content_violations` | `ContentViolation` | 14 | Flagged content — category, severity, AI confidence, admin review status |
| `re_engagement_logs` | `ReEngagementLog` | 11 | Push notification re-engagement tracking (delivery stats, wallet context) |

**Consumers**: `api/verification.py`, `api/admin.py`, `services/didit.py`, `services/re_engagement.py`, `moderation/actions.py`, `scheduler.py`, `relationship/inactivity.py`, `api/re_engagement.py`

> [!WARNING]
> `ReEngagementLog` is defined in `content.py` but is functionally a **marketing/growth** concern, not a moderation concern. Its primary consumer is `services/re_engagement.py` and `scheduler.py`. During refactoring, consider moving it to its own file or to a new `engagement.py` model file.

---

## Group 8 — System Telemetry & Analytics
**File**: [api_usage.py](file:///Users/yoda/projects/teaseme-backend-starter/app/db/models/api_usage.py) (72 lines)

| Table | Model Class | Columns | Purpose |
|---|---|---|---|
| `api_usage_logs` | `ApiUsageLog` | 16 | Per-API-call telemetry: tokens, cost, latency, provider, model, category |

**Consumers**: `services/token_tracker.py`, `api/admin.py`, `use_cases/admin_logs.py`, `use_cases/admin_user_analytics.py`

> [!WARNING]
> **Ghost export**: `__init__.py` (line 107) exports `ApiUsageMonthly` but this class **does not exist** anywhere in the codebase — there is no import for it and no model definition. This is a dead reference that should be removed.

---

## Summary Table

| # | Domain | Tables | Model File(s) | Lines | Refactor Priority |
|---|---|---|---|---|---|
| 1 | Core Identity & Users | 1 | `user.py` | 57 | 🟡 Medium — embedded moderation/verification fields |
| 2 | Influencer Management | 3 | `influencer.py` | 120 | 🟡 Medium — typo, plaintext password |
| 3 | Chat & Communication | 6 | `chat.py` | 125 | 🔴 High — `Chat18`/`Message18` duplication, deprecated `utcnow` |
| 4 | AI Knowledge & RAG | 3 | `knowledge.py` | 103 | 🟢 Low — cleanest domain |
| 5 | Billing & Subscriptions | 10 | `billing.py` | 388 | 🔴 **Critical** — duplicate column, legacy table, bloated file, misleading names |
| 6 | Context & Relationships | 2 | `relationship.py`, `system.py` | 88 | 🟢 Low |
| 7 | Trust, Safety & Moderation | 3 | `verification.py`, `content.py` | 185 | 🟡 Medium — misplaced `ReEngagementLog` |
| 8 | System Telemetry | 1 | `api_usage.py` | 72 | 🟡 Medium — ghost `ApiUsageMonthly` export |
| | **TOTAL** | **29** | **10 files** | **1,138** | |

---

## Code-Level Issues Discovered

| # | Severity | Location | Issue |
|---|---|---|---|
| 1 | 🔴 Bug | [billing.py:97,101](file:///Users/yoda/projects/teaseme-backend-starter/app/db/models/billing.py#L97-L101) | `InfluencerCreditTransaction.amount_cents` defined **twice** — second silently overwrites first |
| 2 | 🔴 Dead Code | [__init__.py:107](file:///Users/yoda/projects/teaseme-backend-starter/app/db/models/__init__.py#L107) | `ApiUsageMonthly` exported but **never defined or imported** |
| 3 | 🟡 Legacy | [billing.py:14-23](file:///Users/yoda/projects/teaseme-backend-starter/app/db/models/billing.py#L14-L23) | `Subscription` marked legacy — only 2 consumers, stores raw JSON blob |
| 4 | 🟡 Security | [influencer.py:94](file:///Users/yoda/projects/teaseme-backend-starter/app/db/models/influencer.py#L94) | `PreInfluencer.password` stored as plaintext `String` |
| 5 | 🟡 Naming | [influencer.py:35](file:///Users/yoda/projects/teaseme-backend-starter/app/db/models/influencer.py#L35) | Typo: `influencer_agent_id_third_part` → should be `third_party` |
| 6 | 🟡 Naming | [billing.py:364](file:///Users/yoda/projects/teaseme-backend-starter/app/db/models/billing.py#L364) | `PayPalTopUp` also handles Stripe — misleading class/table name |
| 7 | 🟡 Inconsistency | [chat.py:46](file:///Users/yoda/projects/teaseme-backend-starter/app/db/models/chat.py#L46) | `Message.created_at` uses deprecated `datetime.utcnow`; `Message18` uses correct `datetime.now(timezone.utc)` |
| 8 | 🟡 Duplication | [chat.py:54-83](file:///Users/yoda/projects/teaseme-backend-starter/app/db/models/chat.py#L54-L83) | `Chat18`/`Message18` are near-identical clones of `Chat`/`Message` |
| 9 | 🟢 Organization | [content.py:58](file:///Users/yoda/projects/teaseme-backend-starter/app/db/models/content.py#L58) | `ReEngagementLog` is in `content.py` but is a marketing/growth concern |
