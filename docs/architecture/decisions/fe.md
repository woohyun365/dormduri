# FE 결정 기록

**상태**: owner-confirmed
**확인일**: 2026-10-31
**확인 근거**: [#659](https://github.com/woohyun365/dormduri/issues/659) 본문의 결정 요약(component-architecture의 renderer 중립 셋), [#671](https://github.com/woohyun365/dormduri/issues/671) 본문의 결정 요약(`fe.comp.route-entry-import-guard`, design-system), [#706](https://github.com/woohyun365/dormduri/issues/706)(`fe.ds.copy-style` 서비스 이름이 바뀔 때의 면책 문장), [#293](https://github.com/woohyun365/dormduri/issues/293)의 채택 판정 댓글(rendering-boundary의 `fe.render.react-compiler`)
**근거**: [새 화면 계층](../../../apps/web/src/screens/README.md), [시각 값 token](../../../apps/web/src/styles/tokens/README.md), [Landing 화면](../../../apps/web/src/screens/landing/README.md), [Domain/SWE/Web/FE pack](../../development/agent-workflows/domain/swe-web/fe.md)

`Domain/SWE/Web/FE` pack layer의 결정 기록입니다. 형식과 상태 어휘는 [Decision records](./README.md)입니다.

## component-architecture

이 절의 결정은 `fe.comp.renderer-neutral-model`(Inspect, `known`: 새 화면 계층의 `model/`이 renderer 중립 model 자리,
[새 화면 계층](../../../apps/web/src/screens/README.md) 구조 절)을 lint로 강제하는 범위·도구·import 판정입니다. 규칙 요약과 한계는
[model 경계](../../../apps/web/src/screens/README.md#model-경계)에 있습니다.

#### fe.comp.renderer-neutral-guard-scope

- 판정: Ask
- 상태: validated
- 고른 선택지: `packages/shared/src/**/*.ts`와 `apps/web/src/screens/*/model/**`를 검사하고 `**/__tests__/**`·`*.{test,spec}.{ts,tsx}`는
  뺀다. 새 model 파일은 목록 수정 없이 glob으로 들어온다. 경로 소속은 `portable-now` = 두 범위, `web-only` = `src/screens`의 `model/`
  밖 파일과 그 밖 `apps/web/src/**`(BFF·navigation·storage·route 포함), `second-consumer-candidate` = 지금 없음,
  `not-worth-sharing` = 기존 화면 계층 model(`apps/web/src/main/model/**`)이다. 설정은 `apps/web/eslint.config.mjs`와
  `packages/shared/eslint.config.mjs`의 renderer 중립 블록이다
- 근거: 영향은 lint·test 범위이고 제품 동작·contract·data는 바뀌지 않는다. 기존 `apps/web/src/main/model/**`은 새 화면 계층으로 바뀌면
  지울 화면이라 검사를 보강하지 않고, 그 안의 `mainRoutes.ts`가 `next`의 `Route` type을 import해 범위에 넣으면 기존 화면 수정이나 예외가
  필요하다. 비가역이 아니고 설정 revert로 되돌린다
- 기각한 대안: 기존 `main/model`의 순수 파일을 명시 목록으로 함께 검사(지울 화면에 검사를 보강하고 지울 때 목록도 지워야 한다), screens
  model 파일 명시 목록(목록에 넣지 않은 새 model 파일이 검사 밖에 남는다)
- 재검토 조건: `model/` 밖에 순수 module을 두는 구조가 생길 때, 두 번째 renderer를 승인할 때(`second-consumer-candidate` 판정),
  기존 화면 계층 model을 지운 뒤(`not-worth-sharing` 줄 정리)
- 출처: #659, Owner 확인 2026-10-20
- pack 결정: 없음

#### fe.comp.renderer-neutral-guard-tool

- 판정: Ask
- 상태: validated
- 고른 선택지: 두 package의 ESLint config에 블록을 하나씩 두고 ESLint core 규칙만 쓴다. `no-restricted-imports`(import 허용 목록),
  `no-restricted-globals`(`window`·`document`·`navigator`·`location`·`history`·`localStorage`·`sessionStorage`·`indexedDB`·
  `globalThis`·`self`·`process`), `no-restricted-syntax`(동적 `import()`, `import('…')` type 표현, `require()`, Web은 JSX도). Web model
  블록은 앞 screens 블록의 Sentry path·기능 entry pattern·raw 값 pattern을 함께 다시 담고, model 깊이별 블록이 `model/` 밖으로 나가는
  상대 경로를 막는다. 규칙 test는 ESLint Node API로 금지·허용·범위 밖 fixture와 effective config를 단언한다
  (`apps/web/src/screens/__tests__/presentation-lint.test.ts`, `packages/shared/test/architecture/renderer-neutral-boundary.spec.ts`)
- 근거: 새 화면 계층 lint와 같은 방식이라 editor와 기존 lint·test 명령이 돌고 새 dependency가 없다. Web model은 `pnpm lint`·
  `pnpm check`·CI Web lint가 막고, shared src 전체는 spec의 실제 src lint가 `pnpm shared:test`·CI shared 단계에서 막는다
  (`pnpm shared:lint`도 src·test 전체를 lint한다). 전역 판정이 scope를 봐서 같은 이름의 지역 변수(shared `legal/contract.ts`의
  `document` 매개변수)를 통과시킨다. flat config는 같은 규칙을 다시 정한 뒤 블록의 option으로
  앞 option을 바꾸므로 model 블록이 앞 규칙을 다시 담고 test가 effective config로 확인한다. 새 JSX transform은 `react/jsx-runtime`
  import를 source에 쓰지 않아 import 규칙만으로는 JSX를 못 잡으므로 JSX 문법을 막는다. `process`는 `process.env`를 포함해 전역 전체를
  막는다(React Native에 Node `process` 계약이 없다). 불확실성은 이름 목록 밖 전역, type 위치의 DOM 참조(`HTMLElement`·`MouseEvent`
  같은 type 이름, `typeof window`), 문자열로 만든 경로, 상대 경로 중간의 `..`, model 깊이별 마지막 블록보다 깊은 파일의 `model/` 밖
  상대 경로, `import.meta`, `/// <reference …>` 지시문, `require` 별칭 호출과 `require.resolve`, shared에서 package 밖 `.d.ts`를
  가리키는 `import type`(package 밖 `.ts`는 `tsc` `rootDir`가 TS6059로 막는다)이고 리뷰가 맡는다. 결정적 PASS는 선언 범위 안의 판정이고 React Native 호환 PASS가 아니다. 비가역이 아니고 설정 revert로
  되돌린다
- 기각한 대안: TypeScript compiler API test(전역을 scope로 가리려면 type checker가 필요하고 editor 피드백이 없으며 판정 code가 두
  package에 중복된다), 파일 문자열 scan test(`document` 매개변수 오탐, 여러 줄 import 같은 문법 한계), 새 공통 ESLint preset(각
  package config에 블록만 더한다)
- 재검토 조건: 이름 목록 밖 전역이 리뷰에서 실제로 나올 때(목록 개정), ESLint major 상향으로 core 규칙 동작이 바뀔 때(fixture 재실행)
- 출처: #659, Owner 확인 2026-10-20
- pack 결정: 없음

#### fe.comp.renderer-neutral-import-allowlist

- 판정: Ask
- 상태: validated
- 고른 선택지: 허용 목록만 통과하고 나머지는 실패한다(fail-closed). screens model은 같은 `model/` 안 상대 경로·`@repo/shared/**`·`zod`,
  shared는 package 안 상대 경로와 `zod`다. Next.js·React·React DOM·React Native·Expo·Node builtin·`@/` Web alias·목록 밖 package는
  값·`import type`·inline `type`·`export … from`·`export *`·`import x = require()` 모두 실패하고, 진단 메시지는 금지 family와 허용
  목록, 새 화면 계층 README 경로를 담는다
- 근거: 목록에 없는 renderer 의존과 alias를 거친 간접 의존(model이 `@/screens/<기능>` 공개 entry를 import하면 React 화면이 따라온다)을
  이름 목록 없이 막는다. 지금 shared는 상대 경로 밖으로 `zod`만 import해 위반이 0이다. model이 새 순수 package나 다른 기능 model을
  쓰려면 이 결정을 개정해야 한다. 비가역이 아니고 설정 revert로 되돌린다
- 기각한 대안: 금지 family 목록(목록 밖 renderer 의존과 막지 않은 alias가 통과한다)
- 재검토 조건: 두 기능 model이 같은 순수 규칙을 공유해야 할 때(그 규칙을 `@repo/shared`나 새 위치에 둘지 이 결정 개정으로 정한다),
  model에 새 순수 package가 필요할 때
- 출처: #659, Owner 확인 2026-10-20
- pack 결정: 없음

#### fe.comp.route-entry-import-guard

- 판정: Ask
- 상태: validated
- 고른 선택지: 기능 내부 import를 막는 lint 블록은 `src/screens/**`에만 둔다. `src/app` route 파일은 공개 entry만 import하고, 이를
  route test(`apps/web/src/app/__tests__/public-landing-route.test.ts`: `/`는 `@/screens/landing`의 `LandingScreen`만 렌더링)와
  리뷰가 확인한다([새 화면 계층 import 규칙](../../../apps/web/src/screens/README.md#import-규칙))
- 근거: 새 화면 계층을 쓰는 route는 `/` 하나다. `src/app/**`에 lint 블록을 더하면 앱 전체 블록의 `no-restricted-imports` option을 그
  블록에 다시 담아야 한다(flat config는 같은 규칙의 뒤 option이 앞 option을 바꾼다, `fe.comp.renderer-neutral-guard-tool` 근거).
  비가역이 아니고 test·설정 revert로 되돌린다
- 기각한 대안: `src/app/**` route 파일의 screens 기능 내부 import를 lint error로 막기(2026-10-22 고른 것. route가 하나인 지금은 앱 전체
  제한을 다시 담는 설정 비용이 막는 범위보다 크다)
- 재검토 조건: 새 화면 계층을 쓰는 route가 둘 이상이 될 때(Auth·Legal·Main을 새 계층으로 만들 때), route 파일이 기능 내부 경로를
  import한 사례가 리뷰에서 나올 때
- 출처: #671, Owner 확인 2026-10-26
- pack 결정: 없음

## rendering-boundary

이 절의 설정 원본은 `apps/web/react-compiler.config.ts`이고 적용 범위·확인 방법은
[Web infra CI/test/config 기준](../frontend/web-infra-ci-test-config.md#nextjs-production-baseline)이 소유합니다. 측정은
[React Compiler evidence](../../evidence/frontend/react-compiler-evidence.md)입니다.

#### fe.render.react-compiler

- 판정: Ask
- 상태: validated
- 고른 선택지: Landing부터 Web 전체에 React Compiler를 `infer` mode로 켠다(`panicThreshold: 'none'`, 기존 memoization 보장 유지
  `enablePreserveExistingMemoizationGuarantees: true`). option 원본은 `apps/web/react-compiler.config.ts` 하나이고 Next build·Vitest·
  Storybook이 같은 값을 쓴다. Vitest·Storybook은 Next browser build와 같은 파일만 compile한다. 기존 `useMemo`·`useCallback`은 지우지
  않는다. compile된 뒤 깨지는 component는 코드를 Rules of React에 맞게 고치고, 그럴 수 없을 때만 `"use no memo"`와 이유·보호 test를 둔다
- 근거: Next 16에서 top-level stable 설정이고, compiler lint 위반이 0건이었다. 채팅방처럼 입력 상태와 긴 목록이 한 component에 있는
  화면은 글자마다 목록 전체를 다시 그렸고, compile 뒤 입력 중 JS 실행이 크게 줄었다. 비용은 cold build 시간과 client JS 증가이고 측정
  중단 조건 안이었다(evidence). test runner도 같은 compiler를 거쳐 production과 같은 코드를 검사한다. 비가역이 아니고 설정 revert나
  `reactCompiler` 한 줄 삭제로 되돌린다
- 기각한 대안: annotation mode pilot 뒤 확대(#293 원문 순서. lint 위반 0건이라 단계가 필요 없었다), production build만 켜기(test가
  compile된 코드를 검사하지 못한다), test runner마다 option을 따로 쓰기(값이 어긋날 수 있다), Rust compiler(`oxc-transform-react`)와
  Next `experimental.turbopackRustReactCompiler`(experimental), compile을 건너뛴 파일 전체를 이 변경에서 고치기(화면 코드가 넓게
  바뀐다. 측정 대상인 채팅방만 고쳤다)
- 재검토 조건: build 시간이나 client JS 증가가 evidence의 중단 조건을 넘을 때, 배포 환경 Web Vitals(LCP·INP)가 나빠질 때,
  `"use no memo"` 파일이 셋을 넘을 때, `@vitejs/plugin-react`가 Rust compiler를 stable로 낼 때, compile을 건너뛴 화면을 다시 만들 때
- 출처: #293, Owner 확인 2026-10-31
- pack 결정: 없음

## design-system

이 절의 값은 [시각 값 token](../../../apps/web/src/styles/tokens/README.md)과 [Landing 화면](../../../apps/web/src/screens/landing/README.md)
README가 소유하고, 여기에는 판정과 근거만 둔다.

#### fe.ds.token-layer

- 판정: Ask
- 상태: validated
- 고른 선택지: semantic token 파일. DTCG JSON(`apps/web/src/styles/tokens/*.tokens.json`과 resolver `knu.resolver.json`)이 원본이고
  생성기가 Tailwind `@theme`·`:root` CSS(`tokens.generated.css`)를 만든다. 색 기본 문맥은 라이트이고 `palette: dark`는 nestable
  선택자 `[data-palette='dark']` 문맥 하나, `motion: reduced`는 `prefers-reduced-motion` 문맥이다. 새 화면 계층만 쓰고 기존 화면
  theme(`globals.css`·`knu.css`)은 바꾸지 않는다. 지금 화면이 쓰는 역할만 둔다
- 근거: 영향은 새 화면 계층 style 전체이고 되돌림은 `costly`(모든 style 참조)다. 값이 한 곳에 있고 원본과 생성 CSS의 차이는 drift
  test가 `pnpm check`에서 잡는다. 문맥이 nestable이라 어두운 페이지 안의 밝은 창, 밝은 페이지 안의 밤 그림처럼 겹쳐도 바깥 값이
  남지 않는다. 화면의 raw 색·임의 값은 lint error다. 비가역이 아니고 token JSON·생성 CSS revert로 되돌린다
- 기각한 대안: framework theme 설정에 값을 직접 두기(style 도구를 바꾸면 값을 함께 옮겨야 한다. 지금은 생성기가 theme을 만든다),
  다크 값을 화면 CSS에 따로 두기(값 원본이 둘이 된다), 화면별 값(`web-fe-design-system.md F1` 결함)
- 재검토 조건: Auth·Legal·Main을 새 계층으로 만들어 역할을 더할 때(token README의 "token 추가와 이름"), 두 번째 renderer를 승인할 때
  (token 출력 형식), 기존 화면 theme을 지울 때
- 출처: #671, Owner 확인 2026-10-26
- pack 결정: [fe.ds.token-layer](../../development/agent-workflows/domain/swe-web/fe.md#fedstoken-layer)

#### fe.ds.copy-authority

- 판정: Inspect
- 상태: known
- 고른 선택지: 정책 고지는 정책 원본, 나머지는 화면의 content 상수. 고지 일곱 개는 `model/landingPolicyCopy.ts`가 문장과 원본 정책
  경로를 함께 소유하고, 고지 시점은 [서비스 책임 범위 정책의 면책 고지 시점](../../policies/service-boundary.md#면책-고지-시점)을
  따른다. 그 밖 화면 문구는 `model/landingCopy.ts`에 둔다
- 근거: 화면이 정책과 다른 말을 하지 않게 하고, 고지 밖 문구는 test가 글자로 고정하지 않아 다시 다듬을 수 있다. 원본 정책 경로는
  `scripts/ci/contracts/policy-source-links.test.mjs`가 확인한다. 새 정책 문서는 더하지 않는다. 되돌림은 `easy`
- 기각한 대안: design 초안 문구를 그대로 쓰기, component 안에 문구를 직접 쓰기(둘 다 `web-fe-design-system.md F3` 결함)
- 재검토 조건: 고지 시점·뜻을 바꾸는 정책 개정, 다른 화면이 같은 고지를 쓸 때(원본 위치)
- 출처: #671, Owner 확인 2026-10-26
- pack 결정: [fe.ds.copy-authority](../../development/agent-workflows/domain/swe-web/fe.md#fedscopy-authority)

#### fe.ds.copy-style

- 판정: Ask
- 상태: validated
- 고른 선택지: 해요체. 면책 고지 네 문장은 지금 문장(합니다체) 그대로 두고, 같은 알아두세요 목록에서 다듬은 고지 두 문장(개인정보
  공개 주의, 신고·문의 위치)도 그 목록에 맞춰 합니다체로 둔다. 같은 행동은 화면 어디서나 한 이름이고(가입: "학교 이메일로
  시작하기"), 320·360px 폭 때문에 헤더만 "시작하기"를 쓴다. 생활패턴 비교 결과는 판정 단계 이름 대신 "생활패턴 적합도"로 부른다.
  과장 형용사와 영문 대문자 label을 쓰지 않고 수치는 한국어 표기 관례를 따른다
- 근거: 첫 방문 학생에게 짧고 정직하게 말한다. 면책 문장은 법적 책임 문구라 표현을 바꾸지 않는다(서비스 이름이 바뀌면 주어 이름만
  바꾸고 Owner가 전후 대조를 확인한다). 판정 단계 이름은 랜딩에 판정 화면이 없어 뜻 없이 굳는다. 비가역이 아니고 문구 revert로 되돌린다
- 기각한 대안: 합니다체 전체(2026-10-22 Owner가 해요체를 골랐다), 면책 문장을 해요체로 맞추기(법적 문구 변경), 헤더도 긴 이름(320·360px
  폭 헤더에 로고·로그인과 함께 들어가지 않는다)
- 재검토 조건: 면책 문장을 전문가 검토로 바꿀 때, 판정 화면을 랜딩에 보일 때
- 출처: #671·#706, Owner 확인 2026-10-22·2026-10-26·2026-10-28
- pack 결정: 없음

#### fe.ds.motion-usage

- 판정: Ask
- 상태: validated
- 고른 선택지: 등장 효과는 내용만 떠오르게 한다. 섹션 글자는 스크롤로 들어올 때 투명한 흐림에서 또렷해지고, 첫 화면 제목 줄과 그 밖
  효과는 글자를 불투명하게 둔 채 transform·장식만 움직인다. 처음 그린 화면과 대비 검사는 늘 최종 상태를 본다. 시간은 token
  duration·easing으로 쓰고, token 밖 시간(깜빡임·떠다님 길이, 질문 상자 타이핑 timer)은 이유와 함께 Foundations/Motion에 적는다.
  motion 줄이기 설정에서는 모든 duration이 0ms가 되어 바로 끝나고 스크롤 등장도 걸리지 않는다. 스스로 반복하는 움직임(첫 화면 질문
  넘김)에는 멈춤 버튼을 둔다(WCAG 2.2.2)
- 근거: 섹션이 바뀌는 것을 보이되 읽을 때는 글자가 최종 상태로 있다. 동작 원본이 token 문맥 하나라 설정 하나로 모든 움직임이
  멈춘다. 비가역이 아니고 utility revert로 되돌린다
- 기각한 대안: 상태 변화에만 짧게(120ms·200ms), 등장·scroll motion 없음(2026-10-22 고른 것. 탐색에서 Owner가 등장 효과를 골랐다),
  섹션 띠가 펼쳐지는 등장(Owner가 고르지 않음)
- 재검토 조건: 등장 효과가 LCP·CLS 측정을 나쁘게 할 때, 다른 화면이 새 계층으로 올 때
- 출처: #671, Owner 확인 2026-10-23·2026-10-26·2026-10-27(글자가 흐림에서 들어오는 지금 화면을 기록에 맞춤)
- pack 결정: 없음

#### fe.ds.anti-slop-review

- 판정: Ask
- 상태: validated
- 고른 선택지: 시각 품질(첫인상, 구성, AI-slop 같지 않음)은 Owner가 Human Feedback으로 판정한다. 독립 비평은 Owner가 지적마다 처분하는
  보조 의견이고, 검증 폭(token README)의 제목 줄 수·13px 미만 글자·가로 넘침 측정은 gate가 아닌 evidence로 기록한다
- 근거: 제목 줄 수 공식(높이 ÷ 줄 높이)은 grid가 늘린 heading을 실제보다 많이 센다(한 줄 제목을 7줄로). 휴대폰 폭(320·390px)의
  3~4줄 제목은 Owner가 화면을 보고 확정한 배치다. 미감은 규칙으로 판정할 수 없고 기술 검사 PASS는 승인이 아니다. 비가역이 아니고
  검사 설정 revert로 되돌린다
- 기각한 대안: 맥락 질문과 Storybook 측정 3개 test를 gate로 두기(2026-10-22 고른 것. 오판하는 측정이 gate가 되면 Owner가 고른 화면을
  막는다)
- 재검토 조건: 측정 공식을 고쳐 오판이 없어질 때, 두 번째 화면이 같은 판정 절차를 쓸 때
- 출처: #671, Owner 확인 2026-10-26
- pack 결정: 없음
