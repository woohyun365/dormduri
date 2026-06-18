# API production incident rollback runbook

이 runbook은 production release 또는 release 직후 장애에서 API app rollback, DB restore escalation, readiness/metrics/observability 재확인을 분리하기 위한 절차다. 자동 down migration을 기본 경로로 사용하지 않는다.

## Incident metadata

| Field                   | Value                                                         |
| ----------------------- | ------------------------------------------------------------- |
| Incident time           |                                                               |
| Release commit SHA      |                                                               |
| Current image tag       |                                                               |
| Previous safe image tag |                                                               |
| Operator                |                                                               |
| First failing gate      |                                                               |
| Customer impact         |                                                               |
| Decision                | app rollback / DB restore escalation / release halt / monitor |

Incident report에는 secret value, DB URL, Authorization header, bearer token, raw provider error, raw request/response body를 붙이지 않는다.

## Failure decision matrix

| Failure point                                              | Immediate action                                            | Rollback/escalation                                                                                 |
| ---------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| App rollout 전 CI/build/preflight 실패                     | release를 중지한다.                                         | app rollback 불필요. 변경된 production resource가 없는지 확인한다.                                  |
| Migration deploy 실패                                      | app rollout을 중지한다.                                     | migration 상태와 RDS backup/PITR evidence를 확인하고 DB restore escalation 여부를 결정한다.         |
| Role grant 실패                                            | app rollout을 중지한다.                                     | grant script 재실행 가능 여부를 확인하되 privilege drift가 있으면 DB owner escalation으로 전환한다. |
| App rollout 후 `/health/ready` 실패                        | LB/ingress traffic 전환을 중지하거나 이전 image로 되돌린다. | previous safe image tag로 app rollback 후 readiness를 재확인한다.                                   |
| `/internal/metrics` public exposure 또는 bearer smoke 실패 | ingress를 닫고 release를 중지한다.                          | nginx/config rollback 후 metrics guard smoke를 재실행한다.                                          |
| SES provider config invalid                                | 사용자 email operation을 멈추고 release를 중지한다.         | env/SES identity/DKIM/sandbox 상태를 수정한 뒤 bounded smoke만 재실행한다.                          |
| Slack/observability 경로 불능                              | release visibility가 부족하면 release를 중지한다.           | Alertmanager/Grafana/Loki/Prometheus smoke를 복구한 뒤 재판정한다.                                  |
| Backup restore failure                                     | production release를 중지한다.                              | RDS snapshot/PITR 절차를 수정하고 restored DB smoke를 다시 남긴다.                                  |
| Release 후 5xx/latency/error budget 급등                   | traffic을 이전 image로 되돌린다.                            | DB migration 영향이 의심되면 PITR restore escalation을 준비한다.                                    |

## App image rollback

App code 문제, readiness failure, ingress config 문제처럼 DB state를 되돌리지 않아도 되는 장애는 previous safe image tag로 rollback한다.

```bash
API_IMAGE_TAG='<previous-safe-tag>' infra/deploy/scripts/api-production-rollout.sh
```

SSM transport를 사용하면 target host에서 같은 rollout script가 이전 image tag를 pull/up 하도록 실행한다. Docker compose env file은 secret value를 출력하지 않는다.

Rollback 후 확인:

```bash
API_BASE_URL='https://api.example.com' \
METRICS_BEARER_TOKEN='<redacted>' \
  infra/deploy/scripts/api-release-smoke.sh
```

확인 항목:

- `/health` 2xx
- `/health/live` 2xx
- `/health/ready` 2xx 또는 실패 사유가 expected bounded code
- `/internal/metrics` anonymous rejection
- `/internal/metrics` bearer authorized scrape
- nginx access/error log에 secret/token 없음
- Slack alert가 firing/resolved 흐름을 기록

## DB migration and restore escalation

DB schema/data 문제가 의심되면 자동 down migration을 실행하지 않는다. Prisma migration rollback은 기본 release path가 아니며, 운영 판단은 backup/PITR restore escalation으로 한다.

Escalation steps:

1. 현재 release SHA, migration name, first failing check, RDS source identifier를 기록한다.
2. 새로운 write traffic을 중지하거나 maintenance mode에 준하는 ingress 차단을 적용한다.
3. RDS automated backup/PITR 또는 snapshot restore 후보 시점을 선택한다.
4. temporary restored DB에서 `pnpm api:db:restore-drill:smoke`를 실행한다.
5. restored DB가 release 전 safe state를 제공하는지 확인한다.
6. DNS/connection string 전환 또는 DB replacement는 운영자 승인 후 수행한다.
7. API previous safe image와 `/health/ready` smoke를 함께 검증한다.

금지:

- production source DB에서 fixture seed/reset 실행
- `prisma db push`를 rollback으로 사용
- 검증 없이 migration table 수동 수정
- DB URL/password/token을 incident report에 첨부

## Metrics and observability after rollback

Rollback 또는 restore escalation 뒤에는 관측 경로를 다시 확인한다.

| Check             | Command / evidence                                             |
| ----------------- | -------------------------------------------------------------- |
| API release smoke | `infra/deploy/scripts/api-release-smoke.sh`                    |
| Prometheus target | target up / scrape timestamp                                   |
| Loki logs         | release SHA와 requestId 검색 가능                              |
| Grafana dashboard | p95/p99, 5xx, event loop lag, process memory 정상화            |
| Slack alert       | firing/resolved 또는 manual smoke 확인                         |
| RDS metrics       | CPU, DatabaseConnections, FreeableMemory, IOPS, DiskQueueDepth |

## Communication and evidence

Incident evidence에는 아래만 남긴다.

- release SHA / previous safe SHA
- image tag / previous image tag
- workflow run id
- first failing gate
- bounded error code/category
- health/metrics smoke status
- RDS restore source/restored DB identifier
- rollback completion time
- cleanup status
- follow-up issue link

Raw request body, chat/support payload, email address, auth token, DB URL, provider raw error는 저장하지 않는다.
