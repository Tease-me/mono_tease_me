#!/bin/zsh

set -euo pipefail

SOURCE_DIR="${GITHUB_WORKSPACE:-$(pwd)}"
TARGET_DIR="${STAGING_APP_DIR:-$HOME/tease-me-staging}"
PORT="${STAGING_PORT:-4173}"
PM2_APP_NAME="${STAGING_PM2_APP_NAME:-tease-me-staging}"
PM2_ECOSYSTEM_PATH="${STAGING_PM2_ECOSYSTEM_PATH:-deploy/pm2/ecosystem.staging.config.cjs}"

mkdir -p "$TARGET_DIR"

rsync -a --delete \
  --exclude ".git/" \
  --exclude "node_modules/" \
  --exclude "dist/" \
  "$SOURCE_DIR/" "$TARGET_DIR/"

cd "$TARGET_DIR"

yarn install --frozen-lockfile
yarn build

if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 is not installed for the runner user." >&2
  echo "Install it on the Mac with: npm install -g pm2" >&2
  exit 1
fi

if [ ! -f "$PM2_ECOSYSTEM_PATH" ]; then
  echo "PM2 ecosystem file not found: $PM2_ECOSYSTEM_PATH" >&2
  exit 1
fi

STAGING_APP_DIR="$TARGET_DIR" STAGING_PORT="$PORT" pm2 startOrReload "$PM2_ECOSYSTEM_PATH" --only "$PM2_APP_NAME" --update-env
pm2 save
