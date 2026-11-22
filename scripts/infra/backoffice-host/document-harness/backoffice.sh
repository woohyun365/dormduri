# 백오피스 document 둘(배포·첫 owner 등록 code)을 가짜 aws·docker·curl과 실제 python3(secret 설치기) 위에서 차례로 실행한다.
# 판정 기준은 ssm-document-runtime.mjs의 BACKOFFICE_DOCUMENT_CASES다. 마지막 줄은 가짜 secret 값과 등록 code가 SSM 출력·host
# log·명령 인자 가운데 허용된 곳(등록 code는 bootstrap SSM 출력) 밖에 나오지 않았는지다.
set -u
. /work/common.sh
for stub in aws docker curl sleep pidof; do install -m 0755 "/work/stubs/${stub}" "/usr/local/bin/${stub}"; done
state=/opt/dormduri/state
secrets=/opt/dormduri/secrets/backoffice
P1=$(pair 1)
count() { find "$1" -mindepth 1 -maxdepth 1 "${@:2}" 2>/dev/null | wc -l | tr -d ' '; }
run() {
  local name=$1 script=$2 code current previous running up perms obs pulled published arg
  local -a argv=()
  shift 2
  # DOCKERD_ARGV=<flag>는 document shell의 명령줄에 붙는다. 가짜 pidof(PIDOF_DOCKERD=parent)가 그 shell을 dockerd처럼 내므로
  # guard가 /proc/<pid>/cmdline에서 그 flag를 읽는다.
  for arg in "$@"; do
    case "${arg}" in DOCKERD_ARGV=*) argv+=("${arg#DOCKERD_ARGV=}") ;; esac
  done
  : >/tmp/docker.log
  : >/tmp/services.log
  : >/tmp/aws.log
  : >/tmp/curl.log
  rm -f /tmp/running_obs
  env "$@" bash "/work/${script}" "${argv[@]}" >/tmp/out 2>/tmp/err
  code=$?
  cat /tmp/out /tmp/err /tmp/docker.log /tmp/aws.log /tmp/curl.log >>/tmp/seen
  [ "${script}" = bootstrap.sh ] || cat /tmp/out >>/tmp/seen-deploy-stdout
  current=$(label backoffice-api "${state}/current")
  previous=$(label backoffice-api "${state}/previous")
  running=$(cat /tmp/running 2>/dev/null || printf none)
  up=no
  grep -q '^up:backoffice-api' /tmp/services.log && up=yes
  pulled=no
  grep -q '^docker pull' /tmp/docker.log && pulled=yes
  obs=$(cat /tmp/running_obs 2>/dev/null || printf none)
  # 지금 기록의 secret release 모양: API 디렉터리 0500·10001과 파일 여섯 0400, Alloy 디렉터리 0500·root와 파일 셋 0400.
  perms=none
  if [ -f "${state}/current" ]; then
    release=$(sed -n 's/^secretRelease=//p' "${state}/current")
    perms=no
    [ "$(stat -c '%u:%a' "${secrets}/releases/${release}")" = 10001:500 ] \
      && [ "$(count "${secrets}/releases/${release}" -type f -user 10001 -perm 0400)" = 6 ] \
      && [ "$(stat -c '%u:%a' "${secrets}/observability/${release}")" = 0:500 ] \
      && [ "$(count "${secrets}/observability/${release}" -type f -user 0 -perm 0400)" = 3 ] && perms=yes
  fi
  published=$(count /opt/dormduri/releases/backoffice -type d)
  printf 'case=%s exit=%s current=%s previous=%s running=%s up=%s pulled=%s obs=%s perms=%s releases=%s secretreleases=%s out=%s\n' \
    "${name}" "${code}" "${current}" "${previous}" "${running}" "${up}" "${pulled}" "${obs}" "${perms}" "${published}" \
    "$(count "${secrets}/releases" -type d)" "$(result_line /tmp/out)"
}
deploy() { run "$1" deploy.sh SSM_action="$2" SSM_backofficeApiDigest="$(pair "$3")" SSM_backofficeWebDigest="$(pair "$3")" \
  SSM_backofficeIngressDigest="$(pair "$3")" "${@:4}"; }
bootstrap() { run "$1" bootstrap.sh SSM_email="$2" SSM_displayName="$3" "${@:4}"; }

# 입력·상태 거부(Docker·AWS에 닿기 전, 또는 Docker 하한 검사에서 멈춤).
run action deploy.sh SSM_action=destroy SSM_backofficeApiDigest="${P1}" SSM_backofficeWebDigest="${P1}" SSM_backofficeIngressDigest="${P1}"
run digest deploy.sh SSM_action=deploy SSM_backofficeApiDigest=latest SSM_backofficeWebDigest="${P1}" SSM_backofficeIngressDigest="${P1}"
install -d -m 0700 "${state}"
( flock 9; /bin/sleep 3 ) 9>"${state}/lock" &
/bin/sleep 1
deploy locked deploy 1
wait
deploy engine-27 deploy 1 ENGINE_VERSION=27.5.1
deploy firewall-nftables deploy 1 FIREWALL_BACKEND=nftables
install -d /etc/docker
printf '{"allow-direct-routing": true}\n' >/etc/docker/daemon.json
deploy daemon-direct-routing deploy 1
printf '{"log-driver": "json-file"}\n' >/etc/docker/daemon.json
deploy insecure-raw-env deploy 1 PIDOF_DOCKERD=parent DOCKER_INSECURE_NO_IPTABLES_RAW=1
deploy daemon-flag-direct-routing deploy 1 PIDOF_DOCKERD=parent DOCKERD_ARGV=--allow-direct-routing
printf '{"iptables": false}\n' >/tmp/weak-daemon.json
deploy daemon-config-file deploy 1 PIDOF_DOCKERD=parent DOCKERD_ARGV=--config-file=/tmp/weak-daemon.json
bootstrap bootstrap-no-current owner@example.com Owner
# rollout 전 실패와 첫 배포 실패.
deploy secret-fetch deploy 1 BAD_FETCH=1
deploy secret-keys deploy 1 BAD_SECRET=1
deploy first-deploy-failure deploy 1 BAD_UP=1
# 배포·자동 되돌림·rollback·maintenance.
deploy first-deploy deploy 1
deploy second-deploy deploy 2
deploy smoke-failure-rolls-back deploy 3 BAD_SMOKE=3
deploy publish-violation-rolls-back deploy 3 BAD_PUBLISH=3
deploy foreign-host-rolls-back deploy 3 BAD_INGRESS_HOST=3
deploy metrics-failure-rolls-back deploy 3 BAD_METRICS=3
deploy observability-fail-open deploy 4 BAD_OBS_UP=1
deploy rollback-mismatch rollback 1
deploy rollback rollback 2
deploy rollback-without-previous rollback 4
# 첫 owner 등록 code.
bootstrap bootstrap-input 'not-an-email' Owner
# 이름은 글자로 센다: 한글 61자는 거부하고 60자는 받는다.
bootstrap bootstrap-input-long owner@example.com "$(printf '가%.0s' $(seq 61))"
bootstrap bootstrap-issued owner@example.com "$(printf '가%.0s' $(seq 60))"
bootstrap bootstrap-refused owner@example.com Owner BOOTSTRAP_EXIT=2
deploy maintenance maintenance 2
# 누설: 가짜 secret 값은 어디에도, 등록 code는 bootstrap SSM 출력 밖(배포 출력·host log·명령 인자)에 없어야 한다.
leak=no
grep -q fakesecretvalue /tmp/seen /opt/dormduri/state/*.log 2>/dev/null && leak=yes
code_leak=no
grep -q fakebootstrapcode /tmp/seen-deploy-stdout /opt/dormduri/state/*.log 2>/dev/null && code_leak=yes
printf 'case=leak exit=0 secret=%s code=%s out=none\n' "${leak}" "${code_leak}"
