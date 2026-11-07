#!/usr/bin/env sh
set -eu

usage() {
  cat <<'USAGE'
Usage: infra/db/smoke-role-grants.sh [--dry-run]

Read-only smoke of the DB credential boundary after migrations and role grants.
Each app URL logs in, reports its LOGIN user and runs one allowed and one denied
read. The migration connection then compares every table and column privilege of
PUBLIC, every group role and those LOGIN users with the grant table
(role-grant-matrix.csv), checks ownership and default privileges, and fails on any
mismatch. Other LOGIN users (human read-only users) are covered through their group
role on the migration connection.
Required env for a real smoke:
  MIGRATION_DATABASE_URL
  DATABASE_URL
  RETENTION_WORKER_DATABASE_URL
  RETENTION_DISCLOSURE_DATABASE_URL
Optional:
  DB_GRANT_SCHEMA            target schema (default: public)
  DB_EXPECTED_TABLE_OWNER    role that owns every object (default: migration_owner)
USAGE
}

fail() {
  echo "$1" >&2
  exit "${2:-1}"
}

repo_root() {
  CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd
}

# POSIX sh has no local variables; helper names are prefixed so callers keep theirs.
validate_identifier() {
  _identifier_label="$1"
  _identifier_value="$2"
  case "$_identifier_value" in
    '') fail "empty identifier: $_identifier_label" 64 ;;
    *[!A-Za-z0-9_]*) fail "invalid identifier: $_identifier_label" 64 ;;
  esac
}

require_env() {
  _env_name="$1"
  eval "_env_value=\${$_env_name:-}"
  if [ -z "$_env_value" ]; then
    fail "missing required env: $_env_name" 64
  fi
}

psql_value() {
  psql "$1" -X -q -t -A -v ON_ERROR_STOP=1 -c "$2" 2>/dev/null
}

login_users=''

# check_login <URL env> <group role> <table it reads> <table it must not read>
check_login() {
  name="$1"
  role="$2"
  allowed="$3"
  denied="$4"
  eval "url=\${$name}"
  user="$(psql_value "$url" 'SELECT current_user')" || fail "failed smoke: $name cannot connect" 1
  validate_identifier "$name LOGIN user" "$user"
  if ! psql_value "$url" "SELECT 1 FROM \"$schema\".\"$allowed\" LIMIT 0" >/dev/null; then
    fail "failed smoke: $name cannot read $allowed" 1
  fi
  denied_output="$(psql "$url" -X -q -t -A -v ON_ERROR_STOP=1 -c "SELECT 1 FROM \"$schema\".\"$denied\" LIMIT 0" 2>&1 || true)"
  case "$denied_output" in
    *'permission denied'*) ;;
    *) fail "failed smoke: $name is not denied on $denied" 1 ;;
  esac
  echo "ok: $name logs in as $user ($role), reads $allowed, denied on $denied"
  login_users="$login_users $role=$user"
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
expected_owner="${DB_EXPECTED_TABLE_OWNER:-migration_owner}"
validate_identifier DB_GRANT_SCHEMA "$schema"
validate_identifier DB_EXPECTED_TABLE_OWNER "$expected_owner"

root="$(repo_root)"
grants_dir="$root/packages/database/prisma/role-grants"
inputs_sql="$grants_dir/role-grant-inputs.sql"
matrix_csv="$grants_dir/role-grant-matrix.csv"
columns_csv="$grants_dir/column-classes.csv"
smoke_sql="$grants_dir/smoke-role-grants.sql"

for file in "$inputs_sql" "$matrix_csv" "$columns_csv" "$smoke_sql"; do
  if [ ! -f "$file" ]; then
    fail "missing role grant artifact: ${file#$root/}" 66
  fi
  case "$file" in
    *"'"*) fail "unsupported character in role grant artifact path: ${file#$root/}" 66 ;;
  esac
done

if [ "$dry_run" = true ]; then
  echo 'dry-run: would log in with DATABASE_URL, RETENTION_WORKER_DATABASE_URL and RETENTION_DISCLOSURE_DATABASE_URL and probe one allowed and one denied read each'
  echo "dry-run: would compare every table and column privilege in schema $schema with role-grant-matrix.csv on MIGRATION_DATABASE_URL (read-only), expecting owner $expected_owner, without printing URL values"
  exit 0
fi

if ! command -v psql >/dev/null 2>&1; then
  fail 'missing required command: psql' 69
fi

require_env MIGRATION_DATABASE_URL
require_env DATABASE_URL
require_env RETENTION_WORKER_DATABASE_URL
require_env RETENTION_DISCLOSURE_DATABASE_URL

check_login DATABASE_URL app_runtime User RetainedIdentity
check_login RETENTION_WORKER_DATABASE_URL retention_worker RetainedIdentity SupportTicket
check_login RETENTION_DISCLOSURE_DATABASE_URL retention_disclosure RetentionAccessLog User

migration_role="$(psql_value "$MIGRATION_DATABASE_URL" 'SELECT current_user')" ||
  fail 'failed smoke: MIGRATION_DATABASE_URL cannot connect' 1
if [ "$migration_role" != "$expected_owner" ]; then
  fail "failed smoke: MIGRATION_DATABASE_URL acts as $migration_role, expected $expected_owner" 1
fi
echo "ok: MIGRATION_DATABASE_URL acts as $migration_role"

psql "$MIGRATION_DATABASE_URL" \
  -X -q \
  -v ON_ERROR_STOP=1 \
  -f "$inputs_sql" \
  -c "\\copy pg_temp.role_grant_matrix FROM '$matrix_csv' WITH (FORMAT csv, HEADER true)" \
  -c "\\copy pg_temp.role_grant_columns FROM '$columns_csv' WITH (FORMAT csv, HEADER true)" \
  -c "SET dormduri.grant_schema = '$schema'" \
  -c "SET dormduri.expected_table_owner = '$expected_owner'" \
  -c "SET dormduri.smoke_login_users = '$login_users'" \
  -c 'SET default_transaction_read_only = on' \
  -f "$smoke_sql"

echo 'role grant smoke complete'
