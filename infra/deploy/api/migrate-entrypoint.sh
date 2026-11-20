#!/usr/bin/env sh
# migrate image entrypoint(D-AB10). API 배포 document가 rollout 전에 단계마다 one-off로 부른다:
#   migrate  Prisma migrate deploy(MIGRATION_DATABASE_URL)
#   grant    grant 표 적용(MIGRATION_DATABASE_URL)
#   smoke    LOGIN user별 role smoke(넷 모두)
#   outbox   auth mail outbox 행이 상태와 관계없이 0건인지(MIGRATION_DATABASE_URL)
# operator가 restore drill에서 user host의 임시 복원 DB에 부른다(infra/runbooks/operations/database/backup-restore.md):
#   restore-drill  PostgreSQL major·마지막 migration·pgaudit 확인 뒤 LOGIN user별 role smoke(넷 모두, host는 복원 endpoint)
#                  RESTORE_DRILL_EXPECTED_HOST(복원 endpoint)와 RESTORE_DRILL_SOURCE_HOST(원본 endpoint)를 env로 받아, 둘이
#                  같거나 URL 넷 중 하나라도 host가 복원 endpoint가 아니거나 hostaddr를 두면 client를 부르기 전에 64로 끝난다.
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

# url_host <url>: postgresql://user:password@host:port/db?... 의 host. password의 '@'를 건너도록 마지막 '@' 뒤를 본다.
url_host() {
  authority=${1#*://}
  authority=${authority%%[/?]*}
  authority=${authority##*@}
  printf '%s' "${authority%%:*}"
}

# restore drill이 원본 production DB를 대상으로 통과하지 않게 한다. host 값은 출력하지 않는다.
require_restore_target() {
  expected=${RESTORE_DRILL_EXPECTED_HOST:-}
  source_host=${RESTORE_DRILL_SOURCE_HOST:-}
  if [ -z "$expected" ]; then
    echo 'restore drill needs RESTORE_DRILL_EXPECTED_HOST (restored endpoint)' >&2
    exit 64
  fi
  if [ -z "$source_host" ] || [ "$source_host" = "$expected" ]; then
    echo 'restore drill needs RESTORE_DRILL_SOURCE_HOST (source endpoint) different from the expected host' >&2
    exit 64
  fi
  for key in MIGRATION_DATABASE_URL DATABASE_URL RETENTION_WORKER_DATABASE_URL RETENTION_DISCLOSURE_DATABASE_URL; do
    eval "url=\${$key}"
    case "$url" in
      *hostaddr=*)
        echo "restore drill URL must not set hostaddr: $key" >&2
        exit 64
        ;;
    esac
    if [ "$(url_host "$url")" != "$expected" ]; then
      echo "restore drill URL host is not the restored endpoint: $key" >&2
      exit 64
    fi
  done
  unset url expected source_host PGHOST PGHOSTADDR
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
  restore-drill)
    read_secret MIGRATION_DATABASE_URL prisma
    read_secret DATABASE_URL any
    read_secret RETENTION_WORKER_DATABASE_URL any
    read_secret RETENTION_DISCLOSURE_DATABASE_URL any
    require_restore_target
    export RESTORE_DRILL_MIGRATION_DATABASE_URL="$MIGRATION_DATABASE_URL" \
      RESTORE_DRILL_DATABASE_URL="$DATABASE_URL" \
      RESTORE_DRILL_RETENTION_WORKER_DATABASE_URL="$RETENTION_WORKER_DATABASE_URL" \
      RESTORE_DRILL_RETENTION_DISCLOSURE_DATABASE_URL="$RETENTION_DISCLOSURE_DATABASE_URL"
    unset MIGRATION_DATABASE_URL DATABASE_URL RETENTION_WORKER_DATABASE_URL RETENTION_DISCLOSURE_DATABASE_URL
    exec sh "$db_scripts/restore-drill-smoke.sh"
    ;;
  *)
    echo 'usage: migrate-entrypoint.sh migrate|grant|smoke|outbox|restore-drill' >&2
    exit 64
    ;;
esac
