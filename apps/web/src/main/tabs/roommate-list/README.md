# Web main RoommateTab

`apps/web/src/main/tabs/roommate-list`는 로그인 사용자가 `/main`의 룸메이트 찾기 탭에서 후보 summary list를 탐색하고, 정상 search entry에서 detail/action으로 이어지는 UX를 소유한다.
RoommateTab은 정책과 API contract를 화면에 반영하는 Web feature owner이며, 최종 권한 판단과 mutation 성공 여부는 BE owner API가 결정한다.

현재 Phase 5 상태에서 `/main` list tab은 legacy profile/social/matching props bridge를 받지 않고, `useRoommateSearch` 기반 summary shell과 `useRoommateBookmarkList` 기반 관심 목록 mode를 분리해 BFF/client 결과를 렌더링한다. Manifest filter sheet와 bookmark list/action은 제품 경로로 연결됐고, profile detail/tombstone 및 match/chat/block/report mutation 연결은 후속 Phase 범위다.

이 repo에는 현재 활성 `DESIGN.md`가 없다. `docs/00_archive/01_development/DESIGN.md`와 `docs/03_planning/**`의 과거 설계 문서는 참고 자료이고, RoommateTab feature boundary의 현재 설계 source는 `.omx/plans/web-main-roommate-tab-refactor-plan.md`와 이 README다.

## 제품 책임

- `roommate-search` summary list response를 기준으로 후보 카드, scope, sort, filter, pagination, availability notice를 렌더링한다.
- 정상 search entry가 제공한 `detailEntryToken`을 통해 profile detail BFF/API로 진입한다.
- bookmark, block, report, match request CTA는 각 owner API의 `actions`/response/error reason을 사용자-facing copy로 안전하게 변환한다.
- loading, empty, error, stale query, tombstone, disabled action reason, duplicate submit 상태를 제품 UX로 다룬다.
- 모바일과 데스크톱에서 같은 정보 구조를 유지하되 filter sheet, detail dialog, action dialog의 interaction chrome만 viewport에 맞춘다.
- FE gating은 UX hint이며, 최종 허용/거부 판단은 BE/API/shared contract를 따른다.

## Non-owner boundary

RoommateTab은 아래 흐름을 직접 소유하지 않는다.

- HomeTab, MatchingTab, ChatTab, ProfileTab의 전체 구조 변경.
- Profile tab의 자기 프로필/생활패턴/기숙사 선택 편집 flow.
- MatchingTab의 요청 목록 관리, 수락/거절/취소/확정/해제 workflow.
- ChatTab의 thread send UI, read state, stale send reason UX.
- BackOffice moderation decision workflow.
- Redis/Valkey/cache/materialized projection, RDS 성능 최적화, score cache 도입.
- MUI/Recharts 같은 chart dependency 도입. 기본 적합도 시각화는 repo-native accessible SVG + text fallback을 우선한다.

## Source of truth

| 주제                           | Source of truth                                                                                                                                       |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search summary list            | `GET /api/roommate-search`, `GET /api/roommate-search/manifest`, `packages/shared/src/roommate-search/contract/index.ts`                              |
| Search policy/copy terms       | `docs/04_policy/official/roommate-searching.md`                                                                                                       |
| Season/search capability       | `docs/04_policy/official/season-participation.md`, roommate-search response `scopeAvailability`, item `exposure`/`actions`                            |
| Profile detail                 | `GET /api/profiles/:userId?detailEntryToken=...`, `packages/shared/src/profile/contract/public.ts`, `apps/web/src/app/api/profiles/[userId]/route.ts` |
| Profile compatibility contract | `packages/shared/src/profile/contract/compatibility.ts`, `apps/api/src/matches/scoring/**`, `apps/api/src/profiles/**`                                |
| Bookmark list/action           | `packages/shared/src/social-safety/bookmark.ts`, `apps/web/src/app/api/bookmarks/**`                                                                  |
| Block list/action              | `packages/shared/src/social-safety/block.ts`, `apps/web/src/app/api/blocks/**`                                                                        |
| Report action                  | `packages/shared/src/social-safety/report.ts`, `apps/web/src/app/api/reports/route.ts`                                                                |
| Match request action           | `apps/api/src/matches/matches.controller.ts`, Phase 8에서 추가할 `apps/web/src/app/api/matches/requests/**` BFF                                       |
| Public profile field exposure  | `docs/04_policy/official/profile-model.md`, `packages/shared/src/profile/contract/public.ts`                                                          |
| Incident/safety copy           | `docs/04_policy/official/incident-enforcement.md`, social-safety shared contracts                                                                     |

정책 문서와 RoommateTab copy/test가 충돌하면 정책 문서를 우선하고 RoommateTab README/copy/test를 갱신한다. 정책 의미 자체를 바꿔야 할 때는 해당 정책 문서의 변경 이력도 함께 갱신한다.

## 정책 용어

- `summary-only`: list-summary exposure만 가능하고 detail/score가 닫힌 상태다. Action capability와는 별도 축이지만 summary-only target은 대부분 match/chat action도 닫힌다.
- `actionable`: BE owner가 현재 viewer, target, season, safety, cutoff 상태에서 해당 CTA 또는 mutation을 열 수 있다고 판단한 상태다. Client local 조건은 UX hint일 뿐 source of truth가 아니다.
- `result-read`: 이미 형성된 match/result/thread/history context 때문에 public target/profile item에서 detail/score를 읽는 맥락이다. 신규 후보 discovery나 모든 read 가능성을 뜻하지 않는다.
- `tombstone`: 정상 entry context는 있으나 target 삭제/비식별화/숨김/정책 변경 등으로 full detail을 제공할 수 없을 때 retained payload를 복원하지 않고 minimal 안내 shell로 degrade하는 상태다.
- `detailEntryToken`: 권한 부여 수단이 아니라 해당 viewer가 해당 season/search summary entry를 정상적으로 받았음을 증명하는 context proof다. Detail API는 token 검증 후에도 최신 public target policy를 다시 계산한다.
- `manifest`: UI 편의용 option 목록이 아니라 BE query validation의 공개 계약이다. Search response embedded manifest가 authoritative이며, stale manifest/query는 fail-closed 복구 UX로 이어져야 한다.
- `stale state`: BE owner contract가 이미 존재하거나 이번 plan에서 추가되는데도 FE가 mock/local/client-only state를 truth처럼 유지하는 상태다.

## Runtime fixture / legacy boundary

RoommateTab production runtime/import graph는 아래를 source of truth로 사용하지 않는다.

- `@/api/profile`, `profileApi.getProfiles`, production empty fallback.
- `@/main/dev-only/fixtures`, `mockRawProfiles`, `mockDb`, local mock DB.
- `calcMatchScoreWithGating` 기반 사용자-facing search score 계산.
- legacy `FilterState`, `DEFAULT_FILTERS`, fixed local filter option set.
- local `bookmarkedUserIds` / `blockedUserIds` `Set` truth.
- list-tab local `displayCount` / `slice()` 기반 pagination truth.
- Main에서 전달하는 old list props bridge: `profiles`, `filters`, `bookmarkedUserIds`, `blockedUserIds`, `matchRequests`, `activeMatch`.

다른 탭 때문에 legacy file 자체가 남아야 하는 경우에도 RoommateTab runtime/import graph에서는 제거한다. Phase 중간에 임시 compatibility bridge를 만들면 같은 Phase 완료 전 삭제하거나, 늦어도 Phase 10 final guard의 삭제 조건으로 명시한다.

## Target boundary summary

최종 구조에서 Main은 tab routing과 current viewer shell만 전달한다. 권장 props는 아래처럼 최소화한다.

```ts
interface RoommateListTabProps {
  user: UserProfile;
  onNavigate: (tab: TabId) => void;
  searchEntryAllowed?: boolean;
}
```

`user`는 current viewer shell의 현재 prop name이다. `searchEntryAllowed`는 `canEnterRoommateSearch` coarse capability를 UI shell에 전달해 request 전 no-browse 상태를 닫기 위한 boolean이며, detail/action 가능 여부를 뜻하지 않는다. 후속 Phase에서 `currentUser`로 rename할 수 있지만, Phase 3의 완료 조건은 old list props bridge 제거와 `useRoommateSearch` source 전환이다.

RoommateTab 내부는 최종적으로 `api/`, `model/`, `hooks/`, `sections/`, `overlays/`, `components/`, `__tests__/`, `__stories__/`로 분리한다. BFF/client, query state, manifest mapper, detail/action state는 RoommateTab feature boundary 안에서 소유한다.

## Phase 4 layout / state split

Phase 4에서 `RoommateListTab.tsx`는 tab-level shell과 hook composition만 담당한다. UI state와 card capability 판단은 아래 파일로 분리한다.

| 파일                                                   | 책임                                                                                                                   |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `model/search/roommateSearchViewModel.ts`              | search item `exposure`/`actions`/`resultRead`/`bookmark`/`matchScore`/`detailEntryToken`을 card view model로 변환한다. |
| `sections/header/RoommateSearchHeader.tsx`             | title, status message, availability notice container를 렌더링한다.                                                     |
| `sections/scope-switcher/RoommateSearchControls.tsx`   | scope/sort controls와 filter disabled policy copy를 렌더링한다.                                                        |
| `sections/empty-states/RoommateSearchStateSection.tsx` | closed/loading/error/empty state를 role/status/alert 기준으로 렌더링한다.                                              |
| `sections/results/RoommateSearchResultsSection.tsx`    | result list semantic과 cursor 기반 `더 보기` button을 렌더링한다.                                                      |
| `components/RoommateSummaryCard.tsx`                   | card view model만 받아 summary facts, score badge, result-read/action/bookmark state copy를 표시한다.                  |

Card는 shared summary를 직접 다시 해석하지 않는다. `detailEntryToken`은 view model에 보존하지만 DOM에는 렌더링하지 않으며, detail modal과 mutation CTA는 Phase 6~8에서 owner API와 함께 연결한다.

## Phase 5 manifest filter / bookmark owner mode

Phase 5에서 상세 필터와 관심 목록은 legacy local state가 아니라 owner contract를 기준으로 동작한다.

| 파일                                                    | 책임                                                                                                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `model/filters/roommateFilterSheetModel.ts`             | search manifest와 current query에서 filter sheet field/draft/active chip/submit payload를 만든다. disabled field는 submit하지 않는다. |
| `sections/filters/RoommateSearchFilterBar.tsx`          | 현재 scope에서 filter sheet를 열 수 있는지와 active chip/remove/reset UI를 표시한다.                                                  |
| `overlays/RoommateFilterSheet.tsx`                      | `BaseBottomSheet` 기반 manifest field editor다. legacy `BottomSheet`/`FilterState`/`DEFAULT_FILTERS`를 사용하지 않는다.               |
| `api/roommateActions.client.ts`                         | `/api/bookmarks` list 및 `/api/bookmarks/:targetUserId` POST/DELETE를 shared bookmark schema로 parse한다.                             |
| `hooks/useRoommateBookmarkList.ts`                      | bookmark owner list status/sort/cursor/empty/pending/optimistic rollback state를 소유한다.                                            |
| `sections/bookmarks/RoommateBookmarkResultsSection.tsx` | bookmark list mode, `RECENT`/`MATCH_SCORE` 정렬, empty/error/loading/result UI를 렌더링한다.                                          |
| `model/search/roommateSearchViewModel.ts`               | search summary와 bookmark list item을 같은 card VM으로 변환하되 `targetUserId`, bookmark pending/optimistic overlay를 명시한다.       |

Filter support matrix:

- scalar 생활 패턴 field는 manifest option이 enabled일 때만 single-select chip/button으로 노출한다.
- `college`는 `INCLUDE`/`EXCLUDE` 단일 operator와 multi value를 지원하며 `excludeMyCollege` 같은 FE convenience shortcut을 만들지 않는다.
- `grade`는 manifest operator가 제공하는 범위만 렌더링한다.
- `mbtiTraits`는 4개 차원 partial 선택을 허용하고 선택하지 않은 차원은 payload에서 제거한다.
- `ageBand`는 multi value를 dotted query payload shape로 compact한다.
- `minScore`는 manifest에서 enabled이고 `MATCH_SCORE` sort가 가능한 경우에만 submit된다.
- `CAMPUS_MERGED`/`POST_MATCH_COHORT_REVIEW`처럼 manifest `filters.enabled=false`인 scope에서는 sheet CTA가 disabled되고 policy copy만 표시된다.

Bookmark owner rule:

- 관심 목록 mode는 현재 search page items를 local filter하지 않고 `/api/bookmarks` list response만 렌더링한다.
- Bookmark sort는 shared `RECENT`/`MATCH_SCORE`만 사용하며 pagination은 cursor `pageInfo.nextCursor`만 따른다.
- Empty copy는 `NO_BOOKMARKS`와 `NO_VISIBLE_BOOKMARKS`를 구분하되 hidden reason, hidden count, target identity는 노출하지 않는다.
- Search card의 bookmark action은 `/api/bookmarks/:targetUserId` owner mutation으로 연결하고 duplicate pending 동안 disabled된다.
- Optimistic bookmark overlay는 UI hint이며 실패 시 이전 상태로 rollback된다. 최종 relation truth는 owner API response/refetch다.

## Phase 6 profile detail compatibility contract

Phase 6에서 profile detail response는 FULL detail에 한해 optional `compatibility`를 받을 수 있다. RoommateTab/Web BFF는 shared `publicProfileSchema`를 parse한 결과만 사용하고, Web feature code에서 scoring matrix나 raw lifestyle 비교를 재구현하지 않는다.

Boundary rules:

- `compatibility`는 `exposure.scoreVisible=true`이고 API가 `matchScore`를 계산할 수 있는 FULL detail에만 포함된다.
- TOMBSTONE 또는 `scoreVisible=false` detail에는 `compatibility`가 없다.
- `compatibility.overallScore`는 detail `matchScore`와 같은 값이어야 한다.
- Axis payload는 shared allowlist id/score/bucket만 포함한다. `viewerValue`, `targetValue`, condition field, DB field name, matrix/debug key는 BFF schema에서 거부된다.
- 음주 항목은 public axis로 렌더하지 않는다. API는 `hiddenAxisNotices: [{ code: 'DRINKING_EXCLUDED_BY_POLICY' }]`만 내려주며, Phase 7 copy mapper는 raw 음주 값을 추론할 수 있는 문구를 만들지 않는다.

## Accessibility acceptance

Phase 0은 modal/sheet 구현을 바꾸지 않지만, 이후 Phase의 acceptance를 아래로 고정한다.

- Filter sheet, profile detail dialog, match request/block/report dialog는 접근 가능한 role/name을 가진다.
- Open 시 focus는 dialog 내부 heading 또는 첫 interactive control로 이동한다.
- Close 시 focus는 trigger 또는 안전한 이전 위치로 복원된다.
- ESC, close button, backdrop close 정책은 keyboard/pointer 모두에서 일관된다.
- Dialog/sheet가 열려 있을 때 배경 content는 interaction 대상이 되지 않는다.
- body scroll lock과 mobile safe-area footer가 주요 CTA/오류 메시지를 가리지 않는다.
- validation/error/success/pending 상태는 screen reader가 인지할 수 있는 role/status/live region 또는 명확한 label을 가진다.
- Compatibility visualization은 SVG만으로 정보를 전달하지 않고 text/list/table fallback을 제공한다.
- Hidden/private field를 DOM, aria-label, title, tooltip, debug copy에 노출하지 않는다.

## Test map

Phase 4에서 boundary guard는 Green이어야 한다. Main list branch는 legacy data bootstrap 없이 `RoommateListTab`을 mount하고, RoommateTab runtime source는 Phase 0 금지 패턴을 포함하지 않는다. 또한 `RoommateListTab.tsx`에는 card/state rendering internals가 남지 않고 Phase 4 split files가 존재해야 한다.

```bash
pnpm --dir apps/web exec vitest run src/main/tabs/roommate-list/__tests__/roommate-runtime-boundary.test.ts
```

문서 형식 검증:

```bash
pnpm exec prettier --check --ignore-unknown apps/web/src/main/tabs/roommate-list/README.md .omx/plans/web-main-roommate-tab-refactor-plan.md
```

이후 Phase의 기본 Web gate 후보:

```bash
pnpm web:typecheck
pnpm web:lint
pnpm web:test -- src/main/tabs/roommate-list
```

Phase 3 shell/Main guard:

```bash
pnpm --dir apps/web exec vitest run \
  src/main/tabs/roommate-list/__tests__/roommate-runtime-boundary.test.ts \
  src/main/__tests__/Main.direct-action.test.tsx \
  src/main/__tests__/tab-mount.test.ts \
  src/main/tabs/roommate-list/__tests__/RoommateListTab.search-shell.test.tsx
```

Phase 1에서 roommate-search BFF/client foundation을 추가했다.
Phase 2에서 manifest-driven query/model/hook foundation을 추가했다.
Phase 3에서 제품 화면은 legacy local list state 대신 `hooks/useRoommateSearch.ts`를 사용한다.
Phase 4에서 search shell은 contract-derived view model, header/control/state/results/card components로 분리했다.
Phase 5에서 manifest filter sheet와 bookmark owner list/action mode를 추가했다.
Phase 6에서 shared/API/BFF profile detail compatibility contract와 privacy guard를 추가했다.

Phase 4 layout/state split guard:

```bash
pnpm --dir apps/web exec vitest run \
  src/main/tabs/roommate-list/__tests__/roommate-runtime-boundary.test.ts \
  src/main/tabs/roommate-list/model/search/__tests__/roommateSearchViewModel.test.ts \
  src/main/tabs/roommate-list/components/__tests__/RoommateSummaryCard.test.tsx \
  src/main/tabs/roommate-list/sections/empty-states/__tests__/RoommateSearchStateSection.test.tsx \
  src/main/tabs/roommate-list/sections/results/__tests__/RoommateSearchResultsSection.test.tsx \
  src/main/tabs/roommate-list/sections/scope-switcher/__tests__/RoommateSearchControls.test.tsx \
  src/main/tabs/roommate-list/__tests__/RoommateListTab.search-shell.test.tsx
```

Phase 1 BFF/client guard:

```bash
pnpm --dir apps/web exec vitest run src/app/api/__tests__/roommate-search-bff-routes.test.ts src/main/tabs/roommate-list/api/__tests__/roommateSearch.client.test.ts
```

Phase 2 manifest-driven query/state/hook guard:

```bash
pnpm --dir apps/web exec vitest run \
  src/main/tabs/roommate-list/model/search/__tests__/roommateSearchQuery.test.ts \
  src/main/tabs/roommate-list/model/filters/__tests__/roommateSearchManifestModel.test.ts \
  src/main/tabs/roommate-list/model/search/__tests__/roommateSearchState.test.ts \
  src/main/tabs/roommate-list/model/search/__tests__/roommateSearchNotices.test.ts \
  src/main/tabs/roommate-list/hooks/__tests__/useRoommateSearch.test.tsx
```

Phase 5 manifest filter / bookmark owner guard:

```bash
pnpm --dir apps/web exec vitest run \
  src/main/tabs/roommate-list/__tests__/roommate-runtime-boundary.test.ts \
  src/main/tabs/roommate-list/model/filters/__tests__/roommateFilterSheetModel.test.ts \
  src/main/tabs/roommate-list/sections/filters/__tests__/RoommateSearchFilterBar.test.tsx \
  src/main/tabs/roommate-list/overlays/__tests__/RoommateFilterSheet.test.tsx \
  src/main/tabs/roommate-list/api/__tests__/roommateActions.client.test.ts \
  src/main/tabs/roommate-list/hooks/__tests__/useRoommateBookmarkList.test.tsx \
  src/main/tabs/roommate-list/sections/bookmarks/__tests__/RoommateBookmarkResultsSection.test.tsx \
  src/main/tabs/roommate-list/components/__tests__/RoommateSummaryCard.test.tsx \
  src/main/tabs/roommate-list/sections/results/__tests__/RoommateSearchResultsSection.test.tsx \
  src/main/tabs/roommate-list/model/search/__tests__/roommateSearchViewModel.test.ts \
  src/main/tabs/roommate-list/__tests__/RoommateListTab.search-shell.test.tsx
```

## Phase checkpoint rule

각 Phase 완료 후 `.omx/plans/web-main-roommate-tab-refactor-plan.md`의 checkpoint에는 아래를 기록한다.

- 완료 commit hash 또는 uncommitted baseline short SHA.
- 변경 파일 요약.
- 실행한 테스트 명령과 결과.
- 접근성/성능 확인 결과 또는 명시적 미실행 사유.
- 남은 failing guard / blocker.
- 다음 Phase 기준 baseline.

## Phase 4 green baseline

현재 기준 runtime boundary guard는 Green이어야 한다. Phase 3에서 아래 legacy runtime surface를 삭제하거나 화면 source에서 제거했다.

- `Main.tsx`: list tab을 `LEGACY_DATA_TABS`에서 제거하고 `RoommateListTab`에 current viewer shell과 coarse entry capability만 전달한다.
- `Main.tsx`: `dashboard.viewer.capabilities.canEnterRoommateSearch`를 `searchEntryAllowed`로 전달해 coarse entry capability closed 상태에서도 legacy list data를 로드하지 않는다.
- `RoommateListTab.tsx`: `useRoommateSearch` summary shell, status/alert/loading/empty/result/load-more UI를 직접 소유한다.
- `useMainListViewState.ts`: Main list branch의 legacy sort/filter/view local state owner였으므로 삭제했다.
- `useRoommateListViewModel.ts`, `RoommateListHeader.tsx`, `RoommateListResults.tsx`, legacy view-model unit test는 Phase 3에서 삭제했다.
- OFF_SEASON 또는 `canEnterRoommateSearch=false`에서는 search auto-load를 끄고 타인 browse closed copy를 `role="status"`로 표시한다.
- Phase 4에서 `RoommateListTab.tsx`는 `useRoommateSearch` hook composition, closed-state 결정, section composition만 담당한다.
- Summary card score/action/result-read/bookmark copy는 `roommateSearchViewModel.ts`가 item capability에서 만든 view model만 사용하며, `resultRead.resultReadable=false`이면 context만으로 result-read badge를 열지 않는다.
- Result list와 bookmark list는 cursor `더 보기` button만 사용하며 local `displayCount`/client slicing을 다시 만들지 않는다.
- Phase 5에서 상세 필터는 manifest-driven field만 submit하고, bookmark mode는 `/api/bookmarks` owner list를 사용한다.
- Bookmark action은 owner BFF POST/DELETE로 연결됐고 duplicate pending/optimistic rollback을 hook에서 관리한다.

남은 범위는 Phase 6+로 넘긴다: profile detail/tombstone, compatibility shared/API/BFF contract, match/chat/block/report mutation UX 연결.

## Handoff

- Phase 1은 이 README와 boundary guard를 기준으로 `/api/roommate-search` 및 manifest BFF/client contract를 추가한다.
- Phase 2는 legacy `FilterState`/`DEFAULT_FILTERS` 대신 manifest-driven query/state machine을 도입한다.
- Phase 3은 Main list branch의 legacy bootstrap과 old props bridge를 제거했고, RoommateTab shell을 search hook source로 전환했다.
- Phase 4는 현재 shell을 contract-safe sections/components로 분리하고 state matrix UI를 정돈했다.
- Phase 5는 manifest filter sheet와 `/api/bookmarks` owner list/action mode를 제품 경로로 연결했다.
- Phase 10은 남은 compatibility bridge와 금지 패턴을 final guard로 닫는다.
