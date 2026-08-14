# Frontend plan authoring

`apps/web`의 Next.js UI, BFF, interaction, design system과 browser runtime이 primary owner인 계획에 사용합니다.
[Core](./core.md)를 먼저 읽습니다.

## Product and policy surface

- 사용자 목표와 화면이 소유하는 정보·action을 정의합니다.
- season, registration, permission, loading, empty, stale, error, blocked, terminal 상태를 state matrix로 만듭니다.
- UI gating은 UX 표현이며 최종 action precondition은 API owner가 검증하도록 분리합니다.
- policy copy, shared contract, BFF mapper, API response가 같은 의미를 사용하는지 확인합니다.

## Next.js, React, and BFF boundary

- current lockfile과 Next.js/React 공식 문서로 실제 version behavior를 확인합니다.
- Server Component는 data access·initial shell에, Client Component는 interaction이 필요한 최소 경계에 둡니다.
- BFF는 cookie/auth, upstream allowlist, privacy shaping, error translation 책임이 있을 때만 둡니다.
- Server Action, Route Handler, client fetch 중 선택은 auth, CSRF, cache, rate limit, error semantics를 비교합니다.
- server/client module graph, serialization, hydration, navigation과 modal/scroll ownership을 명시합니다.

## State, form, mutation, and cache

- source state, derived state, URL state, server cache, ephemeral UI state를 구분합니다.
- form은 validation, pending, duplicate submit, retry, focus, error announcement, browser autofill을 포함합니다.
- optimistic update는 rollback과 server conflict semantics가 명확할 때만 사용합니다.
- invalidation, refresh, back/forward, stale response, abort/race가 user-visible state와 일치하는지 확인합니다.

## Accessibility and responsive interaction

- semantic HTML, label, keyboard order, visible focus, modal focus trap/restore, live status를 acceptance에 포함합니다.
- 320px mobile, tablet landscape, desktop, zoom/reflow, safe area와 virtual keyboard를 점검합니다.
- sticky/fixed/portal/scroll lock은 실제 scroll owner와 stacking context를 근거로 설계합니다.
- disabled action은 이유를 전달하고, information card를 disabled button처럼 오해하게 만들지 않습니다.

## Visual and component boundary

- existing production component, token, layout owner를 먼저 재사용합니다.
- 공통화는 외형 유사성이 아니라 semantics, interaction, state contract가 같은 경우에만 수행합니다.
- page/flow/domain UI/shared primitive의 owner를 구분하고 단순 re-export와 god component를 피합니다.
- Storybook fixture는 production controller/contract를 우회하는 별도 behavior owner가 되지 않습니다.

## Performance and browser reliability

- LCP, INP, CLS, hydration cost, route transition, bundle/image/font/CSS loading 후보를 점검합니다.
- error boundary, browser runtime error, Web Vitals, BFF failure telemetry의 현재 owner와 개인정보 경계를 확인합니다.
- 성능 최적화는 측정 가능한 bottleneck 또는 target budget에 연결하며 유행성 library를 먼저 도입하지 않습니다.

## Security and privacy

- XSS, open redirect, cookie/token exposure, sensitive payload logging, enumeration copy를 점검합니다.
- profile/chat/analytics/observability payload는 공개 범위와 최소 수집 원칙을 유지합니다.
- auth, PII, moderation, legal surface이면 [Security and privacy](./cross-cutting/security-privacy.md)를 추가합니다.

## Frontend verification

- pure logic: unit test
- component state and interaction: Vitest + Testing Library
- production controller and Storybook parity: shared fixture/interaction test
- navigation, browser API, responsive modal/scroll: Playwright when risk justifies it
- accessibility: semantic query, keyboard/focus test, 필요 시 automated scan
- BFF contract: route test + shared schema + upstream failure cases
- visual changes: production surface and Storybook consistency, bounded screenshot evidence

Plan은 target component tree, server/client/BFF boundary, UI state matrix, responsive/a11y behavior, contract mapper,
test ownership과 rollout risk를 명시합니다.
