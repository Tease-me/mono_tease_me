#!/bin/zsh

set -euo pipefail

SOURCE_DIR="${GITHUB_WORKSPACE:-$(pwd)}"
TARGET_DIR="${STAGING_APP_DIR:-$HOME/tease-me-staging}"
SERVICE_LABEL="${STAGING_SERVICE_LABEL:-com.teaseme.staging-web}"
PORT="${STAGING_PORT:-4173}"
LAUNCHD_DOMAIN="${STAGING_LAUNCHD_DOMAIN:-user/$(id -u)}"
SERVICE_TARGET="$LAUNCHD_DOMAIN/$SERVICE_LABEL"
AGENT_PLIST_DIR="${STAGING_AGENT_PLIST_DIR:-$HOME/Library/LaunchAgents}"
AGENT_PLIST_PATH="$AGENT_PLIST_DIR/$SERVICE_LABEL.plist"

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
  mkdir -p "$AGENT_PLIST_DIR"
  cp "deploy/macos/$SERVICE_LABEL.plist" "$AGENT_PLIST_PATH"
  launchctl bootstrap "$LAUNCHD_DOMAIN" "$AGENT_PLIST_PATH"
  launchctl enable "$SERVICE_TARGET"
fi

launchctl setenv PORT "$PORT"
launchctl kickstart -k "$SERVICE_TARGET"
