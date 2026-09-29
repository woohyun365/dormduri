# BE observability local rehearsal checklist

이 문서는 BE API/nginx compose와 observability compose를 함께 올려 logging, metrics, dashboard, Alertmanager/Slack, stress smoke가 연결되는지 확인하는 운영 점검 절차다. Production release나 production target stress가 아니라 local/staging에서 반복 가능한 rehearsal 절차다.

## 0. Scope / safety

- Web/Next.js는 이 API checklist 범위 밖이며 `infra/runbooks/operations/observability/web-bff.md`의 별도 local constrained rehearsal을 사용한다.
- Production DB fixture seed/reset은 금지한다.
- Slack webhook URL, metrics bearer token, DB URL, auth token, cookie는 command output/report/issue에 붙이지 않는다.
- API structured log `ts`는 UTC ISO(`Z`)를 유지한다. Grafana/Loki/nginx display는 KST로 확인한다.
- 이 문서의 관측 포함 실행은 Docker engine을 2 CPU / 4096MiB로 제한한 local constrained rehearsal이다.
- Web/BackOffice는 현재 compose에 포함되지 않으며 local PostgreSQL은 managed PostgreSQL 성능을 대표하지 않는다.

## 1. Preflight

```bash
git rev-parse --abbrev-ref HEAD
git rev-parse --short HEAD

pnpm --dir apps/api stress:local:preflight

pnpm infra:compose -- api-stress config >/tmp/knu-api-compose.yml
pnpm infra:compose -- observability-rehearsal config >/tmp/knu-observability-compose.yml
```

Pass 기준:

- compose config command가 성공한다.
- Docker engine이 2 CPU / 4096MiB(기본 허용 오차 ±256MiB)다.
- `/tmp/*compose.yml`에는 실제 secret을 공유하지 않는다.
- `infra/deploy/.env.api`와 `infra/observability/.env.observability`는 git ignored 상태다.

## 2. API/nginx up

```bash
pnpm infra:compose -- api-stress up -d api nginx
```

Pass 기준:

```bash
pnpm infra:compose -- api-stress ps api nginx
curl -fsS http://127.0.0.1:8080/health
curl -fsS http://127.0.0.1:8080/health/ready
```

- API container state가 healthy다.
- `/health`, `/health/ready`가 HTTP 2xx를 반환한다.
- `/health`, `/health/live` 응답은 `status`, `timestamp`, `uptimeSeconds`만 포함하는 bounded liveness
  schema다.
- `/health/ready` 응답은 `status`, `failureCodes`만 포함하며 정상 상태에서는
  `{"status":"ok","failureCodes":[]}`다.
- public health 응답에는 check 상세, secret source/origin, mount path, raw provider/DB error가 없어야 한다.

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
API_METRICS_TARGET=api:4000 \
  pnpm infra:compose -- observability-rehearsal up -d
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

## 7. Stress 실행 연결

Local smoke는 `docs/runbooks/observability/api-stress-release-runbook.md`를 따른다.

권장 최소 연결 확인:

```bash
pnpm --dir apps/api stress:docker:smoke
```

Auth password capacity를 4GB/2CPU 관측 포함 조건에서 검증할 때는 전용 runner를 사용한다.

```bash
STRESS_LOCAL_REHEARSAL_PROFILES=h1,h2,h3,h7,h4,h5,h6,h9 \
  pnpm --dir apps/api stress:local:auth-password
```

전체 절차와 H8 soak opt-in은 `docs/runbooks/observability/auth-password-capacity-rehearsal-runbook.md`를 따른다.

새 237명 ramp evidence는 `.artifacts/tools/stress/api-237-ramp-decision-result-*.md`에
생성한다. 과거 개인 실행 결과는 repository source of truth가 아니며 재검증이 필요하면 같은
runner로 다시 생성한다. 후속 최적화 추적은 #281 `MATCH_SCORE` read path를 기준으로 한다.

이 rehearsal은 local constrained resource와 stress infra 연결성을 확인한다. 외부 app host, managed PostgreSQL, production target stress, Redis/ElastiCache 도입 결정은 별도 계획과 승인된 환경에서 다룬다.

## 8. Rollback / silence / cleanup

Alert delivery를 멈출 때:

```bash
# local env에서 delivery disabled로 변경
# SLACK_ALERTMANAGER_ENABLED=false

pnpm infra:compose -- observability-rehearsal up -d --force-recreate alertmanager
```

Stack stop:

```bash
pnpm infra:compose -- observability-rehearsal down
pnpm infra:compose -- api-stress down
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
