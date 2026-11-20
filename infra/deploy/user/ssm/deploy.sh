#!/usr/bin/env bash
# dormduri-web-deploy 본문(web 묶음: web·ingress). scripts/infra/user-host/ssm-document.mjs가 이 파일, lib.sh,
# ../compose.yml(web 묶음 조각)로 SSM Command document(dormduri-web-deploy.json)를 만든다. 파라미터는 interpolationType
# ENV_VAR로 SSM_action·SSM_webDigest·SSM_ingressDigest 환경 변수로만 받는다(shell에 끼워 넣지 않음). 임의 명령을 받지 않는다.
# 표준 출력은 SSM 결과로 deploy role에 보이므로 RESULT 줄과 digest만 쓴다. registry 주소가 들어가는 docker·compose 출력은
# root 전용 host log(/opt/dormduri/state/deploy.log)에만 남긴다.
# release 기록·조각·compose 규칙은 lib.sh 머리말. API 묶음 `current`가 있으면 그 조각을 함께 넘기고 web·ingress만 다룬다.
# 종료 코드: 0 성공, 1 실패(되돌림 또는 점검 mode), 2 입력·상태 거부, 75 다른 배포가 실행 중(host lock).
set -euo pipefail
umask 022
export HOME=/root
export AWS_SHARED_CREDENTIALS_FILE=/root/.aws/credentials
export AWS_REGION=ap-northeast-2
export AWS_DEFAULT_REGION=ap-northeast-2
export PATH=/snap/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

base=/opt/dormduri
state=${base}/state
mode_dir=${base}/mode
log=${state}/deploy.log
project=dormduri-web
host=dormduri.com
document_name=dormduri-web-deploy
document_source=__DOCUMENT_SOURCE_SHA256__
digest_re='^sha256:[a-f0-9]{64}$'

action=${SSM_action:-}
web=${SSM_webDigest:-}
ingress=${SSM_ingressDigest:-}
case "${action}" in deploy | rollback | maintenance) ;; *)
  echo "RESULT=rejected reason=action"
  exit 2
  ;;
esac
if ! [[ ${web} =~ ${digest_re} && ${ingress} =~ ${digest_re} ]]; then
  echo "RESULT=rejected reason=digest"
  exit 2
fi

# host lock: 상태를 바꾸는 실행은 둘 겹치지 않는다(API document와 같은 lock). 못 잡으면 아무것도 바꾸지 않고 75로 끝난다.
install -d -m 0700 "${state}"
exec 9>"${state}/lock"
if ! flock -n 9; then
  echo "RESULT=locked action=${action}"
  exit 75
fi
install -d -m 0755 "${mode_dir}"

#__USER_HOST_LIB__

rotate_log
say "START action=${action} web=${web} ingress=${ingress}"

[ -s "${base}/tls/fullchain.pem" ] && [ -s "${base}/tls/privkey.pem" ] || fail tls-missing 2

registry_init
adopt_legacy_web_records
ensure_api_transit
# API 묶음 `current`가 있으면 그 기록의 조각·변수를 함께 넘긴다(없으면 web 조각만).
use_api_record "${api_state}/current" || fail api-record 2

# 이번 실행의 web 묶음 release 기록: 조각 사본과 기록 파일을 release 디렉터리에 둔다. 이름에 PID를 붙여 같은 초에 같은
# digest로 다시 실행해도 기록된 release 디렉터리(rollback 대상의 조각)와 겹치지 않게 한다.
new_release=web-$(date -u +%Y%m%dT%H%M%SZ)-${web:7:12}-$$
new_dir=${releases}/web/${new_release}
install -d -m 0755 "${new_dir}"
cat >"${new_dir}/compose.yml.tmp" <<'COMPOSE'
#__COMPOSE_YML__
COMPOSE
mv "${new_dir}/compose.yml.tmp" "${new_dir}/compose.yml"
printf 'recordFormat=2\nrelease=%s\nweb=%s\ningress=%s\nfragment=%s\ndocument=%s\ndocumentSource=%s\n' \
  "${new_release}" "${web}" "${ingress}" "${new_dir}/compose.yml" "${document_name}" "${document_source}" \
  >"${new_dir}/record"

pull_pair() {
  registry_login || return 1
  docker pull -q "$(ref web "$1")" >>"${log}" 2>&1 || return 1
  docker pull -q "$(ref ingress "$2")" >>"${log}" 2>&1
}

# 내부 smoke: host loopback으로 canonical host에 요청해 status와 정적 화면 제목을 본다(바깥 smoke는 CD가 따로 한다).
page_ok() {
  local path=$1 want_code=$2 want_title=${3:-} body code
  body=$(mktemp)
  code=$(curl -s -o "${body}" -w '%{http_code}' --max-time 10 --resolve "${host}:443:127.0.0.1" "https://${host}${path}" || true)
  if [ "${code}" != "${want_code}" ]; then
    rm -f "${body}"
    return 1
  fi
  if [ -n "${want_title}" ] && ! grep -qF "<title>${want_title}</title>" "${body}"; then
    rm -f "${body}"
    return 1
  fi
  rm -f "${body}"
}

smoke_serving() {
  page_ok / 200 && page_ok /privacy 200 && page_ok /terms 200 \
    && page_ok /signup 503 '돔두리 — 준비 중' \
    && page_ok /__smoke_not_allowed 404 '돔두리 — 페이지를 찾을 수 없어요'
}

smoke_maintenance() {
  page_ok / 503 '돔두리 — 점검 중' && page_ok /privacy 503 '돔두리 — 점검 중'
}

# 기록 하나의 web 묶음을 띄운다(API 묶음은 기록된 current 조각을 함께 넘기기만 한다).
start_record() {
  rm -f "${mode_dir}/maintenance"
  use_web_record "$1" || return 1
  run_compose up -d $(orphan_flag) --wait --wait-timeout 120 web ingress || return 1
  smoke_serving
}

# 점검 mode: flag를 두고 ingress만 띄운 뒤 Web을 내린다. ingress마저 뜨지 않으면 web 묶음 service만 멈추고 지운다
# (API 묶음 container는 건드리지 않는다. Web 단계는 공개 출시 전이라 그 동안의 연결 거부를 받아들인다).
enter_maintenance() {
  touch "${mode_dir}/maintenance"
  chmod 0644 "${mode_dir}/maintenance"
  if use_web_record "$1" && run_compose up -d --no-deps --wait --wait-timeout 60 ingress && smoke_maintenance; then
    run_compose stop web || true
    return 0
  fi
  run_compose stop web ingress || true
  run_compose rm -f web ingress || true
  return 1
}

prune_images() {
  local keep=' ' record digest name
  for record in "$@"; do
    for name in web ingress; do
      digest=$(record_get "${record}" "${name}" || true)
      [ -n "${digest}" ] && keep="${keep} $(ref "${name}" "${digest}")"
    done
  done
  prune_repository_images 'web ingress' "${keep}"
}

finish_records() {
  prune_release_dirs web "${web_state}/current" "${web_state}/previous"
  prune_images "${web_state}/current" "${web_state}/previous"
}

case "${action}" in
  deploy)
    pull_pair "${web}" "${ingress}" || fail pull
    had_current=0
    if [ -f "${web_state}/current" ]; then
      had_current=1
      cp "${web_state}/current" "${state}/.current-before"
    fi
    if start_record "${new_dir}/record"; then
      # 직전 current가 다른 쌍이면 rollback 대상(previous)으로 남긴다.
      if [ "${had_current}" = 1 ] && { [ "$(record_get "${state}/.current-before" web)" != "${web}" ] \
        || [ "$(record_get "${state}/.current-before" ingress)" != "${ingress}" ]; }; then
        record_put "${web_state}/previous" "${state}/.current-before"
      fi
      record_put "${web_state}/current" "${new_dir}/record"
      rm -f "${state}/.current-before"
      finish_records
      say "RESULT=succeeded action=deploy web=${web} ingress=${ingress}"
      exit 0
    fi
    # 새 쌍이 health·내부 smoke를 통과하지 못했다: 직전 current의 기록된 조각으로 되돌리고, 없으면(첫 배포) 점검 mode.
    if [ "${had_current}" = 1 ] && start_record "${state}/.current-before"; then
      rm -f "${state}/.current-before"
      rm -rf "${new_dir}"
      fail rolled-back-to-current
    fi
    rm -f "${state}/.current-before"
    enter_maintenance "${new_dir}/record" || fail maintenance-failed
    fail entered-maintenance
    ;;
  rollback)
    rm -rf "${new_dir}"
    # 입력 쌍이 host의 previous와 같을 때만 되돌린다(CD가 Release 기록과 provenance로 확인한 쌍).
    [ -f "${web_state}/previous" ] || fail no-previous 2
    [ "$(record_get "${web_state}/previous" web)" = "${web}" ] \
      && [ "$(record_get "${web_state}/previous" ingress)" = "${ingress}" ] || fail previous-mismatch 2
    [ -f "${web_state}/current" ] || fail no-current 2
    pull_pair "${web}" "${ingress}" || fail pull
    # previous 기록을 그대로 current로 쓴다. 옛 형식 기록(형식 표지 없음)으로 돌아가면 current도 옛 형식이고, 그동안 API
    # document의 deploy·rollback은 멈춘다(옛 ingress는 private listener를 API로 보내지 않는다).
    if start_record "${web_state}/previous"; then
      record_put "${web_state}/current" "${web_state}/previous"
      # 되돌린 쌍은 다시 rollback 대상이 되지 않는다. host는 그보다 이전 안전 쌍을 모르므로 previous를 비운다.
      rm -f "${web_state}/previous"
      finish_records
      say "RESULT=succeeded action=rollback web=${web} ingress=${ingress}"
      exit 0
    fi
    if start_record "${web_state}/current"; then fail rollback-failed-kept-current; fi
    enter_maintenance "${web_state}/current" || fail maintenance-failed
    fail entered-maintenance
    ;;
  maintenance)
    pull_pair "${web}" "${ingress}" || fail pull
    enter_maintenance "${new_dir}/record" || fail maintenance-failed
    say "RESULT=succeeded action=maintenance ingress=${ingress}"
    exit 0
    ;;
esac
