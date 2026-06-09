#!/usr/bin/env bash

set -euo pipefail

COMPOSE_CMD="${COMPOSE_CMD:-docker compose}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-teaseme}"
BACKUP_DIR="${BACKUP_DIR:-./backups/db}"
KEEP_LAST="${KEEP_LAST:-10}"

if ! [[ "$KEEP_LAST" =~ ^[0-9]+$ ]]; then
  echo "ERROR: KEEP_LAST must be a non-negative integer (got: $KEEP_LAST)" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

timestamp="$(date +%Y%m%d_%H%M%S)"
outfile="${BACKUP_DIR}/${DB_NAME}_${timestamp}.sql.gz"

echo "Starting database backup..."
echo "Compose: ${COMPOSE_CMD}"
echo "Target : service=${DB_SERVICE} db=${DB_NAME} user=${DB_USER}"
echo "Output : ${outfile}"

if ! ${COMPOSE_CMD} exec -T "${DB_SERVICE}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" | gzip > "${outfile}"; then
  echo "ERROR: Backup failed. Check compose service/container availability and credentials." >&2
  rm -f "${outfile}" || true
  exit 1
fi

size_bytes="$(wc -c < "${outfile}" | tr -d ' ')"
echo "Backup created: ${outfile} (${size_bytes} bytes)"

backups=()
while IFS= read -r backup_file; do
  backups+=("${backup_file}")
done < <(find "${BACKUP_DIR}" -maxdepth 1 -type f -name "${DB_NAME}_*.sql.gz" -print0 | xargs -0 ls -1t 2>/dev/null || true)

deleted=0
if (( ${#backups[@]} > KEEP_LAST )); then
  for old_file in "${backups[@]:KEEP_LAST}"; do
    rm -f "${old_file}"
    deleted=$((deleted + 1))
  done
fi

remaining_count="$(find "${BACKUP_DIR}" -maxdepth 1 -type f -name "${DB_NAME}_*.sql.gz" | wc -l | tr -d ' ')"
echo "Retention complete: kept=${remaining_count} deleted=${deleted} (KEEP_LAST=${KEEP_LAST})"
