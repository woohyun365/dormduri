# Web main RoommateTab

`apps/web/src/main/tabs/roommate-list`는 로그인 사용자가 `/main`의 룸메이트 찾기 탭에서 후보 summary list를 탐색하고, 정상 search entry에서 detail/action으로 이어지는 UX를 소유한다.
RoommateTab은 정책과 API contract를 화면에 반영하는 Web feature owner이며, 최종 권한 판단과 mutation 성공 여부는 BE owner API가 결정한다.

현재 Phase 0의 목적은 실제 API 전환이 아니라, 이후 Phase가 같은 정책/contract baseline 위에서 진행되도록 RoommateTab의 source of truth, runtime boundary, 금지 legacy dependency, 접근성 acceptance, test command를 고정하는 것이다.

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

| 주제                          | Source of truth                                                                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search summary list           | `GET /api/roommate-search`, `GET /api/roommate-search/manifest`, `packages/shared/src/roommate-search/contract/index.ts`                              |
| Search policy/copy terms      | `docs/04_policy/official/roommate-searching.md`                                                                                                       |
| Season/search capability      | `docs/04_policy/official/season-participation.md`, roommate-search response `scopeAvailability`, item `exposure`/`actions`                            |
| Profile detail                | `GET /api/profiles/:userId?detailEntryToken=...`, `packages/shared/src/profile/contract/public.ts`, `apps/web/src/app/api/profiles/[userId]/route.ts` |
| Bookmark list/action          | `packages/shared/src/social-safety/bookmark.ts`, `apps/web/src/app/api/bookmarks/**`                                                                  |
| Block list/action             | `packages/shared/src/social-safety/block.ts`, `apps/web/src/app/api/blocks/**`                                                                        |
| Report action                 | `packages/shared/src/social-safety/report.ts`, `apps/web/src/app/api/reports/route.ts`                                                                |
| Match request action          | `apps/api/src/matches/matches.controller.ts`, Phase 8에서 추가할 `apps/web/src/app/api/matches/requests/**` BFF                                       |
| Public profile field exposure | `docs/04_policy/official/profile-model.md`, `packages/shared/src/profile/contract/public.ts`                                                          |
| Incident/safety copy          | `docs/04_policy/official/incident-enforcement.md`, social-safety shared contracts                                                                     |

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
  currentUser: UserProfile;
  onNavigate: (tab: TabId) => void;
}
```

RoommateTab 내부는 `api/`, `model/`, `hooks/`, `sections/`, `overlays/`, `components/`, `__tests__/`, `__stories__/`로 분리한다. BFF/client, query state, manifest mapper, detail/action state는 RoommateTab feature boundary 안에서 소유한다.

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

Phase 0에서 추가하는 boundary guard는 현재 코드 기준 Red일 수 있다. 이 Red baseline은 이후 Phase에서 legacy dependency를 제거하며 green으로 전환한다.

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

BFF route를 추가하는 Phase에서는 route-level Vitest와 BFF helper schema/redaction 검증을 함께 실행한다.

Phase 1에서 추가된 roommate-search BFF/client foundation은 아직 UI에 연결하지 않는다.
Phase 2는 manifest-driven query/model/hook foundation을 추가하지만, Phase 3 전까지 제품 화면은 legacy local state를 계속 사용한다. 즉 새 `model/search`, `model/filters`, `hooks/useRoommateSearch.ts`는 UI 미연결 contract consumer이고, Main props bridge 제거와 화면 source 전환은 Phase 3 책임이다.

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

## Phase checkpoint rule

각 Phase 완료 후 `.omx/plans/web-main-roommate-tab-refactor-plan.md`의 checkpoint에는 아래를 기록한다.

- 완료 commit hash 또는 uncommitted baseline short SHA.
- 변경 파일 요약.
- 실행한 테스트 명령과 결과.
- 접근성/성능 확인 결과 또는 명시적 미실행 사유.
- 남은 failing guard / blocker.
- 다음 Phase 기준 baseline.

## Phase 0 expected red baseline

현재 기준 runtime boundary guard는 아래 legacy dependency 때문에 Red가 예상된다.

- `RoommateListTab.tsx`: `DEFAULT_FILTERS`, legacy `FilterState`, local `bookmarkedUserIds`/`blockedUserIds`, `displayCount`.
- `useRoommateListViewModel.ts`: `calcMatchScoreWithGating`, legacy `FilterState`, local filter/bookmark/block/score logic.
- `RoommateListHeader.tsx`: legacy `FilterState` 기반 active filter chips.
- `RoommateListResults.tsx`: `displayCount` slice pagination과 local bookmark state.
- `Main.tsx`: list tab legacy bootstrap과 old props bridge.

이 실패는 Phase 0의 제품 코드 미전환 범위에서는 허용한다. 단, 실패 목록을 checkpoint에 남기고 Phase 1~3/10에서 green 전환한다.

## Handoff

- Phase 1은 이 README와 boundary guard를 기준으로 `/api/roommate-search` 및 manifest BFF/client contract를 추가한다.
- Phase 2는 legacy `FilterState`/`DEFAULT_FILTERS` 대신 manifest-driven query/state machine을 도입한다.
- Phase 3은 Main list branch의 legacy bootstrap과 old props bridge를 제거한다.
- Phase 10은 남은 compatibility bridge와 금지 패턴을 final guard로 닫는다.
