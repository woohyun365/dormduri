# RDS setup and backup checklist

이 체크리스트는 API production DB를 private managed PostgreSQL로 운영하기 위한 최소 설정과 backup/restore evidence 기준을 고정한다. 실제 AWS 리소스 생성은 운영자가 AWS Console, CLI, 또는 별도 IaC에서 수행하고, repo는 누락 방지 기준과 검증 순서를 제공한다. 확인한 값은 식별자(instance·snapshot·parameter group 이름, endpoint, account) 없이 기록한다.

## Required baseline

- [ ] Engine: Amazon RDS for PostgreSQL 18(Single-AZ) 또는 동등한 managed PostgreSQL을 사용한다.
- [ ] Network: DB subnet group의 private subnet에 두고, Lightsail user host는 Lightsail VPC peering으로 닿는다.
- [ ] Public access: public access를 비활성화한다.
- [ ] Security group: DB port(5432)를 user host 주소 하나(/32)에만 연다. migrate one-off와 사람 조회도 user host를 거친다
      (사람은 SSM 포트 포워딩).
- [ ] Credentials: role과 LOGIN user는 master user가 `pnpm api:db:bootstrap-roles`로 만들고, 서비스마다 자기 LOGIN user URL을 쓴다(`infra/db/README.md` Credential boundary). master user는 bootstrap·break-glass에만 쓴다.
- [ ] Runtime credential: `DATABASE_URL`은 app runtime LOGIN user로 제한한다.
- [ ] Migration credential: `MIGRATION_DATABASE_URL`은 one-off migration/admin 경로에서만 사용한다.
- [ ] Retention credentials: `RETENTION_WORKER_DATABASE_URL`, `RETENTION_DISCLOSURE_DATABASE_URL`은 RRPD worker/disclosure 경계로 분리한다.
- [ ] Automated backup: retention period를 14일로 설정한다.
- [ ] PITR: automated backup window 안에서 point-in-time restore가 가능한지 확인한다.
- [ ] Backup window: daily low write IOPS 시간대로 둔다.
- [ ] Maintenance window: release window·backup window와 겹치지 않게 둔다.
- [ ] Minor version upgrade: 자동 minor upgrade를 켠다(maintenance window 안에서 적용).
- [ ] Deletion protection: production DB에는 deletion protection을 활성화한다.
- [ ] Storage autoscaling: 초기 storage와 max storage threshold를 정한다. 늘어난 storage는 줄일 수 없다.
- [ ] SSL/TLS: parameter group의 `rds.force_ssl = 1`로 강제하고, 모든 client가 서버 인증서와 host 이름을 검증한다. runtime URL은
      `sslmode=verify-full&sslrootcert=/etc/dormduri/rds-ca/root.pem`, migration URL(Prisma CLI)은
      `sslmode=require&sslcert=/etc/dormduri/rds-ca/root.pem&sslaccept=strict`, psql은 `infra/db/psql-tls.sh`의 `verify-full`이다.
      CA 없는 `sslmode=require`는 쓰지 않는다(`infra/db/README.md` RDS SSL / CA bundle).
- [ ] Parameter group: 기본 group이 아닌 전용 parameter group에 아래 값을 둔다.
- [ ] Database Insights: Standard mode를 켠다.
- [ ] Monitoring: CloudWatch `DatabaseConnections`, `CPUUtilization`, `FreeableMemory`, `ReadIOPS`, `WriteIOPS`, `DiskQueueDepth`, `FreeStorageSpace`를 확인하고 경보를 둔다(아래).
- [ ] Log export: PostgreSQL log를 CloudWatch Logs로 내보내고 log group 보존을 731일(2년)로 둔다.
- [ ] Evidence: restore drill runbook 결과를 release evidence 위치에 secret 없이 저장한다.

## Parameter group

| Parameter                     | 값                                     | 이유                                                                                                                   |
| ----------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `shared_preload_libraries`    | `pg_stat_statements,pgaudit`           | postgres18 기본은 `pg_stat_statements,pg_tle`다. `pg_tle`는 쓰지 않는다. 바꾼 뒤 reboot하고 `CREATE EXTENSION pgaudit` |
| `pgaudit.log`                 | `ddl,role`                             | schema·권한 변경 기록. 사람 LOGIN user는 bootstrap이 `pgaudit.log = 'all'`로 둔다                                      |
| `pgaudit.log_parameter`       | `0`(off, 기본)                         | bind 값을 남기지 않는다                                                                                                |
| `pgaudit.log_relation`        | `0`(off)                               | 사람 session 문장 하나에 한 줄                                                                                         |
| `log_parameter_max_length`    | `0`                                    | 기본 `-1`은 bind 값을 그대로 남긴다                                                                                    |
| `log_min_duration_statement`  | `1000`(ms)                             | slow query. 값은 측정 뒤 조정                                                                                          |
| `log_lock_waits`              | `1`                                    | lock 대기 관측                                                                                                         |
| `log_autovacuum_min_duration` | `1000`(ms)                             | autovacuum 관측                                                                                                        |
| `log_connections`             | `receipt,authentication,authorization` | 누가 언제 접속했는지(master break-glass 포함). PostgreSQL 18은 문자열 option이다                                       |
| `log_disconnections`          | `1`                                    | 종료와 session 시간                                                                                                    |
| `rds.force_ssl`               | `1`                                    | TLS 강제                                                                                                               |
| `rds.log_retention_period`    | 기본 4320분                            | instance log는 3일, 보존은 CloudWatch log group이 맡는다                                                               |
| autovacuum                    | 켠 채 기본값                           | 조정 기준은 `infra/db/README.md` 유지보수 절                                                                           |

## Alarms

- CloudWatch: `FreeStorageSpace`(storage autoscaling 상한 근처), `CPUUtilization`, `CPUSurplusCreditsCharged`(T 계열의 CPU credit 초과 과금), `FreeableMemory`, `DatabaseConnections`(`max_connections` × 0.8. 계획 상한 × 0.6과의 관계는 `infra/db/README.md` Connection budget)에 경보를 둔다.
- API 정리 작업: `api_background_job_last_success_timestamp_seconds{job}`가 그 작업 주기의 3배를 넘게 멈추거나 `api_background_job_failures_total{job}`이 연속해 늘면 경보한다(`apps/api/src/background-jobs/README.md`). 경보 규칙은 observability 경보 owner가 둔다.

## Initial RPO / RTO target

| 항목 | 목표  | 뜻                                                                                                                                                                                               | evidence                                                        |
| ---- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| RPO  | 10분  | RDS가 transaction log를 5분마다 올리고 latest restorable time이 그보다 늦게 반영된다(target 실측 지연 3.6~7.6분). PITR로 잃는 데이터는 그 사이다. 복원 시각이 latest restorable time 안인지 본다 | 복원 시각, latest restorable time 안 여부(식별자 없음)          |
| RTO  | 2시간 | 복원 요청부터 복원 instance에 API를 연결해 smoke를 통과할 때까지                                                                                                                                 | 복원 요청·available·smoke 끝 시각, smoke status, cleanup status |

첫 production release 전 restore drill로 실측하고 그 뒤 분기마다 한 번 한다. 측정이 2시간을 넘으면 원인(데이터 크기·instance class·절차)을 기록하고 목표를 다시 본다. 이후 release checklist에 최신 evidence 링크를 남긴다.

## Restore drill acceptance

Restore drill은 단순 snapshot 존재 확인이 아니라 아래 smoke까지 완료해야 통과다. 세부 절차와 evidence 양식은 `infra/runbooks/operations/database/backup-restore.md`가 소유한다.

1. 원본 production DB가 아닌 temporary restored DB가 생성되어 있다.
2. restored DB endpoint/security group 접근이 제한되어 있다.
3. restored DB의 Prisma migration baseline을 읽을 수 있고 마지막 migration 이름이 원본과 같다.
4. 주요 table 행 수가 drill 시작 때 기록한 원본 값과 같다.
5. LOGIN user별 runtime/retention/disclosure credential smoke가 통과하고 `pgaudit` extension이 있다.
6. disposable API/nginx 또는 release smoke 경로에서 `/health/ready`가 통과한다.
7. 측정한 RTO가 2시간 이하다.
8. restored DB cleanup 상태가 evidence에 남아 있다.

## 되돌릴 수 없는 변경

- 늘린 allocated storage는 줄일 수 없다. 줄이려면 새 instance로 옮겨야 한다.
- major version upgrade는 되돌릴 수 없다. upgrade 전 snapshot을 남기고, 되돌릴 때는 그 snapshot으로 새 instance를 만든다.

## Follow-up hardening

아래 항목은 초기 production readiness의 필수 release blocker가 아니라 운영 evidence 기반 고도화 후보다. 재검토 조건이 생기기 전에는 만들지 않는다.

- Multi-AZ mandatory rollout: 사용자 release 뒤 가용성 목표가 생길 때.
- Read replica: 읽기 부하가 instance 한계에 닿을 때.
- Cross-region backup, AWS Backup vault policy: Region 장애 대비가 요구될 때.
- Terraform/CDK based automated restore drill: resource가 늘어 console 기록으로 재현이 어려울 때.
- RDS Proxy 재검토: connection 예산이 넘칠 때(같은 VPC 필요, vCPU 시간 과금).
