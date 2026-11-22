# 백오피스 host document 공통 함수. scripts/infra/backoffice-host/ssm-document.mjs가 이 파일을 두 document(배포 deploy.sh,
# 첫 owner 등록 code bootstrap-owner.sh)의 `#__BACKOFFICE_HOST_LIB__` 자리에 그대로 넣는다. 혼자 실행하지 않는다.
# 부르는 쪽이 정하는 값: action, log, state, base. user host document(infra/deploy/user/ssm/lib.sh)와 host가 달라 공유하지 않는다.
#
# release 기록(key=value 줄, `current`·`previous`):
#   recordFormat=1
#   release=<id>                              release 이름(release 디렉터리 이름)
#   backoffice-api|backoffice-web|backoffice-ingress=sha256:...   image digest 셋
#   fragment=<절대 경로>                       그 release를 띄운 compose 사본(옆 alloy/에 Alloy 설정)
#   secretRelease=<id>                        secret release(API 파일 넷과 Alloy 파일 셋)
#   document=<이름>, documentSource=<sha256>  그 release를 띄운 document와 원본 hash

digest_re='^sha256:[a-f0-9]{64}$'
project=dormduri-backoffice
releases=${base}/releases/backoffice
secrets_root=${base}/secrets/backoffice
secret_releases=${secrets_root}/releases
obs_secret_releases=${secrets_root}/observability
images='backoffice-api backoffice-web backoffice-ingress'
fragment=''

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

rotate_log() {
  if [ -f "${log}" ] && [ "$(stat -c %s "${log}")" -gt 5242880 ]; then mv -f "${log}" "${log}.1"; fi
}

record_get() {
  [ -f "$1" ] || return 1
  sed -n "s/^$2=//p" "$1" | tail -n 1
}
record_put() {
  cat "$2" >"$1.tmp"
  mv "$1.tmp" "$1"
}

# loopback publish 보호(D-BF2): Docker Engine 28.0.0부터 같은 network의 다른 host가 127.0.0.1에 publish한 port로 직접 route해
# 닿는 길을 iptables raw table 규칙이 막는다(Docker 28.0.0 release note). 그 판보다 낮거나, 보호를 끄는 설정(daemon option
# `allow-direct-routing`, `iptables: false`, 환경 변수 DOCKER_INSECURE_NO_IPTABLES_RAW)이거나, 확인한 iptables backend가 아니면
# 아무것도 바꾸기 전에 멈춘다.
engine_guard() {
  local version major backend pid
  # document 본문에는 SSM 파라미터 문법(이중 중괄호)을 두지 않으므로 Go template 대신 JSON 출력을 읽는다.
  version=$(docker version --format json 2>>"${log}" \
    | python3 -I -c 'import json, sys; print(json.load(sys.stdin)["Server"]["Version"])' 2>>"${log}") || fail docker 2
  major=${version%%.*}
  if ! [[ ${major} =~ ^[0-9]+$ ]] || [ "${major}" -lt 28 ]; then fail docker-engine-below-28 2; fi
  backend=$(docker info --format json 2>>"${log}" \
    | python3 -I -c 'import json, sys; print((json.load(sys.stdin).get("FirewallBackend") or {}).get("Driver", ""))' \
      2>>"${log}" || true)
  [ "${backend}" = iptables ] || fail docker-firewall-backend 2
  if [ -f /etc/docker/daemon.json ]; then
    python3 -I -c '
import json, sys
config = json.load(open(sys.argv[1]))
weak = config.get("allow-direct-routing") is True or config.get("iptables") is False or config.get("ip6tables") is False
sys.exit(1 if weak else 0)
' /etc/docker/daemon.json 2>>"${log}" || fail docker-daemon-config 2
  fi
  for pid in $(pidof dockerd 2>/dev/null || true); do
    if tr '\0' '\n' <"/proc/${pid}/environ" 2>/dev/null | grep -q '^DOCKER_INSECURE_NO_IPTABLES_RAW='; then
      fail docker-daemon-config 2
    fi
  done
}

# registry login(host credential, ECR). 주소는 host log에만 남는다.
registry_init() {
  local account
  account=$(aws sts get-caller-identity --query Account --output text 2>>"${log}") || fail sts
  registry="${account}.dkr.ecr.${AWS_REGION}.amazonaws.com"
  trap registry_cleanup EXIT
}
registry_cleanup() {
  docker logout "${registry}" >/dev/null 2>&1 || true
  if [ -n "${cleanup_hook:-}" ]; then "${cleanup_hook}" || true; fi
}
registry_login() {
  aws ecr get-login-password 2>>"${log}" | docker login --username AWS --password-stdin "${registry}" >>"${log}" 2>&1
}
ref() { printf '%s/dormduri/%s@%s' "${registry}" "$1" "$2"; }

# 기록 하나로 compose 변수를 정한다(image 셋, secret release, Alloy 설정 경로).
use_record() {
  local api web ingress secret
  [ -f "$1" ] || return 1
  api=$(record_get "$1" backoffice-api)
  web=$(record_get "$1" backoffice-web)
  ingress=$(record_get "$1" backoffice-ingress)
  fragment=$(record_get "$1" fragment)
  secret=$(record_get "$1" secretRelease)
  [[ ${api} =~ ${digest_re} && ${web} =~ ${digest_re} && ${ingress} =~ ${digest_re} ]] || return 1
  [ -n "${fragment}" ] && [ -s "${fragment}" ] && [ -n "${secret}" ] || return 1
  export BACKOFFICE_API_IMAGE BACKOFFICE_WEB_IMAGE BACKOFFICE_INGRESS_IMAGE BACKOFFICE_SECRET_RELEASE_DIR \
    BACKOFFICE_OBSERVABILITY_SECRET_DIR BACKOFFICE_ALLOY_CONFIG_DIR
  BACKOFFICE_API_IMAGE=$(ref backoffice-api "${api}")
  BACKOFFICE_WEB_IMAGE=$(ref backoffice-web "${web}")
  BACKOFFICE_INGRESS_IMAGE=$(ref backoffice-ingress "${ingress}")
  BACKOFFICE_SECRET_RELEASE_DIR=${secret_releases}/${secret}
  BACKOFFICE_OBSERVABILITY_SECRET_DIR=${obs_secret_releases}/${secret}
  BACKOFFICE_ALLOY_CONFIG_DIR=$(dirname "${fragment}")/alloy
}

run_compose() {
  set -- docker compose -p "${project}" -f "${fragment}" "$@"
  if [ -n "${compose_limit:-}" ]; then set -- timeout -k 10 "${compose_limit}" "$@"; fi
  "$@" >>"${log}" 2>&1
}
