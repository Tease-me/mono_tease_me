#!/usr/bin/env bash

set -euo pipefail

SOURCE_DIR="${GITHUB_WORKSPACE:-$(pwd)}"
TARGET_DIR="${STAGING_APP_DIR:-$HOME/tease-me-backend-staging}"
STAGING_PORT="${STAGING_PORT:-8001}"
STAGING_COMPOSE_FILE="${STAGING_COMPOSE_FILE:-compose.staging.yml}"
SERVICE_NAME="${STAGING_SERVICE_NAME:-backend}"

if ! command -v rsync >/dev/null 2>&1; then
  echo "rsync is required for staging deploys." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required for staging deploys." >&2
  exit 1
fi

mkdir -p "$TARGET_DIR"

echo "Syncing backend staging source into $TARGET_DIR"
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

if [ ! -f "$STAGING_COMPOSE_FILE" ]; then
  echo "Missing compose file: $TARGET_DIR/$STAGING_COMPOSE_FILE" >&2
  exit 1
fi

if [ ! -f ".env" ]; then
  echo "Missing server-local env file: $TARGET_DIR/.env" >&2
  exit 1
fi

export STAGING_PORT

echo "Validating Docker Compose config"
docker compose -f "$STAGING_COMPOSE_FILE" config >/dev/null

echo "Rebuilding and restarting $SERVICE_NAME on port $STAGING_PORT"
docker compose -f "$STAGING_COMPOSE_FILE" up -d --build --remove-orphans "$SERVICE_NAME"

echo "Backend staging deploy complete"
