# web document 배포 경로: 가짜 aws·docker·curl 위에서 배포·자동 복귀·점검 mode·rollback 대조, 옛 기록 채택, API 묶음
# 조각 동반, API transit 불일치를 차례로 실행한다.
set -u
. /work/common.sh
install -d /opt/dormduri/tls
printf x >/opt/dormduri/tls/fullchain.pem
printf x >/opt/dormduri/tls/privkey.pem
install -m 0755 /work/stubs/aws /usr/local/bin/aws
install -m 0755 /work/stubs/curl /usr/local/bin/curl
install -m 0755 /work/stubs/docker-web /usr/local/bin/docker
state=/opt/dormduri/state
run() {
  local name=$1 code current previous flag format cfrag pfrag apifrag orphans composed apisvc apivar
  shift
  : >/tmp/docker.log
  : >/tmp/services.log
  : >/tmp/apivars.log
  env "$@" bash /work/deploy.sh >/tmp/out 2>/tmp/err
  code=$?
  cat /tmp/out >>/tmp/stdout-all
  cat /tmp/docker.log >>/tmp/docker-all
  cat /tmp/services.log >>/tmp/services-all
  cat /tmp/missing.log >>/tmp/missing-all 2>/dev/null
  : >/tmp/missing.log
  current=$(label web "${state}/current")
  previous=$(label web "${state}/previous")
  flag=no
  [ -f /opt/dormduri/mode/maintenance ] && flag=yes
  format=$(format_of "${state}/current")
  cfrag=$(fragment_kind "${state}/current")
  pfrag=$(fragment_kind "${state}/previous")
  apifrag=no
  grep -q -- '-f /opt/dormduri/releases/api/' /tmp/docker.log && apifrag=yes
  orphans=no
  grep -q -- ' up .*--remove-orphans' /tmp/docker.log && orphans=yes
  composed=no
  grep -q '^docker compose ' /tmp/docker.log && composed=yes
  apisvc=no
  grep -Eq '^[a-z]+:(.* )?(api|migrate)( |$)' /tmp/services.log && apisvc=yes
  apivar=$(cut -c8 /tmp/apivars.log | sort -u | paste -sd, -)
  printf 'case=%s exit=%s current=%s previous=%s flag=%s format=%s cfrag=%s pfrag=%s apifrag=%s orphans=%s composed=%s apisvc=%s apivar=%s out=%s\n' \
    "${name}" "${code}" "${current}" "${previous}" "${flag}" "${format}" "${cfrag}" "${pfrag}" "${apifrag}" "${orphans}" \
    "${composed}" "${apisvc}" "${apivar:-none}" "$(result_line /tmp/out)"
}
deploy() { run "$1" "${@:3}" SSM_action=deploy SSM_webDigest="$(pair "$2")" SSM_ingressDigest="${I}"; }
rollback() { run "$1" "${@:3}" SSM_action=rollback SSM_webDigest="$(pair "$2")" SSM_ingressDigest="${I}"; }
I=$(pair a)
deploy first-deploy 1
deploy second-deploy 2
deploy start-failure-rolls-back 3 BAD_UP="$(pair 3)"
deploy smoke-failure-rolls-back 4 BAD_SMOKE="$(pair 4)"
rollback rollback-mismatch 3
rollback rollback-start-failure-keeps-current 1 BAD_UP="$(pair 1)"
deploy deploy-and-current-failure-enters-maintenance 3 "BAD_UP=$(pair 3) $(pair 2)"
rollback rollback 1
rollback rollback-without-previous 2
rm -rf "${state}" /opt/dormduri/mode /opt/dormduri/releases /tmp/running_web
deploy first-deploy-failure-enters-maintenance 3 BAD_UP="$(pair 3)"
run maintenance SSM_action=maintenance SSM_webDigest="$(pair 1)" SSM_ingressDigest="${I}"
run maintenance-ingress-failure BAD_INGRESS=1 SSM_action=maintenance SSM_webDigest="$(pair 1)" SSM_ingressDigest="${I}"

# 옛 document가 남긴 기록(web·ingress 두 줄)과 그 compose 파일: 배포가 채택해 새 형식 current를 쓰고, 옛 기록 previous로의
# rollback은 그 release가 쓴 compose 사본으로 돌아간다(current도 옛 형식이 된다).
rm -rf "${state}" /opt/dormduri/mode /opt/dormduri/releases /tmp/running_web /tmp/net
install -d -m 0700 "${state}"
install -d /opt/dormduri/compose
printf 'name: dormduri-web\nservices: {}\n' >/opt/dormduri/compose/compose.yml
printf 'web=%s\ningress=%s\n' "$(pair 5)" "${I}" >"${state}/current"
printf 'web=%s\ningress=%s\n' "$(pair 6)" "${I}" >"${state}/previous"
# 조각 기록이 없는 옛 current에서 새 쌍이 실패하면 복사한 조각으로 옛 쌍에 돌아간다.
deploy legacy-start-failure-rolls-back 7 BAD_UP="$(pair 7)"
deploy legacy-adopt-deploy 7
rollback legacy-rollback 5

# API 묶음 current가 있으면 web 배포가 그 기록의 조각을 함께 넘기되 web·ingress만 다룬다.
install -d /opt/dormduri/releases/api/api-recorded "${state}/api"
printf 'services: {}\n' >/opt/dormduri/releases/api/api-recorded/compose.yml
printf 'recordFormat=2\nrelease=api-recorded\napi=%s\napi-migrate=%s\nfragment=%s\nsecretRelease=api-recorded\n' \
  "$(pair c)" "$(pair d)" /opt/dormduri/releases/api/api-recorded/compose.yml >"${state}/api/current"
deploy with-api-current 8
# API current가 있을 때 옛 형식 web 기록으로의 rollback도 web 묶음 service만 띄우고 API 조각 변수는 그 기록 값이다.
rollback legacy-rollback-with-api-current 5

# 같은 이름의 API transit network가 다른 subnet으로 있으면 compose 전에 멈춘다.
printf '172.30.0.0/16' >/tmp/net
deploy network-mismatch 9
isolation_line 'api|migrate'
