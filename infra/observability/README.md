# KNU Roommate observability stack

이 디렉터리는 API의 structured JSON stdout log와 `/internal/metrics`를 local/staging에서 확인하는 관측 stack을 제공한다.
API product behavior, route, response code, auth/session semantics는 이 stack을 켜도 바뀌지 않는다.

## 구성

| Component  | Local URL              | 역할                                             |
| ---------- | ---------------------- | ------------------------------------------------ |
| Prometheus | http://127.0.0.1:9090  | API `/internal/metrics` scrape와 alert rule 평가 |
| Grafana    | http://127.0.0.1:3001  | Prometheus/Loki datasource와 dashboard           |
| Loki       | http://127.0.0.1:3100  | structured JSON log 저장                         |
| Alloy      | http://127.0.0.1:12345 | Docker stdout log 수집 후 Loki 전송              |

모든 UI/endpoint는 기본적으로 `127.0.0.1`에만 bind한다. 운영 public internet에 직접 노출하지 않는다.

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

Alloy는 Docker stdout log를 수집한다. API가 compose 밖에서 `pnpm start:dev`로 실행되면 Docker log source가 아니므로 Loki에는 API log가 보이지 않을 수 있다. 이 경우 Prometheus/Grafana metrics만 확인하거나, API를 app compose와 같은 Docker daemon에서 실행한다.

## Label / privacy policy

Loki label은 low-cardinality 값만 허용한다.

- 허용: `service`, `env`, `container`, `level`
- 금지: `userId`, `email`, `threadId`, `messageId`, `requestId`, `correlationId`, `ip`, `path`, `token`, `cookie`, raw payload/body

requestId 같은 추적 필드는 JSON field로 남을 수 있지만 Loki label로 승격하지 않는다. Prometheus label도 API code의 metric label policy를 따른다.

## Alert rule

이 stack은 Prometheus-local rule만 제공한다. Slack/Alertmanager delivery는 별도 alert 연결 단계에서 다룬다.

현재 rule:

- `ApiHigh5xxRate`
- `ApiP95LatencyHigh`
- `RealtimeOutboxLagHigh`
- `PrismaPoolWaitingHigh`
- `RetentionReviewBacklogHigh`
- `AuthCleanupLagHigh`

## Resource guidance

- 2GB 최소형: API 운영은 가능하지만 Grafana/Loki/Prometheus/Alloy 상시 동시 실행은 여유가 적다. 필요 시 stack을 local/별도 ops host에서만 실행한다.
- 4GB 관측 포함형: API와 observability stack을 같은 host에서 rehearsal하기에 더 안전하다.

## 정리

```bash
cd infra/observability
docker compose --env-file .env.observability -f docker-compose.observability.yml down

# volume까지 제거할 때만 사용
docker compose --env-file .env.observability -f docker-compose.observability.yml down -v
```
