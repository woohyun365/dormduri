# Runtime container candidates

`infra/deploy`는 API, Web, nginx의 deployable image와 **production-neutral runtime candidate**를
소유한다. Local resource limit, disposable DB, upstream fixture와 관측 network는
`infra/rehearsal/README.md`가 소유하며 이 디렉터리에는 자동 합성하지 않는다.

현재 hosting target, image registry, 원격 rollout, environment approval, rollback automation은
아직 제공하지 않는다. 실제 target 입력은
`infra/runbooks/release/production-release-readiness.md`에서 확인하고 provider별 구현은 target이
결정된 뒤 별도 설계한다.

## 자산과 책임

```text
infra/deploy/
├── compose.api.yml                  # API + nginx runtime candidate
├── .env.api.example                 # API runtime env projection
├── .env.api.migration.example       # deploy-time DB credential projection
├── .env.compose.example             # Compose interpolation projection
├── api/
│   ├── Dockerfile                   # non-root API image
│   ├── env.manifest.json            # API registry에서 생성한 value-free manifest
│   ├── entrypoint.sh                # runtime requirement fail-fast; migration 미실행
│   └── healthcheck.sh               # container health probe
├── web/Dockerfile                   # Next.js standalone image
├── nginx/                           # proxy, route, metrics allowlist, TLS example
└── scripts/api-release-smoke.sh     # health/readiness/metrics smoke와 dry-run
```

`compose.api.yml`은 API와 nginx의 공통 runtime shape만 정의한다. 다음 항목은 다른 owner가 합성한다.

- product container resource budget, network overlay: `infra/rehearsal/`
- disposable PostgreSQL 18: `infra/rehearsal/compose.postgres.yml`
- stress-only throttle: `apps/api/test/stress/docker/compose.stress.yml`
- observability topology: `infra/observability/`
- migration과 role grant: `infra/db/`

## 제공하지 않는 기능

- production image publish와 registry lifecycle
- provider/instance/network provisioning
- production secret 생성 또는 credential rotation
- traffic 전환과 automated rollback
- local fixture, stress policy, disposable DB
- 미래 BackOffice deployable

BackOffice는 구현 시 사용자 제품과 별도 host·deploy principal·ingress·rollback 경계를 갖는다. 현재
목표 topology는
[`infra/runbooks/release/components/backoffice/readiness.md`](../runbooks/release/components/backoffice/readiness.md)에만 유지하고 빈 deploy 디렉터리를 미리 만들지 않는다.

## Runtime environment contract

Container startup은 `prisma migrate`, role grant, `prisma db push`를 실행하지 않는다. API runtime
key는 owner-local env definition을 조합하는
`apps/api/src/config/composition/api-config.registry.ts`가 source of truth이며 다음 명령으로
projection을 유지한다.

```bash
pnpm infra:env:generate
pnpm infra:env:check
```

- `.env.api.example`: runtime/retention DB, auth/mail/HMAC, metrics, origin/proxy key 이름
- `.env.api.migration.example`: one-off migration/admin credential 이름
- `.env.compose.example`: image tag, nginx bind와 같은 Compose interpolation
- `api/env.manifest.json`: 값이 없는 machine-readable required/secret/target projection

`SECRET_SOURCE=env`에서는 entrypoint가 required runtime secret의 존재를 먼저 확인한다.
`SECRET_SOURCE=aws-secrets-manager`에서는 non-secret runtime key와 `SECRET_NAME_PREFIX`만 entrypoint가
확인하고, 애플리케이션 bootstrap이 Nest module import 전에 AWS에서 secret을 materialize한다.

실제 `.env.api`, DB URL, token과 provider secret은 커밋하지 않는다. `HTTP_TRUST_PROXY_*`, REST와
realtime origin처럼 target topology에 의존하는 key는 local 기본값을 production 결정으로 간주하지
않는다.

Web image는 공개 가능한 `NEXT_PUBLIC_*`만 build arg로 고정한다. Server runtime은 `WEB_APP_URL`,
`API_URL`, `WEB_OBSERVABILITY_ENVIRONMENT`, `WEB_RELEASE`와 BFF log 설정을 주입한다.
`SENTRY_AUTH_TOKEN`은 image layer나 build arg가 아니라 BuildKit secret mount로 source map upload
동안에만 제공한다.

## Candidate 검증

```bash
pnpm infra:compose -- api-base config
pnpm infra:compose -- api-base build api
pnpm infra:compose -- api-base up -d
```

기본 nginx bind `127.0.0.1:8080`은 candidate smoke를 위한 안전한 기본값이다. Public bind,
canonical host와 TLS termination은 실제 target owner가 결정한다.

```bash
curl -fsS http://127.0.0.1:8080/health
curl -fsS http://127.0.0.1:8080/health/live
curl -fsS http://127.0.0.1:8080/health/ready

API_BASE_URL='http://127.0.0.1:8080' \
METRICS_BEARER_TOKEN='<local-secret>' \
  infra/deploy/scripts/api-release-smoke.sh

infra/deploy/scripts/api-release-smoke.sh --dry-run
```

- `/health`, `/health/live`: process liveness
- `/health/ready`: DB, runtime config, secret materialization, migration baseline, email provider readiness
- `/internal/metrics`: anonymous request 거부와 bearer-authorized scrape

Failure body와 log에는 secret, DB URL, raw provider error와 stack trace를 노출하지 않는다.

## Runtime invariant

nginx는 다음 route만 API upstream으로 전달한다.

- `/api/*`, `/auth/*`, `/socket.io/*`
- `/health`, `/health/live`, `/health/ready`
- private allowlist와 bearer guard를 통과한 `/internal/metrics`

REST CORS와 realtime origin은 각 explicit allowlist를 사용한다. Base candidate에 placeholder TLS
certificate를 mount하지 않는다. API/Web image는 non-root user로 실행하며 `.env`, `.omx`, local
stress·rehearsal secret surface를 포함하지 않는다.

## Rehearsal과 release 경계

- Compose 합성·local full-stack 검증: [`infra/rehearsal/README.md`](../rehearsal/README.md)
- DB operator script: [`infra/db/README.md`](../db/README.md)
- Observability configuration: [`infra/observability/README.md`](../observability/README.md)
- 실제 release 준비: [`infra/runbooks/release/production-release-readiness.md`](../runbooks/release/production-release-readiness.md)
- 실제 결과 집계: [`infra/runbooks/release/production-release-evidence.md`](../runbooks/release/production-release-evidence.md)
- Runtime safety policy: [`docs/policies/production-runtime-safety.md`](../../docs/policies/production-runtime-safety.md)

Candidate smoke 종료 시에는 다음 명령으로 해당 Compose resource만 정리한다.

```bash
pnpm infra:compose -- api-base down
```
