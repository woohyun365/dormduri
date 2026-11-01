# API stress release report

> 이 템플릿은 safe parser 결과와 dashboard readout만 기록한다. Raw access token, refresh token, realtime ticket, cookie, Authorization header, raw email/password, request/response payload는 기록하지 않는다.

## 1. Run metadata

| Field                 | Value                                             |
| --------------------- | ------------------------------------------------- |
| Date / timezone       | YYYY-MM-DD HH:mm KST                              |
| Operator              |                                                   |
| Git branch            |                                                   |
| Git commit            |                                                   |
| Target class          | local / staging / approved runner                 |
| Target host class     | localhost / private staging / other approved host |
| API version / image   |                                                   |
| Database target class | local / staging                                   |

## 2. Tool versions

| Tool              | Version |
| ----------------- | ------- |
| Node              |         |
| pnpm              |         |
| k6                |         |
| Artillery         |         |
| Docker / OrbStack |         |

## 3. Safety checklist

| Check                                                           | Result      | Note |
| --------------------------------------------------------------- | ----------- | ---- |
| `STRESS_TARGET_URL` reviewed                                    | pass / fail |      |
| `STRESS_ALLOWED_HOSTS` set for staging                          | pass / n/a  |      |
| Production DB fixture mutation avoided                          | pass / fail |      |
| Raw `.tmp-*` artifact excluded from git                         | pass / fail |      |
| Raw token/ticket/cookie/password/email omitted from this report | pass / fail |      |
| Fixture reset completed                                         | pass / fail |      |

## 4. Fixture summary

| Field               | Value    |
| ------------------- | -------- |
| Fixture marker      |          |
| Actor count         |          |
| Token actor count   |          |
| Cohort label / size |          |
| Write mix enabled   | yes / no |
| Cleanup evidence    |          |

## 5. Command results

| Command                          | Status                    | Safe result artifact | Notes                                    |
| -------------------------------- | ------------------------- | -------------------- | ---------------------------------------- |
| `stress:fixture:plan`            | pass / fail / skipped     |                      |                                          |
| `stress:fixture:seed`            | pass / fail / skipped     |                      |                                          |
| `stress:fixture:tokens`          | pass / fail / skipped     |                      |                                          |
| `stress:http:baseline`           | pass / fail / skipped     |                      |                                          |
| `stress:http:peak`               | pass / fail / skipped     |                      |                                          |
| `stress:http:spike`              | pass / fail / skipped     |                      |                                          |
| `stress:http:soak`               | pass / fail / skipped     |                      |                                          |
| `stress:http:score-cohort`       | pass / fail / skipped     |                      |                                          |
| `stress:realtime:smoke`          | pass / fail / skipped     |                      |                                          |
| realtime baseline/peak readiness | ready / blocked / skipped |                      | one-time ticket per VU strategy required |
| `stress:fixture:reset`           | pass / fail / skipped     |                      |                                          |

## 6. k6 safe parser summary

| Scenario         | Status | Duration | p95 | p99 | Error rate | Check rate | Failed thresholds |
| ---------------- | ------ | -------- | --- | --- | ---------- | ---------- | ----------------- |
| smoke            |        |          |     |     |            |            |                   |
| baseline-250     |        |          |     |     |            |            |                   |
| peak-500         |        |          |     |     |            |            |                   |
| spike-500        |        |          |     |     |            |            |                   |
| soak-250         |        |          |     |     |            |            |                   |
| score-cohort-946 |        |          |     |     |            |            |                   |

## 7. Artillery safe parser summary

| Scenario     | Status            | VUsers created | VUsers failed | Socket response p95 | Subscribe ack p95 | Failed reasons                           |
| ------------ | ----------------- | -------------- | ------------- | ------------------- | ----------------- | ---------------------------------------- |
| smoke        |                   |                |               |                     |                   |                                          |
| baseline-250 | blocked / skipped |                |               |                     |                   | one-time ticket per VU strategy required |
| peak-500     | blocked / skipped |                |               |                     |                   | one-time ticket per VU strategy required |

## 8. Observability readout

| Area                                                  | Result            | Evidence |
| ----------------------------------------------------- | ----------------- | -------- |
| Prometheus `api` target UP                            | pass / fail       |          |
| Grafana `돔두리 API Overview` reviewed                | pass / fail       |          |
| Grafana `돔두리 API Realtime/Auth/Retention` reviewed | pass / fail       |          |
| HTTP 5xx budget                                       | pass / fail       |          |
| HTTP latency budget                                   | pass / fail       |          |
| Prisma pool waiting                                   | pass / fail       |          |
| Realtime outbox lag                                   | pass / fail / n/a |          |
| Auth cleanup target saturation / failure              | pass / fail / n/a |          |
| Retention backlog                                     | pass / fail / n/a |          |
| Loki error query reviewed                             | pass / fail / n/a |          |

## 9. Decision

- Release gate decision: pass / fail / conditional
- ## Known risks:
- ## Follow-up issues:
- ## Rollback / cleanup note:
