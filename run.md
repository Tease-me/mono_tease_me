Backend

DB / Redis by environment
- Production: Postgres and Redis live on other servers (e.g. AWS RDS). Set `DB_URL` and `REDIS_URL` on the production host — never use Docker service names.
- Dev (hybrid): API runs on your machine via Poetry; only `db` + `redis` run in Docker. Use `localhost` in `.env`.
- Dev (full Docker): API + `db` + `redis` all in compose. Use `db` / `redis` hostnames in `.env`.

Easiest dev: everything in Docker

cd apps/backend
cp .env.example .env
# .env: DB_URL=...@db:5432/...  REDIS_URL=redis://redis:6379
docker compose up --build

API: https://localhost:8000
WebSocket chat: wss://localhost:8000/chat/ws/{influencer_id}
Migrations run automatically in the container.

Hybrid dev: Poetry for API, Docker for databases

cd apps/backend
poetry install
cp .env.example .env
# .env: DB_URL=...@localhost:5432/...  REDIS_URL=redis://localhost:6379
docker compose up -d db redis
poetry run alembic upgrade head
poetry run uvicorn app.main:app --reload --port 8000


# Terminal 1 — frontend
yarn install          # first time only (workspace includes apps/frontend)
yarn fe:start         # → Vite dev server on port 3000

