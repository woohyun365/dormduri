# MatchingTab runtime boundary

## Canonical entry

- Product runtime entry는 `MatchingTab.tsx` 하나다.
- `Main.tsx`는 `viewerId`, dashboard의 최소 season shell(`id`, `state`), badge callback과 shell
  navigation command만 전달한다. request/active DTO나 matching domain action은 전달하지 않는다.
- `MatchingTab`은 BFF `/api/matches/overview`를 shared schema로 parse하는 typed client와
  `useMatchingOverview`를 통해 읽는다.
- view model은 loading/error/public unavailable/four-season state를 분리하고
  `SeasonStateRenderer`는 exhaustive season dispatch만 담당한다.
- action 가능 여부와 제한 사유는 server capability가 소유하며 FE가 local 상태로 재판정하지 않는다.

## Shell consistency

Home dashboard season shell과 matching overview season은 `matching-shell-consistency.ts`에서 비교한다.
첫 mismatch는 dashboard 전환 중일 수 있어 overview를 한 번 다시 읽고, 반복 mismatch는 user-safe
partial/error state로 닫는다. 이 경로에서 local season이나 action capability를 합성하지 않는다.

## Responsive and accessibility contract

- Main이 page `<main>` landmark를 소유하고 MatchingTab root는 labelled `<section>`을 사용한다.
- mobile은 single column이며 supporting policy content는 primary content 뒤에 남는다.
- desktop shell은 `1152px / minmax(0, 720px) 320px / 24px` 계약을 사용한다.
- loading/error/denied/four-season state는 동일 header, grid, policy rail을 사용한다.
- current/past와 sent/received는 APG manual-activation tab이다. Arrow/Home/End는 focus만 옮기고
  Enter/Space/click만 panel selection을 바꾼다. past history fetch도 explicit selection에서만 시작한다.
- request expiry는 screen reader에 매 초 숫자를 알리지 않고 day/hour/expired threshold가 바뀔 때만
  polite 안내를 갱신한다. canonical matching은 auto-rotating banner를 만들지 않으며 interaction
  transition은 `motion-reduce`에서 최소화한다.
- canonical Storybook responsive matrix는 `matchingMobile320`, `matchingMobile360`,
  `matchingMobile390`, `matchingMobile430`, `matchingDesktop1280`, `matchingDesktop1440` viewport와
  request long-copy, active progress, history long-copy/tombstone story를 함께 사용한다.

## Legacy baseline

Phase 0 redesign-before 화면은 `__stories__/legacy/LegacyMatchingTabBaseline.tsx`에 격리되어 있다.
이는 Storybook/test-only comparison surface이며 product import graph와 canonical correctness 근거가
아니다. 출시되지 않은 group variant는 `Baseline/Legacy/UnsupportedGroup` namespace에서만 유지한다.
해당 namespace는 current fixture/renderer와 연결하지 않은 정적 historical snapshot이며, 3인실
`roomType` metadata는 매칭 UI를 열지 않는다. 제품 runtime은 2인 매칭만 제공한다.
Canonical runtime Storybook은 deterministic state workshop을 위해 `MatchingTabView`를 사용하며,
실제 BFF fetch/identity reset 경계는 `MatchingTab.test.tsx`와 `useMatchingOverview.test.tsx`가 검증한다.
Canonical scenario namespace는 `Off Season`, `Season Open`, `Season Matching`, `Post Match`, `System`으로
분리한다. 세부 request/active/history interaction story는 각 feature section namespace가 계속 소유한다.

## Pair request management

- `matching-request-view.ts`는 overview의 sent/received ordering을 그대로 보존하고 표시용 quota,
  public terminal label, score/note/detail exposure만 파생한다. 정렬이나 action authorization을 다시
  계산하지 않는다.
- `PairRequestSection`은 manual-activation APG tabs와 request card/dialog orchestration을 소유한다.
  terminal row에는 mutation control을 노출하지 않으며 pending row도 shared action capability만 따른다.
- `useMatchingActions`는 동일 action/request 중복 제출을 막고 success/stale 모두 overview를 다시
  읽는다. optimistic request merge나 raw upstream message 노출은 허용하지 않는다.
- expiry/cutoff는 API `serverNow`와 monotonic elapsed 기반의 user-facing 안내다. 시간이 0이 되어도
  FE가 action 가능 여부를 변경하지 않고 서버 응답과 authoritative refetch에 수렴한다.
- request detail은 summary의 `detailEntryToken`이 있을 때만 roommate-search public detail owner를
  재사용한다. token은 authorization이 아니며 detail owner가 요청 시점 정책을 다시 검증한다.
- `채팅하기`는 counterpart summary의 chat-owner `canStartChat` capability가 열릴 때만 노출하며,
  matching은 thread 상태를 다시 판정하지 않고 Main의 shell navigation command만 호출한다.

## Current active match and mutual unmatch

- overview와 active GET은 current `ACTIVE` relation만 반환한다. terminal `UNMATCHED` summary는
  mutual unmatch action response에서만 읽고, overview refetch 후 `activeMatch=null`로 수렴한다.
- `matching-active-view.ts`는 public counterpart summary, score exposure, result-read, chat action과
  unmatch capability를 표시 모델로 변환한다. optional/불일치 projection은 detail·score·chat을
  fail-closed하며 nickname fallback만 유지한다.
- active profile detail은 request의 `detailEntryToken`을 재사용하지 않는다. `/api/profiles/:userId`를
  token 없이 호출하고 API가 current `MATCHED_PARTNER` result-read 관계와 visibility를 다시 검증한다.
- mutual unmatch는 `0/2`, 내가 요청한 `1/2`, 상대가 요청한 `1/2`, action response의 `2/2`를
  구분한다. request/cancel은 relation 단위로 충돌 잠금하고 success/stale 이후 overview를 다시 읽는다.
- action이 닫힌 이유는 `unmatchProgress.disabledReason`이 소유한다. FE는 season, cutoff,
  `availableUntil`로 authorization을 재판정하지 않는다.
- `SEASON_POST_MATCH`는 같은 active result card의 read-only 변형을 사용하며 unmatch control을
  생성하지 않는다. profile/chat은 각 owner capability가 열린 경우에만 유지한다.
- past history는 `GET /api/matches/history`의 season ordering을 그대로 표시하고, 더 보기는 받은
  season group을 3개씩 여는 client-side reveal이다. cursor/page API를 합성하지 않는다.
- 과거 상대 상세는 `MATCHED_SUCCESS` entry의 entry-id route만 사용한다. `UNMATCHED_AFTER_SUCCESS`와
  request terminal row는 summary-only이며 generic profile route로 우회하지 않는다.
- `history/MatchHistoryDetailContent`는 stable feature export다. FULL에는 materialized `matchScore`
  snapshot만 표시하고, tombstone에는 score나 full profile snapshot을 보강하지 않는다.

## Chat ownership boundary

ChatTab은 `/api/chat/threads` BFF와 `@repo/shared/chat` contract만 사용한다. 매칭 확정·해제와
request lifecycle action은 canonical MatchingTab만 소유하며, ChatTab은 thread의 `status`,
`canSendMessage`, `canReport` capability를 다시 판정하거나 프로필/매칭도 fallback으로 보강하지 않는다.
