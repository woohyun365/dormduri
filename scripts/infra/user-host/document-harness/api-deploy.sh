# API document 배포 경로: 가짜 aws·docker와 실제 python3(secret 설치기) 위에서 migrate·rollout·자동 복귀·rollback·
# maintenance와 rollout 전 실패(secret·migrate·outbox)를 차례로 실행한다. 마지막 줄은 가짜 secret 값이 SSM 출력·host
# log·명령 인자에 나오지 않았는지다.
set -u
. /work/common.sh
install -m 0755 /work/stubs/aws /usr/local/bin/aws
install -m 0755 /work/stubs/docker-api /usr/local/bin/docker
install -m 0755 /work/stubs/python3-shim /usr/local/bin/python3
state=/opt/dormduri/state
api_state=${state}/api
secrets=/opt/dormduri/secrets/api
install -d -m 0700 "${state}"
install -d /opt/dormduri/releases/web/web-recorded
printf 'services: {}\n' >/opt/dormduri/releases/web/web-recorded/compose.yml
printf 'recordFormat=2\nrelease=web-recorded\nweb=%s\ningress=%s\nfragment=%s\n' "$(pair a)" "$(pair b)" \
  /opt/dormduri/releases/web/web-recorded/compose.yml >"${state}/current"
M=$(pair f)
count() { find "$1" -mindepth 1 -maxdepth 1 "${@:2}" 2>/dev/null | wc -l; }
run() {
  local name=$1 code current previous running steps link release fetched stopped cfrag dir order
  shift
  : >/tmp/docker.log
  : >/tmp/services.log
  : >/tmp/steps.log
  : >/tmp/aws.log
  env "$@" bash /work/deploy.sh >/tmp/out 2>/tmp/err
  code=$?
  cat /tmp/out /tmp/err /tmp/docker.log >>/tmp/seen
  cat /tmp/out >>/tmp/stdout-all
  cat /tmp/docker.log >>/tmp/docker-all
  cat /tmp/services.log >>/tmp/services-all
  cat /tmp/missing.log >>/tmp/missing-all 2>/dev/null
  : >/tmp/missing.log
  current=$(label api "${api_state}/current")
  previous=$(label api "${api_state}/previous")
  running=none
  [ -f /tmp/running_api ] && running=$(cut -c8 /tmp/running_api)
  steps=$(paste -sd, /tmp/steps.log)
  link=none
  if [ -f "${api_state}/current" ]; then
    release=$(sed -n 's/^secretRelease=//p' "${api_state}/current")
    link=no
    [ "$(readlink "${secrets}/current")" = "releases/${release}" ] && link=yes
  fi
  fetched=no
  grep -q 'get-secret-value /dormduri/production/api/runtime' /tmp/aws.log && fetched=yes
  stopped=no
  grep -q '^stop:api' /tmp/services.log && stopped=yes
  cfrag=none
  if [ -f "${api_state}/current" ]; then
    dir=$(basename "$(dirname "$(sed -n 's/^fragment=//p' "${api_state}/current")")")
    cfrag=$(printf '%s' "${dir}" | sed -n 's/^api-[0-9]*T[0-9]*Z-\(.\).*/\1/p')
    [ "$(fragment_kind "${api_state}/current")" = release ] || cfrag=missing
  fi
  order=$(stop_before_up)
  printf 'case=%s exit=%s current=%s previous=%s running=%s steps=%s secrets=%s link=%s migratedir=%s fetched=%s stopped=%s cfrag=%s apidirs=%s order=%s out=%s\n' \
    "${name}" "${code}" "${current}" "${previous}" "${running}" "${steps:-none}" "$(count "${secrets}/releases" -type d)" \
    "${link}" "$(count /opt/dormduri/secrets -name 'migrate.*')" "${fetched}" "${stopped}" "${cfrag:-none}" \
    "$(count /opt/dormduri/releases/api -type d)" "${order}" "$(result_line /tmp/out)"
}
deploy() { run "$1" "${@:3}" SSM_action=deploy SSM_apiDigest="$(pair "$2")" SSM_apiMigrateDigest="${M}"; }
rollback() { run "$1" "${@:3}" SSM_action=rollback SSM_apiDigest="$(pair "$2")" SSM_apiMigrateDigest="${M}"; }
deploy first-deploy 1
deploy outbox-rows-stop-before-rollout 2 BAD_STEP=outbox
deploy migrate-failure-stops-before-rollout 2 BAD_STEP=migrate
deploy secret-invalid-stops-before-migrate 2 BAD_SECRET=1
deploy secret-mode-violation-stops-before-migrate 2 MODE_VIOLATION=1
deploy secret-fetch-failure 2 BAD_FETCH=/dormduri/production/api/runtime
deploy migration-secret-failure 2 BAD_FETCH=/dormduri/production/api/migration
deploy second-deploy 2
deploy start-failure-rolls-back 3 BAD_UP="$(pair 3)"
deploy smoke-failure-rolls-back 4 BAD_SMOKE="$(pair 4)"
rollback rollback-mismatch 3
rollback rollback-start-failure-keeps-current 1 BAD_UP="$(pair 1)"
rollback rollback 1
rollback rollback-without-previous 2
deploy deploy-and-current-failure-stops-api 5 "BAD_UP=$(pair 5) $(pair 1)"
rm -rf "${api_state}" "${secrets}" /opt/dormduri/releases/api /tmp/running_api
deploy first-deploy-failure-stops-api 6 BAD_UP="$(pair 6)"
deploy deploy-after-failure 7
run maintenance SSM_action=maintenance SSM_apiDigest="$(pair 7)" SSM_apiMigrateDigest="${M}"
# web current가 옛 형식(조각 기록은 복사됐지만 형식 표지 없음)이면 deploy는 secret·migrate·rollout 없이 멈추고 maintenance는 된다.
deploy deploy-after-maintenance 8
install -d /opt/dormduri/releases/web/legacy-recorded
printf 'name: dormduri-web\nservices: {}\n' >/opt/dormduri/releases/web/legacy-recorded/compose.yml
printf 'web=%s\ningress=%s\nfragment=%s\n' "$(pair a)" "$(pair b)" /opt/dormduri/releases/web/legacy-recorded/compose.yml \
  >"${state}/current"
deploy legacy-web-blocks-deploy 9
run legacy-web-allows-maintenance SSM_action=maintenance SSM_apiDigest="$(pair 8)" SSM_apiMigrateDigest="${M}"
cat "${state}/deploy-api.log" >>/tmp/seen 2>/dev/null
found=no
grep -q fakesecretvalue /tmp/seen && found=yes
printf 'case=secret-values-stay-off-output exit=0 found=%s out=none\n' "${found}"
isolation_line 'web|ingress'
