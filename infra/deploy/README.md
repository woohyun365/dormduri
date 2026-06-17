# API production deploy compose

`infra/deploy`는 Web/Next.js를 제외한 **BE API + nginx** production-like 배포 단위를 정의한다. Local 개발 DB는 root `docker-compose.dev.yml`이 담당하고, 이 compose는 RDS/Managed PostgreSQL endpoint를 env로 받아 실행한다.

## 구조

```txt
infra/deploy/
  docker-compose.api.yml                  # api + nginx base compose
  docker-compose.api.override.example.yml # resource/observability network override 예시
  .env.api.example                        # private .env.api 작성용 템플릿
  api/
    Dockerfile
    entrypoint.sh
    healthcheck.sh
  nginx/
    nginx.conf
    conf.d/api.conf
    snippets/internal-metrics-allowlist.conf
    snippets/proxy-common.conf
```

Secrets Manager materialization 절차는 sibling 문서 `infra/aws/secrets-manager-checklist.md`가 소유한다. SES sender identity/DKIM/sandbox/production access 준비는 `infra/aws/ses-setup-checklist.md`가 소유한다.

## 사전 조건

- Node runtime baseline: `node >=24 <25`
- Package manager baseline: `pnpm@10.34.3`
- Docker build context는 repo root다. API가 `@repo/shared` workspace package와 Prisma generated client를 필요로 하기 때문이다.
- Docker image build는 DB에 접속해 `prisma generate --sql`을 실행하지 않는다. Release workspace에서 `apps/api/src/generated/prisma`가 최신인지 먼저 확인한다.
- `DATABASE_URL`, `DIRECT_URL`, retention 전용 DB URL, cursor/HMAC secret, `LOG_HASH_SECRET`, `METRICS_BEARER_TOKEN`, `EMAIL_PROVIDER`, `SES_*`, `SECRET_SOURCE`, `SECRET_NAME_PREFIX`, `HTTP_*` 값은 private `.env.api` 또는 AWS Secrets Manager materialization 경로로만 주입한다.
- Production DB migration/db push는 container startup에서 자동 실행하지 않는다. 운영 migration은 별도 절차에서 수행한다.

## Env file

```bash
cp infra/deploy/.env.api.example infra/deploy/.env.api
$EDITOR infra/deploy/.env.api
```

필수 값:

- `DATABASE_URL`
- `DIRECT_URL`
- `MIGRATION_DATABASE_URL`
- `RETENTION_WORKER_DATABASE_URL`
- `RETENTION_DISCLOSURE_DATABASE_URL`
- `LOG_HASH_SECRET`
- `METRICS_BEARER_TOKEN`
- `VERIFICATION_CODE_HMAC_SECRET`
- `ROOMMATE_SEARCH_CURSOR_HMAC_SECRET`
- `PROFILE_DETAIL_ENTRY_TOKEN_HMAC_SECRET`
- `CHAT_THREAD_LIST_CURSOR_HMAC_SECRET`
- `EMAIL_PROVIDER` (`production`에서는 `ses`)
- `SES_REGION`
- `SES_FROM_EMAIL`
- `SECRET_SOURCE`
- `SECRET_NAME_PREFIX` (`SECRET_SOURCE=aws-secrets-manager` production 경로에서 필수)
- `HTTP_TRUST_PROXY`

`.env.api`는 커밋하지 않는다. `.env.api.example`의 `REPLACE_ME`/`REPLACE_WITH_*` 값으로 실제 운영을 실행하지 않는다. `SECRET_SOURCE=env`는 private env 직접 주입 경로이고, `SECRET_SOURCE=aws-secrets-manager`는 `/knu-roommate/<environment>/api/<ENV_KEY>` 형태의 Secrets Manager 값을 배포 시점에 env key로 materialize하는 경로다. Secret 생성/검증 절차와 값 미출력 inventory dry-run은 `infra/aws/secrets-manager-checklist.md`를 따른다. `EMAIL_PROVIDER=ses`는 production provider 선택값이며, 실제 사용자 발송 전에는 `infra/aws/ses-setup-checklist.md`의 verified sender identity, DKIM, sandbox 해제 기준을 release gate로 확인한다.

## 2GB 최소형 실행

2GB instance에서는 API/nginx만 먼저 실행하고, Prometheus/Grafana/Loki/Alloy는 local 또는 별도 ops host에서 본다.

```bash
# Generated Prisma client/TypedSQL artifact가 없거나 schema/sql 변경 이후라면 먼저 갱신한다.
pnpm --dir apps/api prisma:generate

docker compose -f infra/deploy/docker-compose.api.yml config
docker compose -f infra/deploy/docker-compose.api.yml build api
docker compose -f infra/deploy/docker-compose.api.yml up -d
```

기본 nginx bind는 local smoke용 `127.0.0.1:8080`이다. nginx/LB 뒤에서 API를 실행하는 production-like 경로는 `HTTP_TRUST_PROXY=true`로 Express trust proxy를 명시한다. Public ingress가 필요하면 명시적으로 `NGINX_HTTP_BIND=0.0.0.0 NGINX_HTTP_PORT=80`을 설정하거나 별도 private override를 작성한다.

```bash
curl -fsS http://127.0.0.1:8080/health
curl -fsS http://127.0.0.1:8080/health/ready
```

## 4GB 관측 포함형 실행

관측 stack과 같은 host에서 rehearsal할 때는 app compose와 observability compose가 같은 external network를 공유한다. 전체 점검 순서는 `infra/observability/rehearsal-checklist.md`를 기준으로 실행한다.

```bash
docker network create knu-roommate-observability || true

# API/nginx
docker compose \
  -f infra/deploy/docker-compose.api.yml \
  -f infra/deploy/docker-compose.api.override.example.yml \
  up -d

# Observability stack
cd infra/observability
API_METRICS_TARGET=api:4000 \
docker compose --env-file .env.observability -f docker-compose.observability.yml up -d
```

Prometheus target은 `api:4000`, metrics path는 `/internal/metrics`를 사용한다. API metrics endpoint는 nginx allowlist와 API bearer token guard를 함께 둔다.

## nginx route boundary

nginx는 다음 path만 API upstream으로 넘긴다.

- `/api/*`
- `/auth/*`
- `/socket.io/*`
- `/health`
- `/health/ready`
- `/internal/metrics`는 private allowlist + `Authorization` header forwarding만 허용

`/internal/metrics`를 public internet에 직접 열지 않는다. allowlist는 `nginx/snippets/internal-metrics-allowlist.conf`에서 private/VPN/observability subnet만 추가한다.

## Logs / rollback / cleanup

```bash
docker compose -f infra/deploy/docker-compose.api.yml ps
docker compose -f infra/deploy/docker-compose.api.yml logs -f api
docker compose -f infra/deploy/docker-compose.api.yml logs -f nginx
```

Rollback은 이전 image tag로 `API_IMAGE_TAG`를 되돌리고 `up -d`를 다시 수행한다.

```bash
API_IMAGE_TAG=previous-safe-tag \
docker compose -f infra/deploy/docker-compose.api.yml up -d api
```

정리:

```bash
docker compose -f infra/deploy/docker-compose.api.yml down
```

## 안전 경계

- Compose에 production Postgres service를 정의하지 않는다.
- API image에 `.env`, `.omx`, stress `.tmp-*`, observability local secret을 넣지 않는다.
- Entry point와 secret materializer는 필수 env/secret 이름만 출력하고 값은 출력하지 않는다.
- Slack/Alertmanager delivery secret과 receiver 설정은 `infra/observability`가 소유한다. `infra/deploy`는 API/nginx와 metrics endpoint를 제공하고, 전체 점검은 `infra/observability/rehearsal-checklist.md`를 따른다.
