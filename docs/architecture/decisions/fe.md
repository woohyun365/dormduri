# FE 결정 기록

**상태**: owner-confirmed
**확인일**: 2026-10-21
**확인 근거**: [#659](https://github.com/woohyun365/knu_roommate/issues/659) 본문의 결정 요약
**근거**: [새 화면 계층](../../../apps/web/src/screens/README.md), [Domain/SWE/Web/FE pack](../../development/agent-workflows/domain/swe-web/fe.md)

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
  (`pnpm shared:lint`도 src 전체를 lint한다). 전역 판정이 scope를 봐서 같은 이름의 지역 변수(shared `legal/contract.ts`의
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
