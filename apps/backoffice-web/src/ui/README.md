# 백오피스 디자인 지침

백오피스 Web 화면의 시각 값 역할, 앱 셸, layout 패턴, 공통 component, 표기 규칙, 로고 사본, Storybook·캡처 규칙과 화면 완료 확인
목록을 소유합니다. 새 화면과 바뀌는 화면은 이 문서를 따르고, 이 문서 밖 구조가 필요하면 같은 변경에서 이 문서를 고칩니다.

## ① 범위와 원본

- **값은 [`src/app/globals.css`](../app/globals.css)에만 둡니다.** raw 값은 `@theme`, 다른 theme 변수를 참조하는 값(`font-code`,
  `container-narrow`)만 `@theme inline`입니다. 폭별 값은 같은 파일의 `@media`가 같은 이름을 `:root`에서 바꿉니다. 이 문서는 역할·이름
  규칙·쓰는 곳과 판단을 적고 숫자를 옮겨 적지 않습니다. 둘이 다르면 CSS가 맞습니다.
- 대상은 `apps/backoffice-web`의 `src/**`(test 밖)와 `.storybook/**`입니다. 사용자 Web(`apps/web`)의 token·셸·theme을 가져오지
  않고, 다른 앱 code를 import하지 않습니다([앱 README](../../README.md) §1).
- 화면 code의 문자열에는 token 이름만 씁니다. Tailwind 기본 색 팔레트(`slate-900` 등)·`white`·`black`, 기본 글자 크기
  (`text-sm` 등), 기본 radius(`rounded-md` 등)·shadow 이름, container 폭(`max-w-md` 등), 이름 붙은 줄 간격·easing, 임의 값
  (`-[…]`)과 임의 속성(`[prop:value]`), CSS 변수 축약(`-(--…)`), raw 색 값, `font-sans`·`font-serif`·`font-mono`는
  [`eslint.config.mjs`](../../eslint.config.mjs)의 `no-restricted-syntax`가 오류로 막습니다. 같은 목록에 server action 금지(앱
  README §1)가 함께 있습니다. 한 파일에 걸린 뒤 block의 같은 rule 옵션이 앞 옵션을 바꾸므로 두 금지는 한 목록이어야 하고,
  [`presentation-lint.test.ts`](./presentation-lint.test.ts)가 금지·허용 예와 실효 설정으로 그 목록을 지킵니다.
- 임의 selector variant(`[&>li]:` 등)는 값을 싣지 않아 lint가 막지 않지만 쓰지 않습니다. 같은 모양이 다시 필요하면 `globals.css`에
  `@utility`·`@custom-variant`로 이름을 붙입니다(예: `focus-ring`, `grid-cols-master-detail`).
- 간격의 작은 값(`p-4`·`gap-2` 등)은 Tailwind 기본 배수(`--spacing`, 4px)를 쓰고, 화면의 큰 틀 간격은 아래 간격 역할을 씁니다. 글꼴
  굵기(`font-medium`·`font-semibold`·`font-bold`)와 layout utility(`flex`·`grid`·`min-h-screen` 등)는 Tailwind 기본입니다.
- 라이트 하나입니다. 어두운 판을 고르면 같은 이름에 문맥 값을 더합니다.
- 결정 기록: [`fe.ds.token-layer/backoffice`](../../../../docs/architecture/decisions/fe.md#fedstoken-layerbackoffice).

## ② token 역할

### 색

| 묶음    | token                                                                                                               | 쓰는 곳                                                                             |
| ------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 셸      | `shell`, `shell-fg`, `shell-muted`, `shell-hover`, `shell-stroke`                                                   | 사이드바·좁은 폭 위 막대의 바탕, 글자, 묶음 이름, hover, 경계                       |
| 셸      | `shell-active`, `shell-active-fg`, `shell-indicator`                                                                | 지금 menu 항목의 흰 면, 파랑 글자, 왼쪽 막대                                        |
| 층      | `layer-basement`, `layer-default`, `layer-muted`, `layer-selected`                                                  | page 바탕 → 카드·입력·drawer 면 → 행 hover·결정 영역·code 상자 → 고른 목록 항목     |
| 글자    | `fg-neutral`, `fg-label`, `fg-description`, `fg-muted`                                                              | 제목·값 → label·용어 → 설명 문단·표 머리 → 도움말·부가 정보                         |
| 글자    | `fg-on-brand`, `fg-brand`                                                                                           | 주 단추·위험 확인 단추 위 글자, 글자 link(`TextLink`)·감사 시각 단추                |
| 선      | `stroke-neutral`, `stroke-subtle`, `stroke-row`                                                                     | 빈 상태 점선 → 카드·절 경계와 구분선 → 표·목록 행 구분                              |
| 선      | `stroke-control`, `stroke-focus`, `stroke-selected`                                                                 | 입력 칸 경계(흰 바탕 3:1 이상) → keyboard focus 윤곽선 → 고른 목록 항목 경계        |
| 브랜드  | `brand-solid`, `brand-solid-hover`                                                                                  | 주 행동(`Button` primary)                                                           |
| 로고    | `logo-brand`, `logo-ink`                                                                                            | 로고 mark의 파랑과 글자 색(`BrandLogo`만)                                           |
| 상태    | `fg-pending`; `info-weak`·`fg-info`·`stroke-info`; `success-*`; `warning-*`; `danger-*`(각 `-weak`·`fg-`·`stroke-`) | 다섯 의미(대기·진행/안내·완료·주의·실패)의 `StatusBadge` 글자와 `Notice` 면·글자·선 |
| 상태    | `danger-solid`, `danger-solid-hover`                                                                                | 위험 확인 창의 마지막 단추만                                                        |
| 면 채움 | `tint-neutral`, `tint-neutral-hover`, `tint-danger-hover`                                                           | 보조 단추 면과 hover, 위험 단추 hover(테두리 없음)                                  |
| overlay | `scrim`                                                                                                             | drawer·확인 창 뒤 바탕                                                              |

- utility는 Tailwind 규칙대로 `bg-<token>`·`text-<token>`·`border-<token>`·`divide-<token>`·`outline-<token>`입니다(예:
  `bg-layer-default`, `text-fg-label`, `border-stroke-control`, `divide-stroke-row`, `hover:bg-brand-solid-hover`).
- 상태 의미는 다섯이고 이름은 `<의미>-weak`(약한 면), `fg-<의미>`(글자), `stroke-<의미>`(선)입니다. 대기는 면이 없어 `fg-pending`만
  있습니다. 의미와 모양의 대응은 [`status.tsx`](./status.tsx) 한 파일이 정합니다(⑥).
- 색만으로 뜻을 전하지 않습니다. 상태는 뜻 글자와 점, 결과는 `role=status`·`alert` 문단의 문장으로 알립니다.

### 글자 단계

| token          | 쓰는 곳                                             |
| -------------- | --------------------------------------------------- |
| `text-title-1` | page 제목(`h1`, `PageHeader`·인증 카드·홈 인사)     |
| `text-title-2` | 카드·drawer·확인 창·상세 제목(`h2`)                 |
| `text-body`    | 본문·form·menu·결과 문단                            |
| `text-table`   | 표 칸(`TD`)                                         |
| `text-label`   | 입력 label, 표 머리, 상태 표시, 작은 단추           |
| `text-caption` | 도움말·부가 정보(시각 줄, id, 요청자 줄), 묶음 이름 |

- 각 단계는 짝지은 줄 간격을 같이 정하고, 1024 미만에서 작아집니다. `leading-*`로 따로 바꾸지 않습니다.
- 고정폭 글자는 `font-code` 하나이고 code·비밀 값(초대 code, TOTP 비밀 값·URI, 복구 code)만 씁니다.

### radius·그림자·간격·크기·폭

| token                                                              | 쓰는 곳                                                          |
| ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `rounded-control`, `rounded-card`                                  | 단추·입력·code 칸·작은 상자 / 카드·목록 항목·안내 문단·인증 카드 |
| `shadow-overlay`                                                   | drawer·확인 창만(층은 배경과 선으로 나눕니다)                    |
| `p-page`, `p-card`, `gap-stack`                                    | page 본문 여백 / 카드 안 여백 / 카드 사이·page 머리 아래 간격    |
| `py-cell-y`·`px-cell-x`, `py-control-y`·`px-control-x`, `py-nav-y` | 표 칸 / 입력·중간 단추 / menu 항목                               |
| `h-header`, `w-sidebar`, `w-drawer`                                | 위 막대 높이, 펼친 사이드바 폭, drawer 폭                        |
| `max-w-narrow`                                                     | 인증·없는 화면·오류 카드 열                                      |
| `grid-cols-label-value`                                            | 이름·값 짝(`<dl>`): 이름 열은 내용 폭                            |
| `grid-cols-master-detail`                                          | 마스터-디테일의 목록 열(`--spacing-list`)과 상세 열              |
| `focus-ring`                                                       | 모든 단추·link·입력의 keyboard focus 윤곽선(2px, 2px 띄움)       |

- `rounded-full`·`rounded-none`은 그대로 씁니다. shadow는 `shadow-overlay` 하나입니다.
- 폭별 값: 1024 미만(`@media (width < 64rem)`)은 글자 단계·여백·radius·목록·drawer 폭이 작고 색은 그대로입니다. 1024~1279
  (`@media (64rem <= width < 80rem)`)는 page 여백과 표 칸 좌우만 줄이고, 표는 최소 폭을 풀어 긴 칸이 띄어쓰기에서 줄을 바꿉니다
  (`lg:max-xl:` 화면 class).
- `grid-cols-label-value`·`grid-cols-master-detail`·`focus-ring`은 `globals.css`의 `@utility`입니다.

### token 더하는 법

1. 새 화면이 지금 역할로 표현할 수 없는 값을 쓰면 역할 이름을 정해 `globals.css` `@theme`에 더하고 이 절 표에 행을 둡니다. 이름은
   쓰는 곳의 역할이고 값이나 색 이름(`slate`, `blue`)을 담지 않습니다. 폭별로 다르면 같은 이름을 `@media`의 `:root`에서 바꿉니다.
2. 다른 theme 변수를 참조하는 값은 `@theme inline`에 둡니다. utility가 참조한 값을 그대로 씁니다.
3. 쓰지 않게 된 token·utility·variant는 그 변경이 지웁니다. 이름을 바꾸면 lint message와 `presentation-lint.test.ts` 허용 예의 이름도
   같은 변경에서 맞춥니다.

## ③ 앱 셸

- `(console)` route group의 [`ConsoleShell`](../screens/console/ConsoleShell.tsx)(server)이 session의 menu 묶음·사용자·로그아웃·끝난
  접속 안내를 client [`ConsoleFrame`](../screens/console/ConsoleFrame.tsx)에 넘깁니다. 셸 부품은 `src/screens/console/`에 둡니다.
- menu 묶음은 [`navigation.ts`](../screens/console/navigation.ts)의 `NAVIGATION` 한 곳입니다: 홈 / 운영자 관리(운영자 계정, 권한
  요청) / 감사(감사 기록) / 내 설정(내 보안 설정). 항목마다 보이는 데 필요한 권한(`anyOf`)이 있고, 권한이 없는 항목과 비게 된 묶음은
  숨깁니다. 숨김은 편의이고 권한은 server와 API가 정합니다. 새 화면은 업무가 맞는 묶음에 항목 하나를 더하고, 맞는 묶음이 없을 때만
  묶음을 더합니다.
- 1024 이상: 왼쪽 사이드바(로고, 묶음 이름 + 아이콘 link, 아래 접기 단추)와 본문 위 막대(지금 위치 `묶음 / 화면`, 사용자 이름·역할,
  로그아웃)입니다. 지금 항목은 `aria-current="page"`로 흰 면·파랑 글자·왼쪽 막대입니다. 접기는 아이콘 줄로 줄이고, 화면을 옮겨도
  유지되며 browser 저장소에 쓰지 않습니다(새로 고치면 펼침).
- 1024 미만: 위 막대(로고 + `메뉴` 단추)이고, 메뉴를 열면 묶음 전체가 이름과 함께 펼쳐집니다(접힘 상태와 무관). 다음 화면으로
  옮기면 닫힙니다.
- 끝난 접속 안내(idle 15분·로그인 8시간·`closed`)는 main 맨 위 한 곳(`SessionEndNotice`, 주의 `Notice` + `다시 로그인` link)입니다.
  화면은 같은 안내를 따로 그리지 않고, console 안 결과 문단의 `session_required`는 `role=status`로 읽혀 셸 안내 뒤에 읽힙니다
  ([`result-message.ts`](./result-message.ts)).
- 셸 link와 `TextLink`는 모두 `prefetch={false}`입니다. prefetch는 API를 읽어 session 활동 시각을 옮깁니다([앱 README](../../README.md)
  §4).

## ④ layout 패턴

모든 패턴은 1280·1440을 먼저 보고, 1024에서 layout이 깨지지 않으며, 390에서 표 영역 안 가로 scroll 말고 page 가로 넘침이 없습니다
(1280·1024에서는 표 영역 scroll도 없음).

| 패턴          | 쓰는 업무(지금)        | 구조                                                                                        | URL 상태                                                               | 빈·오류·권한 없음                                              |
| ------------- | ---------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| 앱 셸         | console 다섯 화면      | ③                                                                                           | 지금 경로가 지금 항목                                                  | 끝난 접속은 셸 안내 한 곳                                      |
| 목록+필터     | 운영자 계정, 감사 기록 | `PageHeader`(제목·건수 줄·주요 action) → 결과 `Notice` → `Card flush` 안 표, 아래 page link | 필터·page는 query(필터는 API가 받을 때만)                              | `EmptyState`(빈 목록과 조건 결과 없음 구별), 403은 `Forbidden` |
| 대시보드      | 홈                     | 인사 `h1` → 처리할 일 카드(2/3) + 내 접속·복구 수단 카드(1/3), 1024 미만 한 열              | 없음                                                                   | 처리할 일이 없으면 문장 하나. KPI 숫자 카드 없음               |
| 마스터-디테일 | 권한 요청              | 상태 필터 + 목록(단추) / 상세(`section`) + 아래 고정 결정 영역                              | 상태 필터는 query, 고른 항목은 화면 상태(결정 뒤 유지, 자동 다음 없음) | 목록이 비면 상세 없음, 실패는 결정 영역 안                     |
| 폼/설정       | 내 보안 설정           | 절(`Card`)을 세로로 나열, 결과는 page 머리 아래                                             | 없음                                                                   | 실패는 page 머리 아래 `Notice`                                 |
| 상세+탭       | 없음(지침만)           | 머리(대상·상태) + 탭(`tablist`) + 탭 내용. 첫 사용처가 `Tabs` 부품을 만듭니다               | 고른 탭은 query                                                        | 탭마다 빈 상태                                                 |

- 인증 셋(로그인·등록·복구)과 없는 화면·오류는 패턴 밖의 `AuthCard`(연한 바탕 위 흰 카드 + 로고)입니다.
- 키보드: 모든 action은 Tab으로 닿고 Enter·Space로 누릅니다. 목록 항목은 단추이고 고른 항목은 `aria-current`입니다. drawer·확인 창은
  열면 focus가 그 안으로 가고, Escape와 `닫기`로 닫으면 연 단추로 돌아갑니다(⑥).

## ⑤ 새 화면이 패턴을 고르는 법

업무의 주 동작을 묻습니다.

1. 대기열을 한 건씩 처리하는가 → 마스터-디테일(예: 신고 검수, Legal 판 승인, 문의 답변).
2. 같은 종류 여러 건을 찾아 훑는가 → 목록(필터는 API가 그 query를 받을 때만. 예: FAQ 목록, 처리 끝난 신고 목록).
3. 한 대상에 서로 다른 때 보는 정보 묶음이 셋 이상인가 → 상세+탭(예: 신고 상세의 내용·대상·처리 이력, 매칭 시즌 상세의 설정·참가·결과).
4. 값을 만들거나 고치는가 → 폼(예: FAQ 편집, 시즌 설정. 저장하지 않은 변경이 있으면 떠나기 전에 확인).
5. 여러 업무의 지금 상태를 한눈에 보는가 → 대시보드(지금 API로 읽는 값만, 새 통계 API 없음).
6. 둘 이상 맞으면 주 동작의 패턴 하나를 고르고 나머지는 그 안 부품으로 둡니다.

채팅 열람처럼 사용자 개인정보를 보이는 화면은 패턴보다 먼저 처리방침과 운영자 접근 정책([operator-access](../../../../docs/policies/operator-access.md))을
봅니다. 전역 검색·column 설정 저장·칸반·캘린더·위저드·엑셀은 업무·API가 생길 때 이 절에 더합니다.

## ⑥ 공통 component

| 부품                                      | 파일                  | 규칙                                                                                                                        |
| ----------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `Button`                                  | `Button.tsx`          | primary·secondary·danger·danger-solid, `md`(40px)·`sm`(32px), 긴 글자는 `wrap`, 처리 중은 같은 tone + `disabled:opacity-60` |
| `TextField`·`TextAreaField`·`SelectField` | `fields.tsx`          | label·도움말·`stroke-control` 경계. label은 늘 보입니다                                                                     |
| `PageHeader`                              | `PageHeader.tsx`      | 제목 `h1`, 건수 줄, 주요 action 하나                                                                                        |
| `Card`                                    | `Card.tsx`            | 제목 `h2`와 머리 끝 action. 표를 담으면 `flush`                                                                             |
| `StatusBadge`와 의미 표                   | `status.tsx`          | 점 + 굵은 뜻 색 글자, pill 없이 자기 자리(표 열, 줄 앞 고정 칸, 카드 머리 끝, 따로 한 줄). 문장 안에 넣지 않음              |
| `Notice`                                  | `Notice.tsx`          | 결과·안내 문단. 완료·안내는 `role=status`, 실패·끝난 접속은 `role=alert`                                                    |
| 결과 문단 규칙                            | `result-message.ts`   | `success()`·`useFailure()`·`failureText()`. console 안 `session_required`만 `status`                                        |
| `TableRegion`·`TH`·`TD`                   | `table.tsx`           | 표 이름, 좁은 폭 영역 안 가로 scroll, 숫자 `tabular-nums`                                                                   |
| `EmptyState`                              | `EmptyState.tsx`      | 빈 목록과 조건 결과 없음을 문장으로 구별                                                                                    |
| `StatusFilter`                            | `StatusFilter.tsx`    | URL query link 목록, 지금 항목 `aria-current`                                                                               |
| `Overlay`                                 | `Overlay.tsx`         | 오른쪽 drawer와 가운데 확인 창(native `dialog`, `showModal`), Escape·`닫기`, 연 단추로 focus 복귀                           |
| `TextLink`                                | `TextLink.tsx`        | `prefetch={false}`를 늘 붙인 글자 link                                                                                      |
| `TimeText`·`EmailText`·`RoleText`         | `text.tsx`            | 줄바꿈 자리(⑦)                                                                                                              |
| `Icon`                                    | `icons.tsx`           | 장식(`aria-hidden`), 뜻은 옆 글자가 전함                                                                                    |
| `AuthCard`                                | `AuthCard.tsx`        | 인증·없는 화면·오류의 카드 틀(main)                                                                                         |
| `Forbidden`                               | `Forbidden.tsx`       | console page의 403: page 제목은 남기고 본문은 빈 상태 모양 알림. 404와 구별                                                 |
| `BrandLogo`·`BrandMark`                   | `brand/BrandLogo.tsx` | ⑧                                                                                                                           |

- 승격 기준: 두 화면 이상이 의미·상호작용·상태 계약이 같은 부품을 쓰거나 이 표가 그 역할을 정했으면 `src/ui/`에 둡니다. 한 화면만
  쓰는 부품은 그 화면 디렉터리(`src/screens/<기능>/`)에 둡니다. 새 공통 부품은 이 표에 행을 더합니다.
- 주요 action은 page마다 하나(`PageHeader` actions)이고 primary입니다. 나머지는 secondary 또는 위험(danger)입니다.
- 결과는 action 가까이의 `Notice`입니다. 자동으로 사라지는 toast는 쓰지 않습니다. drawer·확인 창은 성공하면 닫고 결과를 page 머리
  아래에 보이며, 실패는 그 안에 두고 입력을 남깁니다. 상세의 결정 실패는 결정 영역 안입니다.
- 위험 확인(되돌릴 수 없거나 다른 사람의 접속을 끝내는 작업)은 가운데 확인 창(`alertdialog`)에 영향 문장·사유를 두고, 마지막 단추만
  `danger-solid`입니다. 재인증은 지금 흐름(passkey) 그대로입니다.
- 보조·위험 단추는 테두리 없는 면 채움입니다. 단추 글자는 동사형입니다(⑦).

## ⑦ 표기 규칙

- KST 시각([`format.ts`](./format.ts)): 목록·카드는 분까지(`2026-11-24 09:58`), 감사 표는 초까지(`2026-11-24 09:58:12`), 상세는 초 +
  `KST`(`2026-11-24 09:58:12 KST`)입니다. 표는 열 머리에 `(KST)`, 카드·목록 줄은 값 뒤에 `KST`를 둡니다. 날짜와 시각 사이에서만
  줄을 바꿉니다(`TimeText`).
- 빈 값은 `—`, 역할이 없으면 `없음`입니다.
- 단추는 동사형(`초대 code 만들기`, `점검 완료 기록`, `요청 취소`)이고, 같은 일은 화면마다 같은 낱말입니다.
- 숫자·시각·id는 `tabular-nums`입니다. id는 앞 8자리(`shortId`), 상세는 전체입니다.
- 한글 줄바꿈: 문서 전체(root layout `<body>`, Storybook preview)가 `break-keep wrap-break-word text-pretty`입니다. 역할은 이름과 code
  사이, 이메일은 `@`·`.` 앞, 시각은 날짜와 시각 사이에서만 줄을 바꿉니다(`RoleText`·`EmailText`·`TimeText`). 표 이름 칸은 띄어쓰기에서
  줄을 바꾸고 칸보다 긴 한 단어만 칸 안에서 끊습니다(`wrap-anywhere`, 말줄임 없음).
- 문구 원본: 정책 사실은 [`docs/policies/operator-access.md`](../../../../docs/policies/operator-access.md), 화면 문구는
  [`labels.ts`](./labels.ts)·[`error-messages.ts`](./error-messages.ts)와 component 상수입니다. 새 문구와 바뀐 문구는 Owner가 확인하고
  PR 본문에 전후를 적습니다.

## ⑧ 로고 사본

- [`brand/BrandLogo.tsx`](./brand/BrandLogo.tsx)는 사용자 Web 브랜드 로고의 백오피스 사본입니다(mark 그림
  `brand/art/logo-mark.png` + 세로 구분선 + `백오피스` 글자). 접힌 사이드바는 mark만 보이고 이름은 화면 읽기 글자로 둡니다.
- 색은 `logo-brand`·`logo-ink`·`shell-*` token이고 inline style이 없습니다. 사용자 Web 로고가 바뀌어도 자동으로 따라가지 않으며, 바꿀 때는
  이 사본을 같은 변경에서 고칩니다.

## ⑨ Storybook과 캡처

- 설정은 [`.storybook/`](../../.storybook)(`@storybook/nextjs-vite`, 이 앱의 `next.config.ts`, App Router mock)이고 story는
  `src/**/__stories__/*.stories.tsx`입니다. token 견본·공통 부품은 `src/ui/__stories__/`(`Foundations/Tokens`, `UI/Parts`), 화면
  story는 `src/screens/<기능>/__stories__/`에 둡니다.
- 화면은 그 route group과 같은 틀([`frames.tsx`](./__stories__/frames.tsx))에 그립니다. console story는
  `parameters.nextjs.navigation.pathname`에 경로를 두어 지금 menu 항목을 정하고, owner가 아닌 session은
  `parameters.consoleSession`에 둡니다. 좁은 폭 story는 `globals.viewport`(`mobile390`)를 둡니다.
- 화면 story는 대표 상태, 빈 상태, 오류(API 실패), 권한 없음, 긴 이름·많은 행, 그리고 상호작용 뒤 상태(drawer·확인 창 열림, 결과
  문단, 한 번 보는 값)를 둡니다. 상태 하나가 story 하나이고, 지금 export 이름은 같은 상태면 유지합니다.
- story는 tracked이고 fixture는 가짜 값만 씁니다(`@example.test` 주소, 고정 UUID, 형식만 맞춘 code. 공개 저장소).
  `src/ui/__stories__/fixtures.ts`가 공용 fixture이고, API 응답을 대신하는 fixture는
  [`story-fixtures.test.ts`](./story-fixtures.test.ts)가 BFF와 같은 공유 schema로 확인합니다. 짧은 id가 서로 달라야 하는 fixture는 앞
  8자리가 다른 UUID를 씁니다. story 파일은 상대 경로로 import합니다(`tsconfig.json` 밖이라 `@/` 경로가 story 파일에 적용되지
  않습니다).
- 상호작용 뒤에 열리는 단계는 운영자처럼 엽니다. story의 `beforeEach`가 [`bff-stub.ts`](./__stories__/bff-stub.ts)로 그 단계가 부르는
  BFF 경로에 fixture(실패는 `bffFailure(status, code)`)를 답하고, passkey 뒤 단계는
  [`passkey-stub.ts`](./__stories__/passkey-stub.ts)가 `navigator.credentials.create`에 가짜 credential을 답합니다. `play`가 입력·누름
  뒤 다음 단계가 보일 때까지 기다리고, `beforeEach`가 돌려준 함수가 story 끝에 되돌립니다.
- story 검사(`playwright.storybook.config.ts`, `e2e/storybook/`)는 static build의 모든 story를 Chromium으로 열어 `play`까지 끝난
  뒤 render 오류 0과 axe(`wcag2a`·`wcag2aa`·`wcag21a`·`wcag21aa`·`wcag22aa`) 위반 0을 봅니다. `play`의 단언 실패도 render 오류로
  잡습니다(`UI/Parts` `Drawer`·`Confirm`의 focus 복귀). 스크린샷 비교와 기준 이미지는 두지 않습니다. Backoffice Web gate가
  돌립니다.
- Owner 확인용 캡처와 비교 이미지는 `.artifacts/plans/<umbrella>/<plan>/<phase>/` 아래에만 두고 git에 올리지 않습니다. PR diff에
  image 파일이 더해지지 않습니다.

```sh
pnpm backoffice-web:prepare
pnpm --dir apps/backoffice-web ci:storybook          # 개발 server, http://localhost:6007
pnpm backoffice-web:storybook:build:prepared         # static build → apps/backoffice-web/storybook-static/
pnpm --dir apps/backoffice-web exec playwright install chromium
pnpm backoffice-web:storybook:check:prepared         # story 검사
```

## ⑩ 화면 완료 확인 목록

화면을 더하거나 바꾼 PR은 다음을 지나고 PR 본문에 적습니다.

1. token lint 위반 0(`pnpm backoffice-web:check`).
2. 대표·빈·오류·권한 없음·긴 이름 story가 있고 story 검사의 render 오류 0·axe 위반 0.
3. 1280·1024에서 page 가로 넘침 0과 표 영역 가로 scroll 0, 390에서 page 가로 넘침 0(표 영역 안 scroll만).
4. keyboard로 모든 action에 닿고 focus 윤곽선이 보이며, drawer·확인 창은 닫은 뒤 연 단추로 focus가 돌아옴.
5. 바뀐 화면은 WCAG 2.2 AA(lint + story axe + e2e axe 한 번).
6. 새 문구와 바뀐 문구의 전후를 PR 본문에 적고 Owner가 확인.
7. e2e·component test는 역할·이름 query(`getByRole`·`getByLabel`)로 찾습니다. 배치가 바뀌어 단계가 바뀌어도 단언의 뜻은 그대로
   두고, 지우거나 약하게 바꿔야 하면 PR을 열기 전에 Owner가 확인합니다.
