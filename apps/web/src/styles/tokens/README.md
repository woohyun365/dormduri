# KNU 시각 값 token

새 화면 계층([`src/screens`](../../screens/README.md))의 색·글자·간격·폭·radius·타깃·focus·motion 값의 판단·근거·사용 규칙을
소유합니다. **값은 token JSON에만 둡니다.** 이 문서에 숫자를 옮겨 적은 표는 판단 근거를 보이는 초기값이고, 다르면 JSON이 맞습니다.
기존 화면(`globals.css` theme, [`knu.css`](../knu.css))은 이 token을 쓰지 않고 바뀌지 않습니다.

## 파일과 생성

| 파일                                     | 책임                                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| `knu.resolver.json`                      | DTCG Resolver 2025.10 문서. set 순서(primitive → semantic → component)와 `motion` modifier |
| `primitive.tokens.json`                  | 색 ramp 값. semantic·component가 alias로만 읽고 CSS로 내보내지 않습니다                    |
| `semantic.tokens.json`                   | 화면이 쓰는 역할: 색, type scale, 글꼴, 간격, 폭, radius, duration, easing                 |
| `component.tokens.json`                  | 터치 타깃과 focus ring                                                                     |
| `motion-reduced.tokens.json`             | `motion: reduced` 문맥 값(duration 0ms)                                                    |
| `build-tokens.mjs`, `build-tokens.d.mts` | 생성기(Node ESM, `node:` 모듈만 사용)와 test용 타입 선언                                   |
| `tokens.generated.css`                   | 생성 결과. 직접 고치지 않습니다                                                            |
| `utilities.css`                          | token을 묶는 `@utility`(`focus-ring`)                                                      |

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
  `cssContexts`는 기본이 아닌 문맥을 CSS 조건에 연결합니다(지금 `motion.reduced` → `@media (prefers-reduced-motion: reduce)`의
  `:root` override). 조건이 없는 문맥, 글꼴처럼 `@theme inline`인 token의 override는 생성 실패입니다.
- Tailwind 기본 theme은 지우지 않고 더하기만 합니다(기존 화면이 씁니다). `--spacing`은 기본과 같은 0.25rem을 이 원본이 다시 정합니다.

## 값의 판단

### 색

모든 색은 불투명입니다. 브랜드는 기존 KNU 파랑(`--knu-primary` 계열), 중립은 기존 KNU 회색 계열에서 고르고 상태 색은 아래 대비 짝을
넘는 값으로 골랐습니다.

| 묶음   | 역할                                                                          | 쓰는 곳                                                                    |
| ------ | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 층     | `layer-basement`, `layer-default`, `layer-floating`                           | page 바탕(회색) → 그 위 panel·card → sheet·popover                         |
| 글자   | `fg-neutral`, `fg-muted`, `fg-subtle`, `fg-inverted`, `fg-brand`, `fg-<상태>` | 본문 → 보조 → 가장 약한 글자, solid 위 글자, 강조 링크                     |
| 선     | `stroke-neutral`, `stroke-subtle`, `stroke-focus`                             | 입력·control 경계, 장식 구분선, focus 표시                                 |
| 브랜드 | `brand-solid`, `brand-weak`                                                   | 주 행동 배경, 옅은 강조 배경                                               |
| 상태   | `{critical,warning,positive,informative}-{solid,weak}`                        | 차단·주의·확인·안내. 상태는 색만으로 전달하지 않고 글·아이콘을 함께 둡니다 |

대비 짝은 `__tests__/build-tokens.test.ts`가 token 값에서 WCAG 2.2 공식으로 판정합니다(1.4.3 글자 4.5:1, 1.4.11 UI 요소 3:1).

| 앞                                                | 뒤                                | 기준  |
| ------------------------------------------------- | --------------------------------- | ----- |
| `fg-neutral`, `fg-muted`, `fg-subtle`, `fg-brand` | 세 층                             | 4.5:1 |
| `fg-inverted`                                     | `brand-solid`, 상태 `solid` 네 개 | 4.5:1 |
| `fg-<상태>`                                       | 같은 상태 `weak`, `layer-default` | 4.5:1 |
| `stroke-focus`                                    | 세 층                             | 3:1   |
| `stroke-neutral`, `brand-solid`                   | `layer-default`, `layer-basement` | 3:1   |

- 가장 빠듯한 짝은 `fg-subtle` 대 `layer-basement`(약 4.55:1)입니다. basement를 더 어둡게 하면 `fg-subtle`도 함께 어둡게 해야 합니다.
- `stroke-subtle`은 장식 구분선이라 기준이 없습니다. control 경계에는 `stroke-neutral`을 씁니다.
- 위 표에 없는 글자·배경 조합(예: `brand-weak` 위 글자)을 처음 쓰는 화면은 그 짝을 test에 더합니다.

### 글자(type scale)

단계표는 크기마다 줄 간격을 짝지어 둡니다. 크기는 rem이라 사용자 글자 크기 설정과 200% 확대를 따릅니다. `text-<단계>` 하나가 크기와
줄 간격을 함께 걸고, `/tight` 같은 이름 줄 간격이나 `leading-*`으로 바꾸지 않습니다.

| 단계                                  | px / 줄 간격                   | 쓰임                                                    |
| ------------------------------------- | ------------------------------ | ------------------------------------------------------- |
| `caption`, `label`, `body-sm`         | 12 / 1.5, 13 / 1.5, 14 / 1.5   | 보조 설명, form label, 목록·표의 작은 본문              |
| `body`, `body-long`, `body-lg`        | 16 / 1.6, 16 / 1.7, 18 / 1.55  | 본문, 긴 글, 강조 본문                                  |
| `title-3`, `title-2`, `title-1`       | 20 / 1.4, 24 / 1.35, 28 / 1.3  | section·card·page 제목                                  |
| `display-3`, `display-2`, `display-1` | 32 / 1.25, 40 / 1.2, 48 / 1.15 | Landing 같은 큰 제목. weight 700이 단계에 들어 있습니다 |

- 단계는 화면이 실제로 쓰는 만큼 나중에 줄입니다. 새 단계를 더하기보다 가까운 단계를 먼저 씁니다.

### 글꼴

- `font-body`: Noto Sans KR → Apple SD Gothic Neo → Malgun Gothic → sans-serif. 새 화면 root 요소에 겁니다.
- `font-display`: Noto Serif KR → AppleMyungjo → Batang → serif. `display-*` 단계에만 씁니다.
- weight는 400·500·700(`font-normal`·`font-medium`·`font-bold`)만 씁니다. 두 글꼴 모두 variable 한 벌이라 weight 수가 받는 파일 수와
  무관합니다.
- 글꼴은 [`../fonts.ts`](../fonts.ts)가 `next/font/google`로 걸고 root layout이 `<html>`에 변수 class를 둡니다. preload는 latin 파일
  하나씩이고 한글 slice는 unicode-range로 쓰일 때 받습니다. fallback 목록은 글꼴을 받기 전·실패했을 때 macOS·Windows 한국어 글꼴로
  보이게 합니다. 기존 화면의 body 글꼴(Arial)과 `--font-sans`(Geist)는 그대로입니다.

### 간격·폭·radius

- 간격은 4px 격자입니다(`--spacing` 0.25rem, `p-4` 같은 배수, 반 단계는 `0.5` 배수). 화면 여백 `gutter`(16px)·`gutter-wide`(20px),
  section 간격 `section`(40px)·`section-desktop`(64px)은 이름 token으로 둡니다.
- 폭: `max-w-page`(1152px)는 page 본문, `max-w-reading`(720px)은 긴 글 읽기 폭입니다.
- radius는 역할별로 고정합니다: `rounded-input`(4px), `rounded-control`·`rounded-card`(8px), `rounded-panel`(12px),
  `rounded-sheet`(16px). 둥근 pill은 `rounded-full`입니다.
- 그림자 token은 아직 없습니다. 층은 `layer-*` 배경과 `stroke-*` 선으로 나누고, 그림자가 필요한 첫 화면이 semantic 층에 더합니다.

### 타깃·focus

- 판정은 WCAG 2.2 AA입니다. 터치 타깃은 최소 24×24 CSS px(`target-min`, 2.5.8)이고, 주 행동은 KNU 목표 44×44(`target-primary`,
  2.5.5 AAA 값)입니다. 예: `min-h-target-min`, `size-target-primary`.
- focus 표시는 `focus-visible:focus-ring`으로 겁니다. `focus-ring`은 `stroke-focus` 색, 두께 2px, offset 2px의 outline입니다
  (KNU 목표, 2.4.13 AAA 값). offset이 있어 ring은 층 배경 위에 그려지므로 층과의 대비(3:1)로 판정합니다. focus를 가리는
  overflow·sticky 배치를 두지 않습니다.

### breakpoint와 reflow

- Tailwind 기본 breakpoint를 그대로 씁니다. Mobile/Desktop 경계는 `lg`(64rem, 1024px)이고 split-presentation도 `lg`에서 바꿉니다.
- 검증 폭은 320·390·768·1023·1024·1280·1440px입니다. 320px에서 가로 scroll 없이 읽혀야 합니다(1.4.10).

### 한국어 줄바꿈

- 문장 요소: `break-keep wrap-anywhere`(어절 단위로 줄을 바꾸고 긴 URL·영문은 넘치지 않게 끊습니다).
- 제목: `text-balance`, 긴 본문: `text-pretty`. 지원하지 않는 browser는 무시합니다.

### motion

- `--duration-fast`(120ms)·`--duration-normal`(200ms)·`--duration-slow`(320ms)와 `ease-standard`입니다. duration은 utility가 없는
  `:root` 변수라 `duration-(--duration-fast)` 대신 style·motion 설정에서 `var(--duration-fast)`로 읽습니다. 쓰는 방식은 처음 쓰는
  화면이 정합니다.
- 사용자가 motion 줄이기를 켜면 세 duration이 0ms가 됩니다.

## token 추가와 이름

- 새 token은 그것을 처음 쓰는 화면이 semantic(또는 component) 층에 더하고, 이 문서의 해당 묶음에 판단을 적고, CSS를 다시 만듭니다.
  새 글자·배경 조합은 대비 짝 test에 더합니다.
- 이름은 역할이고 값이 아닙니다(`fg-muted`, `radius-card`). Tailwind 기본 theme 이름과 기존 `globals.css` theme 이름(`primary`,
  `muted`, `border` 등)과 겹치지 않게 짓습니다. 새 화면 lint가 그 이름들을 막습니다([`screens/README.md`](../../screens/README.md)).

## dark

지금 값은 light 한 벌입니다. dark 진입점이 생기는 제품 결정 때 resolver에 `theme` modifier(light 기본, dark 문맥 파일)를 더하고,
그 문맥을 적용할 CSS 조건(class 또는 media)을 `cssContexts`에 정합니다. 역할 이름은 그대로 두고 값만 문맥별로 바뀝니다.
