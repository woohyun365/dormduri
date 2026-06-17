#!/usr/bin/env sh
set -eu

usage() {
  cat <<'USAGE'
Usage: infra/deploy/scripts/api-production-rollout.sh [--dry-run]

Rolls out the API/nginx compose on a production host without printing secrets.
Required env:
  API_IMAGE_TAG
Optional env:
  DEPLOY_TRANSPORT=ssm|local (default: ssm)
  AWS_REGION (required for DEPLOY_TRANSPORT=ssm)
  DEPLOY_INSTANCE_ID (required for DEPLOY_TRANSPORT=ssm)
  DEPLOY_WORKDIR (required for DEPLOY_TRANSPORT=ssm; default for local: repo root)
USAGE
}

fail() {
  echo "$1" >&2
  exit "${2:-1}"
}

repo_root() {
  CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd
}

require_env() {
  name="$1"
  eval "value=\${$name:-}"
  if [ -z "$value" ]; then
    fail "missing required env: $name" 64
  fi
}

shell_quote() {
  printf "'%s'" "$(printf "%s" "$1" | sed "s/'/'\\''/g")"
}

dry_run=false
while [ "$#" -gt 0 ]; do
  case "$1" in
    --)
      shift
      continue
      ;;
    --dry-run)
      dry_run=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      exit 64
      ;;
  esac
  shift
done

require_env API_IMAGE_TAG

transport="${DEPLOY_TRANSPORT:-ssm}"
case "$transport" in
  ssm|local) ;;
  *) fail 'DEPLOY_TRANSPORT must be one of: ssm, local' 64 ;;
esac

if [ "$dry_run" = true ]; then
  echo "dry-run: would roll out API_IMAGE_TAG using DEPLOY_TRANSPORT=${transport}"
  echo 'dry-run: would validate docker compose and run API/nginx up without printing secret values'
  exit 0
fi

if [ "$transport" = local ]; then
  root="$(repo_root)"
  workdir="${DEPLOY_WORKDIR:-$root}"
  compose_file="$workdir/infra/deploy/docker-compose.api.yml"

  if ! command -v docker >/dev/null 2>&1; then
    fail 'missing required command: docker' 69
  fi
  if [ ! -f "$compose_file" ]; then
    fail 'missing deploy compose file at DEPLOY_WORKDIR' 66
  fi

  API_IMAGE_TAG="$API_IMAGE_TAG" docker compose -f "$compose_file" config >/tmp/knu-api-production-compose.yml
  API_IMAGE_TAG="$API_IMAGE_TAG" docker compose -f "$compose_file" up -d api nginx
  echo 'local API/nginx rollout command completed'
  exit 0
fi

require_env AWS_REGION
require_env DEPLOY_INSTANCE_ID
require_env DEPLOY_WORKDIR

if ! command -v aws >/dev/null 2>&1; then
  fail 'missing required command: aws' 69
fi

quoted_workdir="$(shell_quote "$DEPLOY_WORKDIR")"
quoted_image_tag="$(shell_quote "$API_IMAGE_TAG")"
remote_command="cd ${quoted_workdir} && docker compose -f infra/deploy/docker-compose.api.yml config >/tmp/knu-api-production-compose.yml && API_IMAGE_TAG=${quoted_image_tag} docker compose -f infra/deploy/docker-compose.api.yml up -d api nginx"

aws ssm send-command \
  --region "$AWS_REGION" \
  --instance-ids "$DEPLOY_INSTANCE_ID" \
  --document-name 'AWS-RunShellScript' \
  --comment 'knu-roommate-api-production-rollout' \
  --parameters "commands=${remote_command}" \
  --query 'Command.CommandId' \
  --output text >/tmp/knu-api-ssm-command-id.txt

echo 'ssm API/nginx rollout command submitted'
