#!/usr/bin/env bash
# CD deploy job이 SSM deploy document를 배포 대상 tag의 managed node에 보내고 command 단위 상태를 기다린다.
# usage: ssm-send.sh <deploy|rollback|maintenance> <digest>... <document sha256>
# document(DEPLOY_DOCUMENT)가 digest parameter 이름과 수를 정한다(web-cd·api-cd):
#   dormduri-web-deploy: <web digest> <ingress digest>
#   dormduri-api-deploy: <api digest> <api-migrate digest> <observability-config digest>
# 결과는 command 단위 집계 상태(ListCommands)로만 본다. node별 invocation 조회는 node ID를 내므로 하지 않는다(D-WB7).
# 실패 원인(입력 거부 exit 2, host lock exit 75, 자동 복귀 exit 1)은 operator가 console에서 본다(runbook).
set -euo pipefail

document=${DEPLOY_DOCUMENT:-}
case "$document" in
  dormduri-web-deploy) workflow=web-cd images=(web ingress) names=(webDigest ingressDigest) ;;
  dormduri-api-deploy)
    workflow=api-cd images=(api api-migrate observability-config)
    names=(apiDigest apiMigrateDigest observabilityConfigDigest)
    ;;
  *) echo "DEPLOY_DOCUMENT names no known deploy document" >&2; exit 2 ;;
esac
[ "$#" -eq $((${#names[@]} + 2)) ] || { echo "expected an action, ${#names[@]} digests and the document hash" >&2; exit 2; }

action=$1
digests=("${@:2:${#names[@]}}")
hash=${!#}

case "$action" in deploy | rollback | maintenance) ;; *) echo "unknown action" >&2; exit 2 ;; esac
for value in "${digests[@]}"; do
  [[ "$value" =~ ^sha256:[a-f0-9]{64}$ ]] || { echo "a digest is not sha256:<64 hex>" >&2; exit 2; }
done
[[ "$hash" =~ ^[a-f0-9]{64}$ ]] || { echo "the document hash is not a sha256 hex" >&2; exit 2; }

parameters=$(printf '{"action":["%s"]' "$action")
images_line=''
for index in "${!names[@]}"; do
  parameters+=$(printf ',"%s":["%s"]' "${names[$index]}" "${digests[$index]}")
  images_line+=" dormduri/${images[$index]}@${digests[$index]}"
done
parameters+='}'
command_id=$(aws ssm send-command \
  --document-name "$document" \
  --document-hash "$hash" \
  --document-hash-type Sha256 \
  --targets Key=tag:dormduri-deploy-target,Values=user-app \
  --parameters "$parameters" \
  --timeout-seconds 900 \
  --comment "$workflow ${GITHUB_RUN_ID:-local} $action" \
  --query Command.CommandId --output text)
# command ID는 UUID라 공개 기록 scanner의 activation ID 종류와 구분할 수 없다. log에 남기지 않는다.
echo "::add-mask::$command_id"
echo "sent $action${images_line}"

deadline=$((SECONDS + ${SSM_WAIT_SECONDS:-1200}))
while :; do
  # 조회가 한 번 실패해도(throttling 등) command는 host에서 계속 돈다. 빈 상태로 보고 다시 묻는다.
  row=$(aws ssm list-commands --command-id "$command_id" \
    --query 'Commands[0].[Status,TargetCount,CompletedCount,ErrorCount]' --output text) || row=""
  read -r status targets completed errors <<<"$row" || true
  case "$status" in
    Success)
      if [ "$targets" != 1 ] || [ "$completed" != 1 ] || [ "$errors" != 0 ]; then
        echo "command finished on $completed of $targets targets with $errors errors; expected exactly one node" >&2
        exit 1
      fi
      echo "$action succeeded on the deploy target"
      exit 0
      ;;
    Failed | TimedOut | Cancelled)
      echo "$action ended as $status (targets $targets, errors $errors); read the host result in the console" >&2
      exit 1
      ;;
  esac
  if [ "$SECONDS" -ge "$deadline" ]; then
    echo "$action is still ${status:-unknown} after the wait limit; check the command in the console before the next run" >&2
    exit 1
  fi
  sleep "${SSM_POLL_SECONDS:-10}"
done
