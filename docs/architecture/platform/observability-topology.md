# Observability topology

## 책임

이 문서는 API, Web과 미래 BackOffice의 운영 관측 도구 선택, 데이터 흐름과 시스템 경계를 소유한다.
수집 허용 범위·개인정보·접근·보존·fail-open 불변 조건은
[운영 관측 정책](../../policies/operational-observability.md)이 소유한다. 지금 적용한 resource의 종류와 상태는
[Production environment](../../deploy/production-environment.md)가 소유한다.

## 지금 API 단계

지금 운영 관측은 user host의 관측 stack 다섯(Alloy·Loki·Prometheus·Grafana·Alertmanager)과 Slack 경보, RDS CloudWatch 경보,
외부 가용성 경보다. Web Sentry는 끄고 API에는 Sentry dependency가 없다. 배치·보존·접근·가림·경보 대응 절차는
[Observability production operations](../../../infra/runbooks/operations/observability/production-stack.md)가 소유한다.

```text
container stdout (compose service api·ingress·web만) → Alloy (가림) → Loki → Grafana
API /internal/metrics (bearer token) ← Prometheus scrape → Grafana
Alloy host exporter (host /·/proc·/sys 읽기 전용) ← Prometheus job host
Prometheus rules → Alertmanager → Slack channel 하나

RDS 지표 → CloudWatch alarm 다섯 (서울) → SNS 주제 → email 구독

Route 53 HTTPS health check (apex /, SNI)
  → CloudWatch alarm (us-east-1, health check 지표)
    → SNS 주제 (us-east-1)
      → email 구독
```

- 관측 stack은 API 묶음으로 배포하고 설정은 image `dormduri/observability-config` 하나로 결속한다. Grafana·Prometheus·
  Alertmanager는 host loopback에만 bind하고 공개 경로가 없으며, operator는 Identity Center 단기 credential로 SSM port
  forwarding을 연다.
- 관측은 제품 요청에 fail-open이다. API 배포의 관측 단계가 실패해도 배포 결과를 바꾸지 않고 host `RESULT` 줄의
  `observability` 값으로 남는다.
- Health check는 밖에서 본 공개 HTTPS 응답만 확인한다. Host 안 container 상태와 로그는 관측 stack이 본다.
- Route 53 health check 지표는 `us-east-1`에 있으므로 alarm과 그 SNS 주제도 `us-east-1`에 둔다. Host가 점검 mode(503)인
  동안 이 alarm은 ALARM 상태다.
- SES 결과 알림(구성 세트 event destination → SNS email)은 메일 발송 결과 알림이고 runtime 관측이 아니다. 알림 본문에는
  받는 사람 주소가 담기므로 관측 stack으로 모으지 않는다. 기준은 [SES setup checklist](../../../infra/aws/ses-setup-checklist.md)다.
- Health check·alarm·주제 이름, Slack workspace와 받는 주소는 Owner console에 있다([식별자 규칙](../../deploy/README.md#식별자-규칙)).

## 이후 목표

API 단계부터 BackOffice까지의 관측 구성이다. 아래 구성은 2026-08-08·2026-08-11에 정했다. 관측 stack의 위치와 접근
경로, 경보 채널(Slack channel 하나), Web Sentry 끔은 API 단계 준비에서 정했고(Owner 2026-11-05) 위
[지금 API 단계](#지금-api-단계)가 적용한 구성이다. 아래 표의 Sentry 두 행은 Web Sentry를 켤 때의 목표다.

### 목표 구성

| 신호                          | 생성 owner              | 수집·저장 owner        | 운영 UI                   |
| ----------------------------- | ----------------------- | ---------------------- | ------------------------- |
| API/BFF structured log        | Pino·Web logger         | Alloy → Loki           | Grafana Explore/Dashboard |
| Ingress 접속 log              | nginx                   | Alloy → Loki           | Grafana Explore/Dashboard |
| API/domain/runtime metric     | `@prometheus-io/client` | Prometheus             | Grafana Dashboard         |
| Alert condition               | Prometheus/Loki rules   | Alertmanager           | Slack과 Grafana           |
| Browser runtime error         | Sentry Next.js SDK      | Managed Sentry         | Sentry                    |
| Browser performance/Web Vital | Sentry performance      | Managed Sentry         | Sentry                    |
| RDS resource metric           | Managed PostgreSQL      | CloudWatch/DB Insights | AWS 운영 UI               |

Grafana는 Loki나 Prometheus를 대신하는 저장소가 아니다. Loki는 log, Prometheus는 time-series metric을
저장·조회하고 Grafana는 두 source를 시각화한다.

### 데이터 흐름

```text
API/Web/Ingress/BackOffice stdout
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

## 접속 log 분류

Ingress(nginx)와 Web의 요청 log는 [운영 관측 정책](../../policies/operational-observability.md)이 다루는 운영 log다. 장애
분석이 목적이고 보존 기준은 [data-retention.md DR-R3](../../policies/data-retention.md), 운영 관측 저장소로 보내는 필드와 host json-file의
예외 범위는 [operational-observability.md OO-R1](../../policies/operational-observability.md)이 소유한다. 개인정보처리시스템 접속기록
([data-retention.md DR-R4](../../policies/data-retention.md))과 이용자 로그기록([legal-basis.md LB-R8](../../policies/legal-basis.md))은
이 log로 대신하지 않는다. 장애 분석에 원본 IP가 필요하지 않고, 이용자 로그기록은 채팅을 실제 사용자에게 여는 변경이 저장 위치와
방식을 따로 정하기 때문이다.

- 지금 API 단계: ingress log 형식이 client IP를 가린 값(IPv4 /24·IPv6 /48)으로 쓰고 query string과 referer를 남기지 않는다. Alloy는 옛
  형식 log가 들어와도 저장소 기준을 지키도록 IP를 한 번 더 가리고 query string과 referer를 지우며 경로 속 식별자를 가린다. 그래서
  host json-file(10MB × 3)과 Loki에 원본 IP가 없고 Loki에는 query string·referer와 경로 속 식별자도 없다.
- 이 형식 전의 ingress image(2026-11-20 API 단계 배포 전 쌍)로 rollback하면 그 동안 host json-file에 원본 IP가 다시 쌓이고, Loki에는
  위 Alloy 처리를 거친 값만 들어간다.

## 변경 trigger

다음 조건이 생기면 topology를 재검토한다.

- Observability container가 User App resource headroom을 침범한다.
- Single VPS disk와 retention이 승인된 RPO/RTO를 만족하지 못한다.
- Docker socket risk를 수용할 수 없거나 multi-tenant host로 전환한다.
- Managed logging/metrics의 비용과 운영 부담이 self-hosted stack보다 유리해진다.
- BackOffice나 다중 instance 도입으로 중앙 수집과 label cardinality 요구가 달라진다.

## 변경 이력

| 날짜       | 변경 내용                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------- |
| 2026-08-08 | Browser=Sentry, server log=Loki, metric=Prometheus, UI=Grafana 책임을 확정했다.                                     |
| 2026-08-11 | 정책에서 도구 선택과 데이터 흐름을 분리하고 BackOffice·제품 데이터 경계를 명확히 했다.                              |
| 2026-09-03 | API metric client를 공식 successor인 `@prometheus-io/client`로 교체했다.                                            |
| 2026-10-31 | 지금 Web 단계의 외부 가용성 경보 경로를 첫 절로 두고 수집 stack·Sentry·DB 지표 구성을 이후 목표 절로 옮겼다.        |
| 2026-11-20 | API 단계 첫 배포 뒤 첫 절을 지금 API 단계(관측 stack 다섯·Slack·RDS 경보·외부 가용성 경보, Web Sentry 끔)로 고쳤다. |
| 2026-11-08 | nginx·Web 요청 log를 운영 log로 분류하고 지금과 이후의 원본 IP 위치, 목표 구성의 ingress 수집을 적었다(#759·#869).  |
