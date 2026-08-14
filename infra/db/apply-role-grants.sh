#!/usr/bin/env sh
set -eu

usage() {
  cat <<'USAGE'
Usage: infra/db/apply-role-grants.sh [--dry-run]

Applies DB role grant SQL with the production migration/admin credential.
Required env:
  MIGRATION_DATABASE_URL
Optional bounded role/schema overrides:
  DB_GRANT_SCHEMA
  DB_APP_RUNTIME_ROLE
  DB_RETENTION_WORKER_ROLE
  DB_RETENTION_DISCLOSURE_ROLE
  DB_READONLY_ROLE
  DB_MIGRATION_ROLE
USAGE
}

fail() {
  echo "$1" >&2
  exit "${2:-1}"
}

repo_root() {
  CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd
}

validate_identifier() {
  name="$1"
  value="$2"
  case "$value" in
    '') fail "empty identifier env: $name" 64 ;;
    *[!A-Za-z0-9_]*) fail "invalid identifier env: $name" 64 ;;
  esac
}

sql_literal() {
  printf "%s" "$1" | sed "s/'/''/g"
}

append_setting() {
  key="$1"
  value="$2"
  escaped_value="$(sql_literal "$value")"
  printf "SELECT set_config('%s', '%s', false);\n" "$key" "$escaped_value" >> "$settings_sql"
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

if [ -z "${MIGRATION_DATABASE_URL:-}" ]; then
  fail 'missing required env: MIGRATION_DATABASE_URL' 64
fi

schema="${DB_GRANT_SCHEMA:-public}"
app_runtime_role="${DB_APP_RUNTIME_ROLE:-app_runtime}"
retention_worker_role="${DB_RETENTION_WORKER_ROLE:-retention_worker}"
retention_disclosure_role="${DB_RETENTION_DISCLOSURE_ROLE:-retention_disclosure}"
app_readonly_role="${DB_READONLY_ROLE:-app_readonly}"
migration_role="${DB_MIGRATION_ROLE:-migration_owner}"

validate_identifier DB_GRANT_SCHEMA "$schema"
validate_identifier DB_APP_RUNTIME_ROLE "$app_runtime_role"
validate_identifier DB_RETENTION_WORKER_ROLE "$retention_worker_role"
validate_identifier DB_RETENTION_DISCLOSURE_ROLE "$retention_disclosure_role"
validate_identifier DB_READONLY_ROLE "$app_readonly_role"
validate_identifier DB_MIGRATION_ROLE "$migration_role"

root="$(repo_root)"
auth_sql="$root/apps/api/prisma/role-grants/auth-role-grants.sql"
rrpd_sql="$root/apps/api/prisma/role-grants/rrpd-role-grants.sql"

for file in "$auth_sql" "$rrpd_sql"; do
  if [ ! -f "$file" ]; then
    fail "missing role grant SQL artifact: ${file#$root/}" 66
  fi
done

if [ "$dry_run" = true ]; then
  echo 'dry-run: would apply rrpd-role-grants.sql then auth-role-grants.sql using MIGRATION_DATABASE_URL'
  echo 'dry-run: role/schema override env names validated without printing secret values'
  exit 0
fi

if ! command -v psql >/dev/null 2>&1; then
  fail 'missing required command: psql' 69
fi

settings_sql="$(mktemp)"
trap 'rm -f "$settings_sql"' EXIT HUP INT TERM
chmod 600 "$settings_sql"

append_setting knu_roommate.auth_schema "$schema"
append_setting knu_roommate.rrpd_schema "$schema"
append_setting knu_roommate.app_runtime_role "$app_runtime_role"
append_setting knu_roommate.retention_worker_role "$retention_worker_role"
append_setting knu_roommate.retention_disclosure_role "$retention_disclosure_role"
append_setting knu_roommate.app_readonly_role "$app_readonly_role"
append_setting knu_roommate.migration_role "$migration_role"

echo 'applying DB role grants using MIGRATION_DATABASE_URL'
psql "$MIGRATION_DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -X \
  -f "$settings_sql" \
  -f "$rrpd_sql" \
  -f "$auth_sql"
