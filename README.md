# TeaseMe – Monorepo

This repository contains the full TeaseMe stack as a co-located monorepo.

| App | Path | Stack |
|-----|------|-------|
| Frontend | `apps/frontend` | React 19 · Vite 6 · TypeScript · Yarn |
| Backend | `apps/backend` | FastAPI · Python 3.11 · PostgreSQL · Redis · Poetry |

---

## Getting started

### Frontend

```bash
cd apps/frontend
yarn install
yarn start        # dev server at https://localhost:3000
yarn build        # production build
yarn lint         # ESLint
yarn test         # Playwright e2e
```

### Backend

```bash
cd apps/backend
docker compose up -d          # starts Postgres (pgvector) + Redis
poetry install
poetry run uvicorn app.main:app --reload   # API at https://localhost:8000
make lint                     # Ruff
```

Or spin up the full backend stack (including the API) with Docker:

```bash
cd apps/backend
docker compose up
```

---

## CI/CD

GitHub Actions workflows live in `.github/workflows/` and are scoped by path so only the relevant app's pipeline runs on each PR.

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `frontend-lint.yml` | PR touching `apps/frontend/**` | Install → Build → Lint |
| `frontend-deploy-staging.yml` | PR merged to `staging` (frontend changes) | Build + deploy via PM2 |
| `backend-lint.yml` | PR touching `apps/backend/**` | Poetry install → Ruff lint |
| `backend-deploy-staging.yml` | PR merged to `staging` (backend changes) | Docker Compose deploy |
| `backend-deploy-production.yml` | PR merged to `main` (backend changes) | EC2 Docker production deploy |

Production setup (Amplify frontend + EC2 backend): [docs/production-deploy.md](docs/production-deploy.md)

---

## More documentation

- [Frontend README](apps/frontend/README.md)
- [Backend README](apps/backend/README.md)
- [Backend Architecture](apps/backend/docs/ARCHITECTURE.md)
- [Backend AI Agent Guidelines](apps/backend/AGENTS.md)
