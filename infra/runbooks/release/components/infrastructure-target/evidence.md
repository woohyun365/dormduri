# Infrastructure target release evidence

## 사용 방법

[Infrastructure target readiness](./readiness.md)를 수행한 뒤 실제 target의
secret-free 결과만 기록한다. 이 component 문서는 전체 release의 최종 결정을 선언하지 않는다.

```yaml
schema_version: 1
state: PENDING_TARGET
component_result: PENDING
release_commit_sha:
environment: production
operator:
collected_at:
risk_owner:
rollback_owner:
evidence_id:
```

`PENDING_TARGET`는 실제 target 입력이 없다는 뜻이며 실패가 아니다.

## Hosting topology and budget

| Field                                                  | Evidence value |
| ------------------------------------------------------ | -------------- |
| User App provider / region / instance / CPU / memory   |                |
| User App container placement and resource budget       |                |
| BackOffice provider / region / instance / CPU / memory |                |
| BackOffice container placement and resource budget     |                |
| Private network / firewall identifiers                 |                |
| Managed PostgreSQL 18 identifier and private path      |                |
| Estimated monthly cost, calculation date and owner     |                |
| Capacity rehearsal identifier                          |                |

## Registry, digest, and attestation

| Check                                             | Result    | Evidence identifier |
| ------------------------------------------------- | --------- | ------------------- |
| Registry and retention selected                   | `PENDING` |                     |
| Publish/pull principals use minimum privilege     | `PENDING` |                     |
| API/Web/nginx immutable digests match release SHA | `PENDING` |                     |
| SBOM generated and retained                       | `PENDING` |                     |
| Provenance/attestation verified before pull       | `PENDING` |                     |
| Image and artifact secret scan passed             | `PENDING` |                     |

## HTTPS ingress and browser boundary

| Check                                        | Result    | Evidence identifier |
| -------------------------------------------- | --------- | ------------------- |
| Canonical Web/API host and DNS owner         | `PENDING` |                     |
| TLS chain and renewal route                  | `PENDING` |                     |
| Trusted proxy hops and forwarded headers     | `PENDING` |                     |
| Secure cookie and canonical host behavior    | `PENDING` |                     |
| REST CORS and realtime origin allowlists     | `PENDING` |                     |
| WebSocket upgrade and health/readiness smoke | `PENDING` |                     |
| Observability ports remain private           | `PENDING` |                     |

## Observability storage and recovery

| Volume / data         | Retention | Backup or accepted loss | RPO/RTO | Evidence identifier |
| --------------------- | --------- | ----------------------- | ------- | ------------------- |
| Prometheus metrics    |           |                         |         |                     |
| Loki logs             |           |                         |         |                     |
| Alloy positions       |           |                         |         |                     |
| Grafana state         |           |                         |         |                     |
| Alertmanager silences |           |                         |         |                     |

## Target rollback evidence

| Field                         | Evidence value |
| ----------------------------- | -------------- |
| Previous safe image digests   |                |
| Rollback rehearsal identifier |                |
| Traffic recovery result       |                |
| DB restore escalation owner   |                |
| Immediate rollback conditions |                |

## Redaction confirmation

- [ ] Evidence contains identifiers and bounded results only.
- [ ] DB connection strings, credentials, token, cookie, authorization header, HMAC material are absent.
- [ ] `operator`, `collected_at`, `risk_owner`, `rollback_owner` are filled.
- [ ] Component result and evidence identifier are linked from the aggregate evidence.
