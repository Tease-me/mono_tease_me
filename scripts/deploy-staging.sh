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
SYSTEM_PLIST_PATH="${STAGING_SYSTEM_PLIST_PATH:-/Library/LaunchDaemons/$SERVICE_LABEL.plist}"

ensure_user_service() {
  if launchctl print "$SERVICE_TARGET" >/dev/null 2>&1; then
    return 0
  fi

  mkdir -p "$AGENT_PLIST_DIR"
  cp "deploy/macos/$SERVICE_LABEL.plist" "$AGENT_PLIST_PATH"
  launchctl bootstrap "$LAUNCHD_DOMAIN" "$AGENT_PLIST_PATH"
  launchctl enable "$SERVICE_TARGET"
  launchctl print "$SERVICE_TARGET" >/dev/null 2>&1
}

ensure_system_service() {
  if ! sudo -n true >/dev/null 2>&1; then
    return 1
  fi

  if sudo -n launchctl print "system/$SERVICE_LABEL" >/dev/null 2>&1; then
    return 0
  fi

  if [ ! -f "$SYSTEM_PLIST_PATH" ]; then
    return 1
  fi

  sudo -n launchctl bootstrap system "$SYSTEM_PLIST_PATH"
  sudo -n launchctl enable "system/$SERVICE_LABEL"
  sudo -n launchctl print "system/$SERVICE_LABEL" >/dev/null 2>&1
}

mkdir -p "$TARGET_DIR"

rsync -a --delete \
  --exclude ".git/" \
  --exclude "node_modules/" \
  --exclude "dist/" \
  "$SOURCE_DIR/" "$TARGET_DIR/"

cd "$TARGET_DIR"

yarn install --frozen-lockfile
yarn build

if ensure_user_service; then
  launchctl setenv PORT "$PORT"
  launchctl kickstart -k "$SERVICE_TARGET"
  exit 0
fi

if ensure_system_service; then
  sudo -n launchctl kickstart -k "system/$SERVICE_LABEL"
  exit 0
fi

echo "launchd service not loaded for either $SERVICE_TARGET or system/$SERVICE_LABEL" >&2
echo "Install the plist under ~/Library/LaunchAgents or /Library/LaunchDaemons and ensure the runner can manage that launchd domain." >&2
exit 1
