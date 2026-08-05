# Production release checklist

이 checklist는 KNU Roommate BE API와 managed PostgreSQL DB를 production에 배포하기 직전에 운영자가 `GO`, `NO-GO`, `GO with follow-up`을 판정하기 위한 단일 release gate다. Web/BackOffice 배포 여부와 분리해서 API, RDS, ingress, CI/CD, backup/restore, observability evidence만 확인한다.

## Release metadata

| Field                              | Value                                |
| ---------------------------------- | ------------------------------------ |
| Release commit SHA                 |                                      |
| API image tag                      |                                      |
| Operator                           |                                      |
| Environment                        | `production`                         |
| GitHub workflow run id             |                                      |
| Release evidence directory/link    |                                      |
| Restore drill evidence id          |                                      |
| Observability/stress evidence link |                                      |
| Decision                           | `GO` / `NO-GO` / `GO with follow-up` |

Evidence에는 secret value, DB URL, bearer token, raw provider error, restored DB password, verification code, HMAC secret을 기록하지 않는다. 필요한 경우 secret-free identifier, workflow run id, artifact id, CloudWatch metric screenshot/link만 남긴다.

## Gate 0. Source branch and local-equivalent CI

| Check                                                    | Evidence           | Decision |
| -------------------------------------------------------- | ------------------ | -------- |
| Release commit은 `main` branch 기준이다.                 | commit SHA         |          |
| API CI workflow가 같은 commit에서 통과했다.              | workflow run id    |          |
| Local-equivalent 검증이 통과했다.                        | `pnpm check:api`   |          |
| API build가 통과했다.                                    | `pnpm build:api`   |          |
| Release artifact/image tag가 commit SHA와 연결되어 있다. | image tag / digest |          |

`NO-GO`: CI 실패, release SHA 불일치, image tag provenance 불명확.

## Gate 1. Config and secret readiness

| Check                                                                                      | Evidence                                                                          | Decision |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | -------- |
| env key registry와 `.env.api.example`이 production 필수 key를 포함한다.                    | `apps/api/src/config/env-key.registry.ts`, `infra/deploy/.env.api.example` review |          |
| production env에 placeholder/default secret이 없다.                                        | private inventory review; value 미출력                                            |          |
| Secrets Manager inventory dry-run이 key presence만 확인하고 값을 출력하지 않는다.          | `pnpm --dir apps/api secrets:inventory -- --dry-run` 또는 운영 evidence           |          |
| `SECRET_SOURCE=aws-secrets-manager` 경로의 `SECRET_NAME_PREFIX`가 환경명과 일치한다.       | secret-free prefix                                                                |          |
| `LOG_HASH_SECRET`, `METRICS_BEARER_TOKEN`, cursor/HMAC secrets가 모두 materialized 상태다. | key presence only                                                                 |          |

`NO-GO`: missing secret, `REPLACE_ME`, local default secret, secret value 노출, production에서 `SECRET_SOURCE` 불일치.

## Gate 2. SES email readiness

| Check                                                                                                                                           | Evidence                            | Decision |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | -------- |
| `EMAIL_PROVIDER=ses`가 production env에 설정되어 있다.                                                                                          | env key presence                    |          |
| SES sender identity/domain이 verified 상태다.                                                                                                   | SES identity id / screenshot link   |          |
| DKIM이 enabled/pass 상태다.                                                                                                                     | DKIM evidence                       |          |
| SES sandbox production access가 해제되어 있다.                                                                                                  | SES account status                  |          |
| manual send 또는 mailbox simulator smoke가 bounded provider error category로 관측된다.                                                          | smoke result; no raw provider error |          |
| Configuration Set의 delivery/bounce/complaint event가 승인된 destination에서 확인된다.                                                          | event destination evidence          |          |
| provider failure는 `CONFIG_INVALID`, `ACCESS_DENIED`, `MESSAGE_REJECTED`, `THROTTLED`, `TRANSIENT`, `UNKNOWN` 같은 bounded category로만 남는다. | log/security event sample           |          |

`NO-GO`: production stub sender, unverified identity, sandbox 미해제, raw SES error 또는 email secret 노출.

## Gate 3. DB/RDS migration and role grants

| Check                                                                                            | Evidence                                | Decision |
| ------------------------------------------------------------------------------------------------ | --------------------------------------- | -------- |
| RDS endpoint는 private network/security group으로 제한되어 있다.                                 | RDS identifier / subnet group / SG id   |          |
| public access가 비활성화되어 있다.                                                               | RDS configuration evidence              |          |
| SSL/TLS connection 정책이 운영 connection string에 반영되어 있다.                                | `sslmode=require` 또는 CA verify option |          |
| RDS CloudWatch/Database Insights에서 CPU, connection, memory, IOPS, queue, storage를 볼 수 있다. | dashboard/link                          |          |
| Prisma migration deploy가 app rollout 전에 완료되었다.                                           | `pnpm api:db:deploy:migrate`            |          |
| role grant apply가 완료되었다.                                                                   | `pnpm api:db:deploy:role-grants`        |          |
| runtime/retention/disclosure credential smoke가 완료되었다.                                      | `pnpm api:db:deploy:smoke`              |          |

`NO-GO`: migration failure, role grant failure, DB public exposure, SSL/TLS 정책 누락, credential smoke failure.

## Gate 4. Backup and restore drill

| Check                                                                             | Evidence                                    | Decision |
| --------------------------------------------------------------------------------- | ------------------------------------------- | -------- |
| RDS automated backup 또는 PITR이 활성화되어 있다.                                 | RDS backup configuration                    |          |
| release 전 temporary restored DB 기반 restore drill이 수행되었다.                 | restore drill evidence id                   |          |
| restored DB에서 migration baseline/role grant smoke가 통과했다.                   | `pnpm api:db:restore-drill:smoke`           |          |
| optional restored API readiness smoke가 통과했거나 생략 사유가 기록되었다.        | `infra/deploy/scripts/api-release-smoke.sh` |          |
| restored DB cleanup status가 기록되었다.                                          | cleanup evidence                            |          |
| `api-restore-drill-manual` workflow run id 또는 동등한 manual evidence id가 있다. | workflow/manual evidence id                 |          |

`NO-GO`: backup restore 미검증, restored DB smoke failure, cleanup status unknown, `restore_drill_evidence_id` 누락.

## Gate 5. Ingress, TLS, domain, CORS, cookie, realtime

| Check                                                                                | Evidence                                            | Decision |
| ------------------------------------------------------------------------------------ | --------------------------------------------------- | -------- |
| nginx public ingress가 API upstream을 proxy하고 API container는 내부 upstream이다.   | `infra/deploy/docker-compose.api.yml`, nginx config |          |
| `/api`, `/auth`, `/socket.io`, `/health*` route가 기대대로 proxy된다.                | smoke result                                        |          |
| Socket.IO/WebSocket upgrade header forwarding이 유지된다.                            | realtime smoke 또는 nginx review                    |          |
| `/internal/metrics`는 public internet에 직접 열리지 않는다.                          | ingress allowlist / smoke                           |          |
| TLS certificate issuance/renewal 경로가 준비되어 있다.                               | cert id / certbot or LB evidence                    |          |
| REST CORS는 wildcard가 아닌 `HTTP_CORS_ALLOWED_ORIGINS` explicit allowlist다.        | env key presence                                    |          |
| realtime origin policy는 `CHAT_REALTIME_ALLOWED_ORIGINS`로 별도 관리된다.            | env key presence                                    |          |
| cookie-backed auth가 아직 없으면 API가 `Set-Cookie`를 발급하지 않는 상태를 확인한다. | smoke/header check                                  |          |

`NO-GO`: metrics public exposure, TLS/domain mismatch, wildcard CORS, WebSocket upgrade failure, cookie policy mismatch.

## Gate 6. Health, readiness, and metrics smoke

| Check                                                                                                 | Evidence                                    | Decision |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------- | -------- |
| `/health`가 process liveness를 반환한다.                                                              | `infra/deploy/scripts/api-release-smoke.sh` |          |
| `/health/live`가 liveness를 반환한다.                                                                 | smoke result                                |          |
| `/health/ready`가 DB/config/secret/migration/email provider readiness를 bounded 200/503으로 반환한다. | smoke result                                |          |
| readiness failure body는 secret/DB URL/raw provider error/stack trace를 노출하지 않는다.              | sample response                             |          |
| `/internal/metrics` anonymous request는 거부된다.                                                     | smoke result                                |          |
| `/internal/metrics` bearer authorized scrape가 성공한다.                                              | smoke result                                |          |
| verification/credential/mail dispatch/outbox lag auth metric이 모두 scrape된다.                       | auth metrics smoke                          |          |

`NO-GO`: readiness failure, secret leak, metrics anonymous access, smoke script failure.

## Gate 7. CI/CD protected deploy

| Check                                                                                                | Evidence                 | Decision |
| ---------------------------------------------------------------------------------------------------- | ------------------------ | -------- |
| `API Production Deploy` workflow는 `workflow_dispatch` + production environment approval로 실행된다. | workflow run id          |          |
| `dry_run=true` preflight가 먼저 통과했다.                                                            | dry-run run id           |          |
| `dry_run=false` 실행은 `main` branch와 `restore_drill_evidence_id`를 요구한다.                       | input summary            |          |
| AWS 접근은 OIDC + short-lived token 경로다.                                                          | role arn / OIDC evidence |          |
| deploy artifact에는 secret value가 없다.                                                             | artifact review          |          |
| manual fallback을 사용하면 동일한 release order를 따른다.                                            | operator note            |          |

`NO-GO`: production approval 누락, dry-run failure, long-lived key 기본 경로 사용, release artifact secret leak.

## Gate 8. Observability and stress evidence

| Check                                                                                            | Evidence                                                          | Decision |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | -------- |
| observability rehearsal checklist가 release 기준으로 완료되어 있다.                              | `infra/observability/rehearsal-checklist.md` evidence             |          |
| Slack Alertmanager delivery smoke가 Slack channel까지 도달했다.                                  | Slack smoke timestamp/link                                        |          |
| Prometheus target up, Loki log readout, Grafana dashboard readout을 확인했다.                    | dashboard links                                                   |          |
| Dockerized API/nginx smoke가 release candidate image에서 통과했다.                               | `pnpm --dir apps/api stress:docker:smoke`                         |          |
| production-like smoke가 통과했다.                                                                | `pnpm --dir apps/api stress:docker:production-like`               |          |
| 237 ramp decision evidence가 release blocker/follow-up 판단에 반영되어 있다.                     | `pnpm --dir apps/api stress:docker:237-ramp`                      |          |
| threshold fail이 있으면 blocker 또는 explicit risk acceptance로 분류되어 있다.                   | decision note                                                     |          |
| Auth 19MiB local constrained baseline과 H8/AWS reference 미수행 risk acceptance가 확인된다.      | auth password capacity rehearsal runbook + decision commit        |          |
| Password Reset recovery E2E와 auth integration의 grant/session/outbox transaction이 통과한다.    | `infra/runbooks/auth-password-reset-release-evidence.md`          |          |
| Signup·Change Password·Logout의 identity/session/audit transaction과 BFF cookie 경계가 통과한다. | `infra/runbooks/auth-registration-credential-release-evidence.md` |          |
| Reset request/invalid-code abuse stress가 neutral response와 bounded throttle를 유지한다.        | `stress:http:auth-recovery`                                       |          |

`NO-GO`: 관측 경로 전체 불능, stress threshold fail 미분류, Slack/metrics/log evidence 없음.

## Release decision

| Decision            | Criteria                                                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `GO`                | Gate 0~8이 모두 통과하고 blocker가 없다. Follow-up은 release path 밖에서 추적된다.                                               |
| `GO with follow-up` | Gate 0~8 중 release safety를 깨지 않는 운영 개선 항목만 남고, owner/issue/evidence가 명확하다.                                   |
| `NO-GO`             | secret/config/SES/DB/migration/role grant/readiness/metrics/TLS/restore drill/CI-CD gate 중 하나라도 실패했거나 evidence가 없다. |

## Follow-up classification

| Candidate                                                | Release decision rule                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 실제 AWS RDS PITR/snapshot restore 반복 훈련             | release 전 1회 evidence는 blocker, 반복 자동화는 follow-up                           |
| SES production send 운영 모니터링 확대                   | identity/DKIM/sandbox 해제와 smoke는 blocker, 장기 deliverability 최적화는 follow-up |
| DNS/TLS 자동 갱신 IaC                                    | 현재 인증서 발급/갱신 경로는 blocker, Terraform/CDK 전환은 follow-up                 |
| RDS CloudWatch 장기 sizing                               | dashboard 존재와 release smoke 확인은 blocker, 장기 right-sizing은 follow-up         |
| 946 cohort long run                                      | 237 ramp release evidence는 blocker, 946 long run은 follow-up                        |
| Redis/ElastiCache/multi-node/read replica/WAF/CloudFront | release smoke 실패로 관측되면 blocker, 그렇지 않으면 evidence-based follow-up        |
| Managed observability 전환                               | local/staging observability evidence는 blocker, managed vendor 전환은 follow-up      |

## Secret-free evidence template

```txt
release_sha:
api_image_tag:
operator:
environment: production
api_ci_run_id:
deploy_dry_run_id:
deploy_run_id:
restore_drill_evidence_id:
restore_source_identifier:
restored_db_identifier:
restore_cleanup_status:
health_smoke_status:
metrics_smoke_status:
ses_smoke_status:
slack_smoke_status:
stress_docker_smoke_status:
stress_production_like_status:
stress_237_ramp_status:
auth_password_capacity_baseline_commit:
auth_password_capacity_gap_acceptance: H8/AWS reference not executed
decision: GO | GO with follow-up | NO-GO
blockers:
follow_up_issues:
redaction_confirmed: true
```
