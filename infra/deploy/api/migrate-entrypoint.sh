#!/usr/bin/env sh
# migrate image entrypoint(D-AB10). API 배포 document가 rollout 전에 단계마다 one-off로 부른다:
#   migrate  Prisma migrate deploy(MIGRATION_DATABASE_URL)
#   grant    grant 표 적용(MIGRATION_DATABASE_URL)
#   smoke    LOGIN user별 role smoke(넷 모두)
#   outbox   auth mail outbox 행이 상태와 관계없이 0건인지(MIGRATION_DATABASE_URL)
# secret은 read-only로 mount된 파일(MIGRATE_SECRET_DIRECTORY 아래 key 이름)에서 읽어 같은 이름 env로만 넘긴다. 값은 출력하지 않는다.
set -eu

secret_directory="${MIGRATE_SECRET_DIRECTORY:-/run/secrets/dormduri-migrate}"
db_scripts=/app/infra/db

read_secret() {
  file="$secret_directory/$1"
  if [ ! -f "$file" ] || [ -L "$file" ] || [ ! -s "$file" ]; then
    echo "missing migrate secret file: $1" >&2
    exit 66
  fi
  value=$(cat "$file")
  export "$1=$value"
  unset value
}

case "${1:-}" in
  migrate)
    read_secret MIGRATION_DATABASE_URL
    exec sh "$db_scripts/migrate-deploy.sh"
    ;;
  grant)
    read_secret MIGRATION_DATABASE_URL
    exec sh "$db_scripts/apply-role-grants.sh"
    ;;
  smoke)
    read_secret MIGRATION_DATABASE_URL
    read_secret DATABASE_URL
    read_secret RETENTION_WORKER_DATABASE_URL
    read_secret RETENTION_DISCLOSURE_DATABASE_URL
    exec sh "$db_scripts/smoke-role-grants.sh"
    ;;
  outbox)
    read_secret MIGRATION_DATABASE_URL
    exec sh "$db_scripts/check-auth-mail-outbox-empty.sh"
    ;;
  *)
    echo 'usage: migrate-entrypoint.sh migrate|grant|smoke|outbox' >&2
    exit 64
    ;;
esac
