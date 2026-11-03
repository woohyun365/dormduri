#!/usr/bin/env bash
# Web CD deploy job이 승인 뒤 첫 단계에서 이 실행의 image 쌍이 아직 main의 배포 입력과 같은지 본다(runbook 대기 실행 규칙).
# usage: deploy-inputs-current.sh <이 실행 commit> <main ref>
# main은 dev 승격을 merge commit으로 받으므로 history가 아니라 두 commit의 배포 입력 tree를 비교한다(pathspec `git log`는
# merge를 건너뛰고 dev 쪽 commit을 낸다). 같으면 exit 0, 다르면 1(더 새 실행을 승인한다), git 오류는 2.
# 경로 목록은 web-cd.yml의 push `paths`와 같다(web-cd-contract.test.mjs가 고정한다).
set -euo pipefail

DEPLOY_INPUT_PATHS=(
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
  .github/workflows/web-cd.yml
)

run=${1:?the run commit}
main=${2:?the main ref}
set +e
git diff --quiet "$run" "$main" -- "${DEPLOY_INPUT_PATHS[@]}"
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
