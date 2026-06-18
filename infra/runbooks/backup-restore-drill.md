# Backup and restore drill runbook

이 runbook은 RDS automated backup/PITR 또는 manual snapshot이 실제로 복구 가능한지 검증하기 위한 production release gate다. 목표는 production DB를 직접 변경하지 않고 temporary restored DB에서 migration baseline, DB role grants, credential boundary, API readiness를 확인하는 것이다.

## Required inputs

- Release commit SHA.
- Source DB identifier.
- Restore source: automated backup/PITR timestamp 또는 manual snapshot identifier.
- Temporary restored DB identifier.
- Operator identity와 execution host.
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
- Restore cleanup 전에는 temporary DB identifier와 security group을 evidence에 남긴다.

## Procedure

1. Release commit SHA와 source DB identifier를 기록한다.
2. RDS automated backup retention, PITR 가능 window, 최근 manual snapshot 상태를 확인한다.
3. PITR timestamp 또는 snapshot identifier를 선택하고 evidence에 secret 없는 identifier만 기록한다.
4. 원본 production DB가 아닌 temporary restored DB를 생성한다.
5. Temporary restored DB의 public access가 off인지 확인한다.
6. Security group inbound가 API smoke host, migration/admin host, 필요한 operator 경로로만 제한되어 있는지 확인한다.
7. Restored DB connection string에 SSL/TLS 정책(`sslmode=require` 또는 CA bundle 검증)이 적용되어 있는지 확인한다.
8. Restored DB에 migration/admin credential로 접속해 Prisma migration baseline을 확인한다.
9. Role grant가 필요하면 restored DB에만 `pnpm api:db:deploy:role-grants`를 적용한다.
10. Restored DB credential boundary smoke를 실행한다.

    ```bash
    RESTORE_DRILL_MIGRATION_DATABASE_URL='postgresql://redacted' \
    RESTORE_DRILL_DATABASE_URL='postgresql://redacted' \
    RESTORE_DRILL_RETENTION_WORKER_DATABASE_URL='postgresql://redacted' \
    RESTORE_DRILL_RETENTION_DISCLOSURE_DATABASE_URL='postgresql://redacted' \
      pnpm api:db:restore-drill:smoke
    ```

11. Disposable API/nginx를 restored DB secret set으로 구동하거나, restored DB를 바라보는 staging-like API endpoint를 준비한다.
12. API readiness와 metrics guard를 확인한다.

    ```bash
    API_BASE_URL='https://api-restore-drill.example.com' \
    METRICS_BEARER_TOKEN='<redacted>' \
      infra/deploy/scripts/api-release-smoke.sh
    ```

13. Evidence artifact에 아래 정보만 기록한다.
14. Temporary restored DB와 drill 전용 secret/security group 변경을 cleanup한다.
15. Cleanup 완료 시각과 담당자를 evidence에 기록한다.

## Evidence template

```txt
release_sha=<commit-sha>
source_db_identifier=<db-id>
restore_source=<pitr-timestamp-or-snapshot-id>
restored_db_identifier=<temporary-db-id>
started_at=<iso8601>
completed_at=<iso8601>
rpo_target=<value>
rto_observed_minutes=<number>
migration_baseline=pass|fail
role_grant_smoke=pass|fail
api_ready_smoke=pass|fail
metrics_guard_smoke=pass|fail
cleanup=pass|fail
evidence_owner=<operator>
notes=<secret-free-summary>
```

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
- `/health/ready` 실패: restored DB secret set, migration state, required secret inventory, SES/config readiness를 확인한다.
- Cleanup 실패: temporary restored DB가 남아 있는 상태로 release ready를 표시하지 않는다.
