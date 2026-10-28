# Landing

`apps/web/src/screens/landing`은 미인증 사용자가 처음 보는 공개 랜딩(`/` route)의 화면, 문구, 정책 고지 배치, 최소 상호작용을
소유합니다. route 파일(`src/app/page.tsx`)은 공개 entry `index.ts`의 `LandingScreen`만 렌더링합니다. 화면 계층 공통 규칙(구조,
import, lint, token)은 [새 화면 계층 README](../README.md)를 따릅니다.

## 제품 책임

- 서비스 가치 제안과 가입·로그인 행동을 제공합니다.
- 학교 공식 서비스가 아닌 독립 운영 서비스라는 사실을 첫 화면과 footer에서 알립니다.
- 학교 시스템 미연동, 기숙사 배정·호실 선택 미보장, 생활패턴 설문 면책, 개인정보 공개 주의, 신고·문의 위치를 알아두세요 목록에서
  알립니다.
- 시즌이 학기마다 열리는 기간이고 후보 보기·대화·매칭 신청이 시즌 중에만 열린다는 점을 설명합니다. 지금 시즌 상태는 보이지 않고
  시즌 API를 부르지 않습니다.
- 랜딩은 이용 권한을 판단하지 않습니다. 기능 허용·거부는 API와 도메인 정책이 판단합니다.

## 페이지 순서

`LandingScreen`이 아래 순서로 조합합니다. 섹션은 `components/sections/`에 하나씩 있습니다.

1. `Header`: 로고(홈 `/` 링크. 이 페이지에서 누르면 새로고침 없이 맨 위로), 로그인, 시작하기(가입의 헤더 줄임말)
2. `HeroSection`(`#hero`): 제목, 본문, 질문 상자, 가입 행동과 그 결과 문장, 첫 화면 고지 두 줄
3. `BeforeSection`(`#before`): 무엇이 다른가요. 커뮤니티 게시판 글과 서비스 화면을 겹친 두 창
4. `ItemsSection`(`#items`): 생활패턴 항목과 나·상대 카드 겹쳐 보기
5. `StepSection`(`#search`·`#chat`·`#match`): 01 찾기 · 02 대화 · 03 매칭과 휴대폰 캡처 자리
6. `SeasonSection`(`#season`): 시즌 설명, 한 해 위 시즌 등록 기간, 시즌 기능 고지
7. `NoticesSection`(`#notices`): 알아두세요 다섯 줄
8. `FaqSection`(`#faq`): 자주 묻는 질문
9. `ClosingSection`: 마지막 제목과 가입 행동
10. `Footer`(`#landing-footer`): 서비스·약관과 정책·서비스 외부 문의, 독립 운영 고지

## Source of truth

| 주제                                              | Source                                                                                                          |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 서비스 책임, 비공식 서비스 고지, 호실 선택 미보장 | `docs/policies/service-boundary.md`                                                                             |
| 공개 안내와 개인 문의 경계                        | `docs/policies/support-communication.md`                                                                        |
| 시즌 상태와 기능 허용·제한                        | `docs/policies/season-lifecycle.md`                                                                             |
| 접근 자격과 학교 이메일 인증                      | `docs/policies/access-eligibility.md`                                                                           |
| 프로필 탐색·매칭·대화 정책                        | `docs/policies/roommate-searching.md`, `docs/policies/matching-lifecycle.md`, `docs/policies/chat-lifecycle.md` |
| 개인정보·보관 안내                                | `docs/policies/data-retention.md`                                                                               |

화면 문구가 공식 정책과 충돌하면 정책 문서를 우선하고 랜딩 문구를 고칩니다.

## 디렉터리 책임

| 위치                   | 책임                                                                           |
| ---------------------- | ------------------------------------------------------------------------------ |
| `index.ts`             | 공개 entry. 기능 밖은 이 파일만 import합니다                                   |
| `LandingScreen.tsx`    | 페이지 조합과 palette 판(어두운 판 기본)                                       |
| `components/sections/` | 섹션 하나씩                                                                    |
| `components/`          | 섹션이 쓰는 부품, 페이지 frame(`LandingFrame`), hook, 그림(`art/`)             |
| `model/`               | 문구(`landingCopy`), 고지 원본(`landingPolicyCopy`)과 배치, 예시 답. 순수 data |
| `__stories__/`         | Storybook `Landing/Page` · `Sections` · `Components`                           |
| `__tests__/`           | 페이지 조합·고지 위치·행동 링크 검사                                           |

## 고지 규칙

- `model/landingPolicyCopy.ts`가 고지 일곱 개의 문장, 정책 원본(`docs/policies/*.md`), 보일 영역(`requiredSurface`)을 소유합니다.
  `scripts/ci/contracts/policy-source-links.test.mjs`가 원본 경로가 있는지 확인합니다.
- 면책 고지 넷(`service_independent_notice`·`school_system_not_connected`·`room_selection_not_guaranteed`·
  `lifestyle_survey_disclaimer`)은 법적 책임 문구라 글자를 바꾸지 않습니다. 서비스 이름이 바뀌면 주어 이름만 바꾸고 Owner가
  전후 대조를 확인합니다. 그 밖의 글자를 바꿔야 하면 전문가 검토를 먼저 받습니다.
- 나머지 셋은 뜻을 지키는 범위에서 다듬을 수 있습니다. 바꾸는 절차는 아래 "고지·사실 문구를 바꿀 때"입니다.
- 보일 영역은 `LANDING_SURFACE_SECTION_IDS`의 element id(`hero`·`notices`·`season`·`landing-footer`)이고, 섹션이 같은 상수로 id를
  답니다. `__tests__/LandingScreen.test.tsx`가 고지마다 그 영역에 문장이 있는지 확인합니다.
- 390×844 첫 화면에는 "학교 공식 서비스가 아닙니다"와 "기숙사 배정·호실 선택을 보장하지 않습니다"가 보입니다.

## 콘텐츠 규칙

- 화면 문구와 접근성 이름은 `model/landingCopy.ts`에 둡니다. component에 글자를 직접 쓰지 않습니다. 같은 행동은 화면 어디서나 한
  이름입니다(가입: "학교 이메일로 시작하기"). 헤더만 320·360px 폭 때문에 "시작하기"를 씁니다(Owner 예외).
- 예시 화면과 예시 답(`model/demoData.ts`, 게시판 글 `examplePost`)은 예시라고 표시하고 실제 사용자 정보·점수·결과를 쓰지
  않습니다.
- FAQ는 정적 문구입니다. 고객센터 FAQ API는 support 화면이 소유하고 랜딩은 부르지 않습니다.
- 서비스 외부 문의 주소는 링크가 아닌 글로 둡니다.
- 학교 마스코트·이름·상징색을 쓰지 않고, 가짜 숫자(이용자 수, 성공률)를 쓰지 않습니다.

## 고지·사실 문구를 바꿀 때

1. 문구 주인과 규칙 출처를 확인합니다. 고지는 `model/landingPolicyCopy.ts`, 그 밖 문구는 `model/landingCopy.ts`입니다. 규칙이 정책
   문서(위 Source of truth)에서 오는지 다른 결정에서 오는지 적습니다.
2. 글자를 고정한 면책 넷과 표현을 다듬을 수 있는 문장을 가릅니다.
3. 바꿀 문장마다 전·후 문장, 뜻이 같은지, 정책 문서의 근거 줄을 대조표로 보이고 Owner 확인을 받습니다. Owner가 낸 문장도 같은
   표를 거칩니다.
4. 문구, `testAnchor`, 같은 문장을 확인하는 test·e2e를 함께 바꿉니다.

- 제품 사실(기능, 기간, 대상)과 FAQ 답은 정책 문서의 줄과 실제 화면 용어에 맞춥니다. 날짜·기간은 정책 표뿐 아니라 설계 근거와
  seed까지 확인합니다. 근거가 없는 질문은 넣지 않습니다.
- 랜딩은 API를 부르지 않으므로 "지금 열린 시즌"처럼 실시간 상태를 말하지 않습니다.
- 섹션별로 문구를 고친 뒤에는 화면 글 전체를 순서대로 읽어 같은 질문의 다른 답, 용어·표기 어긋남, 요약 반복을 찾습니다.

## 렌더링·상호작용·접근성

- 기본은 server render입니다. client 부분은 상호작용이나 browser API가 필요한 가장 작은 단위입니다: `LandingFrame`(스크롤 등장),
  `HeroAsk`(질문 넘김과 이동), `BeforeStack`(겹친 창 앞뒤 전환), `StatementFields`(카드 끌어 겹치기).
- 움직임은 motion 줄이기에서 멈추거나 바로 끝납니다. 첫 화면 질문 넘김은 멈춤 버튼이 있습니다(WCAG 2.2.2).
- 글자 대비 4.5:1(큰 글자 3:1), 터치 타깃, `focus-visible:focus-ring`은 [Foundations](../../styles/tokens/README.md) token을 씁니다.
  임의 값(`-[…]`)과 raw 색은 lint error입니다.
- 질문 상자와 단계 이동은 섹션 id로 갑니다. 이동 대상 섹션은 id를 `landingSectionIds` 하나에서 받고, 질문 상자는 그 섹션으로
  focus도 옮깁니다(WCAG 2.4.3). `__tests__/LandingScreen.test.tsx`가 질문마다 대상 섹션이 있는지와 focus 이동을 확인합니다.

## SEO

- `/` route의 title, description, canonical, Open Graph, Twitter metadata는 `src/app/metadata.ts`가 관리합니다.
- `robots.ts`와 `sitemap.ts`는 공개 정적 route와 private·API route 경계를 구분합니다.

## 검증

test가 글자로 고정하는 문구는 정책 고지뿐입니다. 그 밖 문구와 접근성 이름은 `model/landingCopy.ts`(서비스 이름은 `@/screens/ui/brand`의 `brandName`)에서 import하고, 그럴 수 없는
e2e는 랜드마크·링크 목적지·고지 문장으로 찾습니다. 섹션 순서와 DOM 구조도 고정하지 않습니다. 고지 밖 문구 하나를 바꿔도 test가
깨지지 않아야 합니다.

| 검사                                                       | 위치                                                                                |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 조합·고지 위치·링크·예시 표식                              | `__tests__/LandingScreen.test.tsx`, `model/landingPolicyCopy.test.ts`               |
| 예시 답과 공유 schema                                      | `model/comparePairs.test.ts`                                                        |
| Storybook 렌더·axe                                         | `pnpm --dir apps/web ci:storybook:build && pnpm --dir apps/web ci:storybook:visual` |
| route·화면 import 경계                                     | `apps/web/src/app/__tests__/public-landing-route.test.ts`                           |
| 실제 `/`: 첫 화면 고지·주 행동 크기·focus·가로 넘침·목적지 | `apps/web/e2e/landing.spec.ts`(`pnpm web:e2e`)                                      |
