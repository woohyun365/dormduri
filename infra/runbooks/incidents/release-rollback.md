# API incident rollback decision guide

이 문서는 API release 직후 장애에서 **app artifact rollback**과 **DB restore escalation**을 구분하는 의사결정 기준이다. User host의 API 묶음 rollout과 되돌림은 SSM document `dormduri-api-deploy`(본문 `infra/deploy/user/api/ssm/deploy-api.sh`, `deploy`·`rollback`·`maintenance`)가 한다. 그 document를 부르는 workflow(`api-cd.yml`)와 승인·dispatch 절차는 [API 단계 배포](../release/api-stage-deploy.md)가 소유한다.

Web image(`dormduri/web`·`dormduri/ingress`)의 되돌림은 [Web 단계 배포](../release/web-stage-deploy.md)가 소유한다. 직전 digest 쌍으로 되돌리거나(자동·dispatch) 점검 mode로 둔다. Web·API·DB 사이의 경계는 아래 [User host의 Web·API·DB 경계](#user-host의-webapidb-경계)다.

실제 previous digest와 rehearsal 결과는 component evidence 형식으로
[실제 값의 기록 위치](../release/production-release-evidence.md#실제-값의-기록-위치)에 남긴다.

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

## User host의 Web·API·DB 경계

- 두 묶음은 따로 배포하고 따로 되돌린다. Web document는 API container를, API document는 Web·ingress container를 멈추거나 바꾸지
  않는다. 두 document는 같은 host lock을 쓰므로 겹쳐 돌지 않는다(다른 실행 중이면 exit 75로 아무것도 바꾸지 않는다).
- API `rollback`은 host가 기록한 직전 성공 묶음(`api`·`api-migrate`·`observability-config` digest 셋)으로만 되돌리고 관측
  stack도 그 묶음의 설정으로 다시 만든다(실패해도 API 결과는 그대로). migrate 단계는 다시 돌지 않고 migration도 되돌리지 않는다. secret은 Secrets Manager의 지금 값(`AWSCURRENT`)을 다시 꺼내 새 release로 설치한다.
- API `maintenance`는 API container를 내린다. ingress private listener는 JSON 503을 내고 Landing(`/`·`/privacy`·`/terms`)은
  Web이 계속 낸다.
- Web 기록이 옛 형식인 동안(새 형식 이전 release로 Web을 되돌린 동안)과 Web 점검 mode 동안에는 API `deploy`·`rollback`이
  secret을 꺼내기 전에 멈춘다(`web-record-legacy`·`web-maintenance`, exit 2). API `maintenance`는 된다. Web을 새 document로
  다시 배포하거나 점검 mode를 끝낸 뒤 API를 배포한다.
- migrate·grant·role smoke·auth mail outbox 확인 가운데 하나라도 실패하면 rollout하지 않고 이전 API container가 계속 돈다
  (exit 1). 새 API container가 readiness나 host 안 smoke를 통과하지 못하면 지금 release를 다시 띄우고(`rolled-back-to-current`),
  지금 release가 없거나 다시 띄우지 못하면 API를 내린 채 끝낸다(`entered-maintenance`). API `rollback`의 대상이 실패하면 지금
  release를 다시 띄우고(`rollback-failed-kept-current`), 그것도 실패하면 API를 내린다(`entered-maintenance`). 결과 줄 전체는
  [API 단계 배포](../release/api-stage-deploy.md#host가-하는-일)의 표다.
- migrate 시작 시각(UTC)은 root 전용 host log(`/opt/dormduri/state/deploy-api.log`)에 남는다. 데이터가 망가졌을 때만 그 시각으로
  [DB restore escalation](#db-restore-escalation)을 한다.

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

App code, readiness, ingress configuration처럼 DB state를 되돌리지 않아도 되는 장애는 previous safe artifact로 복구한다. User host에서는 API document의 `rollback`이다(위 경계).

User host의 API는 공개 host가 없고 ingress private listener 뒤에만 있으므로, document의 host 안 smoke가 private listener를 거친 공개 열람 응답과 `/internal/metrics` 닫힘을 본다. API를 외부 host로 여는 단계부터 아래 smoke를 수행한다.

```bash
API_BASE_URL='https://<canonical-api-host>' \
METRICS_BEARER_TOKEN='<redacted>' \
  infra/deploy/scripts/api-release-smoke.sh
```

확인 항목:

- `/health`, `/health/live` 2xx
- `/health/ready` 2xx와 빈 `failureCodes` (failure code가 남으면 traffic 전환 금지)
- public health body가 liveness의 `status`/`timestamp`/`uptimeSeconds`, readiness의
  `status`/`failureCodes` 외 내부 설정·provider 상세를 노출하지 않음
- `/internal/metrics` anonymous rejection
- `/internal/metrics` bearer-authorized scrape
- ingress/API log의 secret/token 미노출
- Prometheus target과 alert delivery 회복

## DB restore escalation

DB schema/data 영향이 의심되면 자동 down migration을 기본 경로로 사용하지 않는다.

1. Release SHA, migration name, first failing check, source DB identifier를 기록한다.
2. 신규 write traffic을 중지하거나 이에 준하는 보호 조치를 적용한다.
3. Backup/PITR 또는 snapshot restore 후보 시점을 선택한다.
4. Temporary restored DB에 user host에서 배포한 migrate image의 `restore-drill`을 실행한다(credential은 host role이 꺼냄,
   복원 endpoint와 원본 endpoint를 넘겨 URL 넷이 복원 DB를 가리키는지 먼저 확인,
   [Backup and restore drill runbook](../operations/database/backup-restore.md) 10·11단계).
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

API를 외부 host로 여는 단계의 traffic switching과 rollback SLO는 그 단계가 `docs/deploy/production-environment.md`를 입력으로 계획한다. 단계 배포는 그 단계가 올리거나 바꾸는 구성요소의 입력이 확정되면 그 단계 범위로 계획한다(`PRS-R48`).
