#!/usr/bin/env bash
# dormduri-web-deploy 본문. scripts/infra/user-host/ssm-document.mjs가 이 파일과 ../compose.yml로 SSM Command document
# (dormduri-web-deploy.json)를 만든다. 파라미터는 interpolationType ENV_VAR로 SSM_action·SSM_webDigest·SSM_ingressDigest
# 환경 변수로만 받는다(shell에 끼워 넣지 않음). 임의 명령을 받지 않는다.
# 표준 출력은 SSM 결과로 deploy role에 보이므로 RESULT 줄과 digest만 쓴다. registry 주소가 들어가는 docker·compose 출력은
# root 전용 host log(/opt/dormduri/state/deploy.log)에만 남긴다.
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
compose_file=${base}/compose/compose.yml
log=${state}/deploy.log
project=dormduri-web
host=dormduri.com
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

# host lock: 상태를 바꾸는 실행은 둘 겹치지 않는다. 못 잡으면 아무것도 바꾸지 않고 75로 끝난다.
install -d -m 0700 "${state}"
exec 9>"${state}/lock"
if ! flock -n 9; then
  echo "RESULT=locked action=${action}"
  exit 75
fi
install -d -m 0755 "${mode_dir}"

# host log는 5MiB를 넘으면 한 번 돌린다(root 전용, 바깥으로 보내지 않음).
if [ -f "${log}" ] && [ "$(stat -c %s "${log}")" -gt 5242880 ]; then mv -f "${log}" "${log}.1"; fi

say() {
  local line
  line="$(date -u +%Y-%m-%dT%H:%M:%SZ) $*"
  printf '%s\n' "${line}"
  printf '%s\n' "${line}" >>"${log}"
}
fail() {
  say "RESULT=failed action=${action} reason=$1"
  exit "${2:-1}"
}
say "START action=${action} web=${web} ingress=${ingress}"

[ -s "${base}/tls/fullchain.pem" ] && [ -s "${base}/tls/privkey.pem" ] || fail tls-missing 2

install -d -m 0755 "$(dirname "${compose_file}")"
cat >"${compose_file}.tmp" <<'COMPOSE'
#__COMPOSE_YML__
COMPOSE
mv "${compose_file}.tmp" "${compose_file}"

account=$(aws sts get-caller-identity --query Account --output text 2>>"${log}") || fail sts
registry="${account}.dkr.ecr.${AWS_REGION}.amazonaws.com"
unset account
cleanup() { docker logout "${registry}" >/dev/null 2>&1 || true; }
trap cleanup EXIT

ref() { printf '%s/dormduri/%s@%s' "${registry}" "$1" "$2"; }
release_of() { printf 'web-%s' "${1:7:12}"; }

read_pair() {
  p_web=""
  p_ingress=""
  [ -f "$1" ] || return 1
  p_web=$(sed -n 's/^web=//p' "$1")
  p_ingress=$(sed -n 's/^ingress=//p' "$1")
  [[ ${p_web} =~ ${digest_re} && ${p_ingress} =~ ${digest_re} ]]
}
write_pair() {
  printf 'web=%s\ningress=%s\n' "$2" "$3" >"$1.tmp"
  mv "$1.tmp" "$1"
}

compose() {
  local w=$1 i=$2
  shift 2
  WEB_IMAGE=$(ref web "${w}") INGRESS_IMAGE=$(ref ingress "${i}") WEB_RELEASE=$(release_of "${w}") \
    docker compose -p "${project}" -f "${compose_file}" "$@" >>"${log}" 2>&1
}

pull_pair() {
  aws ecr get-login-password 2>>"${log}" | docker login --username AWS --password-stdin "${registry}" >>"${log}" 2>&1 || return 1
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

start_pair() {
  rm -f "${mode_dir}/maintenance"
  compose "$1" "$2" up -d --remove-orphans --wait --wait-timeout 120 || return 1
  smoke_serving
}

# 점검 mode: flag를 두고 ingress만 띄운 뒤 Web을 내린다. ingress마저 뜨지 않으면 compose를 내린다
# (Web 단계는 공개 출시 전이라 연결 거부를 받아들인다, production-web-baseline §6).
enter_maintenance() {
  touch "${mode_dir}/maintenance"
  chmod 0644 "${mode_dir}/maintenance"
  if compose "$1" "$2" up -d --no-deps --wait --wait-timeout 60 ingress && smoke_maintenance; then
    compose "$1" "$2" stop web || true
    return 0
  fi
  compose "$1" "$2" down --remove-orphans || true
  return 1
}

prune_images() {
  local keep=" $(ref web "$1") $(ref ingress "$2")"
  if read_pair "${state}/previous"; then keep="${keep} $(ref web "${p_web}") $(ref ingress "${p_ingress}")"; fi
  docker image ls --digests --format json | KEEP="${keep}" REG="${registry}" python3 -c '
import json, os, sys
keep = set(os.environ["KEEP"].split())
prefix = os.environ["REG"] + "/dormduri/"
for line in sys.stdin:
    img = json.loads(line)
    repo, digest = img.get("Repository", ""), img.get("Digest", "")
    if repo.startswith(prefix) and digest.startswith("sha256:") and repo + "@" + digest not in keep:
        print(img["ID"])
' | sort -u | xargs -r docker image rm >>"${log}" 2>&1 || true
}

case "${action}" in
  deploy)
    pull_pair "${web}" "${ingress}" || fail pull
    had_current=0
    if read_pair "${state}/current"; then
      had_current=1
      c_web=${p_web}
      c_ingress=${p_ingress}
    fi
    if start_pair "${web}" "${ingress}"; then
      if [ "${had_current}" = 1 ] && { [ "${c_web}" != "${web}" ] || [ "${c_ingress}" != "${ingress}" ]; }; then
        write_pair "${state}/previous" "${c_web}" "${c_ingress}"
      fi
      write_pair "${state}/current" "${web}" "${ingress}"
      prune_images "${web}" "${ingress}"
      say "RESULT=succeeded action=deploy web=${web} ingress=${ingress}"
      exit 0
    fi
    # 새 쌍이 health·내부 smoke를 통과하지 못했다: 직전 current로 되돌리고, 없으면(첫 배포) 점검 mode.
    if [ "${had_current}" = 1 ] && start_pair "${c_web}" "${c_ingress}"; then
      fail rolled-back-to-current
    fi
    enter_maintenance "${web}" "${ingress}" || fail maintenance-failed
    fail entered-maintenance
    ;;
  rollback)
    # 입력 쌍이 host의 previous와 같을 때만 되돌린다(CD가 Release 기록과 provenance로 확인한 쌍).
    read_pair "${state}/previous" || fail no-previous 2
    [ "${p_web}" = "${web}" ] && [ "${p_ingress}" = "${ingress}" ] || fail previous-mismatch 2
    read_pair "${state}/current" || fail no-current 2
    c_web=${p_web}
    c_ingress=${p_ingress}
    pull_pair "${web}" "${ingress}" || fail pull
    if start_pair "${web}" "${ingress}"; then
      write_pair "${state}/previous" "${c_web}" "${c_ingress}"
      write_pair "${state}/current" "${web}" "${ingress}"
      say "RESULT=succeeded action=rollback web=${web} ingress=${ingress}"
      exit 0
    fi
    if start_pair "${c_web}" "${c_ingress}"; then fail rollback-failed-kept-current; fi
    enter_maintenance "${c_web}" "${c_ingress}" || fail maintenance-failed
    fail entered-maintenance
    ;;
  maintenance)
    pull_pair "${web}" "${ingress}" || fail pull
    enter_maintenance "${web}" "${ingress}" || fail maintenance-failed
    say "RESULT=succeeded action=maintenance ingress=${ingress}"
    exit 0
    ;;
esac
