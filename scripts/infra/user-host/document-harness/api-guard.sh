# API document guard: Docker·Secrets Manager에 닿기 전에 끝나는 경로. aws는 호출만 기록한다.
set -u
. /work/common.sh
install -m 0755 /work/stubs/aws /usr/local/bin/aws
A=$(pair 1)
M=$(pair f)
state=/opt/dormduri/state
run() {
  local name=$1 code aws
  shift
  : >/tmp/aws.log
  env "$@" bash /work/deploy.sh >/tmp/out 2>/tmp/err
  code=$?
  aws=no
  [ -s /tmp/aws.log ] && aws=yes
  printf 'case=%s exit=%s aws=%s out=%s\n' "${name}" "${code}" "${aws}" "$(tail -n 1 /tmp/out)"
}
run action SSM_action=bogus SSM_apiDigest="${A}" SSM_apiMigrateDigest="${M}"
run digest SSM_action=deploy SSM_apiDigest="${A}" SSM_apiMigrateDigest=sha256:xyz
mkdir -p "${state}"
(
  exec 9>"${state}/lock"
  flock -n 9
  touch /tmp/held
  sleep 4
) &
while [ ! -e /tmp/held ]; do sleep 0.1; done
run locked SSM_action=deploy SSM_apiDigest="${A}" SSM_apiMigrateDigest="${M}"
wait
run web-record-missing SSM_action=deploy SSM_apiDigest="${A}" SSM_apiMigrateDigest="${M}"
printf 'web=%s\ningress=%s\n' "$(pair a)" "$(pair b)" >"${state}/current"
run web-record-legacy SSM_action=deploy SSM_apiDigest="${A}" SSM_apiMigrateDigest="${M}"
run web-record-legacy-rollback SSM_action=rollback SSM_apiDigest="${A}" SSM_apiMigrateDigest="${M}"
install -d /opt/dormduri/releases/web/web-recorded /opt/dormduri/mode
printf 'services: {}\n' >/opt/dormduri/releases/web/web-recorded/compose.yml
printf 'recordFormat=2\nrelease=web-recorded\nweb=%s\ningress=%s\nfragment=%s\n' "$(pair a)" "$(pair b)" \
  /opt/dormduri/releases/web/web-recorded/compose.yml >"${state}/current"
touch /opt/dormduri/mode/maintenance
run web-maintenance SSM_action=deploy SSM_apiDigest="${A}" SSM_apiMigrateDigest="${M}"
