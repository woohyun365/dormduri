# Web main home tab

`apps/web/src/main/tabs/home`은 로그인 사용자가 `/main` 진입 후 처음 보는 Home dashboard 화면을 소유한다.
Home은 현재 사용자에게 “지금 할 수 있는 다음 행동”을 안내하는 read-model screen이며, 실제 권한 판단과 mutation 성공 여부는 API와 각 도메인 owner가 최종 결정한다.

## 제품 책임

- `HomeDashboardResponse`를 기준으로 현재 시즌, 내 시즌 참여 상태, 건물 선택 상태, 매칭 요약, 준비 체크리스트를 렌더링한다.
- `GET /api/home/dashboard` Web BFF를 통해 Home 전용 dashboard read model을 가져온다.
- `viewer.onboarding.dismissedNotices`와 `PATCH /api/users/me/onboarding`을 통해 `service-intro` 안내 닫힘 상태를 반영한다.
- 시즌 상태별로 다음 행동을 안내한다.
  - `OFF_SEASON`: 타인 탐색과 새 매칭 요청은 열지 않고 프로필 정비와 이전 기록 확인 중심으로 안내한다.
  - `SEASON_OPEN`: 생활패턴, 건물 선택, 시즌 등록 준비를 안내하되 매칭 요청은 열지 않는다.
  - `SEASON_MATCHING`: dashboard capability가 허용할 때 같은 건물 후보 탐색, 대화, 매칭 요청 진입을 안내한다.
  - `SEASON_POST_MATCH`: 새 요청 대신 확정 결과, 과거 기록, 허용된 대화 확인 중심으로 안내한다.
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

| 주제                          | Source                                                                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Home dashboard read model     | `packages/shared/src/home/dashboard.ts`, `apps/web/src/api/home.ts`, `apps/web/src/app/api/home/dashboard/route.ts`                           |
| Current-user onboarding state | `packages/shared/src/user/current-user.ts`, `apps/web/src/api/current-user.ts`, `apps/web/src/app/api/users/me/onboarding/route.ts`           |
| Home dashboard fetch state    | `apps/web/src/main/hooks/useMainHomeDashboard.ts`                                                                                             |
| Dashboard → Home view model   | `apps/web/src/main/tabs/home/model/homeDashboardViewModel.ts`                                                                                 |
| Home quick action policy      | `apps/web/src/main/tabs/home/model/homeActionPolicy.ts`                                                                                       |
| Season policy                 | `docs/04_policy/official/season-lifecycle.md`, `docs/04_policy/official/season-participation.md`                                              |
| Search/matching/chat policy   | `docs/04_policy/official/roommate-searching.md`, `docs/04_policy/official/matching-lifecycle.md`, `docs/04_policy/official/chat-lifecycle.md` |

정책 문서와 Home 문구가 충돌하면 정책 문서를 우선하고 Home copy/test를 갱신한다.

## Directory responsibility

| File / directory                                                          | Responsibility                                                         |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `HomeTab.tsx`                                                             | Home composition, dashboard view model 소비, section 조합, CTA routing |
| `HomeDashboardLayout.tsx`                                                 | mobile single-column / desktop two-column layout owner                 |
| `components/HomePrimaryStateCard.tsx`                                     | 시즌·참여 상태별 primary next action card                              |
| `components/HomeActivityPanel.tsx`, `components/HomeStatsPanel.tsx`       | dashboard summary and activity panels                                  |
| `components/HomeMatchingSummary.tsx`, `components/UrgentActionBanner.tsx` | matching/chat/request activity summary                                 |
| `components/HomeReadinessChecklist.tsx`                                   | current-user capability와 registration 상태 기반 readiness checklist   |
| `components/HomeOnboardingSheet.tsx`, `hooks/useHomeOnboardingNotice.ts`  | `service-intro` 안내 표시·닫기·영구 dismiss flow                       |
| `components/BuildingStatsBar.tsx`, `components/DynamicTipBanner.tsx`      | season stats and contextual guide widgets                              |
| `components/HomeQuickMenuSection.tsx`, `components/HomeStatusTip.tsx`     | owner tab navigation entry and static/dynamic guide copy               |
| `model/`                                                                  | pure policy/view-model helpers and tests                               |
| `../../test-support/home-dashboard.builder.ts`                            | Home/Main unit·component tests 전용 `HomeDashboardResponse` builder    |
| `__tests__/`                                                              | component, state matrix, browser API fallback regression               |

## Error and security rule

- Client는 `/api/home/dashboard` 실패를 zero/empty dashboard fallback으로 바꾸지 않는다.
- 사용자에게는 raw upstream body, stack, token, cookie, internal code를 노출하지 않고 safe copy와 `다시 시도` CTA를 보여준다.
- BFF route는 shared schema로 dashboard DTO를 strict parse하고, public contract 외 key가 섞이면 fail-closed한다.
- `PATCH /api/users/me/onboarding`은 allowlisted notice key만 forward한다.
- 안내 dismiss mutation이 성공하면 dashboard refetch가 실패해도 dismiss 실패로 표시하지 않는다. 다음 fetch/retry가 최신 상태 수렴을 담당한다.
- Browser API가 실패할 수 있는 동작은 사용자-facing fallback copy를 둔다. 현재 Home scope의 copy-link 동작은 `BuildingStatsBar`에서 안전 toast로 degrade한다.

## Test map

주요 회귀 테스트는 아래 책임을 잠근다.

- `src/main/hooks/__tests__/useMainHomeDashboard.test.tsx`
  - dashboard fetch success/error/retry state, status별 safe copy, previous success preservation.
- `src/api/__tests__/home-dashboard-bff.contract.test.ts`
  - `homeApi.getDashboard` no-store fetch, shared schema parse, upstream error fallback 금지.
- `src/app/api/home/dashboard/route.test.ts`
  - BFF auth forward, schema guard, non-json/malformed JSON safe error, internal key fail-closed.
- `src/app/api/users/me/onboarding/route.test.ts`, `src/api/__tests__/current-user.test.ts`
  - onboarding dismiss request/response schema guard and safe error boundary.
- `src/main/tabs/home/model/*.test.ts`
  - dashboard view model and quick action policy matrix.
- `src/main/tabs/home/__tests__/*.test.tsx`
  - state cards, layout, readiness checklist, onboarding sheet, browser API fallback.
- `src/main/__tests__/Main.direct-action.test.tsx`
  - Main shell에서 Home dashboard loading/error/success와 direct action wiring.
- `apps/web/e2e/smoke.spec.ts`
  - Web-only Playwright protected route boundary: unauthenticated `/main` 접근은 `/login`으로 fail-closed.

## Playwright / browser smoke boundary

`apps/web/playwright.config.ts`는 Web-only standalone smoke를 위해 invalid local `API_URL`을 사용한다.
로그인된 `/main` dashboard는 `apps/web/playwright.fullstack.config.ts`에서 API server, local Postgres, DB seed, Web dev server를 함께 띄우는 full-stack lane으로 검증한다.

따라서 Home browser evidence는 다음처럼 분리한다.

- Web-only Playwright: public routes와 unauthenticated protected-route redirect를 검증한다.
- Home logged-in behavior: Vitest component/hook/BFF route tests로 빠르게 고정한다. 테스트 데이터는 `apps/web/src/main/test-support/home-dashboard.builder.ts`의 typed builder를 사용하고, runtime code는 `@/__fixtures__`를 직접 참조하지 않는다.
- API-backed `/main` mobile/desktop smoke: `home-e2e-viewer@kangwon.ac.kr` seed 계정으로 current season, active match, pending request, unread chat, non-operated campus fail-closed matrix를 검증한다.

## Handoff and follow-up boundary

- #197의 Home dashboard API-first 전환 범위는 Home tab 기준으로 완료 후보지만, 다른 main tab의 mock/API 전환이 남아 있으면 이슈 전체 close 여부는 별도 판단한다.
- #221의 `service-intro` Home onboarding persistence는 Home scope에서 완료 후보다.
- #244의 Home stale/error/security hardening은 Home scope에서 완료 후보다.
- #243 RoommateList stale scope/filter UX, #245 Chat/Matching stale action reason UX, #108 broader timer/browser matrix는 Home Phase 8의 미완료 violation이 아니라 후속 범위다.
- Safari/Firefox matrix, strict visual diff, BE mutation semantics 검증은 Web-only Home tab 마감 범위 밖이다. 로그인 사용자 full-stack Playwright는 별도 manual/scheduled lane으로 제공한다.

## Runtime fixture boundary

- `/main` production runtime path는 `@/__fixtures__`를 direct/dynamic import하지 않는다.
- `apps/web/src/__fixtures__` 아래 mock DB/matching service는 local development panel 또는 legacy unit test support 용도로만 남긴다.
- Home dashboard unit/component tests는 global fixture data가 아니라 `main/test-support`의 typed builder로 shared contract shape만 만든다.
- 실제 로그인 사용자 기준 browser/manual 검증은 DB seed 계정과 API server를 사용하는 full-stack smoke에서 다룬다.
- `src/main/tabs/home/__tests__/home-runtime-boundary.test.ts`는 production Home source에 global fixture,
  test-support, story import가 섞이지 않는지 고정한다.
