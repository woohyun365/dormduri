# API production deploy runbook

이 runbook은 API/nginx production deploy를 GitHub Actions와 수동 fallback 모두에서 같은 순서로 실행하기 위한 운영 절차다.

## Final release checklist gate

Production deploy workflow를 실행하기 전에 `infra/runbooks/production-release-checklist.md`를 완료한다. 이 checklist는 config/secret, SES, health, DB/RDS, backup/restore, ingress/TLS/CORS/cookie, CI/CD, observability, stress evidence를 하나의 `GO`/`NO-GO` 판단 record로 묶는다. Release blocker가 하나라도 남아 있으면 deploy를 중지하고 `infra/runbooks/incident-rollback.md`로 rollback 또는 escalation을 판단한다.

## Release order

1. `main` branch의 release commit SHA를 확인하고 `infra/runbooks/production-release-checklist.md` metadata를 채운다.
2. `infra/aws/rds-setup-checklist.md`와 `infra/runbooks/backup-restore-drill.md` 기준으로 DB backup/PITR 상태와 최근 backup/restore drill evidence를 확인한다.
3. GitHub Actions `API CI` workflow가 통과했는지 확인하고 `pnpm check:api`, `pnpm build:api` evidence를 checklist에 연결한다.
4. `API Production Deploy` workflow를 `dry_run=true`로 실행해 command boundary와 artifact 생성을 확인한다.
5. 운영자가 `production` environment approval을 확인한 뒤 `restore_drill_evidence_id`를 입력하고 `dry_run=false`로 실행한다.
6. `API Restore Drill Manual` workflow의 dry-run 또는 운영자가 남긴 restore drill evidence가 release commit과 호환되는지 확인한다.
7. Workflow가 아래 순서를 지키는지 확인한다.
   1. install/build/typecheck/lint/test
   2. Docker image build
   3. Prisma migration deploy
   4. DB role grant apply
   5. DB credential smoke
   6. API/nginx rollout
   7. `/health`, `/health/live`, `/health/ready` smoke
   8. `/internal/metrics` anonymous rejection + bearer authorized smoke
   9. release evidence artifact upload

## Backup/restore drill gate

Production deploy 전에 backup이 실제로 복구 가능한지 확인한다. 운영자는 `infra/runbooks/backup-restore-drill.md`에 따라 temporary restored DB를 만들고, 아래 smoke를 restored DB credential로 실행한다.

```bash
RESTORE_DRILL_MIGRATION_DATABASE_URL='postgresql://...' \
RESTORE_DRILL_DATABASE_URL='postgresql://...' \
RESTORE_DRILL_RETENTION_WORKER_DATABASE_URL='postgresql://...' \
RESTORE_DRILL_RETENTION_DISCLOSURE_DATABASE_URL='postgresql://...' \
  pnpm api:db:restore-drill:smoke
```

GitHub Actions를 사용할 때는 `.github/workflows/api-restore-drill-manual.yml`을 `dry_run=true`로 먼저 실행하고, restored DB secret set이 준비된 뒤 `dry_run=false` evidence를 남긴다. 이 workflow는 RDS restore resource를 자동 생성하지 않고, 운영자가 만든 restored DB에 대한 smoke와 secret-free artifact만 생성한다.

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

상세 rollback 및 escalation 절차는 `infra/runbooks/incident-rollback.md`가 소유한다. Production resource나 traffic이 바뀌었을 가능성이 있는 deploy gate failure에서는 해당 runbook을 사용한다.

1. 실패 지점이 app rollout 전이면 migration/role grant 영향 범위를 확인하고 app rollout을 중지한다.
2. 실패 지점이 app rollout 후이면 이전 image tag로 되돌린다.

   ```bash
   API_IMAGE_TAG='<previous-safe-tag>' infra/deploy/scripts/api-production-rollout.sh
   ```

3. `/health/ready`와 `/internal/metrics` guard를 다시 확인한다.
4. DB migration 영향이 있으면 RDS snapshot/PITR restore 판단으로 에스컬레이션한다. 자동 down migration을 기본 rollback 경로로 사용하지 않는다.
5. rollback 후 release checklist에 final decision, blocker, follow-up issue를 기록한다.

## Evidence

Release evidence에는 아래만 남긴다. `infra/runbooks/production-release-checklist.md`의 secret-free evidence template을 기준으로 한다.

- workflow run id
- commit SHA
- image tag
- dry-run 여부
- migration/role grant/smoke 실행 여부
- health/metrics smoke status
- rollback 여부
- restore drill workflow run id 또는 manual evidence id
- restored DB identifier와 restore source의 secret-free identifier
- restore drill smoke status와 cleanup status

DB URL, metrics bearer token, verification secret, HMAC secret, SES secret, restored DB password는 evidence에 남기지 않는다.
