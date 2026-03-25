#!/bin/zsh

set -euo pipefail

SOURCE_DIR="${GITHUB_WORKSPACE:-$(pwd)}"
TARGET_DIR="${STAGING_APP_DIR:-$HOME/tease-me-staging}"
SERVICE_LABEL="${STAGING_SERVICE_LABEL:-com.teaseme.staging-web}"
PORT="${STAGING_PORT:-4173}"

mkdir -p "$TARGET_DIR"

rsync -a --delete \
  --exclude ".git/" \
  --exclude "node_modules/" \
  --exclude "dist/" \
  "$SOURCE_DIR/" "$TARGET_DIR/"

cd "$TARGET_DIR"

yarn install --frozen-lockfile
yarn build

if ! sudo -n launchctl print "system/$SERVICE_LABEL" >/dev/null 2>&1; then
  echo "launchd service not loaded: system/$SERVICE_LABEL" >&2
  echo "Install the plist from deploy/macos/$SERVICE_LABEL.plist and load it before running staging deploys." >&2
  exit 1
fi

sudo -n launchctl setenv PORT "$PORT"
sudo -n launchctl kickstart -k "system/$SERVICE_LABEL"
