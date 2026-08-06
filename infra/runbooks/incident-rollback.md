# API incident rollback decision guide

이 문서는 API release 직후 장애에서 **app artifact rollback**과 **DB restore escalation**을 구분하는 provider-neutral 의사결정 기준이다. Production hosting과 rollout transport가 아직 결정되지 않았으므로 원격 실행 명령은 제공하지 않는다.

## Incident metadata

| Field                  | Value                                                         |
| ---------------------- | ------------------------------------------------------------- |
| Incident time          |                                                               |
| Release commit SHA     |                                                               |
| Current artifact id    |                                                               |
| Previous safe artifact |                                                               |
| Operator               |                                                               |
| First failing gate     |                                                               |
| Customer impact        |                                                               |
| Decision               | app rollback / DB restore escalation / release halt / monitor |

Evidence에는 secret value, DB URL, Authorization header, bearer token, raw provider error, raw request/response body를 남기지 않는다.

## Failure decision matrix

| Failure point                                  | Immediate action                                | Escalation                                                 |
| ---------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------- |
| rollout 전 CI/build/rehearsal 실패             | release를 중지한다.                             | 변경된 runtime resource가 없는지 확인한다.                 |
| migration 또는 role grant 실패                 | app rollout을 중지한다.                         | backup/PITR evidence와 DB owner 판단으로 전환한다.         |
| rollout 후 `/health/ready` 실패                | traffic 전환을 중지한다.                        | previous safe artifact로 복구한 뒤 readiness를 재확인한다. |
| metrics public exposure 또는 bearer smoke 실패 | ingress를 닫고 release를 중지한다.              | config rollback 후 metrics guard smoke를 재실행한다.       |
| email provider config invalid                  | email operation과 release를 중지한다.           | config를 수정하고 bounded smoke를 재실행한다.              |
| observability 경로 불능                        | release visibility가 부족하면 release를 멈춘다. | 관측 경로 복구 후 다시 판정한다.                           |
| release 후 5xx/latency/error budget 급등       | 신규 traffic을 이전 artifact에서 분리한다.      | DB 영향이 의심되면 restore escalation을 준비한다.          |

## App artifact rollback

App code, readiness, ingress configuration처럼 DB state를 되돌리지 않아도 되는 장애는 previous safe artifact로 복구한다. 실제 image pull, process replacement, traffic switch 명령은 선택한 hosting target의 CD 계획이 소유해야 한다.

복구 뒤 아래 smoke를 수행한다.

```bash
API_BASE_URL='https://<canonical-api-host>' \
METRICS_BEARER_TOKEN='<redacted>' \
  infra/deploy/scripts/api-release-smoke.sh
```

확인 항목:

- `/health`, `/health/live` 2xx
- `/health/ready` 2xx 또는 expected bounded failure code
- `/internal/metrics` anonymous rejection
- `/internal/metrics` bearer-authorized scrape
- ingress/API log의 secret/token 미노출
- Prometheus target과 alert delivery 회복

## DB restore escalation

DB schema/data 영향이 의심되면 자동 down migration을 기본 경로로 사용하지 않는다.

1. Release SHA, migration name, first failing check, source DB identifier를 기록한다.
2. 신규 write traffic을 중지하거나 이에 준하는 보호 조치를 적용한다.
3. Backup/PITR 또는 snapshot restore 후보 시점을 선택한다.
4. Temporary restored DB에서 `pnpm api:db:restore-drill:smoke`를 실행한다.
5. Restored DB가 release 전 safe state를 제공하는지 확인한다.
6. DB 연결 전환 또는 replacement는 운영자 승인 뒤 수행한다.
7. Previous safe app artifact와 `/health/ready`를 함께 검증한다.

금지:

- production source DB에서 fixture seed/reset 실행
- `prisma db push`를 rollback으로 사용
- 검증 없이 migration table 수동 수정
- DB URL/password/token을 incident evidence에 첨부

## Observability 확인

| Check             | Evidence                                    |
| ----------------- | ------------------------------------------- |
| API release smoke | `infra/deploy/scripts/api-release-smoke.sh` |
| Prometheus target | target up / scrape timestamp                |
| Loki logs         | release SHA와 requestId 검색 가능           |
| Grafana dashboard | p95/p99, 5xx, event loop lag, memory 정상화 |
| Alert delivery    | firing/resolved 또는 manual smoke           |
| DB metrics        | CPU, connections, memory, IOPS, queue       |

현재 문서는 실제 rollback transport를 구현하지 않는다. Hosting target, artifact registry, approval, traffic switching, rollback SLO가 확정되면 `docs/development/future-production-deployment-inputs.md`를 입력으로 별도 CD 계획을 작성한다.
