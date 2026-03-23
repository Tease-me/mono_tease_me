# CLAUDE.md — TeaseMe Backend Project Hub

## What This Project Is

TeaseMe is a multi-persona conversational AI platform backend built with FastAPI, PostgreSQL (pgvector), and Redis. It powers real-time chat (WebSocket), AI voice calls (ElevenLabs + Telegram pytgcalls), relationship-stage progression, long-term memory via vector embeddings, content moderation (Grok-based), and a billing/checkout system (TMService + Stripe/PayPal webhooks). Each AI "influencer" has a unique personality, voice, knowledge base, and relationship arc with every user.

---

## Golden Rules

> **NEVER** violate these. They encode real production footguns discovered in this codebase.

1. **NEVER put business logic in route handlers.** Routes (`app/api/routes/`) must stay thin — parse request, call a service or use case, return a schema. Business rules live in `app/services/` and `app/services/use_cases/`.

2. **NEVER use blocking calls inside `async def`.** No `time.sleep()`, no sync DB drivers, no synchronous HTTP clients. Use `run_in_threadpool()` for unavoidable sync libraries. The entire stack is async (asyncpg, httpx, redis.asyncio).

3. **NEVER import from legacy empty directories.** `app/telegram/`, `app/moderation/`, `app/relationship/`, `app/constants/`, `app/errors/` are empty post-refactor stubs with only `__pycache__`. The real code lives under `app/services/`, `app/agents/`, `app/utils/`. Stale `__pycache__` imports from these dirs have caused production auth failures before.

4. **NEVER modify billing/checkout flows without understanding the atomic claim pattern.** The billing system uses `UPDATE ... WHERE status != 'billed'` to prevent race conditions during voice call webhooks. See `app/services/billing.py` and `app/services/use_cases/elevenlabs_credit_guard.py`.

5. **NEVER skip Alembic migrations for schema changes.** All model changes in `app/data/models/` must have a corresponding Alembic revision. Run `make alembic-revision MESSAGE="description"` inside Docker — never edit the DB directly.

6. **NEVER hardcode secrets or API keys.** All configuration flows through `app/core/config.py` → `Settings` (pydantic-settings) → `.env` file. The `settings` singleton is the only source of truth.

7. **NEVER commit Telegram session files.** The `telegram_sessions/` directory contains encrypted Pyrogram session data. These are `.gitignore`'d for a reason — leaking them compromises Telegram accounts.

---

## Code Tags

| Tag | Scope | Example Files |
|---|---|---|
| `[API]` | HTTP/WebSocket route handlers | `app/api/routes/chat.py`, `app/api/routes/webhooks.py` |
| `[SERVICE]` | Business logic and orchestration | `app/services/billing.py`, `app/services/chat_service.py` |
| `[USE_CASE]` | Multi-step reusable workflows | `app/services/use_cases/elevenlabs_greeting.py` |
| `[REPO]` | Database access (SELECT/INSERT/UPDATE) | `app/services/repositories/billing_repository.py` |
| `[GATEWAY]` | External service wrappers | `app/services/gateways/elevenlabs/`, `app/services/gateways/telegram/` |
| `[MODEL]` | SQLAlchemy ORM table definitions | `app/data/models/user.py`, `app/data/models/billing.py` |
| `[SCHEMA]` | Pydantic request/response shapes | `app/data/schemas/chat.py`, `app/data/schemas/billing.py` |
| `[ENUM]` | Shared enums for schemas/models | `app/data/enums/relationship_stages.py` |
| `[AGENT]` | LLM turn handlers, memory, prompts | `app/agents/turn_handler.py`, `app/agents/memory.py` |
| `[PROMPT]` | System prompt construction | `app/services/prompting/base.py`, `app/agents/prompt_utils.py` |
| `[MOD]` | Content moderation pipeline | `app/services/moderation/detector.py`, `app/services/moderation/grok.py` |
| `[WORKER]` | Background jobs and schedulers | `app/workers/scheduler.py` |
| `[MIGRATION]` | Alembic schema migrations | `alembic/versions/*.py` |
| `[INFRA]` | Redis, rate limiting, concurrency | `app/utils/infrastructure/redis_pool.py` |
| `[CONFIG]` | App configuration/settings | `app/core/config.py`, `.env` |
| `[SCRIPT]` | Seed data, ops, maintenance | `scripts/`, `app/scripts/` |
| `[UTIL]` | Stateless utility helpers | `app/utils/time.py`, `app/utils/crypto.py` |

---

## Module Ownership Map

### Chat & Conversation Engine
- `app/api/routes/chat.py` — Standard chat WebSocket + HTTP endpoints
- `app/api/routes/chat_18.py` — Adult (18+) chat variant
- `app/agents/turn_handler.py` — LLM turn handler (LangChain → OpenAI/XAI)
- `app/agents/turn_handler_18.py` — Adult turn handler variant
- `app/agents/memory.py` — Long-term memory extraction, embedding, RAG retrieval (33KB!)
- `app/agents/prompt_utils.py` — Dynamic prompt assembly
- `app/services/chat_buffer_service.py` — Message buffering and streaming
- `app/services/embeddings.py` — pgvector embedding operations
- `app/services/knowledge_rag.py` — Knowledge base RAG queries
- `app/utils/messaging/chat.py` — Chat utility helpers

### Voice Calls (ElevenLabs)
- `app/api/routes/elevenlabs.py` — ElevenLabs API endpoints
- `app/services/gateways/elevenlabs/` — Full gateway (agents, conversation, knowledge, voices)
- `app/services/use_cases/elevenlabs_*.py` — Call lifecycle, persistence, credit guard, greeting, transcripts
- `app/utils/elevenlabs_conversation.py` — Conversation utils

### Voice Calls (Telegram)
- `app/api/routes/telegram_admin.py` — Telegram admin controls
- `app/services/gateways/telegram/voice_engine.py` — pytgcalls voice engine (50KB!)
- `app/services/gateways/telegram/session_manager.py` — Pyrogram session management
- `app/services/gateways/telegram/audio_bridge.py` — Audio bridging for calls
- `app/services/gateways/telegram/handlers.py` — Event handlers
- `app/services/gateways/telegram/lifecycle.py` — Session start/stop lifecycle
- `app/services/telegram_call_service.py` — Call orchestration service
- `app/services/telegram_invite_service.py` — Invite management

### Billing & Payments
- `app/api/routes/billing.py` — Billing endpoints
- `app/api/routes/checkout.py` — Checkout flow
- `app/api/routes/webhooks.py` — Payment webhooks (Stripe/PayPal/ElevenLabs — 28KB!)
- `app/services/billing.py` — Billing logic with atomic claim pattern
- `app/services/checkout.py` — Checkout orchestration (TMService)
- `app/services/adult_character_billing.py` — Adult character billing
- `app/services/firstpromoter.py` — Affiliate/referral tracking

### Influencer Management
- `app/api/routes/influencer.py` — Influencer CRUD
- `app/api/routes/influencer_subscriptions.py` — Subscription management (22KB)
- `app/api/routes/pre_influencers.py` — Pre-registration survey flow (32KB!)
- `app/services/influencer_cleanup.py` — Influencer data cleanup
- `app/services/influencer_subscriptions.py` — Subscription logic
- `app/services/relationship_dimension_service.py` — Relationship dimensions

### Relationship Engine
- `app/api/routes/relationship.py` — Relationship stage endpoints
- `app/services/relationship/engine.py` — Stage progression engine
- `app/services/relationship/processor.py` — Signal processing (16KB)
- `app/services/relationship/signals.py` — Relationship signals
- `app/data/enums/relationship_stages.py` — Stage definitions
- `app/data/prompts/relationship_dimensions.json` — Dimension config

### Moderation
- `app/services/moderation/detector.py` — Content detection
- `app/services/moderation/grok.py` — Grok-based moderation
- `app/services/moderation/keywords.py` — Keyword lists
- `app/services/moderation/actions.py` — Moderation actions
- `app/services/prompting/moderation.py` — Moderation prompt assembly

### Auth & Verification
- `app/api/routes/auth.py` — JWT auth (access + refresh tokens)
- `app/api/routes/verification.py` — Didit KYC (26KB)
- `app/utils/auth/dependencies.py` — Auth dependencies (`get_current_user`)
- `app/services/didit.py` — KYC identity verification service

### Admin
- `app/api/routes/admin/` — Admin panel endpoints (analytics, chats, knowledge, logs, moderation, relationships, usage, users, characters)
- `app/services/use_cases/admin_*.py` — Admin use cases

### Infrastructure
- `app/core/config.py` — pydantic-settings centralized config
- `app/core/session.py` — SQLAlchemy async session factory
- `app/core/logging.py` — Centralized logging config
- `app/utils/infrastructure/redis_pool.py` — Redis connection pool
- `app/utils/infrastructure/rate_limiter.py` — Rate limiting
- `app/utils/infrastructure/idempotency.py` — Idempotent operations
- `app/utils/infrastructure/concurrency.py` — Async concurrency utils
- `app/utils/storage/s3.py` — S3 operations
- `app/services/gateways/s3_gateway.py` — S3 gateway wrapper

---

## Dev Commands

### Docker (primary)
```bash
docker compose up --build -d          # Start full stack
docker compose logs -f backend        # Tail logs
docker compose down                   # Stop (add -v to prune volumes)
```

### Database (via Docker)
```bash
make alembic-revision MESSAGE="desc"  # Create migration
make alembic-upgrade                  # Apply migrations
make alembic-downgrade                # Rollback one
make alembic-current                  # Show current revision
make db-backup                        # Backup database
make db-restore FILE=backups/db/X.sql.gz  # Restore
make db-wipe-conversations            # TRUNCATE messages, memories, chats, calls
```

### Database (local, no Docker)
```bash
make alembic-local-revision MESSAGE="desc"
make alembic-local-upgrade
make alembic-local-current
```

### Seeding
```bash
make seed-all                         # Run all seeders
make seed-influencers                 # Seed influencer personas
make seed-prompts                     # Seed system prompts
make seed-pricing                     # Seed pricing tiers
make seed-adult-characters            # Seed adult characters
make seed-subscription-plans          # Seed subscription plans
```

### Code Quality
```bash
make lint                             # Ruff check (local)
make lint-fix                         # Ruff autofix (local)
make format                           # Ruff format (local)
make lint-docker / make lint-docker-fix  # Same, inside Docker
```

### Local Dev (no Docker for app)
```bash
poetry install
poetry run uvicorn app.main:app --reload --port 8000
# With TLS:
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8080 \
  --ssl-keyfile=./.cert/key.pem --ssl-certfile=./.cert/cert.pem
```

### Ops Scripts
```bash
make rename-influencer-id OLD_ID=x NEW_ID=y EXECUTE=yes
make fake-topup USER_ID=x INFLUENCER_ID=y CENTS=z
```

---

## Repo Structure

```
teaseme-backend-starter/
├── CLAUDE.md                          # ← You are here
├── AGENTS.md                          # Layer architecture rules
├── README.md                          # Quickstart guide
├── pyproject.toml                     # Poetry deps (Python 3.11)
├── compose.yml                        # Docker Compose (backend + Postgres + Redis)
├── dockerfile                         # Backend container
├── Makefile                           # Dev command aliases
├── alembic.ini                        # Alembic config
├── .env                               # Secrets (gitignored)
├── .cert/                             # TLS certs for local dev
│
├── app/
│   ├── main.py                        # FastAPI app + lifespan + router registration
│   ├── core/                          # Config, logging, DB session
│   │   ├── config.py                  # Settings singleton (pydantic-settings)
│   │   ├── session.py                 # AsyncSession factory
│   │   └── logging.py                 # Centralized logging
│   ├── api/                           # [API] HTTP/WebSocket transport layer
│   │   ├── routes/                    # Route modules (22 files)
│   │   │   ├── admin/                 # Admin panel (12 sub-modules)
│   │   │   ├── chat.py, chat_18.py    # Chat WebSocket endpoints
│   │   │   ├── elevenlabs.py          # Voice call endpoints
│   │   │   ├── webhooks.py            # Payment/voice webhooks
│   │   │   ├── auth.py                # JWT authentication
│   │   │   ├── verification.py        # KYC verification
│   │   │   └── ...                    # billing, checkout, influencer, etc.
│   │   ├── common/                    # Shared route helpers
│   │   └── errors/                    # HTTP error mapping
│   ├── services/                      # [SERVICE] Business logic
│   │   ├── gateways/                  # [GATEWAY] External service wrappers
│   │   │   ├── elevenlabs/            # ElevenLabs API (agents, conversation, knowledge, voices)
│   │   │   ├── telegram/              # Telegram userbot (voice_engine, session_manager, audio_bridge)
│   │   │   └── s3_gateway.py          # AWS S3
│   │   ├── repositories/             # [REPO] Database access
│   │   ├── use_cases/                 # [USE_CASE] Multi-step workflows
│   │   ├── prompting/                 # [PROMPT] Prompt construction (base, adult, moderation, relationship)
│   │   ├── moderation/                # [MOD] Content moderation (Grok, keywords, detector)
│   │   ├── relationship/             # Relationship stage engine
│   │   └── *.py                       # Domain services (billing, chat, checkout, embeddings, etc.)
│   ├── agents/                        # [AGENT] LLM pipeline
│   │   ├── turn_handler.py            # Main LLM turn handler
│   │   ├── turn_handler_18.py         # Adult variant
│   │   ├── memory.py                  # Long-term memory (33KB — extraction + RAG)
│   │   ├── prompt_utils.py            # Dynamic prompt assembly
│   │   ├── prompts.py                 # Prompt templates
│   │   └── callbacks.py              # LangChain callbacks
│   ├── data/                          # Data contracts and persistence
│   │   ├── models/                    # [MODEL] SQLAlchemy ORM (15 table definitions)
│   │   ├── schemas/                   # [SCHEMA] Pydantic shapes (14 files)
│   │   ├── enums/                     # [ENUM] Shared enums
│   │   ├── configs/                   # JSON config files
│   │   └── prompts/                   # JSON prompt/dimension data
│   ├── utils/                         # [UTIL] Stateless helpers
│   │   ├── auth/                      # Auth deps (get_current_user, JWT tokens)
│   │   ├── infrastructure/            # Redis pool, rate limiter, idempotency, concurrency
│   │   ├── messaging/                 # Chat, email, push, TTS sanitizer
│   │   ├── storage/                   # S3 operations
│   │   └── *.py                       # crypto, time, telegram utils
│   ├── workers/                       # [WORKER] Background jobs
│   │   └── scheduler.py              # APScheduler re-engagement scheduler
│   └── scripts/                       # [SCRIPT] Seed data scripts
│
├── scripts/                           # [SCRIPT] Ops scripts (db_backup, rename, fake_topup)
├── alembic/versions/                  # [MIGRATION] Database migrations
├── docs/                              # Architecture docs, makefile usage, logging guidelines
├── backups/                           # Database backup storage
├── logs/                              # Application log files
└── telegram_sessions/                 # Encrypted Telegram session files (gitignored)
```
