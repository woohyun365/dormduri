# Observability topology

## 책임

이 문서는 API, Web과 미래 BackOffice의 운영 관측 도구 선택, 데이터 흐름과 시스템 경계를 소유한다.
수집 허용 범위·개인정보·접근·보존·fail-open 불변 조건은
[운영 관측 정책](../../policies/operational-observability.md)이 소유한다. 지금 적용한 resource의 종류와 상태는
[Production environment](../../deploy/production-environment.md)가 소유한다.

## 지금 Web 단계

지금 운영 관측은 외부 가용성 경보 하나다. 로그·지표 수집 stack(Alloy·Loki·Prometheus·Grafana·Alertmanager),
Slack 경보, Sentry와 DB 지표는 아직 없고 아래 [이후 목표](#이후-목표)에서 켠다.

```text
Route 53 HTTPS health check (apex /, SNI)
  → CloudWatch alarm (us-east-1, health check 지표)
    → SNS 주제 (us-east-1)
      → email 구독
```

- Health check는 밖에서 본 공개 HTTPS 응답만 확인한다. Host 안 container 상태, 응답 지연 분포와 로그는 보지 않는다.
- Route 53 health check 지표는 `us-east-1`에 있으므로 alarm과 그 SNS 주제도 `us-east-1`에 둔다.
- Host가 점검 mode(503)인 동안 alarm은 ALARM 상태다. 첫 Web 배포 뒤 OK가 되는지 확인한다.
- SES 결과 알림(구성 세트 event destination → SNS email)은 메일 발송 결과 알림이고 runtime 관측이 아니다. 기준은
  [SES setup checklist](../../../infra/aws/ses-setup-checklist.md)다.
- Health check·alarm·주제 이름과 받는 주소는 Owner console에 있다([식별자 규칙](../../deploy/README.md#식별자-규칙)).

## 이후 목표

API 단계부터 켜는 관측 구성이다. 아래 구성은 2026-08-08·2026-08-11에 정했다. 관측 stack의 위치와 접근 경로, 경보 채널,
Web Sentry 사용 여부는 그 단계의 준비 작업이
[이후 단계에서 정할 입력](../../deploy/production-environment.md#이후-단계에서-정할-입력)으로 정한다.

### 목표 구성

| 신호                          | 생성 owner              | 수집·저장 owner        | 운영 UI                   |
| ----------------------------- | ----------------------- | ---------------------- | ------------------------- |
| API/BFF structured log        | Pino·Web logger         | Alloy → Loki           | Grafana Explore/Dashboard |
| API/domain/runtime metric     | `@prometheus-io/client` | Prometheus             | Grafana Dashboard         |
| Alert condition               | Prometheus/Loki rules   | Alertmanager           | Slack과 Grafana           |
| Browser runtime error         | Sentry Next.js SDK      | Managed Sentry         | Sentry                    |
| Browser performance/Web Vital | Sentry performance      | Managed Sentry         | Sentry                    |
| RDS resource metric           | Managed PostgreSQL      | CloudWatch/DB Insights | AWS 운영 UI               |

Grafana는 Loki나 Prometheus를 대신하는 저장소가 아니다. Loki는 log, Prometheus는 time-series metric을
저장·조회하고 Grafana는 두 source를 시각화한다.

### 데이터 흐름

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

### Browser와 server 관측 분리

- Browser error와 Web Vitals는 managed Sentry가 production owner다.
- BFF reliability는 container stdout → Alloy → Loki → Grafana가 production owner다.
- Local manual Web Vital reporter와 recording transport는 개발 진단용이며 production owner가 아니다.
- Sentry source map upload와 production intake는 managed account, privacy와 release evidence가 확인될 때만 활성화한다.

### 배치와 접근 경계

- 초기 User App 4GiB host에는 bounded Prometheus/Loki/Alloy/Alertmanager/Grafana를 함께 배치한다.
- BackOffice host는 local collector만 두고 중앙 Loki/Prometheus에 service label과 scrape job을 분리한다.
- Observability port는 loopback 또는 private network에만 열고 public ingress에 직접 노출하지 않는다.
- Alloy Docker socket 사용은 single-tenant VPS와 service allowlist를 전제로 하는 제한적 결정이다.
- Collector 또는 저장소 장애는 제품 요청에 대해 fail-open이어야 한다.

## Product data와 운영 관측 분리

- Grafana/Sentry는 시스템 장애, 성능과 release 회귀를 분석한다.
- 신고, 제재, 문의, 시즌 운영과 사용자 상태는 제품 DB와 BackOffice가 소유한다.
- 매칭 성공률이나 기능 funnel은 별도 analytics 목적·schema·보존 결정 없이 운영 로그로 대체하지 않는다.
- BackOffice에서 raw Loki/Prometheus query를 proxy하지 않고 필요한 경우 제한된 Grafana deep link를 제공한다.

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

| 날짜       | 변경 내용                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------ |
| 2026-08-08 | Browser=Sentry, server log=Loki, metric=Prometheus, UI=Grafana 책임을 확정했다.                              |
| 2026-08-11 | 정책에서 도구 선택과 데이터 흐름을 분리하고 BackOffice·제품 데이터 경계를 명확히 했다.                       |
| 2026-09-03 | API metric client를 공식 successor인 `@prometheus-io/client`로 교체했다.                                     |
| 2026-10-31 | 지금 Web 단계의 외부 가용성 경보 경로를 첫 절로 두고 수집 stack·Sentry·DB 지표 구성을 이후 목표 절로 옮겼다. |
