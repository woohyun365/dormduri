# 백오피스 디자인 지침

백오피스 Web 화면이 쓰는 시각 값의 역할과 규칙, Storybook·캡처 규칙을 소유합니다. 앱 셸·layout 패턴·공통 component·표기 규칙·로고
사본·화면 완료 확인 목록은 확정한 시각 방향으로 화면을 바꾸는 변경이 이 문서에 더합니다. 지금 절은 아래 ①②⑨입니다.

## ① 범위와 원본

- **값은 [`src/app/globals.css`](../app/globals.css)의 `@theme inline`에만 둡니다.** 이 문서는 역할·이름 규칙·쓰는 곳과 판단을
  적고, 숫자를 옮겨 적지 않습니다. 둘이 다르면 CSS가 맞습니다.
- 대상은 `apps/backoffice-web`의 `src/**`(test 밖)와 `.storybook/**`입니다. 사용자 Web(`apps/web`)의 token·셸·theme을 가져오지
  않고, 다른 앱 code를 import하지 않습니다([앱 README](../../README.md) §1).
- 화면 code의 문자열에는 token 이름만 씁니다. Tailwind 기본 색 팔레트(`slate-900` 등)·`white`·`black`, 기본 글자 크기
  (`text-sm` 등), 기본 radius(`rounded-md` 등)·shadow 이름, container 폭(`max-w-md` 등), 이름 붙은 줄 간격·easing, 임의 값
  (`-[…]`)과 임의 속성(`[prop:value]`), CSS 변수 축약(`-(--…)`), raw 색 값, `font-sans`·`font-serif`·`font-mono`는
  [`eslint.config.mjs`](../../eslint.config.mjs)의 `no-restricted-syntax`가 오류로 막습니다. 같은 목록에 server action 금지(앱
  README §1)가 함께 있습니다. 한 파일에 걸린 뒤 block의 같은 rule 옵션이 앞 옵션을 바꾸므로 두 금지는 한 목록이어야 하고,
  [`presentation-lint.test.ts`](./presentation-lint.test.ts)가 금지·허용 예와 실효 설정으로 그 목록을 지킵니다.
- 임의 selector variant(`[&>li]:` 등)는 값을 싣지 않아 lint가 막지 않지만 쓰지 않습니다. 같은 모양이 필요하면
  `aria-current-page`처럼 `globals.css`에 `@custom-variant`로 이름을 붙입니다.
- 간격(`p-*`·`gap-*`·`m-*`)은 Tailwind 기본 배수(`--spacing`, 4px)를 그대로 씁니다. 글꼴 굵기(`font-medium`·`font-semibold`)와
  layout utility(`flex`·`grid`·`min-h-screen` 등)는 Tailwind 기본을 씁니다.
- 지금 값은 이 지침이 생기기 전 화면이 쓰던 Tailwind 기본 값의 alias라 화면 모양이 같습니다. 시각 방향을 확정하면 이름은 두고
  값만 바꿉니다. 라이트 하나이고, 어두운 판을 고르면 같은 이름에 문맥 값을 더합니다.
- 결정 기록: [`fe.ds.token-layer/backoffice`](../../../../docs/architecture/decisions/fe.md#fedstoken-layerbackoffice).

## ② token 역할

### 색

| 묶음   | token                                                      | 쓰는 곳                                                                                   |
| ------ | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 층     | `layer-basement`, `layer-default`, `layer-muted`           | page 바탕 → 카드·절·입력 면 → 중립 안내 상자·code 조각·보조 단추 hover                    |
| 글자   | `fg-neutral`, `fg-label`, `fg-description`, `fg-muted`     | 제목·값·입력 글자 → label·용어·menu 링크·중립 안내 → 설명 문단·표 머리 → 도움말·부가 정보 |
| 글자   | `fg-disabled`, `fg-on-brand`                               | 쓸 수 없는 단추 글자, 주 행동 위 글자                                                     |
| 선     | `stroke-neutral`, `stroke-subtle`, `stroke-row`            | 입력·보조 단추 경계 → 카드·절 경계와 구분선 → 표·목록 행 구분                             |
| 브랜드 | `brand-solid`, `brand-solid-hover`, `brand-solid-disabled` | 주 행동(`Button`) 배경과 그 hover·쓸 수 없음                                              |
| 상태   | `success-weak`·`fg-success`·`fg-success-strong`            | 완료: 결과 문단 글자(`fg-success`), 한 번 보는 초대 code 상자 글자(`fg-success-strong`)   |
| 상태   | `warning-weak`·`fg-warning`                                | 주의: idle 안내, 복구 수단 없음 안내                                                      |
| 상태   | `danger-weak`·`fg-danger`                                  | 실패: 오류 결과 문단                                                                      |

- utility는 Tailwind 규칙대로 `bg-<token>`·`text-<token>`·`border-<token>`·`divide-<token>`입니다(예: `bg-layer-default`,
  `text-fg-label`, `border-stroke-neutral`, `divide-stroke-row`, `hover:bg-brand-solid-hover`).
- 상태 의미는 다섯(대기·진행·완료·주의·실패)이고 이름은 `<의미>-weak`(약한 배경), `fg-<의미>`(글자), `stroke-<의미>`(선)입니다.
  같은 의미 안에서 더 진한 글자가 필요하면 `fg-<의미>-strong`을 둡니다(지금은 문단보다 눈에 띄어야 하는 한 번 보는 값의 글자).
  지금 화면이 쓰는 완료(`success`)·주의(`warning`)·실패(`danger`)의 배경·글자만 있습니다. 대기·진행과 상태 선은 상태 표시를
  처음 쓰는 화면이 확정 값으로 더합니다(쓰지 않는 token을 미리 두지 않습니다).
- 색만으로 뜻을 전하지 않습니다. 결과는 `role=status`·`alert` 문단의 문장으로 알립니다.

### 글자 단계

| token          | 쓰는 곳                                    |
| -------------- | ------------------------------------------ |
| `text-title-1` | page 제목(`h1`)                            |
| `text-title-2` | 오류·없는 화면 제목                        |
| `text-title-3` | 절 제목(`Section`의 `h2`)                  |
| `text-body`    | 본문·표·form·menu                          |
| `text-caption` | 도움말·부가 정보(시각, id, 운영자 이름 줄) |

- 각 단계는 짝지은 줄 간격을 같이 정합니다. `leading-*`로 따로 바꾸지 않습니다.
- 고정폭 글자는 `font-code` 하나이고 code·비밀 값(초대 code, TOTP 비밀 값·URI, 복구 code)만 씁니다.

### radius와 폭

| token                   | 쓰는 곳                                      |
| ----------------------- | -------------------------------------------- |
| `rounded-control`       | 단추·입력·select                             |
| `rounded-box`           | 안내·결과 문단, code 조각                    |
| `rounded-card`          | 절(`Section`)·로그인 카드                    |
| `max-w-page`            | console 화면 폭(`ConsoleShell`)              |
| `max-w-narrow`          | 로그인·등록·복구 카드 열, 오류·없는 화면     |
| `grid-cols-label-value` | 이름·값 짝(`<dl>`): 이름 열은 내용 폭        |
| `aria-current-page:`    | 링크 목록의 지금 항목(`aria-current="page"`) |

- `rounded-full`·`rounded-none`은 그대로 씁니다. shadow token은 없습니다. 층은 배경과 선으로 나눕니다.
- `grid-cols-label-value`는 `@utility`, `aria-current-page`는 `@custom-variant`로 `globals.css`에 있습니다. 같은 모양이 다시
  필요하면 임의 값 대신 이렇게 이름을 붙입니다.

### token 더하는 법

1. 새 화면이 지금 역할로 표현할 수 없는 값을 쓰면 역할 이름을 정해 `globals.css` `@theme inline`에 더하고 이 절 표에 행을 둡니다.
   이름은 쓰는 곳의 역할이고 값이나 색 이름(`slate`, `blue`)을 담지 않습니다.
2. 다른 theme 변수를 참조하는 값은 `@theme inline`에 둡니다. utility가 참조한 값을 그대로 씁니다.
3. 쓰지 않게 된 token은 그 변경이 지웁니다.

## ⑨ Storybook과 캡처

- 설정은 [`.storybook/`](../../.storybook)(`@storybook/nextjs-vite`, 이 앱의 `next.config.ts`, App Router mock)이고 story는
  `src/**/__stories__/*.stories.tsx`입니다. token 견본은 `src/ui/__stories__/`, 화면 story는 `src/screens/<기능>/__stories__/`에
  둡니다. 화면은 그 route group과 같은 틀(`frames.tsx`의 로그인 카드·console 셸)에 그립니다.
- story는 tracked이고 fixture는 가짜 값만 씁니다(`@example.test` 주소, 고정 UUID, 형식만 맞춘 code. 공개 저장소).
  `src/ui/__stories__/fixtures.ts`가 공용 fixture이고, API 응답을 대신하는 fixture는
  [`story-fixtures.test.ts`](./story-fixtures.test.ts)가 BFF와 같은 공유 schema로 확인합니다. story 파일은 상대 경로로
  import합니다(`tsconfig.json` 밖이라 `@/` 경로가 story 파일에 적용되지 않습니다).
- BFF 응답 뒤에 열리는 단계(로그인 둘째 단계·복구 로그인, 등록 비밀번호·passkey)는 운영자처럼 엽니다. story의 `beforeEach`가
  `bff-stub.ts`로 그 단계가 부르는 BFF 경로에 fixture를 답하고, `play`가 입력·누름 뒤 다음 단계가 보일 때까지 기다립니다. passkey
  같은 실제 인증기가 필요한 뒤 단계는 그 부품 story(`Credentials/*`)로 봅니다.
- story 검사(`playwright.storybook.config.ts`, `e2e/storybook/`)는 static build의 모든 story를 Chromium으로 열어 `play`까지 끝난
  뒤 render 오류 0과 axe(`wcag2a`·`wcag2aa`·`wcag21a`·`wcag21aa`·`wcag22aa`) 위반 0을 봅니다. 스크린샷 비교와 기준 이미지는 두지
  않습니다. Backoffice Web gate가 돌립니다.
- Owner 확인용 캡처와 비교 이미지는 `.artifacts/plans/<umbrella>/<plan>/<phase>/` 아래에만 두고 git에 올리지 않습니다. PR diff에
  image 파일이 더해지지 않습니다.
- 확인 폭은 1280·1440이 먼저이고 390은 page 가로 넘침(reflow)을 봅니다(`preview.tsx` viewport).

```sh
pnpm backoffice-web:prepare
pnpm --dir apps/backoffice-web ci:storybook          # 개발 server, http://localhost:6007
pnpm backoffice-web:storybook:build:prepared         # static build → apps/backoffice-web/storybook-static/
pnpm --dir apps/backoffice-web exec playwright install chromium
pnpm backoffice-web:storybook:check:prepared         # story 검사
```
