#!/usr/bin/env bash

set -euo pipefail

SOURCE_URL="${SOURCE_URL:-${1:-}}"
DEST_URL="${DEST_URL:-${2:-}}"
DUMP_DIR="${DUMP_DIR:-./backups/db}"
CONFIRM_COPY="${CONFIRM_COPY:-}"
KEEP_DUMP="${KEEP_DUMP:-no}"

usage() {
  cat <<'EOF'
Usage:
  SOURCE_URL='postgresql://...' DEST_URL='postgresql://...' bash scripts/db_copy_remote.sh
  bash scripts/db_copy_remote.sh 'postgresql://source...' 'postgresql://dest...'

Optional environment variables:
  DUMP_DIR=./backups/db
  CONFIRM_COPY=yes
  KEEP_DUMP=yes
EOF
}

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: Required command not found: ${cmd}" >&2
    exit 1
  fi
}

normalize_keep_dump() {
  case "${KEEP_DUMP}" in
    yes|no) ;;
    *)
      echo "ERROR: KEEP_DUMP must be 'yes' or 'no' (got: ${KEEP_DUMP})" >&2
      exit 1
      ;;
  esac
}

validate_urls() {
  if [[ -z "${SOURCE_URL}" || -z "${DEST_URL}" ]]; then
    echo "ERROR: SOURCE_URL and DEST_URL are required." >&2
    usage >&2
    exit 1
  fi

  if [[ "${SOURCE_URL}" == "${DEST_URL}" ]]; then
    echo "ERROR: SOURCE_URL and DEST_URL must not be identical." >&2
    exit 1
  fi
}

url_without_query() {
  local url="$1"
  printf '%s\n' "${url%%\?*}"
}

url_query_suffix() {
  local url="$1"
  if [[ "${url}" == *\?* ]]; then
    printf '?%s\n' "${url#*\?}"
  else
    printf '\n'
  fi
}

extract_db_name() {
  local url="$1"
  local no_query
  no_query="$(url_without_query "${url}")"
  local db_name="${no_query##*/}"

  if [[ -z "${db_name}" || "${db_name}" == "${no_query}" ]]; then
    echo "ERROR: Could not determine database name from URL: ${url}" >&2
    exit 1
  fi

  printf '%s\n' "${db_name}"
}

extract_host_label() {
  local url="$1"
  local no_query
  no_query="$(url_without_query "${url}")"
  local authority_and_path="${no_query#*://}"
  local authority="${authority_and_path%%/*}"
  local host_label="${authority##*@}"
  printf '%s\n' "${host_label}"
}

build_admin_url() {
  local url="$1"
  local no_query
  no_query="$(url_without_query "${url}")"
  local query_suffix
  query_suffix="$(url_query_suffix "${url}")"
  local prefix="${no_query%/*}"

  if [[ -z "${prefix}" || "${prefix}" == "${no_query}" ]]; then
    echo "ERROR: Could not build admin connection URL from destination URL." >&2
    exit 1
  fi

  printf '%s/postgres%s\n' "${prefix}" "${query_suffix}"
}

confirm_copy() {
  if [[ "${CONFIRM_COPY}" == "yes" ]]; then
    return
  fi

  echo "WARNING: This will overwrite the destination database."
  echo "Source      : host=${SOURCE_HOST} db=${SOURCE_DB}"
  echo "Destination : host=${DEST_HOST} db=${DEST_DB}"
  read -r -p "Type 'yes' to continue copy: " response
  if [[ "${response}" != "yes" ]]; then
    echo "Copy cancelled."
    exit 1
  fi
}

start_ts="$(date +%s)"

require_command "pg_dump"
require_command "pg_restore"
require_command "psql"
normalize_keep_dump
validate_urls

SOURCE_DB="$(extract_db_name "${SOURCE_URL}")"
DEST_DB="$(extract_db_name "${DEST_URL}")"
SOURCE_HOST="$(extract_host_label "${SOURCE_URL}")"
DEST_HOST="$(extract_host_label "${DEST_URL}")"
DEST_ADMIN_URL="$(build_admin_url "${DEST_URL}")"

mkdir -p "${DUMP_DIR}"

timestamp="$(date +%Y%m%d_%H%M%S)"
dump_file="${DUMP_DIR}/${SOURCE_DB}_to_${DEST_DB}_${timestamp}.dump"

confirm_copy

echo "Starting remote database copy..."
echo "Source      : host=${SOURCE_HOST} db=${SOURCE_DB}"
echo "Destination : host=${DEST_HOST} db=${DEST_DB}"
echo "Dump file   : ${dump_file}"

if ! pg_dump --format=custom --file="${dump_file}" "${SOURCE_URL}"; then
  echo "ERROR: pg_dump failed for source database." >&2
  rm -f "${dump_file}" || true
  exit 1
fi

echo "Dump created successfully."
echo "Resetting destination database..."

psql "${DEST_ADMIN_URL}" \
  -v ON_ERROR_STOP=1 \
  -v dest_db="${DEST_DB}" <<'SQL'
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = :'dest_db'
  AND pid <> pg_backend_pid();

SELECT format('DROP DATABASE IF EXISTS %I', :'dest_db') \gexec
SELECT format('CREATE DATABASE %I', :'dest_db') \gexec
SQL

echo "Restoring destination database..."
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname="${DEST_URL}" \
  "${dump_file}"

end_ts="$(date +%s)"
elapsed_seconds="$((end_ts - start_ts))"

if [[ "${KEEP_DUMP}" != "yes" ]]; then
  rm -f "${dump_file}"
  dump_summary="removed after restore"
else
  dump_summary="kept at ${dump_file}"
fi

echo "Database copy completed successfully."
echo "Source      : host=${SOURCE_HOST} db=${SOURCE_DB}"
echo "Destination : host=${DEST_HOST} db=${DEST_DB}"
echo "Dump file   : ${dump_summary}"
echo "Elapsed     : ${elapsed_seconds}s"
