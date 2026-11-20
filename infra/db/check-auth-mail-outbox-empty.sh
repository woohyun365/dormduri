#!/usr/bin/env sh
set -eu
# psql TLS form C (infra/db/psql-tls.sh).
. "$(dirname -- "$0")/psql-tls.sh"

usage() {
  cat <<'USAGE'
Usage: infra/db/check-auth-mail-outbox-empty.sh [--dry-run]

Fails when AuthMailOutboxEvent has any row, whatever its status. The API stage
keeps signup and password reset closed and has no SES sending credential, so no
auth mail row is expected; a dispatcher without credentials ends a row as FAILED
or UNKNOWN, so a status filter would miss it. The API deploy document runs this
on the migration connection before rollout (read-only).
Required env:
  MIGRATION_DATABASE_URL
Optional:
  DB_GRANT_SCHEMA          target schema (default: public)
USAGE
}

fail() {
  echo "$1" >&2
  exit "${2:-1}"
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
case "$schema" in
  ''|*[!A-Za-z0-9_]*) fail 'invalid identifier env: DB_GRANT_SCHEMA' 64 ;;
esac

if [ -z "${MIGRATION_DATABASE_URL:-}" ]; then
  fail 'missing required env: MIGRATION_DATABASE_URL' 64
fi

if [ "$dry_run" = true ]; then
  echo "dry-run: would count every AuthMailOutboxEvent row in schema $schema read-only using MIGRATION_DATABASE_URL and fail unless 0"
  exit 0
fi

if ! command -v psql >/dev/null 2>&1; then
  fail 'missing required command: psql' 69
fi

rows="$(db_psql "$MIGRATION_DATABASE_URL" -X -q -A -t -v ON_ERROR_STOP=1 \
  -c 'SET default_transaction_read_only = on' \
  -c "SELECT count(*) FROM \"$schema\".\"AuthMailOutboxEvent\"")" ||
  fail 'failed check: MIGRATION_DATABASE_URL cannot read AuthMailOutboxEvent' 1
case "$rows" in
  0) echo 'auth mail outbox is empty' ;;
  ''|*[!0-9]*) fail 'failed check: unexpected AuthMailOutboxEvent count output' 1 ;;
  *) fail "auth mail outbox has $rows rows; stop before rollout (see the API stage deploy runbook)" 1 ;;
esac
