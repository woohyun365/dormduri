# Dockerized API stress evidence

`apps/api/test/stress/docker`는 local Docker에서 API/nginx를 실제로 띄운 뒤 인증 fixture 기반 HTTP/search/write/realtime stress evidence를 safe report로 남기는 runner를 제공한다. Production target은 사용하지 않고, raw token/ticket/DB URL/secret은 report에 기록하지 않는다.

## Runner

| Script                                              | 용도                                                                                                                                                | 기본 report                                           |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `pnpm --dir apps/api stress:docker:smoke`           | 짧은 local smoke로 API/nginx compose, fixture, k6, Artillery wiring을 검증                                                                          | `.omx/reports/api-dockerized-stress-result-*.md`      |
| `pnpm --dir apps/api stress:docker:production-like` | nginx + API container + local Postgres container + observability stack을 production-like rehearsal topology로 올리고 237/946 cohort evidence를 수집 | `.omx/reports/api-production-like-stress-result-*.md` |

## 공통 실행 대상

- local Docker API/nginx: `http://127.0.0.1:8080`
- local Postgres dev container: root `docker-compose.dev.yml`
- private API env: `infra/deploy/.env.api` (없으면 local rehearsal용 값으로 자동 생성, 커밋 금지)
- raw artifacts: `apps/api/test/stress/reports/.tmp-*` (실행 후 제거)

## Smoke 실행

```bash
pnpm --dir apps/api stress:docker:smoke
```

기본 smoke runner는 다음을 순서대로 실행한다.

1. dev Postgres up
2. Prisma generate / db push
3. API/nginx compose config / build / up
4. nginx health/readiness 확인
5. `/internal/metrics` unauthorized/authorized boundary 확인
6. `docker-smoke` fixture seed/token 생성
7. k6 smoke, authenticated baseline, score cohort smoke
8. 낮은 VU/짧은 duration의 bounded write mix smoke
9. Artillery realtime smoke
10. fixture reset, API compose down, raw `.tmp-*` artifact 제거
11. sanitized report 작성

## Production-like rehearsal 실행

```bash
pnpm --dir apps/api stress:docker:production-like
```

Production-like runner는 smoke runner와 같은 안전 경계를 유지하면서 다음을 추가한다.

- `infra/deploy/docker-compose.api.override.example.yml`로 API/nginx를 observability network에 붙인다.
- `infra/observability/docker-compose.observability.yml`을 함께 올리고 Prometheus API target readout을 report에 남긴다.
- 기본 fixture는 `largestCohortSize=237`, `stressCohortSize=946`, `tokenActorLimit=25`다.
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

## 안전 경계

- production target은 사용하지 않는다. staging/production-like public target은 k6/Artillery target guard와 별도 승인 절차를 사용한다.
- report에는 access token, realtime ticket, cookie, email/password, DB URL, webhook을 기록하지 않는다.
- local `.env.api`, `.env.observability`, `prometheus/secrets/*.local`, `.tmp-*` raw artifact는 gitignore 대상이다.
- write mix는 stress fixture actor/target만 사용하고 reset 단계에서 actor/participant 기반 cleanup을 수행한다.
- #247/#250/#256/#272 같은 도입 여부는 local pg container evidence만으로 확정하지 않고, staging/RDS 계측 결과가 있을 때 승격한다.
