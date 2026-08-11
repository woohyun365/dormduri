# Web Sentry managed release readiness handoff

## 목적

이 문서는 현재 세션에서 Sentry 계정을 만들거나 배포를 실행하기 위한 문서가 아니다. 모든 제품 구현이 끝난 뒤 실제 배포를 담당하는 세션이 Web 관측 release gate를 시작할 때 읽는 진입점이다.

배포 세션은 이 문서를 먼저 읽고 사용자에게 준비된 항목과 준비되지 않은 항목을 설명한다. 외부 계정, region, retention, domain, hosting target, secret 저장소를 추측하거나 임의로 생성하지 않는다.

## 현재 repository 상태

- account-free Sentry SDK·privacy·sampling·release contract 구현은 완료되어 있다.
- `pnpm web:sentry:rehearsal`은 외부 Sentry account 없이 실행할 수 있다.
- Production capture와 source-map upload는 managed evidence가 없으면 no-op이다.
- 실제 managed intake, source-map symbolication, provider-side privacy 설정은 아직 검증하지 않았다.
- 현재 component 상태는 실패가 아니라 배포 대상이 정해지지 않은 `PENDING_TARGET`다.

## 미래 배포 세션 읽기 순서

1. 이 문서에서 사용자 준비물을 확인한다.
2. [web-sentry-managed-observability.md](../../../operations/observability/browser-sentry.md)에서 runtime owner와 설정 경계를 확인한다.
3. [web-operational-observability.md](../../../operations/observability/web-bff.md)에서 Sentry와 BFF Loki/Grafana의 책임을 구분한다.
4. [web-sentry-managed-release-evidence.md](./evidence.md)를 해당 release의 secret-free 기록으로 복사하거나 채운다.
5. [Production release aggregate evidence](../../production-release-evidence.md)에 이 component
   evidence를 연결한다. 전체 release의 최종 판정은 aggregate evidence에서만 수행한다.

## 사용자에게 확인할 준비물

### Managed Sentry

- organization과 Web project를 생성할 권한
- 계정에서 실제 선택 가능한 region
- 요금제와 project에 적용되는 retention
- DPA/subprocessor 검토 결과 또는 담당자
- project 운영자와 최소 권한 역할
- 운영자 2FA 적용 여부
- token 발급·회전·폐기 담당자

### 배포 target

- `preview`와 `production` 사용 여부
- Web hosting target과 public HTTPS domain
- immutable release 기준: commit SHA 또는 image tag/digest
- build와 runtime 환경변수 주입 위치
- GitHub Actions 또는 동등한 CI secret 저장소
- Preview smoke 후 Production으로 승격하는 절차

### 관측 운영

- runtime error와 performance alert를 확인할 운영자
- 초기 quota와 성능 trace 10% sampling 수용 여부
- incident 연락 경로
- 개인정보 발견 시 ingest 중단·삭제 요청 책임자

## Secret과 공개 설정 경계

| 값                             | 공개 여부         | 주입 위치                    | 문서 기록                                    |
| ------------------------------ | ----------------- | ---------------------------- | -------------------------------------------- |
| `NEXT_PUBLIC_SENTRY_DSN`       | public            | Web build/runtime public env | 전체 값 기록 금지; project identifier만 기록 |
| `NEXT_PUBLIC_SENTRY_ENABLED`   | public            | Web build/runtime public env | `0` 또는 `1` 기록 가능                       |
| `NEXT_PUBLIC_SENTRY_*_ENABLED` | public            | Web build/runtime public env | 상태 기록 가능                               |
| `NEXT_PUBLIC_WEB_RELEASE`      | public            | Web build env                | immutable ID 기록 가능                       |
| `SENTRY_ORG`, `SENTRY_PROJECT` | server/build only | CI build env                 | identifier 기록 가능                         |
| `SENTRY_RELEASE`               | server/build only | CI build env                 | public release와 동일한 ID 기록 가능         |
| `SENTRY_AUTH_TOKEN`            | secret            | 보호된 CI secret             | 값·prefix·길이 기록 금지                     |

`SENTRY_AUTH_TOKEN`은 `NEXT_PUBLIC_*`, Docker build ARG, image ENV, terminal transcript, artifact, evidence 문서에 넣지 않는다.

## Release validation 순서

### 1. Account-free baseline 재확인

```bash
pnpm web:sentry:rehearsal
pnpm web:observability:rehearsal
```

- 첫 명령은 SDK, privacy, sampling, upload-disabled build, Storybook, standalone을 검증한다.
- 두 번째 명령은 BFF stdout → Alloy → Loki → Grafana와 Loki 장애 fail-open을 검증한다.
- 두 결과는 managed Sentry intake 성공을 의미하지 않는다.

### 2. Account-side privacy 설정

- Session Replay 비활성화
- user identity 설정 비활성화
- provider-side IP 저장 또는 scrub 정책 확인
- email, token, cookie, request body 등 data scrub rule 확인
- region, retention, operator role, 2FA 기록

### 3. Preview release 구성

- public DSN과 immutable public release 주입
- runtime error와 performance switch 활성화
- performance sample은 초기 `0.1` 사용
- 최소 권한 upload token을 build step에만 주입
- `SENTRY_RELEASE`와 `NEXT_PUBLIC_WEB_RELEASE` 일치
- Sentry ingest origin을 CSP `connect-src`에 반영

### 4. Build artifact 검증

```bash
pnpm web:build
pnpm web:sentry:verify-build
```

- source map upload 성공 여부는 CI/provider release 화면에서 identifier로 확인한다.
- public Web artifact와 image에는 `.map`과 token이 없어야 한다.
- upload token이나 원본 source map을 evidence에 첨부하지 않는다.

### 5. Managed smoke

- Client synthetic unexpected exception 1건
- Next.js server synthetic unexpected exception 1건
- Performance transaction과 LCP/INP/CLS sample
- 동일 release/environment/routeGroup 조회
- Minified stack이 원본 file/line으로 symbolicate되는지 확인
- 같은 Error가 중복 issue/event로 남지 않는지 확인

Synthetic error는 실제 사용자 데이터, 이메일, token, profile, chat, form 값을 사용하지 않는다.

### 6. Privacy negative 확인

Managed event 검색에서 다음 값이 없어야 한다.

- email·nickname·user/session identifier
- password·verification code·proof·grant·token·cookie
- URL query/hash와 request/response body
- profile·intro·chat·support/report 본문
- console argument와 Session Replay

### 7. Fail-open과 kill switch

- Runtime Error switch를 끈 상태에서도 navigation·form·BFF mutation이 정상인지 확인한다.
- Performance switch를 독립적으로 끌 수 있는지 확인한다.
- Provider 요청 실패가 사용자 응답을 실패시키지 않는지 확인한다.
- quota 압박 시 performance sampling부터 축소한다.

### 8. Owner 중복 확인

- Unexpected browser/Next exception과 sampled performance는 Sentry에서 조회한다.
- Expected BFF outcome·latency·request correlation은 Loki/Grafana에서만 조회한다.
- 제품 funnel이나 Main 기능 사용 분석을 Sentry event로 추가하지 않는다.

## Evidence 작성 규칙

각 항목에는 secret 대신 다음 정보만 남긴다.

- project·region·retention 등 secret-free identifier
- release SHA 또는 immutable image tag
- workflow run ID와 artifact ID
- synthetic event ID
- dashboard/query URL 또는 screenshot identifier
- pass/fail 판정과 실패 조치
- 검증 시각과 운영자

Raw event payload, DSN 전체 값, auth token, 실제 사용자 데이터는 남기지 않는다.

## 상태 전이

```text
PENDING_TARGET
  -> READY_FOR_VALIDATION
  -> PASS | FAIL | ACCEPTED_RISK
```

- `PENDING_TARGET`: 계정 또는 배포 target이 아직 준비되지 않았다. 실패 상태가 아니다.
- `READY_FOR_VALIDATION`: 사용자 준비물이 확인되어 managed smoke를 실행할 수 있다.
- `PASS`: 필수 managed evidence가 모두 통과했다.
- `FAIL`: 실제 검증을 수행했고 필수 component gate가 실패했다.
- `ACCEPTED_RISK`: 필수 안전 경계는 통과했고 owner·기한이 있는 비차단 후속 조치가 남았다.

전체 release의 `GO`, `NO_GO`, `GO_WITH_FOLLOW_UP`은 aggregate evidence에서만 판정한다.

## 중단 조건

다음 조건에서는 Sentry Production enable과 source-map upload를 진행하지 않는다.

- 계정·project·region·retention 책임이 확인되지 않음
- protected CI secret 주입 경로가 없음
- immutable release가 client/server/map에서 일치하지 않음
- Session Replay·user identity·provider privacy 설정이 확인되지 않음
- public source map 또는 token 누출
- managed client/server intake나 symbolication 실패
- provider 장애가 사용자 flow를 중단함

VPS의 Prometheus·Loki·Grafana private port, volume backup, disk alert, image pinning은 이 Sentry handoff가 아니라 Production Observability gate에서 별도로 판정한다.
