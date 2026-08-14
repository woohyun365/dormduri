# Observability topology

## 책임

이 문서는 API, Web과 미래 BackOffice의 운영 관측 도구 선택, 데이터 흐름과 시스템 경계를 소유한다.
수집 허용 범위·개인정보·접근·보존·fail-open 불변 조건은
[운영 관측 정책](../../policies/operational-observability.md)이 소유한다.

## 결정된 구성

| 신호                          | 생성 owner            | 수집·저장 owner        | 운영 UI                   |
| ----------------------------- | --------------------- | ---------------------- | ------------------------- |
| API/BFF structured log        | Pino·Web logger       | Alloy → Loki           | Grafana Explore/Dashboard |
| API/domain/runtime metric     | `prom-client`         | Prometheus             | Grafana Dashboard         |
| Alert condition               | Prometheus/Loki rules | Alertmanager           | Slack과 Grafana           |
| Browser runtime error         | Sentry Next.js SDK    | Managed Sentry         | Sentry                    |
| Browser performance/Web Vital | Sentry performance    | Managed Sentry         | Sentry                    |
| RDS resource metric           | Managed PostgreSQL    | CloudWatch/DB Insights | AWS 운영 UI               |

Grafana는 Loki나 Prometheus를 대신하는 저장소가 아니다. Loki는 log, Prometheus는 time-series metric을
저장·조회하고 Grafana는 두 source를 시각화한다.

## 데이터 흐름

```text
API/Web/BackOffice stdout
  → Alloy
    → Loki
      → Grafana

API/BackOffice /internal/metrics
  ← Prometheus scrape
    → Grafana
    → Alertmanager → Slack

Browser runtime error / sampled performance
  → Sentry intake
    → Sentry project UI

RDS CPU / connection / memory / IOPS
  → CloudWatch or Database Insights
```

## Browser와 server 관측 분리

- Browser error와 Web Vitals는 managed Sentry가 production owner다.
- BFF reliability는 container stdout → Alloy → Loki → Grafana가 production owner다.
- Local manual Web Vital reporter와 recording transport는 개발 진단용이며 production owner가 아니다.
- Sentry source map upload와 production intake는 managed account, privacy와 release evidence가 확인될 때만 활성화한다.

## Product data와 운영 관측 분리

- Grafana/Sentry는 시스템 장애, 성능과 release 회귀를 분석한다.
- 신고, 제재, 문의, 시즌 운영과 사용자 상태는 제품 DB와 BackOffice가 소유한다.
- 매칭 성공률이나 기능 funnel은 별도 analytics 목적·schema·보존 결정 없이 운영 로그로 대체하지 않는다.
- BackOffice에서 raw Loki/Prometheus query를 proxy하지 않고 필요한 경우 제한된 Grafana deep link를 제공한다.

## 배치와 접근 경계

- 초기 User App 4GiB host에는 bounded Prometheus/Loki/Alloy/Alertmanager/Grafana를 함께 배치한다.
- BackOffice host는 local collector만 두고 중앙 Loki/Prometheus에 service label과 scrape job을 분리한다.
- Observability port는 loopback 또는 private network에만 열고 public ingress에 직접 노출하지 않는다.
- Alloy Docker socket 사용은 single-tenant VPS와 service allowlist를 전제로 하는 현재 제한적 결정이다.
- Collector 또는 저장소 장애는 제품 요청에 대해 fail-open이어야 한다.

## Retention과 durability owner

Repository의 실행 가능한 초기 retention 값은 `infra/observability/production-operations.json`이 소유한다.
실제 disk, volume, backup 또는 허용 손실은 target release readiness/evidence에서 확정한다. Provider account,
region, retention과 operator는 Sentry release readiness/evidence에서 확정한다.

## 변경 trigger

다음 조건이 생기면 topology를 재검토한다.

- Observability container가 User App resource headroom을 침범한다.
- Single VPS disk와 retention이 승인된 RPO/RTO를 만족하지 못한다.
- Docker socket risk를 수용할 수 없거나 multi-tenant host로 전환한다.
- Managed logging/metrics의 비용과 운영 부담이 self-hosted stack보다 유리해진다.
- BackOffice나 다중 instance 도입으로 중앙 수집과 label cardinality 요구가 달라진다.

## 변경 이력

| 날짜       | 변경 내용                                                                              |
| ---------- | -------------------------------------------------------------------------------------- |
| 2026-08-08 | Browser=Sentry, server log=Loki, metric=Prometheus, UI=Grafana 책임을 확정했다.        |
| 2026-08-11 | 정책에서 도구 선택과 데이터 흐름을 분리하고 BackOffice·제품 데이터 경계를 명확히 했다. |
