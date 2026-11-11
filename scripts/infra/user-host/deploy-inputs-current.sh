#!/usr/bin/env bash
# CD deploy job이 승인 뒤 첫 단계에서 이 실행의 image 쌍이 아직 main의 배포 입력과 같은지 본다(runbook 대기 실행 규칙).
# usage: deploy-inputs-current.sh <이 실행 commit> <main ref> [web|api]
# 세 번째 인자는 단계다(기본 web: web-cd, api: api-cd). main은 dev 승격을 merge commit으로 받으므로 history가 아니라 두
# commit의 배포 입력 tree를 비교한다(pathspec `git log`는 merge를 건너뛰고 dev 쪽 commit을 낸다). 같으면 exit 0, 다르면 1(더
# 새 실행을 승인한다), 모르는 단계와 git 오류는 2.
# 경로 목록은 각 workflow의 push `paths`와 같다(web-cd-contract.test.mjs·api-cd-contract.test.mjs가 고정한다). `!` 제외 경로는
# git `:(exclude)`다.
set -euo pipefail

WEB_DEPLOY_INPUT_PATHS=(
  apps/web
  packages/shared
  packages/tsconfig
  packages/eslint-config
  package.json
  pnpm-lock.yaml
  pnpm-workspace.yaml
  scripts/ci/product/prepare-next-standalone.mjs
  .dockerignore
  infra/deploy/web
  infra/deploy/user
  ':(exclude)infra/deploy/user/api'
  .github/workflows/web-cd.yml
)

API_DEPLOY_INPUT_PATHS=(
  apps/api
  packages/database
  packages/shared
  packages/tsconfig
  packages/eslint-config/package.json
  package.json
  pnpm-lock.yaml
  pnpm-workspace.yaml
  .dockerignore
  infra/deploy/api
  infra/db
  infra/deploy/user/api
  infra/deploy/user/ssm/lib.sh
  .github/workflows/api-cd.yml
)

run=${1:?the run commit}
main=${2:?the main ref}
case "${3:-web}" in
  web) paths=("${WEB_DEPLOY_INPUT_PATHS[@]}") ;;
  api) paths=("${API_DEPLOY_INPUT_PATHS[@]}") ;;
  *)
    echo "unknown stage: ${3}" >&2
    exit 2
    ;;
esac
set +e
git diff --quiet "$run" "$main" -- "${paths[@]}"
code=$?
set -e
case "$code" in
  0) echo "deploy inputs of this run are the same as $main" ;;
  1)
    echo "main has a newer deploy input change than this run; reject this run and approve the newer one" >&2
    exit 1
    ;;
  *)
    echo "could not compare the deploy inputs (git exit $code)" >&2
    exit 2
    ;;
esac
