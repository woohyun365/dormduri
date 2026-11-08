#!/usr/bin/env sh
set -eu

usage() {
  cat <<'USAGE'
Usage: infra/db/bootstrap-roles.sh [--dry-run]

Creates the DB group roles, service LOGIN users, human read-only LOGIN users and
their memberships with the RDS master user (packages/database/prisma/role-grants/
bootstrap-roles.sql). Run once per database after CREATE EXTENSION pgaudit and
before the first migration, and again after adding a role. Re-running keeps
existing roles. It sets no password: set each LOGIN user password afterwards with
psql \password and record the change in the DB permission issue.
Required env:
  BOOTSTRAP_DATABASE_URL         RDS master user URL (break-glass use)
Optional:
  DB_BOOTSTRAP_SCHEMA            schema migration_owner creates objects in (default: public)
  DB_READONLY_OPERATOR_ALIASES   comma-separated aliases ([a-z0-9_]); creates dormduri_ro_<alias>
  DB_BOOTSTRAP_PGAUDIT           on (default; requires the pgaudit extension) or off for a
                                 disposable rehearsal PostgreSQL without pgaudit only
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

if [ -z "${BOOTSTRAP_DATABASE_URL:-}" ]; then
  fail 'missing required env: BOOTSTRAP_DATABASE_URL' 64
fi

schema="${DB_BOOTSTRAP_SCHEMA:-public}"
aliases="${DB_READONLY_OPERATOR_ALIASES:-}"
pgaudit="${DB_BOOTSTRAP_PGAUDIT:-on}"
validate_identifier DB_BOOTSTRAP_SCHEMA "$schema"
case "$aliases" in
  *[!a-z0-9_,]*) fail 'invalid env: DB_READONLY_OPERATOR_ALIASES' 64 ;;
esac
case "$pgaudit" in
  on|off) ;;
  *) fail 'invalid env: DB_BOOTSTRAP_PGAUDIT must be on or off' 64 ;;
esac

root="$(repo_root)"
bootstrap_sql="$root/packages/database/prisma/role-grants/bootstrap-roles.sql"
if [ ! -f "$bootstrap_sql" ]; then
  fail 'missing role bootstrap SQL: packages/database/prisma/role-grants/bootstrap-roles.sql' 66
fi

if [ "$dry_run" = true ]; then
  echo "dry-run: would run bootstrap-roles.sql for schema $schema (pgaudit settings $pgaudit) in one transaction using BOOTSTRAP_DATABASE_URL"
  echo 'dry-run: would create group roles, service LOGIN users and read-only users for the given aliases without setting passwords'
  exit 0
fi

if ! command -v psql >/dev/null 2>&1; then
  fail 'missing required command: psql' 69
fi

echo "bootstrapping DB roles for schema $schema using BOOTSTRAP_DATABASE_URL"
psql "$BOOTSTRAP_DATABASE_URL" \
  -X -q \
  -v ON_ERROR_STOP=1 \
  --single-transaction \
  -c "SET dormduri.bootstrap_schema = '$schema'" \
  -c "SET dormduri.readonly_operator_aliases = '$aliases'" \
  -c "SET dormduri.bootstrap_pgaudit = '$pgaudit'" \
  -f "$bootstrap_sql"
echo 'DB roles bootstrapped; set LOGIN user passwords with psql \password'
