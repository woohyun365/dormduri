#!/usr/bin/env sh
set -eu

usage() {
  cat <<'USAGE'
Usage: infra/db/apply-role-grants.sh [--dry-run]

Applies the DB grant table in one transaction with the migration credential:
packages/database/prisma/role-grants/role-grant-matrix.csv (one row per table,
role and privilege scope) and column-classes.csv (column privacy classes).
Run after bootstrap-roles.sh (once per database) and migrate-deploy.sh.
Required env:
  MIGRATION_DATABASE_URL   dormduri_migrator (logs in as migration_owner)
Optional:
  DB_GRANT_SCHEMA          target schema (default: public)
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
validate_identifier DB_GRANT_SCHEMA "$schema"

root="$(repo_root)"
grants_dir="$root/packages/database/prisma/role-grants"
inputs_sql="$grants_dir/role-grant-inputs.sql"
matrix_csv="$grants_dir/role-grant-matrix.csv"
columns_csv="$grants_dir/column-classes.csv"
defaults_sql="$grants_dir/database-defaults.sql"
apply_sql="$grants_dir/apply-role-grants.sql"

for file in "$inputs_sql" "$matrix_csv" "$columns_csv" "$defaults_sql" "$apply_sql"; do
  if [ ! -f "$file" ]; then
    fail "missing role grant artifact: ${file#$root/}" 66
  fi
  case "$file" in
    *"'"*) fail "unsupported character in role grant artifact path: ${file#$root/}" 66 ;;
  esac
done

if [ "$dry_run" = true ]; then
  echo "dry-run: would load role-grant-matrix.csv and column-classes.csv, then apply database-defaults.sql and apply-role-grants.sql to schema $schema in one transaction using MIGRATION_DATABASE_URL"
  exit 0
fi

if ! command -v psql >/dev/null 2>&1; then
  fail 'missing required command: psql' 69
fi

echo "applying DB role grants to schema $schema using MIGRATION_DATABASE_URL"
psql "$MIGRATION_DATABASE_URL" \
  -X -q \
  -v ON_ERROR_STOP=1 \
  --single-transaction \
  -f "$inputs_sql" \
  -c "\\copy pg_temp.role_grant_matrix FROM '$matrix_csv' WITH (FORMAT csv, HEADER true)" \
  -c "\\copy pg_temp.role_grant_columns FROM '$columns_csv' WITH (FORMAT csv, HEADER true)" \
  -c "SET dormduri.grant_schema = '$schema'" \
  -f "$defaults_sql" \
  -f "$apply_sql"
echo 'role grants applied'
