# 운영 관측 정책

## 문서 범위

이 문서는 API, Web과 미래 BackOffice의 운영 관측 데이터 수집, 개인정보 보호, 접근, 보존과
fail-open 불변 조건을 소유한다. 구체적인 도구 선택과 데이터 흐름은
[Observability topology](../architecture/platform/observability-topology.md), 실행·복구 절차는
`infra/runbooks/`와 `docs/runbooks/observability/`가 소유한다.

관련 기준:

- [Production runtime safety](./production-runtime-safety.md)
- [Web 운영 관측성 경계](../architecture/frontend/web-observability.md)
- `infra/runbooks/observability-production-operations.md`
- `infra/runbooks/web-operational-observability.md`
- `infra/runbooks/web-sentry-managed-release-readiness.md`
- `infra/runbooks/release/production-release-readiness.md`
- `infra/runbooks/release/production-release-evidence.md`

## 수집 목적 제한

- 운영 관측은 장애 감지, 원인 분석, 성능 회귀와 release 안정성 판단에만 사용한다.
- Auth Journey, Main 기능 funnel, 사용자 행동 분석과 매칭 성공률 같은 제품 분석은 별도 목적·보존·privacy 결정 없이는 운영 로그나 RUM으로 수집하지 않는다.
- 제품 상태, 제재, 신고, 문의와 법적 감사 기록은 제품 DB가 소유하며 Loki나 metric을 source of truth로 사용하지 않는다.

## 허용 로그

- requestId/correlationId
- route template, method, status class와 duration
- bounded domain, operation과 outcome
- 승인된 비가역 actor/session 식별자
- bounded error code, error name과 retry reason
- queue/outbox lag, cleanup saturation과 resource 상태 같은 운영 수치

## 금지 로그와 metric label

- raw email, password와 verification code
- JWT/access/renewal token, cookie와 Authorization header
- raw request/response body
- chat, support와 report 상세 본문
- retained original body, vault/encrypted payload와 internal audit payload
- raw userId, sessionId, threadId, messageId와 IP
- user/email/request/token/IP처럼 cardinality와 개인정보 위험이 큰 metric label

## Browser와 Web 관측 정책

- Browser는 runtime error와 sampled Web Vitals만 운영 관측 범위로 수집한다.
- Browser event는 allowlist된 error/performance field만 허용한다.
- Session Replay, heatmap, DOM autocapture와 user identity 수집은 사용하지 않는다.
- Runtime error에서 raw message, form value, source context와 local variable을 제거한다.
- Symbolication에 필요한 stack file, function, line과 column만 허용한다.
- BFF는 bounded operation, outcome, status class와 duration을 structured stdout log로 남긴다.
- Browser provider 또는 관측 collector 장애는 사용자 화면, navigation과 mutation을 차단하지 않는다.

## Metric과 접근 정책

- Metrics는 pull model을 기준으로 하고 endpoint는 internal route로 유지한다.
- `/internal/metrics`는 bearer token, ingress allowlist와 bounded label 정책을 함께 만족해야 한다.
- Prometheus, Grafana, Loki, Alertmanager와 collector 관리 port는 public internet에 직접 노출하지 않는다.
- Grafana operator 접근은 인증과 private ingress를 사용한다.
- 관측 도구의 접근 권한을 BackOffice 제품 권한과 동일하게 취급하지 않는다.

## 보존 정책

- Application operational log의 기본 보존 목표는 30일이다.
- Browser runtime error와 performance 보존기간은 provider 계약, region과 개인정보 검토 후 확정한다.
- Security, audit와 retention access log는 각 owning domain의 공식 보존 정책을 따른다.
- Release·stress evidence는 해당 release cycle 동안 재검증 가능한 형태로 보존한다.
- Raw stress credential, token과 사용자 payload는 report에 저장하지 않는다.
- 실제 volume, disk budget, backup 또는 허용 손실은 target release evidence가 소유한다.

## Fail-open과 장애 격리

- 로그, metric, dashboard 또는 browser provider 장애가 제품 요청을 실패시키면 안 된다.
- 관측 실패 자체는 bounded operational event와 health signal로 남기되 제품 응답에 내부 상세를 노출하지 않는다.
- Collector는 수집 대상 service allowlist와 최소 권한을 사용한다.
- Docker socket 사용은 읽기 전용 표기만으로 안전하다고 간주하지 않고 single-tenant host, private port, immutable image와 migration trigger를 함께 요구한다.
- 관측 component의 resource 고갈이 Web/API container의 memory와 latency를 침범하면 release blocker로 승격한다.

## Stress와 release evidence 안전 경계

- Stress test의 기본 허용 target은 local과 staging이다.
- Production stress는 명시적 운영 승인과 explicit environment guard가 있을 때만 가능하다.
- Production DB seed, fixture reset과 destructive cleanup은 금지한다.
- Threshold 실패는 release evidence에서 숨기지 않으며 blocker 또는 owner가 지정된 follow-up으로 분류한다.
- Dashboard, alert, retention과 target별 검증 목록은 release readiness에서 관리하고 이 정책에 고정하지 않는다.

## 변경 이력

| 날짜       | 변경 내용                                                                                          | 관련 범위                 |
| ---------- | -------------------------------------------------------------------------------------------------- | ------------------------- |
| 2026-06-13 | 로그·metric 개인정보, 접근과 stress 실행 안전 경계를 신설했다.                                     | operational observability |
| 2026-08-06 | Browser runtime error, BFF reliability와 Web Vitals의 수집 목적·privacy·fail-open 경계를 추가했다. | Web observability         |
| 2026-08-08 | Browser와 BFF 관측 owner를 분리하고 managed provider release evidence 경계를 추가했다.             | provider responsibility   |
| 2026-08-11 | 도구 topology, 서버 선택, 비용과 실행 절차를 architecture 및 release/rehearsal 문서로 분리했다.    | documentation ownership   |
