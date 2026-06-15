# Dockerized API stress smoke

`stress:docker:smoke`는 Phase 9 production-like `infra/deploy` API/nginx compose를 로컬에서 실제로 띄운 뒤, 인증 fixture 기반 HTTP/search/write/realtime smoke 결과를 safe report로 남기는 단일 runner다.

## 실행 대상

- local Docker API/nginx: `http://127.0.0.1:8080`
- local Postgres dev container: root `docker-compose.dev.yml`
- private env: `infra/deploy/.env.api` (없으면 local smoke용 값으로 자동 생성, 커밋 금지)
- safe report: `.omx/reports/api-dockerized-stress-result-*.md`

## 실행

```bash
pnpm --dir apps/api stress:docker:smoke
```

기본 runner는 다음을 순서대로 실행한다.

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

## 안전 경계

- production target은 사용하지 않는다. staging/production-like target은 기존 k6/Artillery runner guard와 별도 승인 절차를 사용한다.
- report에는 access token, realtime ticket, cookie, email/password, DB URL, webhook을 기록하지 않는다.
- local `.env.api`와 `.tmp-*` raw artifact는 gitignore 대상이다.
- write mix는 stress fixture actor/target만 사용하고 reset 단계에서 actor/participant 기반 cleanup을 수행한다.
- #247/#250/#256/#272 같은 도입 여부는 local smoke만으로 확정하지 않고, staging/RDS 계측 결과가 있을 때 승격한다.
