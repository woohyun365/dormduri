# API document 배포 경로: 가짜 aws·docker와 실제 python3(secret 설치기) 위에서 migrate·rollout·자동 복귀·rollback·
# maintenance와 rollout 전 실패(secret·migrate·outbox), 관측 단계(설정 펼침·관측 secret·rollback의 설정 복원·fail-open)를 차례로
# 실행한다. 마지막 줄은 가짜 secret 값이 SSM 출력·host log·명령 인자에 나오지 않았는지다.
set -u
. /work/common.sh
install -m 0755 /work/stubs/aws /usr/local/bin/aws
install -m 0755 /work/stubs/docker-api /usr/local/bin/docker
install -m 0755 /work/stubs/python3-shim /usr/local/bin/python3
install -m 0755 /work/stubs/timeout /usr/local/bin/timeout
state=/opt/dormduri/state
api_state=${state}/api
secrets=/opt/dormduri/secrets/api
install -d -m 0700 "${state}"
install -d /opt/dormduri/releases/web/web-recorded
printf 'services: {}\n' >/opt/dormduri/releases/web/web-recorded/compose.yml
printf 'recordFormat=2\nrelease=web-recorded\nweb=%s\ningress=%s\nfragment=%s\n' "$(pair a)" "$(pair b)" \
  /opt/dormduri/releases/web/web-recorded/compose.yml >"${state}/current"
M=$(pair f)
O=$(pair c)
count() { find "$1" -mindepth 1 -maxdepth 1 "${@:2}" 2>/dev/null | wc -l; }
run() {
  local name=$1 code current previous running steps link release fetched stopped cfrag dir order prevfrag prevsum fromprev upline
  local obs obsrec obssecret obsresult obsstopped obslimit obsup obsdir
  shift
  # rollback 판별: 실행 전 previous 기록의 조각 경로와 내용 hash. 실행 뒤 current가 그 조각을 그대로(내용도 같게) 가리키고 마지막 api
  # `up`이 그 조각을 넘겼을 때만 fromprev=yes다(새 document 조각을 쓰는 rollback이면 no).
  prevfrag=$(sed -n 's/^fragment=//p' "${api_state}/previous" 2>/dev/null | tail -n 1)
  prevsum=$( [ -n "${prevfrag}" ] && sha256sum "${prevfrag}" 2>/dev/null | cut -d' ' -f1)
  : >/tmp/docker.log
  : >/tmp/services.log
  : >/tmp/steps.log
  : >/tmp/aws.log
  : >/tmp/timeout.log
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
  obs=none
  [ -f /tmp/running_obs ] && obs=$(cat /tmp/running_obs)
  obsrec=$(label observability-config "${api_state}/current")
  obssecret=none
  if [ -e /opt/dormduri/secrets/observability/slack-webhook-url ]; then
    obssecret=no
    [ "$(cd /opt/dormduri/secrets/observability && stat -c '%n:%u:%a' slack-webhook-url grafana-admin-password \
      api-metrics-bearer-token | paste -sd' ')" = 'slack-webhook-url:65534:400 grafana-admin-password:472:400 api-metrics-bearer-token:65534:400' ] \
      && obssecret=yes
  fi
  obsresult=$(result_line /tmp/out | sed -n 's/.* observability=\([a-z]*\).*/\1/p')
  # 관측의 network 호출 상한: 모두 1~840초(document의 obs_deadline)이면 ok다. 관측 container를 다시 만들려 했는지(obsup)와
  # 관측 container가 쓰는 설정 경로가 남아 있는지(obsdir)도 본다.
  obslimit=none
  if [ -s /tmp/timeout.log ]; then
    obslimit=ok
    awk '$1 < 1 || $1 > 840 { bad = 1 } END { exit bad }' /tmp/timeout.log || obslimit=over
  fi
  obsup=no
  grep -Eq '^up:(.* )?prometheus( |$)' /tmp/services.log && obsup=yes
  obsdir=none
  if [ -f /tmp/running_obs ]; then
    obsdir=no
    [ -d "/opt/dormduri/observability/config/$(printf '%64s' '' | tr ' ' "$(cat /tmp/running_obs)")" ] && obsdir=yes
  fi
  obsstopped=no
  grep -Eq '^(stop|rm):(.* )?(prometheus|loki|alloy|alertmanager|grafana)( |$)' /tmp/services.log && obsstopped=yes
  fromprev=none
  if [ -n "${prevfrag}" ] && [ -f "${api_state}/current" ]; then
    fromprev=no
    upline=$(grep -E '^docker compose .* up .* api$' /tmp/docker.log | tail -n 1)
    if [ "$(sed -n 's/^fragment=//p' "${api_state}/current" | tail -n 1)" = "${prevfrag}" ] \
      && [ "$(sha256sum "${prevfrag}" 2>/dev/null | cut -d' ' -f1)" = "${prevsum}" ]; then
      case "${upline} " in *" -f ${prevfrag} "*) fromprev=yes ;; esac
    fi
  fi
  printf 'case=%s exit=%s current=%s previous=%s running=%s steps=%s secrets=%s link=%s migratedir=%s fetched=%s stopped=%s cfrag=%s apidirs=%s order=%s fromprev=%s obs=%s obsrec=%s obsdirs=%s obssecret=%s obsresult=%s obsstopped=%s obslimit=%s obsup=%s obsdir=%s out=%s\n' \
    "${name}" "${code}" "${current}" "${previous}" "${running}" "${steps:-none}" "$(count "${secrets}/releases" -type d)" \
    "${link}" "$(count /opt/dormduri/secrets -name 'migrate.*')" "${fetched}" "${stopped}" "${cfrag:-none}" \
    "$(count /opt/dormduri/releases/api -type d)" "${order}" "${fromprev}" "${obs}" "${obsrec}" \
    "$(count /opt/dormduri/observability/config -type d)" "${obssecret}" "${obsresult:-none}" "${obsstopped}" "${obslimit}" "${obsup}" "${obsdir}" \
    "$(result_line /tmp/out)"
}
# 관측 설정 digest는 기본 c이고, 뒤에 붙인 SSM_observabilityConfigDigest가 이긴다(env는 마지막 값을 쓴다).
deploy() { run "$1" SSM_action=deploy SSM_apiDigest="$(pair "$2")" SSM_apiMigrateDigest="${M}" SSM_observabilityConfigDigest="${O}" "${@:3}"; }
rollback() { run "$1" SSM_action=rollback SSM_apiDigest="$(pair "$2")" SSM_apiMigrateDigest="${M}" SSM_observabilityConfigDigest="${O}" "${@:3}"; }
maintenance() { run "$1" SSM_action=maintenance SSM_apiDigest="$(pair "$2")" SSM_apiMigrateDigest="${M}" SSM_observabilityConfigDigest="${O}"; }
obs() { printf 'SSM_observabilityConfigDigest=%s' "$(pair "$1")"; }
deploy first-deploy 1
deploy outbox-rows-stop-before-rollout 2 BAD_STEP=outbox
deploy migrate-failure-stops-before-rollout 2 BAD_STEP=migrate
deploy grant-failure-stops-before-rollout 2 BAD_STEP=grant
deploy smoke-failure-stops-before-rollout 2 BAD_STEP=smoke
deploy secret-invalid-stops-before-migrate 2 BAD_SECRET=1
deploy secret-mode-violation-stops-before-migrate 2 MODE_VIOLATION=1
deploy secret-fetch-failure 2 BAD_FETCH=/dormduri/production/api/runtime
deploy migration-secret-failure 2 BAD_FETCH=/dormduri/production/api/migration
# 강제 종료(SSM timeout)로 EXIT trap 없이 남은 migrate 임시 디렉터리는 다음 실행이 lock 안에서 지운다.
install -d -m 0700 /opt/dormduri/secrets/migrate.leftover
printf 'fakesecretvalue-leftover\n' >/opt/dormduri/secrets/migrate.leftover/MIGRATION_DATABASE_URL
deploy leftover-migrate-dir-is-removed 2 BAD_FETCH=/dormduri/production/api/runtime
deploy second-deploy 2
deploy start-failure-rolls-back 3 BAD_UP="$(pair 3)"
deploy smoke-failure-rolls-back 4 BAD_SMOKE="$(pair 4)"
rollback rollback-mismatch 3
printf '# fragment written by an older document\n' >>"$(sed -n 's/^fragment=//p' "${api_state}/previous" | tail -n 1)"
rollback rollback-start-failure-keeps-current 1 BAD_UP="$(pair 1)"
rollback rollback 1
rollback rollback-without-previous 2
deploy deploy-and-current-failure-stops-api 5 "BAD_UP=$(pair 5) $(pair 1)"
rm -rf "${api_state}" "${secrets}" /opt/dormduri/releases/api /tmp/running_api
deploy first-deploy-failure-stops-api 6 BAD_UP="$(pair 6)"
deploy deploy-after-failure 7
maintenance maintenance 7
# web current가 옛 형식(조각 기록은 복사됐지만 형식 표지 없음)이면 deploy는 secret·migrate·rollout 없이 멈추고 maintenance는 된다.
deploy deploy-after-maintenance 8
install -d /opt/dormduri/releases/web/legacy-recorded
printf 'name: dormduri-web\nservices: {}\n' >/opt/dormduri/releases/web/legacy-recorded/compose.yml
printf 'web=%s\ningress=%s\nfragment=%s\n' "$(pair a)" "$(pair b)" /opt/dormduri/releases/web/legacy-recorded/compose.yml \
  >"${state}/current"
deploy legacy-web-blocks-deploy 9
rollback legacy-web-blocks-rollback 7
maintenance legacy-web-allows-maintenance 8
# 관측 단계: 새 형식 web current와 비운 API 상태에서 시작한다. 설정 digest를 바꾼 배포는 관측 container를 그 digest 경로로 다시
# 만들고, rollback은 previous 기록의 digest 경로로 돌린다. 설정 펼침·관측 secret·관측 up이 실패해도 API rollout과 기록은 남는다.
printf 'recordFormat=2\nrelease=web-recorded\nweb=%s\ningress=%s\nfragment=%s\n' "$(pair a)" "$(pair b)" \
  /opt/dormduri/releases/web/web-recorded/compose.yml >"${state}/current"
rm -rf "${api_state}" "${secrets}" /opt/dormduri/releases/api /opt/dormduri/observability /opt/dormduri/secrets/observability \
  /tmp/running_api /tmp/running_obs
deploy obs-first-deploy 1
deploy obs-config-change 2 "$(obs d)"
rollback obs-rollback-restores-config 1
deploy obs-third-deploy 3 "$(obs e)"
rollback obs-rollback-mismatch 1 "$(obs d)"
deploy obs-fill-failure-keeps-api 4 "$(obs 4)" BAD_CONFIG=partial
deploy obs-symlink-config-refused 5 "$(obs 5)" BAD_CONFIG=symlink
deploy obs-secret-failure-keeps-api 6 "$(obs 6)" BAD_FETCH=/dormduri/production/observability
deploy obs-up-failure-keeps-api 7 "$(obs 7)" BAD_OBS_UP=1
maintenance obs-maintenance-keeps-observability 7
# 관측 설정만 바뀐 배포도 다른 묶음이다: 지금 묶음이 previous가 되고 rollback이 그 설정으로 되돌린다(단계 기록의 직전 묶음과 같다).
deploy obs-only-change 7 "$(obs f)"
rollback obs-only-rollback 7 "$(obs 7)"
# 관측 up이 다시 만든 뒤 시간 상한에 끊기면 지금 설정과 새 설정을 둘 다 남긴다. 그 뒤 설정 펼침이 두 번 실패해도 관측 container가
# 쓰는 설정 경로는 지워지지 않는다. upstream image 받기가 끊기면 container를 다시 만들지 않고, 남은 시간이 없으면 건너뛴다.
deploy obs-up-timeout-keeps-both-configs 8 "$(obs 9)" SLOW_OBS=up
deploy obs-fill-failure-after-recreate 9 "$(obs a)" BAD_CONFIG=partial
deploy obs-second-fill-failure-keeps-mounted 2 "$(obs b)" BAD_CONFIG=partial
deploy obs-image-pull-timeout-keeps-containers 3 "$(obs a)" SLOW_OBS=pull
deploy obs-step-budget-exhausted 4 "$(obs b)" SECONDS=830
cat "${state}/deploy-api.log" >>/tmp/seen 2>/dev/null
found=no
grep -q fakesecretvalue /tmp/seen && found=yes
printf 'case=secret-values-stay-off-output exit=0 found=%s out=none\n' "${found}"
isolation_line 'web|ingress'
