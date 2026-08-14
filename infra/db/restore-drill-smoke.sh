#!/usr/bin/env sh
set -eu

usage() {
  cat <<'USAGE'
Usage: infra/db/restore-drill-smoke.sh [--dry-run]

Runs the restored DB credential smoke for a backup/restore drill by mapping
RESTORE_DRILL_* URLs to the existing production DB role-grant smoke script.
Required env for a real smoke:
  RESTORE_DRILL_MIGRATION_DATABASE_URL
  RESTORE_DRILL_DATABASE_URL
  RESTORE_DRILL_RETENTION_WORKER_DATABASE_URL
  RESTORE_DRILL_RETENTION_DISCLOSURE_DATABASE_URL
Optional:
  DB_GRANT_SCHEMA (default: public)
  EXPECTED_POSTGRES_MAJOR (default: 18)
USAGE
}

fail() {
  echo "$1" >&2
  exit "${2:-1}"
}

require_env() {
  name="$1"
  eval "value=\${$name:-}"
  if [ -z "$value" ]; then
    fail "missing required env: $name" 64
  fi
}

dry_run=false
while [ "$#" -gt 0 ]; do
  case "$1" in
    --)
      shift
      continue
      ;;
    --dry-run)
      dry_run=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      exit 64
      ;;
  esac
  shift
done

script_dir="$(cd "$(dirname "$0")" && pwd)"
role_smoke_script="$script_dir/smoke-role-grants.sh"

if [ "$dry_run" = true ]; then
  echo 'dry-run: would map RESTORE_DRILL_MIGRATION_DATABASE_URL to MIGRATION_DATABASE_URL'
  echo 'dry-run: would map RESTORE_DRILL_DATABASE_URL to DATABASE_URL'
  echo 'dry-run: would map RESTORE_DRILL_RETENTION_WORKER_DATABASE_URL to RETENTION_WORKER_DATABASE_URL'
  echo 'dry-run: would map RESTORE_DRILL_RETENTION_DISCLOSURE_DATABASE_URL to RETENTION_DISCLOSURE_DATABASE_URL'
  echo 'dry-run: would reuse infra/db/smoke-role-grants.sh without printing URL values'
  echo 'dry-run: would require the restored database to use PostgreSQL major 18 by default'
  "$role_smoke_script" --dry-run
  exit 0
fi

require_env RESTORE_DRILL_MIGRATION_DATABASE_URL
require_env RESTORE_DRILL_DATABASE_URL
require_env RESTORE_DRILL_RETENTION_WORKER_DATABASE_URL
require_env RESTORE_DRILL_RETENTION_DISCLOSURE_DATABASE_URL

expected_postgres_major="${EXPECTED_POSTGRES_MAJOR:-18}"
server_version_num="$(psql "$RESTORE_DRILL_MIGRATION_DATABASE_URL" -X -A -t -c 'SHOW server_version_num')"
actual_postgres_major="$((server_version_num / 10000))"
if [ "$actual_postgres_major" -ne "$expected_postgres_major" ]; then
  fail "restored DB PostgreSQL major mismatch: expected $expected_postgres_major, got $actual_postgres_major" 65
fi
echo "restore drill PostgreSQL major verified: $actual_postgres_major"

export MIGRATION_DATABASE_URL="$RESTORE_DRILL_MIGRATION_DATABASE_URL"
export DATABASE_URL="$RESTORE_DRILL_DATABASE_URL"
export RETENTION_WORKER_DATABASE_URL="$RESTORE_DRILL_RETENTION_WORKER_DATABASE_URL"
export RETENTION_DISCLOSURE_DATABASE_URL="$RESTORE_DRILL_RETENTION_DISCLOSURE_DATABASE_URL"

exec "$role_smoke_script"
