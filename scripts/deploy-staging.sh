#!/bin/zsh

set -euo pipefail

SOURCE_DIR="${GITHUB_WORKSPACE:-$(pwd)}"
TARGET_DIR="${STAGING_APP_DIR:-$HOME/tease-me-staging}"
SERVICE_LABEL="${STAGING_SERVICE_LABEL:-com.teaseme.staging-web}"
PORT="${STAGING_PORT:-4173}"
LAUNCHD_DOMAIN="${STAGING_LAUNCHD_DOMAIN:-gui/$(id -u)}"
SERVICE_TARGET="$LAUNCHD_DOMAIN/$SERVICE_LABEL"

mkdir -p "$TARGET_DIR"

rsync -a --delete \
  --exclude ".git/" \
  --exclude "node_modules/" \
  --exclude "dist/" \
  "$SOURCE_DIR/" "$TARGET_DIR/"

cd "$TARGET_DIR"

yarn install --frozen-lockfile
yarn build

if ! launchctl print "$SERVICE_TARGET" >/dev/null 2>&1; then
  echo "launchd service not loaded: $SERVICE_TARGET" >&2
  echo "Install the plist from deploy/macos/$SERVICE_LABEL.plist under ~/Library/LaunchAgents and load it before running staging deploys." >&2
  exit 1
fi

launchctl setenv PORT "$PORT"
launchctl kickstart -k "$SERVICE_TARGET"
