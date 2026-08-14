# Web 운영 관측성 경계

## 목적

Web 운영 관측성은 Landing, Auth, Main에서 발생하는 예상하지 못한 오류와 실제 사용자 성능, BFF 신뢰성을 확인하기 위한 운영 데이터만 소유한다. 제품 기능 사용 분석, 사용자 funnel, Session Replay, DOM autocapture는 이 경계에 포함하지 않는다.

## 책임 분리

| owner              | 실행 위치                                                                    | 책임                                                                   | 저장·조회                                 |
| ------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------- |
| Sentry runtime     | `instrumentation-client.ts`, `instrumentation.ts`, `observability/sentry/**` | client/server/edge unexpected exception, release, scrubbed stack       | managed Sentry project                    |
| Sentry performance | `@sentry/nextjs` tracing                                                     | sampled page/navigation performance와 Core Web Vitals                  | managed Sentry project                    |
| Local diagnostics  | `observability/operational/**`, `observability/web-vitals/**`                | test·Storybook·local recording/debug                                   | memory/console only                       |
| BFF reliability    | `app/api/_bff/reliability.ts`                                                | operation, outcome, status class, duration, correlation structured log | container stdout → Alloy → Loki → Grafana |

Sentry SDK 직접 import는 `observability/sentry/**`와 Next instrumentation 경계에서만 허용한다. Feature Component와 hook은 provider SDK를 직접 호출하지 않는다. 관측 실패는 화면 상태, navigation, form submit, API mutation 결과를 바꾸지 않는다.

## Browser event 경계

### Sentry에 허용

- exception type, handled 여부, scrub된 stack의 파일·함수·줄·열
- bounded `routeGroup`, `deviceClass`, `runtime`, `source`, `recoveryAction`
- immutable release, `local|preview|production` environment
- sampled transaction과 Web Vitals 성능 값

### Sentry에 금지

- raw error message와 component props
- email, nickname, user/session identifier
- password, verification code, proof, grant, token, cookie, Authorization header
- URL query/hash, request/response body, form value
- profile, intro, chat, support/report 본문
- console argument, Session Replay, DOM/heatmap autocapture

Stack은 symbolication에 필요한 위치 필드만 유지하고 source context·local variable은 제거한다. `sendDefaultPii`는 비활성화하고 user identity를 설정하지 않는다.

## Route와 device dimension

- route: `landing`, `login`, `signup`, `password_reset`, `main_home`, `main_roommate`, `main_matching`, `main_chat`, `other`
- device: `mobile`, `tablet`, `desktop`
- environment: `local`, `preview`, `production`

Raw pathname, query, hash, path parameter를 transaction name이나 tag로 사용하지 않는다. BFF operation은 route owner가 선언한 낮은 cardinality key만 사용한다.

## 수집과 중복 방지

- 전역 browser error와 unhandled rejection은 Sentry automatic integration이 소유한다.
- App Router route/global error boundary만 복구 metadata를 포함한 explicit capture를 수행한다.
- 같은 `Error` instance의 explicit capture는 page lifecycle에서 한 번만 허용한다.
- expected form/domain/BFF response error는 UI feedback owner가 처리하며 Sentry issue로 만들지 않는다.
- production manual RUM external delivery는 두지 않는다. 기존 Web Vitals reporter는 local/test 진단 전용이다.
- BFF expected outcome과 latency는 Loki가 소유하고, unexpected Next server exception만 Sentry가 소유한다.

## Sampling과 release

- runtime exception: 활성화된 환경에서 100%
- performance trace: production 초기값 10%, 독립 kill switch 제공
- release: commit SHA 또는 immutable image tag
- low traffic p75: `routeGroup/deviceClass` 7일 창 최소 100 page view 미만은 참고값
- 목표: LCP p75 `<= 2.5s`, INP p75 `<= 200ms`, CLS p75 `<= 0.1`

## Production enable gate

Browser Sentry는 다음 항목이 모두 준비된 경우에만 활성화한다.

1. managed project와 HTTPS DSN
2. 개인정보 검토, region·retention·subprocessor·operator evidence
3. immutable release와 private source-map upload
4. CSP `connect-src` 반영
5. synthetic client/server exception과 performance intake
6. kill switch와 provider 장애 fail-open smoke

계정 evidence가 없으면 production capture와 source-map upload는 비활성화된다. Local/test는 외부 네트워크가 없는 recording transport로 privacy·dedupe·sampling을 검증한다. 미래 배포 세션은 `infra/runbooks/release/components/web-sentry/readiness.md`를 시작점으로 사용하고, 실제 managed 결과만 release evidence에 기록한다. BFF structured log는 production에서 기본 활성화하고 container stdout → Alloy → Loki 경로를 사용한다.
