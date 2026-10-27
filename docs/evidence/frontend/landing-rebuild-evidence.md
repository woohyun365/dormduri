# Landing rebuild evidence

> **Audience:** 사람 대상 portfolio·onboarding·engineering discussion. 규칙의 owner가 아닙니다. 랜딩의 요구는
> [Landing PRD](../../product/landing.md), 화면 규칙은 [Landing 화면 README](../../../apps/web/src/screens/landing/README.md), 시각 값은
> [시각 값 token](../../../apps/web/src/styles/tokens/README.md), 결정은 [FE 결정 기록](../../architecture/decisions/fe.md)이 소유합니다.

공개 랜딩(`/`)을 새 화면 계층(`apps/web/src/screens/landing`)에서 Owner 판정으로 다시 만들고 옛 랜딩(`apps/web/src/landing`)을
지운 작업의 기록입니다. 전 측정은 `origin/dev` `d4d9a6d9`(2026-10-26)이고, 후 측정은 이 작업 PR head와 화면 source가 같은
상태에서 쟀습니다(2026-10-27, `apps/web/src` tree `f0c10d46`, `apps/web/public` tree `846ff898`). 같은지는
`git rev-parse HEAD:apps/web/src`로 대조합니다.

## 1. 문제와 관측

- 옛 랜딩은 정보상 이유가 없는 반복 장치를 썼다. eyebrow 5개, icon 항목 10개, 색이 다른 icon 바탕 6개(5색), 번호 단계 3개, 줄을 code로
  나눈 3줄 제목이다. Tailwind 기본 팔레트 utility 64회, 임의 값 24회, `knu.css` 변수 축약 103회로 값이 화면마다 흩어져 있었다.
  Owner는 화면을 보고 "AI-slop 느낌이 너무 많이 난다"고 답했다.
- 390×844 첫 화면에 13px 미만 글자가 31개 있었다.
- 디자인 기반(token·raw 값 lint·Storybook 검사)은 있었지만 그것을 쓰는 화면이 없었다. 같은 token과 문구로 구성만 다르게 만든 후보
  두 개는 Owner가 고르지 않았다.

## 2. 측정 방법과 재현 명령

| 신호                        | 방법                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 반복 장치·raw 값            | 랜딩 디렉터리의 test·story를 뺀 `*.ts`·`*.tsx`에서 `rg -o`로 센다. 기본 팔레트 `\b[a-z-]+-(slate\|gray\|…\|rose)-(50\|[1-9]00\|950)\b`(고전 22색), 임의 값 `\b[a-z-]+-\[[^\] ]+\]`, 변수 축약 `\b[a-z-]+-\(--[a-z-]+\)`, `knu` 변수 `--knu-[a-z-]+`, `eyebrow: '`, content의 `icon:` 항목, `iconSurfaceClass: '`. 뒤 셋은 옛 content field 이름이라 새 화면은 렌더된 화면에서 다시 센다(섹션 제목 바로 위 14px 이하 굵은 label, 생활패턴 카드의 icon 방울) |
| token 규모                  | `git show <rev>:apps/web/src/styles/tokens/tokens.generated.css`의 줄 수와 고유 `--이름:` 수, `[data-palette=…]` 선택자, `--font-*` 변수                                                                                                                                                                                                                                                                                                                   |
| LCP·CLS                     | production standalone(`pnpm --dir apps/web run ci:build`, `ci:standalone:prepare`, `node .next/standalone/apps/web/server.js`)에 Playwright Chromium Desktop Chrome·Pixel 5 descriptor로 빈 cache context를 5회씩 열어 중앙값. LCP는 buffered `largest-contentful-paint` 마지막 entry의 `startTime`, CLS는 `hadRecentInput`이 아닌 `layout-shift`의 session window(간격 1초 미만, 창 5초 이하) 최대 합                                                     |
| 작은 글자·가로 넘침·제목 줄 | 같은 서버에서 [token README 검증 폭](../../../apps/web/src/styles/tokens/README.md#breakpoint와-reflow) 9개(320·390·767·768·834·1023·1024·1280·1440)와 짧은 휴대폰 높이 셋(360×640·375×667·320×568), motion 줄이기·켜기(켜기는 끝까지 scroll하며 다시 잼). 13px 미만 글자 요소 수, `scrollWidth − clientWidth`, 제목 줄 수, 첫 화면 고지 두 줄이 스크롤 없이 다 보이는지. 전 측정은 폭 7개(767·834 없음)였다                                               |
| 그림 위 글자 대비           | 같은 서버, motion 줄이기. 첫 화면·마지막 그림 section의 글자를 투명하게 한 viewport 캡처에서 글자 상자 안 가장 밝은 pixel로 최악 대비를 잰다(axe는 그림 위 글자를 판정하지 못한다). 링크·버튼 안 글자(token 면)와 sticky header에 가린 상자는 뺀다. section이 viewport보다 길면 위·아래 두 위치에서 잰다                                                                                                                                                   |
| 회귀 방지                   | `pnpm check`, `pnpm test:repo-policy`, `pnpm --dir apps/web e2e`, `pnpm --dir apps/web ci:storybook:build`·`ci:storybook:visual`                                                                                                                                                                                                                                                                                                                           |
| test의 문구 의존            | 고지 밖 문구 3곳(제목 끝, 한 섹션 제목 끝, FAQ 질문 하나)을 바꾸고 web vitest·build·e2e를 실행한 뒤 되돌린다. 양성 대조로 고지 한 문장의 고정 구절을 지우고 vitest가 실패하는지 본다                                                                                                                                                                                                                                                                       |

측정 script는 추적하지 않습니다. 위 정의로 다시 만들 수 있습니다.

## 3. baseline

`origin/dev` `d4d9a6d9`:

- 옛 랜딩 추적 40파일(test 10개). 반복 장치·raw 값은 1절 수치다.
- token: 라이트 한 벌, 생성 CSS 100줄, 고유 변수 74개(색 25개), 글꼴 변수 둘(`--font-body`·`--font-display`), palette 선택자 없음.
- LCP 중앙값 Desktop 44ms·Pixel 5 44ms(LCP 요소는 글자), CLS 0·0.
- 13px 미만 글자 30~31개(폭별), 가로 넘침 0.

## 4. 원인

- 반복 장치: 옛 랜딩은 content 배열의 항목마다 icon·바탕색·번호 field를 두고 같은 card 부품으로 그렸다. 섹션이 늘수록 같은 모양이
  반복됐다.
- raw 값: 옛 랜딩은 token 계층보다 먼저 만든 코드라 기본 팔레트와 `knu.css` 변수를 직접 썼다. raw 값 lint는 새 화면 계층에만 걸린다.
- 후보 둘이 고르지 못한 이유: 두 후보가 같은 token·문구·부품을 써 구성만 달랐다. Owner는 요청문과 레퍼런스에서 다시 시작하는
  탐색을 정했다.

## 5. 대안과 기각

| 대안                                                                    | 판단                                                                                                                                                                            |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 후보 둘 가운데 하나를 고르기                                            | 기각(Owner). 요청문 기반 탐색으로 다시 만든다                                                                                                                                   |
| 요청문의 계층 순서(Foundations 먼저)                                    | 기각(Owner). 레퍼런스 하나를 골격으로 레이아웃을 먼저 정하고 token은 뒤에 고른 화면에 맞춰 줄였다                                                                               |
| 옛 `src/landing` 자리에서 고치기                                        | 기각. 새 화면의 root는 `src/screens`다([새 화면 계층](../../../apps/web/src/screens/README.md))                                                                                 |
| token 기본 값을 옛 한 벌로 두고 고른 값만 더하기                        | 기각(Owner). 기본 값이 아무 화면도 쓰지 않는 값으로 남는다                                                                                                                      |
| 시각 측정 3개를 gate로 두기                                             | 기각(Owner). 측정은 evidence로 기록하고 시각 품질은 Owner가 판정한다([`fe.ds.anti-slop-review`](../../architecture/decisions/fe.md#fedsanti-slop-review))                       |
| test가 화면 문구를 글자로 고정                                          | 기각. 고정하는 문구는 정책 고지뿐이고 그 밖 문구는 content 상수에서 import한다                                                                                                  |
| 탐색 branch를 그대로 push해 PR을 만들기                                 | 기각(Owner). 공개 저장소에 탐색 history(지운 레퍼런스 모사 코드와 사진)가 남는다. 최신 통합 기준에서 새 branch를 만들고 최종 tree만 foundation·랜딩·문서 commit으로 나눠 옮겼다 |
| workflow 문서(`docs/development/agent-workflows/**`)를 이 작업이 고치기 | 기각. 다른 작업 lane이 소유한다. 이 작업은 owner README에 규칙을 두고 아래 "남은 workflow 반영 후보"로 넘긴다                                                                   |

## 6. 개선별 전후 측정

| 개선                | 전 → 후                                                                                                                                                                                                                                                                                                                                                                             | 확인                                                                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 반복 장치·raw 값    | 기본 팔레트 64 → 0, 임의 값 24 → 0, 변수 축약 103 → 0, `knu` 변수 103 → 0. 옛 field 이름 기준 eyebrow 5 → 1, icon 항목 10 → 0, icon 바탕 6 → 0이지만 이 pattern은 새 화면의 같은 장치를 세지 못한다. 렌더 기준 새 화면은 섹션 제목 위 label 3개(무엇이 다른가요·시즌·알아두세요)와 생활패턴 카드 icon 방울 24개(모양 3가지, Owner가 고른 장치)를 그린다. lucide icon 이름은 24 → 33 | 새 화면 계층 raw 값 lint error. 장치 수는 측정 기록                                                                                                |
| 화면 교체           | 옛 랜딩 40파일(test 10개) 삭제, 새 화면 64파일(test 3파일 25 case, story 파일 20개)                                                                                                                                                                                                                                                                                                 | Web Playwright 36 passed, Storybook 렌더·axe 80 passed(Linux 스크린샷 8개는 macOS에서 skip), repository policy 1631/1631, `pnpm check` 통과        |
| token 재구성        | 라이트 한 벌·고유 변수 74개·글꼴 둘 → 라이트 기본과 nestable 다크 문맥·고유 변수 69개·글꼴 하나. 생성 CSS 100 → 143줄(다크 문맥 선언)                                                                                                                                                                                                                                               | token drift test, 대비 test                                                                                                                        |
| 작은 글자·가로 넘침 | 13px 미만 글자 30~31 → 0, 가로 넘침 0 → 0(전 폭 7개, 후 폭 9개와 짧은 높이 셋, motion 두 설정)                                                                                                                                                                                                                                                                                      | 같은 측정                                                                                                                                          |
| 그림 위 글자 대비   | 전: 그림 없음 → 후: 모든 폭·높이에서 기준 통과. 첫 화면 최악 5.23:1(390×844 가입 결과 문장, 기준 4.5), 마지막 그림 제목은 기준 3:1의 3.8배 이상                                                                                                                                                                                                                                     | 같은 측정. 첫 화면 기본 scrim 30%는 이 측정이 고른 값이다                                                                                          |
| LCP·CLS             | LCP Desktop 44 → 64ms, Pixel 5 44 → 56ms. CLS Desktop 0 → 0.0026, Pixel 5 0 → 0                                                                                                                                                                                                                                                                                                     | LCP 요소가 글자에서 첫 화면 그림(`IMG`)으로 바뀌었고, 그림을 eager·high priority로 받는다. 두 값 모두 web.dev 좋음 기준(LCP 2.5초, CLS 0.1) 안이다 |
| test의 문구 의존    | 고지 밖 문구 3곳을 바꿔도 web vitest 217/217, build, e2e 28/28 통과. 고지 고정 구절을 지우면 vitest 2개 실패                                                                                                                                                                                                                                                                        | 바꾼 파일을 되돌린 뒤 sha256 대조                                                                                                                  |

제목 줄 수(heading text node의 줄 수): 767px 이상은 모든 제목이 2줄 이하이고, 320·390px에서 h1이 3줄, 섹션 제목 하나가 4줄이다.
320px에서는 섹션 제목 하나가 더 3줄이다.
높이 ÷ 줄 높이 공식은 grid가 늘린 한 줄 제목을 7줄로 세어 gate로 쓰지 않았다.

첫 화면 고지: 390×844·375×667과 767px 이상 폭에서는 고지 두 줄과 가입 행동이 스크롤 없이 보인다. 360×640에서는 두 번째 고지(호실
미보장)가, 320×568에서는 두 고지가 첫 화면 아래로 내려간다(가입 행동은 보인다). 첫 화면 고지의 기준은 390×844다.

## 7. 한계와 재측정 조건

- 생산성·작업 시간 비교군이 없다. 위 수치는 품질 신호(반복 장치·raw 값 수, 회귀 test, 삭제 규모)다.
- LCP·CLS는 한 Apple M3 장비에서 network·CPU throttle 없이 잰 local 값이다. 절댓값은 실제 환경과 다르고 전후 차이만 같은 조건이다.
  첫 화면 그림이 LCP 요소가 된 뒤의 실제 망 LCP는 배포 환경에서 다시 잰다. 같은 날 Owner 피드백 반영 전 화면(첫 화면 그림·글자는
  같다)에서 잰 후 값은 Desktop 84ms·Pixel 5 88ms였다.
- 전 측정의 제목 줄 수는 높이 ÷ 줄 높이 공식만 있어 후 측정(text node 줄 수)과 직접 비교하지 않는다.
- 짧은 휴대폰(360×640 이하)에서는 첫 화면 고지가 다 들어가지 않는다. 그 높이를 기준에 넣을지는 Owner Human Feedback에서 정한다.
- 옛 랜딩의 반복 장치 수는 옛 field 이름으로만 셌다. 렌더 기준 전 측정이 없어 장치 수는 후 화면의 기록으로만 쓴다.
- Linux 기준 스크린샷은 OrbStack amd64 Ubuntu 24.04 container에서 만들었다. GitHub runner의 첫 비교는 PR CI에서 확인한다.
- 시각 품질 판정은 한 Owner의 Human Feedback이다. merge 전 두 번째 확인을 받는다.
- 레퍼런스 골격 방식, 회차 루프, 질문 설계는 한 작업의 근거다. Auth·Legal·Main을 새 계층으로 만들 때 다시 확인한다.

## 8. interview map

- "디자인 탐색을 어떻게 제품 코드로 이었나": 시안 코드를 처음부터 제품 계층에 두고 lint를 지켰다. 승격은 route 연결·옛 화면 삭제·test
  이식이었다.
- "AI-slop을 어떻게 다뤘나": raw 값은 세어서 0으로 만들고, 반복 장치는 Owner가 고른 것만 남겼다. 미감은 Owner 판정과 독립 비평으로
  나눴다. 측정이 맞는 화면을 막는 경우(늘어난 제목)를 찾아 gate에서 뺐다.
- "test가 디자인 변경을 막지 않게 하려면": 정책 고지만 글자로 고정하고 나머지는 content 상수를 import한다. 문구를 바꿔 통과하고 고지를
  지워 실패하는 것으로 확인했다.
- "공개 저장소에 탐색 history를 어떻게 다뤘나": 탐색 branch를 push하지 않고 최종 tree만 새 branch로 옮겼다.

## 남은 workflow 반영 후보

이 작업에서 owner README로 옮기지 않은 방식입니다. workflow 문서를 소유한 작업이 판정합니다.

| 묶음      | 후보                                                                                                                                            | 넘길 곳                                                                                          |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 레퍼런스  | 레퍼런스 하나를 골격으로 쓰는 방식, aspect map 칸(layout 먼저, 정책 차이·되살릴 조건), 외부 사이트 수집 점검, Figma 호출 예산, 이미지 자산 출처 | `visual-design/reference-content-contract.md`, `figma-mcp-evidence.md`, `visual-brief.md`        |
| 회차 루프 | 회차 기록 단위, 질문 설계(최대 3개, 미리보기 안), 작업 중 추가 요청, 범위 지키기, 고른 뒤 바로 삭제, 규칙 예외 기록                             | `design-task-orchestration.md`, `owner-lead-collaboration.md`, `design-review-and-acceptance.md` |
| 검증      | 탐색 중 test 범위, probe 양성·음성 대조, 캡처 조건(767·768·높이 축), 원인 먼저, 접근 경로 함께 정하기                                           | `plan-authoring/frontend.md`, `device-presentation-and-verification.md`, review-criteria         |
| Branch    | 탐색 branch는 push하지 않고 최신 통합 기준의 새 branch에 최종 tree만 나눠 commit                                                                | `design-task-orchestration.md`, `github/branch-and-pr-strategy.md`                               |
| 낡은 문장 | 검증 폭(767·태블릿 세로·높이 축 없음), "plan이 component tree를 명시"(시각 탐색 예외), aspect 동일 무게·골격 방식 없음                          | `visual-brief.md`, `plan-authoring/frontend.md`, `reference-content-contract.md`                 |
