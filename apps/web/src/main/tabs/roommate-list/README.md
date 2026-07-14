# Web main RoommateTab

`apps/web/src/main/tabs/roommate-list`는 로그인 사용자가 `/main`의 룸메이트 찾기 탭에서 후보 summary list를 탐색하고, 정상 search entry에서 detail/action으로 이어지는 UX를 소유한다.
RoommateTab은 정책과 API contract를 화면에 반영하는 Web feature owner이며, 최종 권한 판단과 mutation 성공 여부는 BE owner API가 결정한다.

현재 Phase 9 상태에서 `/main` list tab은 legacy profile/social/matching props bridge를 받지 않고, `useRoommateSearch` 기반 summary shell과 search summary bookmark state 기반 저장한 후보 toggle을 통해 BFF/client 결과를 렌더링한다. Manifest filter sheet와 bookmark action은 제품 경로로 연결됐고, search summary entry의 `detailEntryToken` 기반 profile detail modal과 compatibility visualization을 RoommateTab 내부 경계로 연결했다. Detail modal의 block/report/match request action은 owner BFF/API mutation으로 연결되며, 성공/거부 후 list/detail state는 owner read API 재조회로 수렴한다. Phase 9는 이 상태들을 Storybook visual workshop으로 고정한다. ChatTab send UI와 MatchingTab request inbox 관리는 후속 owner 범위다.

이 repo의 UI/UX 의사결정은 root `DESIGN.md`를 제품 디자인 source로 참고하고, RoommateTab feature boundary의 세부 구현 source는 `.omx/plans/web-main-roommate-tab-refactor-plan.md`와 이 README를 따른다.

## 제품 책임

- `roommate-search` summary list response를 기준으로 후보 카드, scope, sort, filter, pagination, availability notice를 렌더링한다.
- 정상 search entry가 제공한 `detailEntryToken`을 통해 profile detail BFF/API로 진입한다.
- bookmark, block, report, match request CTA는 각 owner API의 `actions`/response/error reason을 사용자-facing copy로 안전하게 변환한다. 진행 중인 match request는 search summary의 `pendingMatchRequest`로 표시해 중복 요청 CTA를 막는다.
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
| Bookmark action                | `packages/shared/src/social-safety/bookmark.ts`, `apps/web/src/app/api/bookmarks/**`                                                                  |
| Block list/action              | `packages/shared/src/social-safety/block.ts`, `apps/web/src/app/api/blocks/**`                                                                        |
| Report action                  | `packages/shared/src/social-safety/report.ts`, `apps/web/src/app/api/reports/route.ts`                                                                |
| Match request action           | `packages/shared/src/match/contract`, `apps/api/src/matches/matches.controller.ts`, `apps/web/src/app/api/matches/requests/route.ts`                  |
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
- 삭제된 `@/main/dev-only/fixtures` mock surface, `mockRawProfiles`, `mockDb`, local mock DB.
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

| 파일                                                   | 책임                                                                                                                                                                         |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model/search/roommateSearchViewModel.ts`              | search item `exposure`/`actions`/`bookmark`/`pendingMatchRequest`/`matchScore`/`detailEntryToken`을 card view model로 변환한다. `resultRead`는 list badge로 노출하지 않는다. |
| `sections/header/RoommateSearchHeader.tsx`             | title과 runtime status message만 렌더링한다. availability notice는 header card로 노출하지 않고 empty/error state 판단에만 사용한다.                                          |
| `sections/scope-switcher/RoommateSearchControls.tsx`   | scope/sort controls와 filter disabled policy copy를 렌더링한다.                                                                                                              |
| `sections/empty-states/RoommateSearchStateSection.tsx` | closed/loading/error/empty state를 role/status/alert 기준으로 렌더링한다.                                                                                                    |
| `sections/results/RoommateSearchResultsSection.tsx`    | result list semantic과 cursor 기반 `더 보기` button을 렌더링한다.                                                                                                            |
| `components/RoommateSummaryCard.tsx`                   | card view model만 받아 summary facts, score badge, action/bookmark state copy를 표시한다.                                                                                    |

Card는 shared summary를 직접 다시 해석하지 않는다. `detailEntryToken`은 view model에 보존하지만 DOM에는 렌더링하지 않으며, detail modal과 mutation CTA는 Phase 6~8에서 owner API와 함께 연결한다.

## Phase 5 manifest filter / bookmark owner mode

Phase 5에서 상세 필터와 관심 목록은 legacy local state가 아니라 owner contract를 기준으로 동작한다.

| 파일                                           | 책임                                                                                                                                                                                      |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model/filters/roommateFilterSheetModel.ts`    | search manifest와 current query에서 filter sheet field/draft/active chip/submit payload를 만든다. disabled field는 submit하지 않는다.                                                     |
| `sections/filters/RoommateSearchFilterBar.tsx` | 현재 scope에서 filter sheet를 열 수 있는지와 active chip/remove/reset UI를 표시한다.                                                                                                      |
| `overlays/RoommateFilterSheet.tsx`             | `BaseBottomSheet` 기반 manifest field editor다. legacy `BottomSheet`/`FilterState`/`DEFAULT_FILTERS`를 사용하지 않는다.                                                                   |
| `api/roommateActions.client.ts`                | `/api/bookmarks/:targetUserId` POST/DELETE를 shared bookmark schema로 parse한다. `/api/bookmarks` list client는 owner contract helper로 남기되 RoommateTab 화면 page로 렌더링하지 않는다. |
| `hooks/useRoommateBookmarkList.ts`             | bookmark action pending/optimistic rollback state를 소유한다. list auto-load는 RoommateTab에서 사용하지 않는다.                                                                           |
| `model/search/roommateSearchViewModel.ts`      | search summary와 bookmark list item을 같은 card VM으로 변환하되 `targetUserId`, bookmark pending/optimistic overlay, 진행 중 match request pill을 명시한다.                               |

Filter support matrix:

- scalar 생활 패턴 field는 manifest option이 enabled일 때만 single-select chip/button으로 노출한다.
- `college`는 `INCLUDE`/`EXCLUDE` 단일 operator와 multi value를 지원하며 `excludeMyCollege` 같은 FE convenience shortcut을 만들지 않는다.
- `grade`는 manifest operator가 제공하는 범위만 렌더링한다.
- `mbtiTraits`는 4개 차원 partial 선택을 허용하고 선택하지 않은 차원은 payload에서 제거한다.
- `ageBand`는 multi value를 dotted query payload shape로 compact한다.
- `minScore`는 manifest에서 enabled이고 `MATCH_SCORE` sort가 가능한 경우에만 submit된다.
- `CAMPUS_MERGED`/`POST_MATCH_COHORT_REVIEW`처럼 manifest `filters.enabled=false`인 scope에서는 상세 필터 진입점을 렌더링하지 않는다.

Bookmark owner rule:

- Same Dormitory의 `저장한 후보만 보기` toggle은 별도 bookmark 전용 list/card를 만들지 않고 현재 search 결과 카드 안에서 `bookmark.bookmarked`/optimistic state가 true인 후보만 좁혀 보여준다.
- 저장한 후보만 보기 상태에서도 scope/sort/filter controls는 `검색 결과` 카드에 그대로 유지하며, 정렬/필터 truth는 `roommate-search` query를 따른다.
- 저장한 후보가 없는 경우에는 hidden reason, hidden count, target identity를 노출하지 않고 같은 건물 후보 card의 bookmark icon으로 다시 볼 후보를 저장하라는 empty copy만 표시한다.
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

## Phase 7 profile detail modal / compatibility UI

Phase 7에서 RoommateTab은 search summary card의 detail action을 `useRoommateProfileDetail`과 `RoommateProfileDetailDialog`로 연결한다. Detail source는 summary card view model의 `targetUserId`, `nickname`, `detailEntryToken` snapshot뿐이며 token은 DOM, storage, error copy에 렌더링하지 않는다.

| 파일                                                 | 책임                                                                                                                                      |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `api/roommateProfileDetail.client.ts`                | `/api/profiles/:targetUserId?detailEntryToken=...` BFF를 호출하고 `publicProfileSchema`로 FULL/TOMBSTONE 응답을 재검증한다.               |
| `hooks/useRoommateProfileDetail.ts`                  | selected target, loading/success/error/closed state, AbortController, stale response guard, retry/close/unmount를 memory-only로 관리한다. |
| `model/compatibility/compatibilityCopy.ts`           | shared compatibility axis id/bucket/hidden notice code를 안전한 한글 copy로 변환한다.                                                     |
| `model/compatibility/compatibilityChart.mapper.ts`   | `PublicProfileCompatibility`를 radar point와 text list view model로 변환하되 score matrix나 raw field 비교를 재구현하지 않는다.           |
| `model/compatibility/compatibilityPrivacy.policy.ts` | copy/view model에 hidden/raw/debug key가 섞였는지 테스트가 검증할 수 있는 guard helper를 제공한다.                                        |
| `components/CompatibilityRadar.tsx`                  | 새 chart dependency 없이 repo-native SVG radar를 보조 시각화로 렌더링한다.                                                                |
| `components/CompatibilityAxisList.tsx`               | screen reader/readable text fallback으로 모든 축 label, bucket, score를 표시한다.                                                         |
| `overlays/RoommateProfileDetailDialog.tsx`           | FULL/TOMBSTONE/loading/error 상태, public rows, compatibility visualization, privacy note, Phase 8 action handoff copy를 표시한다.        |

Detail modal rules:

- `item.detailViewable && item.detailEntryToken`인 search card만 detail action이 enabled다.
- Token이 없는 summary/bookmark source는 direct/probing fetch를 하지 않는다.
- Close 또는 unmount 시 진행 중인 detail request를 abort하고 selected target snapshot을 보존하지 않는다.
- 404/`PROFILE_NOT_VISIBLE`/entry error는 target 존재 여부나 raw code를 노출하지 않는 generic copy와 목록 새로고침 CTA로 닫는다.
- FULL detail은 `matchScore` badge와 `compatibility` radar/list를 표시하되, `compatibility`가 없으면 score/detail 공개 상태에 맞는 안내만 표시한다.
- TOMBSTONE detail은 retained payload를 복원하지 않고 tombstone display/message와 disabled action copy만 표시하며 compatibility/radar를 렌더링하지 않는다.
- `CompatibilityRadar`는 보조 시각화이고, 정보 전달 source는 `CompatibilityAxisList`다.
- Detail action CTA는 Phase 8에서 `useRoommateActions`로 handoff한다. Match request/block/report는 owner API mutation으로 연결하고, chat은 ChatTab send UI를 만들지 않고 대화 탭 이동 handoff까지만 제공한다.

## Phase 8 social actions / stale state UX

Phase 8에서 RoommateTab은 detail modal의 다음 행동 영역을 `useRoommateActions`와 action dialogs로 연결한다. FE는 `actions` capability를 UX hint로 사용하지만, mutation 성공/거부는 항상 BE owner API가 최종 판단한다.

| 파일                                             | 책임                                                                                                                           |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web/src/app/api/matches/requests/route.ts` | `POST /api/matches/requests`를 protected BFF로 전달하고 success response를 `matchRequestActionResponseSchema`로 검증한다.      |
| `api/roommateActions.client.ts`                  | bookmark 기존 기능과 block/report/match request action을 shared schema로 parse한다.                                            |
| `hooks/useRoommateActions.ts`                    | action dialog state, pending target guard, receipt/error feedback, search/bookmark/detail refresh orchestration을 소유한다.    |
| `model/actions/roommateActionReasonCopy.ts`      | action unavailable reason, match stale/domain error, report reason/optional block status를 raw code 없이 safe copy로 변환한다. |
| `overlays/RoommateBlockDialog.tsx`               | optional block note form과 pending/error live status를 렌더링한다.                                                             |
| `overlays/RoommateReportDialog.tsx`              | profile report reason/detail/disclaimer/optional block form과 receipt-safe UX를 렌더링한다.                                    |
| `overlays/RoommateMatchRequestDialog.tsx`        | optional request note, 최대 5일 요청 유효기간 안내, modal-local 실패 복구를 포함한 match request confirmation UX를 렌더링한다. |
| `overlays/RoommateProfileDetailDialog.tsx`       | FULL detail에서 match request/chat/block/report action handoff를 제공하고 TOMBSTONE에서는 disabled action copy만 유지한다.     |

Action rules:

- Match request create는 `targetUserId`와 optional `note`만 전송한다. `detailEntryToken`은 mutation payload나 action target snapshot에 포함하지 않는다.
- Block success 또는 report optional block success는 search list와 bookmark list를 재조회한다. Block create의 bookmark side-effect를 FE local 제거로 대체하지 않는다.
- Report는 intake-only receipt만 표시한다. 제재/운영 판단 여부, raw report detail, block note, internal risk tier는 UI에 표시하지 않는다.
- Match request stale/domain rejection은 crash가 아니라 “목록 이후 상태가 바뀌었을 수 있음” copy와 list refresh로 처리한다.
- Duplicate submit은 `pendingTargetUserIds`로 target 단위 차단한다. 이미 존재하는 pending request는 `roommate-search` summary의 `pendingMatchRequest`로 표시하고 detail CTA에서는 새 요청 대신 대기/확인 CTA를 보여준다.
- Chat action은 ChatTab send/resume mutation을 만들지 않고, 가능한 경우 대화 탭 이동 handoff로 제한한다.
- Search summary의 `activeChatThread`는 chat owner의 `ConversationThread` current row가 `OPEN`이고 양쪽 member가 `ACTIVE`인 경우만 전달한다. 이는 신규 채팅 가능(`actions.canStartChat`)과 구분되는 “대화 중” 상태이며, RoommateTab은 “대화 이어가기” handoff만 제공한다.

## Phase 9 Storybook visual workshop

Phase 9에서 RoommateTab은 Storybook에서 policy state를 빠르게 비교할 수 있는 story-only visual workshop을 제공한다. Storybook fixture는 runtime owner API shape를 흉내 내지만 로그인/auth/DB/BFF 통합 정합성의 완료 근거가 아니다. 통합 정합성은 BFF/client targeted test와 full-stack smoke가 소유한다.

| 파일                                            | 책임                                                                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `__stories__/roommate-story-renderer.tsx`       | `SeasonProvider` + `RoommateListTab` story surface, auto-open smoke helper, 공통 story factory를 제공한다.                                  |
| `__stories__/RoommateListTab.*.stories.tsx`     | `{시즌}/{도메인}` title hierarchy로 search/detail/action/responsive named stories를 나눠 제공한다.                                          |
| `__stories__/roommate-story-scenarios.ts`       | shared/owner contract schema를 만족하는 typed scenario matrix와 policy-state metadata를 제공한다.                                           |
| `__stories__/roommate-story-api-fixtures.ts`    | story mount 중에만 `window.fetch`를 가로채고 unmount 시 원래 fetch를 복원한다. non-RoommateTab request는 original fetch로 pass-through한다. |
| `__tests__/roommate-story-scenarios.test.ts`    | Storybook config/typecheck include, story source boundary, scenario schema sanity, privacy guard를 검증한다.                                |
| `.storybook/main.ts`, `tsconfig.storybook.json` | Home stories와 함께 `main/tabs/roommate-list` stories/typecheck surface를 포함한다.                                                         |

Storybook boundary rules:

- Story fixture는 `__stories__` 안에만 두고 production RoommateTab runtime file에서 import하지 않는다.
- `detailEntryToken` 값, raw backend error code, report detail, block note는 story title/description/docs에 표시하지 않는다.
- Scenario data는 shared public contract allowlist만 사용하고, 음주 raw field나 target condition value를 detail/compatibility payload에 넣지 않는다.
- Block/report/match request story는 Phase 8 mutation surface만 재현한다. ChatTab send/resume UI와 MatchingTab request inbox/accept/reject/cancel flow는 만들지 않는다.
- Storybook에서 자동으로 일부 dialog를 여는 helper는 visual workshop 전용이다. 제품 runtime state injection prop을 추가하지 않는다.

### Phase 9 responsive design baseline

- 근거(source-backed fact): Android Developers의 Material-derived canonical layout guidance는 list-detail/feed/supporting pane을 다양한 화면 크기에서 검증된 layout으로 설명하고, supporting pane은 compact 화면에서는 아래나 sheet로, expanded 화면에서는 main 옆 보조 pane으로 배치할 수 있다고 설명한다. URL: https://developer.android.com/develop/adaptive-apps/guides/canonical-layouts
- 근거(source-backed fact): WAI-ARIA APG modal dialog pattern은 modal 하위 content 외부를 inert로 두고 focus를 dialog 내부에 유지해야 하며, 닫을 때 logical focus return이 필요하다고 설명한다. URL: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- 근거(source-backed fact): Storybook interaction tests/play function은 story를 특정 state로 렌더하고 user behavior를 시뮬레이션할 수 있다. URL: https://storybook.js.org/docs/writing-tests/interaction-testing / https://storybook.js.org/docs/writing-stories/play-function
- repo 적용 판단(inference): RoommateTab은 mobile에서 single-column card feed + filter/detail/action sheet를 유지하고, desktop에서는 HomeTab처럼 `max-w-6xl` surface 안에서 result feed를 primary pane, manifest filter + 탐색 guide를 sticky supporting pane으로 둔다. Instagram/Facebook류 social feed의 “콘텐츠는 중앙, 보조 탐색/상태는 주변” 패턴은 참고하되, 이 repo는 policy/contract state가 더 중요하므로 action 과밀 social chrome은 도입하지 않는다.
- repo 적용 판단(inference): 관심 저장은 설명형 secondary button보다 목적이 바로 보이는 `Bookmark` icon-only affordance를 card 우상단에 배치한다. Accessible name/title은 `관심 목록 저장`/`관심 목록에서 제거`로 유지한다.
- repo 적용 판단(inference): Detail modal은 mobile bottom sheet, desktop centered dialog로 전환하되 같은 component contract를 사용한다. Desktop에서 sheet 폭을 과도하게 늘리지 않고 `max-w-3xl`로 제한해 긴 생활패턴 비교표의 readability를 우선한다.

Detail comparison anatomy:

1. `생활패턴 적합도 분석` — 핵심 포인트, radar, axis list/detail로 Green/blue/slate의 의미와 축별 차이를 안내한다.
2. public profile detail contract의 allowlist field와 viewer condition snapshot은 별도 원본 섹션으로 반복 노출하지 않고, 축별 detail 안에서 필요한 비교 정보만 compact하게 표시한다.

Color semantics:

| 색    | 의미                      | 사용 위치                                   |
| ----- | ------------------------- | ------------------------------------------- |
| Green | 잘 맞음 / 높은 적합도     | radar/list high bucket, positive comparison |
| Blue  | 조율 가능 / 중간 적합도   | medium bucket, neutral-helpful comparison   |
| Slate | 정보 부족 / 낮음 / 비공개 | low/unknown bucket, disabled/private copy   |

주요 scenario map:

- Search: `SeasonOpenRegistered`, `SeasonOpenNotRegistered`, `SeasonMatchingRegistered`, `SeasonMatchingNotRegistered`, `SeasonMatchingNotRegisteredEmpty`, `SeasonMatchingRegisteredEmpty`, `SeasonMatchingSearchError`, `SeasonMatchingLoadingSkeleton`, `PostMatchRegistered`, `PostMatchNotRegistered`, `PostMatchDeregistered`, `PostMatchEmpty`, `PostMatchSearchError`, `PostMatchLoadingSkeleton`
- Bookmark affordance: `MobileBookmarkIconState`와 search 결과 내 `저장한 후보만 보기` toggle
- Detail: `DetailFullCompatibility`, `ExceptionScoreCalculationFailed`, `ExceptionDetailUnavailable`, `ExceptionAccessRecheckFailed` (Post Match 결과 상세는 Home/Matching result owner가 담당하므로 RoommateTab list story에 두지 않는다)
  - `ExceptionScoreCalculationFailed`: 서버 점수 계산 오류 상태를 summary amber pill과 detail amber 안내로 표시한다.
  - `ExceptionDetailUnavailable`: 정상 카드 진입 후 상대가 시즌 참여를 철회한 경우를 compact 안내로 표시하고 summary 점수는 유지한다.
  - `ExceptionAccessRecheckFailed`: 서버 재확인 실패를 target 존재 여부 없이 generic 안내로 표시하고 summary 점수는 유지한다.
- Actions: `MatchRequestDialog`, `RequestPending`, `RequestSuccess`, `PendingRequestStatus`, `RequestFailed`, `RequestAlreadyPending`, `RequestLimitReached`, `RequestTargetMatched`, `ActionBlockedUser`, `BlockDialog`, `BlockSuccessReceipt`, `ReportDialog`, `ReportOptionalBlockReceipt` (Post Match 신규 action은 닫혀 Search-only로 둔다)

실행 명령:

```bash
pnpm --dir apps/web storybook
pnpm --dir apps/web typecheck:storybook
pnpm --dir apps/web storybook:build
```

Manual viewport checklist:

| Viewport         | Story 후보                                        | 확인 항목                                                                                       |
| ---------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Mobile 390×844   | `SeasonMatchingRegistered`                        | search card, scope/sort controls, filter sheet open/close/apply chrome                          |
| Mobile 430×932   | `DetailFullCompatibility`, `ReportDialog`         | long content scroll, radar/list fallback, report form/disclaimer 위치                           |
| Desktop 1280×800 | `SeasonMatchingRegistered`                        | result feed + sticky supporting pane, filter chip/action affordance, banner 위치                |
| Desktop 1440×900 | `DetailFullCompatibility`, `SeasonOpenRegistered` | centered detail dialog, 생활패턴/조건/비교 3-section readability, 저장 후보 toggle/filter state |
| Keyboard smoke   | `SeasonMatchingRegistered`, `MatchRequestDialog`  | open/close, dialog validation, submit/cancel focus path                                         |

수동 visual 결과는 Phase checkpoint 또는 PR 본문에 viewport/story/result 형식으로 기록한다. Phase 9는 Chromatic/Loki/pixel-diff infra를 새로 도입하지 않는다.

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
Phase 5에서 manifest filter sheet와 bookmark owner action을 추가했다.
Phase 6에서 shared/API/BFF profile detail compatibility contract와 privacy guard를 추가했다.
Phase 7에서 search summary entry 기반 detail modal과 compatibility visualization UI를 추가했다.
Phase 8에서 detail modal action CTA를 block/report/match request owner API mutation과 stale-safe feedback으로 연결했다.
Phase 9에서 Storybook scenario matrix와 story-only fetch fixture를 추가했다.

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
  src/main/tabs/roommate-list/components/__tests__/RoommateSummaryCard.test.tsx \
  src/main/tabs/roommate-list/sections/results/__tests__/RoommateSearchResultsSection.test.tsx \
  src/main/tabs/roommate-list/model/search/__tests__/roommateSearchViewModel.test.ts \
  src/main/tabs/roommate-list/__tests__/RoommateListTab.search-shell.test.tsx
```

Phase 7 profile detail modal / compatibility UI guard:

```bash
pnpm --dir apps/web exec vitest run \
  src/main/tabs/roommate-list/__tests__/roommate-runtime-boundary.test.ts \
  src/main/tabs/roommate-list/api/__tests__/roommateProfileDetail.client.test.ts \
  src/main/tabs/roommate-list/model/compatibility/__tests__/compatibilityCopy.test.ts \
  src/main/tabs/roommate-list/model/compatibility/__tests__/compatibilityChart.mapper.test.ts \
  src/main/tabs/roommate-list/hooks/__tests__/useRoommateProfileDetail.test.tsx \
  src/main/tabs/roommate-list/components/__tests__/CompatibilityRadar.test.tsx \
  src/main/tabs/roommate-list/components/__tests__/CompatibilityAxisList.test.tsx \
  src/main/tabs/roommate-list/overlays/__tests__/RoommateProfileDetailDialog.test.tsx \
  src/main/tabs/roommate-list/components/__tests__/RoommateSummaryCard.test.tsx \
  src/main/tabs/roommate-list/sections/results/__tests__/RoommateSearchResultsSection.test.tsx \
  src/main/tabs/roommate-list/__tests__/RoommateListTab.search-shell.test.tsx
```

Phase 8 social actions / stale UX guard:

```bash
pnpm --dir apps/web exec vitest run \
  src/main/tabs/roommate-list/__tests__/roommate-runtime-boundary.test.ts \
  src/app/api/__tests__/matches-bff-routes.test.ts \
  src/app/api/__tests__/social-safety-bff-routes.test.ts \
  src/main/tabs/roommate-list/api/__tests__/roommateActions.client.test.ts \
  src/main/tabs/roommate-list/model/actions/__tests__/roommateActionReasonCopy.test.ts \
  src/main/tabs/roommate-list/hooks/__tests__/useRoommateActions.test.tsx \
  src/main/tabs/roommate-list/overlays/__tests__/RoommateBlockDialog.test.tsx \
  src/main/tabs/roommate-list/overlays/__tests__/RoommateReportDialog.test.tsx \
  src/main/tabs/roommate-list/overlays/__tests__/RoommateMatchRequestDialog.test.tsx \
  src/main/tabs/roommate-list/overlays/__tests__/RoommateProfileDetailDialog.test.tsx \
  src/main/tabs/roommate-list/__tests__/RoommateListTab.search-shell.test.tsx
```

Phase 9 Storybook visual workshop guard:

```bash
pnpm --dir apps/web exec vitest run \
  src/main/tabs/roommate-list/__tests__/roommate-runtime-boundary.test.ts \
  src/main/tabs/roommate-list/__tests__/roommate-story-scenarios.test.ts
pnpm --dir apps/web typecheck:storybook
pnpm --dir apps/web storybook:build
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
- Phase 5에서 상세 필터는 manifest-driven field만 submit하고, 저장 후보 보기는 별도 page 없이 search 결과의 bookmark state 필터로 동작한다.
- Bookmark action은 owner BFF POST/DELETE로 연결됐고 duplicate pending/optimistic rollback을 hook에서 관리한다.
- Phase 7에서 search card detail action은 `detailEntryToken`이 있는 source만 열고, profile detail BFF 응답을 FULL/TOMBSTONE/error modal 상태로 렌더링한다.
- Compatibility UI는 shared allowlist payload만 radar/list view model로 변환하며 raw hidden key, condition value, matrix/debug key를 runtime/source/DOM에 노출하지 않는다.
- Phase 8에서 detail action CTA는 `useRoommateActions`를 통해 match request/block/report owner mutation으로 연결되고, stale/domain rejection은 safe feedback + owner list refresh로 수렴한다.

남은 범위는 Phase 9+로 넘긴다: Storybook/visual/mobile regression matrix, ChatTab send/resume UX, MatchingTab request inbox/accept/reject/cancel 관리.

## Handoff

- Phase 1은 이 README와 boundary guard를 기준으로 `/api/roommate-search` 및 manifest BFF/client contract를 추가한다.
- Phase 2는 legacy `FilterState`/`DEFAULT_FILTERS` 대신 manifest-driven query/state machine을 도입한다.
- Phase 3은 Main list branch의 legacy bootstrap과 old props bridge를 제거했고, RoommateTab shell을 search hook source로 전환했다.
- Phase 4는 현재 shell을 contract-safe sections/components로 분리하고 state matrix UI를 정돈했다.
- Phase 5는 manifest filter sheet와 `/api/bookmarks/:targetUserId` owner action을 제품 경로로 연결했다.
- Phase 6은 shared/API/BFF profile detail compatibility contract를 추가했다.
- Phase 7은 RoommateTab detail modal과 repo-native compatibility visualization을 제품 경로로 연결했다.
- Phase 8은 detail modal action CTA를 block/report/match request owner API와 stale-safe feedback으로 연결했다.
- Phase 9는 Storybook/visual/mobile scenario matrix를 검증한다.
- Phase 10은 남은 compatibility bridge와 금지 패턴을 final guard로 닫는다.
