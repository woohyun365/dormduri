# Dockerized API stress evidence

`apps/api/test/stress/docker`는 local Docker에서 API/nginx를 실제로 띄운 뒤 인증 fixture 기반 HTTP/search/write/realtime stress evidence를 safe report로 남기는 runner를 제공한다. Production target은 사용하지 않고, raw token/ticket/DB URL/secret은 report에 기록하지 않는다.

## Runner

| Script                                                     | 용도                                                                                                                                                | 기본 report                                                      |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `pnpm --dir apps/api stress:docker:smoke`                  | 짧은 local smoke로 API/nginx compose, fixture, k6, Artillery wiring을 검증                                                                          | `.artifacts/tools/stress/api-dockerized-stress-result-*.md`      |
| `pnpm --dir apps/api stress:docker:production-like`        | nginx + API container + local Postgres container + observability stack을 production-like rehearsal topology로 올리고 237/946 cohort evidence를 수집 | `.artifacts/tools/stress/api-production-like-stress-result-*.md` |
| `pnpm --dir apps/api stress:docker:237-ramp`               | 237명 cohort 기준 VU `25 → 50 → 100 → 237` ramp를 단계별로 실행하고 #247 cache 도입 여부 1차 판단 report를 남김                                     | `.artifacts/tools/stress/api-237-ramp-decision-result-*.md`      |
| `pnpm --dir apps/api stress:docker:auth-password-capacity` | 19MiB Argon2id login/signup/reset/change endpoint mix를 H1~H9 중 하나로 실행                                                                        | `.artifacts/tools/stress/api-auth-password-capacity-result-*.md` |
| `pnpm --dir apps/api stress:local:auth-password`           | 2CPU/4096MiB Docker engine을 강제하고 resource-limited 관측 stack과 H1~H9 profile을 순차 실행                                                       | `.artifacts/tools/stress/api-auth-password-capacity-result-*.md` |

## 공통 실행 대상

- local Docker API/nginx: `http://127.0.0.1:8080`
- local Postgres dev container: root `docker-compose.dev.yml`
- private API env: `infra/deploy/.env.api` (없으면 local rehearsal용 값으로 자동 생성, 커밋 금지)
- raw artifacts: `apps/api/test/stress/reports/.tmp-*` (실행 후 제거)
- API image 로컬 label: runner가 모든 profile 뒤에 `compose.local-labels.yml`을 붙여 `dormduri.local.created-by`·
  `dormduri.local.run-id`를 둔다. Project 이름이 고정이라 volume에는 label을 두지 않는다. 남은 image·volume 확인과
  정리는 `infra/runbooks/rehearsal/local-environments.md`를 따른다.

## Smoke 실행

```bash
pnpm --dir apps/api stress:docker:smoke
```

기본 smoke runner는 다음을 순서대로 실행한다.

1. dev Postgres up
2. Prisma generate / local stress DB push (`--accept-data-loss`; production fixture mutation은 guard가 거부)
3. API/nginx compose config / build / up
4. nginx health/readiness 확인
5. `/internal/metrics` unauthorized/authorized boundary 확인
6. `docker-smoke` fixture seed/token 생성
7. k6 smoke, authenticated baseline, real/dummy login capacity, score cohort smoke
8. 낮은 VU/짧은 duration의 bounded write mix smoke
9. Artillery realtime smoke
10. fixture reset, API compose down, raw `.tmp-*` artifact 제거
11. sanitized report 작성

## Production-like rehearsal 실행

```bash
pnpm --dir apps/api stress:docker:production-like
```

Production-like runner는 smoke runner와 같은 안전 경계를 유지하면서 다음을 추가한다.

- `infra/rehearsal/compose.api.runtime.yml`로 API/nginx resource/network를 적용한다.
- `apps/api/test/stress/docker/compose.stress.yml`로 high throttle과 stress-only proxy 값을 주입한다.
- `infra/observability/compose.base.yml`을 함께 올리고 Prometheus API target readout을 report에 남긴다.
- 기본 fixture는 `largestCohortSize=237`, `stressCohortSize=946`, `tokenActorLimit=25`다.
- login capacity는 실제 fixture 계정과 미존재 계정 dummy verify를 1:1로 섞고 기본 10 VU에서 시작한다.
- k6 기본 duration/VU는 smoke보다 크지만 local machine 보호를 위해 staging peak보다 낮게 시작한다.
- Postgres connection/lock/table-size snapshot과 marker residue query를 report에 남긴다.

필요하면 다음 env로 local machine에 맞게 낮춰서 리허설할 수 있다.

```bash
STRESS_COHORT_SIZE=237 \
STRESS_LARGEST_COHORT_SIZE=237 \
STRESS_BASELINE_VUS=10 \
STRESS_BASELINE_DURATION=30s \
STRESS_SCORE_COHORT_VUS=10 \
STRESS_SCORE_COHORT_DURATION=30s \
pnpm --dir apps/api stress:docker:production-like
```

`STRESS_DOCKER_OBSERVABILITY=false`를 주면 observability stack 없이 API/nginx/Postgres readout만 수집한다. `STRESS_DOCKER_KEEP_UP=true`를 주면 실행 후 compose를 내리지 않는다.

## 237 cohort ramp decision 실행

```bash
pnpm --dir apps/api stress:docker:237-ramp
```

237 ramp runner는 production-like runner를 단계별로 감싸서 다음을 실행한다.

1. 237명 fixture / largest cohort 237 / token actor 50으로 seed와 token artifact를 생성한다.
2. VU `25 → 50 → 100 → 237` 순서로 `smoke → authenticated baseline → score-cohort`를 실행한다.
3. 각 단계마다 별도 report `.artifacts/tools/stress/api-237-ramp-decision-vu*.md`를 남기고, 최종 누적 decision report를 `.artifacts/tools/stress/api-237-ramp-decision-result-*.md`에 쓴다.
4. `score p95 >= 300ms` 또는 `score p99 >= 1500ms`가 반복되면 #247 `MATCH_SCORE` bounded cache 승격 후보로 기록한다.
5. runner 실패, `http_req_failed > 1%`, `checks < 98%`, `p95 >= 500ms`이면 다음 VU 단계로 올리지 않고 stop gate를 report에 남긴다.

기본값은 read/score decision에 집중하기 위해 bounded write mix와 realtime smoke를 건너뛴다. 안정성이 확인된 뒤에만 아래 env를 명시한다.

```bash
STRESS_237_RAMP_ENABLE_WRITE_MIX=true \
STRESS_237_RAMP_ENABLE_REALTIME_SMOKE=true \
pnpm --dir apps/api stress:docker:237-ramp
```

로컬 검증이나 runbook dry-run은 다음처럼 낮출 수 있다.

```bash
STRESS_237_RAMP_PLAN_ONLY=true pnpm --dir apps/api stress:docker:237-ramp

STRESS_237_RAMP_STAGES=25 \
STRESS_237_RAMP_STAGE_DURATION=15s \
STRESS_DOCKER_OBSERVABILITY=false \
pnpm --dir apps/api stress:docker:237-ramp
```

## Auth password capacity 실행

```bash
STRESS_AUTH_CAPACITY_PROFILE=h1 \
pnpm --dir apps/api stress:docker:auth-password-capacity
```

Runner는 production-like compose resource limit을 사용하고 다음 순서를 수행한다.

1. 공통 19MiB actor fixture를 seed한다.
2. login success/failure, signup, reset, change 전용 actor/grant/session pool을 만든다.
3. 선택한 H1~H9 profile 하나를 actual endpoint에 실행한다.
4. operation별 p95/p99/error threshold를 bounded JSON과 Markdown report에 기록한다.
5. auth 전용 single-use row를 먼저 reset한 뒤 공통 marker fixture를 reset하고 raw artifact를 제거한다.

H1~H9는 single-use proof TTL과 evidence 해석을 명확히 하기 위해 **한 invocation에서 한 profile만** 실행한다. 짧은 배선 검증은 `STRESS_AUTH_CAPACITY_RATE`와 `STRESS_AUTH_CAPACITY_DURATION`을 함께 지정한다. 이 override 결과는 production-like capacity 승인 근거가 아니다.

## 4GB/2CPU local constrained rehearsal

Docker engine 자체를 2 CPU / 4096MiB로 제한한 뒤 실행한다.

```bash
pnpm --dir apps/api stress:local:preflight

STRESS_LOCAL_REHEARSAL_PROFILES=h1,h2,h3,h7,h4,h5,h6,h9 \
  pnpm --dir apps/api stress:local:auth-password
```

- API/nginx는 `infra/rehearsal/compose.api.runtime.yml`의 resource/network와 `compose.stress.yml`의 stress-only policy를 사용한다.
- 관측 stack은 `infra/rehearsal/compose.observability.yml`을 추가 적용한다.
- H8은 60분 soak이므로 `STRESS_LOCAL_REHEARSAL_INCLUDE_SOAK=I_UNDERSTAND_60_MINUTES` 없이는 실행하지 않는다.
- Web/BackOffice는 현재 compose에 포함하지 않으며, local PostgreSQL은 managed PostgreSQL 성능을 대표하지 않는다.
- 자세한 준비·판정·cleanup 절차는 `docs/runbooks/observability/auth-password-capacity-rehearsal-runbook.md`가 소유한다.

## 안전 경계

- production target은 사용하지 않는다. staging/production-like public target은 k6/Artillery target guard와 별도 승인 절차를 사용한다.
- report에는 access token, realtime ticket, cookie, email/password, DB URL, webhook을 기록하지 않는다.
- local `.env.api`, `.env.observability`, `prometheus/secrets/*.local`, `.tmp-*` raw artifact는 gitignore 대상이다.
- write mix는 stress fixture actor/target만 사용하고 reset 단계에서 actor/participant 기반 cleanup을 수행한다.
- #247/#250/#256/#272 같은 도입 여부는 local pg container evidence만으로 확정하지 않고, staging/RDS 계측 결과가 있을 때 승격한다.
- Argon2id admission concurrency/queue/timeout 기본값은 local smoke나 local constrained evidence만으로 확정하지 않는다. 외부 app host와 managed PostgreSQL 환경에서 H1~H9 CPU/RSS/latency evidence를 별도로 판독한다.
