# API stress release gate runbook

이 문서는 API release 전에 logging, metrics, observability stack, HTTP k6 stress, Realtime Artillery smoke를 **안전하게 검증**하는 운영 절차다. API/nginx compose와 관측 stack을 함께 올리는 전체 rehearsal 순서는 `infra/observability/rehearsal-checklist.md`를 먼저 따른다. Local smoke와 staging/release baseline은 실행 권한과 위험도가 다르므로 같은 명령으로 취급하지 않는다.

## 원칙

- Production DB fixture seed/reset은 금지한다.
- Production-like public target stress는 별도 승인과 allowlist 없이 실행하지 않는다.
- Raw access token, refresh token, realtime ticket, cookie, Authorization header, email/password는 report와 채팅/PR에 남기지 않는다.
- Stress 결과 공유는 `apps/api/test/stress/reports/report-template.md`를 복사해 safe parser 결과와 관측 수치만 채운다.
- k6/Artillery는 API host가 아니라 local 개발 머신, CI runner, 또는 별도 load runner에서 실행한다.

## 1. Preflight checklist

| Check               | Command / 확인 지점                                             | Pass 기준                               |
| ------------------- | --------------------------------------------------------------- | --------------------------------------- |
| branch/commit       | `git rev-parse --abbrev-ref HEAD`, `git rev-parse --short HEAD` | release 후보 commit이 명확하다          |
| daemon              | Docker Desktop 또는 OrbStack 상태                               | observability compose 실행 가능         |
| API health          | `curl -fsS "$STRESS_TARGET_URL/health"`                         | HTTP 2xx                                |
| readiness           | `curl -fsS "$STRESS_TARGET_URL/health/ready"`                   | HTTP 2xx                                |
| target guard        | `STRESS_ENV`, `STRESS_ALLOWED_HOSTS`                            | local/private/staging host만 허용       |
| fixture guard       | `STRESS_FIXTURE_APPLY=I_UNDERSTAND_STAGING_FIXTURE`             | local/staging에서만 사용                |
| k6 CLI              | `k6 version`                                                    | 로컬/runner에 설치됨                    |
| Artillery CLI       | `artillery version`                                             | 로컬/runner에 설치됨                    |
| metrics token       | `METRICS_BEARER_TOKEN`, Prometheus token file                   | 같은 값이고 raw 값은 report에 쓰지 않음 |
| raw artifact policy | `apps/api/test/stress/reports/.tmp-*`                           | git에 포함하지 않음                     |

## 2. Observability stack 준비

```bash
export METRICS_ENABLED=true
export METRICS_BEARER_TOKEN=local-metrics-token-change-me
pnpm --dir apps/api start:dev
```

```bash
cp infra/observability/.env.observability.example infra/observability/.env.observability
cp \
  infra/observability/prometheus/secrets/api-metrics-bearer-token.example \
  infra/observability/prometheus/secrets/api-metrics-bearer-token.local
cd infra/observability
docker compose --env-file .env.observability -f docker-compose.observability.yml config
docker compose --env-file .env.observability -f docker-compose.observability.yml up -d
```

확인:

- Prometheus: `http://127.0.0.1:9090/targets`에서 `api` job `UP`.
- Grafana: `http://127.0.0.1:3001`에서 `KNU API Overview`, `KNU API Realtime/Auth/Retention` 확인.
- Loki: Dockerized API service가 있을 때 Grafana Explore에서 `{service="api"}` query 확인. API가 host process로 실행되면 Loki API log가 없을 수 있으므로 metrics 중심으로 판정한다.

## 3. Local smoke sequence

Local smoke는 release gate를 빠르게 검증하기 위한 작은 부하다. 아래 값은 개발 머신 기준이며, 많은 actor login은 `/api/auth/login` throttle에 걸릴 수 있으므로 token actor 수를 작게 시작한다.

```bash
export STRESS_TARGET_URL=http://127.0.0.1:4000
export STRESS_ENV=local
export STRESS_FIXTURE_APPLY=I_UNDERSTAND_STAGING_FIXTURE

pnpm --dir apps/api stress:fixture:plan
pnpm --dir apps/api stress:fixture:seed

STRESS_TOKEN_ACTOR_LIMIT=3 \
  pnpm --dir apps/api stress:fixture:tokens

STRESS_ACTOR_TOKENS_PATH=test/stress/reports/.tmp-stress-actor-tokens.json \
STRESS_ENABLE_WRITE_MIX=true \
STRESS_BASELINE_DURATION=10s \
STRESS_BASELINE_VUS=1 \
STRESS_SLEEP_SECONDS=0.2 \
  pnpm --dir apps/api stress:http:baseline

STRESS_ACTOR_TOKENS_PATH=test/stress/reports/.tmp-stress-actor-tokens.json \
  pnpm --dir apps/api stress:realtime:smoke

pnpm --dir apps/api stress:fixture:reset
```

Pass 기준:

- k6 command exit code가 0이다.
- k6 safe report에서 `status=passed`, `http_req_failed` budget 내, checks pass rate가 threshold를 만족한다.
- Artillery smoke command exit code가 0이다.
- Artillery safe report에서 `vusers.failed=0`, subscribe/unsubscribe ack가 기록된다.
- reset 이후 marker row가 남지 않는다.

## 4. Staging baseline / peak sequence

Staging baseline은 승인된 private/staging target에서만 실행한다.

```bash
export STRESS_TARGET_URL=https://staging.example.internal
export STRESS_ENV=staging
export STRESS_ALLOWED_HOSTS=staging.example.internal
export STRESS_FIXTURE_APPLY=I_UNDERSTAND_STAGING_FIXTURE

pnpm --dir apps/api stress:fixture:seed
pnpm --dir apps/api stress:fixture:tokens

STRESS_ACTOR_TOKENS_PATH=test/stress/reports/.tmp-stress-actor-tokens.json \
  pnpm --dir apps/api stress:http:baseline

STRESS_ACTOR_TOKENS_PATH=test/stress/reports/.tmp-stress-actor-tokens.json \
  pnpm --dir apps/api stress:http:peak

STRESS_ACTOR_TOKENS_PATH=test/stress/reports/.tmp-stress-actor-tokens.json \
  pnpm --dir apps/api stress:http:spike

STRESS_ACTOR_TOKENS_PATH=test/stress/reports/.tmp-stress-actor-tokens.json \
  pnpm --dir apps/api stress:http:soak

STRESS_ACTOR_TOKENS_PATH=test/stress/reports/.tmp-stress-actor-tokens.json \
  pnpm --dir apps/api stress:http:score-cohort

pnpm --dir apps/api stress:fixture:reset
```

Realtime `baseline-250`과 `peak-500`은 현재 runner가 fail-closed한다. Artillery Socket.IO engine이 flow/payload보다 먼저 handshake를 열기 때문에 one-time ticket을 VU별로 발급/분배하는 전략이 확정되기 전까지는 release gate에서 “대규모 realtime baseline 준비 안 됨”으로 기록한다. Local `stress:realtime:smoke`는 계속 실행해야 한다.

## 5. Stress window 관측 항목

Stress window 동안 다음 dashboard/query를 확인한다.

| Area              | Grafana/Prometheus 확인 항목                      | 위험 신호                            |
| ----------------- | ------------------------------------------------- | ------------------------------------ |
| HTTP availability | `api_http_requests_total`, 5xx rate               | 5xx 증가, timeout 증가               |
| Latency           | `api_http_request_duration_seconds` p95/p99       | read/write p95 budget 초과           |
| Prisma pool       | `api_prisma_pool_connections`, waiting            | waiting connection 지속 증가         |
| Realtime          | connected sockets, realtime rejection, outbox lag | connect 실패, outbox lag 증가        |
| Auth cleanup      | `api_auth_cleanup_lag_seconds`                    | cleanup lag 지속 증가                |
| Retention         | `api_retention_backlog_total`                     | review backlog 지속 증가             |
| Logs              | Loki `{service="api", level="error"}`             | 같은 에러 반복, PII/raw payload 노출 |

Resource 기준:

- 2GB 최소형: API 단독 smoke는 가능하지만 observability stack 동시 실행 여유가 작다.
- 4GB 관측 포함형: API와 Prometheus/Grafana/Loki/Alloy를 같은 host에서 rehearsal하기에 더 안전하다.

## 6. Report 작성

1. `apps/api/test/stress/reports/report-template.md`를 복사한다.
2. commit, target class, tool version, fixture marker, actor count, safe parser 결과, dashboard readout만 채운다.
3. raw token/ticket/cookie/password/email/Authorization 값은 쓰지 않는다.
4. 실패 시 실패한 command, safe parser의 failed threshold, cleanup 여부를 남긴다.

## 7. Cleanup checklist

```bash
STRESS_TARGET_URL=$STRESS_TARGET_URL \
STRESS_FIXTURE_APPLY=I_UNDERSTAND_STAGING_FIXTURE \
  pnpm --dir apps/api stress:fixture:reset

rm -f apps/api/test/stress/reports/.tmp-*
```

```bash
cd infra/observability
docker compose --env-file .env.observability -f docker-compose.observability.yml down
```

최종 확인:

- Fixture marker row가 reset되었다.
- `.tmp-*` raw artifact가 제거되었다.
- Docker observability stack이 필요한 경우에만 남아 있다.
- Report에는 safe metric과 판정만 남아 있다.
