#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="${DIST_DIR:-$APP_DIR/dist}"
PORT="${PORT:-4173}"
HOST="${HOST:-0.0.0.0}"

if [ ! -d "$DIST_DIR" ]; then
  echo "dist directory not found: $DIST_DIR" >&2
  exit 1
fi

export DIST_DIR
export PORT
export HOST

exec node "$SCRIPT_DIR/serve-dist.mjs"
