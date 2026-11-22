#!/usr/bin/env bash
# dormduri-backoffice-bootstrap-owner 본문(첫 owner 계정 등록 code, backoffice-foundation D-BF13·OA-R10). Owner가 자기 관리 권한으로
# SSM Run Command를 실행한다(운영자 접속용 권한 세트·배포 role은 이 document를 보낼 수 없다). scripts/infra/backoffice-host/
# ssm-document.mjs가 이 파일과 ./lib.sh로 dormduri-backoffice-bootstrap-owner.json을 만든다. 파라미터는 interpolationType
# ENV_VAR로 SSM_email·SSM_displayName 환경 변수로만 받고(document의 allowedPattern이 먼저 거른다) 명령 인자로만 넘긴다.
# 지금 기록(`current`)의 API image와 secret으로 one-off `bootstrap-owner`를 실행한다. 활성 계정이 있으면 앱이 거부한다(exit 2).
# 등록 code JSON 한 줄은 표준 출력(SSM 결과)에만 나간다. host log·docker log에는 남지 않는다(compose의 log driver none).
# 종료 코드: 0 발급, 1 실패, 2 거부(입력·상태·활성 계정 있음), 64 앱 입력 거부, 75 host lock.
set -euo pipefail
umask 022
export HOME=/root
export AWS_SHARED_CREDENTIALS_FILE=/root/.aws/credentials
export AWS_REGION=ap-northeast-2
export AWS_DEFAULT_REGION=ap-northeast-2
export PATH=/snap/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

base=/opt/dormduri
state=${base}/state
log=${state}/bootstrap-owner.log
action=bootstrap-owner

email=${SSM_email:-}
display_name=${SSM_displayName:-}
if ! [[ ${email} =~ ^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,63}$ ]] \
  || [ -z "${display_name}" ] || [ "${#display_name}" -gt 60 ]; then
  echo "RESULT=rejected reason=input"
  exit 2
fi

install -d -m 0700 "${state}"
exec 9>"${state}/lock"
if ! flock -n 9; then
  echo "RESULT=locked action=${action}"
  exit 75
fi

#__BACKOFFICE_HOST_LIB__

rotate_log
say "START action=${action}"
[ -f "${state}/current" ] || fail no-current 2
registry_init
use_record "${state}/current" || fail record 2

# one-off는 지금 묶음 image를 그대로 쓴다(새로 받지 않는다). 출력은 바로 표준 출력으로 보낸다.
set +e
docker compose -p "${project}" -f "${fragment}" --profile bootstrap run --rm --no-deps --pull never -T \
  bootstrap-owner --email "${email}" --display-name "${display_name}" 2>>"${log}"
status=$?
set -e
case "${status}" in
  0) say "RESULT=succeeded action=${action}" ;;
  2) fail refused-active-account 2 ;;
  64) fail app-input 64 ;;
  *) fail one-off "${status}" ;;
esac
