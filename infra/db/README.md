# Database operator scripts

`infra/db`는 API container startup 밖에서 실행하는 role bootstrap, migration, role grant, credential smoke
**operator script**와 그 입력 계약을 소유한다. 실제 release 순서, 승인, backup·restore evidence는
`infra/runbooks/`가 소유하며 API image와 `infra/deploy` Compose는 migration이나 role grant를 자동
실행하지 않는다.

## 책임 경계

- Script interface와 fail-fast 규칙: 이 문서와 `infra/db/*.sh`
- Grant 표·열 분류·bootstrap·grant·smoke SQL: [`packages/database/prisma/role-grants/`](../../packages/database/prisma/role-grants/)
- 반복 가능한 backup·restore 절차: `infra/runbooks/operations/database/backup-restore.md`
- 실제 release 준비와 최종 판정: `infra/runbooks/release/`
- AWS RDS target 입력: `infra/aws/rds-setup-checklist.md`

아래 release order는 script 호출 순서를 빠르게 찾기 위한 요약이며 승인·증거 owner를 대체하지 않는다.

## Credential boundary

권한은 NOLOGIN group role이 갖고, 접속은 서비스·사람마다 따로 둔 LOGIN user가 그 group의 member로 한다.
LOGIN user는 group 권한을 상속하고(INHERIT) 다른 app group의 member가 아니다.

| Group role(NOLOGIN)    | LOGIN user                                                               | 쓰는 곳                       | Env key                             | CONNECTION LIMIT |
| ---------------------- | ------------------------------------------------------------------------ | ----------------------------- | ----------------------------------- | ---------------- |
| `migration_owner`      | `dormduri_migrator`(`SET role = migration_owner`)                        | migration·grant·smoke one-off | `MIGRATION_DATABASE_URL`            | 3                |
| `app_runtime`          | `dormduri_api`                                                           | 사용자 API                    | `DATABASE_URL`                      | 22               |
| `retention_worker`     | `dormduri_retention_worker`                                              | 사용자 API의 정리·계정 삭제   | `RETENTION_WORKER_DATABASE_URL`     | 8                |
| `retention_disclosure` | `dormduri_api_disclosure`(사용자 API), 백오피스용 user는 백오피스가 더함 | RRPD 제한 열람                | `RETENTION_DISCLOSURE_DATABASE_URL` | 4                |
| `backoffice_runtime`   | 백오피스 API가 더함                                                      | 백오피스 API                  | 백오피스 env                        | —                |
| `app_readonly`         | `dormduri_ro_<운영자 별칭>`                                              | 사람 조회(SSM 포트 포워딩)    | 사람 접속                           | 4                |
| (master)               | RDS master user                                                          | bootstrap·비상(break-glass)   | Secrets Manager, 일상 사용 안 함    | —                |

- `migration_owner`가 schema의 모든 객체를 소유한다. `dormduri_migrator`는 접속하면 `migration_owner`가 되므로
  Prisma가 만드는 객체도 그 소유다. `migration_owner`는 대상 schema의 USAGE·CREATE와 database CREATE를 받는다
  (initial baseline의 `CREATE SCHEMA IF NOT EXISTS`·`CREATE EXTENSION IF NOT EXISTS`가 database CREATE를 먼저
  검사한다). app role은 그 role이 만들 수 있는 다른 schema에 USAGE가 없다.
- 사람 LOGIN user와 master는 `pgaudit.log = 'all'`이다. master session은 그 설정을 끌 수 있어 접속·종료 log와
  break-glass 기록(아래)으로 보완한다.
- CONNECTION LIMIT는 서비스 user가 pool × 2 + 2(rollout 때 옛·새 container 겹침), one-off·사람 user가 pool + 1이다.
- `DIRECT_URL`은 Prisma CLI direct connection 후보다. Local/dev에서는 `DATABASE_URL` fallback이 가능하지만 production
  deploy에서는 migration credential과 같은 값이다.

Secret value는 command output, CI log, issue, report에 남기지 않는다. 스크립트는 env key name과 LOGIN user 이름만
출력한다.

## Grant 표

`packages/database/prisma/role-grants/role-grant-matrix.csv`가 table마다 허용 권한의 유일한 원본이다. 적용
(`apply-role-grants.sql`)과 smoke(`smoke-role-grants.sql`)가 같은 입력 정의(`role-grant-inputs.sql`)로 이 표와
`column-classes.csv`를 읽으므로 둘이 표를 다르게 해석할 수 없다.

- 행 형식: `table,role,privileges,columns`. `privileges`는 공백으로 나눈 `SELECT INSERT UPDATE DELETE`, `columns`는
  비우면 table 단위, 열 이름을 쓰면 그 열만, `-secret -content`처럼 `-<class>`를 쓰면 그 class를 뺀 분류된 열
  전부다. 표에 없는 조합은 모두 거부다. role 칸의 `none`은 "표에 있지만 권한 없음"이다.
- `column-classes.csv`는 모든 열의 개인정보 class(`secret`·`identifier`·`pseudonymous`·`quasi`·`content`·
  `reference`·`operational`)다. 사람 조회 권한은 secret·content 열을 빼고 RRPD는 `RetentionCase.id`(복원 훈련 행 수 대조)만 읽으며, 백오피스 열 단위 권한과 log·경보 payload
  가림이 같은 분류를 쓴다.
- 적용은 fail closed다. schema에 표에 없는 table·view, 분류되지 않은 열, 표에만 있는 table·열, sequence, routine이
  하나라도 있으면 아무 권한도 바꾸지 않고 실패한다. extension 소유 객체(`pg_stat_statements` view, `pgaudit` 함수)는
  extension의 것이라 판정하지 않는다. 지금 sequence·routine은 없다(id는 앱이 만드는 문자열). 생기면 이 pipeline에
  규칙을 먼저 더한다(sequence는 그 table에 INSERT하는 role이 USAGE를 받는다).
- 적용은 PUBLIC과 관리 role 다섯의 table 권한을 모두 지운 뒤(table REVOKE는 열 권한도 지움) 표의 권한만 준다.
  schema USAGE와 enum type USAGE는 관리 role 모두가 받는다.
- default privilege는 `ALTER DEFAULT PRIVILEGES FOR ROLE migration_owner`의 전역 형태로 새 함수의 PUBLIC EXECUTE를
  막는다(`database-defaults.sql`). 앱 role에 자동 grant는 없어서 새 table은 표에 넣고 같은 release의 grant 단계가
  돌아야 열린다.
- `apps/api/test/operations/database/role-grant-matrix.spec.ts`와 `column-classes.spec.ts`가 `schema.prisma`의 모든
  model·열이 표·분류에 있는지와 최소 권한·append-only 불변 조건을 CI에서 막는다.

묶음별 요약(원본은 CSV):

| 묶음                                        | runtime                    | worker                              | disclosure                                                        | readonly            |
| ------------------------------------------- | -------------------------- | ----------------------------------- | ----------------------------------------------------------------- | ------------------- |
| 일반 기능·outbox                            | DML                        | 대화 보존이 쓰는 outbox·구성원 연산 | —                                                                 | secret·content 제외 |
| 계정 삭제·archive가 고치는 사용자 table(13) | DML                        | 계정 삭제·archive가 쓰는 연산       | —                                                                 | secret·content 제외 |
| auth 정리(5)                                | DML                        | SELECT·DELETE(`AuthSession` UPDATE) | —                                                                 | secret·content 제외 |
| 시즌 운영 감사                              | SELECT·INSERT(append-only) | —                                   | —                                                                 | content 제외        |
| RRPD 열람 기록 `RetentionAccessLog`         | —                          | DML(폐기)                           | SELECT·INSERT                                                     | —                   |
| RRPD anchor `RetentionCase`                 | INSERT, `id` 열 SELECT     | DML                                 | SELECT                                                            | `id` 열 SELECT      |
| RRPD 그 밖(6)                               | —                          | DML                                 | `ArchiveJob` 밖 SELECT, `RetentionReviewJob` SELECT·INSERT·UPDATE | —                   |
| `_prisma_migrations`                        | —                          | —                                   | —                                                                 | SELECT              |

`backoffice_runtime`은 지금 권한이 없다. 백오피스 기능이 필요한 열만 열 단위로 더하고 test로 고정한다.

## Release order

0. RDS를 만든 뒤 한 번(그리고 role을 더할 때마다) master user로 role을 bootstrap한다. 그 전에 parameter group의
   `shared_preload_libraries`에 `pgaudit`를 두고 reboot한 뒤 `CREATE EXTENSION pgaudit`를 실행한다.

   ```bash
   BOOTSTRAP_DATABASE_URL='postgresql://...' DB_READONLY_OPERATOR_ALIASES='<별칭>' pnpm api:db:bootstrap-roles
   ```

   bootstrap은 비밀번호를 정하지 않는다. 만든 LOGIN user마다 psql의 `\password`로 비밀번호를 정하고 Secrets
   Manager에 넣은 뒤 권한 내역을 기록한다(아래 "권한 내역과 break-glass").

1. `infra/aws/rds-setup-checklist.md` 기준으로 RDS automated backup/PITR 설정을 확인하고
   `infra/runbooks/operations/database/backup-restore.md` 기준의 최근 restore drill evidence를 확인한다.
2. App rollout 전에 migration credential로 Prisma migration을 적용한다. 시작 시각(UTC)을 단계 기록에 남긴다.
   데이터가 망가졌을 때 PITR 기준 시각이다.

   ```bash
   MIGRATION_DATABASE_URL='postgresql://...' pnpm api:db:deploy:migrate
   ```

3. 같은 migration credential로 grant 표를 적용한다.

   ```bash
   MIGRATION_DATABASE_URL='postgresql://...' pnpm api:db:deploy:role-grants
   ```

4. LOGIN user별 credential boundary를 smoke한다.

   ```bash
   MIGRATION_DATABASE_URL='postgresql://...' \
   DATABASE_URL='postgresql://...' \
   RETENTION_WORKER_DATABASE_URL='postgresql://...' \
   RETENTION_DISCLOSURE_DATABASE_URL='postgresql://...' \
     pnpm api:db:deploy:smoke
   ```

5. API/nginx를 rollout한다. 옛 API container를 멈춘 뒤 새 container를 시작해 정리 작업·outbox dispatcher가 두
   container에서 겹쳐 돌지 않게 한다.
6. `/health/ready`를 확인한다.
7. CloudWatch `DatabaseConnections`, `CPUUtilization`, `FreeableMemory`, `ReadIOPS`, `WriteIOPS`, `DiskQueueDepth`,
   `FreeStorageSpace`를 확인한다.

실패 처리:

- 2~4 어느 단계든 실패하면 rollout하지 않고 이전 container가 계속 돈다. 자동 복원은 없다. 사람이 원인을 본다.
- migration 실패: `_prisma_migrations`의 실패 행과 log, 부분 적용 여부를 확인한다(Prisma가 migration마다
  transaction으로 감싸는지 공식 문서 근거가 없어 부분 적용을 가정한다). 손으로 되돌렸으면
  `prisma migrate resolve --rolled-back`, 손으로 끝냈으면 `--applied`를 실행하고 고친 migration으로 다시 배포한다
  (forward-fix). 데이터가 망가졌을 때만 2의 시각으로 PITR한다.
- grant·smoke 실패: SQL이나 표를 고쳐 같은 run을 다시 돌린다. grant 적용은 한 transaction이라 실패하면 아무 권한도
  바뀌지 않는다.
- 사용자 release 선언 전에는 이전 image가 새 schema에서 깨질 수 있음을 받아들인다. 선언 뒤에는 expand-contract가
  필수다.

## Commands

### Role bootstrap

```bash
pnpm api:db:bootstrap-roles
```

- `packages/database/prisma/role-grants/bootstrap-roles.sql`을 master user(`BOOTSTRAP_DATABASE_URL`)로 한 transaction에서
  실행한다. 다시 실행하면 이미 있는 role·user·membership은 그대로 두고 role 속성(NOLOGIN/LOGIN, CONNECTION LIMIT)과
  user별 설정을 위 표 값으로 맞춘다.
- `DB_READONLY_OPERATOR_ALIASES`(쉼표로 나눈 `[a-z0-9_]` 별칭)마다 `dormduri_ro_<별칭>`을 만든다.
- `DB_BOOTSTRAP_SCHEMA`(default `public`)는 `migration_owner`가 객체를 만들 schema다.
- `pgaudit` extension이 없으면 실패한다. `DB_BOOTSTRAP_PGAUDIT=off`는 pgaudit가 없는 일회용 rehearsal
  PostgreSQL에서만 쓴다.

### Migration deploy

```bash
pnpm api:db:deploy:migrate
```

- 내부적으로 `MIGRATION_DATABASE_URL`을 Prisma CLI의 `DIRECT_URL`과 `DATABASE_URL`로 주입한다.
- `packages/database`에서 `prisma migrate deploy --schema prisma/schema.prisma`만 실행한다.
- Production deploy path에서 `prisma db push`, development migration, seed를 실행하지 않는다.

### Role grant apply

```bash
pnpm api:db:deploy:role-grants
```

`role-grant-inputs.sql`을 실행하고 `role-grant-matrix.csv`·`column-classes.csv`를 psql `\copy`로 적재한 뒤
`database-defaults.sql`과 `apply-role-grants.sql`을 `psql -v ON_ERROR_STOP=1 --single-transaction`으로 같은
migration credential에 적용한다. `DB_GRANT_SCHEMA`(default `public`, identifier-like 값만)로 대상 schema를 바꾼다.
Role 이름은 바꾸지 않는다. Group role이 없으면 실패하므로 먼저 bootstrap한다.

### Role grant smoke

```bash
pnpm api:db:deploy:smoke
```

Smoke는 읽기 전용이다(`default_transaction_read_only = on`). 다음을 확인한다.

- 세 app URL이 각자 LOGIN user로 접속하고, 허용 table 하나는 읽고 거부 table 하나는 `permission denied`다.
- migration URL은 `DB_EXPECTED_TABLE_OWNER`(default `migration_owner`)로 동작한다.
- schema의 모든 table·열에 대해 PUBLIC, group role 다섯, 세 LOGIN user의 table 권한 여덟 가지(PostgreSQL 17+의
  `MAINTAIN` 포함)와 열 권한 네 가지가 grant 표와 같다. 감사 table의 append-only와 `_prisma_migrations` 권한도 이
  비교에 든다.
- LOGIN user는 자기 group만 상속하고 superuser·CREATEROLE·CREATEDB·BYPASSRLS가 없다.
- 모든 객체의 소유자, app role의 schema·database CREATE 없음, `migration_owner` default privilege(PUBLIC 함수 실행
  없음, 어느 role에도 자동 부여 없음).

사람 조회 user처럼 host에 credential을 두지 않는 LOGIN user도 group 하나의 직접 member이면 같은 table·열 비교에 들어간다
(권한은 role 이름으로 계산하므로 credential이 필요 없다). 그래서 predefined role(`pg_read_all_data` 등)이나 표 밖 role을
거친 권한도 걸린다. group 둘 이상의 직접 member, superuser·CREATEROLE·CREATEDB·BYPASSRLS, group을 거치지 않은 직접
grant(table·열)는 migration 연결의 구조 검사가 거부한다.

### Restore drill smoke

```bash
pnpm api:db:restore-drill:smoke
```

Restore drill smoke는 `RESTORE_DRILL_*` credential을 기존 role grant smoke의 `MIGRATION_DATABASE_URL`, `DATABASE_URL`,
`RETENTION_WORKER_DATABASE_URL`, `RETENTION_DISCLOSURE_DATABASE_URL`로 매핑해 재사용한다. 이 smoke는 temporary restored DB에서
실행하며 production source DB를 수정하지 않는다. 실제 실행 전에는 `infra/runbooks/operations/database/backup-restore.md`에
따라 restore source와 cleanup evidence를 준비한다.

Required env for real smoke:

- `RESTORE_DRILL_MIGRATION_DATABASE_URL`
- `RESTORE_DRILL_DATABASE_URL`
- `RESTORE_DRILL_RETENTION_WORKER_DATABASE_URL`
- `RESTORE_DRILL_RETENTION_DISCLOSURE_DATABASE_URL`

Secret value는 출력하지 않고 env key name과 pass/fail status만 남긴다.

## 새 role 추가

별도 worker·지표 읽기처럼 새 용도가 생기면 같은 구조로 더한다. 백오피스 API의 role 연결이 첫 사례다.

1. `bootstrap-roles.sql`에 group role(NOLOGIN)·LOGIN user·membership·`ALTER ROLE … SET`(사람 user면
   `pgaudit.log = 'all'`) 줄을 더하고 master user가 bootstrap을 다시 실행한다(이미 있는 것은 건너뜀).
2. `role-grant-matrix.csv`에 그 role의 행을 table마다 더한다. 근거는 production 호출부다. 관리 role이면
   `role-grant-inputs.sql`의 관리 role 목록과 test의 목록에도 더한다.
3. 아래 connection budget을 다시 계산하고 CONNECTION LIMIT을 정한다.
4. smoke가 그 LOGIN user(또는 host에 credential이 없으면 group role)로 표 전체를 확인한다.
5. env·secret 위치를 그 서비스 owner가 정한다.

## 권한 내역과 break-glass

사람 DB 계정의 권한 부여·변경·말소 내역은 3년, break-glass 사용은 그때마다 전용 운영 GitHub 이슈
(`DB 사람 계정 권한 내역·break-glass 기록`, 닫지 않음)의 댓글로 남긴다. pgAudit log는 이 기록을 대신하지 않는다.

- 권한 내역: 날짜(UTC), 대상 LOGIN user 종류와 운영자 별칭, 부여·변경·말소한 role, 승인자, 적용한 bootstrap·grant
  SQL의 commit. 처음 bootstrap이 만든 master·사람 조회 user가 첫 기록이다.
- break-glass: 시각(UTC), 이유, 쓴 LOGIN user 종류, 비밀번호 교체 여부. master는 쓴 뒤 비밀번호를 교체한다.
- 두 기록 모두 식별자·query 내용·데이터 값·비밀번호를 적지 않는다.

## Dry-run

DB 접속 없이 script shape와 required env boundary만 확인할 수 있다.

```bash
BOOTSTRAP_DATABASE_URL='postgresql://redacted@example/db' pnpm --dir apps/api db:bootstrap-roles -- --dry-run
MIGRATION_DATABASE_URL='postgresql://redacted@example/db' pnpm --dir apps/api db:deploy:migrate -- --dry-run
MIGRATION_DATABASE_URL='postgresql://redacted@example/db' pnpm --dir apps/api db:deploy:role-grants -- --dry-run
pnpm --dir apps/api db:deploy:smoke -- --dry-run
pnpm --dir apps/api db:restore-drill:smoke -- --dry-run
```

Dry-run output도 secret value를 출력하지 않는다.

## RDS SSL / CA bundle

Production RDS PostgreSQL은 SSL/TLS connection을 기본으로 한다. Connection string에는 운영 방식에 맞춰 `sslmode=require`
또는 CA bundle 검증 옵션을 둔다. AWS RDS CA bundle 파일 자체는 repo에 넣지 않는다. CA bundle 배포가 필요하면 host
image/bootstrap 또는 secret/config management 경로에서 제공한다.

## Connection budget

Pool은 Prisma role마다 따로다(#238).

| 접속                                     | pool max   | Env key                                                                                               |
| ---------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| 사용자 API runtime / worker / disclosure | 10 / 3 / 1 | `DATABASE_POOL_MAX` / `RETENTION_WORKER_DATABASE_POOL_MAX` / `RETENTION_DISCLOSURE_DATABASE_POOL_MAX` |
| 백오피스 API runtime / disclosure        | 5 / 2      | 백오피스 env                                                                                          |
| migration(one-off)                       | 2          | —                                                                                                     |
| 사람 조회                                | 3          | —                                                                                                     |

규칙: rollout 때 옛·새 container가 겹치므로 서비스 pool 합을 2배로 센다.

```txt
(사용자 API 14 + 백오피스 7) × 2 + migration 2 + 사람 3 + RDS 예약 연결 ≤ max_connections × 0.6
```

PostgreSQL 기본 예약 연결 3이면 합 50이고 `max_connections` 84 이상이 필요하다. Target에서 `SHOW max_connections`와
`superuser_reserved_connections`·`reserved_connections`를 읽어 확인하고, 넘치면 runtime pool을 줄이거나 instance
class를 올린다. CloudWatch `DatabaseConnections`로 실제 사용량을 본다.

## 유지보수

분기 점검은 restore drill과 같은 날 한다. 결과는 식별자 없이 restore drill evidence에 남긴다.

- autovacuum: 삭제·갱신이 잦은 table(outbox 5개, auth 정리 5개, `ArchiveJob`·`RetentionReviewJob`·
  `RetentionAccessLog`)의 `pg_stat_user_tables` dead tuple 비율과 마지막 autovacuum 시각을 본다. dead tuple이 live의
  20%를 넘는 상태가 하루 넘게 이어지는 table만 table별 storage parameter(낮은 `autovacuum_vacuum_scale_factor`)를
  migration으로 둔다.
- bloat: 위 table의 `pg_total_relation_size`와 live 행 수 추세를 본다. 크기가 live 추정의 2배를 넘으면
  `REINDEX CONCURRENTLY`·`VACUUM` 계획을 세운다. `VACUUM FULL`은 잠금 때문에 쓰지 않는다.
- index: 통계 초기화 뒤 한 분기 넘게 `idx_scan = 0`인 index는 제거 후보로 기록하고, 지우는 일은 migration PR이 한다.
- 통계: autovacuum analyze가 기본이다. 큰 data migration 뒤에는 그 table에 `ANALYZE`를 실행한다.
- `pg_stat_statements`: `total_exec_time` 상위 query를 기록한다.

## Rollback / restore

Prisma migration은 production에서 자동 down migration으로 되돌리지 않는다. 판단 순서는 다음과 같다.

1. migration 단계가 실패했으면 rollout하지 않았으므로 이전 container가 그대로다. forward-fix한다(위 실패 처리).
2. rollout 뒤 실패면 application image를 이전 digest로 rollback한다. migration은 되돌리지 않는다.
3. 데이터가 망가졌을 때만 migration 시작 시각으로 RDS PITR restore한다.
4. restored DB에서 migration baseline, role grant smoke, `/health/ready` smoke를 재검증한다.

Backup/restore drill은 `infra/runbooks/operations/database/backup-restore.md` 기준으로 수행하고, RDS setup baseline은
`infra/aws/rds-setup-checklist.md` 기준으로 확인한다. Restore drill evidence 없이 production ready로 표시하지 않는다.

## Verification

```bash
pnpm --dir apps/api exec vitest run --config ./vitest.config.unit.ts --maxWorkers=50% \
  test/operations/platform/database-deploy.spec.ts \
  test/operations/database/role-grant-matrix.spec.ts \
  test/operations/database/column-classes.spec.ts \
  test/operations/database/migration-baseline.spec.ts
pnpm --dir apps/api exec vitest run --config ./vitest.config.integration.ts \
  test/integration/platform/database-role-grants.integration.spec.ts
sh -n infra/db/*.sh
node scripts/infra/check/validate-shell-db.mjs
git diff --check
```

`database-role-grants.integration.spec.ts`는 일회용 PostgreSQL에서 bootstrap → `dormduri_migrator`의
`migrate deploy` → grant → LOGIN user별 smoke를 production 순서로 한 번 돌리고, 표 밖 권한·표에 없는 table·
분류되지 않은 열이 실패하는지 본다. API integration 전체도 role마다 다른 LOGIN user로 접속하는 mode에서 돈다
(`apps/api/test/integration/_support/integration-db-roles.ts`).
