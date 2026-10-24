# Frontend plan authoring

`apps/web`의 Next.js UI, BFF, interaction, design system과 browser runtime이 primary owner인 계획에 사용합니다.
[Core](./core.md)를 먼저 읽습니다.

## Product and policy surface

- 화면이 소유하는 정보·action을 정의합니다.
- season, registration 상태를 state matrix에 넣습니다.
- 최종 action precondition은 권한 밖의 상태 조건까지 API owner가 검증합니다.
- policy copy, shared contract, BFF mapper, API response가 같은 의미를 사용하는지 확인합니다.

구현·리뷰 기준: [swe.md S1](../review-criteria/swe.md#s1-요구사항intentinvariant-부합), [swe.md S2](../review-criteria/swe.md#s2-제품-정책-부합), [web-fe-state-data-cache.md F2](../review-criteria/web-fe-state-data-cache.md#f2-모든-ui-상태), [web-fe-state-data-cache.md F6](../review-criteria/web-fe-state-data-cache.md#f6-외부-입력-신뢰-경계와-client-판단의-한계)

## Next.js, React, and BFF boundary

구현·리뷰 기준: [swe.md S7](../review-criteria/swe.md#s7-dependency-도입과-version-의존-동작), [web-fe-rendering-boundary.md F1](../review-criteria/web-fe-rendering-boundary.md#f1-serverclient-경계), [web-fe-rendering-boundary.md F2](../review-criteria/web-fe-rendering-boundary.md#f2-render-일치와-navigationscroll-소유), [web-bff-gateway-forwarding.md B1](../review-criteria/web-bff-gateway-forwarding.md#b1-bff를-둘-조건과-upstream-allowlist), [web-bff-gateway-forwarding.md B2](../review-criteria/web-bff-gateway-forwarding.md#b2-mutation-진입점-선택), [web-bff-session-cookie-auth.md B1](../review-criteria/web-bff-session-cookie-auth.md#b1-cookie-속성과-token-보관), [web-bff-session-cookie-auth.md B2](../review-criteria/web-bff-session-cookie-auth.md#b2-session-갱신-위치), [web-bff-server-read-error-privacy-shaping.md B1](../review-criteria/web-bff-server-read-error-privacy-shaping.md#b1-server-read-경로), [web-bff-server-read-error-privacy-shaping.md B2](../review-criteria/web-bff-server-read-error-privacy-shaping.md#b2-오류-번역), [web-bff-server-read-error-privacy-shaping.md B3](../review-criteria/web-bff-server-read-error-privacy-shaping.md#b3-응답-최소화와-upstream-검증)

## State, form, mutation, and cache

- form은 retry, error announcement, browser autofill을 포함합니다.
- back/forward 때 user-visible state가 일치하는지 확인합니다.

구현·리뷰 기준: [swe.md S3](../review-criteria/swe.md#s3-정확성과-오류-경로), [web-fe-state-data-cache.md F1](../review-criteria/web-fe-state-data-cache.md#f1-상태-종류와-단일-원천), [web-fe-state-data-cache.md F3](../review-criteria/web-fe-state-data-cache.md#f3-formmutation과-optimistic-반영), [web-fe-state-data-cache.md F4](../review-criteria/web-fe-state-data-cache.md#f4-무효화경쟁identity-전환), [web-fe-state-data-cache.md F5](../review-criteria/web-fe-state-data-cache.md#f5-같은-종류-조회-hook의-계약)

## Accessibility and responsive interaction

- [표현 책임·device 검증](../visual-design/device-presentation-and-verification.md)은 변경 surface만 적용하며 전체 디자인
  탐색이나 기존 화면 선행 분해를 요구하지 않습니다.
- 320px mobile, tablet landscape, reflow, safe area와 virtual keyboard를 점검합니다.

구현·리뷰 기준: [web-fe-layout-responsive-device.md F1](../review-criteria/web-fe-layout-responsive-device.md#f1-표현-책임-판정), [web-fe-layout-responsive-device.md F2](../review-criteria/web-fe-layout-responsive-device.md#f2-같은-url과-render-안전), [web-fe-layout-responsive-device.md F3](../review-criteria/web-fe-layout-responsive-device.md#f3-viewportscroll-검증), [web-fe-accessibility.md F1](../review-criteria/web-fe-accessibility.md#f1-의미-있는-요소와-접근-가능한-이름), [web-fe-accessibility.md F2](../review-criteria/web-fe-accessibility.md#f2-keyboard와-focus), [web-fe-accessibility.md F3](../review-criteria/web-fe-accessibility.md#f3-상태-알림과-비활성-이유)

## Visual and component boundary

- 승인된 개편은 기존 미감을 자동 상속하지 않되 [assertion 전환](../visual-design/design-review-and-acceptance.md#assertion-transition-before-ui-changes)을
  UI 변경 전에 설계합니다. 문구 분류·명시적으로 허용된 font/dependency 실험은 [VisualBrief](../visual-design/visual-brief.md)를 소비하며 제품 정책 변경 권한은 별도입니다.
- [Web semantic token 계약](../visual-design/web-semantic-token-contract.md)은 변경 surface에만 적용합니다. 작은 수리는
  직접 판단하고, 지침 채택을 위한 전수 CSS migration은 하지 않습니다.
- 시각적 방향은 [Visual design workflow](../visual-design/README.md)의 `maintain | reimagine | new-surface`와 surface별
  승인 범위로 판단하며, 명시적으로 새 방향을 탐색할 때 기존 token/layout의 외형을 의무로 상속하지 않습니다.
- content/state/action map과 reference aspect를 분리하고 제안·계획·승인된 구현의 권한을 명시합니다. 실제 화면 없이
  미적 성과를 추측하지 않으며 기능/a11y, reference fidelity, usability, Owner 선호의 acceptance를 나눕니다.

구현·리뷰 기준: [web-fe-design-system.md F1](../review-criteria/web-fe-design-system.md#f1-semantic-token만-사용), [web-fe-design-system.md F2](../review-criteria/web-fe-design-system.md#f2-부품-재사용과-승격), [web-fe-design-system.md F3](../review-criteria/web-fe-design-system.md#f3-사용자-문구-권한), [web-fe-component-architecture.md F1](../review-criteria/web-fe-component-architecture.md#f1-owner-구분과-공통화-기준), [web-fe-component-architecture.md F2](../review-criteria/web-fe-component-architecture.md#f2-합성-먼저와-작은-component-api), [web-fe-component-architecture.md F3](../review-criteria/web-fe-component-architecture.md#f3-같이-실행되지-않는-분기-분리), [web-fe-component-architecture.md F4](../review-criteria/web-fe-component-architecture.md#f4-기능-단위-배치와-공개-entry), [web-fe-component-architecture.md F5](../review-criteria/web-fe-component-architecture.md#f5-예시-렌더-표면의-우회-금지), [web-fe-component-architecture.md F6](../review-criteria/web-fe-component-architecture.md#f6-renderer-중립-경계)

## Performance and browser reliability

- hydration cost, route transition, CSS loading 후보를 점검합니다.
- Web Vitals, BFF failure telemetry의 현재 owner와 개인정보 경계를 확인합니다.

구현·리뷰 기준: [swe.md S7](../review-criteria/swe.md#s7-dependency-도입과-version-의존-동작), [swe.md S8](../review-criteria/swe.md#s8-측정-근거-있는-성능), [web-fe-rendering-boundary.md F3](../review-criteria/web-fe-rendering-boundary.md#f3-체감-성능-budget), [web-fe-rendering-boundary.md F4](../review-criteria/web-fe-rendering-boundary.md#f4-부분-실패-격리와-browser-오류-관측)

## Security and privacy

- XSS, open redirect, cookie/token exposure, sensitive payload logging, enumeration copy를 점검합니다.
- profile/chat/analytics/observability payload는 최소 수집 원칙을 유지합니다.
- auth, PII, moderation, legal surface이면 [Security and privacy](./cross-cutting/security-privacy.md)를 추가합니다.

구현·리뷰 기준: [web-security-privacy-data-privacy-secret.md P1](../review-criteria/web-security-privacy-data-privacy-secret.md#p1-숨긴-신원비공개-필드의-공개-범위-유지)

## Frontend verification

- pure logic: unit test
- component state and interaction: Vitest + Testing Library
- production controller and Storybook parity: shared fixture/interaction test
- navigation, browser API, responsive modal/scroll: Playwright when risk justifies it
- accessibility: semantic query, keyboard/focus test, 필요 시 automated scan
- BFF contract: route test + shared schema + upstream failure cases
- visual changes: production surface and Storybook consistency, bounded screenshot evidence

Plan은 target component tree, server/client/BFF boundary, UI state matrix, responsive/a11y behavior, contract mapper,
test ownership, rollout risk와 핵심 journey·그 완료 조건을 명시합니다. 완료 조건은 그 journey가 닿는 기존 기준 항목이
판정합니다.

구현·리뷰 기준: [swe.md S6](../review-criteria/swe.md#s6-보호-test)
