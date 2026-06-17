# Production deployment readiness 정책

## 문서 범위

이 문서는 KNU Roommate **백엔드 API와 managed PostgreSQL DB**를 production release 가능한 상태로 만들기 위한 운영 정책을 다룬다. Web/BackOffice 제품 구현은 이 문서의 범위가 아니다.

관련 기준 문서:

- [runtime-observability-and-release.md](./runtime-observability-and-release.md)
- [account-authentication.md](./account-authentication.md)
- [data-retention.md](./data-retention.md)
- [legal-basis.md](./legal-basis.md)
- `infra/deploy/README.md`
- `infra/observability/rehearsal-checklist.md`

## Production release 목표

Production release는 아래 조건을 만족해야 한다.

1. API는 Docker image + nginx reverse proxy 단위로 재현 가능하게 실행된다.
2. PostgreSQL은 local compose DB가 아니라 private managed PostgreSQL endpoint를 사용한다.
3. Production secret은 code, git, log, report, issue에 원문으로 남지 않는다.
4. 이메일 인증/비밀번호 재설정 메일은 local stub/log output이 아니라 production mail provider를 사용한다.
5. Liveness/readiness/metrics는 운영자가 배포·복구·장애 판단에 사용할 수 있을 만큼 정확하게 분리된다.
6. Migration, DB role grant, smoke, rollback, backup/restore drill이 release gate에 포함된다.
7. 관측/부하 테스트 evidence는 release blocker와 후속 성능 개선을 분리하는 입력으로 사용된다.

## 포함 / 제외 matrix

| 구분          | 포함                                                                                                       | 제외                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| API runtime   | NestJS API Docker image, nginx reverse proxy, health/readiness, metrics guard                              | Web/Next.js rendering, BackOffice UI                                                    |
| Database      | RDS PostgreSQL 또는 동등한 private managed PostgreSQL, migration deploy, role grants, backup/restore drill | local dev Postgres의 production 사용, RDS Proxy 초기 도입, Multi-AZ/read replica 필수화 |
| Config/secret | env key registry, production required matrix, Secrets Manager/KMS boundary, secret redaction               | secret 원문 commit, app-level RRPD/vault payload KMS 재설계                             |
| Email         | SES 또는 동등 provider, verified identity, DKIM, sandbox 해제, provider failure event                      | production에서 verification code log 출력, 고정 IP 필수화                               |
| Ingress       | nginx, TLS/domain, WebSocket upgrade, CORS/cookie policy                                                   | WAF/CloudFront/Route53 전체 edge architecture 필수화                                    |
| CI/CD         | GitHub Actions build/test/migration/deploy/smoke gate, GitHub environment approval, AWS OIDC 권장          | long-lived AWS access key 기본 전략, 완전한 Terraform/CDK 전환                          |
| Observability | logging/stress baseline, Prometheus/Loki/Grafana/Alertmanager/Slack rehearsal evidence                     | production target 무승인 stress, public metrics exposure                                |

## 완료된 observability / stress baseline

운영 관측과 부하 테스트 기반은 이미 백엔드 release readiness의 선행 baseline으로 둔다.

- API structured JSON logging과 request correlation을 사용한다.
- raw email, password, token, verification code, chat/support/report body, RRPD payload는 log/metric label에 남기지 않는다.
- `/internal/metrics`는 public endpoint가 아니며 bearer token guard와 nginx allowlist 경계를 함께 둔다.
- Prometheus, Grafana, Loki, Alloy, Alertmanager, Slack delivery rehearsal 절차가 존재한다.
- k6 HTTP smoke와 Artillery Socket.IO smoke를 운영 전 rehearsal 입력으로 사용한다.
- API/nginx Docker compose는 production-like local/staging smoke의 기준 실행 단위다.
- 237 VU ramp evidence는 release 전 병목 판단 입력으로 사용하되, Redis/multi-node 도입 자체를 release blocker로 만들지 않는다.

## Config / Secret / KMS 정책

- Production env key는 `apps/api/src/config/env-keys` registry에서 owner/category/required/secret/default-forbidden 여부를 추적한다.
- `apps/api/src/config/schema`는 owner별 Joi schema를 조합하고, public export `envValidationSchema`를 유지한다.
- `infra/deploy/.env.api.example`은 production required key coverage를 확인하기 위한 template이며 실제 secret 원문을 포함하지 않는다.
- Production boot는 critical secret이 없거나 placeholder/local default 값이면 fail-fast한다.
- Secret 원문은 repository, Docker image layer, CI log, issue, report에 저장하지 않는다.
- Production secret source는 direct env injection(`SECRET_SOURCE=env`) 또는 AWS Secrets Manager materialization(`SECRET_SOURCE=aws-secrets-manager`)을 허용한다.
- `SECRET_SOURCE=aws-secrets-manager` production 경로는 `SECRET_NAME_PREFIX=/knu-roommate/<environment>/api`를 기준으로 env key별 plain `SecretString`을 읽는다.
- Secrets Manager encryption은 초기 production에서 AWS managed KMS key `aws/secretsmanager`를 기본으로 두고, customer-managed CMK는 별도 key policy/운영 절차가 준비된 뒤 전환한다.
- App-level retention/RRPD/vault payload 암호화 key rotation은 production deployment readiness와 별도 보안/retention 설계에서 다룬다.

## SES production email 정책

- Production auth email sender는 local stub/log output이 아니라 `EMAIL_PROVIDER=ses` 경로의 SESv2 adapter 또는 동등한 실제 provider를 사용한다.
- Sender identity는 verified domain 또는 verified email address여야 한다.
- Production 발송 전 domain identity + DKIM 설정을 권장한다.
- SES sandbox 상태에서는 수신자도 verified identity여야 하므로 실제 사용자 발송 전에 production access 해제가 필요하다.
- SES email sending 자체에는 static outbound IP가 필수 조건이 아니다.
- Verification/reset code, reset proof, auth token은 mail sender log나 security event metadata에 원문으로 저장하지 않는다.
- Provider success/failure는 bounded security event와 metric으로 남기되, transient provider 장애와 provider config invalid 상태를 분리한다.
- AWS/SES raw error message는 log/security event metadata에 저장하지 않고 `CONFIG_INVALID`, `ACCESS_DENIED`, `MESSAGE_REJECTED`, `THROTTLED`, `TRANSIENT`, `UNKNOWN` category만 남긴다.
- 운영 identity/DKIM/sandbox/production access 준비는 `infra/aws/ses-setup-checklist.md`를 release gate로 사용한다.

## RDS / Migration / Role grant / Backup 정책

- Production DB는 app instance와 같은 VPC/private network에서 접근 가능한 managed PostgreSQL을 기본으로 한다.
- Public internet에 직접 열린 DB endpoint를 production 기본값으로 두지 않는다.
- Migration은 app rollout 전에 `MIGRATION_DATABASE_URL` 기반 one-off `prisma migrate deploy` 흐름으로 적용한다.
- Production DB deploy path에서 `prisma db push`를 사용하지 않는다.
- API container startup은 migration/role grant를 자동 실행하지 않는다.
- Migration 실패나 role grant 실패는 app rollout blocker다.
- Runtime, migration, retention/disclosure worker credential은 역할별 권한 분리를 유지한다. Role grant script는 password/LOGIN role/member 생성이 아니라 schema/table privilege baseline 적용을 소유한다.
- Role grant apply 이후 runtime/retention/disclosure credential smoke를 수행하고, API/nginx rollout 뒤 `/health/ready`를 final deploy gate로 확인한다.
- RDS SSL/TLS connection은 `sslmode=require` 또는 CA bundle 검증 옵션으로 운영 경로를 고정한다.
- RDS CloudWatch/Database Insights에서 CPU, connection, memory, IOPS, queue, storage를 release checklist에 포함한다.
- Backup/restore drill은 release 전 최소 1회 수행하고, restored DB에서 migration baseline과 role grant smoke가 통과해야 한다.

## nginx / TLS / Domain / Cookie / CORS 정책

- Public ingress는 nginx reverse proxy가 소유하고, API container는 내부 upstream으로 둔다.
- WebSocket 경로는 `Upgrade`/`Connection` header forwarding을 유지한다.
- `/internal/metrics`는 public internet에 직접 열지 않는다.
- Production TLS는 Let's Encrypt/Certbot 또는 동등한 인증서 발급 경로를 사용한다.
- REST API CORS origin은 wildcard가 아니라 `HTTP_CORS_ALLOWED_ORIGINS`의 explicit allowlist로 둔다. Allowlist가 비어 있으면 permissive CORS를 활성화하지 않는다.
- Socket.IO/realtime origin policy는 `CHAT_REALTIME_ALLOWED_ORIGINS`와 `CHAT_REALTIME_TRUST_PROXY`가 별도로 소유한다.
- 현재 auth/session transport는 JSON response body token + `Authorization` header 기반이며 API는 `Set-Cookie`를 발급하지 않는다.
- Cookie-backed transport가 도입되면 platform HTTP cookie policy helper를 사용하고 `httpOnly`, `secure`, `SameSite=Lax`, 명시적 path/maxAge/expiry를 기준으로 한다.
- `SameSite=None`은 `secure=true` 없이는 허용하지 않는다. Cross-site cookie 요구는 실제 Web 배포 구조가 확정될 때 별도 decision으로 다룬다.
- Local/proxy-behind-LB HTTP nginx baseline과 direct nginx TLS termination 예시는 분리한다. Placeholder certificate path가 base compose에 로드되면 안 된다.

## Health / Readiness / Metrics exposure 정책

- `GET /health`와 `GET /health/live`는 process liveness 성격으로 유지한다.
- `GET /health/ready`는 deploy routing에 사용할 readiness gate이며 DB, runtime config, secret materialization, migration/schema baseline, email provider config 같은 critical dependency를 timeout-bound로 확인해야 한다.
- Readiness failure는 HTTP 503과 bounded check code로 반환하고 secret value, DB URL, raw provider error, stack trace를 노출하지 않는다.
- Ops-only health endpoint는 capability guard와 ingress boundary로 보호한다.
- Metrics endpoint는 internal route, bearer token, ingress allowlist, bounded label 정책을 함께 만족해야 한다.
- Provider transient failure는 degraded/operation failure로 기록할 수 있지만, provider config invalid는 production readiness failure로 분류한다.

## CI/CD deploy gate 정책

CI/CD는 PR/push 검증과 production deploy를 분리한다.

- `.github/workflows/api-ci.yml`은 PR과 `dev`/`main` push에서 install, shared build, Prisma artifact generation, `pnpm check:api`, `pnpm test:api`, `pnpm build:api`, deploy compose config를 실행한다. CI workflow는 deploy permission이나 `id-token: write` 권한을 갖지 않는다.
- `.github/workflows/api-deploy-production.yml`은 `workflow_dispatch`로만 실행하고 GitHub `production` environment approval을 요구한다. 기본 입력값은 `dry_run=true`이며, non-dry-run production deploy는 `main` branch에서만 실행한다.

Production deploy는 아래 순서를 깨지 않는다.

1. Install/build/typecheck/lint/test preflight.
2. Docker image build.
3. Migration deploy.
4. DB role grant apply.
5. DB credential smoke.
6. API/nginx rollout.
7. Health/readiness smoke.
8. Metrics guard smoke.
9. Release evidence artifact upload.
10. Slack/Alertmanager delivery smoke 또는 운영자가 명시적으로 승인한 skip 기록.
11. Backup/restore drill evidence 확인.

GitHub Actions에서 AWS 접근이 필요하면 OIDC + AWS role을 기본 후보로 둔다. Workflow는 `contents: read`, `id-token: write` 최소 권한으로 AWS short-lived token을 요청한다. SSH key 또는 long-lived cloud access key는 과도기 fallback이며 environment approval과 rotation 기준을 함께 둔다.

GitHub production environment, OIDC role, release runbook은 `infra/aws/github-actions-oidc-checklist.md`, `infra/aws/beginner-account-budget-checklist.md`, `infra/runbooks/api-production-deploy-runbook.md`를 따른다.

## Release blocker / follow-up 구분

| 분류            | 항목                                                                                                                                                                                                                        |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Release blocker | critical config/secret 누락, placeholder secret 사용, production stub email sender, migration failure, role grant failure, readiness failure, public metrics exposure, TLS/domain/CORS/cookie 불일치, backup restore 미검증 |
| Follow-up       | #281/#247 read path 최적화, 946 cohort long run, RDS CloudWatch 장기 sizing, Redis/ElastiCache, multi-node, Multi-AZ/read replica, WAF/CloudFront/Route53 고도화, managed observability 전환                                |

Follow-up 항목은 production release 이후에도 운영 evidence를 기반으로 우선순위를 다시 정한다. 단, follow-up 항목이 release smoke에서 실제 장애로 관측되면 release blocker로 승격한다.

## 운영자 수동 checklist

실제 production resource 생성은 운영자가 명시적으로 수행한다.

1. AWS 계정 결제 수단과 Budget alert를 설정한다.
2. App instance, private network/VPC, RDS PostgreSQL subnet/security group을 준비한다.
3. RDS automated backup, retention period, backup window를 설정한다.
4. Secrets Manager secret inventory, `SECRET_NAME_PREFIX`, IAM read policy, KMS key 정책을 준비한다.
5. SES sender identity, DKIM, sandbox 해제 요청을 완료한다.
6. Domain DNS와 TLS 인증서 발급 경로를 준비한다.
7. GitHub environment, approval rule, AWS OIDC role 또는 과도기 deploy credential을 준비한다.
8. Release 전 backup/restore drill evidence를 남긴다.
9. Release 후 CloudWatch, app metrics, Slack alert, API/nginx logs를 확인한다.

## 변경 이력

| 날짜       | 변경 내용                                                                                                                                                   | 관련 이슈                       |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 2026-06-17 | GitHub Actions API CI와 protected production deploy workflow, AWS OIDC checklist, dry-run release smoke/rollout boundary를 production CI/CD 정책에 반영했다 | production deployment readiness |
| 2026-06-17 | HTTP REST CORS allowlist, future cookie policy helper, nginx direct TLS 예시를 production ingress 정책에 반영했다                                           | production deployment readiness |
| 2026-06-17 | RDS/Prisma migrate deploy/role grant smoke를 API rollout 전 production DB deploy gate로 고정했다                                                            | production deployment readiness |
| 2026-06-17 | Health live/ready contract를 분리하고 readiness bounded 503, DB/config/secret/migration/email provider check 기준을 production readiness 정책에 반영했다    | production deployment readiness |
| 2026-06-17 | SESv2 auth email sender adapter, production stub fail-fast, bounded provider error taxonomy, SES setup checklist를 production readiness 정책에 반영했다     | production deployment readiness |
| 2026-06-17 | Secrets Manager reader/materializer boundary, env key별 secret name convention, AWS managed KMS 기본 정책을 production readiness config 정책에 반영했다     | production deployment readiness |
| 2026-06-17 | Env key registry, owner별 schema split, HTTP/email/secret-source config baseline을 production readiness config 정책에 반영했다                              | production deployment readiness |
| 2026-06-17 | BE API와 managed PostgreSQL production release readiness의 포함/제외, secret/SES/RDS/TLS/CI-CD/backup/release blocker 기준을 공식 정책으로 신설했다         | production deployment readiness |
