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
├── .env.api.lightsail.example       # Lightsail non-secret runtime projection
├── .env.api.migration.example       # deploy-time DB credential projection
├── .env.compose.example             # Compose interpolation projection
├── api/
│   ├── Dockerfile                   # non-root API image
│   ├── env.manifest.json            # API registry에서 생성한 value-free manifest
│   ├── secret-mount.contract.json    # required secret-per-file inventory와 permission contract
│   ├── entrypoint.sh                # runtime requirement fail-fast; migration 미실행
│   └── healthcheck.sh               # container health probe
├── web/Dockerfile                   # Next.js standalone image
├── nginx/                           # proxy, route, metrics allowlist, TLS example
└── scripts/
    ├── api-release-smoke.sh          # health/readiness/metrics smoke와 dry-run
    ├── materialize-api-secret-bundle.sh
    ├── verify-api-secret-bundle.sh
    └── install-api-secret-bundle.sh
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
- `.env.api.lightsail.example`: secret value와 AWS credential이 없는 Lightsail runtime 입력
- `.env.api.migration.example`: one-off migration/admin credential 이름
- `.env.compose.example`: image tag, nginx bind와 같은 Compose interpolation
- `api/env.manifest.json`: 값이 없는 machine-readable required/secret/target projection

`SECRET_SOURCE=env`에서는 entrypoint가 required runtime secret의 존재를 먼저 확인한다.
`SECRET_SOURCE=mounted-files`에서는 non-secret runtime key와 read-only mount contract만 entrypoint가
확인하고, 애플리케이션 bootstrap이 Nest module import 전에 file을 materialize한다. 이 경로가
Lightsail production 기본값이다. `SECRET_SOURCE=aws-secrets-manager`는 EC2/ECS처럼 안전한 AWS
credential-provider chain을 제공하는 runtime용 호환 adapter다.

Host release root는 `/var/lib/dormduri/secrets/api`, container mount는
`/run/secrets/dormduri-api`, API runtime UID/GID는 `10001:10001`이다. Candidate는 검증 후 설치하고
readiness 성공 뒤에만 `current` pointer를 atomic하게 전환한다. Secret bundle은 image, CI artifact,
release evidence에 포함하지 않는다.

실제 `.env.api`, DB URL, token과 provider secret은 커밋하지 않는다. `HTTP_TRUST_PROXY_*`, REST와
realtime origin처럼 target topology에 의존하는 key는 local 기본값을 production 결정으로 간주하지
않는다.

Web image는 공개 가능한 `NEXT_PUBLIC_*`만 build arg로 고정한다. Server runtime은 `WEB_APP_URL`,
`API_URL`, `WEB_OBSERVABILITY_ENVIRONMENT`, `WEB_RELEASE`와 BFF log 설정을 주입한다.
`SENTRY_AUTH_TOKEN`은 image layer나 build arg가 아니라 BuildKit secret mount로 source map upload
동안에만 제공한다.

## Candidate 검증

API Dockerfile의 `pnpm deploy --legacy --filter api --prod /workspace/runtime`은 dependency를 production runtime tree로
materialize하는 **격리된 image build stage** 전용 명령이다. 같은 검증을 active developer checkout에서 직접 실행하면
workspace의 development module state가 production-only 상태로 reconcile될 수 있으므로 Docker build 또는 disposable
copy/worktree를 사용한다. 오실행 시 복구 절차는
[`pnpm legacy deploy active checkout`](../../docs/development/troubleshooting/tooling/pnpm-legacy-deploy-active-checkout.md)을 따른다.

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
- `/health/ready`: 단일 DB connectivity·migration baseline probe와 runtime bootstrap receipt
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

## Single-public-ingress forwarding trust target

`ingress-trust`는 한 Nginx에서 public API/Web virtual host와 **서로 다른 address-bound private
BFF/observer listener**를 분리하는 후보다. 초기 target은 upstream CDN/LB 없이 Nginx가 TLS를 종료한다.
API/Web의 application port는 host에 publish하지 않으며 API는 `ingress-api`, Web은 `ingress-web`에만
참여한다. Nginx만 public/API/Web/observer 네 network를 연결한다. Bridge egress는 외부 DB/provider
호출을 위해 유지하며, workload에 Docker socket이나 host-network 권한을 주지 않는다.

- Public API/Web는 caller XFF를 `$remote_addr`로 덮어쓴다. `Forwarded`, X-Real-IP는 제거하고
  Host/XFH/proto는 canonical public authority와 선택한 외부 scheme으로 만든다.
- Private BFF는 Web network의 **8081**에만 bind하고 각 `/api/`, `/auth/` location에서 exact Web
  peer를 allow한 뒤 deny-all한다. 이미 Web에서 검증한 단일 XFF는 append 없이 유지한다.
  Web의 server-only `API_URL`은 이 private address다. Browser `/api/auth/*`와 legal BFF는 public Web로 간다.
- Nginx는 API/Web upstream destination 및 `proxy_bind` source를 명시한다. API trusted sender는
  Nginx API-transit peer의 `/32` 하나이며 hop-count와 broad observability subnet을 신뢰하지 않는다.
- Observer **9091**은 exact collector peer에게 `/internal/metrics`만 제공하고 API bearer token
  검증을 유지한다. Collector XFF는 제거한다. Public API metrics의 기존 allowlist/token 정책은
  유지하되 Web/private BFF에는 metrics를 노출하지 않는다.
- Public IPv6는 `publicIpv6Address`와 `networks.publicIpv6`를 함께 지정할 때만 활성화한다.
  Public listener/IPAM은 dual-stack이고 내부 transit은 IPv4다. IPv6 client identity를 단일 XFF로 보존한다.

### Renderer와 고정 Compose 순서

`node scripts/infra/ingress/render.mjs <input.json> [output-name]`은 명시적 입력만 검증하고
`resolveArtifactPath()` 아래 `infra/ingress-trust/<output-name>/`에 conf.d 및
`compose.networks.yml`을 쓴다. Container는 렌더된 conf.d를 read-only mount하며 시작 시 치환하지 않는다.

입력 필드:

- `mode`: `fixture-http` 또는 `production-https` (기본값 없음)
- `apiAuthority`, `webAuthority`: 서로 다른 lowercase DNS authority; port를 쓰면 선택한 public 80/443과 일치
- `publicAddress`, `privateAddress`, `apiSourceAddress`, `observerAddress`: Nginx의 네 IPv4 interface
- `apiAddress`, `apiPort`, `webAddress`, `webPort`: 각 transit의 application endpoint
- `webPeers`, `nginxPeers`: 각각 위 Web endpoint/Nginx API source 하나만 담는 exact IP 배열
- `collectorPeers`: observer subnet 내의 중복 없는 exact collector IP 배열
- `networks`: 겹치지 않는 canonical `public`, `api`, `web`, `observer` IPv4 CIDR
- optional IPv6 pair: `publicIpv6Address`, `networks.publicIpv6`
- HTTPS 필수 `tls.api`/`tls.web`: 각각 `certificatePath`, `keyPath`; container의
  `/etc/nginx/ingress-tls/` 아래 파일 경로. 실제 인증서 내용은 renderer가 읽거나 생성하지 않는다.

Unknown key, injection, unresolved token, wildcard/zone address, subnet overlap, gateway/다른 subnet의
peer와 불일치 profile은 거절한다. `.1`은 각 bridge gateway를 위해 예약한다. 입력 subnet의 **실제 host
route/Docker network 충돌 및 실제 참여 container inventory**는 별도 runtime/release preflight가 확인한다.

고정 순서는 다음과 같다.

1. `infra/deploy/compose.api.yml`
2. `infra/rehearsal/compose.web.yml` (기존 Web service 재사용)
3. `infra/deploy/compose.ingress-trust.yml` (ports/network/volume 명시적 reset/replace)
4. renderer가 반환한 `composeOverridePath` (`compose.networks.yml`, 필수)
5. account-free 검증에서만 `infra/rehearsal/compose.ingress-trust.fixture.yml`

`buildIngressComposeArgs(composeOverridePath, composeArgs, { projectName, fixture })`가 이 순서를
강제한다. `writeIngressConfig(input, { outputName })`의 `composeEnvironment`를 명령 환경에 적용한다.
HTTPS에서는 별도로 승인된 host 인증서 디렉터리를 `INGRESS_TLS_DIRECTORY`에 지정한다. HTTP fixture만
빈 TLS mount 디렉터리를 만든다. Publish는 기본 loopback이며 `INGRESS_PUBLIC_BIND`,
`INGRESS_PUBLISHED_PORT`는 release/fixture operator 입력이다.

Generated network overlay를 빼면 undefined network로 `docker compose config`가 실패한다. 일반
profile helper의 고정 세 파일만으로 시작하지 않는다. IPv4-only output에는 빈 IPAM 항목이 없고,
dual-stack public IPAM에는 지정한 IPv4/IPv6 CIDR만 들어간다. Legacy DB/runtime/stress/standalone
Web-upstream overlay는 이 target에 합성하지 않는다. Compose의 `!override` 지원 버전은
[공식 merge 규칙](https://docs.docker.com/reference/compose-file/merge/)을 따른다.

### Release readiness와 rollback

로컬 renderer/Compose 검증은 배포 승인이나 관찰된 isolation 증거가 아니다. Release 전에 실제
hostname/certificate, ingress source address, public/private/observer ACL, API/Web 비노출, IPv4/IPv6
client 분리, spoof-prefix 불변 bucket, direct/BFF/WS transport 및 cleanup 증거를 수집한다.
승인되지 않은 peer/network member나 CDN/LB·host 분할이 있으면 forwarding trust 활성화는 NO-GO다.
Host/root/network-admin compromise까지 bridge 격리가 방어한다고 주장하지 않는다.

이 trust profile은 API/Web/Nginx를 함께 일치시켜 rollout/rollback한다. 안전한 이전 candidate로
돌아갈 때는 Web private URL과 API HTTP/chat trust 설정도 함께 복구한다. Source-only 수정으로 실제
rollout이 완료됐다고 기록하지 않으며 secret/DB/state를 이 경계의 rollback 대상으로 삼지 않는다.
