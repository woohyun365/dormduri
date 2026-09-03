# Observability collector release evidence

## Component record

이 문서는 collector의 실제 target 선택과 smoke 결과만 기록한다. 전체 release의 최종 판정은
[production-release-evidence.md](../../production-release-evidence.md)가 소유한다.

```yaml
schema_version: 1
state: PENDING_TARGET
component_result: PENDING
collector_mode: PENDING_TARGET
release_commit_sha:
collector_image_digest:
environment: production
operator:
collected_at:
risk_owner:
rollback_owner:
evidence_id:
```

허용 `collector_mode`는 `PENDING_TARGET`, `KEEP_SOCKET`, `MIGRATE_HOST_TAIL`,
`MIGRATE_LOGGING_DRIVER`, `MIGRATE_MANAGED`다. `PENDING_TARGET`는 실패가 아니다.

## Trust boundary evidence

| Check                                      | Result    | Evidence identifier |
| ------------------------------------------ | --------- | ------------------- |
| Dedicated single-tenant host 여부          | `PENDING` |                     |
| Operator와 Docker control-plane 접근자     | `PENDING` |                     |
| Immutable Alloy image digest와 attestation | `PENDING` |                     |
| Socket mount 존재 여부와 실제 mode         | `PENDING` |                     |
| Discovery allowlist `api`, `nginx`, `web`  | `PENDING` |                     |
| Private ports and operator access          | `PENDING` |                     |
| Resource limit and container log rotation  | `PENDING` |                     |
| Secret/raw body negative search            | `PENDING` |                     |

## Failure isolation and recovery

| Scenario                     | Product fail-open | Recovery result | Evidence identifier |
| ---------------------------- | ----------------- | --------------- | ------------------- |
| Alloy unavailable            | `PENDING`         |                 |                     |
| Loki unavailable             | `PENDING`         |                 |                     |
| Docker socket denied         | `PENDING`         |                 |                     |
| Disk/retention saturation    | `PENDING`         |                 |                     |
| Collector removed from stack | `PENDING`         |                 |                     |

## Keep or migrate decision

| Field                            | Evidence value |
| -------------------------------- | -------------- |
| Selected mode and reason         |                |
| Socket removal triggers accepted |                |
| Compensating controls            |                |
| Migration owner and review date  |                |
| Immediate isolation action       |                |
| Rollback mode and evidence       |                |
| Accepted residual risk           |                |

## Redaction confirmation

- [ ] No token, credential, cookie, authorization header, raw request body, raw provider payload.
- [ ] `operator`, `collected_at`, `risk_owner`, `rollback_owner` are filled.
- [ ] Collector image is recorded by digest, not mutable tag alone.
- [ ] Result is linked from aggregate evidence.
