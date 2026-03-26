# Backend Staging Deploy Reference

This document records the backend staging deployment model in this repository as of March 26, 2026. It is written for backend or ops engineers who need the backend staging workflow and runtime contract without affecting the EC2 production deployment.

## Overview

The backend staging deploy is a self-hosted GitHub Actions workflow that:

1. runs when a pull request into `staging` is merged
2. executes on the staging machine itself through a self-hosted runner
3. deploys into a fixed staging directory under the runner user’s home directory
4. preserves a server-local `.env` file outside the Git repo
5. rebuilds the backend Docker image inside that fixed directory
6. runs a staging-only Postgres, Redis, and backend stack
7. exposes the backend container on port `8001`

The current backend staging path is:

```bash
$HOME/tease-me-backend-staging
```

The current staging port is:

```bash
8001
```

The current staging container name is:

```bash
teaseme-backend-staging
```

The current staging sidecar container names are:

```bash
teaseme-backend-staging-db
teaseme-backend-staging-redis
```

## Workflow Trigger And Runner

The staging deploy workflow lives in:

```text
.github/workflows/deploy-backend-staging.yml
```

Current trigger model:

- event: `pull_request`
- type: `closed`
- branch filter: `staging`
- deploy job runs only when `github.event.pull_request.merged == true`

Current runner labels:

```text
self-hosted
macOS
X64
```

The workflow does:

1. checkout repository
2. validate `scripts/deploy-backend-staging.sh` syntax
3. verify `rsync`, `docker`, and `docker compose` exist on the runner
4. run `./scripts/deploy-backend-staging.sh`

Important details:

- The workflow is intentionally thin and delegates deploy logic to the script.
- This workflow is staging-only. It does not deploy or modify production on EC2.

## Target Directory And Env File

The deployed backend is synced into a fixed directory owned by the runner user:

```bash
$HOME/tease-me-backend-staging
```

The server-local env file is expected to live at:

```bash
$HOME/tease-me-backend-staging/.env
```

This env file is not committed to the repository.

The deploy script preserves:

- `.env`
- `.env.*`

So these files survive the `rsync --delete` step on every deploy.

## Deploy Script Flow

The deploy script lives in:

```text
scripts/deploy-backend-staging.sh
```

Current behavior:

1. determine source checkout:
   - `SOURCE_DIR="${GITHUB_WORKSPACE:-$(pwd)}"`
2. determine target deploy directory:
   - `TARGET_DIR="${STAGING_APP_DIR:-$HOME/tease-me-backend-staging}"`
3. sync source into target with `rsync -a --delete`
4. preserve server-local files by excluding:
   - `.git/`
   - `.github/`
   - `.env`
   - `.env.*`
   - `.cert/`
   - local caches and runtime directories
5. validate the staging compose file:
   - `docker compose -f compose.staging.yml config`
6. rebuild and restart the full staging stack:
   - `docker compose -f compose.staging.yml up -d --build --remove-orphans`

This means the deployed backend is always rebuilt in the fixed staging directory, not run directly from the GitHub Actions checkout path.

## Docker Runtime Model

The staging compose file lives in:

```text
compose.staging.yml
```

The staging image build uses:

```text
Dockerfile.staging
```

Current staging runtime model:

- database service: `db`
- database container: `teaseme-backend-staging-db`
- redis service: `redis`
- redis container: `teaseme-backend-staging-redis`
- service name: `backend`
- container name: `teaseme-backend-staging`
- compose file: `compose.staging.yml`
- Dockerfile: `Dockerfile.staging`
- port: `8001`
- command:
  - `python -m alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8001`

Important details:

- staging does not use `--reload`
- staging does not pass TLS cert flags to `uvicorn`
- staging expects TLS termination outside the container
- staging includes its own Postgres and Redis containers
- staging `.env` should point `DB_URL` at `db` and `REDIS_URL` at `redis` within the compose network
- staging database data and Redis data persist in Docker volumes across restarts

## Smoke Test

After a successful deploy, the expected local health check is:

```bash
http://127.0.0.1:8001/health/
```

## Production Separation

Production remains out of scope for this workflow.

Production-specific guarantees:

- no production GitHub Actions deploy is introduced here
- no production EC2 Docker path is changed here
- no production compose file, port, or TLS behavior is modified by this staging workflow
