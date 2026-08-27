# Web main roommate tab

`apps/web/src/main/tabs/roommate-list`는 로그인 사용자가 `/main`의 룸메이트 찾기 탭에서 후보를 탐색하고, 정책에 따라 상세 비교·저장·신고·차단·매칭 요청 같은 후속 행동으로 이어지는 화면을 소유한다.
이 탭은 **검색/상세/행동 capability를 사용자에게 안전하게 표현하는 Web feature owner**이며, 최종 허용/거부 판단과 mutation 성공 여부는 각 API owner가 결정한다.

현재 RoommateTab은 legacy profile/social/matching props bridge 없이 `roommate-search` 응답과 owner BFF를 기준으로 동작한다. search summary, detail entry, compatibility visualization, bookmark/block/report/match request는 모두 RoommateTab 경계 안의 API client/hook/model/overlay를 통해 연결된다.

## 제품 책임

- `GET /api/roommate-search`와 embedded manifest를 기준으로 scope, 정렬, 필터, availability notice, cursor pagination을 렌더링한다.
- `detailEntryToken`이 포함된 정상 summary entry만 profile detail로 연결한다.
- `summary-only`, `detailViewable`, `scoreVisible`, `actions.canBookmark`, `actions.canRequestMatch`, `actions.canStartChat`를 사용자-facing card/modal state로 변환한다.
- bookmark, block, report, match request mutation을 owner BFF/API와 연결하고 성공/거부 후 list/detail 상태를 재조회로 수렴시킨다.
- loading, empty, error, stale refresh, tombstone, disabled action reason, duplicate submit 상태를 제품 UX로 처리한다.
- 모바일과 데스크톱에서 같은 정보 구조를 유지하되, filter sheet / detail dialog / action dialog의 chrome만 viewport에 맞게 바꾼다.
- Storybook에서 policy state matrix를 빠르게 검증할 수 있는 visual workshop을 제공한다.

## Non-owner boundary

RoommateTab은 아래 흐름을 직접 소유하지 않는다.

- HomeTab, MatchingTab, ChatTab, ProfileTab 전체 구조 변경
- 자기 프로필/생활패턴/학적정보/기숙사 선택 편집 flow
- MatchingTab의 요청 목록 관리, 수락/거절/취소/확정/해제 workflow
- ChatTab의 thread send UI, read state, stale send reason UX
- BackOffice moderation / support / report review workflow
- Redis/cache/materialized projection, RDS 성능 최적화, score cache 도입

RoommateTab의 CTA는 각 owner mutation을 호출하거나, 필요한 경우 다른 탭으로 handoff하는 얇은 entry point로 유지한다.

## Source of truth

| 주제                                   | Source of truth                                                                                                                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search summary / manifest              | `GET /api/roommate-search`, `GET /api/roommate-search/manifest`, `packages/shared/src/roommate-search/contract/index.ts`                                                                          |
| Search policy / scope / capability     | `docs/policies/roommate-searching.md`, `docs/policies/season-participation.md`                                                                                                                    |
| Profile detail                         | `GET /api/profiles/:userId?detailEntryToken=...`, `packages/shared/src/profile/contract/public.ts`, `apps/web/src/app/api/profiles/[userId]/route.ts`                                             |
| Compatibility payload / score exposure | `packages/shared/src/profile/contract/compatibility.ts`, `docs/policies/profile-model.md`, `docs/policies/matching-algorithm.md`                                                                  |
| Match request                          | `packages/shared/src/match/contract`, `apps/web/src/app/api/matches/requests/route.ts`, `docs/policies/matching-lifecycle.md`                                                                     |
| Bookmark / block / report              | `packages/shared/src/social-safety/*.ts`, `apps/web/src/app/api/bookmarks/**`, `apps/web/src/app/api/blocks/**`, `apps/web/src/app/api/reports/route.ts`, `docs/policies/incident-enforcement.md` |
| Public profile field exposure          | `docs/policies/profile-model.md`, `packages/shared/src/profile/contract/public.ts`                                                                                                                |
| Season state / registration capability | `docs/policies/season-lifecycle.md`, `docs/policies/season-participation.md`                                                                                                                      |

정책 문서와 RoommateTab copy/test가 충돌하면 정책 문서를 우선하고 RoommateTab README·copy·test를 함께 갱신한다.

## 정책 용어

- `summary-only`: list-summary exposure만 가능하고 detail/score가 닫힌 상태다. action capability와 동일 개념이 아니다.
- `action-closed`: 새 mutation CTA가 닫힌 상태다. `summary-only`, `result-read`, profile write lock과 같은 계층이 아니다.
- `result-read`: 이미 형성된 match/result/thread/history 맥락에서 읽는 상태다. 신규 후보 discovery와 구분한다.
- `tombstone`: 정상 entry context는 있으나 full detail을 더 이상 제공할 수 없을 때 retained payload를 복원하지 않고 minimal shell로 안내하는 상태다.
- `detailEntryToken`: 권한 부여 수단이 아니라 정상 summary entry context proof다. detail API는 token 검증 후에도 최신 정책을 다시 계산한다.
- `manifest`: UI 편의용 옵션 목록이 아니라 BE query validation의 공개 계약이다. stale query/manifest는 fail-closed 복구 UX로 이어져야 한다.

## Runtime boundary

RoommateTab runtime/import graph는 아래를 source-of-truth로 사용하지 않는다.

- `@/api/profile`, `profileApi.getProfiles`, production empty fallback
- `@/main/dev-only/fixtures`, `mockRawProfiles`, `mockDb`, local mock DB
- `calcMatchScoreWithGating` 기반 사용자-facing search score 계산
- `@/types/filter`, legacy `FilterState`, `DEFAULT_FILTERS`, fixed local filter option set
- local `bookmarkedUserIds` / `blockedUserIds` truth
- local `displayCount` / `slice()` 기반 pagination truth
- Main에서 전달하는 old list props bridge (`profiles`, `filters`, `bookmarkedUserIds`, `blockedUserIds`, `matchRequests`, `activeMatch`)

다른 탭 때문에 legacy file 자체가 repo 안에 남아 있어도, RoommateTab runtime graph에서는 다시 import하지 않는다.

## Directory responsibility

| File / directory       | Responsibility                                                               |
| ---------------------- | ---------------------------------------------------------------------------- |
| `RoommateListTab.tsx`  | hook wiring, top-level state, overlay composition을 담당하는 tab shell       |
| `api/`                 | owner BFF/API 호출과 shared schema parse                                     |
| `hooks/`               | search, bookmark, profile detail, action orchestration state                 |
| `model/search/`        | search query/state/view model/shell helper                                   |
| `model/filters/`       | manifest filter field 해석, sheet model, filter copy                         |
| `model/actions/`       | action unavailable reason, dialog helper, stale-safe copy                    |
| `model/compatibility/` | compatibility payload copy, chart mapper, privacy guard                      |
| `sections/`            | header, filter bar, controls, results, empty-state composition               |
| `components/`          | summary card, radar, axis list, search feedback/controls presentation        |
| `overlays/`            | filter sheet, detail dialog, match/block/report dialog, receipt dialog       |
| `__stories__/`         | story-only fetch fixture, scenario registry, Storybook composition           |
| `__tests__/`           | runtime boundary, shell behavior, story matrix, section/component regression |

## Search shell rules

- API 기본 scope는 정책 문서 기준 `CAMPUS_MERGED`이며, registration 완료 + `ASSIGNED` viewer는 `SAME_BUILDING_ONLY`를 먼저 요청할 수 있다.
- `SAME_BUILDING_ONLY`에서만 detail/score/action/filter를 열 수 있고, `CAMPUS_MERGED`는 summary browse 중심이다.
- `SEASON_OPEN`/`SEASON_MATCHING`의 미등록·selection-required viewer는 `SAME_BUILDING_ONLY` toggle을 열 수 있지만 등록 안내 gate/empty list만 제공한다.
- live `ActiveMatch` viewer의 `SAME_BUILDING_ONLY`는 summary list는 볼 수 있지만 신규 detail/action CTA는 닫힌다.
- 결과 list와 bookmark filter 결과는 cursor `더 보기`만 사용하며 local slicing truth를 만들지 않는다.
- search state decision(loading/error/closed/empty/bookmark-only empty)은 shell helper에서 계산하고, 표현은 `RoommateSearchStateSection`이 담당한다.

## Detail / compatibility rules

- detail action은 `detailEntryToken`이 있는 summary source만 연다.
- detail API는 `FULL`, `TOMBSTONE`, probing-safe error를 구분해 modal state로 렌더링한다.
- compatibility payload는 shared allowlist axis/score/bucket만 사용한다. raw lifestyle value, 상대 룸메 조건, matrix/debug key, 음주 raw field는 노출하지 않는다.
- `CompatibilityRadar`는 보조 시각화이고, 정보 전달의 기준은 text/list based axis UI다.
- detail modal action CTA는 `useRoommateActions`를 통해 owner mutation으로 handoff한다.

## Action / stale-state rules

- bookmark, block, report, match request는 owner BFF/API mutation 결과로만 성공/실패를 확정한다.
- duplicate submit은 target 단위 pending guard로 막는다.
- stale/domain rejection은 crash가 아니라 safe feedback + list/detail refresh로 처리한다.
- block/report success는 receipt dialog로 안내하고, final truth는 owner list/detail 재조회로 수렴한다.
- `useRoommateActions.ts`는 현재 dialog state, network command, receipt state를 함께 소유한다. presentation helper는 분리돼 있지만 source-of-truth orchestration은 hook에 남긴다.

## Storybook boundary

- story fixture는 `__stories__` 안에만 둔다. production runtime source는 story-only module을 import하지 않는다.
- `roommate-story-scenarios.ts`는 public entry shell이고, 실제 scenario authoring은 `fixtures/`와 `scenarios/` module이 담당한다.
- scenario key는 중복되면 안 되며, test가 duplicate key와 entry size를 guard한다.
- story title/description/docs에는 raw backend error code, token, retained payload, hidden/private field를 노출하지 않는다.

## Responsive / accessibility rule

- mobile에서는 single-column result feed + filter/detail/action sheet 구조를 유지한다.
- desktop에서는 result feed + sticky supporting pane 구조를 유지한다.
- filter sheet, profile detail dialog, block/report/match request dialog는 role/name, focus trap, close 후 focus restore를 유지해야 한다.
- keyboard와 pointer 모두에서 close/backdrop/submit behavior가 일관되어야 한다.
- compatibility visualization은 SVG만으로 정보를 전달하지 않고 text/list fallback을 함께 제공해야 한다.
- hidden/private field는 DOM, aria-label, tooltip, debug copy에 노출하지 않는다.

## Verification map

기본 boundary guard:

```bash
pnpm --dir apps/web exec vitest run \
  src/main/tabs/roommate-list/__tests__/roommate-runtime-boundary.test.ts
```

RoommateTab shell / section / hook regression:

```bash
pnpm --dir apps/web exec vitest run \
  src/main/tabs/roommate-list/__tests__/RoommateListTab.search-shell.test.tsx \
  src/main/tabs/roommate-list/hooks/__tests__/useRoommateSearch.test.tsx \
  src/main/tabs/roommate-list/hooks/__tests__/useRoommateActions.test.tsx \
  src/main/tabs/roommate-list/sections/results/__tests__/RoommateSearchResultsSection.test.tsx \
  src/main/tabs/roommate-list/sections/empty-states/__tests__/RoommateSearchStateSection.test.tsx
```

RoommateTab 전체 + 관련 BFF route regression:

```bash
pnpm --dir apps/web exec vitest run \
  src/main/tabs/roommate-list \
  src/app/api/__tests__/roommate-search-bff-routes.test.ts \
  src/app/api/__tests__/home-profile-detail-bff-routes.test.ts \
  src/app/api/__tests__/matches-bff-routes.test.ts \
  src/app/api/__tests__/social-safety-bff-routes.test.ts
```

Typecheck / lint / diff:

```bash
pnpm --dir apps/web exec tsc --noEmit --pretty false
pnpm web:lint
pnpm api:typecheck
git diff --check
```

Storybook 검증:

```bash
pnpm --dir apps/web exec vitest run \
  src/main/tabs/roommate-list/__tests__/roommate-story-scenarios.dom.test.ts
pnpm --dir apps/web typecheck:storybook
pnpm --dir apps/web storybook:build
```

## Handoff and follow-up boundary

- 이 README는 현재 RoommateTab의 production runtime boundary, owner dependency, 검증 기준을 설명한다.
- 계획 문서보다 현재 파일 구조와 테스트가 우선한다. 구조나 책임이 바뀌면 README와 관련 test를 함께 갱신한다.
- RoommateTab 범위에서 닫힌 항목은 legacy list bootstrap 제거, manifest-driven search/filter, detail token flow, compatibility allowlist, bookmark/block/report/match request owner handoff, storybook scenario matrix, final runtime boundary guard다.
- 후속 owner 범위는 ChatTab send UI, MatchingTab request inbox/accept/reject/cancel, BackOffice moderation/support workflow, 성능 최적화/캐시 전략이다.
