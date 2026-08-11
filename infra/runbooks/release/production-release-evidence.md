# Production release aggregate evidence

## 책임

이 문서는 모든 component evidence를 모으고 production release의 최종 결정을 기록하는 유일한
owner다. 준비 순서는 [production-release-readiness.md](./production-release-readiness.md)를 따른다.

실제 target이 없으면 `PENDING_TARGET`를 유지한다. `PENDING_TARGET`는 실패가 아니다.

## 상태 vocabulary

- Aggregate state: `PENDING_TARGET`, `COLLECTING`, `READY_FOR_DECISION`, `BLOCKED`
- Component result: `PENDING`, `PASS`, `FAIL`, `ACCEPTED_RISK`
- Final decision: `PENDING_TARGET`, `GO`, `NO_GO`, `GO_WITH_FOLLOW_UP`

`GO`, `NO_GO`, `GO_WITH_FOLLOW_UP`는 이 문서에서만 선언한다.

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

| Decision            | Criteria                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `GO`                | 모든 mandatory component가 `PASS`이고 blocker가 없으며 rollback evidence가 있다.              |
| `GO_WITH_FOLLOW_UP` | release safety를 깨지 않는 항목만 `ACCEPTED_RISK`이고 owner·기한·rollback 조건이 있다.        |
| `NO_GO`             | mandatory component가 `FAIL`이거나 secret 노출, target safety, rollback 조건이 닫히지 않았다. |
| `PENDING_TARGET`    | 실제 provider/account/domain/registry 같은 release 입력이 아직 없다. 실패로 집계하지 않는다.  |

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

## Secret-free 규칙

Evidence에는 identifier와 판정만 기록한다. DB connection string, password material, bearer token,
cookie, authorization header, verification code, HMAC material, raw provider payload는 기록하지 않는다.
민감한 원본이 필요한 경우 승인된 secret store 또는 provider console의 접근 제한 경로를 참조하되
그 값이나 화면 원문을 이 문서에 복사하지 않는다.
