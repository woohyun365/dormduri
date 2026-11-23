#!/usr/bin/env bash
# dormduri-backoffice-deploy 본문(백오피스 host 묶음: admin ingress·backoffice-web·backoffice-api·Alloy, backoffice-foundation
# D-BF16). scripts/infra/backoffice-host/ssm-document.mjs가 이 파일, ./lib.sh, ../compose.yml, ../alloy/config.alloy,
# secret 묶음 script(infra/deploy/user/api/ssm/secret_bundle.py의 install·verify)와 secret contract
# (infra/deploy/backoffice-api/secret-mount.contract.json)로 SSM Command document(dormduri-backoffice-deploy.json)를 만든다.
# 파라미터는 interpolationType ENV_VAR로 SSM_action·SSM_backofficeApiDigest·SSM_backofficeWebDigest·SSM_backofficeIngressDigest
# 환경 변수로만 받는다. 임의 명령을 받지 않는다. 표준 출력은 SSM 결과로 deploy role에 보이므로 RESULT·단계 줄과 digest만 쓴다.
# registry 주소·compose 출력은 root 전용 host log(/opt/dormduri/state/deploy-backoffice.log)에만 남긴다. secret 값은 어디에도 쓰지
# 않는다(Secrets Manager → pipe → 0400 파일). 백오피스 API는 migration을 실행하지 않는다(D-SF5, api-cd가 먼저 끝낸다).
# 순서: lock → Docker 하한(engine_guard) → image 받기 → secret 꺼내기·설치 → release 디렉터리 → rollout(--wait) → host 안 smoke →
# 기록 갱신 → Alloy(fail-open). rollout 전 실패면 아무것도 바꾸지 않는다. rollout 뒤 실패면 직전 묶음으로 되돌리고, 직전이 없으면
# 세 service를 내린 채 둔다(운영자 접속 닫힘). 종료 코드: 0 성공, 1 실패, 2 입력·상태 거부, 75 다른 실행이 host lock을 잡음.
set -euo pipefail
umask 022
export HOME=/root
export AWS_SHARED_CREDENTIALS_FILE=/root/.aws/credentials
export AWS_REGION=ap-northeast-2
export AWS_DEFAULT_REGION=ap-northeast-2
export PATH=/snap/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

base=/opt/dormduri
state=${base}/state
log=${state}/deploy-backoffice.log
document_name=dormduri-backoffice-deploy
document_source=__DOCUMENT_SOURCE_SHA256__

action=${SSM_action:-}
api=${SSM_backofficeApiDigest:-}
web=${SSM_backofficeWebDigest:-}
ingress=${SSM_backofficeIngressDigest:-}
case "${action}" in deploy | rollback | maintenance) ;; *)
  echo "RESULT=rejected reason=action"
  exit 2
  ;;
esac
if ! [[ ${api} =~ ^sha256:[a-f0-9]{64}$ && ${web} =~ ^sha256:[a-f0-9]{64}$ && ${ingress} =~ ^sha256:[a-f0-9]{64}$ ]]; then
  echo "RESULT=rejected reason=digest"
  exit 2
fi

# host lock: 배포와 첫 owner 등록 code document가 같은 lock을 쓴다.
install -d -m 0700 "${state}"
exec 9>"${state}/lock"
if ! flock -n 9; then
  echo "RESULT=locked action=${action}"
  exit 75
fi

#__BACKOFFICE_HOST_LIB__

rotate_log
say "START action=${action} backofficeApi=${api} backofficeWeb=${web} backofficeIngress=${ingress}"

runtime_secret=/dormduri/production/backoffice
runtime_uid=10001
tools=${state}/tools
app_services='backoffice-api backoffice-web backoffice-ingress'
install -d -m 0700 "${tools}" "${base}/secrets" "${secrets_root}" "${secret_releases}" "${obs_secret_releases}"
install -d -m 0755 "${base}/releases" "${releases}"

cat >"${tools}/secret_bundle.py" <<'PY'
#__SECRET_BUNDLE_PY__
PY
cat >"${tools}/secret-mount.contract.json" <<'JSON'
#__SECRET_CONTRACT_JSON__
JSON
chmod 0600 "${tools}/secret_bundle.py" "${tools}/secret-mount.contract.json"
secret_py() { python3 -I "${tools}/secret_bundle.py" "$@" 2>>"${log}"; }

case "${action}" in deploy | rollback) engine_guard ;; esac
registry_init

# 이름에 PID를 붙여 같은 초에 같은 digest로 다시 실행해도 release 이름이 겹치지 않게 한다.
new_release=backoffice-$(date -u +%Y%m%dT%H%M%SZ)-${api:7:12}-$$
new_dir=${releases}/${new_release}

remove_secret_release() {
  if [ -n "$1" ]; then rm -rf "${secret_releases:?}/$1" "${obs_secret_releases:?}/$1"; fi
}
# rollout 전 실패: 이번 secret release와 release 디렉터리를 지우고 끝낸다(지금 묶음은 그대로 돈다).
abort() {
  remove_secret_release "${new_release}"
  rm -rf "${new_dir}"
  fail "$1"
}

# 백오피스 묶음을 release 디렉터리에 설치하고 검사한다. API 파일은 10001 소유 0400(디렉터리 0500), Alloy가 읽는 셋은 root 소유
# 0400 사본(디렉터리 0500)이다(capability가 없는 root는 다른 UID 소유 0400 파일을 읽지 못한다).
secret_json() {
  aws secretsmanager get-secret-value --secret-id "$1" --query SecretString --output text 2>>"${log}" || {
    : >"${state}/.fetch-failed"
    return 1
  }
}
install_secret_release() {
  local release=$1 dir=${secret_releases}/$1 obs=${obs_secret_releases}/$1 name
  rm -f "${state}/.fetch-failed"
  if ! secret_json "${runtime_secret}" | secret_py install "${tools}/secret-mount.contract.json" "${secret_releases}" "${release}"; then
    if [ -e "${state}/.fetch-failed" ]; then abort secret-fetch; fi
    abort secret-invalid
  fi
  if ! secret_py verify "${tools}/secret-mount.contract.json" "${dir}" \
    || [ "$(stat -c '%u:%g:%a' "${dir}")" != "${runtime_uid}:${runtime_uid}:500" ] \
    || find "${dir}" -mindepth 1 ! \( -type f -user "${runtime_uid}" -group "${runtime_uid}" -perm 0400 \) | grep -q .; then
    abort secret-invalid
  fi
  install -d -m 0700 "${obs}"
  for name in BACKOFFICE_METRICS_BEARER_TOKEN OBSERVABILITY_INGEST_URL OBSERVABILITY_INGEST_TOKEN; do
    install -m 0400 -o 0 -g 0 "${dir}/${name}" "${obs}/${name}" || abort secret-invalid
  done
  chmod 0500 "${obs}"
}

write_release() {
  install -d -m 0755 "${new_dir}" "${new_dir}/alloy"
  cat >"${new_dir}/compose.yml.tmp" <<'COMPOSE'
#__COMPOSE_YML__
COMPOSE
  mv "${new_dir}/compose.yml.tmp" "${new_dir}/compose.yml"
  cat >"${new_dir}/alloy/config.alloy" <<'ALLOY'
#__ALLOY_CONFIG__
ALLOY
}

# $1 기록 파일, $2 release, $3 조각, $4 secret release, 그리고 digest 셋(api web ingress).
write_record() {
  printf 'recordFormat=1\nrelease=%s\nbackoffice-api=%s\nbackoffice-web=%s\nbackoffice-ingress=%s\nfragment=%s\nsecretRelease=%s\ndocument=%s\ndocumentSource=%s\n' \
    "$2" "$5" "$6" "$7" "$3" "$4" "${document_name}" "${document_source}" >"$1"
}

# host 안 smoke(D-BF2·D-BF4): 고정 origin의 Host만 화면을 받고 다른 Host는 421, 상태 변경 BFF는 다른 Origin을 403으로 거부하고
# 고정 origin의 header는 그대로 넘긴다(port를 포함한 Host가 BFF에 닿는다), API metric은 token이 있을 때만 열린다. 그리고 묶음이
# host에 publish한 것이 127.0.0.1:4300 하나뿐이다. ingress resolver는 Web 주소를 10초 cache하므로 첫 확인은 30초까지 다시 본다.
http_code() { curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "$@" 2>>"${log}" || printf '000'; }
host_smoke() {
  local origin=http://localhost:4300 url=http://127.0.0.1:4300 code attempt container containers published
  for attempt in $(seq 1 15); do
    code=$(http_code -H 'Host: localhost:4300' "${url}/login")
    [ "${code}" = 200 ] && break
    sleep 2
  done
  [ "${code}" = 200 ] || { say "SMOKE login=${code}"; return 1; }
  code=$(http_code -H 'Host: 127.0.0.1:4300' "${url}/login")
  [ "${code}" = 421 ] || { say "SMOKE other-host=${code}"; return 1; }
  code=$(http_code -X POST -H 'Host: localhost:4300' -H 'Origin: http://localhost:3000' -H 'Sec-Fetch-Site: same-site' \
    -H 'Content-Type: application/json' --data '{}' "${url}/api/auth/logout")
  [ "${code}" = 403 ] || { say "SMOKE foreign-origin=${code}"; return 1; }
  code=$(http_code -X POST -H 'Host: localhost:4300' -H "Origin: ${origin}" -H 'Sec-Fetch-Site: same-origin' \
    -H 'Content-Type: application/json' --data '{}' "${url}/api/auth/logout")
  if [ "${code}" = 403 ] || ! [[ ${code} =~ ^[234][0-9][0-9]$ ]]; then
    say "SMOKE fixed-origin=${code}"
    return 1
  fi
  run_compose exec -T backoffice-api node -e '
const token = require("node:fs").readFileSync("/run/secrets/dormduri-backoffice/BACKOFFICE_METRICS_BEARER_TOKEN", "utf8").trim();
const url = "http://127.0.0.1:" + (process.env.BACKOFFICE_API_PORT || "4310") + "/internal/metrics";
(async () => {
  const open = await fetch(url, { headers: { authorization: "Bearer " + token }, signal: AbortSignal.timeout(5000) });
  const body = await open.text();
  const closed = await fetch(url, { signal: AbortSignal.timeout(5000) });
  process.exit(open.status === 200 && body.includes("backoffice_security_events_total") && closed.status !== 200 ? 0 : 1);
})().catch(() => process.exit(1));
' || { say "SMOKE metrics"; return 1; }
  # container ID는 공백이 없어 단어로 나눈다(document는 sh -n 검사도 지나야 해 process substitution을 쓰지 않는다).
  containers=$(docker ps -q --filter "label=com.docker.compose.project=${project}" 2>>"${log}")
  for container in ${containers}; do
    published=$(docker port "${container}" 2>>"${log}" | sort -u | tr '\n' ' ')
    case "${published}" in
      '' | '8080/tcp -> 127.0.0.1:4300 ') ;;
      *)
        say "SMOKE publish"
        return 1
        ;;
    esac
  done
  [ "$(docker port "$(docker ps -q --filter "label=com.docker.compose.project=${project}" \
    --filter label=com.docker.compose.service=backoffice-ingress)" 8080/tcp 2>>"${log}")" = '127.0.0.1:4300' ] \
    || { say "SMOKE publish"; return 1; }
}

rollout_record() {
  use_record "$1" || return 1
  # shellcheck disable=SC2086
  run_compose up -d --no-deps --pull never --wait --wait-timeout 180 ${app_services} || return 1
  host_smoke
}
stop_app() {
  # shellcheck disable=SC2086
  run_compose stop ${app_services} || true
  # shellcheck disable=SC2086
  run_compose rm -f ${app_services} || true
}

# Alloy(D-BF15, fail-open). upstream image를 받고 지금 기록의 설정·secret으로 다시 만든다. 실패하면 RESULT 줄의
# observability=failed로만 남는다. network를 쓰는 호출은 SSM step 상한(900초)보다 60초 이르게 끝낸다.
obs_deadline=840
observability_up() {
  local left
  obs_status=failed
  left=$((obs_deadline - SECONDS))
  if [ "${left}" -lt 30 ]; then
    printf '%s observability skipped: step time budget\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >>"${log}"
    return 0
  fi
  compose_limit=${left} run_compose up -d --no-deps --force-recreate --wait --wait-timeout 120 alloy || {
    printf '%s observability up failed\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >>"${log}"
    return 0
  }
  obs_status=ok
}

# secret release·release 디렉터리·image는 current·previous가 가리키는 것만 남긴다.
finish_records() {
  local keep_secret=' ' keep_dir=' ' keep_image=' ' record digest name dir value
  for record in "${state}/current" "${state}/previous"; do
    [ -f "${record}" ] || continue
    value=$(record_get "${record}" secretRelease || true)
    [ -n "${value}" ] && keep_secret="${keep_secret}${value} "
    value=$(record_get "${record}" fragment || true)
    [ -n "${value}" ] && keep_dir="${keep_dir}$(dirname "${value}") "
    for name in ${images}; do
      digest=$(record_get "${record}" "${name}" || true)
      [ -n "${digest}" ] && keep_image="${keep_image}$(ref "${name}" "${digest}") "
    done
  done
  for dir in "${secret_releases}"/* "${obs_secret_releases}"/*; do
    [ -d "${dir}" ] || continue
    case "${keep_secret}" in *" $(basename "${dir}") "*) ;; *) rm -rf "${dir}" ;; esac
  done
  for dir in "${releases}"/*; do
    [ -d "${dir}" ] || continue
    case "${keep_dir}" in *" ${dir} "*) ;; *) rm -rf "${dir}" ;; esac
  done
  docker image ls --digests --format json | KEEP="${keep_image}" REG="${registry}" REPOS="${images}" python3 -I -c '
import json, os, sys
keep = set(os.environ["KEEP"].split())
repos = {os.environ["REG"] + "/dormduri/" + name for name in os.environ["REPOS"].split()}
for line in sys.stdin:
    img = json.loads(line)
    repo, digest = img.get("Repository", ""), img.get("Digest", "")
    if repo in repos and digest.startswith("sha256:") and repo + "@" + digest not in keep:
        print(img["ID"])
' | sort -u | xargs -r docker image rm >>"${log}" 2>&1 || true
}

pull_bundle() {
  local name digest
  registry_login || return 1
  for name in ${images}; do
    case "${name}" in
      backoffice-api) digest=${api} ;;
      backoffice-web) digest=${web} ;;
      *) digest=${ingress} ;;
    esac
    docker pull -q "$(ref "${name}" "${digest}")" >>"${log}" 2>&1 || return 1
  done
}

case "${action}" in
  deploy)
    pull_bundle || abort pull
    install_secret_release "${new_release}"
    write_release
    write_record "${new_dir}/record" "${new_release}" "${new_dir}/compose.yml" "${new_release}" "${api}" "${web}" "${ingress}"
    had_current=0
    if [ -f "${state}/current" ]; then
      had_current=1
      cp "${state}/current" "${state}/.current-before"
    fi
    if rollout_record "${new_dir}/record"; then
      if [ "${had_current}" = 1 ] && { [ "$(record_get "${state}/.current-before" backoffice-api)" != "${api}" ] \
        || [ "$(record_get "${state}/.current-before" backoffice-web)" != "${web}" ] \
        || [ "$(record_get "${state}/.current-before" backoffice-ingress)" != "${ingress}" ]; }; then
        record_put "${state}/previous" "${state}/.current-before"
      fi
      record_put "${state}/current" "${new_dir}/record"
      rm -f "${state}/.current-before"
      observability_up
      finish_records
      say "RESULT=succeeded action=deploy backofficeApi=${api} backofficeWeb=${web} backofficeIngress=${ingress} observability=${obs_status}"
      exit 0
    fi
    # 새 묶음이 readiness·host 안 smoke를 통과하지 못했다. 직전 묶음을 다시 띄운 뒤에만 이번 secret·release를 지운다.
    if [ "${had_current}" = 1 ] && rollout_record "${state}/.current-before"; then
      remove_secret_release "${new_release}"
      rm -f "${state}/.current-before"
      rm -rf "${new_dir}"
      fail rolled-back-to-current
    fi
    stop_app
    remove_secret_release "${new_release}"
    rm -f "${state}/.current-before"
    rm -rf "${new_dir}"
    fail entered-maintenance
    ;;
  rollback)
    # 입력 묶음이 host의 previous와 같을 때만 되돌린다. secret은 지금 값을 다시 꺼내 새 release로 설치하고(DB 비밀번호 교체 뒤에도
    # 지금 credential로 뜬다), 조각은 previous 기록의 것을 쓴다.
    [ -f "${state}/previous" ] || fail no-previous 2
    [ "$(record_get "${state}/previous" backoffice-api)" = "${api}" ] \
      && [ "$(record_get "${state}/previous" backoffice-web)" = "${web}" ] \
      && [ "$(record_get "${state}/previous" backoffice-ingress)" = "${ingress}" ] || fail previous-mismatch 2
    [ -f "${state}/current" ] || fail no-current 2
    pull_bundle || abort pull
    install_secret_release "${new_release}"
    rollback_record=${state}/.rollback-record
    write_record "${rollback_record}" "$(record_get "${state}/previous" release)" "$(record_get "${state}/previous" fragment)" \
      "${new_release}" "${api}" "${web}" "${ingress}"
    if rollout_record "${rollback_record}"; then
      record_put "${state}/current" "${rollback_record}"
      rm -f "${rollback_record}" "${state}/previous"
      observability_up
      finish_records
      say "RESULT=succeeded action=rollback backofficeApi=${api} backofficeWeb=${web} backofficeIngress=${ingress} observability=${obs_status}"
      exit 0
    fi
    rm -f "${rollback_record}"
    if rollout_record "${state}/current"; then
      remove_secret_release "${new_release}"
      fail rollback-failed-kept-current
    fi
    stop_app
    remove_secret_release "${new_release}"
    fail entered-maintenance
    ;;
  maintenance)
    # 세 service를 내린다(운영자 접속 닫힘). Alloy는 그대로 두어 ready 실패 경보가 난다.
    if [ -f "${state}/current" ]; then
      use_record "${state}/current" || fail record 2
      stop_app
    fi
    say "RESULT=succeeded action=maintenance backofficeApi=${api}"
    exit 0
    ;;
esac
