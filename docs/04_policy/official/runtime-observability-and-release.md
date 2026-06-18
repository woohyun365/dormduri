# 운영 관측·로그·부하 테스트 정책

## 문서 범위

이 문서는 KNU Roommate API의 운영 관측, 로그, 모니터링, stress/load test, release gate, 서버 스펙 선택 기준을 다룬다. Production 배포 준비 전체 기준은 [production-deployment-readiness.md](./production-deployment-readiness.md)가 소유하고, 이 문서는 관측·부하·release evidence 입력을 소유한다.

관련 기준:

- `infra/observability/rehearsal-checklist.md`
- `infra/runbooks/production-release-checklist.md`
- `infra/deploy/README.md`
- [production-deployment-readiness.md](./production-deployment-readiness.md)

## 운영 목표

- 사용자-facing 장애를 운영자가 빠르게 감지한다.
- 개인정보/민감정보/retained payload가 로그·메트릭·dashboard에 노출되지 않게 한다.
- 배포 전 local/staging에서 근거 있는 수치 기반 stress test를 실행한다.
- 월 ₩30,000~70,000 예산 안에서 managed DB 운영성과 release 안정성을 확보한다.

## 서버 스펙 선택지

| 선택지              | 구성                                                                | 월 비용 감각 | 판단                                                                    |
| ------------------- | ------------------------------------------------------------------- | -----------: | ----------------------------------------------------------------------- |
| A. 최소 운영형      | Lightsail App 2GB/1~2vCPU + RDS `db.t4g.micro` Single-AZ + gp3 20GB |   약 ₩49,000 | 기존 기본 권장. observability stack은 외부화하거나 제한적으로 실행      |
| B. 관측 포함 운영형 | Lightsail App 4GB/2vCPU + RDS `db.t4g.micro` Single-AZ + gp3 20GB   |   약 ₩67,000 | **로그/Loki/Grafana/Prometheus를 같은 App instance에서 운영할 때 추천** |
| C. 분리 운영형      | App 2GB + RDS micro + 별도 ops/managed observability                |    비용 변동 | 운영 복잡도는 늘지만 App resource 격리가 가장 좋음                      |
| D. DB 여유형        | App 2~4GB + RDS `db.t4g.small` Single-AZ                            |  약 ₩78,000+ | DB memory/connection/IOPS 실측 문제 확인 후 선택                        |

## 기본 결정

초기 제품화 완료 기준은 **B. 관측 포함 운영형**을 추천한다. 단, 출시 직전 비용을 더 낮춰야 하면 A로 배포하되, Grafana/Loki/Prometheus는 운영자 local/별도 ops instance/managed service로 분리한다.

## 완료된 관측 / 부하 baseline

백엔드 release readiness의 관측 baseline은 아래 상태를 기준으로 한다.

- API는 Pino 기반 structured JSON log와 request correlation을 사용한다.
- `/internal/metrics`는 Prometheus pull model, bearer token guard, nginx internal boundary를 함께 사용한다.
- Prometheus, Grafana, Loki, Alloy, Alertmanager, Slack Incoming Webhook rehearsal 경로가 존재한다.
- Slack delivery smoke는 Alertmanager 경로가 실제 Slack channel까지 도달하는지 검증한다.
- k6 HTTP stress runner와 Artillery Socket.IO smoke runner를 사용한다.
- API/nginx Docker compose는 production-like local/staging rehearsal의 기준 실행 단위다.
- Dockerized smoke, production-like smoke, 237 ramp decision result는 release evidence로 보존한다.

## 로그 정책

### 허용 로그

- requestId/correlationId
- route template, method, status class, duration
- bounded domain/operation/outcome
- hashed actor/session identifier
- error code, error name, retry reason
- queue/outbox/cleanup lag 같은 운영 수치

### 금지 로그

- raw email, password, verification code
- JWT/access/refresh token, cookie, Authorization header
- raw request/response body
- chat message body, support/report 상세 본문
- retained original body, vault payload, encrypted payload, internal audit payload
- raw userId/threadId/messageId/sessionId/IP를 log label로 저장하는 행위

## Metric 정책

- Metrics는 Prometheus pull model을 기준으로 한다.
- `/internal/metrics`는 public endpoint가 아니다.
- metric label은 bounded cardinality만 허용한다.
- userId/email/requestId/threadId/messageId/token/IP는 metric label 금지다.
- Prometheus/Grafana/Loki는 public internet에 직접 노출하지 않는다.

## Dashboard 최소 요구사항

- API Overview: RPS, 4xx/5xx, p95/p99 latency, in-flight, process memory/event loop lag
- Auth Operations: login failure, verification cooldown/lockout, cleanup lag/failure
- Realtime/Outbox: connected sockets, ticket failure, subscribe rejection, dispatcher lag/failure
- Retention/Lifecycle: due job, manual review, retry exhaustion, sweep latency
- RDS/Infrastructure checklist: CPUUtilization, DatabaseConnections, FreeableMemory, ReadIOPS, WriteIOPS, DiskQueueDepth, FreeStorageSpace
- Stress result: scenario별 p95/p99/error/rps/threshold pass-fail

## Stress test 정책

### 실행 target

- 기본 허용: local, staging
- production 실행: 명시적 운영 승인과 explicit env guard가 있을 때만 가능
- production DB seed/reset 금지

### 기준 수치

| scenario               | 기준                    |
| ---------------------- | ----------------------- |
| 기본 운영 사용자       | 약 780~970명            |
| 피크 동시 접속         | 약 250~500명            |
| 기본 최대 score cohort | 새롬 남/여 약 190~237명 |
| stress score cohort    | 새롬 남/여 최대 946명   |

### release gate

- k6 HTTP smoke는 배포 전 필수다.
- staging baseline/peak는 release 전 또는 시즌 전 checklist에서 실행한다.
- Artillery Socket.IO smoke는 realtime 변경 배포 전 필수다.
- API/nginx Dockerized smoke는 release candidate image의 기본 실행 가능성을 검증한다.
- Production-like smoke는 nginx ingress, health/readiness, metrics guard, log 수집 경로를 함께 검증한다.
- 237 ramp decision evidence는 현재 known peak에 가까운 read/write path 병목 판단 입력으로 사용한다.
- Slack delivery smoke, Prometheus target up, Loki/Grafana readout은 운영 관측 경로가 release 가능한지 판단하는 입력이다.
- `infra/runbooks/production-release-checklist.md`는 observability/stress evidence를 최종 `GO`, `NO-GO`, `GO with follow-up` 판단에 사용한다.
- threshold fail은 release blocker로 본다.

## 성능 follow-up 분리 기준

아래 항목은 release blocker가 아니라 evidence-based follow-up이다. 다만 release smoke에서 실제 장애나 SLO 미달로 관측되면 blocker로 승격한다.

- #281, #247 같은 read path 최적화 후보.
- 946 cohort long run.
- RDS CloudWatch 장기 sizing.
- Redis/ElastiCache, multi-node, read replica, WAF/CloudFront 고도화.

## 운영 도구 선택 기준

| 영역                 | 기본 도구                      | 이유                                                      |
| -------------------- | ------------------------------ | --------------------------------------------------------- |
| API structured logs  | Pino JSON logger               | redaction, request correlation, low overhead JSON logging |
| Metrics              | Prometheus + prom-client       | app/domain metric pull model, Grafana 연동                |
| Logs UI              | Loki + Alloy + Grafana         | JSON log 수집/검색, Grafana 단일 UI                       |
| HTTP stress          | Grafana k6                     | threshold 기반 pass/fail, API scenario 작성 용이          |
| Socket.IO stress     | Artillery                      | Socket.IO 공식 문서에서 load testing 도구로 안내          |
| RDS resource metrics | CloudWatch / Database Insights | RDS native CPU/connection/IOPS/storage 관측               |

## 보존 기간

- application operational logs: 기본 30일.
- security/audit/retention access log: 각 domain 공식 정책의 보존 기간을 따른다.
- stress result report: release evidence는 최소 해당 release cycle 동안 보존한다.
- raw stress credential/token은 report에 저장하지 않는다.

## 변경 이력

| 날짜       | 변경 내용                                                                                                                                           | 근거                            |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 2026-06-13 | 운영 관측·로그·부하 테스트 정책을 신설하고, 2GB 최소형과 4GB 관측 포함형 서버 스펙 선택지, metrics/log privacy, stress release gate 기준을 정의했다 | logging-stress infrastructure   |
| 2026-06-17 | 운영 관측 baseline을 완료 상태로 정리하고, production deployment readiness 문서와 release evidence 입력, 성능 follow-up 분리 기준을 연결했다        | production deployment readiness |
| 2026-06-17 | Production release checklist가 observability/stress evidence를 최종 release decision 입력으로 사용한다는 기준을 추가했다                            | production deployment readiness |
