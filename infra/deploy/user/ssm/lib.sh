# user host 배포 document 공통 함수. scripts/infra/user-host/ssm-document.mjs가 이 파일을 두 document(web 묶음
# deploy.sh, API 묶음 ../api/ssm/deploy-api.sh)의 `#__USER_HOST_LIB__` 자리에 그대로 넣는다. 혼자 실행하지 않는다.
# 부르는 쪽이 정하는 값: action, log, state, base, project, document_name, document_source.
#
# release 묶음(D-AB11): web 묶음(web·ingress)과 API 묶음(api·migrate one-off·관측 다섯)은 같은 compose project의 조각 둘이다.
# 묶음마다 host 상태 `current`·`previous`는 release 기록(key=value 줄)이다.
#   recordFormat=2              이 형식을 쓴 document가 남긴 기록(옛 web document가 쓴 기록에는 없다)
#   release=<id>                release 이름(release 기록 디렉터리 이름)
#   <image 이름>=sha256:...      service image digest 표(web 묶음: web·ingress, API 묶음: api·api-migrate·observability-config)
#   fragment=<절대 경로>         그 release를 띄운 compose 조각 사본
#   secretRelease=<id>          (API 묶음) runtime secret release
#   document=<이름>, documentSource=<sha256>  그 release를 띄운 document와 원본 hash
# compose는 두 묶음의 조각을 함께 넘기고(자기 묶음은 이번 조각, 다른 묶음은 기록된 `current` 조각) 자기 묶음 service만
# `up`·`stop`·`rm`한다. project 전체 `down`은 쓰지 않는다. `--remove-orphans`는 두 조각을 다 넘긴 `up`에서만 쓴다.

digest_re='^sha256:[a-f0-9]{64}$'
releases=${base}/releases
web_state=${state}
api_state=${state}/api
api_transit_name=dormduri-api-transit
api_transit_subnet=10.217.11.0/28
api_transit_range=10.217.11.8/29
api_transit_gateway=10.217.11.1
web_fragment=''
api_fragment=''

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

# host log는 5MiB를 넘으면 한 번 돌린다(root 전용, 바깥으로 보내지 않음).
rotate_log() {
  if [ -f "${log}" ] && [ "$(stat -c %s "${log}")" -gt 5242880 ]; then mv -f "${log}" "${log}.1"; fi
}

record_get() {
  [ -f "$1" ] || return 1
  sed -n "s/^$2=//p" "$1" | tail -n 1
}
record_is_current_format() {
  [ -f "$1" ] && grep -qx 'recordFormat=2' "$1"
}
# 기록 파일을 원자적으로 바꾼다(같은 디렉터리의 임시 파일 → mv).
record_put() {
  cat "$2" >"$1.tmp"
  mv "$1.tmp" "$1"
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

# 묶음을 건너는 API transit network. 없을 때만 고정 subnet으로 만들고, 있으면 subnet이 같은지만 본다.
ensure_api_transit() {
  local inspected subnet
  if inspected=$(docker network inspect "${api_transit_name}" 2>>"${log}"); then
    subnet=$(printf '%s' "${inspected}" | python3 -c '
import json, sys
networks = json.load(sys.stdin)
print(" ".join(item.get("Subnet", "") for net in networks for item in (net.get("IPAM", {}).get("Config") or [])))
') || fail network-mismatch 2
    [ "${subnet}" = "${api_transit_subnet}" ] || fail network-mismatch 2
    return 0
  fi
  docker network create --driver bridge --subnet "${api_transit_subnet}" --ip-range "${api_transit_range}" \
    --gateway "${api_transit_gateway}" --label dormduri.user-host.network=api-transit "${api_transit_name}" \
    >>"${log}" 2>&1 || fail network-create
}

# 두 조각을 넘기는 compose. 조각 변수는 use_web_record·use_api_record가 정한다.
run_compose() {
  if [ -n "${api_fragment}" ]; then set -- -f "${api_fragment}" "$@"; fi
  if [ -n "${web_fragment}" ]; then set -- -f "${web_fragment}" "$@"; fi
  docker compose -p "${project}" "$@" >>"${log}" 2>&1
}
# `--remove-orphans`는 두 조각을 다 넘겼을 때만 붙인다.
orphan_flag() {
  if [ -n "${web_fragment}" ] && [ -n "${api_fragment}" ]; then printf '%s' --remove-orphans; fi
}

web_release_of() { printf 'web-%s' "${1:7:12}"; }

# web 묶음 기록으로 compose 변수를 정한다. 기록이 없으면 web 조각을 넘기지 않는다.
use_web_record() {
  local web ingress fragment
  if [ -z "$1" ] || [ ! -f "$1" ]; then
    web_fragment=''
    return 0
  fi
  web=$(record_get "$1" web)
  ingress=$(record_get "$1" ingress)
  fragment=$(record_get "$1" fragment)
  [[ ${web} =~ ${digest_re} && ${ingress} =~ ${digest_re} ]] || return 1
  [ -n "${fragment}" ] && [ -s "${fragment}" ] || return 1
  web_fragment=${fragment}
  export WEB_IMAGE INGRESS_IMAGE WEB_RELEASE
  WEB_IMAGE=$(ref web "${web}")
  INGRESS_IMAGE=$(ref ingress "${ingress}")
  WEB_RELEASE=$(web_release_of "${web}")
}

# API 묶음 기록으로 compose 변수를 정한다. 기록이 없으면 API 조각을 넘기지 않는다. 관측 설정은 digest 경로다(API document가
# 설정 image를 그 경로에 펼친다).
use_api_record() {
  local api migrate obs fragment secret
  if [ -z "$1" ] || [ ! -f "$1" ]; then
    api_fragment=''
    return 0
  fi
  api=$(record_get "$1" api)
  migrate=$(record_get "$1" api-migrate)
  obs=$(record_get "$1" observability-config)
  fragment=$(record_get "$1" fragment)
  secret=$(record_get "$1" secretRelease)
  [[ ${api} =~ ${digest_re} && ${migrate} =~ ${digest_re} && ${obs} =~ ${digest_re} ]] || return 1
  [ -n "${fragment}" ] && [ -s "${fragment}" ] && [ -n "${secret}" ] || return 1
  api_fragment=${fragment}
  export API_IMAGE API_MIGRATE_IMAGE API_SECRET_RELEASE_DIR OBSERVABILITY_CONFIG_DIR
  API_IMAGE=$(ref api "${api}")
  API_MIGRATE_IMAGE=$(ref api-migrate "${migrate}")
  API_SECRET_RELEASE_DIR=${base}/secrets/api/releases/${secret}
  OBSERVABILITY_CONFIG_DIR=${base}/observability/config/${obs#sha256:}
}

# 옛 web document가 쓴 기록(조각 줄 없음)에 그 release가 쓴 compose 사본을 조각 기록으로 붙인다(형식 표지는 붙이지 않는다).
# 옛 document는 매 배포마다 같은 파일(/opt/dormduri/compose/compose.yml)에 compose를 썼고 rollback도 그 파일을 썼다.
adopt_legacy_web_records() {
  local name file web ingress dir legacy_compose=${base}/compose/compose.yml
  for name in current previous; do
    file=${web_state}/${name}
    [ -f "${file}" ] || continue
    if grep -q '^fragment=' "${file}"; then continue; fi
    web=$(record_get "${file}" web)
    ingress=$(record_get "${file}" ingress)
    [[ ${web} =~ ${digest_re} && ${ingress} =~ ${digest_re} ]] || fail legacy-record 2
    [ -s "${legacy_compose}" ] || fail legacy-compose-missing 2
    dir=${releases}/web/legacy-${web:7:12}-${ingress:7:12}
    install -d -m 0755 "${dir}"
    [ -s "${dir}/compose.yml" ] || cp "${legacy_compose}" "${dir}/compose.yml"
    { cat "${file}"; printf 'fragment=%s\n' "${dir}/compose.yml"; } >"${file}.tmp"
    mv "${file}.tmp" "${file}"
  done
}

# 기록이 가리키지 않는 release 기록 디렉터리를 지운다(current·previous가 가리키는 것만 남긴다).
prune_release_dirs() {
  local kind=$1 keep=' ' dir fragment record
  shift
  for record in "$@"; do
    fragment=$(record_get "${record}" fragment || true)
    [ -n "${fragment}" ] && keep="${keep}$(dirname "${fragment}") "
  done
  for dir in "${releases}/${kind}"/*; do
    [ -d "${dir}" ] || continue
    case "${keep}" in *" ${dir} "*) ;; *) rm -rf "${dir}" ;; esac
  done
}

# 자기 묶음 repository의 image 가운데 keep 목록 밖의 것만 지운다(다른 묶음 image는 건드리지 않는다).
prune_repository_images() {
  local repos=$1 keep=$2
  docker image ls --digests --format json | KEEP="${keep}" REG="${registry}" REPOS="${repos}" python3 -c '
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
