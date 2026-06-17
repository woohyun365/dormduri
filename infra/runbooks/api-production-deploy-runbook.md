# API production deploy runbook

이 runbook은 API/nginx production deploy를 GitHub Actions와 수동 fallback 모두에서 같은 순서로 실행하기 위한 운영 절차다.

## Release order

1. `main` branch의 release commit SHA를 확인한다.
2. DB backup/PITR 상태와 최근 restore drill evidence를 확인한다.
3. GitHub Actions `API CI` workflow가 통과했는지 확인한다.
4. `API Production Deploy` workflow를 `dry_run=true`로 실행해 command boundary와 artifact 생성을 확인한다.
5. 운영자가 `production` environment approval을 확인한 뒤 `dry_run=false`로 실행한다.
6. Workflow가 아래 순서를 지키는지 확인한다.
   1. install/build/typecheck/lint/test
   2. Docker image build
   3. Prisma migration deploy
   4. DB role grant apply
   5. DB credential smoke
   6. API/nginx rollout
   7. `/health`, `/health/live`, `/health/ready` smoke
   8. `/internal/metrics` anonymous rejection + bearer authorized smoke
   9. release evidence artifact upload

## Manual fallback

GitHub Actions OIDC가 준비되지 않았거나 운영자가 수동 release를 선택하면 target host에서 같은 순서로 실행한다.

```bash
pnpm install --frozen-lockfile
pnpm shared:build
pnpm api:prisma:generate
pnpm check:api
pnpm test:api
pnpm build:api
docker compose -f infra/deploy/docker-compose.api.yml config

MIGRATION_DATABASE_URL='postgresql://...' pnpm api:db:deploy:migrate
MIGRATION_DATABASE_URL='postgresql://...' pnpm api:db:deploy:role-grants
MIGRATION_DATABASE_URL='postgresql://...' \
DATABASE_URL='postgresql://...' \
RETENTION_WORKER_DATABASE_URL='postgresql://...' \
RETENTION_DISCLOSURE_DATABASE_URL='postgresql://...' \
  pnpm api:db:deploy:smoke

API_IMAGE_TAG='<release-tag>' infra/deploy/scripts/api-production-rollout.sh
API_BASE_URL='https://api.example.com' \
METRICS_BEARER_TOKEN='<redacted>' \
  infra/deploy/scripts/api-release-smoke.sh
```

Command output과 artifact에는 secret value를 붙이지 않는다.

## Rollback

1. 실패 지점이 app rollout 전이면 migration/role grant 영향 범위를 확인하고 app rollout을 중지한다.
2. 실패 지점이 app rollout 후이면 이전 image tag로 되돌린다.

   ```bash
   API_IMAGE_TAG='<previous-safe-tag>' infra/deploy/scripts/api-production-rollout.sh
   ```

3. `/health/ready`와 `/internal/metrics` guard를 다시 확인한다.
4. DB migration 영향이 있으면 RDS snapshot/PITR restore 판단으로 에스컬레이션한다.

## Evidence

Release evidence에는 아래만 남긴다.

- workflow run id
- commit SHA
- image tag
- dry-run 여부
- migration/role grant/smoke 실행 여부
- health/metrics smoke status
- rollback 여부

DB URL, metrics bearer token, verification secret, HMAC secret, SES secret은 evidence에 남기지 않는다.
