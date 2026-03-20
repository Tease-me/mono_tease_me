# Makefile Quickstart

Use these targets to run common tasks inside the backend container. Targets assume the project runs under Docker Compose; override variables as needed.

Architecture and documentation standards are defined in `docs/ARCHITECTURE.md`.

## Variables
- `COMPOSE` (default: `docker compose`) — set to `docker-compose` on servers that require the hyphenated CLI.
- `SERVICE` (default: `backend`) — container name where commands run.

Example for servers with `docker-compose`:
```sh
COMPOSE="docker-compose" make seed-all
```

## Seeding data
- `make seed-adult-characters` — seeds the base adult character catalog and influencer character overlays.
- `make seed-influencers` — updates influencer prompt templates/voice config.
- `make seed-pricing` — seeds or updates pricing rows.
- `make seed-users` — seeds default users (e.g., admin).
- `make seed-prompts` — seeds system prompts (BASE_SYSTEM, BASE_AUDIO_SYSTEM, etc.).
- `make seed-all` — runs all of the above in sequence.

## Database cleanup
- `make db-wipe-conversations` — truncates messages, memories, chats, and calls tables. **Destructive**.

## Database backup and restore
- `make db-backup` — creates compressed SQL backup in `./backups/db` (default keeps last 10 files).
- `make db-backup-list` — lists local backup files.
- `make db-restore FILE=backups/db/<backup>.sql.gz` — restores backup into DB (**destructive**).
  - Non-interactive restore:
    ```sh
    make db-restore FILE=backups/db/teaseme_YYYYmmdd_HHMMSS.sql.gz CONFIRM_RESTORE=yes
    ```

Optional overrides (for backup/restore):
- `COMPOSE_CMD` (passed from `COMPOSE`, defaults to `docker compose`)
- `DB_SERVICE` (default `db`)
- `DB_USER` (default `postgres`)
- `DB_NAME` (default `teaseme`)
- `BACKUP_DIR` (default `./backups/db`, backup only)
- `KEEP_LAST` (default `10`, backup only)

## Alembic migrations

### Docker (dentro do container)
- `make alembic-revision MESSAGE="add new table"` — create an autogen migration.
- `make alembic-upgrade` — apply migrations to `head`.
- `make alembic-downgrade` — roll back one revision.
- `make alembic-current` — show current migration version.
- `make alembic-history` — show migration history.
- `make alembic-stamp-production` — ⚠️ mark production DB as current (first deploy only).

### Local (fora do Docker)
- `make alembic-local-revision MESSAGE="add new field"` — create migration locally.
- `make alembic-local-upgrade` — apply migrations locally.
- `make alembic-local-current` — show current version locally.

### ⚠️ IMPORTANTE - Deploy em Produção
Após limpar as migrações antigas, na primeira vez em produção, use:
```sh
make alembic-stamp-production
```
Isto marca o banco como atualizado **sem** executar as migrações (evita recriar tabelas existentes).

Para deploys futuros, use normalmente:
```sh
make alembic-upgrade
```

## Running with a different service/container
If your API container is named differently:
```sh
SERVICE=app COMPOSE="docker-compose" make seed-users
```

## Troubleshooting
- Ensure the target container is running before invoking `make` (e.g., `docker compose up backend`).
- If `make` cannot find the container, double-check `SERVICE` matches the Compose service name.
- If commands fail with “command not found,” verify `poetry` is installed inside the container.
- If you hit `ModuleNotFoundError: No module named 'sqlalchemy'` when running `make`, the container virtualenv may be stale. Inside the container:
  ```sh
  rm -rf .venv
  make seed-prompts
  ```
