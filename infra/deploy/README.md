# API container local rehearsal

`infra/deploy`는 API와 nginx의 **local container rehearsal 및 runtime candidate**를 소유한다. 이 디렉터리는 production hosting target, image registry, 원격 rollout, environment approval, rollback automation을 제공하지 않는다. 향후 배포 자동화는 실제 runtime 입력을 확정한 뒤 `docs/development/future-production-deployment-inputs.md`를 기준으로 별도 설계한다.

## 유지하는 자산

```txt
infra/deploy/
  docker-compose.api.yml                  # API + nginx local runtime candidate
  docker-compose.api.override.example.yml # 4GB/2CPU rehearsal resource/network override
  .env.api.example                        # private local env 작성용 key inventory
  api/
    Dockerfile                            # non-root production build candidate
    entrypoint.sh                         # required env fail-fast; migration 미실행
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

필수 key inventory에는 다음 범주가 포함된다.

- runtime/migration/retention DB URL
- `LOG_HASH_SECRET`, `METRICS_BEARER_TOKEN`
- verification, auth persistence, mail envelope, cursor/token HMAC secret
- email provider configuration
- trust proxy, REST CORS, realtime origin configuration

`.env.api`는 커밋하지 않는다. `.env.api.example`의 placeholder로 실제 서비스를 실행하지 않으며 entrypoint와 smoke output에 secret value를 출력하지 않는다.

## Compose와 image 검증

```bash
docker compose -f infra/deploy/docker-compose.api.yml config
docker compose -f infra/deploy/docker-compose.api.yml build api
docker compose -f infra/deploy/docker-compose.api.yml up -d
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
docker network create knu-roommate-observability || true

docker compose \
  -f infra/deploy/docker-compose.api.yml \
  -f infra/deploy/docker-compose.api.override.example.yml \
  config

cd infra/observability
API_METRICS_TARGET=api:4000 \
docker compose \
  --env-file .env.observability \
  -f docker-compose.observability.yml \
  -f docker-compose.observability.rehearsal.yml \
  config
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
docker compose -f infra/deploy/docker-compose.api.yml ps
docker compose -f infra/deploy/docker-compose.api.yml logs api nginx
docker compose -f infra/deploy/docker-compose.api.yml down
```

## 관련 문서

- `infra/runbooks/production-release-checklist.md`: 실제 target이 결정된 뒤 채울 readiness input
- `infra/runbooks/incident-rollback.md`: provider-neutral rollback/restore 의사결정 기준
- `infra/runbooks/backup-restore-drill.md`: Backup/restore evidence
- `infra/observability/rehearsal-checklist.md`: local 관측 stack rehearsal
- `docs/policies/production-deployment-readiness.md`: 지속되는 runtime/release safety 정책
- `docs/development/future-production-deployment-inputs.md`: 향후 CD 구현 전 결정해야 할 입력
