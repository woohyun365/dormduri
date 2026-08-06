# Production DB deploy runbook

`infra/db`는 API container startup 밖에서 실행하는 production DB release 절차를 소유한다. API image와 `infra/deploy` compose는 migration이나 role grant를 자동 실행하지 않는다.

## Credential boundary

| Env key                             | 용도                                                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                      | API runtime credential. 사용자 트래픽 처리용 pooled/app role URL이다.                                                                                  |
| `DIRECT_URL`                        | Prisma CLI direct connection 후보. Local/dev에서는 `DATABASE_URL` fallback이 가능하지만 production deploy에서는 migration/admin credential과 분리한다. |
| `MIGRATION_DATABASE_URL`            | one-off migration/admin credential. `prisma migrate deploy`, role grant apply, migration smoke에서만 사용한다.                                         |
| `RETENTION_WORKER_DATABASE_URL`     | retention/archive/review worker credential. RRPD payload write/read boundary를 runtime과 분리한다.                                                     |
| `RETENTION_DISCLOSURE_DATABASE_URL` | disclosure/support review credential. RRPD disclosure read/access-log/review-job boundary를 runtime과 분리한다.                                        |

Secret value는 command output, CI log, issue, report에 남기지 않는다. 스크립트는 env key name만 출력한다.

## Release order

1. `infra/aws/rds-setup-checklist.md` 기준으로 RDS automated backup/PITR 설정을 확인하고 `infra/runbooks/backup-restore-drill.md` 기준의 최근 restore drill evidence를 확인한다.
2. App rollout 전에 migration/admin credential로 Prisma migration을 적용한다.

   ```bash
   MIGRATION_DATABASE_URL='postgresql://...' pnpm api:db:deploy:migrate
   ```

3. 같은 migration/admin credential로 DB role grants를 적용한다.

   ```bash
   MIGRATION_DATABASE_URL='postgresql://...' pnpm api:db:deploy:role-grants
   ```

4. runtime/retention/disclosure credential boundary를 smoke한다.

   ```bash
   MIGRATION_DATABASE_URL='postgresql://...' \
   DATABASE_URL='postgresql://...' \
   RETENTION_WORKER_DATABASE_URL='postgresql://...' \
   RETENTION_DISCLOSURE_DATABASE_URL='postgresql://...' \
     pnpm api:db:deploy:smoke
   ```

5. API/nginx를 rollout한다.
6. `/health/ready`를 확인한다.
7. CloudWatch `DatabaseConnections`, `CPUUtilization`, `FreeableMemory`, `ReadIOPS`, `WriteIOPS`, `DiskQueueDepth`, `FreeStorageSpace`를 확인한다.

## Commands

### Migration deploy

```bash
pnpm api:db:deploy:migrate
```

- 내부적으로 `MIGRATION_DATABASE_URL`을 Prisma CLI의 `DIRECT_URL`과 `DATABASE_URL`로 주입한다.
- `prisma migrate deploy --schema prisma/schema.prisma`만 실행한다.
- Production deploy path에서 `prisma db push`, development migration, seed를 실행하지 않는다.

### Role grant apply

```bash
pnpm api:db:deploy:role-grants
```

- `apps/api/prisma/role-grants/auth-role-grants.sql`
- `apps/api/prisma/role-grants/rrpd-role-grants.sql`

두 SQL artifact를 `psql -v ON_ERROR_STOP=1`로 같은 migration/admin credential에 적용한다.

Optional override env:

- `DB_GRANT_SCHEMA` (default: `public`)
- `DB_APP_RUNTIME_ROLE` (default: `app_runtime`)
- `DB_RETENTION_WORKER_ROLE` (default: `retention_worker`)
- `DB_RETENTION_DISCLOSURE_ROLE` (default: `retention_disclosure`)
- `DB_READONLY_ROLE` (default: `app_readonly`)
- `DB_MIGRATION_ROLE` (default: `migration_owner`)

Override 값은 identifier-like 값만 허용한다.

Production에서는 위 role 이름이 실제 connection string의 login role과 같거나, 별도 DBA 절차로 login role이 해당 application role의 member여야 한다. 이 script는 password, LOGIN role 생성, role membership 부여를 자동 수행하지 않는다. Credential 생성/rotation은 RDS/IAM/Secrets Manager 운영 절차에서 관리하고, 이 script는 schema/table privilege baseline만 적용한다.

### Role grant smoke

```bash
pnpm api:db:deploy:smoke
```

Smoke는 destructive DML/DDL을 하지 않는다. 다음을 확인한다.

- migration credential이 연결되고 `_prisma_migrations`를 읽을 수 있다.
- runtime credential은 일반 app table read가 가능하다.
- runtime credential은 RRPD payload table read/write 권한을 갖지 않는다.
- retention worker credential은 retained identity/review job 작업 권한을 갖는다.
- disclosure credential은 retained identity/access log/review job disclosure 권한을 갖는다.

### Restore drill smoke

```bash
pnpm api:db:restore-drill:smoke
```

Restore drill smoke는 `RESTORE_DRILL_*` credential을 기존 role grant smoke의 `MIGRATION_DATABASE_URL`, `DATABASE_URL`, `RETENTION_WORKER_DATABASE_URL`, `RETENTION_DISCLOSURE_DATABASE_URL`로 매핑해 재사용한다. 이 smoke는 temporary restored DB에서 실행하며 production source DB를 수정하지 않는다. 실제 실행 전에는 `infra/runbooks/backup-restore-drill.md`에 따라 restored DB identifier, restore source, cleanup evidence를 준비한다.

Required env for real smoke:

- `RESTORE_DRILL_MIGRATION_DATABASE_URL`
- `RESTORE_DRILL_DATABASE_URL`
- `RESTORE_DRILL_RETENTION_WORKER_DATABASE_URL`
- `RESTORE_DRILL_RETENTION_DISCLOSURE_DATABASE_URL`

Secret value는 출력하지 않고 env key name과 pass/fail status만 남긴다.

## Dry-run

DB 접속 없이 script shape와 required env boundary만 확인할 수 있다.

```bash
MIGRATION_DATABASE_URL='postgresql://redacted@example/db' pnpm --dir apps/api db:deploy:migrate -- --dry-run
MIGRATION_DATABASE_URL='postgresql://redacted@example/db' pnpm --dir apps/api db:deploy:role-grants -- --dry-run
pnpm --dir apps/api db:deploy:smoke -- --dry-run
pnpm --dir apps/api db:restore-drill:smoke -- --dry-run
```

Dry-run output도 secret value를 출력하지 않는다.

## RDS SSL / CA bundle

Production RDS PostgreSQL은 SSL/TLS connection을 기본으로 한다. Connection string에는 운영 방식에 맞춰 `sslmode=require` 또는 CA bundle 검증 옵션을 둔다. AWS RDS CA bundle 파일 자체는 repo에 넣지 않는다. CA bundle 배포가 필요하면 host image/bootstrap 또는 secret/config management 경로에서 제공한다.

## Connection budget

초기 runtime은 app role, retention worker role, retention disclosure role pool을 사용한다. Migration/role grant/smoke는 one-off connection을 추가로 사용한다. Release 전에는 다음을 합산해 RDS max connection과 CloudWatch `DatabaseConnections` budget을 확인한다.

```txt
(instance count × app role pool max)
+ (worker/disclosure role pool max)
+ one-off migration/psql connections
+ emergency/operator sessions
```

## Rollback / restore

Prisma migration은 production에서 자동 down migration으로 되돌리지 않는다. Migration 실패 또는 rollout 실패 시 판단 순서는 다음과 같다.

1. application image rollback.
2. migration 영향 범위 확인.
3. 필요한 경우 RDS snapshot/PITR restore.
4. restored DB에서 migration baseline, role grant smoke, `/health/ready` smoke를 재검증.

Backup/restore drill은 `infra/runbooks/backup-restore-drill.md` 기준으로 수행하고, RDS setup baseline은 `infra/aws/rds-setup-checklist.md` 기준으로 확인한다. Restore drill evidence 없이 production ready로 표시하지 않는다.

## Verification

```bash
pnpm --dir apps/api exec vitest run --config ./vitest.config.unit.ts --maxWorkers=50% \
  test/operations/platform/database-deploy.spec.ts \
  test/operations/database/auth-role-grants.spec.ts \
  test/operations/database/rrpd-role-grants.spec.ts \
  test/operations/database/migration-baseline.spec.ts
pnpm --dir apps/api exec eslint test/operations/platform/database-deploy.spec.ts
sh -n infra/db/migrate-deploy.sh infra/db/apply-role-grants.sh infra/db/smoke-role-grants.sh infra/db/restore-drill-smoke.sh
pnpm prettier --check infra/db/README.md apps/api/test/operations/platform/database-deploy.spec.ts apps/api/test/operations/platform/backup-restore-drill.spec.ts
pnpm api:typecheck
git diff --check
```
