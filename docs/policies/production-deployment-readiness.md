# Production deployment readiness 정책

## 문서 범위

이 문서는 KNU Roommate **백엔드 API와 managed PostgreSQL DB**를 production release 가능한 상태로 만들기 위한 운영 정책을 다룬다. Web/BackOffice 제품 구현은 이 문서의 범위가 아니다.

관련 기준 문서:

- [runtime-observability-and-release.md](./runtime-observability-and-release.md)
- [account-authentication.md](./account-authentication.md)
- [data-retention.md](./data-retention.md)
- [legal-basis.md](./legal-basis.md)
- `infra/deploy/README.md`
- `infra/db/README.md`
- `infra/aws/rds-setup-checklist.md`
- `infra/runbooks/backup-restore-drill.md`
- `infra/runbooks/production-release-checklist.md`
- `infra/runbooks/incident-rollback.md`
- `infra/observability/rehearsal-checklist.md`
- `docs/development/future-production-deployment-inputs.md`

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
| CI/CD         | GitHub Actions CI, local container/DB/observability rehearsal, 향후 CD 결정 input                          | 미확정 target을 전제한 deploy workflow·remote rollout·provider IAM                      |
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

## 초기 production capacity baseline

이 절의 수치는 실제 production resource가 생성되기 전 사용하는 **승인된 planning baseline**이다. 초기 배포는 4GB/2vCPU App host + RDS를 기준으로 준비하고, 릴리즈 후에는 같은 항목을 실제 instance type, container limit, CloudWatch 및 app metric 실측값으로 교체한다.

### Compute / database 권장 기준

| 구분          | 초기 권장값                                                         | 적용 조건                                                                                              |
| ------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| App host      | 4GB RAM / 2vCPU 또는 동등 instance                                  | nginx, Web, BackOffice, API와 self-hosted observability를 같은 host의 분리 container로 운영하는 기본안 |
| API container | CPU 1.5, memory 1536MiB limit, 512MiB reservation을 시작점으로 사용 | Argon2id와 주 API traffic이 집중되는 container. 실제 host에서 production-like gate로 재검증            |
| Database      | RDS PostgreSQL Single-AZ `db.t4g.micro` 또는 동등 starter           | gp3 20~30GB, automated backup 7일 이상, private access                                                 |

2GB App host 축소안은 초기 production 구성에서 제외한다. observability를 외부화하거나 축소하고 별도 production-like evidence가 생긴 경우에만 새로운 capacity decision으로 재검토한다.

### Container resource 시작값

다음 값은 4GB host에서 사용하는 첫 배포용 budget이다. Memory limit 합계는 3136MiB로 두어 OS, Docker daemon, filesystem cache와 일시적 process 증가를 위해 약 960MiB를 남긴다.

| Container    | CPU upper bound | Memory reservation | Memory limit | 책임 / 운영 조건                                                                            |
| ------------ | --------------: | -----------------: | -----------: | ------------------------------------------------------------------------------------------- |
| nginx        |             0.2 |              32MiB |        96MiB | public ingress, TLS, allowlist, upstream routing                                            |
| Web          |             0.5 |             160MiB |       320MiB | 사용자 Next.js runtime                                                                      |
| BackOffice   |            0.35 |             128MiB |       256MiB | 운영자 Next.js runtime. public product auth와 분리된 admin guard + ingress restriction 필수 |
| API          |             1.5 |             512MiB |      1536MiB | NestJS API, auth hash, domain transaction                                                   |
| Prometheus   |            0.35 |             128MiB |       256MiB | bounded retention과 scrape interval 적용                                                    |
| Loki         |            0.35 |             160MiB |       320MiB | bounded local retention, payload/PII 미수집                                                 |
| Alloy        |            0.15 |              48MiB |        96MiB | log/metric collection                                                                       |
| Alertmanager |             0.1 |              48MiB |        96MiB | bounded alert routing                                                                       |
| Grafana      |             0.2 |              96MiB |       160MiB | internal ingress와 operator auth 적용                                                       |

- CPU 값은 동시에 보장되는 reservation이 아니라 container별 burst upper bound다. 합계가 host 2vCPU를 초과하므로 host CPU와 latency gate가 최종 authority다.
- Lightsail 4GB/2vCPU 일반 Linux bundle을 reference instance로 사용할 경우 AWS가 공개한 sustainable CPU baseline은 vCPU당 20%다. 짧은 시즌 피크는 burst credit을 사용할 수 있지만, hash나 observability 부하가 지속되어 credit을 소진하는 구성은 허용하지 않는다.
- BackOffice, Grafana, Prometheus, Loki, Alertmanager는 public ingress에 직접 노출하지 않는다. BackOffice는 별도 container라는 사실만으로 보호되지 않으며 admin capability/guard와 ingress restriction을 함께 적용한다.
- migration, seed, restore drill 같은 one-shot process는 상시 container budget에 포함하지 않는다. 실행 중에는 API rollout을 직렬화하고 host headroom을 별도로 확인한다.

### 월 비용 planning baseline

2026-07-27 공개 AWS 가격을 기준으로 한 서울 리전 초기 추정치다. 실제 결제액은 세금, 환율, CloudWatch 사용량, 초과 backup/snapshot, data transfer, 도메인과 CPU credit에 따라 달라지므로 AWS Pricing Calculator 결과를 release evidence로 다시 남긴다.

| 항목                                    | 계산                                         |  예상 월 비용 |
| --------------------------------------- | -------------------------------------------- | ------------: |
| Lightsail Linux 4GB/2vCPU/public IPv4   | fixed bundle                                 |        $24.00 |
| RDS PostgreSQL `db.t4g.micro` Single-AZ | $0.025/hour × 730 hours                      |        $18.25 |
| RDS gp3 20~30GB                         | $0.131/GB-month                              |   $2.62~$3.93 |
| 기본 compute + database 합계            | backup/data/monitoring 초과 비용 제외        | $44.87~$46.18 |
| 운영 예비비 포함 planning budget        | CloudWatch·초과 backup·transfer·세금 전 여유 |       $50~$65 |

- 내부 예산 환산은 환율을 고정 사실로 보지 않고 `1 USD = 1,400 KRW` planning rate를 사용한다. 이에 따른 월 예산은 약 7만~9.1만원, 연 예산은 약 84만~109.2만원이다.
- 실행 중인 RDS의 provisioned storage와 같은 크기까지의 regional backup storage는 AWS 정책상 추가 비용이 없지만, manual snapshot/automated backup 합계가 이 범위를 넘으면 과금된다.
- `db.t4g.micro`는 burstable DB이며 24시간 rolling baseline을 넘는 CPU credit이 추가 과금될 수 있다. DB CPU/credit, connection, free memory를 release 후 추적한다.
- 가격 근거:
  - Lightsail bundle: https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-bundles.html
  - Lightsail CPU baseline: https://docs.aws.amazon.com/lightsail/latest/userguide/baseline-cpu-performance.html
  - RDS PostgreSQL pricing: https://aws.amazon.com/rds/postgresql/pricing/
  - AWS regional price list: https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonRDS/current/ap-northeast-2/index.json

근거 우선순위:

1. 이 official policy가 현재 production readiness의 source of truth다.
2. `infra/deploy/docker-compose.api.override.example.yml`과 `infra/observability/docker-compose.observability.rehearsal.yml`은 container resource 시작값의 실행 가능한 source이며 production instance 사양 자체가 아니다.
3. `docs/runbooks/observability/auth-password-capacity-rehearsal-runbook.md`와 `infra/observability/rehearsal-checklist.md`는 local constrained 실행·판정 절차를 소유한다.
4. 실제 production resource가 생기면 instance, RDS, CloudWatch와 app metric evidence가 planning baseline을 대체한다.

### Argon2id memory cost capacity 판단

2026-07-27 local development machine에서 `@node-rs/argon2 ^2.0.2`, Argon2id `timeCost=2`, `parallelism=1`, `outputLen=32`로 수행한 상대 benchmark는 다음과 같다.

| memoryCost | 동시 요청 | 경과 시간 | process RSS 증가 관측 |
| ---------- | --------: | --------: | --------------------: |
| 8MiB       |         1 |    4.99ms |               8.61MiB |
| 8MiB       |         5 |   11.69ms |              40.92MiB |
| 19MiB      |         1 |   12.61ms |              19.64MiB |
| 19MiB      |         5 |   31.81ms |              95.91MiB |
| 19MiB      |        10 |   51.30ms |             153.14MiB |
| 19MiB      |        20 |   88.36ms |             153.19MiB |
| 19MiB      |       100 |  437.76ms |             153.77MiB |

100개 동시 실행의 completion p50/p95/p99는 각각 228.30ms/417.43ms/433.28ms였다. 이 값은 제품 사용량 모델이 아니라 native worker queue와 RSS 상한을 확인한 local microbenchmark다. Production CPU 성능이나 endpoint latency를 보장하지 않으며, 최초 배포 판단은 아래 cohort 기반 local constrained arrival-rate workload를 함께 사용한다.

기존 local Docker stress에서 API는 약 283.8MiB를 사용했다. 서로 다른 실행 환경의 두 수치를 단순 합산한 약 437MiB는 정확한 production peak가 아니라 보수적 preflight 입력이다. 이후 2CPU/3988MiB Docker engine, API 1.5CPU/1536MiB와 관측 stack resource limit에서 H1~H7/H9를 실행해 endpoint latency, spike recovery, onboarding, login headroom, throttle/lockout과 residue를 확인했다.

- 신규 hash baseline인 19MiB에서 signup/login/reset/change-password latency를 검증한다. 릴리즈된 8MiB 사용자 데이터가 없으므로 과거 hash 호환·migration workload는 만들지 않는다.
- 정상 로그인과 실패 로그인 모두 저장된 encoded hash의 salt/parameter로 Argon 검증 연산을 수행한다. Signup에만 발생하는 부하로 계산하지 않는다.
- 릴리즈 전 production 사용자가 없으므로 실제 auth traffic 통계 대신 237명 최대 관측 cohort와 946명 4배 확장 cohort를 capacity envelope로 사용한다.
- 946명 중 50%가 5분 안에 cold login하면 평균 약 1.6 RPS다. 짧은 집중을 위한 4배 burst factor를 적용해 1/2/5/10 RPS 단계와 20 RPS 30초 safety spike를 검증한다.
- 제품 mix는 login success 80%, login failure 15%, signup 3%, password reset 1.5%, password change 0.5% planning assumption으로 시작하고, 릴리즈 후 실측 비율로 교체한다.
- auth hash burst 중 container RSS, host CPU/burst credit, event loop lag, request p95/p99와 429/5xx를 확인한다.
- API RSS 70%, host memory 80%, sustained CPU 70% 또는 auth p95 목표 초과가 확인되면 rollout을 중단하고 concurrency/rate limit 또는 instance scale-up을 먼저 적용한다.
- 2GB host에서 observability를 함께 운영하면서 19MiB를 적용하는 조합은 기본안으로 허용하지 않는다.

### Local constrained rehearsal 해석

- Docker engine 전체가 2 CPU / 4096MiB인지 preflight로 확인하고, 더 큰 host는 4GB/2CPU evidence로 기록하지 않는다.
- API/nginx와 관측 stack은 위 resource 시작값을 compose override로 적용한다.
- 현재 local compose에는 Web/BackOffice가 없고 local PostgreSQL이 같은 engine을 사용한다. 따라서 이 결과는 Auth/API와 관측 stack의 제한 환경 동작을 확인하지만 전체 app host 또는 managed PostgreSQL 성능을 증명하지 않는다.
- Host에서 실행하는 H0 raw hash micro는 Docker engine 제한을 받지 않으므로 진단값으로만 분류하고, local constrained 판정은 container endpoint H1~H7/H9를 사용한다.
- 실행 및 report 절차는 `docs/runbooks/observability/auth-password-capacity-rehearsal-runbook.md`가 소유한다.
- H1~H7/H9의 threshold, secret detection, fixture reset과 residue 검사가 통과했고 API snapshot은 profile별 약 262~412MiB/1.5GiB 범위, PostgreSQL waiting lock은 0이었다.
- H8 60분 sustained soak는 수행하지 않아 장시간 CPU/memory/log retention 추세는 증명하지 않았다.
- 별도 AWS app host/managed PostgreSQL reference stress 환경은 준비하지 않는다. 따라서 local 결과를 managed PostgreSQL capacity 증명으로 표현하지 않는다.
- 위 미수행 범위를 accepted risk로 기록하고 Argon2id 19MiB/t=2/p=1, process-local admission 동시 4·대기 32·2초를 최초 배포 baseline으로 승인한다.
- 배포 후 auth p95/p99, API RSS, hash in-flight/admission, 429/503, DB connection/lock이 초기 기준을 벗어나면 Argon parameter를 자동 하향하지 않고 instance/admission/rate-limit을 먼저 비교한 새 capacity decision을 작성한다.

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
- SES Configuration Set event publishing을 활성화해 delivery, bounce, complaint를 승인된 CloudWatch/SNS/EventBridge 경계로 전달한다. API outbox의 `ACCEPTED`는 provider 접수 상태이므로 최종 delivery evidence로 사용하지 않는다.
- Release smoke에서 `api_auth_mail_dispatch_total`, `api_auth_mail_outbox_lag_seconds` scrape와 owner-local metric을 사용하는 `AuthMailFailureSpike`, `AuthMailOutboxLagHigh` rule load를 확인한다.
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
- Backup/restore drill은 release 전 최소 1회 수행하고, restored DB에서 migration baseline, role grant smoke, `/health/ready` smoke가 통과해야 한다. Evidence에는 release SHA, source DB identifier, restore source, restored DB identifier, RTO 실측, cleanup status를 secret 없이 남긴다.

## nginx / TLS / Domain / Cookie / CORS 정책

- Public ingress는 nginx reverse proxy가 소유하고, API container는 내부 upstream으로 둔다.
- WebSocket 경로는 `Upgrade`/`Connection` header forwarding을 유지한다.
- `/internal/metrics`는 public internet에 직접 열지 않는다.
- Production TLS는 Let's Encrypt/Certbot 또는 동등한 인증서 발급 경로를 사용한다.
- REST API CORS origin은 wildcard가 아니라 `HTTP_CORS_ALLOWED_ORIGINS`의 explicit allowlist로 둔다. Allowlist가 비어 있으면 permissive CORS를 활성화하지 않는다.
- Socket.IO/realtime origin policy는 `CHAT_REALTIME_ALLOWED_ORIGINS`와 `CHAT_REALTIME_TRUST_PROXY`가 별도로 소유한다.
- 현재 browser auth/session transport는 Web BFF가 API opaque access/renewal token response를 `httpOnly` cookie로 materialize하는 구조다. API upstream 자체는 `Set-Cookie` ownership을 갖지 않고, server-side forward path에서만 opaque token을 `Authorization` header로 전달한다.
- Cookie-backed browser transport는 platform HTTP cookie policy helper를 사용하고 `httpOnly`, `secure`, `SameSite=Lax`, 명시적 path/maxAge/expiry를 기준으로 한다.
- `SameSite=None`은 `secure=true` 없이는 허용하지 않는다. Cross-site cookie 요구는 실제 Web 배포 구조가 확정될 때 별도 decision으로 다룬다.
- Local/proxy-behind-LB HTTP nginx baseline과 direct nginx TLS termination 예시는 분리한다. Placeholder certificate path가 base compose에 로드되면 안 된다.

## Health / Readiness / Metrics exposure 정책

- `GET /health`와 `GET /health/live`는 process liveness 성격으로 유지한다.
- `GET /health/ready`는 deploy routing에 사용할 readiness gate이며 DB, runtime config, secret materialization, migration/schema baseline, email provider config 같은 critical dependency를 timeout-bound로 확인해야 한다.
- Readiness failure는 HTTP 503과 bounded check code로 반환하고 secret value, DB URL, raw provider error, stack trace를 노출하지 않는다.
- Ops-only health endpoint는 capability guard와 ingress boundary로 보호한다.
- Metrics endpoint는 internal route, bearer token, ingress allowlist, bounded label 정책을 함께 만족해야 한다.
- Provider transient failure는 degraded/operation failure로 기록할 수 있지만, provider config invalid는 production readiness failure로 분류한다.

## CI와 향후 CD 경계

CI는 PR/push 검증을 소유한다. Production CD는 hosting target, registry, network, approval, canonical host가 결정된 뒤 별도 구현한다.

- `.github/workflows/ci.yml`은 PR과 `dev`/`main` push에서 변경 surface를 분류하고, API 변경에는 `.github/workflows/api-ci.yml` reusable workflow를 호출한다. API lane은 install, `pnpm api:prepare` 1회, prepared check/test/build, deploy compose config를 실행하며 deploy permission이나 `id-token: write` 권한을 갖지 않는다.
- `.github/workflows/api-restore-drill-manual.yml`은 `workflow_dispatch`로만 실행하는 backup/restore smoke workflow다. RDS restore 자체는 자동 생성하지 않고, restored DB credential smoke와 optional API readiness smoke evidence만 남긴다.
- `infra/deploy`는 API container와 nginx의 local runtime candidate이며 image publish, remote host rollout, traffic switch를 수행하지 않는다.

향후 CD는 아래 순서를 깨지 않도록 target-specific rehearsal에서 검증해야 한다.

1. Install/build/typecheck/lint/test preflight.
2. Docker image build.
3. Migration deploy.
4. DB role grant apply.
5. DB credential smoke.
6. API/nginx rollout.
7. Health/readiness smoke.
8. Metrics guard smoke.
9. Secret-free release evidence 보존.
10. Slack/Alertmanager delivery smoke 또는 운영자가 명시적으로 승인한 skip 기록.
11. Backup/restore drill evidence 확인.

구현 전 결정해야 하는 항목은 `docs/development/future-production-deployment-inputs.md`가 소유한다. Provider별 workflow, IAM policy, 원격 command는 실제 resource와 운영 owner가 확정되기 전에는 지원 기능으로 두지 않는다.

## Final release checklist / rollback 정책

Production release의 최종 판단은 `infra/runbooks/production-release-checklist.md`가 소유한다. 운영자는 release SHA, artifact, CI, target-specific CD, config/secret, email, DB, backup/restore, ingress/TLS/CORS/cookie, health/readiness/metrics, observability/stress evidence를 하나의 checklist에 모아 `GO`, `NO-GO`, `GO with follow-up`으로 판정한다.

- `GO`: 모든 release blocker가 닫혔고 manual evidence가 secret-free 형태로 남아 있다.
- `GO with follow-up`: release safety를 깨지 않는 성능/운영 개선 후보만 남고 owner/issue/evidence가 명확하다.
- `NO-GO`: critical config/secret, SES, migration, role grant, readiness, public metrics exposure, TLS/domain/CORS/cookie, backup restore drill, CI/CD gate 중 하나라도 실패했거나 evidence가 없다.

장애나 release gate failure가 발생하면 `infra/runbooks/incident-rollback.md`를 사용한다. App code/ingress/readiness 문제는 previous safe image tag로 rollback하고, DB migration/schema/data 영향이 의심되면 자동 down migration이 아니라 RDS backup/PITR restore escalation으로 판단한다. Rollback 이후에도 `/health/ready`, `/internal/metrics`, Prometheus/Loki/Grafana, Slack alert, RDS CloudWatch 지표를 다시 확인한다.

Release/incident evidence에는 workflow run id, commit SHA, image tag, bounded error category, health/metrics smoke status, restore drill evidence id만 남긴다. DB URL, token, HMAC secret, SES secret, raw provider error, request/response body는 남기지 않는다.

## Release blocker / follow-up 구분

| 분류            | 항목                                                                                                                                                                                                                        |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Release blocker | critical config/secret 누락, placeholder secret 사용, production stub email sender, migration failure, role grant failure, readiness failure, public metrics exposure, TLS/domain/CORS/cookie 불일치, backup restore 미검증 |
| Follow-up       | #281/#247 read path 최적화, 946 cohort long run, RDS CloudWatch 장기 sizing, Redis/ElastiCache, multi-node, Multi-AZ/read replica, WAF/CloudFront/Route53 고도화, managed observability 전환                                |

Follow-up 항목은 production release 이후에도 운영 evidence를 기반으로 우선순위를 다시 정한다. 단, follow-up 항목이 release smoke에서 실제 장애로 관측되면 release blocker로 승격한다.

## 운영자 수동 checklist

실제 production resource 생성은 운영자가 명시적으로 수행한다.

1. `docs/development/future-production-deployment-inputs.md`의 runtime, account, network, DB, host, approval 결정을 확정한다.
2. 선택한 target에서 private managed PostgreSQL, backup/PITR, secret materialization을 준비한다.
3. Email sender identity, DKIM, production access를 준비한다.
4. Canonical domain, ingress, TLS 인증서 발급·갱신 경로를 준비한다.
5. Artifact publish, migration, role grant, rollout, readiness, traffic switch, rollback을 target-specific rehearsal로 검증한다.
6. `infra/runbooks/backup-restore-drill.md` 기준으로 release 전 backup/restore drill evidence를 남긴다.
7. Release 후 provider metric, app metric, alert, API/nginx log를 확인한다.

## 변경 이력

| 날짜       | 변경 내용                                                                                                                                                                                                                                                                | 관련 이슈                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| 2026-06-17 | BE API와 managed PostgreSQL production release readiness의 포함/제외, secret/SES/RDS/TLS/CI-CD/backup/release blocker 기준을 공식 정책으로 신설했다                                                                                                                      | production deployment readiness |
| 2026-06-17 | Env key registry, owner별 schema split, HTTP/email/secret-source config baseline을 production readiness config 정책에 반영했다                                                                                                                                           | production deployment readiness |
| 2026-06-17 | Secrets Manager reader/materializer boundary, env key별 secret name convention, AWS managed KMS 기본 정책을 production readiness config 정책에 반영했다                                                                                                                  | production deployment readiness |
| 2026-06-17 | SESv2 auth email sender adapter, production stub fail-fast, bounded provider error taxonomy, SES setup checklist를 production readiness 정책에 반영했다                                                                                                                  | production deployment readiness |
| 2026-06-17 | Health live/ready contract를 분리하고 readiness bounded 503, DB/config/secret/migration/email provider check 기준을 production readiness 정책에 반영했다                                                                                                                 | production deployment readiness |
| 2026-06-17 | RDS/Prisma migrate deploy/role grant smoke를 API rollout 전 production DB deploy gate로 고정했다                                                                                                                                                                         | production deployment readiness |
| 2026-06-17 | HTTP REST CORS allowlist, future cookie policy helper, nginx direct TLS 예시를 production ingress 정책에 반영했다                                                                                                                                                        | production deployment readiness |
| 2026-06-17 | 당시 GitHub Actions API CI와 production deploy 후보 경계를 정리했다. 미확정 target을 전제한 workflow와 provider 설정은 2026-08-06에 제거했다                                                                                                                             | production deployment readiness |
| 2026-08-06 | Production target 미확정 상태를 명시하고 CI와 local rehearsal만 현재 지원 범위로 유지했다. 향후 CD는 별도 input 문서가 소유하도록 정리했다                                                                                                                               | deployment boundary cleanup     |
| 2026-06-17 | RDS setup checklist, backup/restore drill runbook, restore drill smoke helper, manual restore drill workflow를 release gate에 반영했다                                                                                                                                   | production deployment readiness |
| 2026-06-17 | Production release checklist와 incident rollback runbook을 최종 release GO/NO-GO gate로 연결했다                                                                                                                                                                         | production deployment readiness |
| 2026-07-27 | 4GB/2vCPU App host + RDS를 초기 planning baseline으로 확정하고, Web/BackOffice/API/observability container별 resource 시작값과 AWS 공개 가격 기반 월 예산을 정리했다. Argon2id 19MiB queue microbenchmark와 237/946 cohort arrival-rate migration stress gate를 추가했다 | production capacity baseline    |
| 2026-08-01 | SES provider acceptance와 최종 delivery를 분리하고 Configuration Set event publishing, auth mail outbox metric scrape, reset abuse·mail failure·outbox lag alert rule을 release smoke에 추가했다                                                                         | auth security operations        |
| 2026-08-05 | 4GB/2CPU local constrained rehearsal의 engine preflight, API/nginx·관측 compose resource override, Auth capacity 실행·해석 경계를 문서화했다                                                                                                                             | auth capacity rehearsal         |
| 2026-08-05 | H1~H7/H9 local constrained evidence를 근거로 Argon2id 19MiB와 admission 기본값을 최초 배포 baseline으로 승인했다. H8 60분 soak와 별도 AWS/managed PostgreSQL reference stress는 수행하지 않은 accepted risk로 남기고 배포 후 운영 지표 재평가 조건을 명시했다.           | auth capacity decision          |
