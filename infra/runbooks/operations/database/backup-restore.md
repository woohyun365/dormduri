# Backup and restore drill runbook

이 runbook은 RDS automated backup/PITR 또는 manual snapshot이 실제로 복구 가능한지 검증하기 위한 production release gate다. 목표는 production DB를 직접 변경하지 않고 temporary restored DB에서 migration baseline, DB role grants, credential boundary, API readiness를 확인하는 것이다.

실행 결과는 아래 형식으로 [실제 값의 기록 위치](../../release/production-release-evidence.md#실제-값의-기록-위치)에
남긴다. 식별자는 값을 적지 않고 Owner console 위치와 확인 여부만 적는다. 이 runbook은 전체 release의 최종
판정을 소유하지 않는다.

첫 production release 전에 한 번, 그 뒤 분기마다 한 번 실행한다. 목표는 RPO 10분·RTO 2시간이다
(`infra/aws/rds-setup-checklist.md` Initial RPO / RTO target). 같은 날 `infra/db/README.md` 유지보수 절의
분기 점검을 한다.

## Required inputs

- Release commit SHA.
- Source DB identifier: 운영자가 console에서 확인만 하고 evidence에는 쓰지 않는다.
- Restore source: automated backup/PITR timestamp(기본, 최근 migrate 시작 시각 또는 지정 시각) 또는 manual snapshot.
- Temporary restored DB: 이름은 운영자가 정하고 evidence에는 쓰지 않는다.
- Operator와 execution host 종류(이름·주소 없이).
- Evidence output 위치.
- Restored DB용 secret set:
  - `RESTORE_DRILL_MIGRATION_DATABASE_URL`
  - `RESTORE_DRILL_DATABASE_URL`
  - `RESTORE_DRILL_RETENTION_WORKER_DATABASE_URL`
  - `RESTORE_DRILL_RETENTION_DISCLOSURE_DATABASE_URL`
  - optional `DB_GRANT_SCHEMA`
- Disposable API/nginx smoke용 값:
  - `API_BASE_URL`
  - `METRICS_BEARER_TOKEN`

## Safety rules

- Production source DB에서 fixture seed, reset, destructive DDL/DML을 실행하지 않는다.
- Restore target은 production DB가 아니라 temporary DB여야 한다.
- DB URL, password, bearer token, HMAC secret은 issue/report/log/evidence에 붙이지 않는다.
- Restore drill evidence 없이 production ready로 표시하지 않는다.
- Instance·snapshot·security group 식별자, endpoint, account는 evidence에 쓰지 않는다. 공개 저장소와 이슈에는 식별자 없는 판정만 남긴다.

## Procedure

1. Release commit SHA를 기록한다.
2. RDS automated backup retention(14일), PITR 가능 window(latest restorable time), 최근 manual snapshot 상태를 확인한다.
3. 원본에서 기준 값을 읽어 기록한다: 기록 시각(UTC), `_prisma_migrations`의 마지막 migration 이름, 주요 table
   (`User`·`SeasonParticipant`·`ConversationMessage`·`RetentionCase`) 행 수. 자기 사람 조회 user
   (`dormduri_ro_<별칭>`, SSM 포트 포워딩)로 접속해 읽기 전용 transaction(`BEGIN READ ONLY`)에서 `count(*)`와 migration
   이름만 읽는다. 이 user의 문장은 모두 pgAudit에 남는다. `RetentionCase`는 `id` 열만 열려 있어 행 수만 셀 수 있다.
   migration·app credential과 master user를 사람 조회에 쓰지 않는다(migration user는 CD one-off 전용, master는
   break-glass 전용).
4. 3의 기록 시각으로 PITR 복원을 요청하고 요청 시각을 기록한다. 원본 production DB가 아닌 temporary restored DB를
   새 instance로 만든다. 복원 시각이 latest restorable time 안인지 기록한다.
5. Temporary restored DB가 available이 된 시각을 기록한다.
6. Temporary restored DB의 public access가 off인지 확인한다.
7. Security group inbound가 API smoke host, migration/admin host, 필요한 operator 경로로만 제한되어 있는지 확인한다.
8. Restored DB connection string이 서버 인증서와 host 이름을 검증하는지 확인한다(runtime `verify-full` + 단일 루트,
   migration은 Prisma 형식 `sslmode=require&sslcert=<루트>&sslaccept=strict`, psql은 `infra/db/psql-tls.sh`. 복원 DB는
   endpoint 이름이 다르므로 URL host를 그 endpoint로 바꾼다. `infra/db/README.md` RDS SSL / CA bundle).
9. Restored DB에 3과 같은 사람 조회 user로 접속해(복원 DB는 원본의 role을 그대로 가진다) 같은 읽기 전용 query로
   마지막 migration 이름과 주요 table 행 수가 3의 값과 같은지, `pgaudit` extension이 있는지(`pg_extension`) 본다.
10. Role grant가 필요하면 restored DB에만 `pnpm api:db:deploy:role-grants`를 적용한다.
11. Restored DB credential boundary smoke를 LOGIN user별로 실행한다. smoke는 먼저 PostgreSQL major, 마지막 적용 migration(저장소
    마지막 migration 디렉터리와 같음), `pgaudit` extension·preload를 본다.

    ```bash
    RESTORE_DRILL_MIGRATION_DATABASE_URL='postgresql://redacted' \
    RESTORE_DRILL_DATABASE_URL='postgresql://redacted' \
    RESTORE_DRILL_RETENTION_WORKER_DATABASE_URL='postgresql://redacted' \
    RESTORE_DRILL_RETENTION_DISCLOSURE_DATABASE_URL='postgresql://redacted' \
      pnpm api:db:restore-drill:smoke
    ```

12. Disposable API/nginx를 restored DB secret set으로 구동하거나, restored DB를 바라보는 staging-like API endpoint를 준비한다.
13. API readiness와 metrics guard를 확인하고 smoke가 끝난 시각을 기록한다. 4의 요청 시각부터 이 시각까지가 RTO다.

    ```bash
    API_BASE_URL='https://api-restore-drill.example.com' \
    METRICS_BEARER_TOKEN='<redacted>' \
      infra/deploy/scripts/api-release-smoke.sh
    ```

14. Evidence artifact에 아래 secret 없는 정보만 기록한다(식별자도 쓰지 않는다).
15. Temporary restored DB와 drill 전용 secret/security group 변경을 cleanup하고 삭제를 확인한다.
16. Cleanup 완료 시각과 담당자를 evidence에 기록한다.

## Evidence template

```txt
release_sha=<commit-sha>
restore_source=pitr|manual-snapshot
restore_point=<iso8601>
restore_point_within_latest_restorable_time=yes|no
rpo_target_minutes=10
rto_target_minutes=120
restore_requested_at=<iso8601>
restore_available_at=<iso8601>
smoke_completed_at=<iso8601>
rto_observed_minutes=<number>
migration_baseline=pass|fail
last_migration_matches_source=pass|fail
row_counts_match_source=pass|fail
pgaudit_extension=pass|fail
role_grant_smoke=pass|fail
api_ready_smoke=pass|fail
metrics_guard_smoke=pass|fail
cleanup=pass|fail
drill_result=pass|fail
evidence_owner=<operator-alias>
notes=<secret-free-summary>
```

`drill_result=pass`는 위 pass|fail 칸이 모두 `pass`이고 `restore_point_within_latest_restorable_time=yes`이며
`rto_observed_minutes`가 `rto_target_minutes` 이하일 때만 쓴다. RTO만 넘었으면 `drill_result=fail`로 두고 원인(데이터
크기·instance class·절차)을 `notes`에 적어 목표를 다시 본다. Instance·snapshot 식별자, endpoint, 행 수 원값은 적지
않는다(행 수는 일치 여부만).

## Dry-run

Repo-local static/dry-run 검증은 AWS 리소스를 만들지 않는다.

```bash
pnpm api:db:restore-drill:smoke -- --dry-run
infra/deploy/scripts/api-release-smoke.sh --dry-run
```

Dry-run은 command shape와 secret boundary만 확인한다. Release evidence로 인정되는 restore drill은 실제 restored DB에서 실행한 결과여야 한다.

## Failure handling

- Migration baseline 확인 실패: restore source timestamp/snapshot과 release commit의 migration compatibility를 확인하고 release를 중지한다.
- Role grant smoke 실패: restored DB grant drift를 확인하고 `infra/db/README.md`의 role grant apply 순서를 반복한다.
- 마지막 migration 이름이나 행 수 불일치: 복원 시각과 3의 기록 시각이 같은지 확인하고 다시 복원한다. 같아도 다르면 drill을 실패로 기록한다.
- `pgaudit` extension 없음: 원본 parameter group·extension 상태를 `infra/aws/rds-setup-checklist.md` 기준으로 확인한다.
- `/health/ready` 실패: restored DB 연결·migration baseline과 process bootstrap receipt를 확인한다. Secret origin/provider 상세는 public health가 아니라 component release evidence에서 확인한다.
- Cleanup 실패: temporary restored DB가 남아 있는 상태로 release ready를 표시하지 않는다.
