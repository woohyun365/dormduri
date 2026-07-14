# MatchingTab runtime boundary

## Canonical entry

- Product runtime entry는 `MatchingTab.tsx` 하나다.
- `Main.tsx`는 `viewerId`, dashboard의 최소 season shell(`id`, `state`), badge callback만 전달한다.
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

## Legacy baseline

Phase 0 redesign-before 화면은 `__stories__/legacy/LegacyMatchingTabBaseline.tsx`에 격리되어 있다.
이는 Storybook/test-only comparison surface이며 product import graph와 canonical correctness 근거가
아니다. 출시되지 않은 group variant는 `Baseline/Legacy/UnsupportedGroup` namespace에서만 유지한다.
Canonical runtime Storybook은 deterministic state workshop을 위해 `MatchingTabView`를 사용하며,
실제 BFF fetch/identity reset 경계는 `MatchingTab.test.tsx`와 `useMatchingOverview.test.tsx`가 검증한다.

## Remaining compatibility debt

`useMainMatchingState`와 `main/legacy/matchingLegacyClient.ts`는 ChatTab compatibility를 위해 남아 있다.
Canonical MatchingTab은 이를 import하지 않으며 Chat owner migration에서 제거한다.
