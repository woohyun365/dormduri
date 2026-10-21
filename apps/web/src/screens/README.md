# 새 화면 계층

`apps/web/src/screens/`는 새 화면의 표현 계층 한 root입니다. 기존 기능 디렉터리(`src/main`, `src/landing`, `src/auth` …)의 화면은
여기로 옮기지 않고 그대로 둡니다. URL을 정하는 route 파일은 `src/app/`에 남고 이 계층의 공개 entry를 import합니다.

## 구조

```text
src/screens/
├── <기능>/                 # 예: landing. 기능 단위 디렉터리
│   ├── index.ts            # 공개 entry. 기능 밖은 이 파일만 import합니다
│   ├── <기능>Screen.tsx    # 기본은 shared-responsive 한 component
│   ├── desktop/ mobile/    # split-presentation 판정일 때만
│   ├── components/         # 이 기능 전용 표현
│   └── model/              # DOM·React·Next.js와 무관한 순수 model·use-case
├── ui/                     # 두 기능 이상이 쓰는 부품
└── __tests__/              # 계층 전체 검사(lint 규칙 test)
```

- 기본은 Desktop·Mobile이 같은 부품을 responsive class로 조정하는 shared-responsive입니다. 탐색·정보 위계·상호작용이 실질적으로
  다를 때만 그 subtree를 `desktop/`·`mobile/`로 나눕니다(split-presentation). 판정 기준은
  [표현 책임·device 검증](../../../../docs/development/agent-workflows/visual-design/device-presentation-and-verification.md)입니다.
- `model/`은 React·DOM·Next.js·browser API를 import하지 않는 renderer 중립 범위입니다. lint가 막는 범위와 한계는 아래
  [model 경계](#model-경계)입니다.
- 한 기능 안에서만 쓰는 부품은 그 기능의 `components/`에 둡니다. 두 번째 기능이 같은 부품을 쓰게 되면 `ui/`로 옮기고 두 기능이
  `@/screens/ui/...`로 import합니다.
- `src/screens` root에는 README와 `__tests__/`만 둡니다.

## import 규칙

- 기능 밖에서는 `@/screens/<기능>`(공개 entry)와 `@/screens/ui/**`만 import합니다. `src/screens` 안의 파일이
  `@/screens/<기능>/components/...` 같은 다른 기능의 내부 경로를 import하면 lint error입니다.
- `src/app` route 파일처럼 `src/screens` 밖에 있는 파일에도 같은 규칙이 적용되지만, lint 블록은 `src/screens/**`에만 걸려 있습니다.
  그 밖 파일의 import는 리뷰에서 확인합니다.
- 기능 안에서는 상대 경로를 씁니다. 기능 root 밖으로 나가는 상대 경로(`../다른기능/...`, `../../ui/...`)는 lint error입니다.
  파일 깊이별 검사는 기능 root 아래 다섯 단계까지이고, 그보다 깊은 파일은 alias 규칙만 받습니다.
- `@sentry/nextjs` 제한은 앱 전체와 같습니다.
- `model/` 파일은 이보다 좁은 허용 목록을 받습니다. `@/screens/**`와, 기능 안이지만 `model/` 밖인 상대 경로도 막힙니다
  ([model 경계](#model-경계)).

## lint와 값 규칙

`apps/web/eslint.config.mjs`의 screens 블록이 `pnpm lint`·`pnpm check`·CI에서 error로 막습니다. 규칙 test는
[`__tests__/presentation-lint.test.ts`](./__tests__/presentation-lint.test.ts)입니다.

- 색·글자·간격·폭·radius·motion 값은 [token](../styles/tokens/README.md)에서만 가져옵니다. 문자열·template literal 안의 다음 이름은
  error입니다(test 파일 제외, token 견본 story `src/styles/tokens/**/*.stories.tsx` 포함).
  1. Tailwind 기본 색 팔레트(`slate`~`rose`와 4.2에서 더해진 `mauve`·`olive`·`mist`·`taupe`, `black`, `white`)를 쓰는 색 utility
  2. 기본 글자 크기(`text-xs`·`sm`·`base`·`lg`·`xl`·`2xl`~`9xl`)
  3. 기본 radius(`rounded`, `rounded-{xs,sm,md,lg,xl,2xl,3xl,4xl}`과 방향 변형)
  4. 기본 shadow 이름(`shadow`, `shadow-{2xs..2xl}`, `shadow-inner`, `inset-shadow-{2xs,xs,sm}`, `drop-shadow`,
     `drop-shadow-{xs..2xl}`, `text-shadow-{2xs..lg}`. 색 변형은 1번이 막습니다)
  5. 임의 값 `-[…]`과 임의 속성 `[prop:value]`(임의 variant `data-[…]:` 포함)
  6. CSS 변수 축약 `-(--…)`
  7. raw 색: hex, `rgb(`·`rgba(`·`hsl(`·`hsla(`·`oklch(`·`oklab(`·`lab(`·`lch(`·`hwb(`·`color(`
  8. 기존 `globals.css` theme 색(`background`·`foreground`·`card`·`popover`·`primary`·`secondary`·`muted`·`accent`·`destructive`·
     `border`·`input`·`ring`과 `-foreground` 변형)을 쓰는 색 utility
  9. `font-sans`·`font-serif`·`font-mono`
  10. 기본 container 이름(`3xs`~`7xl`)을 쓰는 `w`·`min-w`·`max-w`·`inline`·`min-inline`·`max-inline`·`basis`·`columns`
  11. `leading-{tight,snug,normal,relaxed,loose}`, `text-*/tight` 같은 이름 줄 간격 modifier, `ease-{in,out,in-out}`
- 허용: token utility(`bg-layer-basement`, `text-fg-muted`, `text-body`, `font-body`, `max-w-page`, `rounded-card`,
  `ease-standard`, `focus-visible:focus-ring` …), static utility(`rounded-full`·`rounded-none`, `shadow-none`, `bg-transparent`·
  `bg-current`), spacing 배수(`p-4`, `gap-0.5`).
- 센서(test 포함 `src/screens/**` 전체): 위 import 규칙, `eslint-plugin-jsx-a11y` recommended 규칙과 그 option error(`alt-text`는
  기본 element에 `next/image`의 `Image`를 더함), 빈 block(`no-empty`, 빈 catch 포함) error.
- `src/screens` 아래에는 `.css` 파일을 두지 않습니다. 값이 lint 밖 CSS로 숨지 않게 하려는 것이고, lint test가 파일 목록으로 확인합니다.
- 한계: 문자열을 조합해 만든 class(`` `text-${size}` ``)와 `style` 속성의 숫자 값은 lint가 보지 못합니다. 리뷰에서 확인합니다.

## model 경계

`src/screens/<기능>/model/**`(test 파일 제외)는 다른 renderer(native app 등)와 함께 쓸 수 있게 둔 순수 model·use-case 자리입니다.
`apps/web/eslint.config.mjs`의 model 블록이 `pnpm lint`·`pnpm check`·CI에서 error로 막습니다. 규칙 test는 위와 같은
[`__tests__/presentation-lint.test.ts`](./__tests__/presentation-lint.test.ts)입니다.

- import 허용 목록: 같은 `model/` 안 상대 경로, `@repo/shared/**`, `zod`. 그 밖(Next.js·React·React DOM·React Native·Expo·Node
  builtin·`@/` alias·목록 밖 package)은 값 import뿐 아니라 `import type`·inline `type`·`export … from`·`export *`·`import x = require()`도
  error입니다. 기능의 공개 entry(`@/screens/<기능>`)도 React 화면을 끌고 오므로 막힙니다.
- 상대 경로: `model/` 밖으로 나가는 상대 경로(`../components/...`, 기능 root를 가리키는 `'./..'`·`'../..'`)는 error입니다. 파일 깊이별
  검사는 `model/` 아래 네 단계까지입니다.
  디렉터리 index는 `'.'`·`'..'` 대신 `'./index'`·`'../index'`처럼 파일 경로로 씁니다(허용 목록이 `'.'`·`'..'`를 막습니다).
  `model/` 파일은 `.ts`·`.tsx`입니다. `.js`·`.mjs`는 type 정보 project 밖이라 lint가 parsing error로 실패합니다.
- 전역: `window`·`document`·`navigator`·`location`·`history`·`localStorage`·`sessionStorage`·`indexedDB`·`globalThis`·`self`·`process`는
  error입니다. 같은 이름의 지역 변수·매개변수는 통과합니다. 필요한 값은 `model/` 밖 Web 표현이 인자로 넘깁니다.
- 문법: 동적 `import()`, `import('…')` type 표현, `require()`, JSX는 error입니다.
- 위 import 규칙(Sentry 제한·기능 내부 import 금지)과 값 규칙도 `model/` 파일에 그대로 걸립니다.
- `packages/shared/src/**/*.ts`도 `packages/shared/eslint.config.mjs`에서 같은 전역·문법 규칙과 허용 목록(package 안 상대 경로, `zod`)을
  받습니다. 규칙 test는 `packages/shared/test/architecture/renderer-neutral-boundary.spec.ts`이고, 그 spec이 실제 src 전체를 lint해
  `pnpm shared:test`·CI shared 단계에서 위반을 막습니다. `pnpm shared:lint`(`pnpm lint`·`pnpm check`가 부름)는 script glob이 shell에서
  한 단계로 펼쳐져 src 일부만 봅니다([#660](https://github.com/woohyun365/knu_roommate/issues/660)). package 밖 상대 경로는 lint가 아니라
  `tsc`의 `rootDir`(TS6059)가 `.ts` 파일에서 막고, package 밖 `.d.ts`를 가리키는 `import type`은 둘 다 통과합니다.
- 경로 소속:
  - `portable-now`: `src/screens/*/model/**`와 `packages/shared/src/**/*.ts`(둘 다 test 파일 제외)
  - `web-only`: `src/screens`의 `model/` 밖 파일과 그 밖 `apps/web/src/**`(BFF·navigation·storage·route 포함)
  - `second-consumer-candidate`: 지금 없음. 두 번째 renderer를 승인할 때 정합니다
  - `not-worth-sharing`: 기존 화면 계층 model(`apps/web/src/main/model/**`). 검사하지 않습니다
- 한계: 이 검사는 선언한 범위에서 정한 import·전역·문법을 막을 뿐이고, React Native에서 동작함을 보장하지 않습니다. 목록 밖 전역
  (`matchMedia`·`getComputedStyle` 같은 이름), type 위치의 DOM 참조(`HTMLElement`·`MouseEvent` 같은 type 이름, `typeof window`),
  문자열로 만든 경로, 상대 경로 중간의 `..`, `model/` 아래 네 단계보다 깊은 파일의 `model/` 밖 상대 경로, `import.meta`,
  `/// <reference …>` 지시문, `require` 별칭 호출과 `require.resolve`는 lint가 보지 못합니다.
  `URL`·`URLSearchParams`·`fetch`·timer·`console`은 막지 않습니다. 리뷰에서 확인합니다.
- 결정과 기각한 대안은 [FE 결정 기록](../../../../docs/architecture/decisions/fe.md#component-architecture)입니다. 허용 목록 밖 package가
  필요하면 그 결정을 개정합니다.

## 새 기능 디렉터리와 경로 표

새 기능 디렉터리를 처음 만드는 PR은 같은 PR에서 [`docs/policies/path-domains.json`](../../../../docs/policies/path-domains.json)에 그
디렉터리의 행을 더합니다. 도메인은 같은 기능의 기존 디렉터리 행을 기준으로 정하고(예: `src/landing/**`의 도메인), 추적 파일에 맞지
않는 glob은 stale 경고가 되므로 파일과 함께 더합니다. 이 파일을 바꾸면 Owner 확인이 필요합니다
([경로 → 정책 도메인 표](../../../../docs/policies/README.md#경로--정책-도메인-표)).
