# Production release aggregate evidence

## 책임

이 문서는 모든 component evidence를 모으고 production release의 최종 결정을 기록하는 유일한
owner다. 준비 순서는 [production-release-readiness.md](./production-release-readiness.md)를 따른다.

실제 target 입력이 없거나 단계 배포가 진행 중이면 `PENDING_TARGET`를 유지한다. `PENDING_TARGET`는 실패가 아니다.

## 실제 값의 기록 위치

이 문서와 component evidence 문서의 YAML·표는 template이며 실제 값을 채우지 않는다. 실제 값은 이 형식으로 아래 위치에
남긴다.

- 단계 배포: [단계 배포 기록](#단계-배포-기록)의 위치
- 최종 release 판정: 최종 release를 준비하는 작업이 이 문서의 형식과 아래 식별자 규칙으로 위치를 정한다.

공개 저장소이므로 모든 기록은 [식별자 규칙](../../../docs/deploy/README.md#식별자-규칙)을 따른다. 기록하지 않는 값이
필요한 자리에는 "Owner console"이라고 적는다.

## 상태 vocabulary

- Aggregate state: `PENDING_TARGET`, `COLLECTING`, `READY_FOR_DECISION`, `BLOCKED`
- Component result: `PENDING`, `PASS`, `FAIL`, `ACCEPTED_RISK`
- Final decision: `PENDING_TARGET`, `GO`, `NO_GO`, `GO_WITH_FOLLOW_UP`

`COLLECTING`은 단계 배포 기록이 하나 이상 있고 최종 판정 전인 aggregate state다. 단계 배포 사이에는 aggregate state
`COLLECTING`과 final decision `PENDING_TARGET`를 유지한다.

`GO`, `NO_GO`, `GO_WITH_FOLLOW_UP`는 최종 release 판정에서 이 문서의 형식과 [Final decision rule](#final-decision-rule)로만
선언한다. 단계 배포 기록과 component evidence는 이 값을 선언하지 않는다.

## Release metadata

```yaml
schema_version: 1
aggregate_state: PENDING_TARGET
final_decision: PENDING_TARGET
release_id:
release_commit_sha:
environment: production
operator:
collected_at:
risk_owner:
rollback_owner:
previous_safe_image_digest:
redaction_confirmed: false
```

## Component evidence index

| Component               | Evidence owner                                                                       | Result    | Evidence identifier | Operator | Collected at | Risk / follow-up owner |
| ----------------------- | ------------------------------------------------------------------------------------ | --------- | ------------------- | -------- | ------------ | ---------------------- |
| Infrastructure target   | [Target evidence](./components/infrastructure-target/evidence.md)                    | `PENDING` |                     |          |              |                        |
| API Secrets Manager     | [Secrets evidence](./components/api-secrets-manager/evidence.md)                     | `PENDING` |                     |          |              |                        |
| Lightsail runtime       | [Runtime evidence](./components/lightsail-runtime/evidence.md)                       | `PENDING` |                     |          |              |                        |
| Observability collector | [Collector evidence](./components/observability-collector/evidence.md)               | `PENDING` |                     |          |              |                        |
| Web Sentry              | [Sentry evidence](./components/web-sentry/evidence.md)                               | `PENDING` |                     |          |              |                        |
| DB backup/restore       | [Restore drill](../operations/database/backup-restore.md)                            | `PENDING` |                     |          |              |                        |
| Observability stack     | [Operations runbook](../operations/observability/production-stack.md)                | `PENDING` |                     |          |              |                        |
| Password Reset          | [Reset evidence](./components/auth/password-reset-evidence.md)                       | `PENDING` |                     |          |              |                        |
| Credential lifecycle    | [Registration evidence](./components/auth/registration-credential-evidence.md)       | `PENDING` |                     |          |              |                        |
| Stress/capacity         | [Stress runbook](../../../docs/runbooks/observability/api-stress-release-runbook.md) | `PENDING` |                     |          |              |                        |
| Slack alert delivery    | [Slack delivery setup](../operations/observability/slack-delivery.md)                | `PENDING` |                     |          |              |                        |
| Slack alert incident    | [Slack alert troubleshooting](../incidents/observability-alert-delivery.md)          | `PENDING` |                     |          |              |                        |
| Rollback rehearsal      | [Rollback guide](../incidents/release-rollback.md)                                   | `PENDING` |                     |          |              |                        |

## Blocker and accepted-risk records

| Type                                | Component | Description | Owner | Due / review time | Evidence or issue |
| ----------------------------------- | --------- | ----------- | ----- | ----------------- | ----------------- |
| Blocker / accepted risk / follow-up |           |             |       |                   |                   |

`ACCEPTED_RISK`에는 영향 범위, 만료 또는 재검토 시각, 즉시 rollback 조건을 함께 기록한다.

## Final decision rule

| Decision            | Criteria                                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| `GO`                | 모든 mandatory component가 `PASS`이고 blocker가 없으며 rollback evidence가 있다.                               |
| `GO_WITH_FOLLOW_UP` | release safety를 깨지 않는 항목만 `ACCEPTED_RISK`이고 owner·기한·rollback 조건이 있다.                         |
| `NO_GO`             | mandatory component가 `FAIL`이거나 secret 노출, target safety, rollback 조건이 닫히지 않았다.                  |
| `PENDING_TARGET`    | 최종 판정 입력이 아직 다 모이지 않았다(실제 target 입력이 없거나 단계 배포가 진행 중). 실패로 집계하지 않는다. |

## Sign-off

```yaml
decision_recorded_at:
decision_operator:
final_decision: PENDING_TARGET
blocker_count:
accepted_risk_count:
rollback_owner:
rollback_evidence_id:
redaction_confirmed: false
```

## 단계 배포 기록

[단계 배포](./production-release-readiness.md#단계-배포)는 배포마다 아래 형식으로 그 단계의 결과를 남긴다. 단계 기록은
최종 판정을 선언하지 않는다.

- 위치: 그 배포의 배포 tag에 붙은 GitHub Release 본문과 그 배포 workflow run의 요약에 같은 내용을 남긴다. 배포 tag와
  Release는 배포가 성공한 실행에만 만든다. 중단 조건에 걸려 멈추거나 되돌린 실행은 단계 기록으로 세지 않고 멈춘 조건과
  되돌림 결과를 그 run 요약에 남긴다.
- 식별자: [식별자 규칙](../../../docs/deploy/README.md#식별자-규칙)을 따른다. 그 규칙이 기록하지 않는 값이 필요한
  자리에는 "Owner console"이라고 적는다.

```yaml
stage:
action:
release_id:
release_commit_sha:
images:
attestation:
components:
smoke:
rollback_check:
previous_safe:
aggregate_state: COLLECTING
final_decision: PENDING_TARGET
operator:
collected_at:
risk_owner:
rollback_owner:
redaction_confirmed: false
```

| 필드                           | 적는 값                                                                                                                                                     |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stage`                        | 단계 이름(예: `web`)                                                                                                                                        |
| `action`                       | 그 실행의 동작(`deploy`·`rollback`·`maintenance`). `rollback`의 `images`는 되돌린 쌍이고, `maintenance`는 지금 쌍과 직전 안전 쌍을 바꾸지 않는다            |
| `release_id`                   | 배포 tag 이름                                                                                                                                               |
| `release_commit_sha`           | 배포한 source commit SHA                                                                                                                                    |
| `images`                       | image마다 registry host 없는 `<repository 이름>@sha256:<digest>`                                                                                            |
| `attestation`                  | image마다 provenance 검증 결과와 그 검증을 한 workflow run URL                                                                                              |
| `components`                   | 그 단계가 올리거나 바꾼 component마다 결과(`PASS`·`FAIL`·`ACCEPTED_RISK`)와 evidence identifier. 그 단계에 들지 않는 component와 항목은 `해당 없음(<이유>)` |
| `smoke`                        | target smoke에서 확인한 경로와 결과                                                                                                                         |
| `rollback_check`               | 그 단계 rollback 확인 결과와 그 실행의 workflow run URL                                                                                                     |
| `previous_safe`                | 이 실행 뒤 rollback 대상이 되는 직전 안전 image(`images`와 같은 형식). 첫 배포면 `없음(첫 배포)`, rollback 뒤에는 `없음(rollback 뒤 host가 직전 쌍을 비움)` |
| `aggregate_state`              | `COLLECTING`                                                                                                                                                |
| `final_decision`               | `PENDING_TARGET`                                                                                                                                            |
| `operator`                     | 배포를 승인·실행한 사람의 역할 또는 GitHub 계정 이름                                                                                                        |
| `collected_at`                 | 기록 시각(UTC)                                                                                                                                              |
| `risk_owner`, `rollback_owner` | 그 단계의 risk owner와 rollback owner                                                                                                                       |
| `redaction_confirmed`          | 식별자 규칙과 아래 secret-free 규칙을 확인했으면 `true`                                                                                                     |

`해당 없음(<이유>)`은 component result가 아니다. 최종 판정에는 그 component의 실제 결과가 필요하다.

## Secret-free 규칙

Evidence에는 identifier와 판정만 기록한다. DB connection string, password material, bearer token,
cookie, authorization header, verification code, HMAC material, raw provider payload는 기록하지 않는다.
민감한 원본이 필요한 경우 승인된 secret store 또는 provider console의 접근 제한 경로를 참조하되
그 값이나 화면 원문을 이 문서에 복사하지 않는다.
