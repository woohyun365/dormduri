#!/usr/bin/env sh
set -eu

usage() {
  cat <<'USAGE'
Usage: infra/db/smoke-role-grants.sh [--dry-run]

Checks the production DB credential boundary after migrations and role grants.
Required env for a real smoke:
  MIGRATION_DATABASE_URL
  DATABASE_URL
  RETENTION_WORKER_DATABASE_URL
  RETENTION_DISCLOSURE_DATABASE_URL
Optional:
  DB_GRANT_SCHEMA (default: public)
USAGE
}

fail() {
  echo "$1" >&2
  exit "${2:-1}"
}

validate_identifier() {
  name="$1"
  value="$2"
  case "$value" in
    '') fail "empty identifier env: $name" 64 ;;
    *[!A-Za-z0-9_]*) fail "invalid identifier env: $name" 64 ;;
  esac
}

require_env() {
  name="$1"
  eval "value=\${$name:-}"
  if [ -z "$value" ]; then
    fail "missing required env: $name" 64
  fi
}

psql_check() {
  url="$1"
  description="$2"
  sql="$3"
  if psql "$url" -v ON_ERROR_STOP=1 -X -q -t -A -c "$sql" >/dev/null; then
    echo "ok: $description"
  else
    fail "failed smoke: $description" 1
  fi
}

assert_privilege() {
  url="$1"
  description="$2"
  table_ref="$3"
  privilege="$4"
  expected="$5"
  psql_check "$url" "$description" \
    "SELECT 1 / CASE WHEN has_table_privilege(current_user, '$table_ref', '$privilege') IS $expected THEN 1 ELSE 0 END;"
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

schema="${DB_GRANT_SCHEMA:-public}"
validate_identifier DB_GRANT_SCHEMA "$schema"

if [ "$dry_run" = true ]; then
  echo 'dry-run: would smoke MIGRATION_DATABASE_URL, DATABASE_URL, RETENTION_WORKER_DATABASE_URL, RETENTION_DISCLOSURE_DATABASE_URL'
  echo 'dry-run: would verify _prisma_migrations and role table privileges without printing URL values'
  exit 0
fi

if ! command -v psql >/dev/null 2>&1; then
  fail 'missing required command: psql' 69
fi

require_env MIGRATION_DATABASE_URL
require_env DATABASE_URL
require_env RETENTION_WORKER_DATABASE_URL
require_env RETENTION_DISCLOSURE_DATABASE_URL

psql_check "$MIGRATION_DATABASE_URL" 'migration credential can connect' 'SELECT 1;'
psql_check "$MIGRATION_DATABASE_URL" 'Prisma migrations table exists' \
  "SELECT 1 / CASE WHEN to_regclass('$schema._prisma_migrations') IS NULL THEN 0 ELSE 1 END;"
psql_check "$MIGRATION_DATABASE_URL" 'Prisma migrations table is readable by migration credential' \
  "SELECT count(*) FROM $schema._prisma_migrations;"

assert_privilege "$DATABASE_URL" 'runtime credential can read User table' "$schema.\"User\"" SELECT true
assert_privilege "$DATABASE_URL" 'runtime credential cannot read RetainedIdentity RRPD table' "$schema.\"RetainedIdentity\"" SELECT false
assert_privilege "$DATABASE_URL" 'runtime credential cannot write RetainedVaultObject RRPD table' "$schema.\"RetainedVaultObject\"" INSERT false

assert_privilege "$RETENTION_WORKER_DATABASE_URL" 'retention worker can read retained identity' "$schema.\"RetainedIdentity\"" SELECT true
assert_privilege "$RETENTION_WORKER_DATABASE_URL" 'retention worker can update retention review jobs' "$schema.\"RetentionReviewJob\"" UPDATE true
assert_privilege "$RETENTION_WORKER_DATABASE_URL" 'retention worker can read auth security events' "$schema.\"AuthSecurityEvent\"" SELECT true
assert_privilege "$RETENTION_WORKER_DATABASE_URL" 'retention worker can delete expired auth sessions' "$schema.\"AuthSession\"" DELETE true
assert_privilege "$RETENTION_WORKER_DATABASE_URL" 'retention worker can read auth mail outbox lag' "$schema.\"AuthMailOutboxEvent\"" SELECT true
assert_privilege "$RETENTION_WORKER_DATABASE_URL" 'retention worker cannot delete auth mail outbox' "$schema.\"AuthMailOutboxEvent\"" DELETE false

assert_privilege "$RETENTION_DISCLOSURE_DATABASE_URL" 'retention disclosure can read retained identity' "$schema.\"RetainedIdentity\"" SELECT true
assert_privilege "$RETENTION_DISCLOSURE_DATABASE_URL" 'retention disclosure can insert access log' "$schema.\"RetentionAccessLog\"" INSERT true
assert_privilege "$RETENTION_DISCLOSURE_DATABASE_URL" 'retention disclosure can update review jobs' "$schema.\"RetentionReviewJob\"" UPDATE true

echo 'role grant smoke complete'
