# API production deploy compose

`infra/deploy`는 Web/Next.js를 제외한 **BE API + nginx** production-like 배포 단위를 정의한다. Local 개발 DB는 root `docker-compose.dev.yml`이 담당하고, 이 compose는 RDS/Managed PostgreSQL endpoint를 env로 받아 실행한다. Web production deploy는 별도 Docker/ingress/CDN/runbook 설계가 필요한 범위이며, 이 디렉터리는 API ingress와 release smoke만 소유한다.

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
    conf.d/api.conf                  # active local/proxy HTTP server block
    examples/api.tls.conf            # direct nginx TLS termination example; not mounted by default
    snippets/internal-metrics-allowlist.conf
    snippets/proxy-common.conf
```

Secrets Manager materialization 절차는 sibling 문서 `infra/aws/secrets-manager-checklist.md`가 소유한다. SES sender identity/DKIM/sandbox/production access 준비는 `infra/aws/ses-setup-checklist.md`가 소유한다. RDS private network, automated backup/PITR, restore drill 준비는 `infra/aws/rds-setup-checklist.md`와 `infra/runbooks/backup-restore-drill.md`가 소유한다.

## 운영 runbook

- `infra/runbooks/production-release-checklist.md`: BE API + managed PostgreSQL production release의 최종 GO/NO-GO checklist다.
- `infra/runbooks/api-production-deploy-runbook.md`: GitHub Actions와 manual fallback deploy 순서를 설명한다.
- `infra/runbooks/backup-restore-drill.md`: restored DB 기반 backup/restore evidence를 남기는 절차다.
- `infra/runbooks/incident-rollback.md`: app image rollback, DB/PITR restore escalation, readiness/metrics/observability 재확인 절차다.

## 사전 조건

- Node runtime baseline: `node >=24 <25`
- Package manager baseline: `pnpm@11.7.0`
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
- `HTTP_TRUST_PROXY_HOPS`
- `HTTP_TRUST_PROXY_CIDRS`
- `HTTP_CORS_ALLOWED_ORIGINS`
- `HTTP_COOKIE_SECURE`
- `HTTP_COOKIE_SAME_SITE`
- `HTTP_COOKIE_DOMAIN`
- `CHAT_REALTIME_ALLOWED_ORIGINS`
- `CHAT_REALTIME_TRUST_PROXY`

`.env.api`는 커밋하지 않는다. `.env.api.example`의 `REPLACE_ME`/`REPLACE_WITH_*` 값으로 실제 운영을 실행하지 않는다. `SECRET_SOURCE=env`는 private env 직접 주입 경로이고, `SECRET_SOURCE=aws-secrets-manager`는 `/knu-roommate/<environment>/api/<ENV_KEY>` 형태의 Secrets Manager 값을 배포 시점에 env key로 materialize하는 경로다. Secret 생성/검증 절차와 값 미출력 inventory dry-run은 `infra/aws/secrets-manager-checklist.md`를 따른다. `EMAIL_PROVIDER=ses`는 production provider 선택값이며, 실제 사용자 발송 전에는 `infra/aws/ses-setup-checklist.md`의 verified sender identity, DKIM, sandbox 해제 기준을 release gate로 확인한다.

## Production DB deploy preflight

API/nginx container startup은 migration이나 role grant를 자동 실행하지 않는다. App rollout 전에 `infra/db/README.md`의 DB deploy runbook과 backup/restore drill evidence 확인을 먼저 수행한다.

권장 순서:

```bash
# 0. Backup/restore drill evidence 확인
pnpm api:db:restore-drill:smoke -- --dry-run
# 실제 release evidence는 temporary restored DB에서 실행한 smoke 결과여야 한다.
```

```bash
# 1. Prisma migration deploy
MIGRATION_DATABASE_URL='postgresql://...' pnpm api:db:deploy:migrate

# 2. DB role grant apply
MIGRATION_DATABASE_URL='postgresql://...' pnpm api:db:deploy:role-grants

# 3. Runtime/retention/disclosure credential smoke
MIGRATION_DATABASE_URL='postgresql://...' \
DATABASE_URL='postgresql://...' \
RETENTION_WORKER_DATABASE_URL='postgresql://...' \
RETENTION_DISCLOSURE_DATABASE_URL='postgresql://...' \
  pnpm api:db:deploy:smoke
```

이 preflight가 끝난 뒤 API/nginx를 올리고 `/health/ready`를 final deploy gate로 확인한다. Production deploy path에서 `prisma db push`를 사용하지 않는다. 실제 RDS connection string에는 운영 SSL 정책에 맞춰 `sslmode=require` 또는 CA bundle 검증 옵션을 둔다.

## Final release checklist

Production deploy 전에는 `infra/runbooks/production-release-checklist.md`를 채워야 한다. Checklist는 아래 evidence를 하나의 decision record로 묶는다.

- `pnpm check:api`, `pnpm build:api` local-equivalent CI evidence
- `pnpm api:db:deploy:migrate`, `pnpm api:db:deploy:role-grants`, `pnpm api:db:deploy:smoke` DB deploy evidence
- `pnpm api:db:restore-drill:smoke` restore drill evidence
- `infra/deploy/scripts/api-release-smoke.sh` health/readiness/metrics guard evidence
- `pnpm --dir apps/api stress:docker:smoke`, `pnpm --dir apps/api stress:docker:production-like`, `pnpm --dir apps/api stress:docker:237-ramp` observability/stress evidence

Checklist decision이 `NO-GO`면 production workflow를 실행하지 않는다. `GO with follow-up`은 blocker가 아니라 운영 evidence 기반 개선 항목만 남은 경우에만 사용한다.

## GitHub Actions CI/CD

API CI/CD workflow는 두 파일로 분리한다.

- `.github/workflows/api-ci.yml`: PR과 `dev`/`main` push에서 install, shared build, Prisma artifact generation, `pnpm check:api`, `pnpm test:api`, `pnpm build:api`, deploy compose config를 실행한다. 이 workflow는 deploy permission이나 OIDC token permission을 갖지 않는다.
- `.github/workflows/api-deploy-production.yml`: `workflow_dispatch`로만 실행하는 production deploy workflow다. GitHub `production` environment approval과 AWS OIDC role을 기본 경로로 사용하고, 기본 입력값 `dry_run=true`에서는 production resource를 변경하지 않는다. `dry_run=false`에서는 `restore_drill_evidence_id` 입력을 요구한다.
- `.github/workflows/api-restore-drill-manual.yml`: `workflow_dispatch`로만 실행하는 restore drill smoke workflow다. RDS restore 생성은 자동화하지 않고, 운영자가 만든 restored DB credential로 smoke와 secret-free evidence artifact만 생성한다.

Production deploy workflow는 아래 순서를 유지한다.

1. restore drill evidence 확인.
2. install/build/typecheck/lint/test preflight.
3. Docker image build.
4. `pnpm api:db:deploy:migrate`.
5. `pnpm api:db:deploy:role-grants`.
6. `pnpm api:db:deploy:smoke`.
7. `infra/deploy/scripts/api-production-rollout.sh`.
8. `infra/deploy/scripts/api-release-smoke.sh`.
9. release evidence artifact upload.

`infra/deploy/scripts/api-production-rollout.sh`는 `--dry-run`, `DEPLOY_TRANSPORT=ssm`, `DEPLOY_TRANSPORT=local`을 지원한다. 기본 production 후보는 SSM remote command이며, SSH key 또는 long-lived AWS access key를 기본값으로 두지 않는다. `infra/deploy/scripts/api-release-smoke.sh`는 `/health`, `/health/live`, `/health/ready`, `/internal/metrics` anonymous rejection, bearer authorized scrape를 확인하되 token 값을 출력하지 않는다.

GitHub production environment 변수와 OIDC role 준비는 `infra/aws/github-actions-oidc-checklist.md`를 따른다. AWS 계정 비용/승인 안전장치는 `infra/aws/beginner-account-budget-checklist.md`를 따른다. 실제 release 절차와 rollback은 `infra/runbooks/api-production-deploy-runbook.md`를 따르고, backup/restore drill은 `infra/runbooks/backup-restore-drill.md`를 따른다.

## 2GB 최소형 실행

2GB instance에서는 API/nginx만 먼저 실행하고, Prometheus/Grafana/Loki/Alloy는 local 또는 별도 ops host에서 본다.

```bash
# Generated Prisma client/TypedSQL artifact가 없거나 schema/sql 변경 이후라면 먼저 갱신한다.
pnpm --dir apps/api prisma:generate

docker compose -f infra/deploy/docker-compose.api.yml config
docker compose -f infra/deploy/docker-compose.api.yml build api
docker compose -f infra/deploy/docker-compose.api.yml up -d
```

기본 nginx bind는 local smoke용 `127.0.0.1:8080`이다. nginx/LB 뒤에서 API를 실행하는 production-like 경로는 실제 네트워크에 맞춰 `HTTP_TRUST_PROXY_HOPS` 또는 `HTTP_TRUST_PROXY_CIDRS` 중 하나만 설정한다. Direct/local API는 hop `0`으로 forwarding header를 신뢰하지 않는다. Public ingress가 필요하면 명시적으로 `NGINX_HTTP_BIND=0.0.0.0 NGINX_HTTP_PORT=80`을 shell env 또는 `infra/deploy/.env`에 설정하거나 별도 private override를 작성한다. `infra/deploy/.env.api`는 API container env file이며 Docker Compose interpolation source가 아니므로 compose port/tag 값은 shell env 또는 compose project `.env`에 둔다.

```bash
curl -fsS http://127.0.0.1:8080/health
curl -fsS http://127.0.0.1:8080/health/live
curl -fsS http://127.0.0.1:8080/health/ready
```

`/health`와 `/health/live`는 process liveness만 확인한다. `/health/ready`는 DB, runtime config, secret materialization, Prisma migration baseline, email provider 설정을 lightweight/timeout-bound로 확인하며 실패하면 HTTP 503과 check name/code만 포함한 bounded body를 반환한다. Readiness body에는 secret value, DB URL, raw provider error, stack trace를 포함하지 않는다.

## Ingress / CORS / cookie / TLS paths

지원하는 ingress 경로는 세 가지로 구분한다.

1. **Local smoke HTTP**: 기본 `nginx/conf.d/api.conf`와 `127.0.0.1:8080` bind를 사용한다. 이 경로는 local smoke와 Dockerized rehearsal용이다.
2. **Load balancer 뒤 HTTP upstream**: ALB/ELB/외부 reverse proxy가 TLS를 종료하고 nginx는 HTTP upstream으로 동작한다. 이때 실제 hop 수를 `HTTP_TRUST_PROXY_HOPS`로 설정하거나 고정 proxy subnet만 `HTTP_TRUST_PROXY_CIDRS`에 등록하고, public bind/port는 private compose override에서 명시한다.
3. **Direct nginx TLS termination**: nginx가 직접 80→443 redirect와 TLS를 소유한다. `nginx/examples/api.tls.conf`를 private deployment에서 `nginx/conf.d/api.conf`로 복사/parameterize하고 certbot 또는 동등한 ACME client가 만든 인증서 volume을 mount한다. 예시 파일은 base compose의 active `conf.d` mount에 포함되지 않으므로 placeholder cert path가 local smoke를 깨지 않는다.

REST API CORS는 `HTTP_CORS_ALLOWED_ORIGINS`의 comma-separated explicit allowlist가 있을 때만 활성화된다. `*` wildcard, path/query/hash가 붙은 값은 거부된다. 현재 auth/session transport는 JSON response body token + `Authorization` header 기반이므로 REST CORS는 `credentials=false`로 유지한다. Socket.IO/realtime origin policy는 `CHAT_REALTIME_ALLOWED_ORIGINS`, `CHAT_REALTIME_TRUST_PROXY`가 별도로 소유한다.

현재 API는 `Set-Cookie`를 발급하지 않는다. `HTTP_COOKIE_SECURE`, `HTTP_COOKIE_SAME_SITE`, `HTTP_COOKIE_DOMAIN`은 future cookie surface가 사용할 fail-closed policy helper의 입력이다. `SameSite=None`은 `HTTP_COOKIE_SECURE=true` 없이는 허용하지 않는다.

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
- `/health/live`
- `/health/ready`
- `/internal/metrics`는 private allowlist + `Authorization` header forwarding만 허용

TLS example에서도 위 route boundary, WebSocket `Upgrade`/`Connection` forwarding, metrics private allowlist를 유지한다.

`/internal/metrics`를 public internet에 직접 열지 않는다. allowlist는 `nginx/snippets/internal-metrics-allowlist.conf`에서 private/VPN/observability subnet만 추가한다.

## Web / Next.js deploy boundary

Web CI/test/config 기준은 `docs/07_tech/frontend/web-infra-ci-test-config.md`가 소유한다. `apps/web/next.config.ts`의 `output: 'standalone'`과 Playwright standalone smoke는 future Web runtime image 설계를 위한 근거일 뿐, 이 compose가 Web production deploy를 제공한다는 뜻은 아니다.

Web production deploy를 추가할 때는 이 API compose에 암묵적으로 끼워 넣지 않고, 아래 책임을 별도 설계/검증 단위로 다룬다.

- `infra/deploy/web/Dockerfile` 또는 동등한 standalone runtime image.
- `infra/deploy/docker-compose.web.yml` 신규 생성 또는 API compose 확장 여부 결정.
- nginx route 분리: `/api`, `/auth`, `/socket.io`, health/metrics는 API upstream, Web route/static asset은 Web upstream 또는 CDN origin.
- static asset cache header, TLS/domain/CDN, rollback, release smoke script.
- Web deploy GitHub Actions workflow, environment approval, OIDC, smoke evidence artifact.
- Web Vitals/RUM ingestion과 API observability stack 연결 여부.

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
- CORS는 explicit REST allowlist만 허용하고 wildcard를 쓰지 않는다. Cookie 기반 auth transport를 추가할 때는 platform HTTP cookie policy helper를 사용한다.
- 실제 domain 구매, DNS record 생성, TLS certificate 발급/renewal은 repo가 자동 수행하지 않는다. 운영자는 private override와 cert volume을 별도로 관리한다.
- Slack/Alertmanager delivery secret과 receiver 설정은 `infra/observability`가 소유한다. `infra/deploy`는 API/nginx와 metrics endpoint를 제공하고, 전체 점검은 `infra/observability/rehearsal-checklist.md`를 따른다.
