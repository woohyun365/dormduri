#!/usr/bin/env sh
set -eu
# psql TLS form C (infra/db/psql-tls.sh).
. "$(dirname -- "$0")/psql-tls.sh"

usage() {
  cat <<'USAGE'
Usage: infra/db/restore-drill-smoke.sh [--dry-run]

Runs the restored DB smoke for a backup/restore drill: the PostgreSQL major, the
last applied migration (the last directory in packages/database/prisma/migrations)
and pgaudit (extension and preloaded library) on the migration connection, then the
existing production DB role-grant smoke with the RESTORE_DRILL_* URLs mapped.
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
migrations_dir="$script_dir/../../packages/database/prisma/migrations"

if [ "$dry_run" = true ]; then
  echo 'dry-run: would map RESTORE_DRILL_MIGRATION_DATABASE_URL to MIGRATION_DATABASE_URL'
  echo 'dry-run: would map RESTORE_DRILL_DATABASE_URL to DATABASE_URL'
  echo 'dry-run: would map RESTORE_DRILL_RETENTION_WORKER_DATABASE_URL to RETENTION_WORKER_DATABASE_URL'
  echo 'dry-run: would map RESTORE_DRILL_RETENTION_DISCLOSURE_DATABASE_URL to RETENTION_DISCLOSURE_DATABASE_URL'
  echo 'dry-run: would reuse infra/db/smoke-role-grants.sh without printing URL values'
  echo 'dry-run: would require the restored database to use PostgreSQL major 18 by default'
  echo 'dry-run: would require the last applied migration to be the last repository migration directory'
  echo 'dry-run: would require the pgaudit extension and its preloaded library'
  "$role_smoke_script" --dry-run
  exit 0
fi

require_env RESTORE_DRILL_MIGRATION_DATABASE_URL
require_env RESTORE_DRILL_DATABASE_URL
require_env RESTORE_DRILL_RETENTION_WORKER_DATABASE_URL
require_env RESTORE_DRILL_RETENTION_DISCLOSURE_DATABASE_URL

expected_postgres_major="${EXPECTED_POSTGRES_MAJOR:-18}"
drill_value() {
  db_psql "$RESTORE_DRILL_MIGRATION_DATABASE_URL" -X -q -A -t -v ON_ERROR_STOP=1 -c "$1"
}
server_version_num="$(drill_value 'SHOW server_version_num')"
actual_postgres_major="$((server_version_num / 10000))"
if [ "$actual_postgres_major" -ne "$expected_postgres_major" ]; then
  fail "restored DB PostgreSQL major mismatch: expected $expected_postgres_major, got $actual_postgres_major" 65
fi
echo "restore drill PostgreSQL major verified: $actual_postgres_major"

# Migration names start with a UTC timestamp, so the last directory name is the newest migration.
expected_migration="$(find "$migrations_dir" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | LC_ALL=C sort | tail -n 1)"
if [ -z "$expected_migration" ]; then
  fail 'missing repository migrations: packages/database/prisma/migrations' 66
fi
applied_migration="$(drill_value 'SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name DESC LIMIT 1')"
if [ "$applied_migration" != "$expected_migration" ]; then
  fail "restored DB last migration mismatch: expected $expected_migration, got ${applied_migration:-none}" 65
fi
echo "restore drill last migration verified: $applied_migration"

# pg_settings lists pgaudit.log only while the library is loaded (an unloaded custom setting is a hidden placeholder),
# and the extension row shows CREATE EXTENSION ran. Both readable without superuser.
pgaudit_loaded="$(drill_value "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgaudit') AND EXISTS (SELECT 1 FROM pg_settings WHERE name = 'pgaudit.log')")"
if [ "$pgaudit_loaded" != t ]; then
  fail 'restored DB pgaudit is not loaded: check the parameter group and CREATE EXTENSION pgaudit' 65
fi
echo 'restore drill pgaudit verified'

export MIGRATION_DATABASE_URL="$RESTORE_DRILL_MIGRATION_DATABASE_URL"
export DATABASE_URL="$RESTORE_DRILL_DATABASE_URL"
export RETENTION_WORKER_DATABASE_URL="$RESTORE_DRILL_RETENTION_WORKER_DATABASE_URL"
export RETENTION_DISCLOSURE_DATABASE_URL="$RESTORE_DRILL_RETENTION_DISCLOSURE_DATABASE_URL"

exec "$role_smoke_script"
