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
- RoommateTab과 MatchingTab은 `MainTabHeaderFrame`을 공유해 sticky header의 상단 경계를 동일하게
  유지한다. MatchingTab의 identity content는 legacy primary-color 표현을 그대로 사용하되 content
  boundary는 HomeTab과 같은 `max-w-md md:max-w-5xl`을 사용한다.
- Season Matching과 Post Match current workflow는 `지난 기록`과 같은 HomeTab content boundary를 사용한다. 모바일은
  single column, PC는 request/ACTIVE/result 본문과 2인실 flow help를 지난 기록과 같은
  `1.35fr : 0.8fr` main/supporting 2열로 나눈다. Off Season과 Season Open은 history archive를 기본
  surface로 사용하고 모바일에서 요약→기록 순서, PC에서 기록 본문→archive summary의 two-pane로 같은
  DOM을 재배치한다. 별도 policy action rail은 추가하지 않는다.
- loading/error/denied/four-season state는 동일 header frame과 single-flow content boundary를 사용한다.
- current/past와 sent/received는 APG manual-activation tab이다. Arrow/Home/End는 focus만 옮기고
  Enter/Space/click만 panel selection을 바꾼다. `OFF_SEASON`과 `SEASON_OPEN`은 정보 우선순위상
  past를 기본 선택해 history를 읽고, 그 밖의 상태는 explicit past selection에서만 읽는다.
- 운영 campus에 current season이 없는 `OFF_SEASON`과 운영 override `OFF_SEASON`은 overview를
  history-only surface로 연다. 이때 current request/active relation은 빈 snapshot이며 모든 match mutation은
  닫힌다. 비운영 campus만 `CAMPUS_NOT_OPERATED` unavailable surface를 사용한다.
- request expiry는 screen reader에 매 초 숫자를 알리지 않고 day/hour/expired threshold가 바뀔 때만
  polite 안내를 갱신한다. canonical matching은 auto-rotating banner를 만들지 않으며 interaction
  transition은 `motion-reduce`에서 최소화한다.
- canonical Storybook responsive matrix는 `matchingMobile320`, `matchingMobile360`,
  `matchingMobile390`, `matchingMobile430`, `matchingDesktop1280`, `matchingDesktop1440` viewport와
  active progress, history long-copy/tombstone story를 함께 사용한다. request card의 reflow는 production
  component test에서 검증하고 별도 정책 시나리오로 분리하지 않는다.

## Visual presentation boundary

- canonical shell은 `model/matching-shell-presentation.ts`의 `neutral`, `progress`, `action`,
  `success`, `caution` semantic role만 사용한다. 이 role은 정책/action authorization이나 local score를
  계산하지 않고, 이미 확정된 `MatchingViewState`와 shell consistency를 읽는 presentation mapping이다.
- `MatchingTabHeader`는 공통 `MainTabHeaderFrame` 안에서 legacy 2인실 identity header만 표현한다.
  Off Season의 보조 archive summary는 history response 집계만 표현하고 action이나 새로운 정책 상태를
  합성하지 않는다. 정책 설명은 실제 action/result owner 가까이에 있는 safe copy로 제공한다.
- `components/pair`는 legacy 2인실의 header, section tab, request tab/count badge, request card,
  active match card, empty state 표현을 production view model props로 추출한다. 현재/과거 활동 이력은
  같은 `MatchingActivityLedger` 행·자동 종료 disclosure 문법을 사용한다. legacy story/mock type, group
  token, local score 계산은 import하지 않는다.
- `MatchingCurrentPolicyGate`는 Off Season, Season Open, registration capability gate의
  current 안내를 같은 legacy pair empty-state 문법으로 표현한다. 시즌과 등록 여부는 server-owned state/reason을
  presentation으로만 변환하며 별도 FE 권한을 만들지 않는다.
- `PairMatchingFlowTipCard`는 disclosure·원형 인물 bubble·겹침·규칙 list를 조합한 production 2인실
  component다. 3인실 group type/contract는 가져오지 않고 request quota, 공식 5일/기숙사 마감, 수락 즉시
  ACTIVE 및 다른 pending request 종료 원칙을 설명한다. 사용자가 매칭 요청 전 생활 습관을 확인할 수
  있도록 `채팅 → 요청 → 수락 → 매칭 확정` 순서의 세로 bubble flow를 사용하며, 채팅 action 자체는
  계속 chat owner의 `canStartChat` capability를 따른다. Season Matching ACTIVE는
  `채팅 → 공식 일정 → 학교 홈페이지 호실 선택`을 안내한다. Post Match는 호실 선택이 이미 끝난 phase이므로
  matched result에는 `상대 프로필 재확인 → 입실 준비`, no-match result에는 `활동 확인 → 다음 시즌 준비`를
  안내하고 신규 요청 규칙을 반복하지 않는다.
- `MatchingTabHeader`와 request segment는 Legacy `Baseline/Current`의 identity-first blue header,
  request-management control, received-count circle을 production DTO에 이식한 visual base다. viewer
  header는 Main dashboard가 준 display-only identity만 읽고, pending badge는 overview의 pending received
  request만 표시한다. visual pulse/press feedback은 `motion-reduce`에서 멈춘다.
- Off Season과 Season Open도 같은 legacy blue identity header와 section tab을 사용하며 `지난 기록`을 기본 선택한다.
  Off Season header는 HomeTab과 같이 시즌 기숙사 대신 성별·캠퍼스 맥락만 표시하고, Season Open은 현재
  시즌 등록 맥락을 유지한다. history는 legacy accordion 정보 계층을 사용하되 내용은
  `GET /api/matches/history` 응답만 표시한다. Season Open의 `현재 매칭`은 시즌 등록 완료와 매칭 기간
  대기만 안내하고 요청·응답 action을 합성하지 않는다.
- request/active/history inner card와 overlay의 visual redesign은 feature-local component에 남긴다.
  `RoommateSummaryCard`처럼 다른 owner의 action card를 import하지 않고 public summary, score visibility,
  action capability를 current matching view model 그대로 소비한다.

## Navigation, contract, and design-review boundary

- `MatchingNavigationIntent`는 `home | roommate | chat | history`의 화면 안내 intent다. match request,
  accept/reject/unmatch command가 아니며, `history`는 feature 내부 section 전환으로 끝난다. 나머지는
  Main이 기존 tab owner로만 연결한다.
- request/active card는 shared `counterpartSummary`, `scoreVisible`, optional note, server action capability를
  그대로 소비한다. current activity는 overview에 추가된 public projection만 사용하며 FE가 terminal
  reason이나 active relation을 다시 결합해 lifecycle을 추측하지 않는다.
- request profile detail은 RoommateTab의 `RoommateProfileDetailDialog`와 pending request CTA를 그대로
  사용한다. feature별 context 설명 문구를 detail action card에 주입하지 않고, 보낸 요청은 응답 대기,
  받은 요청은 요청 관리로 돌아가는 동작 자체로 상태를 설명한다.
- canonical Storybook에는 fixed `serverNow`, 320/360/390/430/1280/1440 review viewport, long-copy 및
  keyboard/overflow 점검 조건을 `matchingDesignReview` metadata로 남긴다.

Canonical Storybook은 deterministic state workshop을 위해 `MatchingTabView`를 사용하며, 실제 BFF
fetch/identity reset 경계는 `MatchingTab.test.tsx`와 `useMatchingOverview.test.tsx`가 검증한다.
Canonical scenario namespace는 `Off Season`, `Season Open`, `Season Matching`, `Post Match`, `System`으로
분리한다. request/active/history data variant는 별도 `Runtime/*` component story가 아니라 해당 정책 시즌
화면에 배치한다. Off Season은 RoommateTab과 같은 nested taxonomy인 `Policy`, `History`,
`History/Profile`로, Season Open은 `Policy`, `History`로 나눈다. Season Matching은
`Current/No Match`, `Current/Matched`, `Action/Accept`, `Action/Reject`, `Action/Cancel`, `Action/Profile`,
`Action/Unmatch`, `History`, `Policy`로 나누고, Post Match는 `Active`, `Activity`, `History`, `Policy`로
나눈다. Post Match `Active`는 matched/no-match 결과와 current activity를 함께 보여주고, `Activity`와
`History`에는 각각 철회 사용자의 이번 시즌 활동과 종료 시즌 이력을 한 시나리오씩 둔다. `Policy`는
Post Match에서 신규 등록이 닫힌 미등록 상태만 담당한다. 중복된 `Archive` variant와 score degradation을
정상 사용자 시나리오처럼 보이게 하는 `Score Hidden Result`는 canonical story에서 제외한다. story label은
English domain phrase만 사용한다.

Season Matching의 기본 section은 `현재 매칭`이다. overview가 `canViewMatching=true`를 반환한 등록 완료
viewer만 request/active relation을 읽고, `VIEWER_NOT_REGISTERED` 등 server-owned capability gate는 current
section을 fail-closed한다. 이 gating은 과거 종료 시즌 기록의 소유권을 바꾸지 않으므로 `지난 기록`은
`GET /api/matches/history`와 Chat owner의 시즌 통계를 동일하게 조합한다.
Season Matching current는 `지난 기록`과 같은 HomeTab 폭을 사용한다. PC에서는 request/ACTIVE 본문과
2인실 flow tip을 main/supporting 2열로 배치하고, 모바일에서는 작은 disclosure 안내를 본문 위에 쌓는다.

## Pair request management

- `matching-request-view.ts`는 overview의 pending sent/received 배열을 그대로 보존하고 표시용 quota,
  score/note/detail exposure만 파생한다. terminal request는 `overview.activity`가 소유하므로 요청 관리에
  중복 렌더링하지 않는다. 받은 요청 UI는 원본 배열을 변경하지 않은 복사본에서 `expiresAt` 기준
  `만료일순` 또는 공개된 `matchScore` 기준 `매칭도순`을 적용한다. 비공개 점수는 매칭도순의 마지막에
  두고 동률은 API canonical 순서를 유지한다. action authorization은 정렬과 무관하게 server decision만 쓴다.
- `accept`/`reject`/`cancel`은 각각의 server decision을 사용한다. accept precondition이 stale이어도
  cleanup action인 reject/cancel까지 함께 비활성화하지 않으며, 공통 disabled reason을 FE에서 합성하지 않는다.
- `PairRequestSection`은 manual-activation APG tabs와 request card/dialog orchestration을 소유한다.
  pending row의 action은 shared action capability만 따른다.
- 요청 생성 시점에는 양쪽 등록·동일 기숙사·프로필 완성·매칭 기간·room selection window가 검증된다.
  이후 수락 시점에는 같은 조건과 live active relation을 transaction에서 다시 검사한다. 따라서 정상 pending
  요청은 공개 점수와 수락/거절을 제공하고, 이후 상태가 바뀐 경우에만 수락이 닫히거나 command가
  `MATCHING_API_STATE_CHANGED`로 최신 overview를 다시 읽는다. 거절/취소는 stale relation을 정리하는 cleanup
  action이므로 등록이나 수락 precondition이 바뀌어도 pending row에서는 계속 허용한다.
- request card는 solid white surface에 `방향·상태 → 상대 identity/점수 → 요청 메시지 → 요청일·대화 상태·기한
→ action` 순서로 구성한다. 공개 프로필 요약과 자기소개는 상세 프로필이 소유하고 request card에서 중복
  렌더링하지 않는다. contract에 없는 `NEW`를 animation으로 추측하지 않으며, received는
  violet accent와 수락 primary action, sent는 sky accent와 neutral 요청 취소 action을 사용한다.
- current `activeMatch`가 존재하면 확정 관계가 화면의 primary owner이므로 요청 관리 section은 렌더링하지
  않는다. 자동 종료된 request 결과는 바로 아래 활동 이력에서 확인한다.
- `useMatchingActions`는 동일 action/request 중복 제출을 막고 success/stale 모두 overview를 다시
  읽는다. optimistic request merge나 raw upstream message 노출은 허용하지 않는다.
- expiry/cutoff는 API `serverNow`와 monotonic elapsed 기반의 user-facing 안내다. 시간이 0이 되어도
  FE가 action 가능 여부를 변경하지 않고 서버 응답과 authoritative refetch에 수렴한다.
- request detail은 summary의 `detailEntryToken`이 있을 때만 roommate-search public detail owner를
  재사용한다. token은 authorization이 아니며 detail owner가 요청 시점 정책을 다시 검증한다.
- request card는 채팅 CTA를 중복 제공하지 않고 `canStartChat`·`hasActiveChatThread`를 대화 상태
  metadata로만 표시한다. 채팅 진입은 확정 매칭 카드와 roommate-search의 명시적인 chat owner에서
  제공하며, matching은 thread 상태를 임의로 다시 판정하지 않는다.

## Current active match and mutual unmatch

- overview의 `activeMatch`와 active GET은 current `ACTIVE` relation만 반환한다. terminal
  `UNMATCHED` relation은 active card로 복원하지 않고 overview의 compact activity event로만 제공하며,
  mutual unmatch action response 뒤 authoritative overview refetch에 수렴한다.
- `matching-active-view.ts`는 public counterpart summary, score exposure, result-read, chat action과
  unmatch capability를 표시 모델로 변환한다. optional/불일치 projection은 detail·score·chat을
  fail-closed하며 nickname fallback만 유지한다.
- active profile detail은 request의 `detailEntryToken`을 재사용하지 않는다. `/api/profiles/:userId`를
  token 없이 호출하고 API가 current `MATCHED_PARTNER` result-read 관계와 visibility를 다시 검증한다.
  FULL 응답은 request/history profile CTA와 같은 `RoommateProfileDetailDialog`를 사용해 profile hero,
  공개 가능한 compatibility를 표시한다. active pair 행동은 card가 소유하므로 상세에는 action section을
  만들지 않고, TOMBSTONE/error는 같은 safe fallback으로 닫는다.
- active card는 emerald를 매칭 완료 pill과 icon에만 사용하고 관계 identity, 매칭일, 호실 선택 일정,
  시즌 종료 일정, chat/profile action, 접힌 매칭 관리 순서로 읽는다. 일정은 overview의
  `roomSelectionDate`와 `seasonEndDate`를 사용해 History 관계와 같은 3단 bubble로 표시하고 FE가 날짜를
  추정하지 않는다. chat/profile action은 PC와 mobile 모두 세로로 쌓으며 chat은 연한 emerald tone을
  사용한다. `WAITING_FOR_ME`는 violet, 내가 먼저 요청한 `WAITING_FOR_COUNTERPART`는 sky 외곽선과 매칭
  관리 header만 사용해 중복 알림을 만들지 않는다. 매칭 관리는 header와 detail이 하나의 surface에서
  확장되고 응답 기한 대신 요청 주체별 대화 안내를 표시하며,
  `ROOM_SELECTION_CUTOFF` 이후에는 section 자체를 렌더링하지 않는다.
- mutual unmatch는 `0/2`, 내가 요청한 `1/2`, 상대가 요청한 `1/2`, action response의 `2/2`를
  구분한다. request/cancel은 relation 단위로 충돌 잠금하고 success/stale 이후 overview를 다시 읽는다.
- action이 닫힌 이유는 `unmatchProgress.disabledReason`이 소유한다. FE는 season, cutoff,
  `availableUntil`로 authorization을 재판정하지 않는다.
- `SEASON_POST_MATCH`는 같은 active result card의 read-only 변형을 사용하며 unmatch control을
  생성하지 않는다. profile/chat은 각 owner capability가 열린 경우에만 유지한다. current surface는
  Season Matching과 같은 HomeTab 폭과 main/supporting column을 사용하고 Post Match 안내를 supporting
  pane에 둔다. 요청 관리는 항상 숨기고, active relation이 있으면 PairMatchCard 다음에 activity를,
  없으면 별도 no-match 결과 card 없이 activity만 표시한다.
- score는 viewer/counterpart의 season lifestyle projection을 모두 해석할 수 있을 때 API가 계산한다.
  정상 등록과 ACTIVE 생성 precondition을 통과한 관계에서는 공개 score가 기본이며, score hidden은 legacy
  incomplete row, profile redaction/de-identification, schema drift 또는 data repair 중 projection을 만들 수 없는
  방어적 degradation이다. 제품 fallback은 유지하되 canonical Post Match 사용자 시나리오로 분류하지 않는다.

## De-registration read boundary

- 시즌 참여 철회는 `SEASON_OPEN`, `SEASON_MATCHING`에서만 가능하고 live `ACTIVE` 관계가 없어야 한다.
  `SEASON_POST_MATCH`에서는 새 철회 action을 열지 않는다. 이미 철회한 참여자가 Post Match로 진입하는
  조합은 가능하지만 ACTIVE와 철회 상태를 동시에 구성하지 않는다.
- API는 current season participant row가 남은 withdrawn viewer를 `VIEWER_DEREGISTERED`로 명시하고,
  request/active action surface는 닫은 채 viewer-owned terminal `activity`를 유지한다. Web은 이 reason을
  전용 `deregistered` read state로 변환해 full request summary와 active/profile/score는 렌더링하지 않고
  compact activity projection만 소비한다. participant가 없거나 OFF_SEASON restricted 조기 분기를 타는
  경우에는 API owner가 빈 overview를 반환한다.
- Season Open 철회는 요청 기간 전이라 Activity section을 만들지 않고 참여 종료 gate만 보여준다.
  Season Matching/Post Match 철회는 철회 전에 종료된 요청을 read-only activity로 보여준다. ended-season `GET /api/matches/history`에는 진행 중
  시즌을 섞지 않으며, 종료 시즌 이력은 현재 `participationIntent`가 아니라 `registeredAt`을 기준으로
  등록 완료 이력을 판별한다. 따라서 이후 철회한 시즌도 지난 기록에 남고, 최종 match row가 없으면
  `NO_MATCH`로 집계된다. 철회 action 자체는 history event가 아니며, 철회로 종료된 pending request가 있을
  때만 해당 request가 `WITHDRAWN_PARTICIPANT` terminal activity로 남는다.

## Current season activity

- `GET /api/matches/overview.activity`는 current season의 terminal request와 active/ended relation을
  과거→최근 순서로 반환한다. 이는 종료 시즌 archive가 아니라 request/`ActiveMatch` source row를 같은
  serializable read에서 축소한 projection이다.
- 현재 매칭의 `요청 관리`는 pending 요청만 유지하고 바로 아래 `활동 이력`에 요청 거절·취소·만료,
  매칭 완료·매칭 후 해제를 표시한다. 같은 시각에는 매칭 완료가 자동 종료 group보다 먼저 온다.
- 자동 종료는 public `systemCancellationCause`와 `systemCancellationGroupId`만 사용한다.
  `VIEWER_MATCHED`는 causal active match 단위로 1건이어도 disclosure를 만들고,
  `COUNTERPART_MATCHED`, 참여 취소, 조건 불충족은 서로 합치지 않은 개별 disclosure로 표시한다.
- current와 past는 `MatchingActivityLedger`를 공유해 icon, tone, compact metadata, detail row가 같다.
  current activity가 비면 요청 관리 empty state처럼 별도 card background 없이 icon과 안내만 제공하고
  탐색 CTA를 만들지 않는다.

## Ended-season history

- past history는 `GET /api/matches/history`의 season ordering을 그대로 표시하고, 더 보기는 받은
  season group을 3개씩 여는 client-side reveal이다. cursor/page API를 합성하지 않는다.
- `sentRequestCount`/`receivedRequestCount`는 요청 종료 event 수가 아니라 시즌 안에서 중복을 제거한
  counterpart 수다. UI는 각각 `보낸 요청 상대`, `받은 요청 상대`와 `명` 단위로 표현한다.
- 시즌 card의 세 번째 통계는 Chat owner의 `GET /api/chat/conversation-stats`가 반환하는
  `conversationUserCount`를 `대화한 상대`와 `명` 단위로 표현한다. Match history contract에 chat
  aggregate를 중복 추가하지 않고 Web composition에서 `seasonId`로 결합하며, 통계를 읽지 못하면
  event 수로 대체하지 않고 `—`로 닫는다.
- Off Season의 `전체 시즌 요약`은 참여 시즌·매칭 완료·매칭 미성사만 집계한다. `NO_MATCH`와
  `UNMATCHED_AFTER_SUCCESS`는 최종 상대가 없다는 동일한 product outcome으로 `매칭 미성사` pill에
  합치되, 실제 해제 event는 개별 timeline에서 `매칭 후 해제`로 유지한다. 시즌별로
  중복 제거된 보낸/받은 요청 상대 수는 전체 고유 상대 수로 오해할 수 있으므로 개별 시즌 card에만
  표시한다. 개별 기록은 result icon/color tone과 함께 시간 순 타임라인으로 표시한다.
- timeline pill은 history contract를 그대로 좁혀 `요청 거절`, `요청 취소`, `요청 자동 종료`,
  `요청 만료`, `매칭 완료`, `매칭 후 해제`를 사용한다. 특히
  `CANCELLED_BY_SYSTEM_ACTIVE_MATCH`는 상대가 직접 취소한 것처럼 보이지 않도록 `요청 자동 종료`와
  중립적인 설명으로 표시한다. `VIEWER_MATCHED`는 같은 `systemCancellationGroupId`끼리만 “내 매칭
  확정으로 종료된 요청”으로 묶고, `COUNTERPART_MATCHED`는 상대 매칭 확정에 따른 개별 요청 종료로
  표시한다. 원인 필드가 없는 기존 row는 timestamp만으로 묶지 않는다.
- timeline card는 `stage + result pill`, 단일 headline, compact date를 기본 정보 계층으로 사용한다.
  headline과 같은 의미의 설명 및 `방향 · 날짜 종류` metadata는 반복하지 않는다. 자동 종료 원인이나
  매칭 해제 사유처럼 headline만으로 손실되는 정책 정보만 보조 문구로 남긴다.
- 기록이 없을 때는 archive icon, 제목과 `이전에 참여한 시즌의 매칭 활동 이력을 확인할 수 있어요.`
  안내만 제공하며 결과를 예고하는 pill은 만들지 않는다.

### History state color mapping

| Surface       | Contract state                                           | UI label       | Tone    | 의미                                                            |
| ------------- | -------------------------------------------------------- | -------------- | ------- | --------------------------------------------------------------- |
| Season result | `MATCHED_SUCCESS`                                        | 매칭 완료      | emerald | 시즌 종료 시 최종 매칭 상대가 있음                              |
| Season result | `NO_MATCH`, `UNMATCHED_AFTER_SUCCESS`                    | 매칭 미성사    | slate   | 시즌 종료 시 최종 매칭 상대가 없음                              |
| Timeline      | `REQUEST_REJECTED`                                       | 요청 거절      | rose    | 받은/보낸 요청이 거절로 종료됨                                  |
| Timeline      | `REQUEST_CANCELLED` + requester cancellation             | 요청 취소      | blue    | 요청자가 직접 요청을 취소함                                     |
| Timeline      | `REQUEST_CANCELLED` + `CANCELLED_BY_SYSTEM_ACTIVE_MATCH` | 요청 자동 종료 | blue    | 다른 active match 확정으로 시스템이 요청을 종료함               |
| Timeline      | `REQUEST_EXPIRED`                                        | 요청 만료      | slate   | 응답 기한 만료로 요청이 종료됨                                  |
| Timeline      | `MATCHED_SUCCESS`                                        | 매칭 완료      | emerald | 당시 최종 매칭이 성사됨                                         |
| Timeline      | `UNMATCHED_AFTER_SUCCESS`                                | 매칭 후 해제   | violet  | 성사 이후 해제된 historical event이며 season result 경고가 아님 |

- history API는 종료된 이전 시즌만 반환한다. overview의 current activity와 read-only active result를
  past history에 병합하지 않으며, current activity를 `SeasonMatchHistoryEntry`로 가장하지 않는다.
- 과거 상대 상세는 `MATCHED_SUCCESS` entry의 entry-id route만 사용한다. `UNMATCHED_AFTER_SUCCESS`와
  request terminal row는 summary-only이며 generic profile route로 우회하지 않는다.
- 과거 상대 상세는 RoommateTab의 `RoommateProfileDetailDialog`와 profile anatomy를 재사용한다.
  FULL에는 materialized `matchScore`, versioned public compatibility, 과거 profile snapshot만 표시한다.
  compatibility가 없거나 지원하지 않는 버전이면 현재 profile로 재계산하지 않고 세부 적합도만 생략한다.
  tombstone에는 score나 full profile snapshot을 보강하지 않는다.

## Chat ownership boundary

ChatTab은 `/api/chat/threads` BFF와 `@repo/shared/chat` contract만 사용한다. 매칭 확정·해제와
request lifecycle action은 canonical MatchingTab만 소유하며, ChatTab은 thread의 `status`,
`canSendMessage`, `canReport` capability를 다시 판정하거나 프로필/매칭도 fallback으로 보강하지 않는다.
