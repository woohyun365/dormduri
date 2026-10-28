# 돔두리 시각 값 token

새 화면 계층([`src/screens`](../../screens/README.md))의 색·글자·간격·폭·radius·타깃·focus·motion 값의 판단·근거·사용 규칙을
소유합니다. **값은 token JSON에만 둡니다.** 이 문서에 숫자를 옮겨 적은 곳은 판단 근거를 보이는 값이고, 다르면 JSON이 맞습니다.
기존 화면(`globals.css` theme, [`knu.css`](../knu.css))은 이 token을 쓰지 않고 바뀌지 않습니다. 예외로 기존 화면 header는 새 계층의 공유
부품인 서비스 로고(`@/screens/ui/brand`)를 import하므로, 그 로고 안에서만 이 token이 쓰입니다.

token은 지금 새 화면 계층에 있는 화면(공개 랜딩)이 쓰는 것만 둡니다. Auth·Legal·Main 같은 화면을 새 계층으로 만들 때 그 화면이
필요한 역할을 더합니다(아래 "token 추가와 이름"). Storybook `Foundations` 문서(`__stories__/*.mdx`)가 이 token을 견본과 함께
보입니다.

## 파일과 생성

| 파일                                     | 책임                                                                                                 |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `knu.resolver.json`                      | DTCG Resolver 2025.10 문서. set 순서(primitive → semantic → component)와 `motion`·`palette` modifier |
| `primitive.tokens.json`                  | 기본(라이트) 색 ramp 값. semantic·component가 alias로만 읽고 CSS로 내보내지 않습니다                 |
| `semantic.tokens.json`                   | 화면이 쓰는 역할과 기본 값: 색(라이트), type scale, 글꼴, 간격, 폭, radius, duration, easing         |
| `component.tokens.json`                  | 터치 타깃과 focus ring                                                                               |
| `palette-dark.tokens.json`               | `palette: dark` 문맥의 색 역할 값과 그 ramp                                                          |
| `motion-reduced.tokens.json`             | `motion: reduced` 문맥 값(duration 0ms)                                                              |
| `build-tokens.mjs`, `build-tokens.d.mts` | 생성기(Node ESM, `node:` 모듈만 사용)와 test용 타입 선언                                             |
| `tokens.generated.css`                   | 생성 결과. 직접 고치지 않습니다                                                                      |
| `utilities.css`                          | token을 묶는 `@utility`(focus ring, 깊이, 등장 효과)                                                 |
| `__stories__/`                           | Storybook `Foundations` 문서(MDX)와 계산값 견본(`Samples/Tokens`·`Samples/Palettes`)                 |

- JSON을 고친 뒤 `apps/web`에서 `node src/styles/tokens/build-tokens.mjs`로 CSS를 다시 만들고 함께 commit합니다. 원본과 생성
  결과가 다르면 `__tests__/build-tokens.test.ts`의 drift test가 `pnpm check`(web test)를 실패시킵니다.
- 지원 형식은 쓰는 것만입니다: color(`colorSpace: "srgb"`, `components`, `alpha` 1, `hex`가 components와 일치), dimension(`px`·`rem`),
  duration(`ms`), cubicBezier, fontFamily, fontWeight, number, 전체 값 alias `{group.token}`, 그룹 `$type` 상속, `$root` token.
  모르는 `$type`·속성·형식, 반투명 색, 순환·없는 alias, 같은 CSS 이름으로 가는 두 token은 생성 실패입니다.
- 출력: Tailwind namespace(`color`·`text`·`font`·`radius`·`spacing`·`container`·`ease`) token은 `@theme`, 다른 변수를 참조하는
  글꼴은 `@theme inline`, namespace가 없는 token(duration, focus ring 두께·offset)은 `:root` 변수입니다. `primitive` root는
  내보내지 않습니다. `text.<단계>.$root`는 `--text-<단계>`, 같은 단계의 `line-height`·`font-weight`는 Tailwind 하위 속성
  `--text-<단계>--line-height`·`--font-weight`가 됩니다. `spacing.$root`는 `--spacing`(배수 기준)입니다.
- `$extensions["knu-roommate"]`: fontFamily token의 `cssVariables`는 글꼴 이름을 `next/font` CSS 변수로 바꿔 씁니다. modifier의
  `cssContexts`는 문맥을 CSS 조건에 연결합니다.
  - `motion.reduced` → `@media (prefers-reduced-motion: reduce)`의 `:root` override.
  - `palette.dark` → `[data-palette='dark']`, `palette.light`(기본) → `[data-palette='light']`.
  - 선택자 조건에 `"nestable": "true"`를 주면 그 선택자는 같은 modifier의 다른 문맥이 바꾸는 token을 모두 씁니다. 그래서 다른
    문맥 안에 겹쳐도 바깥 값이 남지 않습니다(어두운 페이지 안 밝은 게시판 창 `light`, 밝은 페이지 안 밤 그림 히어로 `dark`).
    기본 문맥은 nestable 선택자만 가질 수 있고, 그 선택자는 기본 값을 씁니다.
  - 조건이 없는 기본이 아닌 문맥, nestable 조건에 media를 함께 쓴 것, 글꼴처럼 `@theme inline`인 token의 override는 생성
    실패입니다.
- Tailwind 기본 theme은 지우지 않고 더하기만 합니다(기존 화면이 씁니다). `--spacing`은 기본과 같은 0.25rem을 이 원본이 다시 정합니다.

## 값의 판단

### 색

모든 색은 불투명입니다. 색 방향은 랜딩 디자인에서 고른 D 울트라마린 하나입니다. 기본 값이 라이트이고,
`data-palette="dark"` 안에서 다크 값으로 바뀝니다. 역할 이름은 두 문맥에서 같습니다.

| 묶음         | 역할                                                               | 쓰는 곳                                                                     |
| ------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| 층           | `layer-basement`, `layer-default`, `layer-floating`                | page 바탕 → 그 위 panel·card → 떠 있는 면                                   |
| 글자         | `fg-neutral`, `fg-muted`, `fg-brand`, `fg-on-brand`                | 본문 → 보조 글자, 강조 글자·링크, 주 행동 위 글자                           |
| 선           | `stroke-neutral`, `stroke-subtle`, `stroke-focus`                  | control 경계, 장식 구분선, focus 표시                                       |
| 브랜드       | `brand-solid`, `brand-weak`, `brand-stroke`                        | 주 행동 배경, 옅은 강조 면, 주 행동 테두리                                  |
| 형광펜 표시  | `annotation-marker`, `fg-on-annotation`                            | 그린 화면 속 손 표시와 그 위 글자. 두 문맥에서 같습니다                     |
| 반전 띠      | `layer-inverse`, `fg-on-inverse`, `fg-on-inverse-muted`            | 반전 면과 그 위 글자                                                        |
| 사진·빈 자리 | `media-scrim`, `fg-on-media`, `placeholder-fill`, `fg-placeholder` | 그림 위 scrim과 글자, 캡처가 들어갈 자리                                    |
| 창 단추      | `window-close`, `window-minimize`, `window-zoom`                   | 그린 브라우저 창의 macOS 창 단추. 상태 역할이 아니고 글자를 올리지 않습니다 |

- 다크 문맥은 층·글자·선·브랜드 면·반전 띠·사진 자리·창 단추 값을 바꿉니다. 주 행동 면과 그 위 글자(`brand-solid`·`fg-on-brand`),
  형광펜 표시, 그림 위 글자는 두 문맥에서 같습니다.
- 그림 속 묘사 색(형광펜 표시, 창 단추)은 UI 의미 역할과 이름을 나눕니다. 한 값을 두 쓰임이 나눠 쓰면 한쪽을 고칠 때 다른 화면이
  함께 바뀝니다.
- 상태 역할(차단·주의·확인 안내)은 아직 없습니다. 상태를 처음 보이는 화면이 글자·옅은 면·solid와 대비 짝을 라이트·다크 한 벌로
  더합니다. 신호등 채도를 피하고, 상태는 색만으로 전하지 않고 글·아이콘을 함께 둡니다.

대비 짝은 `__tests__/build-tokens.test.ts`가 두 문맥 모두에서 token 값으로 WCAG 2.2 공식에 따라 판정합니다(1.4.3 글자 4.5:1,
1.4.11 UI 요소 3:1). `Foundations/Samples/Palettes`가 같은 짝의 계산값을 보입니다.

| 앞                                     | 뒤                                | 기준  |
| -------------------------------------- | --------------------------------- | ----- |
| `fg-neutral`, `fg-muted`, `fg-brand`   | 세 층                             | 4.5:1 |
| `fg-on-brand`                          | `brand-solid`                     | 4.5:1 |
| `fg-neutral`, `fg-muted`, `fg-brand`   | `brand-weak`                      | 4.5:1 |
| `fg-on-annotation`                     | `annotation-marker`               | 4.5:1 |
| `fg-on-inverse`, `fg-on-inverse-muted` | `layer-inverse`                   | 4.5:1 |
| `fg-on-media`                          | `media-scrim`                     | 4.5:1 |
| `fg-placeholder`                       | `placeholder-fill`                | 4.5:1 |
| `stroke-focus`                         | 세 층                             | 3:1   |
| `stroke-neutral`, `brand-stroke`       | `layer-default`, `layer-basement` | 3:1   |

- `stroke-subtle`은 장식 구분선이라 기준이 없습니다. control 경계에는 `stroke-neutral`을 씁니다.
- 그림·그라디언트·opacity·filter 위 글자는 axe가 판정하지 못하거나(incomplete) 잘못 판정합니다. 글자만 투명하게 한 캡처에서 글자
  상자 안 가장 불리한 픽셀(밝은 글자면 가장 밝은 픽셀)과 글자 색으로 대비를 재고, 배치·문구·그림 높이가 바뀌면 다시 잽니다. 그림 위
  scrim은 4.5:1을 넘는 가장 옅은 값으로 정합니다.
- 위 표에 없는 글자·배경 조합을 처음 쓰는 화면은 그 짝을 test와 Palettes 견본에 더합니다.

### 글자(type scale)

단계표는 크기마다 줄 간격을 짝지어 둡니다. 크기는 rem이라 사용자 글자 크기 설정과 200% 확대를 따릅니다. `text-<단계>` 하나가 크기와
줄 간격을 함께 걸고, `/tight` 같은 이름 줄 간격이나 `leading-*`으로 바꾸지 않습니다.

| 단계                                  | px / 줄 간격                   | 쓰임                                                 |
| ------------------------------------- | ------------------------------ | ---------------------------------------------------- |
| `label`, `body-sm`                    | 13 / 1.5, 14 / 1.5             | 보조 설명, label, 작은 고지·표                       |
| `body`                                | 16 / 1.6                       | 본문                                                 |
| `title-3`, `title-2`, `title-1`       | 20 / 1.4, 24 / 1.35, 28 / 1.3  | section·card·page 제목                               |
| `display-3`, `display-2`, `display-1` | 32 / 1.25, 40 / 1.2, 48 / 1.15 | 랜딩 같은 큰 제목. weight 700이 단계에 들어 있습니다 |

- 새 단계를 더하기보다 가까운 단계를 먼저 씁니다.

### 글꼴

- `font-body`: Noto Sans KR → Apple SD Gothic Neo → Malgun Gothic → sans-serif. 새 화면 root 요소에 겁니다. 큰 제목도 같은 글꼴입니다.
- weight는 400·500·700(`font-normal`·`font-medium`·`font-bold`)만 씁니다. variable 한 벌이라 weight 수가 받는 파일 수와
  무관합니다.
- 글꼴은 [`../fonts.ts`](../fonts.ts)가 `next/font/google`로 걸고 root layout이 `<html>`에 변수 class를 둡니다. preload는 latin 파일
  하나이고 한글 slice는 unicode-range로 쓰일 때 받습니다. fallback 목록은 글꼴을 받기 전·실패했을 때 macOS·Windows 한국어 글꼴로
  보이게 합니다. 기존 화면의 body 글꼴(Arial)과 `--font-sans`(Geist)는 그대로입니다.

### 간격·폭·radius·깊이

- 간격은 4px 격자입니다(`--spacing` 0.25rem, `p-4` 같은 배수, 반 단계는 `0.5` 배수). 화면 좌우 여백 `gutter`(20px),
  section 간격 `section`(40px)·`section-desktop`(64px)은 이름 token으로 둡니다.
- 폭: `max-w-page`(1152px)는 page 본문, `max-w-content`(1080px)는 랜딩 section 안 내용, `max-w-reading`(720px)은 긴 글 읽기 폭입니다.
- radius는 역할별로 고정합니다: `rounded-input`(4px), `rounded-control`(8px), `rounded-panel`(12px), `rounded-sheet`(16px). 둥근
  pill은 `rounded-full`입니다.
- 그림자는 창 틀·카드·떠 있는 글자에만 씁니다. `utilities.css`의 `depth-card`·`depth-window`·`depth-glow`·
  `text-lift`·`text-glow`이고, 그림자 색은 scrim 역할을 투명도와 섞어 palette를 따릅니다. 화면은 Tailwind `shadow-*`를 쓰지 않습니다.

### 타깃·focus

- 판정은 WCAG 2.2 AA입니다. 터치 타깃은 최소 24×24 CSS px(`target-min`, 2.5.8)이고, 주 행동은 돔두리 목표 44×44(`target-primary`,
  2.5.5 AAA 값)입니다. 예: `min-h-target-min`, `size-target-primary`.
- focus 표시는 `focus-visible:focus-ring`으로 겁니다. `focus-ring`은 `stroke-focus` 색, 두께 2px, offset 2px의 outline입니다
  (돔두리 목표, 2.4.13 AAA 값). offset이 있어 ring은 층 배경 위에 그려지므로 층과의 대비(3:1)로 판정합니다. 반전 면·그림 위에서는
  `focus-on-inverse`·`focus-on-media`가 ring 색을 그 면 위 글자 색으로 바꿉니다. focus를 가리는 overflow·sticky 배치를 두지 않습니다.

### breakpoint와 reflow

- Tailwind 기본 breakpoint를 그대로 씁니다. Mobile/Desktop 경계는 `lg`(64rem, 1024px)이고 split-presentation도 `lg`에서 바꿉니다.
- 검증 폭은 320·390·767·768·834·1023·1024·1280·1440px입니다. 바꾸는 breakpoint는 직전·직후 폭(예: `md`의 767·768)을 함께 보고,
  태블릿 세로(834)를 넣습니다. 320px에서 가로 scroll 없이 읽혀야 합니다(1.4.10).
- 높이도 봅니다. 기본 390×844에 더해 짧은 휴대폰(360×640·375×667처럼 700px 이하)에서 첫 화면 고지와 그림 위 글자 대비를 다시
  확인합니다. 그림이 든 첫 화면은 높이가 짧을 때 먼저 무너집니다.

### 한국어 줄바꿈

- 문장 요소: `break-keep wrap-anywhere`(어절 단위로 줄을 바꾸고 긴 URL·영문은 넘치지 않게 끊습니다).
- 제목: `text-balance`, 긴 본문: `text-pretty`. 지원하지 않는 browser는 무시합니다.

### motion

- duration은 `slow`(320ms)·`reveal`(560ms)·`band`(720ms)·`stagger`(80ms)·`settle`(1800ms), easing은 `ease-standard`·
  `ease-emphasized`입니다. duration은 utility가 없는 `:root` 변수라 style·`@utility`에서 `var(--duration-…)`로 읽습니다.
- 사용자가 motion 줄이기를 켜면 모든 duration이 0ms가 되어 움직임이 바로 끝납니다. section 글자는 스크롤로 들어올 때 흐림에서
  또렷해지고(`reveal-soft`), 처음 그린 화면과 대비 검사는 최종 상태를 봅니다. token 밖 시간의 예외와 이유는 Foundations/Motion이
  소유합니다.

## token 추가와 이름

- 새 token은 그것을 처음 쓰는 화면이 semantic(또는 component) 층에 더하고(다크 값이 다르면 `palette-dark.tokens.json`에도), 이 문서의
  해당 묶음에 판단을 적고, CSS를 다시 만듭니다. 새 글자·배경 조합은 대비 짝 test와 Palettes 견본에 더합니다.
- 화면이 더 쓰지 않게 된 token은 지웁니다. 견본(`Samples/Tokens`)이 바뀌면 Linux 기준 스크린샷도 다시 만듭니다
  ([`e2e/README.md`](../../../e2e/README.md)).
- 이름은 역할이고 값이 아닙니다(`fg-muted`, `radius-panel`). Tailwind 기본 theme 이름과 기존 `globals.css` theme 이름(`primary`,
  `muted`, `border` 등)과 겹치지 않게 짓습니다. 새 화면 lint가 그 이름들을 막습니다([`screens/README.md`](../../screens/README.md)).
