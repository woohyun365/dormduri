#!/usr/bin/env bash
# dormduri-api-deploy 본문(API 묶음: api·migrate one-off·관측 다섯). scripts/infra/user-host/ssm-document.mjs가 이 파일, web 묶음
# document와 같은 ../../ssm/lib.sh, ../compose.yml(API 묶음 조각), secret_bundle.py, secret-mount contract로 SSM Command
# document(dormduri-api-deploy.json)를 만든다. 파라미터는 interpolationType ENV_VAR로 SSM_action·SSM_apiDigest·
# SSM_apiMigrateDigest·SSM_observabilityConfigDigest 환경 변수로만 받는다. 임의 명령을 받지 않는다.
# 표준 출력은 SSM 결과로 deploy role에 보이므로 RESULT·단계 줄과 digest만 쓴다. registry 주소·compose 출력은 root 전용
# host log(/opt/dormduri/state/deploy-api.log)에만 남긴다. secret 값은 어디에도 쓰지 않는다(Secrets Manager → pipe → 0400 파일).
# 순서(D-AB12): lock → secret 꺼내기·설치 → migrate·grant·role smoke·auth mail outbox 확인(one-off) → 옛 API 정지 →
# 새 API 시작 → readiness → host 안 smoke → current 갱신 → 관측(설정 펼침·관측 secret·관측 container). rollout 전 실패면
# rollout하지 않는다. rollout 뒤 실패면 직전 API 묶음으로 되돌리고(migration은 되돌리지 않음), 직전이 없으면 API를 내린 채
# 둔다(private listener는 JSON 503). 관측 단계 실패는 API 결과를 바꾸지 않는다(fail-open, RESULT의 observability=failed).
# 종료 코드: 0 성공, 1 실패(rollout 없음·되돌림·API 내림), 2 입력·상태 거부, 75 다른 배포가 실행 중(host lock).
set -euo pipefail
umask 022
export HOME=/root
export AWS_SHARED_CREDENTIALS_FILE=/root/.aws/credentials
export AWS_REGION=ap-northeast-2
export AWS_DEFAULT_REGION=ap-northeast-2
export PATH=/snap/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

base=/opt/dormduri
state=${base}/state
log=${state}/deploy-api.log
project=dormduri-web
document_name=dormduri-api-deploy
document_source=__DOCUMENT_SOURCE_SHA256__
digest_re='^sha256:[a-f0-9]{64}$'

action=${SSM_action:-}
api=${SSM_apiDigest:-}
api_migrate=${SSM_apiMigrateDigest:-}
obs=${SSM_observabilityConfigDigest:-}
case "${action}" in deploy | rollback | maintenance) ;; *)
  echo "RESULT=rejected reason=action"
  exit 2
  ;;
esac
if ! [[ ${api} =~ ${digest_re} && ${api_migrate} =~ ${digest_re} && ${obs} =~ ${digest_re} ]]; then
  echo "RESULT=rejected reason=digest"
  exit 2
fi

# host lock: web document와 같은 lock이라 두 묶음의 배포가 겹치지 않는다.
install -d -m 0700 "${state}"
exec 9>"${state}/lock"
if ! flock -n 9; then
  echo "RESULT=locked action=${action}"
  exit 75
fi

#__USER_HOST_LIB__

rotate_log
say "START action=${action} api=${api} apiMigrate=${api_migrate} observabilityConfig=${obs}"

secrets_root=${base}/secrets/api
secret_releases=${secrets_root}/releases
runtime_secret=/dormduri/production/api/runtime
migration_secret=/dormduri/production/api/migration
obs_secret=/dormduri/production/observability
runtime_uid=10001
tools=${api_state}/tools
obs_root=${base}/observability/config
obs_secrets=${base}/secrets/observability
obs_services='prometheus loki alloy alertmanager grafana'
install -d -m 0700 "${api_state}" "${tools}" "${base}/secrets" "${obs_secrets}"
install -d -m 0700 "${secrets_root}" "${secret_releases}"
install -d -m 0755 "${obs_root}"
# migrate·관측 임시 디렉터리는 단계가 지운다. 실행이 강제로 끊기면(SSM timeout의 kill 등) 남을 수 있으므로, host lock을 잡은
# 지금 남아 있는 것은 모두 지난 실행의 것이라 먼저 지운다.
rm -rf "${base}/secrets"/migrate.* "${base}/secrets"/.obs.* "${obs_root}"/.incoming.*

# web 묶음 `current`가 옛 형식(형식 표지 없음)이면 그 ingress는 private listener를 API로 보내지 않는다. deploy·rollback은
# secret을 꺼내기 전에 멈추고 maintenance만 받는다. 복구는 새 형식 web 재배포 뒤 다시 실행이다. web 묶음이 점검 mode면
# Web container가 내려가 있어 host 안 smoke가 늘 실패하므로(API만 쓸데없이 재시작된다) 같은 자리에서 멈춘다.
web_record=${web_state}/current
case "${action}" in
  deploy | rollback)
    record_is_current_format "${web_record}" || fail web-record-legacy 2
    [ ! -e "${base}/mode/maintenance" ] || fail web-maintenance 2
    ;;
esac

cat >"${tools}/secret_bundle.py" <<'PY'
#__SECRET_BUNDLE_PY__
PY
cat >"${tools}/secret-mount.contract.json" <<'JSON'
#__SECRET_CONTRACT_JSON__
JSON
chmod 0600 "${tools}/secret_bundle.py" "${tools}/secret-mount.contract.json"

registry_init
ensure_api_transit
if record_is_current_format "${web_record}"; then
  use_web_record "${web_record}" || fail web-record 2
else
  # maintenance만 여기까지 온다. 옛 형식 web 기록의 조각은 넘기지 않고 API 조각만으로 api를 내린다.
  web_fragment=''
fi

# 이름에 PID를 붙여 같은 초에 같은 digest로 다시 실행해도 secret release 이름이 겹치지 않게 한다.
new_release=api-$(date -u +%Y%m%dT%H%M%SZ)-${api:7:12}-$$
new_dir=${releases}/api/${new_release}
install -d -m 0755 "${new_dir}"
cat >"${new_dir}/compose.yml.tmp" <<'COMPOSE'
#__COMPOSE_YML__
COMPOSE
mv "${new_dir}/compose.yml.tmp" "${new_dir}/compose.yml"

# Secrets Manager 값은 pipe로만 python3에 넘긴다. 조회 실패와 묶음 형식 실패를 구분하려고 조회 실패만 표시 파일을 둔다.
secret_json() {
  aws secretsmanager get-secret-value --secret-id "$1" --query SecretString --output text 2>>"${log}" || {
    : >"${api_state}/.fetch-failed"
    return 1
  }
}
secret_py() { python3 -I "${tools}/secret_bundle.py" "$@" 2>>"${log}"; }

remove_secret_release() {
  if [ -n "$1" ]; then rm -rf "${secret_releases:?}/$1"; fi
}

# runtime 묶음을 release 디렉터리에 설치하고 이름·mode·크기·symlink·소유를 검사한다.
install_runtime_secret() {
  local release=$1 dir=${secret_releases}/$1
  rm -f "${api_state}/.fetch-failed"
  if ! secret_json "${runtime_secret}" | secret_py install "${tools}/secret-mount.contract.json" "${secret_releases}" "${release}"; then
    if [ -e "${api_state}/.fetch-failed" ]; then abort secret-fetch; fi
    abort secret-invalid
  fi
  if ! secret_py verify "${tools}/secret-mount.contract.json" "${dir}" \
    || [ "$(stat -c '%u:%g:%a' "${dir}")" != "${runtime_uid}:${runtime_uid}:500" ] \
    || find "${dir}" -mindepth 1 ! \( -type f -user "${runtime_uid}" -group "${runtime_uid}" -perm 0400 \) | grep -q .; then
    abort secret-invalid
  fi
}

# release 기록(새 조각 + 이번 secret release)을 쓴다.
write_api_record() {
  printf 'recordFormat=2\nrelease=%s\napi=%s\napi-migrate=%s\nobservability-config=%s\nfragment=%s\nsecretRelease=%s\ndocument=%s\ndocumentSource=%s\n' \
    "$2" "${api}" "${api_migrate}" "${obs}" "$3" "$4" "${document_name}" "${document_source}" >"$1"
}

# migrate one-off: migration 묶음과 이번 runtime 묶음의 DB URL 셋을 root 전용 임시 디렉터리에 0400·10001 소유로 쓰고, 단계가
# 끝나면 성공·실패와 관계없이 지운다. one-off에는 파일 단위로만 mount한다.
migrate_dir=''
cleanup_migrate() {
  if [ -n "${migrate_dir}" ]; then rm -rf "${migrate_dir}"; fi
  migrate_dir=''
}
cleanup_hook=cleanup_migrate
# rollout 전 실패: 이번 secret release·migrate 임시 파일·release 디렉터리를 지우고 끝낸다(지금 API는 그대로 돈다).
abort() {
  cleanup_migrate
  remove_secret_release "${new_release}"
  rm -rf "${new_dir}"
  fail "$1"
}
run_migrate() {
  local step key
  migrate_dir=$(mktemp -d "${base}/secrets/migrate.XXXXXX")
  rm -f "${api_state}/.fetch-failed"
  secret_json "${migration_secret}" \
    | secret_py extract "${tools}/secret-mount.contract.json" MIGRATION_DATABASE_URL "${migrate_dir}/MIGRATION_DATABASE_URL" \
    || abort migration-secret
  for key in DATABASE_URL RETENTION_WORKER_DATABASE_URL RETENTION_DISCLOSURE_DATABASE_URL; do
    install -m 0400 -o "${runtime_uid}" -g "${runtime_uid}" "${secret_releases}/${new_release}/${key}" "${migrate_dir}/${key}" \
      || abort migration-secret
  done
  export MIGRATE_SECRET_DIR=${migrate_dir}
  migrate_started=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  say "MIGRATE started=${migrate_started}"
  for step in migrate grant smoke outbox; do
    run_compose --profile migrate run --rm --no-deps migrate "${step}" || abort "${step}"
    say "MIGRATE step=${step} ok"
  done
  cleanup_migrate
}

# host 안 smoke: private listener를 거쳐 API의 공개 열람 응답이 오는지(문서 묶음 200, 또는 DB에 아직 활성 문서가 없을 때
# API가 query 뒤에 내는 500 `LEGAL_ACTIVE_DOCUMENT_BUNDLE_INCOMPLETE` envelope)와 metrics가 Web에 닫혀 있는지 본다.
# private listener는 Web container 주소만 받으므로 요청은 Web container 안의 node fetch로 보낸다. ingress resolver는 API 주소를
# 10초 cache하므로(새 container 직후 503일 수 있다) 2초 간격으로 30초까지 다시 본다.
host_smoke() {
  run_compose exec -T web node -e '
const get = async (path) => {
  const response = await fetch("http://ingress:8081" + path, { signal: AbortSignal.timeout(5000) });
  return { status: response.status, type: response.headers.get("content-type") || "", body: await response.text() };
};
const check = async () => {
  const legal = await get("/api/legal/documents/active-bundle");
  let body;
  try { body = JSON.parse(legal.body); } catch { return false; }
  const legalOk = legal.type.startsWith("application/json") && (
    (legal.status === 200 && Boolean(body.privacyPolicy) && Boolean(body.termsOfService)) ||
    (legal.status === 500 && body.code === "LEGAL_ACTIVE_DOCUMENT_BUNDLE_INCOMPLETE"));
  const metrics = await get("/internal/metrics");
  return legalOk && metrics.status === 404 && !metrics.body.includes("# HELP");
};
(async () => {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    if (await check().catch(() => false)) process.exit(0);
    await new Promise((done) => setTimeout(done, 2000));
  }
  process.exit(1);
})();
'
}

# 기록 하나의 API를 띄운다: 옛 API container를 멈추고 지운 뒤 새 container를 시작한다(D-DB10, sweep·outbox dispatcher가
# 옛·새 container에서 겹치지 않는다). readiness는 healthcheck(`/health/ready`) 대기이고, 그 뒤 host 안 smoke를 본다.
rollout_record() {
  use_api_record "$1" || return 1
  run_compose stop api || true
  run_compose rm -f api || true
  run_compose up -d --no-deps --wait --wait-timeout 180 api || return 1
  host_smoke
}
stop_api() {
  run_compose stop api || true
  run_compose rm -f api || true
}

# 관측(D-AB14, fail-open). 설정 image(FROM scratch, 설정 파일만)를 `docker create`·`docker cp`로 digest 경로에 펼치고(Owner
# 2026-11-11), 관측 secret을 그 파일을 읽는 container UID 소유 0400 파일로 쓰고(D-AB7: Slack webhook·Grafana 비밀번호는 관측
# 묶음, Prometheus scrape token은 이번 runtime release의 METRICS_BEARER_TOKEN), 관측 container를 다시 만든다. 이미 펼친 digest
# 경로는 다시 쓰지 않는다. 실패하면 지금 관측 container와 그 경로는 그대로다. 관측 container가 실제로 쓰는 digest는
# api state의 observability 파일이 기록하고, 정리는 그 경로를 지우지 않는다.
fill_obs_config() {
  local dir=${obs_root}/${1#sha256:} tmp cid status=0 file
  [ -d "${dir}" ] && return 0
  docker pull -q "$(ref observability-config "$1")" >>"${log}" 2>&1 || return 1
  tmp=$(mktemp -d "${obs_root}/.incoming.XXXXXX") || return 1
  cid=$(docker create "$(ref observability-config "$1")" /none 2>>"${log}") || status=1
  if [ "${status}" = 0 ]; then
    docker cp "${cid}:/dormduri-observability/." "${tmp}/" >>"${log}" 2>&1 || status=1
    docker rm -f "${cid}" >>"${log}" 2>&1 || true
  fi
  for file in alloy/config.alloy alloy/pipeline.alloy loki/loki.yml prometheus/prometheus.production.yml \
    alertmanager/alertmanager.production.yml grafana/provisioning/datasources/datasources.yml; do
    [ -f "${tmp}/${file}" ] || status=1
  done
  if [ "${status}" != 0 ] || find "${tmp}" ! -type f ! -type d | grep -q .; then
    rm -rf "${tmp}"
    return 1
  fi
  chown -R 0:0 "${tmp}" && chmod -R u=rwX,go=rX "${tmp}" && mv -T "${tmp}" "${dir}"
}
write_obs_secrets() {
  local tmp name status=0
  tmp=$(mktemp -d "${base}/secrets/.obs.XXXXXX") || return 1
  secret_json "${obs_secret}" | secret_py observability "${tools}/secret-mount.contract.json" "${tmp}" \
    && install -m 0400 -o 65534 -g 65534 "${secret_releases}/$1/METRICS_BEARER_TOKEN" "${tmp}/api-metrics-bearer-token" \
    || status=1
  for name in slack-webhook-url grafana-admin-password api-metrics-bearer-token; do
    [ "${status}" = 0 ] && mv -f "${tmp}/${name}" "${obs_secrets}/${name}" || status=1
  done
  rm -rf "${tmp}"
  return "${status}"
}
observability_up() {
  local digest
  digest=$(record_get "${api_state}/current" observability-config)
  obs_status=failed
  fill_obs_config "${digest}" || return 0
  write_obs_secrets "$1" || return 0
  # shellcheck disable=SC2086
  run_compose up -d --no-deps --force-recreate --wait --wait-timeout 120 ${obs_services} || return 0
  printf '%s\n' "${digest}" >"${api_state}/observability"
  obs_status=ok
}

activate_secret() {
  ln -sfn "releases/$1" "${secrets_root}/.current.tmp"
  mv -T "${secrets_root}/.current.tmp" "${secrets_root}/current"
}

# secret release는 current와 그 직전 성공 release 둘만 남긴다(D-AB7, contract minimumRetainedReleases 2). rollback은 남은
# secret release를 쓰지 않고 지금 값을 다시 꺼낸다. release 기록 디렉터리와 image는 current·previous가 가리키는 것만 둔다.
finish_records() {
  local keep record digest name dir
  keep=" $(record_get "${api_state}/current" secretRelease || true) ${1:-} "
  for dir in "${secret_releases}"/*; do
    [ -d "${dir}" ] || continue
    case "${keep}" in *" $(basename "${dir}") "*) ;; *) rm -rf "${dir}" ;; esac
  done
  prune_release_dirs api "${api_state}/current" "${api_state}/previous"
  keep=' '
  for record in "${api_state}/current" "${api_state}/previous"; do
    for name in api api-migrate observability-config; do
      digest=$(record_get "${record}" "${name}" || true)
      [ -n "${digest}" ] && keep="${keep} $(ref "${name}" "${digest}")"
    done
  done
  digest=$(cat "${api_state}/observability" 2>/dev/null || true)
  [ -n "${digest}" ] && keep="${keep} $(ref observability-config "${digest}")"
  prune_repository_images 'api api-migrate observability-config' "${keep}"
  # 관측 설정 경로도 current·previous 기록과 지금 관측 container의 digest만 남긴다.
  for dir in "${obs_root}"/*; do
    [ -d "${dir}" ] || continue
    case "${keep}" in *"/observability-config@sha256:$(basename "${dir}")"*) ;; *) rm -rf "${dir}" ;; esac
  done
}

pull_bundle() {
  registry_login || return 1
  docker pull -q "$(ref api "${api}")" >>"${log}" 2>&1 || return 1
  docker pull -q "$(ref api-migrate "${api_migrate}")" >>"${log}" 2>&1
}

case "${action}" in
  deploy)
    pull_bundle || abort pull
    install_runtime_secret "${new_release}"
    write_api_record "${new_dir}/record" "${new_release}" "${new_dir}/compose.yml" "${new_release}"
    use_api_record "${new_dir}/record" || abort api-record
    run_migrate
    had_current=0
    old_secret=''
    if [ -f "${api_state}/current" ]; then
      had_current=1
      cp "${api_state}/current" "${api_state}/.current-before"
      old_secret=$(record_get "${api_state}/current" secretRelease || true)
    fi
    if rollout_record "${new_dir}/record"; then
      # 세 digest 가운데 하나라도 다르면 다른 묶음이다(관측 설정만 바뀐 배포 포함, 단계 기록의 직전 묶음 계산과 같다).
      if [ "${had_current}" = 1 ] && { [ "$(record_get "${api_state}/.current-before" api)" != "${api}" ] \
        || [ "$(record_get "${api_state}/.current-before" api-migrate)" != "${api_migrate}" ] \
        || [ "$(record_get "${api_state}/.current-before" observability-config)" != "${obs}" ]; }; then
        record_put "${api_state}/previous" "${api_state}/.current-before"
      fi
      record_put "${api_state}/current" "${new_dir}/record"
      rm -f "${api_state}/.current-before"
      activate_secret "${new_release}"
      observability_up "${new_release}"
      finish_records "${old_secret}"
      say "RESULT=succeeded action=deploy api=${api} apiMigrate=${api_migrate} observabilityConfig=${obs} observability=${obs_status} migrateStarted=${migrate_started}"
      exit 0
    fi
    # 새 API가 readiness·host 안 smoke를 통과하지 못했다. migration은 되돌리지 않는다. 새 container를 멈춘 뒤에만 그
    # release의 secret·조각을 지운다(조각이 없으면 compose가 멈추지 못한다).
    if [ "${had_current}" = 1 ] && rollout_record "${api_state}/.current-before"; then
      remove_secret_release "${new_release}"
      rm -f "${api_state}/.current-before"
      rm -rf "${new_dir}"
      fail rolled-back-to-current
    fi
    stop_api
    remove_secret_release "${new_release}"
    rm -f "${api_state}/.current-before"
    rm -rf "${new_dir}"
    fail entered-maintenance
    ;;
  rollback)
    # 입력 묶음이 host의 previous와 같을 때만 되돌린다. migrate 단계는 다시 돌지 않는다. secret은 지금 값을 다시 꺼내 새
    # release로 설치한다(DB 비밀번호 교체 뒤에도 지금 credential로 뜬다). 조각은 previous 기록의 것을 쓴다.
    rm -rf "${new_dir}"
    [ -f "${api_state}/previous" ] || fail no-previous 2
    [ "$(record_get "${api_state}/previous" api)" = "${api}" ] \
      && [ "$(record_get "${api_state}/previous" api-migrate)" = "${api_migrate}" ] \
      && [ "$(record_get "${api_state}/previous" observability-config)" = "${obs}" ] || fail previous-mismatch 2
    [ -f "${api_state}/current" ] || fail no-current 2
    pull_bundle || abort pull
    install_runtime_secret "${new_release}"
    rollback_record=${api_state}/.rollback-record
    write_api_record "${rollback_record}" "$(record_get "${api_state}/previous" release)" \
      "$(record_get "${api_state}/previous" fragment)" "${new_release}"
    old_secret=$(record_get "${api_state}/current" secretRelease || true)
    if rollout_record "${rollback_record}"; then
      record_put "${api_state}/current" "${rollback_record}"
      rm -f "${rollback_record}" "${api_state}/previous"
      activate_secret "${new_release}"
      observability_up "${new_release}"
      finish_records "${old_secret}"
      say "RESULT=succeeded action=rollback api=${api} apiMigrate=${api_migrate} observabilityConfig=${obs} observability=${obs_status}"
      exit 0
    fi
    rm -f "${rollback_record}"
    if rollout_record "${api_state}/current"; then
      remove_secret_release "${new_release}"
      fail rollback-failed-kept-current
    fi
    stop_api
    remove_secret_release "${new_release}"
    fail entered-maintenance
    ;;
  maintenance)
    # API를 내린다. private listener는 JSON 503을 내고 web 묶음과 관측은 건드리지 않는다.
    if [ -f "${api_state}/current" ]; then
      use_api_record "${api_state}/current" || fail api-record 2
    else
      write_api_record "${new_dir}/record" "${new_release}" "${new_dir}/compose.yml" none
      use_api_record "${new_dir}/record" || fail api-record 2
    fi
    stop_api
    rm -rf "${new_dir}"
    say "RESULT=succeeded action=maintenance api=${api}"
    exit 0
    ;;
esac
