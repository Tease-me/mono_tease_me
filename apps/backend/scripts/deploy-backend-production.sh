#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCE_DIR="${PRODUCTION_SOURCE_DIR:-$APP_DIR}"
TARGET_DIR="${PRODUCTION_APP_DIR:-$HOME/tease-me-backend}"
PRODUCTION_COMPOSE_FILE="${PRODUCTION_COMPOSE_FILE:-compose.production.yml}"

if ! command -v rsync >/dev/null 2>&1; then
  echo "rsync is required for production deploys." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required for production deploys." >&2
  exit 1
fi

mkdir -p "$TARGET_DIR"

echo "Syncing backend production source from $SOURCE_DIR into $TARGET_DIR"
rsync -a --delete \
  --exclude '.git/' \
  --exclude '.github/' \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude '.cert/' \
  --exclude '.venv/' \
  --exclude '.pytest_cache/' \
  --exclude '.ruff_cache/' \
  --exclude '__pycache__/' \
  --exclude 'logs/' \
  --exclude 'backups/' \
  --exclude 'telegram_sessions/' \
  --exclude '.DS_Store' \
  "$SOURCE_DIR"/ "$TARGET_DIR"/

cd "$TARGET_DIR"

if [ ! -f "$PRODUCTION_COMPOSE_FILE" ]; then
  echo "Missing compose file: $TARGET_DIR/$PRODUCTION_COMPOSE_FILE" >&2
  exit 1
fi

if [ ! -f ".env" ]; then
  echo "Missing server-local env file: $TARGET_DIR/.env" >&2
  exit 1
fi

if [ ! -f ".cert/key.pem" ] || [ ! -f ".cert/cert.pem" ]; then
  echo "Missing TLS certs: $TARGET_DIR/.cert/key.pem and cert.pem" >&2
  exit 1
fi

echo "Validating Docker Compose config"
docker compose -f "$PRODUCTION_COMPOSE_FILE" config >/dev/null

echo "Rebuilding and restarting production stack"
docker compose -f "$PRODUCTION_COMPOSE_FILE" up -d --build --remove-orphans

echo "Backend production deploy complete"
