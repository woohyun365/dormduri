# KNU Roommate observability stack

이 디렉터리는 API의 structured JSON stdout log와 `/internal/metrics`를 local/staging에서 확인하는 관측 stack을 제공한다.
API product behavior, route, response code, auth/session semantics는 이 stack을 켜도 바뀌지 않는다.

## 구성

| Component    | Local URL              | 역할                                             |
| ------------ | ---------------------- | ------------------------------------------------ |
| Prometheus   | http://127.0.0.1:9090  | API `/internal/metrics` scrape와 alert rule 평가 |
| Alertmanager | http://127.0.0.1:9093  | Prometheus alert grouping과 Slack delivery       |
| Grafana      | http://127.0.0.1:3001  | Prometheus/Loki datasource와 dashboard           |
| Loki         | http://127.0.0.1:3100  | structured JSON log 저장                         |
| Alloy        | http://127.0.0.1:12345 | Docker stdout log 수집 후 Loki 전송              |

모든 UI/endpoint는 기본적으로 `127.0.0.1`에만 bind한다. 운영 public internet에 직접 노출하지 않는다.

관측 container의 process timezone은 minimal image에서도 KST가 적용되도록 `OBSERVABILITY_TZ=KST-9`를 기본값으로 사용한다. Grafana dashboard/default timezone은 `Asia/Seoul`로 고정한다. API structured log의 `ts` 필드는 다른 시스템과의 correlation을 위해 UTC ISO(`Z`)를 유지하고, Grafana/Loki 화면과 nginx access log에서 KST로 표시한다.

## 사전 조건

1. Docker Desktop 또는 OrbStack daemon이 실행 중이어야 한다.
2. API는 기본 port `4000`에서 실행되어야 한다.
3. metrics bearer token을 맞춘다.

```bash
# API shell
export METRICS_ENABLED=true
export METRICS_BEARER_TOKEN=local-metrics-token-change-me
pnpm --dir apps/api start:dev
```

Prometheus가 읽을 token file도 같은 값을 사용한다.

```bash
cp infra/observability/.env.observability.example infra/observability/.env.observability
cp \
  infra/observability/prometheus/secrets/api-metrics-bearer-token.example \
  infra/observability/prometheus/secrets/api-metrics-bearer-token.local
```

`infra/observability/.env.observability`와 `prometheus/secrets/*.local`은 git에 커밋하지 않는다.

## 실행

```bash
# config validation
cd infra/observability
docker compose --env-file .env.observability -f docker-compose.observability.yml config

# stack up
docker compose --env-file .env.observability -f docker-compose.observability.yml up -d
```

API가 host에서 실행 중이면 기본 scrape target은 `host.docker.internal:4000`이다. API compose와 같은 Docker network에서 실행할 때는 `.env.observability`의 `API_METRICS_TARGET`을 `api:4000`처럼 바꾼다.

## 확인

### Prometheus target

1. http://127.0.0.1:9090/targets 접속.
2. `api` job이 `UP`인지 확인.
3. down이면 token file 값과 API `METRICS_BEARER_TOKEN`, API port, `/internal/metrics` 접근을 확인한다.

CLI smoke:

```bash
curl -H "Authorization: Bearer $(cat infra/observability/prometheus/secrets/api-metrics-bearer-token.local)" \
  http://127.0.0.1:4000/internal/metrics | head
```

### Grafana dashboard

1. http://127.0.0.1:3001 접속.
2. `.env.observability`의 `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD`로 로그인.
3. `KNU Roommate API` folder에서 다음 dashboard를 확인한다.
   - `KNU API Overview`
   - `KNU API Realtime/Auth/Retention`

### Loki log query

Grafana Explore에서 datasource `Loki`를 선택하고 다음 query를 실행한다.

```logql
{service="api"}
{service="api", level="error"}
```

Alloy는 Docker stdout log를 수집하고 Docker compose service metadata를 Loki `service` label로 사용한다. API나 Web이 compose 밖의 host process로 실행되면 Docker log source가 아니므로 Loki에 structured log가 보이지 않는다. API는 같은 Docker daemon의 `api` service, Web BFF는 `web` service로 실행해야 각각의 dashboard query가 동작한다. `pnpm web:observability:rehearsal`은 production standalone Web image와 deterministic upstream fixture를 관측 stack에 연결해 이 경로를 OrbStack에서 검증한다.

관측 stack 자체의 Docker log를 확인할 때는 다음처럼 service label을 구분한다.

```logql
{service="prometheus"}
{service="grafana"}
{service="loki"}
{service="alloy"}
```

## Release rehearsal checklist

BE API/nginx compose와 observability compose를 함께 올려 연결성을 확인할 때는 `infra/observability/rehearsal-checklist.md`를 따른다. 이 checklist는 2CPU/4096MiB Docker engine preflight, resource override, `/health/ready`, metrics bearer guard, Prometheus target, Alertmanager target, Slack smoke, Grafana/Loki readout, stress 연결을 한 번에 확인하는 운영 점검 절차다.

## Stress release gate에서 보는 법

API stress release gate는 `docs/runbooks/observability/api-stress-release-runbook.md`를 기준으로 실행한다. 결과 공유는 `apps/api/test/stress/evidence/renderers/report-template.md`를 복사해 safe metric과 dashboard readout만 채운다.

Stress window 동안 우선 확인할 항목은 다음과 같다.

- Prometheus `api` target이 `UP`인지 확인한다.
- Grafana `KNU API Overview`에서 5xx rate, HTTP p95/p99 latency, in-flight request를 확인한다.
- Grafana `KNU API Realtime/Auth/Retention`에서 realtime socket/rejection/outbox lag, auth cleanup target별 batch 포화, retention backlog를 확인한다.
- 같은 dashboard에서 login outcome, real/dummy password verify p95·in-flight, renewal outcome을 함께 확인한다.
- Loki는 API가 Dockerized `api` service로 실행될 때 `{service="api", level="error"}`를 확인한다. Host process API는 Docker log source가 아니므로 Loki API log가 없을 수 있다.
- 2GB instance에서는 observability stack을 같은 host에 상시 올리기보다 local/별도 ops host에서 rehearsal한다.
- 4GB/2CPU local constrained rehearsal은 `docker-compose.observability.rehearsal.yml`을 추가 적용한다.

## Label / privacy policy

Loki label은 low-cardinality 값만 허용한다.

- 허용: `service`, `env`, `container`, `level`
- 금지: `userId`, `email`, `threadId`, `messageId`, `requestId`, `correlationId`, `ip`, `path`, `token`, `cookie`, raw payload/body

requestId 같은 추적 필드는 JSON field로 남을 수 있지만 Loki label로 승격하지 않는다. Prometheus label도 API code의 metric label policy를 따른다.

Web BFF는 `web_bff_request_completed` structured event를 같은 Docker stdout 경로로 전달한다. Grafana dashboard UID는 `knu-web-bff-reliability`이며 browser runtime error와 Web Vitals는 승인된 managed provider에서 조회한다. 설정·smoke·kill switch 절차는 `infra/runbooks/web-operational-observability.md`를 따른다.

### Web local constrained rehearsal

OrbStack Docker Engine을 2 CPU / 4096MiB로 제한한 뒤 repository root에서 실행한다.

```bash
pnpm web:observability:rehearsal
```

runner는 다음을 자동 검증하고 종료 시 전용 container·network·volume을 정리한다.

- production Next standalone image build와 health
- `bookmark.list` success/invalid-response/timeout structured event
- `web` stdout → Alloy → Loki ingest
- Grafana `knu-web-bff-reliability` dashboard provisioning
- raw rehearsal email/token/query 비노출
- Loki 중단 중 Web BFF 응답 fail-open

실행 후 container를 유지하려면 `WEB_REHEARSAL_KEEP=1`을 사용한다. 2CPU/4GB가 아닌 Docker Engine에서 compose 기능만 점검할 때는 명시적으로 `WEB_REHEARSAL_ALLOW_UNCONSTRAINED=1`을 사용하되 release evidence로 취급하지 않는다.

## Alert rule / Slack delivery

Prometheus rule은 Alertmanager로 route된다. Alertmanager는 기본적으로 no-op receiver로 기동하며, Slack delivery는 ignored local env에 webhook을 넣고 명시적으로 켠 경우에만 활성화된다.

현재 rule:

- `ApiHigh5xxRate`
- `ApiP95LatencyHigh`
- `RealtimeOutboxLagHigh`
- `PrismaPoolWaitingHigh`
- `RetentionReviewBacklogHigh`
- `AuthCleanupFailed`
- `AuthCleanupBatchSaturated`
- `AuthPasswordVerifyInFlightHigh`
- `AuthSessionRenewalReuseDetected`
- `SlackAlertSmokeNonFiring` — non-firing guard. 실제 발송은 `infra/observability/slack/send-alertmanager-smoke.sh`로 수행

Login/session alert의 metric query, 개인정보 금지 경계, 복구 순서는 `infra/runbooks/auth-session-incidents.md`를 따른다.

Slack delivery 활성화:

```env
SLACK_ALERTMANAGER_ENABLED=true
SLACK_ALERT_WEBHOOK_URL=<SLACK_INCOMING_WEBHOOK_URL>
SLACK_ALERT_CHANNEL=#knu-roommate-alerts-test
```

실제 webhook URL은 `infra/observability/.env.observability`에만 둔다. `infra/observability/.env.observability.example`, Alertmanager example, 문서, PR/이슈에는 secret 값을 남기지 않는다. 자세한 절차는 `infra/observability/slack/slack-setup-runbook.md`와 `docs/runbooks/observability/slack-alert-runbook.md`를 따른다.

Slack payload는 `alertname`, `service`, `env`, `severity`, bounded summary, runbook만 포함한다. userId/email/threadId/raw body/RRPD payload는 금지한다.

## Resource guidance

- 2GB 최소형: API 운영은 가능하지만 Grafana/Loki/Prometheus/Alloy 상시 동시 실행은 여유가 적다. 필요 시 stack을 local/별도 ops host에서만 실행한다.
- 4GB 관측 포함형: Docker engine을 2CPU/4096MiB로 제한하고 `docker-compose.observability.rehearsal.yml`의 container limit을 적용한다.
- Auth password capacity 절차는 `docs/runbooks/observability/auth-password-capacity-rehearsal-runbook.md`를 따른다.

## 정리

```bash
cd infra/observability
docker compose --env-file .env.observability -f docker-compose.observability.yml down

# volume까지 제거할 때만 사용
docker compose --env-file .env.observability -f docker-compose.observability.yml down -v
```
