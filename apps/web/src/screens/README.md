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
- `model/`은 React·DOM·Next.js·browser API를 import하지 않습니다. 이 규칙의 자동 검사는 아직 없습니다.
- 한 기능 안에서만 쓰는 부품은 그 기능의 `components/`에 둡니다. 두 번째 기능이 같은 부품을 쓰게 되면 `ui/`로 옮기고 두 기능이
  `@/screens/ui/...`로 import합니다.
- `src/screens` root에는 README와 `__tests__/`만 둡니다.

## import 규칙

- 기능 밖에서는 `@/screens/<기능>`(공개 entry)와 `@/screens/ui/**`만 import합니다. `@/screens/<기능>/components/...` 같은 내부
  경로는 lint error입니다.
- 기능 안에서는 상대 경로를 씁니다. 기능 root 밖으로 나가는 상대 경로(`../다른기능/...`, `../../ui/...`)는 lint error입니다.
  파일 깊이별 검사는 기능 root 아래 다섯 단계까지이고, 그보다 깊은 파일은 alias 규칙만 받습니다.
- `@sentry/nextjs` 제한은 앱 전체와 같습니다.

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
- 센서(test 포함 `src/screens/**` 전체): 위 import 규칙, `eslint-plugin-jsx-a11y` recommended 규칙 error, 빈 block(`no-empty`, 빈
  catch 포함) error.
- `src/screens` 아래에는 `.css` 파일을 두지 않습니다. 값이 lint 밖 CSS로 숨지 않게 하려는 것이고, lint test가 파일 목록으로 확인합니다.
- 한계: 문자열을 조합해 만든 class(`` `text-${size}` ``)와 `style` 속성의 숫자 값은 lint가 보지 못합니다. 리뷰에서 확인합니다.

## 새 기능 디렉터리와 경로 표

새 기능 디렉터리를 처음 만드는 PR은 같은 PR에서 [`docs/policies/path-domains.json`](../../../../docs/policies/path-domains.json)에 그
디렉터리의 행을 더합니다. 도메인은 같은 기능의 기존 디렉터리 행을 기준으로 정하고(예: `src/landing/**`의 도메인), 추적 파일에 맞지
않는 glob은 stale 경고가 되므로 파일과 함께 더합니다. 이 파일을 바꾸면 Owner 확인이 필요합니다
([경로 → 정책 도메인 표](../../../../docs/policies/README.md#경로--정책-도메인-표)).
