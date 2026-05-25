#!/usr/bin/env bash

set -euo pipefail

COMPOSE_CMD="${COMPOSE_CMD:-docker compose}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-teaseme}"
CONFIRM_RESTORE="${CONFIRM_RESTORE:-}"

FILE="${FILE:-${1:-}}"

if [[ -z "${FILE}" ]]; then
  echo "ERROR: FILE is required." >&2
  echo "Usage: FILE=backups/db/<name>.sql.gz bash scripts/db_restore.sh" >&2
  exit 1
fi

if [[ ! -f "${FILE}" ]]; then
  echo "ERROR: Backup file not found: ${FILE}" >&2
  exit 1
fi

if [[ ! -r "${FILE}" ]]; then
  echo "ERROR: Backup file is not readable: ${FILE}" >&2
  exit 1
fi

if [[ "${CONFIRM_RESTORE}" != "yes" ]]; then
  echo "WARNING: Restore is destructive for current DB state."
  echo "Target: service=${DB_SERVICE} db=${DB_NAME} user=${DB_USER}"
  echo "File  : ${FILE}"
  read -r -p "Type 'yes' to continue restore: " response
  if [[ "${response}" != "yes" ]]; then
    echo "Restore cancelled."
    exit 1
  fi
fi

echo "Starting restore..."
if ! gunzip -c "${FILE}" | ${COMPOSE_CMD} exec -T "${DB_SERVICE}" psql -U "${DB_USER}" -d "${DB_NAME}"; then
  echo "ERROR: Restore failed. Database may be partially restored." >&2
  exit 1
fi

echo "Restore completed successfully."
echo "Restored file: ${FILE}"
echo "Target DB    : ${DB_NAME} (service=${DB_SERVICE})"
