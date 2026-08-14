#!/usr/bin/env sh
set -eu

usage() {
  cat <<'USAGE'
Usage: infra/db/migrate-deploy.sh [--dry-run]

Runs Prisma migrate deploy with the production migration/admin credential.
Required env:
  MIGRATION_DATABASE_URL

The script maps MIGRATION_DATABASE_URL to Prisma CLI DIRECT_URL and DATABASE_URL
because apps/api/prisma.config.ts reads DIRECT_URL before DATABASE_URL.
USAGE
}

fail() {
  echo "$1" >&2
  exit "${2:-1}"
}

repo_root() {
  CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd
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

if [ "$dry_run" = true ]; then
  echo 'dry-run: would run Prisma migrate deploy using MIGRATION_DATABASE_URL'
  echo 'dry-run: would pass MIGRATION_DATABASE_URL as Prisma DIRECT_URL and DATABASE_URL'
  exit 0
fi

if ! command -v pnpm >/dev/null 2>&1; then
  fail 'missing required command: pnpm' 69
fi

root="$(repo_root)"

if [ ! -f "$root/apps/api/prisma/schema.prisma" ]; then
  fail 'missing Prisma schema: apps/api/prisma/schema.prisma' 66
fi

echo 'running Prisma migrate deploy using MIGRATION_DATABASE_URL'
NODE_ENV=production \
DIRECT_URL="$MIGRATION_DATABASE_URL" \
DATABASE_URL="$MIGRATION_DATABASE_URL" \
  pnpm --dir "$root/apps/api" exec prisma migrate deploy --schema prisma/schema.prisma
