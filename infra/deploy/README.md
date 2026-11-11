# Runtime container candidates

`infra/deploy`는 app image(API·Web)와 host 묶음을 소유한다. User App host 묶음 `user/`는 Web 묶음(ingress와 Web)과 API
묶음(`user/api/`: API와 migrate one-off)의 두 compose 조각이고, 조각마다 SSM document가 따로 배포한다. API와 그
nginx(`compose.api.yml`, `nginx/`)는 API 개발 rehearsal(stress, full-stack)이 쓰는 **production-neutral runtime
candidate**로 남는다. 구조 원칙은
[Production runtime topology](../../docs/architecture/platform/production-runtime-topology.md#repository와-deploy-구조-목표)가
소유한다. Local resource limit, disposable DB와 관측 network는 `infra/rehearsal/README.md`가 소유하며 이
디렉터리에는 자동 합성하지 않는다.

Web 단계의 hosting target·registry·전달 경로는 [Production environment](../../docs/deploy/production-environment.md)가
적는다. Web·ingress image를 build·publish하고 배포 명령을 부르는 것은 CD workflow
[`web-cd.yml`](../../.github/workflows/web-cd.yml)이고, 그 실행 절차는
[Web 단계 배포](../runbooks/release/web-stage-deploy.md)가 소유한다. API·migrate image와 API 배포 명령은
[`api-cd.yml`](../../.github/workflows/api-cd.yml)과 [API 단계 배포](../runbooks/release/api-stage-deploy.md)가 같은 방식으로
맡는다. Host에서 할 일은 아래 [User host 묶음](#user-host-묶음)의
SSM document가 정한다.

## 자산과 책임

```text
infra/deploy/
├── web/Dockerfile                   # Next.js standalone image
├── user/                            # User App host 묶음
│   ├── compose.yml                  # Web 묶음 조각: web·ingress service와 hardening
│   ├── ingress/                     # ingress image: nginx.conf, conf.d/, snippets/, html/(정적 안내 화면 넷)
│   ├── ssm/                         # lib.sh(두 document 공통), deploy.sh(원본)와 dormduri-web-deploy.json(생성본)
│   └── api/
│       ├── compose.yml              # API 묶음 조각: api service와 migrate one-off(profile migrate)
│       └── ssm/                     # deploy-api.sh·secret_bundle.py(원본)와 dormduri-api-deploy.json(생성본)
├── compose.api.yml                  # API + nginx runtime candidate
├── .env.api.example                 # API runtime env projection
├── .env.api.lightsail.example       # Lightsail non-secret runtime projection
├── .env.api.migration.example       # deploy-time DB credential projection
├── .env.compose.example             # Compose interpolation projection
├── api/
│   ├── Dockerfile                   # non-root API image(target runtime)와 migrate image(target migrate)
│   ├── migrate-entrypoint.sh        # migrate image의 one-off 단계(migrate·grant·smoke·outbox)
│   ├── rds-ca-bundle.sha256         # image에 넣는 RDS CA 묶음과 단일 루트의 sha256
│   ├── env.manifest.json            # API registry에서 생성한 value-free manifest
│   ├── secret-mount.contract.json    # required secret-per-file inventory와 permission contract
│   ├── entrypoint.sh                # runtime requirement fail-fast; migration 미실행
│   └── healthcheck.sh               # container health probe
├── nginx/                           # API candidate의 proxy, route, metrics allowlist, TLS example
└── scripts/
    ├── api-release-smoke.sh          # health/readiness/metrics smoke와 dry-run
    ├── materialize-api-secret-bundle.sh
    ├── verify-api-secret-bundle.sh
    └── install-api-secret-bundle.sh
```

배포·publish·host role과 ECR 수명 정책의 원본은 계정 resource라 [`infra/aws/`](../aws/README.md)에 둔다.

`compose.api.yml`은 API와 nginx의 공통 runtime shape만 정의한다. 다음 항목은 다른 owner가 합성한다.

- product container resource budget, network overlay: `infra/rehearsal/`
- disposable PostgreSQL 18: `infra/rehearsal/compose.postgres.yml`
- stress-only throttle: `apps/api/test/stress/docker/compose.stress.yml`
- observability topology: `infra/observability/`
- migration과 role grant: `infra/db/`

## User host 묶음

### 경로와 응답

Ingress(`user/ingress/conf.d/dormduri.conf`)는 apex `dormduri.com`만 받는다. `www`는 apex로, HTTP는 HTTPS로
301 redirect한다(HTTP-01 ACME 경로 제외). 모르는 host는 연결을 끊는다(HTTP 444, TLS handshake 거부).

| 요청                                                                                                        | 응답                                            |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `/`, `/privacy`, `/terms`, `/_next/static/*`, `/_next/image`, `/robots.txt`, `/sitemap.xml`, `/icon.png`    | Web으로 전달                                    |
| `/login`, `/signup`, `/password-reset`, `/main`, `/notifications`, `/support`, `/notices`, `/api`와 그 아래 | 503 준비 중(`Retry-After: 3600`)                |
| 그 밖의 경로                                                                                                | 404 찾을 수 없음                                |
| Web이 502·504로 실패                                                                                        | 503 일시적 오류(`Retry-After: 60`)              |
| 점검 flag(host `/opt/dormduri/mode/maintenance`)가 있을 때                                                  | 모든 공개 경로 503 점검 중(`Retry-After: 3600`) |

- 모든 응답에 `X-Robots-Tag: noindex`를 붙이고, HTTPS 응답에는 HSTS·`nosniff`·frame 거부·Referrer-Policy header도 붙인다
  (HTTP의 301·ACME 응답은 noindex만). Method와 상관없이 같은 화면을 낸다. 정적 화면의 내부 경로 `/__pages/`는 밖에서
  요청하면 404다.
- Web에는 nginx가 판정한 정규화 경로만 보낸다(`/notices/..%2F` 같은 부호화 slash·dot segment는 `/`로 간다). Decode 뒤
  제어·공백 문자나 `%`·`?`·`#`가 남는 경로는 Web 요청 줄을 바꿀 수 있으므로 nginx 기본 400으로 끝낸다.
- Web 허용 목록과 준비 중 경로는 `apps/web/src/app`의 route 파일에서 유도해 대조한다(`scripts/infra/user-host/web-routes.mjs`,
  `ingress-config.test.mjs`). Web에 page를 더하면 이 test가 실패하므로 ingress 설정도 함께 고친다. Route 파일이 바뀌면 CI
  infra lane도 돈다.
- 공개 `/api`와 그 아래는 JSON 503 준비 중이다(Web의 BFF 경로가 열리기 전). API는 공개 listener에 닿지 않는다.
- Web의 `API_URL`은 ingress의 private listener `http://ingress:8081`이다. 이 listener는 Web 주소(Web transit의 고정 주소)와
  loopback만 받고(`allow`·`deny all`), `/internal/` 아래(대소문자 무관)를 404 JSON으로 막은 뒤 나머지를 API(`api:4000`)로 넘긴다. API가
  없거나 내려가 있으면 503 JSON(`{"status":"unavailable"}`)이다. Forwarding header는 비워 보낸다.
- 접속 log는 client IP를 가린 값(IPv4 /24·IPv6 /48), query string을 뗀 경로, user agent, `X-Request-Id`만 남기고 referer를
  남기지 않는다(`user/ingress/nginx.conf`, 정책은 `docs/policies/operational-observability.md` OO-R1). Error log는 nginx가 줄마다
  원본 client 주소·요청 줄·referrer를 붙이므로 alert 이상만 쓴다. Web·API 실패 원인은 접속 log 상태와 각 service log로 본다.

### Network와 host 경로

- Compose project는 `dormduri-web` 하나다. 두 document는 지금 기록된 두 조각을 함께 넘겨 compose를 부르되 자기 묶음의
  service만 `up`·`stop`·`rm`하고 project 전체 `down`은 쓰지 않는다. `--remove-orphans`는 두 조각을 다 넘긴 `up`에서만 쓴다.
- Web transit(`web-transit`, Web과 ingress에 고정 주소)은 Web 조각이 만들고, API transit(`dormduri-api-transit`, external)은
  두 document가 compose 전에 없을 때만 고정 subnet으로 만든다. 값은 `user/compose.yml`(Web)·`user/ssm/lib.sh`(API)에 있고
  `scripts/infra/user-host/compose-contract.mjs`가 render 결과와 lib.sh 값을 계약과 대조하며, 두 대역이 서로·Docker 기본 주소
  pool·AWS 기본 VPC 대역과 겹치지 않는지 본다. 이름은 같은데 subnet이 다르면 아무것도 바꾸지 않고 exit 2다.
- Host 경로: `/opt/dormduri/state`(root 0700, 기록·lock·host log), `/opt/dormduri/releases/{web,api}/<release>`(release마다
  쓴 compose 조각), `/opt/dormduri/secrets/api/releases/<release>`(API secret, `infra/aws/secrets-manager-checklist.md`),
  `/opt/dormduri/{tls,acme-webroot,mode}`(Web 묶음).

### 배포 명령(SSM document)

- `user/ssm/deploy.sh`가 원본이다. `node scripts/infra/user-host/ssm-document.mjs`가 이 파일, 공통 `user/ssm/lib.sh`와
  `user/compose.yml`을 묶어 `user/ssm/dormduri-web-deploy.json`을 만든다. 생성본은 손으로 고치지 않고 prettier에서 제외한다(내용이 바뀌면 AWS
  document version이 바뀐다). `--check`는 다시 쓰지 않고 원본과 같은지만 본다.
- 입력은 `action`(`deploy`·`rollback`·`maintenance`)과 `webDigest`·`ingressDigest`(`sha256:` 뒤 64자)뿐이다. 형식이 틀리면
  Docker·AWS에 닿기 전에 exit 2, 다른 실행이 host lock을 잡고 있으면 exit 75로 끝난다. 표준 출력에는 `RESULT` 줄과
  digest만 쓰고 registry 주소가 든 출력은 root 전용 host log에만 남긴다.
- `deploy`는 새 digest 쌍을 올리고 health와 경로별 smoke(`/`·`/privacy`·`/terms` 200, `/signup` 준비 중 503, 없는 경로
  404)를 본다. 실패하면 직전 쌍으로 되돌리고, 직전 쌍이 없으면(첫 배포) 점검 mode로 둔다. Host 상태는
  `/opt/dormduri/state/{current,previous}`다. 기록마다 그 release의 조각 경로와 형식 표지(`recordFormat=2`)를 쓴다. 조각 경로가
  없는 옛 기록은 처음 만났을 때 옛 compose 파일을 `releases/web/legacy-*`로 복사해 채택하고, 옛 형식으로 되돌린 동안은
  표지 없이 둔다(API document가 이 표지로 Web 상태를 본다).
- `rollback`은 입력 쌍이 host의 `previous`와 같을 때만 실행한다. 성공하면 `current`를 그 쌍으로 바꾸고 `previous`를
  비운다(되돌린 쌍을 다음 rollback 대상으로 두지 않는다. 다시 되돌리려면 새 배포가 필요하다). `maintenance`는 점검 flag를
  켜고 ingress만 남긴다.

### API 배포 명령(SSM document)

- `user/api/ssm/deploy-api.sh`가 원본이다. 같은 생성 script가 이 파일, 공통 `user/ssm/lib.sh`, `user/api/compose.yml`,
  `secret_bundle.py`와 `api/secret-mount.contract.json`을 묶어 `user/api/ssm/dormduri-api-deploy.json`을 만든다. 두
  document는 64 KB 한도 안이어야 하고, 생성 script가 넘으면 멈춘다.
- 입력은 `action`(`deploy`·`rollback`·`maintenance`)과 `apiDigest`·`apiMigrateDigest`다. Web document와 같은 host lock을 쓴다.
- `deploy` 순서: Web 기록 확인(옛 형식이거나 점검 mode면 exit 2) → secret 꺼내기·설치 → migrate image one-off
  `migrate`·`grant`·`smoke`·`outbox` → 옛 API 정지 → 새 API 시작 → readiness → host 안 smoke(private listener를 거친 공개 열람
  응답, `/internal/metrics` 404) → `current` 갱신. 실패 처리와 DB 경계는 `infra/db/README.md` Release order와
  `infra/runbooks/incidents/release-rollback.md`가 소유한다.
- `rollback`은 host의 `previous`와 같은 digest 쌍으로만, migrate 단계 없이 되돌린다. `maintenance`는 API를 내린다.

### Local rehearsal과 검사

- `pnpm infra:compose -- user-host-rehearsal <compose 명령>`: 운영 compose에
  [`infra/rehearsal/compose.user-host.yml`](../rehearsal/compose.user-host.yml)을 덮어 local build image·시험 인증서·
  loopback port로 띄운다. `USER_HOST_REHEARSAL_ROOT`가 `acme-webroot`·`tls`·`mode` 폴더가 있는 local 경로를 가리켜야 한다.
- `pnpm infra:check:static`: rehearsal render가 운영 render와 build·loopback port·host 경로 source에서만 다른지 비교,
  compose 구조 계약(`scripts/infra/user-host/compose-contract.mjs`. Web publish 없음, read-only
  root, capability 모두 제거, memory Web 320MiB·ingress 96MiB, log 회전), ingress 설정 test, document 생성본 일치.
- `pnpm infra:check:runtime`: ingress image build와 `nginx -t`, stub Web 뒤에서 경로마다 status·title·header를 실제로
  요청하는 smoke, 일회용 container에서 document 실행(입력 거부와 host lock, 그리고 가짜 `docker`·`aws`·`curl` 위에서 배포
  성공·기동 실패와 smoke 실패의 자동 복귀·rollback 입력 대조·첫 배포 실패의 점검 mode, 그리고 rollback 대상 기동 실패·
  새 쌍과 현재 쌍이 모두 실패·점검 mode의 ingress 기동 실패를 exit code와 host 상태 파일로 판정).
  API document도 같은 방식으로 Web 상태·입력 거부, secret 꺼내기·설치 실패, migrate·outbox 실패의 rollout 없음, 기동·smoke
  실패의 되돌림, rollback, 단계 순서, 출력의 secret 값 없음과 두 묶음의 서로 건드리지 않음을 판정한다. 같은 document 실행은
  `node scripts/infra/user-host/ssm-document-runtime.mjs`로 따로 돌릴 수 있다.
- 실제 Web image로 같은 smoke를 돌릴 때: `node scripts/infra/user-host/ingress-smoke.mjs --web-image=<local image>`.

## 정적 안내 화면

`user/ingress/html/`의 네 파일은 nginx가 Web을 거치지 않고 직접 내보내는 안내 화면이다. Ingress image가
`/__pages/` 아래 내부 경로로 넣고, 위 [경로와 응답](#경로와-응답) 표대로 연결한다.

| 파일               | 화면         | 내보내는 때                              | 응답                      |
| ------------------ | ------------ | ---------------------------------------- | ------------------------- |
| `coming-soon.html` | 준비 중      | 뒤 단계에서 열 경로(가입·로그인 등)      | 503                       |
| `maintenance.html` | 점검 중      | 점검 mode(모든 경로)                     | 503                       |
| `unavailable.html` | 일시적 오류  | Web이 응답하지 못할 때, nginx 자체 500   | 503(nginx 자체 500은 500) |
| `not-found.html`   | 찾을 수 없음 | 허용 목록에도 열 예정 경로에도 없는 주소 | 404                       |

- Web이 내려가도 떠야 하므로 각 파일은 한 파일로 끝난다. CSS는 파일 안 `<style>` 하나이고 네 파일이 같은
  `<style>`을 쓴다. JavaScript, 외부 CSS·글꼴·그림, 외부 주소가 없고 그림은 `data:` URI뿐이다.
  `scripts/infra/user-host/static-pages.test.mjs`가 이 형식과 화면별 링크를 검사한다. 이 test는 쓸 수 있는 tag·속성·CSS
  함수를 허용 목록으로 정하므로, 새 요소가 필요하면 그것이 아무것도 받아 오지 않는지 확인한 뒤 test 목록에 더한다.
- 색과 로고는 Web 원본을 복사했다. Landing 어두운 palette(`apps/web/src/styles/tokens/tokens.generated.css`),
  곰 mark(`apps/web/src/screens/ui/brand/art/logo-mark.png`를 96px로 줄인 PNG), 손글씨 글자
  (`apps/web/src/screens/ui/brand/BrandLogo.tsx`의 SVG path)다. 로고나 palette를 바꾸면 이 네 파일도 함께 고친다.
  곰 mark는 macOS에서 `sips -Z 96 apps/web/src/screens/ui/brand/art/logo-mark.png --out <임시 파일>`로 줄이고
  `base64 -i <임시 파일>` 출력을 `data:image/png;base64,` 뒤에 넣는다. 네 파일의 그림은 이 명령으로 만들었다.
- Storybook과 자동 시각 비교에 들어가지 않는다. 화면을 고치면 로컬 nginx가 실제로 내보낸 화면을 데스크톱과
  360×640으로 찍어 사람이 확인한다.
- nginx가 요청 자체를 거절하는 400·413·414·494는 이 화면으로 보내지 않고 nginx 기본 응답으로 둔다. 그 응답과
  Landing 단계에서 생기지 않는 응답(요청 과다, API 오류 형식 등)은 #820이 다룬다.

## 제공하지 않는 기능

- provider/instance/network provisioning
- production secret 생성 또는 credential rotation
- API candidate의 traffic 전환과 automated rollback(user host 묶음의 되돌림은 SSM document가 한다)
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

User host의 secret root는 `/opt/dormduri/secrets/api`(root 0700)다. API document가 release마다
`releases/<release>`(디렉터리 0500·파일 0400, 소유 `10001:10001`)에 설치·검사하고 그 디렉터리를 container의
`/run/secrets/dormduri-api`에 read-only로 mount한다. API runtime UID/GID는 `10001:10001`이다. `current` symlink는 readiness와
host 안 smoke가 통과한 뒤에만 atomic하게 바뀌고, current와 직전 성공 release 둘만 남는다
(`infra/aws/secrets-manager-checklist.md`). Secret bundle은 image, CI artifact, release evidence에 포함하지 않는다.

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
stress·rehearsal secret surface를 포함하지 않는다. API runtime image는 `pnpm deploy` 결과의 `package.json`·`node_modules`와 build한
`dist`·`prisma`만 담고 `apps/api`의 source·test·개발 설정은 담지 않는다. migrate image는 npm cache와 `ssl-cert`의 snakeoil key를
지운다. 두 image는 push 전에 image secret scan(`scripts/infra/user-host/image-secret-scan.mjs`)을 통과한다.

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
