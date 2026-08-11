# API container local rehearsal

`infra/deploy`는 현재 API와 nginx의 **local container rehearsal 및 runtime candidate**를 소유한다. 이 디렉터리는 production hosting target, image registry, 원격 rollout, environment approval, rollback automation을 제공하지 않는다. 향후 배포 자동화는 실제 runtime 입력을 확정한 뒤 `docs/development/future-production-deployment-inputs.md`를 기준으로 별도 설계한다.

## 미래 User App / BackOffice 배포 구조

BackOffice 출시 시 사용자 제품과 운영자 제품을 별도 host와 deployable로 분리한다. 현재 구현되지
않은 디렉터리를 미리 만들지 않고 BackOffice 기능 구현과 함께 다음 목표 구조로 caller를
마이그레이션한다.

```text
apps/
├── web/                 # 사용자 Next.js
├── api/                 # 사용자 NestJS
├── backoffice-web/      # 운영자 Next.js
└── backoffice-api/      # 운영자 NestJS

infra/deploy/
├── user/
│   ├── compose.yml
│   └── ...
└── backoffice/
    ├── compose.yml
    └── ...
```

결정된 planning topology는 User App 4GiB host + BackOffice 2GiB host + managed PostgreSQL이다.
두 host는 image, env/secret, deploy principal, ingress, readiness와 rollback을 독립적으로
소유한다. Database migration은 release pipeline의 단일 owner만 실행한다. 상세 handoff는
[`infra/runbooks/release/components/backoffice-deployment-readiness.md`](../runbooks/release/components/backoffice-deployment-readiness.md)를
따른다.

## 유지하는 자산

```txt
infra/deploy/
  compose.api.yml        # API + nginx production-neutral runtime candidate
  .env.api.example       # API runtime env template
  .env.api.migration.example # deploy-time DB credential template
  .env.compose.example   # Compose interpolation template
  api/
    Dockerfile                            # non-root production build candidate
    env.manifest.json                     # API registry에서 생성한 value-free projection
    entrypoint.sh                         # manifest runtime requirement fail-fast; migration 미실행
    healthcheck.sh                        # container health probe
  nginx/
    nginx.conf
    conf.d/api.conf                       # local/proxy HTTP route boundary
    examples/api.tls.conf                 # 선택 가능한 TLS 구성 참고
    snippets/internal-metrics-allowlist.conf
    snippets/proxy-common.conf
  scripts/api-release-smoke.sh            # health/readiness/metrics smoke와 dry-run
```

Local 개발 DB는 root `docker-compose.dev.yml`이 담당한다. API rehearsal compose는 PostgreSQL을 소유하지 않고 외부 DB URL을 주입받는다.

## 제공하지 않는 기능

- production image publish와 registry lifecycle
- production host 접속 또는 원격 command transport
- provider/instance/network topology
- environment approval과 deployment credential
- traffic 전환 및 automated rollback
- Web/BackOffice production deploy

이 책임을 미리 가정한 workflow나 provider별 명령은 두지 않는다.

## 사전 조건

- Node `>=24 <25`
- `pnpm@11.7.0`
- Docker build context는 repository root
- `apps/api/src/generated/prisma`가 최신인 상태
- private env file의 실제 DB URL과 secret

Container startup은 `prisma migrate`, role grant, `prisma db push`를 실행하지 않는다. Database migration과 grant는 runtime 시작보다 앞선 별도 operator 경계다.

## Local env 준비

```bash
cp infra/deploy/.env.api.example infra/deploy/.env.api
$EDITOR infra/deploy/.env.api
```

`.env.api`에는 container runtime key만 둔다. Migration과 role grant는
`.env.api.migration.example`을 참고해 별도 operator 환경에 주입한다. Image tag와 nginx bind 같은
Compose interpolation은 `.env.compose.example`을 참고해 shell 또는 명시적 `--env-file` 경계에서
주입하며 API process env로 전달하지 않는다.

Runtime key inventory에는 다음 범주가 포함된다.

- runtime/retention DB URL
- `LOG_HASH_SECRET`, `METRICS_BEARER_TOKEN`
- verification, auth persistence, mail envelope, cursor/token HMAC secret
- email provider configuration
- trust proxy, REST CORS, realtime origin configuration

`.env.api`는 커밋하지 않는다. `.env.api.example`의 placeholder로 실제 서비스를 실행하지 않으며 entrypoint와 smoke output에 secret value를 출력하지 않는다.

API registry와 생성 manifest의 정합성은 다음 명령으로 유지한다.

```bash
pnpm infra:env:generate # registry 변경 후 manifest 갱신
pnpm infra:env:check    # manifest, runtime/migration template, projection 검증
```

`HTTP_TRUST_PROXY_*`, REST/realtime origin처럼 target topology에 따라 달라지는 key는 manifest의
`targetRequired` projection으로 공개하지만 local 기본값을 production 결정으로 간주하지 않는다.

Web image는 공개 가능한 `NEXT_PUBLIC_*`만 build arg로 고정한다. Server runtime에는 같은 값을
관성적으로 반복 주입하지 않고 `WEB_APP_URL`, `API_URL`, `WEB_OBSERVABILITY_ENVIRONMENT`,
`WEB_RELEASE`, BFF logging 설정만 전달한다. `SENTRY_AUTH_TOKEN`은 image layer나 build arg가 아닌
BuildKit secret mount에서만 source map upload 과정에 일시적으로 노출한다.

## Compose와 image 검증

```bash
pnpm infra:compose -- api-base config
pnpm infra:compose -- api-base build api
pnpm infra:compose -- api-base up -d
```

기본 nginx bind는 local smoke용 `127.0.0.1:8080`이다. 외부 공개 bind, canonical host, TLS termination은 이 base compose가 결정하지 않는다.

## Health와 release smoke

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

Failure body와 log에는 secret, DB URL, raw provider error, stack trace를 노출하지 않는다.

## Database rehearsal boundary

Container startup 밖에서 다음 명령을 검증한다.

```bash
pnpm api:db:restore-drill:smoke -- --dry-run
MIGRATION_DATABASE_URL='postgresql://...' pnpm api:db:deploy:migrate
MIGRATION_DATABASE_URL='postgresql://...' pnpm api:db:deploy:role-grants
MIGRATION_DATABASE_URL='postgresql://...' \
DATABASE_URL='postgresql://...' \
RETENTION_WORKER_DATABASE_URL='postgresql://...' \
RETENTION_DISCLOSURE_DATABASE_URL='postgresql://...' \
  pnpm api:db:deploy:smoke
```

Backup/restore drill은 `infra/runbooks/backup-restore-drill.md`와 `.github/workflows/api-restore-drill-manual.yml`이 소유한다. Restore workflow는 DB resource를 생성하지 않으며 운영자가 준비한 temporary restored DB에 대한 credential smoke만 수행한다.

## 4GB/2CPU observability rehearsal

API/nginx와 관측 stack을 동일한 local Docker engine에서 검증할 때 resource override와 shared network를 사용한다.

```bash
pnpm --dir apps/api stress:local:preflight
pnpm infra:compose -- api-rehearsal config
API_METRICS_TARGET=api:4000 pnpm infra:compose -- observability-rehearsal config
```

실행·관측 순서는 `infra/observability/rehearsal-checklist.md`를 따른다. Dockerized API smoke는 `pnpm --dir apps/api stress:docker:smoke`, auth password capacity rehearsal은 `pnpm --dir apps/api stress:local:auth-password`를 사용한다.

## Ingress와 runtime invariant

nginx는 다음 route만 API upstream으로 전달한다.

- `/api/*`
- `/auth/*`
- `/socket.io/*`
- `/health`, `/health/live`, `/health/ready`
- private allowlist와 bearer guard를 모두 통과한 `/internal/metrics`

REST CORS는 explicit allowlist만 허용하며 realtime origin은 별도 policy가 소유한다. Base compose에 placeholder TLS certificate path를 mount하지 않는다. API image는 non-root user로 실행하고 `.env`, `.omx`, local stress/observability secret surface를 포함하지 않는다.

## Logs와 local cleanup

```bash
pnpm infra:compose -- api-base ps
pnpm infra:compose -- api-base logs api nginx
pnpm infra:compose -- api-base down
```

## 관련 문서

- `infra/runbooks/release/production-release-readiness.md`: 미래 release의 단일 준비 진입점
- `infra/runbooks/release/production-release-evidence.md`: component evidence 집계와 최종 판정 owner
- `infra/runbooks/release/components/infrastructure-target-release-readiness.md`: hosting, registry, ingress, 관측 backup 입력
- `infra/runbooks/release/components/backoffice-deployment-readiness.md`: 미래 BackOffice 분리 host, deploy, DB, 관측 경계
- `infra/runbooks/incident-rollback.md`: provider-neutral rollback/restore 의사결정 기준
- `infra/runbooks/backup-restore-drill.md`: Backup/restore evidence
- `infra/observability/rehearsal-checklist.md`: local 관측 stack rehearsal
- `docs/policies/production-runtime-safety.md`: 지속되는 runtime/release safety 정책
- `docs/architecture/platform/production-runtime-topology.md`: User/BackOffice runtime 배치 결정
- `docs/development/future-production-deployment-inputs.md`: 향후 CD 구현 전 결정해야 할 입력
