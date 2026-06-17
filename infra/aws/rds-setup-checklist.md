# RDS setup and backup checklist

이 체크리스트는 API production DB를 private managed PostgreSQL로 운영하기 위한 최소 설정과 backup/restore evidence 기준을 고정한다. 실제 AWS 리소스 생성은 운영자가 AWS Console, CLI, 또는 별도 IaC에서 수행하고, repo는 누락 방지 기준과 검증 순서를 제공한다.

## Required baseline

- [ ] Engine: Amazon RDS for PostgreSQL 또는 동등한 managed PostgreSQL을 사용한다.
- [ ] Network: API host와 같은 VPC의 private subnet에 둔다.
- [ ] Public access: public access를 비활성화한다.
- [ ] Security group: API host, migration/admin execution host, 제한된 operator IP 또는 bastion만 DB port에 접근할 수 있다.
- [ ] Runtime credential: `DATABASE_URL`은 app runtime role로 제한한다.
- [ ] Migration credential: `MIGRATION_DATABASE_URL`은 one-off migration/admin 경로에서만 사용한다.
- [ ] Retention credentials: `RETENTION_WORKER_DATABASE_URL`, `RETENTION_DISCLOSURE_DATABASE_URL`은 RRPD worker/disclosure 경계로 분리한다.
- [ ] Automated backup: retention period를 7일 이상으로 설정한다.
- [ ] PITR: automated backup window 안에서 point-in-time restore가 가능한지 확인한다.
- [ ] Backup window: daily low write IOPS 시간대로 둔다.
- [ ] Maintenance window: release window와 겹치지 않게 둔다.
- [ ] Deletion protection: production DB에는 deletion protection을 활성화한다.
- [ ] Storage autoscaling: 초기 storage threshold와 max storage를 정한다.
- [ ] SSL/TLS: runtime/migration connection string은 `sslmode=require` 또는 CA bundle 검증 경로를 사용한다.
- [ ] Monitoring: CloudWatch `DatabaseConnections`, `CPUUtilization`, `FreeableMemory`, `ReadIOPS`, `WriteIOPS`, `DiskQueueDepth`, `FreeStorageSpace`를 확인한다.
- [ ] Evidence: restore drill runbook 결과를 release evidence 위치에 secret 없이 저장한다.

## Initial RPO / RTO target

| 항목 | 초기 기준                                                                               | evidence                                                            |
| ---- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| RPO  | automated backup/PITR retention window 안의 지정 시점으로 복구 가능                     | source DB identifier, backup/PITR restore source, restore timestamp |
| RTO  | small production DB 기준 temporary restore 생성부터 DB/API smoke 완료까지 운영자가 측정 | start/end timestamp, smoke status, cleanup status                   |

RPO/RTO는 실제 데이터 크기, region, storage, instance class, migration volume에 따라 달라진다. 첫 production release 전 최소 1회 restore drill로 실측하고 이후 release checklist에 최신 evidence 링크를 남긴다.

## Restore drill acceptance

Restore drill은 단순 snapshot 존재 확인이 아니라 아래 smoke까지 완료해야 통과다.

1. 원본 production DB가 아닌 temporary restored DB가 생성되어 있다.
2. restored DB endpoint/security group 접근이 제한되어 있다.
3. restored DB의 Prisma migration baseline을 읽을 수 있다.
4. runtime/retention/disclosure credential smoke가 통과한다.
5. disposable API/nginx 또는 release smoke 경로에서 `/health/ready`가 통과한다.
6. restored DB cleanup 상태가 evidence에 남아 있다.

## Follow-up hardening

아래 항목은 초기 production readiness의 필수 release blocker가 아니라 운영 evidence 기반 고도화 후보다.

- Multi-AZ mandatory rollout.
- Read replica.
- Cross-region backup.
- AWS Backup vault policy.
- Terraform/CDK based automated restore drill.
- RDS Proxy 재검토.
