# Web main home tab

`apps/web/src/main/tabs/home`은 로그인 사용자가 `/main` 진입 후 처음 보는 Home dashboard 화면을 소유한다.
Home은 현재 사용자에게 “지금 할 수 있는 다음 행동”을 안내하는 read-model screen이며, 실제 권한 판단과 mutation 성공 여부는 API와 각 도메인 owner가 최종 결정한다.
현재 Home/Auth handoff boundary의 핵심은 `/login`, `/signup`, `/password-reset` 이후 `/main` 첫 렌더링이 legacy profile mock/bootstrap을 기다리지 않고 Home dashboard read model만으로 안전하게 시작되도록 고정하는 것이다.

## 제품 책임

- `HomeDashboardResponse`를 기준으로 현재 시즌, 내 시즌 참여 상태, 건물 선택 상태, 매칭 요약, 준비 체크리스트를 렌더링한다.
- `GET /api/home/dashboard` Web BFF를 통해 Home 전용 dashboard read model을 가져온다.
- Home production path는 `SeasonContext`, `seasonFallback`, `homeDevOverrides`를 import하지 않는다. 시즌 상태와 D-day는 `HomeDashboardResponse.season`만 source-of-truth로 삼는다.
- Web client의 `homeDashboardApi` public surface는 `getDashboard()` 하나로 고정한다. `getBuildingStats`, `getPastSeasonResult`, `getPastSeasons` 같은 legacy widget/mock method는 Home 완료 범위로 복원하지 않는다.
- Home first render는 `profileApi.getMyProfile()`이나 global fixture/mock DB를 요구하지 않는다.
- 계정 표시 identity와 시즌 프로필 준비 상태는 Home dashboard/current-user contract의 allowlist DTO에서 분리해 소비한다.
- 체크리스트, 매칭 안내, operations surface가 Home 안내 역할을 대체하므로 `service-intro` onboarding sheet와 Home-local dismissed client는 제거한다. 계정 단위 dismissed notice API는 account/user contract에 남지만 Home 기본 렌더링 source는 아니다.
- 시즌 상태별로 다음 행동을 안내한다.
  - `OFF_SEASON`: 타인 탐색과 새 매칭 요청은 열지 않고 다음 시즌 일정, 이전 기록, 내 정보 확인 중심으로 안내한다.
  - `SEASON_OPEN`: 생활패턴, 건물 선택, 시즌 등록 준비를 안내하되 매칭 요청은 열지 않는다.
  - `SEASON_MATCHING`: dashboard capability가 허용할 때 같은 건물 후보 탐색, 대화, 매칭 요청 진입을 안내한다.
  - `SEASON_POST_MATCH`: 새 요청 대신 확정 결과, 과거 기록, 허용된 대화 확인 중심으로 안내한다.
- 모바일 Home content order는 `notice → primary → readiness → activity → quickActions → assistance`로 고정한다.
  데스크톱에서는 공지사항을 dashboard grid 상단 full-width banner로 분리하고, 주요 행동(`primary`, `activity`, `quickActions`)과 보조 정보(`readiness`, `assistance`)를 2-column으로 배치한다.
- 비운영 캠퍼스에서는 Home content를 inert/aria-hidden 처리하고 계정 정보 확인 정도의 대기 UX만 제공한다.
- Home 진입만으로 건물 선택 modal을 자동으로 열지 않는다. 건물 선택은 명시 CTA를 통해서만 시작한다.

## Non-owner boundary

Home은 아래 흐름을 직접 소유하지 않는다.

- RoommateList 후보 검색, 필터, 북마크, 프로필 상세 mutation.
- Matching 요청 생성/수락/거절/취소/확정/해제 mutation.
- Chat thread 생성, 메시지 전송, 읽음 처리, stale action reason UX.
- Profile tab 내부의 생활패턴/표시정보/학적정보 편집 flow.
- API capability의 최종 허용/거부 판단과 transaction semantics.

Home CTA는 각 owner tab으로 이동하거나 해당 owner가 제공한 callback을 호출하는 얇은 entry point로 유지한다.

## Source of truth

| 주제                                 | Source                                                                                                                                                                                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home dashboard read model            | `packages/shared/src/home/dashboard.ts`, `apps/web/src/main/api/home-dashboard.api.ts` (`getDashboard()` only), `apps/web/src/app/api/home/dashboard/route.ts`                                                               |
| Account dismissed notice contract    | `packages/shared/src/user/current-user.ts`, `apps/web/src/app/api/users/me/onboarding/route.ts`                                                                                                                              |
| Home profile/detail modal read model | `packages/shared/src/season/participation/profile-draft.ts`, `packages/shared/src/profile/contract/public.ts`, `packages/shared/src/match/contract/history.ts`, `apps/web/src/main/tabs/home/api/home-profile-detail.api.ts` |
| Home dashboard fetch state           | `apps/web/src/main/hooks/useMainHomeDashboard.ts`                                                                                                                                                                            |
| Dashboard → Home view model          | `apps/web/src/main/tabs/home/model/homeDashboardViewModel.ts`                                                                                                                                                                |
| Home quick action policy             | `apps/web/src/main/tabs/home/model/homeActionPolicy.ts`                                                                                                                                                                      |
| Season policy                        | `docs/04_policy/official/season-lifecycle.md`, `docs/04_policy/official/season-participation.md`                                                                                                                             |
| Search/matching/chat policy          | `docs/04_policy/official/roommate-searching.md`, `docs/04_policy/official/matching-lifecycle.md`, `docs/04_policy/official/chat-lifecycle.md`                                                                                |

정책 문서와 Home 문구가 충돌하면 정책 문서를 우선하고 Home copy/test를 갱신한다.

## Directory responsibility

| File / directory                                                  | Responsibility                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HomeTab.tsx`                                                     | Home dashboard view model 소비, section 조합, CTA routing. Header/avatar/non-operated overlay 세부 JSX는 layout owner에 위임한다.                                                                                                                          |
| `layout/HomeDashboardLayout.tsx`                                  | notice full-width slot, mobile single-column / desktop two-column layout frame owner                                                                                                                                                                       |
| `layout/HomeDashboardErrorState.tsx`                              | Home dashboard API/BFF failure safe retry state                                                                                                                                                                                                            |
| `layout/HomeHeader.tsx`                                           | viewer identity header/avatar/chip/D-day presentation owner                                                                                                                                                                                                |
| `layout/HomeSectionGrid.tsx`                                      | notice → primary/readiness/activity/quickActions/assistance order와 desktop right rail section grid owner                                                                                                                                                  |
| `layout/HomeNonOperatedOverlay.tsx`                               | non-operated campus inert overlay owner. Header/bottom navigation을 덮지 않는 대기 UX만 담당한다.                                                                                                                                                          |
| `overlays/`                                                       | Home-local responsive dialog/sheet/header/action bar primitives. Focus trap, body scroll lock, safe-area footer, mobile bottom sheet/desktop dialog chrome를 공통 소유                                                                                     |
| `sections/primary/`                                               | 시즌 상태별 primary card strategy, pure primary content builder, progress/date/task/policy hint/withdrawal sheet primitive                                                                                                                                 |
| `sections/activity/`                                              | 시즌 상태별 activity section, current/past season content builder, metric primitive, profile/activity modal dialog boundary. Dialog chrome/trigger owner이며 직접 network I/O를 수행하지 않는다.                                                           |
| `profile-modals/`                                                 | 시즌 프로필/상대 프로필 detail presenter와 Home-local profile detail hooks. Hook은 Home-local API client만 호출하고 section/dialog component에 raw fetch를 노출하지 않는다.                                                                                |
| `api/home-profile-detail.api.ts`                                  | current season profile, match history, public/counterpart profile BFF client. shared schema로 response를 재검증하고 section component 직접 fetch를 대체한다.                                                                                               |
| `sections/matching/`                                              | registered matching summary, active match card, counterpart profile trigger, unmatch request/cancel dialog, matching metric/action primitives. Section component는 직접 network I/O를 수행하지 않는다.                                                     |
| `api/home-active-match.api.ts`                                    | active match unmatch request/cancel BFF client. `HomeTab`은 성공 후 dashboard refresh만 소유한다.                                                                                                                                                          |
| `hooks/useHomeOperations.ts`                                      | global notice, personal notification, support ticket/FAQ를 Home core dashboard와 독립적으로 progressive fetch한다. feed별 partial failure와 detail/reply action을 section-local state로 수렴한다.                                                          |
| `sections/operations/`                                            | 공지사항 top banner, 개인 알림함 CTA/preview, 문의하기·문의내역 ticket detail sheet/message composer를 소유한다. 단일 ‘운영 센터’ 카드로 묶지 않고 surface별 IA를 분리한다. 직접 `fetch`하지 않고 `useHomeOperations`와 Home overlay primitive만 사용한다. |
| `api/home-operations.api.ts`                                      | global notice, personal notification, support FAQ/ticket BFF client. shared schema로 response를 재검증하고 raw body/stack을 사용자-facing error로 노출하지 않는다.                                                                                         |
| `model/operations/homeOperationsViewModel.ts`                     | 공지사항/알림/문의 preview view-model assembler. notice body와 support message body를 Home preview에 섞지 않고 mapper 결과만 조합한다.                                                                                                                     |
| `model/operations/{notice,notification,support}Preview.mapper.ts` | operations feed별 preview projection owner. global notice는 summary-only, personal notification은 pointer-only, support ticket은 timeline/body 제외 preview만 반환한다.                                                                                    |
| `sections/readiness/`                                             | season schedule/readiness/post-match guide sections. current-user capability와 registration 상태 기반 checklist 및 registered matching guide를 소유한다.                                                                                                   |
| `sections/quick-actions/`                                         | owner tab navigation entry와 target-tab responsibility handoff. Home에서는 단순 CTA만 제공하고 tab별 blocked 책임을 갖지 않는다.                                                                                                                           |
| `model/`                                                          | pure policy/view-model helpers and tests                                                                                                                                                                                                                   |
| `../../test-support/home-dashboard.builder.ts`                    | Home/Main unit·component tests 및 Storybook story data 전용 `HomeDashboardResponse` builder                                                                                                                                                                |
| `__stories__/`                                                    | HomeTab visual state workshop 전용 story surface                                                                                                                                                                                                           |
| `__tests__/`                                                      | component, state matrix, browser API fallback regression                                                                                                                                                                                                   |

## Operations API boundary

- Global notice는 개인 알림함의 `SEASON_SYSTEM_NOTICE` filter가 아니라 `GET /api/notices*` read path를 사용한다.
- `GlobalNotice` list response는 Home preview용 `title/summary/severity/publishedAt`만 반환하고, `body`는 detail route에서만 조회한다.
- Personal notification은 pointer-only payload로 유지한다. support ticket 본문은 notification payload나 Home preview에 넣지 않고 support ticket detail API에서 본인 권한으로 다시 조회한다.
- Home operations client는 Web BFF 응답을 shared schema로 재검증한다. section component는 직접 `fetch`하지 않는다.
- Operations API 실패는 Home core dashboard render와 독립적인 feed-local empty/error surface로 수렴시킨다. 전체 operations feed가 실패해도 primary/readiness/activity/quick action render를 막지 않는다.
- 공지사항은 Home content 최상단 banner로만 노출한다. 공지가 없거나 notice feed가 로딩/실패 중이면 Home을 밀지 않도록 top banner를 렌더링하지 않는다.
- 알림함과 문의하기는 보조 `assistance` slot에서 각각 독립 card로 노출한다. support ticket 답변 알림은 알림함 preview에서 ticket detail sheet로 handoff한다.
- `useHomeOperations`는 list feed를 병렬로 불러오고, 공지 본문과 support message timeline은 사용자가 detail sheet를 열 때만 조회한다.
- `sections/operations`는 preview/detail 표시와 CTA를 소유하지만 직접 network/browser I/O를 수행하지 않는다.

## Error and security rule

- Client는 `/api/home/dashboard` 실패를 zero/empty dashboard fallback으로 바꾸지 않는다.
- 사용자에게는 raw upstream body, stack, token, cookie, internal code를 노출하지 않고 safe copy와 `다시 시도` CTA를 보여준다.
- BFF route는 shared schema로 dashboard DTO를 strict parse하고, public contract 외 key가 섞이면 fail-closed한다.
- `PATCH /api/users/me/onboarding`은 account/user dismissed notice compatibility route로 남지만 HomeTab 기본 render path와 Home-local client에서는 더 이상 호출하지 않는다.
- Browser/API가 실패할 수 있는 동작은 사용자-facing fallback copy를 둔다. 현재 Home operations surface는 공지사항 전용 API가 없으면 fake rows를 만들지 않고 empty fallback을 렌더링한다.

## Test map

주요 회귀 테스트는 아래 책임을 잠근다.

- `src/main/hooks/__tests__/useMainHomeDashboard.test.tsx`
  - dashboard fetch success/error/retry state, status별 safe copy, previous success preservation.
- `src/main/api/__tests__/home-dashboard.api.test.ts`
  - `homeDashboardApi.getDashboard` no-store fetch, shared schema parse, upstream error fallback 금지, legacy widget/mock method 복원 금지.
- `src/app/api/home/dashboard/route.test.ts`
  - BFF auth forward, schema guard, non-json/malformed JSON safe error, internal key fail-closed.
- `src/app/api/__tests__/home-profile-detail-bff-routes.test.ts`, `src/main/tabs/home/api/__tests__/home-profile-detail.api.test.ts`, `src/main/tabs/home/model/profile/__tests__/homeProfileDisplay.mapper.test.ts`
  - Home profile/detail BFF auth forward, strict schema guard, `PublicProfile` FULL/TOMBSTONE handling, current season profile display mapper allowlist.
- `src/app/api/users/me/onboarding/route.test.ts`
  - account/user dismissed notice compatibility request/response schema guard. Home-local onboarding client는 Phase 8에서 제거했다.
- `src/main/tabs/home/model/*.test.ts`
  - dashboard view model and quick action policy matrix.
- `src/main/tabs/home/__tests__/*.test.tsx`
  - state cards, layout/header/grid, readiness checklist, registered matching guide, notice/notification/support surface, browser API fallback.
- `src/main/tabs/home/__tests__/home-runtime-boundary.test.ts`, `src/main/tabs/home/__tests__/home-componentization-baseline.test.ts`
  - Home runtime source의 legacy fixture/root API/story/test-support import 금지, section component 직접 browser/network I/O 금지, 삭제된 compatibility facade 재도입 방지, overlay/layout entry point 유지를 고정한다.
- `src/main/__tests__/Main.direct-action.test.tsx`
  - Main shell에서 Home dashboard loading/error/success와 direct action wiring.
- `apps/web/e2e/smoke.spec.ts`
  - Web-only Playwright protected route boundary: unauthenticated `/main` 접근은 `/login`으로 fail-closed.

## Storybook visual workshop boundary

HomeTab의 여러 시즌·매칭 상태를 빠르게 눈으로 비교할 때는 `apps/web/src/main/tabs/home/__stories__` 아래 Storybook story를 사용한다.
Storybook은 로그인 세션, DB seed, API server를 대체하지 않는 **visual state workshop**이다.

- 실행: `pnpm --dir apps/web storybook`
- 정적 빌드 검증: `pnpm --dir apps/web storybook:build`
- 현재 story matrix는 비시즌, 현재 시즌 없음 + 지난 기록/다음 시즌 preview, 현재 시즌 없음 + 기록 없음, 시즌 오픈 준비/등록 완료/철회/등록 불가 reason, 시즌 매칭 registration 전 준비 4종(profile+dormitory/profile/dormitory/registration-ready), registered 기본/진행률/압축 S-R-C 2종/매칭 해제 후/active match 해제 요청 matrix, 시즌 마감 정리 기간 7종(not registered/final de-registered/matched/unmatched/not matched/user history/registration unavailable cutoff), notice/notification/support operations state 4종, profile fallback state, 비운영 캠퍼스, 로딩 skeleton, 오류 복구 상태를 포함한다.
- story data는 `main/test-support` typed builder를 재사용할 수 있지만, production runtime source가 `__stories__`, `main/test-support`, `main/dev-only/fixtures`를 import하면 안 된다.
- `storybook:build`는 visual workshop surface가 빌드 가능한지 확인할 뿐, API/BFF/auth/DB 정합성 완료 근거가 아니다.

## Playwright / browser smoke boundary

`apps/web/playwright.config.ts`는 Web-only standalone smoke를 위해 invalid local `API_URL`을 사용한다.
로그인된 `/main` dashboard는 `apps/web/playwright.fullstack.config.ts`에서 API server, local Postgres, DB seed, Web dev server를 함께 띄우는 full-stack lane으로 검증한다.

따라서 Home browser evidence는 다음처럼 분리한다.

- Web-only Playwright: public routes와 unauthenticated protected-route redirect를 검증한다.
- Home logged-in behavior: Vitest component/hook/BFF route tests로 빠르게 고정한다. 테스트 데이터는 `apps/web/src/main/test-support/home-dashboard.builder.ts`의 typed builder를 사용하고, Home runtime code는 `@/main/dev-only/fixtures`를 직접 참조하지 않는다.
- API-backed `/main` mobile/desktop smoke: `home-e2e-viewer@kangwon.ac.kr` seed 계정으로 current season, active match, pending request, unread chat, non-operated campus fail-closed matrix를 검증한다.

Home/Auth handoff final-readiness full-stack matrix는 아래 명령으로 실행한다.

```bash
pnpm --dir apps/web e2e:fullstack -- main-home.fullstack.spec.ts
```

이 spec은 실제 로그인 UI smoke 1개를 유지하되, mode/account matrix 검증은 테스트 전용 `AuthSession`을 DB에 직접 seed해 로그인 rate-limit 검증과 분리한다.
Seed mode 전환은 `apps/web/e2e/support/home-e2e-seed.ts`가 소유하고, spec 종료 시 `current-matching`으로 복원한다.
Playwright helper는 API seed script를 직접 실행해 테스트 중 `@repo/shared` build output을 지우지 않도록 한다.

## Full-stack seed matrix

Home full-stack smoke의 DB source는 `apps/api/prisma/seed-data/fixtures/home-dashboard-e2e-fixtures.js`와 `auth-fixture-users.js`가 소유한다.
기본 seed는 `HOME_E2E_SEED_MODE=current-matching`이며, `home-e2e-viewer@kangwon.ac.kr`로 로그인하면 현재 시즌 매칭 상태, 확정 매칭, 받은 요청, unread chat, 2026-01 지난 시즌 요약을 함께 확인할 수 있다.

개발/수동 검증용 계정의 비밀번호는 공통으로 `1q2w3e4r`이다.

| 계정                                | 검증 목적                                                             |
| ----------------------------------- | --------------------------------------------------------------------- |
| `home-e2e-viewer@kangwon.ac.kr`     | 기본 `/main` Home smoke: active match, pending received, unread chat  |
| `home-e2e-history@kangwon.ac.kr`    | 지난 시즌 등록 이력은 있으나 성공 매칭은 없는 viewer boolean 분기     |
| `home-e2e-open@kangwon.ac.kr`       | `HOME_E2E_SEED_MODE=season-open` 전환 시 시즌 오픈 상태 수동 검증     |
| `home-e2e-postmatch@kangwon.ac.kr`  | `HOME_E2E_SEED_MODE=post-match` 전환 시 시즌 마감 정리 상태 수동 검증 |
| `home-e2e-incomplete@kangwon.ac.kr` | registration/profile/building 준비 미완료 reason 수동 검증 후보       |
| `test-samcheok-m@kangwon.ac.kr`     | 비운영 캠퍼스 fail-closed Home UX                                     |

운영 기숙사 seed matrix는 `dasan`, `yeji`, `saerom`, `irum`, `daon`마다 10명 이상의 `SeasonParticipant`와 프로필을 만든다.
`HOME_E2E_SEED_MODE=future-preview`는 같은 `2026-02` 시즌 row를 future schedule로 전환해 “현재 시즌 없음 + 다음 시즌 preview” 상태를 재현한다.
Prisma `Season`의 unique key가 `(campusCode, academicYear, semester)`이므로 future preview와 current mode는 같은 DB 상태에서 동시에 유지하지 않는다.

수동으로 특정 mode를 확인할 때는 아래처럼 local DB URL을 지정해 seed를 다시 넣을 수 있다.

```bash
HOME_E2E_SEED_MODE=future-preview \
DATABASE_URL='postgresql://knu_dev:knu_dev_password@localhost:5432/knu_roommate?schema=public' \
DIRECT_URL='postgresql://knu_dev:knu_dev_password@localhost:5432/knu_roommate?schema=public' \
pnpm --dir apps/api prisma:seed:run
```

수동 seed 후에는 다른 smoke와 로컬 개발 상태를 위해 `HOME_E2E_SEED_MODE=current-matching`으로 복원한다.

## Handoff and follow-up boundary

- #197의 Home dashboard API-first 전환 범위는 Home tab 기준으로 완료 후보지만, 다른 main tab의 mock/API 전환이 남아 있으면 이슈 전체 close 여부는 별도 판단한다.
- #221의 `service-intro` Home onboarding persistence는 API/hook/component compatibility surface로만 남아 있으며, 기본 HomeTab 렌더링과 Storybook visual matrix에서는 제외했다.
- #244의 Home stale/error/security hardening은 Home scope에서 완료 후보다.
- #243 RoommateList stale scope/filter UX, #245 Chat/Matching stale action reason UX, #108 broader timer/browser matrix는 Home final pass의 미완료 violation이 아니라 후속 범위다.
- Safari/Firefox matrix, strict visual diff, BE mutation semantics 검증은 Web-only Home tab 마감 범위 밖이다. 로그인 사용자 full-stack Playwright는 manual/scheduled 또는 final-readiness lane으로 제공한다.

## Runtime fixture boundary

- `/main` Home first render path와 Home API client는 `@/main/dev-only/fixtures`를 direct/dynamic import하지 않는다.
- `/main` Home first render path는 `profileApi.getMyProfile()` failure/null을 Home render blocker로 삼지 않는다.
- root `apps/web/src/__fixtures__`는 제거됐고, mock DB/matching service는 `apps/web/src/main/dev-only/fixtures` local development/test-support boundary로 이동했다. Home API client는 이 mock surface를 import하지 않는다.
- `SeasonState`는 `@repo/shared/season/runtime`을 직접 import하며, Web-local season compatibility re-export는 사용하지 않는다.
- Home dashboard unit/component tests는 global fixture data가 아니라 `main/test-support`의 typed builder로 shared contract shape만 만든다.
- 실제 로그인 사용자 기준 browser/manual 검증은 DB seed 계정과 API server를 사용하는 full-stack smoke에서 다룬다.
- `src/main/tabs/home/__tests__/home-runtime-boundary.test.ts`는 production Home source에 global fixture,
  test-support, story, root legacy API, raw SeasonContext, FE-local season fallback, dev override import가 섞이지 않는지 고정한다.
- Home section components는 직접 `fetch`, `XMLHttpRequest`, `navigator.sendBeacon`을 호출하지 않는다. API/BFF 호출은 `main/api`, Home-local `api/`, 또는 hook owner가 소유한다.
- `src/main/tabs/home/__tests__/home-componentization-baseline.test.ts`는 componentization 중에도 section/layout/overlay owner entry point를 유지하고, 삭제된 import-only compatibility facade가 재도입되지 않도록 고정한다.

## Matching activity contract

- Home dashboard contract는 `pendingSentCount`, `pendingReceivedCount`, `activeChatThreadCount`, `unreadMessageCount`를 분리해서 제공한다.
  HomeTab의 매칭 활동 섹션은 S/R/C Storybook matrix에서 `S=보낸 요청`, `R=받은 요청`, `C=활성 채팅방` 조합을 이 contract 기반으로 검증한다.
