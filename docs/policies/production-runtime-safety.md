# Production runtime safety 정책

## 문서 범위

이 문서는 KNU Roommate production runtime이 provider나 instance 종류와 무관하게 지켜야 하는
배포 안전 불변 조건을 소유한다. 실제 hosting target, instance, 월 비용과 container resource 값은
[`infrastructure-target-release-readiness.md`](../../infra/runbooks/release/components/infrastructure-target/readiness.md),
실제 검증 결과는
[`infrastructure-target-release-evidence.md`](../../infra/runbooks/release/components/infrastructure-target/evidence.md)가
소유한다.

관련 기준:

- [운영 관측 정책](./operational-observability.md)
- [Production runtime topology](../architecture/platform/production-runtime-topology.md)
- [계정·인증 정책](./account-authentication.md)
- [데이터 보유기간 정책](./data-retention.md)
- [법적 근거](./legal-basis.md)
- `infra/deploy/README.md`
- `infra/db/README.md`
- `infra/runbooks/release/production-release-readiness.md`
- `infra/runbooks/release/production-release-evidence.md`
- `infra/runbooks/incidents/release-rollback.md`

## Production release 불변 조건

1. Web/API/nginx는 immutable image와 재현 가능한 runtime config로 실행한다.
2. Production DB는 public local Compose DB가 아니라 private managed PostgreSQL endpoint를 사용한다.
3. Production secret은 code, Git, log, report, issue와 release evidence에 원문으로 남기지 않는다.
4. 인증 메일은 local stub이나 log output이 아니라 승인된 production provider를 사용한다.
5. Liveness, readiness와 metrics는 배포·복구·관측 목적에 맞게 분리한다.
6. Migration, role grant, credential smoke, rollback과 backup/restore drill을 release gate에 포함한다.
7. 관측 또는 부하 검증 실패와 후속 최적화 후보를 구분하고, release blocker는 evidence 없이 해제하지 않는다.
8. 사용자 제품과 BackOffice는 배포, 권한, ingress, health와 rollback 경계를 독립적으로 소유한다.

## Config·secret·KMS 경계

- Production env key는 owner, category, required 여부와 secret 여부를 registry에서 추적한다.
- Production required key가 누락되거나 placeholder/default secret이 남아 있으면 fail-fast한다.
- AWS production secret origin은 Secrets Manager로 고정하고 runtime에는 필요한 값만 materialize한다.
- Lightsail production application read source는 release plane이 설치한 read-only `mounted-files`다.
- Release principal은 GitHub protected environment의 OIDC 임시 role이며, Lightsail host와 application
  container에는 장기 AWS access key를 저장하지 않는다.
- `secret origin`(Secrets Manager), `application read source`(mounted files), `release principal`(OIDC
  role)을 서로 다른 책임으로 유지한다.
- Secret reader, parser와 domain consumer의 책임을 분리한다.
- DB URL, token, HMAC material, verification code, raw provider error를 log나 evidence에 기록하지 않는다.
- Secret rotation owner와 rollback 절차가 없으면 production release를 진행하지 않는다.

## Production email 경계

- 인증·비밀번호 재설정 메일은 승인된 production mail adapter를 사용한다.
- Sender identity, DKIM과 production access를 실제 provider에서 검증한다.
- Verification/reset code, proof와 auth token은 sender log나 security event metadata에 원문으로 남기지 않는다.
- Provider 결과는 bounded category로 기록하고 raw provider message를 저장하지 않는다.
- Provider가 메시지를 접수한 상태와 최종 delivery, bounce, complaint를 구분한다.
- Provider 설정 오류는 listener 전 bootstrap failure이며 일시적 delivery 오류와 분리한다.

## Database·migration·backup 경계

- Production DB endpoint는 private network 경계를 사용하고 public internet에 직접 노출하지 않는다.
- Migration은 app rollout 전에 단일 owner가 `prisma migrate deploy`로 한 번만 수행한다.
- Production 배포 경로에서 `prisma db push`를 사용하지 않는다.
- API container startup은 migration이나 role grant를 자동 실행하지 않는다.
- Runtime, migration, retention/disclosure와 미래 BackOffice credential은 최소 권한으로 분리한다.
- Role grant script는 password, LOGIN role 또는 membership 생성이 아니라 **schema/table privilege baseline 적용을 소유한다**.
- Migration, role grant 또는 credential smoke 실패는 rollout blocker다.
- Backup/restore drill은 release 전에 실행하고 restored DB의 migration baseline, grant와 readiness를 검증한다.
- `.github/workflows/api-restore-drill-manual.yml`은 수동 dry-run-first 경계이며 RDS restore 자체를 자동 소유하지 않는다.

## Ingress·TLS·browser transport 경계

- Public ingress는 승인된 reverse proxy가 소유하고 API container는 내부 upstream으로 둔다.
- TLS 발급·갱신 owner와 만료 경보가 없으면 release를 진행하지 않는다.
- REST CORS와 realtime origin은 wildcard가 아닌 explicit allowlist로 관리한다.
- `/internal/metrics`, DB, Prometheus, Loki, Grafana와 Alertmanager는 public internet에 직접 노출하지 않는다.
- Browser session cookie는 Web BFF가 materialize하고 API upstream은 browser `Set-Cookie` ownership을 갖지 않는다.
- Cookie는 `httpOnly`, `secure`, 승인된 `SameSite`, path와 expiry를 명시한다.
- Cross-site cookie가 필요하면 canonical host와 proxy topology를 근거로 별도 결정을 남긴다.

## Health·readiness·metrics 경계

- `GET /health`와 `GET /health/live`는 process liveness를 나타낸다.
- `GET /health/ready`는 routing 전 단일 bounded DB probe와 immutable runtime bootstrap receipt를 확인한다.
- Runtime config, required secret과 critical provider config는 listener 전 bootstrap에서 fail-fast하며 readiness 요청마다 다시 검사하지 않는다.
- Readiness failure는 HTTP 503과 bounded code로 반환하며 secret, DB URL, raw provider error와 stack trace를 노출하지 않는다.
- 제품 도메인 운영 상태는 `/health/auth`, `/health/realtime` 같은 snapshot route로 복제하지 않고 owner-local metric과 Prometheus rule로 관측한다.
- Metrics는 token과 ingress allowlist를 함께 적용한다.
- Metric label은 bounded cardinality만 허용하고 user/email/token/IP 같은 식별자를 사용하지 않는다.

## CI·release·rollback 경계

- CI는 build, lint, typecheck, test, image와 Compose 정합성 검증을 소유하며 production deploy 권한을 갖지 않는다.
- CD는 실제 provider, registry, network, canonical host와 approval owner가 결정된 뒤 target-specific하게 구성한다.
- Release 준비는 `infra/runbooks/release/production-release-readiness.md`에서 시작한다.
- 최종 `GO`, `NO_GO`, `GO_WITH_FOLLOW_UP` 판정은 `infra/runbooks/release/production-release-evidence.md`만 소유한다.
- 실제 target이 없으면 실패로 바꾸지 않고 `PENDING_TARGET`로 유지한다.
- Rollback은 previous safe image와 traffic recovery를 우선하며 DB 영향은 자동 down migration이 아니라 backup/PITR restore escalation으로 판단한다.
- Release/incident evidence에는 secret-free identifier와 bounded 결과만 남긴다.

## Release blocker와 follow-up

다음 항목은 release blocker다.

- critical config 또는 secret 누락과 placeholder secret 사용
- production stub mail sender 또는 provider config failure
- migration, role grant, credential smoke 또는 readiness 실패
- DB·metrics·관측 port의 public exposure
- TLS, canonical host, CORS, cookie 또는 trusted proxy 불일치
- **backup restore 미검증**
- rollback owner 또는 secret-free evidence 부재

성능 최적화, instance 상향, Redis, multi-node, Multi-AZ/read replica, WAF/CDN 또는 managed
observability 전환은 기본적으로 follow-up이다. 다만 release smoke에서 실제 SLO 실패나 장애로 관측되면
blocker로 승격한다.

## 변경 이력

| 날짜       | 변경 내용                                                                                                               | 관련 범위                 |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| 2026-06-17 | API·managed PostgreSQL 배포 준비, secret, mail, DB, ingress, readiness, backup과 rollback 안전 기준을 신설했다.         | production runtime safety |
| 2026-08-06 | Production target 미확정 상태를 `PENDING_TARGET`로 다루고 CI와 CD의 책임을 분리했다.                                    | release responsibility    |
| 2026-08-11 | 변동 가능한 topology·비용·resource·rehearsal evidence를 architecture와 release handoff로 분리했다.                      | documentation ownership   |
| 2026-08-12 | Lightsail production의 Secrets Manager origin, OIDC release principal, mounted-file application read source를 확정했다. | secret delivery           |
