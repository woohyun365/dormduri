# Web 운영 관측성 경계

## 목적

Web 운영 관측성은 Landing, Auth, Main에서 발생하는 장애와 실제 사용자 성능을 확인하기 위한 운영 데이터만 소유한다. 제품 기능 사용 분석, 사용자 funnel, session replay, DOM autocapture는 이 경계에 포함하지 않는다.

## 책임 분리

| owner                 | 실행 위치                                              | 책임                                                                   |
| --------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------- |
| Client runtime        | `instrumentation-client.ts`, App Router error boundary | 예상하지 못한 render/runtime 오류 capture와 복구 UI                    |
| Web Vitals            | `observability/web-vitals/**`                          | LCP, INP, CLS와 보조 지표의 field measurement                          |
| BFF reliability       | `app/api/_bff/reliability.ts`                          | operation, outcome, status class, duration, correlation structured log |
| Operational facade    | `observability/operational/**`                         | schema, privacy guard, queue, sampling, adapter fail-open              |
| Production operations | managed browser provider + Loki/Grafana                | browser error/RUM 조회와 server BFF log 조회                           |

Feature Component와 hook은 provider SDK를 직접 import하지 않는다. 관측 실패는 화면 상태, navigation, form submit, API mutation 결과를 바꾸지 않는다.

## Event catalog

모든 event의 `schemaVersion`은 현재 `1`이다.

| event                       | owner                         | 주요 allowlisted field                                        | 금지 데이터                            |
| --------------------------- | ----------------------------- | ------------------------------------------------------------- | -------------------------------------- |
| `web_runtime_error`         | client runtime/error boundary | source, severity, normalized errorType, fingerprint, recovery | raw message/stack, props, form 값      |
| `web_bff_request_completed` | BFF reliability               | operation, outcome, statusClass, durationMs, authenticated    | URL/query/body/header/cookie/token/IP  |
| `web_vital_measured`        | Web Vitals                    | LCP/INP/CLS/TTFB/FCP, value, rating, routeGroup, deviceClass  | attribution 값, raw URL, user identity |

`requestId`는 server structured log의 correlation field로만 허용한다. browser RUM payload와 metric label에는 넣지 않는다.

## Route와 device dimension

- route: `landing`, `login`, `signup`, `password_reset`, `main_home`, `main_roommate`, `main_matching`, `main_chat`, `other`
- device: `mobile`, `tablet`, `desktop`
- environment: `local`, `preview`, `production`

Raw pathname, query, hash, path parameter를 dimension으로 만들지 않는다. BFF operation은 route owner가 선언한 낮은 cardinality key만 사용한다.

## Privacy guard

Serializer는 다음 field를 포함한 후보 event를 sink 전달 전에 거부한다.

- 계정/인증: email, nickname, password, verification code, proof, grant, token
- transport: Authorization, cookie, forwarded IP, user-agent
- payload: request/response body, intro, profile, chat
- identity: raw userId, sessionId

Error message와 stack은 fingerprint 계산에만 메모리에서 사용하고 operational event에는 포함하지 않는다. Source map은 provider artifact로만 업로드하며 public source map 생성은 release config로 명시적으로 활성화한다.

## Delivery와 sampling

- client queue는 memory에서 최대 50건만 유지한다.
- 동일 runtime error는 page lifecycle에서 fingerprint/source/action 기준으로 중복 제거한다.
- runtime fatal/error는 수집 활성화 시 100% 전달한다.
- BFF error는 100%, success는 기본 25% deterministic sampling을 사용한다.
- Core Web Vitals는 기본 100%, TTFB/FCP는 기본 25%다.
- adapter의 throw/reject는 무시하며 제품 코드가 telemetry Promise를 기다리지 않는다.

## Production enable gate

Browser operational telemetry는 다음 항목이 모두 준비된 경우에만 활성화한다.

1. managed provider와 HTTPS intake endpoint 결정
2. 처리 목적, subprocessor/region, operator access 검토
3. 보존 기간 주입
4. release identifier와 source map artifact 연결
5. CSP `connect-src` allowlist 반영
6. synthetic runtime error와 Core Web Vitals smoke

필수 공개 설정이 누락되면 adapter는 no-op으로 유지된다. BFF structured log는 production에서 기본 활성화하고 기존 container stdout → Alloy → Loki 경로를 사용한다.

## Release 기준

- LCP p75 `<= 2.5s`
- INP p75 `<= 200ms`
- CLS p75 `<= 0.1`
- routeGroup/deviceClass/7일 기준 최소 100 page view 미만은 참고값으로만 사용
- fatal error rate, BFF 5xx/timeout, Core Web Vitals regression은 symptom 중심 alert 후보

Browser provider가 아직 연결되지 않은 환경에서는 typed schema, recording adapter, synthetic local test까지만 검증하며 production GO 근거로 사용하지 않는다.
