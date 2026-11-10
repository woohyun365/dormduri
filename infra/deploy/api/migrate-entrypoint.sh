#!/usr/bin/env sh
# migrate image entrypoint(D-AB10). API 배포 document가 rollout 전에 단계마다 one-off로 부른다:
#   migrate  Prisma migrate deploy(MIGRATION_DATABASE_URL)
#   grant    grant 표 적용(MIGRATION_DATABASE_URL)
#   smoke    LOGIN user별 role smoke(넷 모두)
#   outbox   auth mail outbox 행이 상태와 관계없이 0건인지(MIGRATION_DATABASE_URL)
# secret은 read-only로 mount된 파일(MIGRATE_SECRET_DIRECTORY 아래 key 이름)에서 읽어 같은 이름 env로만 넘긴다. 값은 출력하지 않는다.
# 읽을 때 URL이 서버 인증서와 host 이름을 검증하는 형식인지 보고(migration은 Prisma CLI가 검증하는 형식 B만), 아니면 어느
# client도 부르지 않고 64로 끝난다. local·CI의 "TLS 인자 없는 URL은 호출자 env 그대로"는 이 운영 one-off에 없다.
set -eu

secret_directory="${MIGRATE_SECRET_DIRECTORY:-/run/secrets/dormduri-migrate}"
db_scripts="${MIGRATE_DB_SCRIPTS:-/app/infra/db}"
. "$db_scripts/psql-tls.sh"

# read_secret <key> <prisma|any>
read_secret() {
  file="$secret_directory/$1"
  if [ ! -f "$file" ] || [ -L "$file" ] || [ ! -s "$file" ]; then
    echo "missing migrate secret file: $1" >&2
    exit 66
  fi
  value=$(cat "$file")
  db_require_verified_tls "$2" "$1" "$value"
  export "$1=$value"
  unset value
}

case "${1:-}" in
  migrate)
    read_secret MIGRATION_DATABASE_URL prisma
    exec sh "$db_scripts/migrate-deploy.sh"
    ;;
  grant)
    read_secret MIGRATION_DATABASE_URL prisma
    exec sh "$db_scripts/apply-role-grants.sh"
    ;;
  smoke)
    read_secret MIGRATION_DATABASE_URL prisma
    read_secret DATABASE_URL any
    read_secret RETENTION_WORKER_DATABASE_URL any
    read_secret RETENTION_DISCLOSURE_DATABASE_URL any
    exec sh "$db_scripts/smoke-role-grants.sh"
    ;;
  outbox)
    read_secret MIGRATION_DATABASE_URL prisma
    exec sh "$db_scripts/check-auth-mail-outbox-empty.sh"
    ;;
  *)
    echo 'usage: migrate-entrypoint.sh migrate|grant|smoke|outbox' >&2
    exit 64
    ;;
esac
