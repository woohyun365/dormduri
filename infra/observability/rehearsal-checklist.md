# BE observability release rehearsal checklist

이 문서는 BE API/nginx compose와 observability compose를 함께 올려 logging, metrics, dashboard, Alertmanager/Slack, stress smoke가 연결되는지 확인하는 운영 점검 절차다. Production release나 production target stress가 아니라 local/staging에서 반복 가능한 rehearsal 절차다.

## 0. Scope / safety

- Web/Next.js는 범위 밖이다.
- Production DB fixture seed/reset은 금지한다.
- Slack webhook URL, metrics bearer token, DB URL, auth token, cookie는 command output/report/issue에 붙이지 않는다.
- API structured log `ts`는 UTC ISO(`Z`)를 유지한다. Grafana/Loki/nginx display는 KST로 확인한다.
- 2GB host에서는 API/nginx만 상시 운영하고 observability stack은 local 또는 별도 ops host에서 rehearsal하는 것을 우선한다. 4GB host는 동시 rehearsal에 더 안전하다.

## 1. Preflight

```bash
git rev-parse --abbrev-ref HEAD
git rev-parse --short HEAD

docker compose -f infra/deploy/docker-compose.api.yml config >/tmp/knu-api-compose.yml
cd infra/observability
docker compose --env-file .env.observability -f docker-compose.observability.yml config >/tmp/knu-observability-compose.yml
```

Pass 기준:

- compose config command가 성공한다.
- `/tmp/*compose.yml`에는 실제 secret을 공유하지 않는다.
- `infra/deploy/.env.api`와 `infra/observability/.env.observability`는 git ignored 상태다.

## 2. API/nginx up

```bash
docker network create knu-roommate-observability || true

docker compose \
  -f infra/deploy/docker-compose.api.yml \
  -f infra/deploy/docker-compose.api.override.example.yml \
  up -d api nginx
```

Pass 기준:

```bash
docker compose -f infra/deploy/docker-compose.api.yml ps api nginx
curl -fsS http://127.0.0.1:8080/health
curl -fsS http://127.0.0.1:8080/health/ready
```

- API container state가 healthy다.
- `/health`, `/health/ready`가 HTTP 2xx를 반환한다.

## 3. Metrics guard

Unauthorized 요청은 실패해야 한다.

```bash
curl -sS -o /tmp/metrics-unauthorized.txt -w '%{http_code}\n' \
  http://127.0.0.1:8080/internal/metrics
```

Authorized 요청은 성공해야 한다.

```bash
curl -fsS \
  -H "Authorization: Bearer $(cat infra/observability/prometheus/secrets/api-metrics-bearer-token.local)" \
  http://127.0.0.1:8080/internal/metrics | head
```

Pass 기준:

- unauthorized는 `401` 또는 nginx allowlist 조건에 따라 `403`이다.
- authorized는 Prometheus text format을 반환하고 `api_` metric이 보인다.

## 4. Observability up

API compose와 같은 Docker network에서 scrape하려면 `API_METRICS_TARGET=api:4000`을 사용한다.

```bash
cd infra/observability
API_METRICS_TARGET=api:4000 \
  docker compose --env-file .env.observability -f docker-compose.observability.yml up -d
```

Pass 기준:

```bash
curl -fsS http://127.0.0.1:9090/api/v1/targets \
  | python3 -c 'import json,sys; data=json.load(sys.stdin); print([(t["labels"].get("job"), t["health")) for t in data["data"]["activeTargets"]])'

curl -fsS http://127.0.0.1:9090/api/v1/alertmanagers \
  | python3 -c 'import json,sys; data=json.load(sys.stdin); print([{"url": a.get("url"), "lastError": a.get("lastError")} for a in data["data"]["activeAlertmanagers"]])'
```

- Prometheus `api` target이 `up`이다.
- active Alertmanager URL이 `http://alertmanager:9093/api/v2/alerts`이고 `lastError`가 `None/null`이다.

## 5. Alertmanager / Slack smoke

```bash
cd infra/observability
./slack/send-alertmanager-smoke.sh
```

Pass 기준:

```bash
curl -fsS http://127.0.0.1:9093/metrics \
  | rg 'alertmanager_notification_requests_(total|failed_total).*slack|alertmanager_notifications_failed_total.*slack'

curl -fsS http://127.0.0.1:9090/api/v1/rules \
  | python3 -c 'import json,sys; data=json.load(sys.stdin); print([r for g in data["data"]["groups"] for r in g["rules"] if r.get("name")=="SlackAlertSmokeNonFiring"])'
```

- Slack channel에 `SlackAlertSmoke`가 1회 도착한다.
- `alertmanager_notification_requests_failed_total{integration="slack"}`가 `0`이다.
- `SlackAlertSmokeNonFiring`는 `expr: vector(0) == 1`, `alerts: []`다.
- Slack payload에는 userId/email/threadId/raw body/RRPD payload가 없다.

## 6. Grafana / Loki readout

Grafana:

- http://127.0.0.1:3001
- folder: `KNU Roommate API`
- dashboards:
  - `KNU API Overview`
  - `KNU API Realtime/Auth/Retention`

Loki query:

```logql
{service="api"}
{service="api", level="error"}
```

Pass 기준:

- API가 Dockerized `api` service로 실행 중이면 Loki에서 API JSON log가 보인다.
- host process API인 경우 Loki API log가 없을 수 있으므로 Prometheus/Grafana metrics 중심으로 판정한다.

CLI readout 예시:

```bash
curl -fsS 'http://127.0.0.1:3100/loki/api/v1/labels' | head
```

## 7. Stress smoke 연결

Local smoke는 `docs/06_trouble-shooting/observability/api-stress-release-runbook.md`를 따른다.

권장 최소 연결 확인:

```bash
pnpm --dir apps/api stress:docker:smoke
```

237명 ramp evidence는 다음 report/handoff를 기준으로 남아 있다.

- `.omx/reports/api-237-ramp-decision-result-2026-06-16T02-14-39-152Z.md`
- `.omx/reports/api-237-ramp-cache-multinode-handoff-2026-06-16T11-55-01+0900.md`
- follow-up: #281 `MATCH_SCORE` read path 최적화

이 rehearsal은 stress infra 연결성 확인까지다. 946 cohort long run, production target stress, Redis/ElastiCache 도입 결정은 별도 evidence issue에서 다룬다.

## 8. Rollback / silence / cleanup

Alert delivery를 멈출 때:

```bash
cd infra/observability
# local env에서 delivery disabled로 변경
# SLACK_ALERTMANAGER_ENABLED=false

docker compose --env-file .env.observability -f docker-compose.observability.yml up -d --force-recreate alertmanager
```

Stack stop:

```bash
cd infra/observability
docker compose --env-file .env.observability -f docker-compose.observability.yml down

docker compose -f infra/deploy/docker-compose.api.yml down
```

Webhook rotation:

1. Slack app에서 기존 webhook을 revoke한다.
2. 새 webhook을 target channel에 발급한다.
3. ignored local/secret manager에만 반영한다.
4. `send-alertmanager-smoke.sh`로 1회 검증한다.

## 9. Release readiness decision

Close 가능:

- #22: logging/metrics/dashboard/stress/Slack alert path가 local/staging rehearsal로 재현 가능하면 close 가능.

Follow-up 유지:

- #281 / #247: `MATCH_SCORE` read path latency 최적화.
- 946 cohort long run, RDS/CloudWatch/managed observability 연결.
- production Alertmanager HA, Slack channel routing 세분화.
