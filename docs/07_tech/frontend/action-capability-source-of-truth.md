# 사용자 action capability source of truth

이 문서는 MatchingTab, HomeTab, RoommateTab에서 `draft`, `registered`, `actionable`을 혼동하지 않고 API가 계산한 action capability를 Web/BFF까지 일관되게 전달하는 기준이다. 화면 노출 가능 여부와 mutation 가능 여부를 분리하고, 최종 권한은 transaction 내부 재검증이 소유한다.

## 문제 정의

기존 구현에는 다음 세 종류의 drift가 있었다.

1. Matching overview와 Home 집계가 `SeasonParticipant` row, `registeredAt`, 기숙사 배정, profile 중 일부만 보고 시즌 등록 완료로 해석할 수 있었다.
2. `GET /api/matches/overview`, `GET /api/matches/requests`, Home dashboard가 요청 action을 서로 다른 방식으로 만들었다.
3. Roommate public profile의 `canRequestMatch`가 기본 공개 정책만 반영하고 pending request, 전역 pending 한도, 방향별 횟수 제한, pair cooldown 같은 실제 생성 transaction 전제조건을 충분히 투영하지 못했다.

이 상태에서는 같은 사용자가 화면마다 다른 CTA를 보거나, CTA가 활성화되어 있지만 mutation이 즉시 stale/precondition 오류로 닫히는 비율이 불필요하게 높아질 수 있다.

## 상태 의미

| 상태         | 의미                                                                                                  | action 판단에 사용                        |
| ------------ | ----------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `draft`      | participant row나 profile/기숙사 선택의 일부가 저장된 편집 중 상태                                    | 아니요. 입력 복원과 등록 진행 UI에만 사용 |
| `registered` | 시즌 등록 aggregate가 완료되어 저장 증거가 일치하는 상태                                              | coarse gate로 사용                        |
| `actionable` | 현재 시각, 시즌 상태, 호실 선택 마감, active relation, 요청별 제한까지 통과한 특정 action의 가능 상태 | CTA의 직접 source of truth                |

`draft`는 `registered`가 아니며, `registered`만으로 모든 action이 가능한 것도 아니다.

## Canonical registration aggregate

현재 시즌의 등록 완료는 다음 조건을 함께 만족해야 한다.

- `participationIntent = REGISTERED`
- `registeredAt` 존재
- `dormitorySelectionState = ASSIGNED` 및 `dormitoryId` 존재
- participant가 `WITHDRAWN`, `EXPIRED`, deactivated, admin-hidden 상태가 아님
- user가 삭제되지 않음
- 필수 시즌 profile 필드가 모두 존재
- 해당 participant의 `SEASON_REGISTRATION` profile-history snapshot이 존재하고 redaction되지 않음

런타임 단일 row 판정은 `season-participant-status.policy.ts`를 사용하고, DB aggregate는 `registration-complete-participant.prisma-policy.ts`와 registration snapshot participant id 집합을 함께 사용한다. Snapshot은 등록 당시 상태가 실제로 확정됐다는 영속 증거이며, live row의 부분 필드를 대신하지 않는다.

`CurrentSeasonParticipationViewQuery`는 겉으로 완료된 것처럼 보이는 live row라도 profile 또는 registration snapshot이 없으면 등록 완료로 내보내지 않는다. 이 상태에서 draft write를 계속 허용해 손상된 aggregate를 덮어쓰는 대신 integrity/stale 경계로 닫는다.

## Match API capability

### Overview가 현재 요청 read model을 소유한다

`GET /api/matches/overview`는 하나의 DB `now`와 serializable read 안에서 다음 데이터를 구성한다.

- current season metadata와 overview read gate
- 보낸 요청·받은 요청
- active match
- current activity
- 각 request action의 server-owned decision

`GET /api/matches/requests`는 별도 capability를 계산하지 않고 `MatchOverviewQuery`의 request rows를 합쳐 반환한다. Home dashboard도 현재 요청을 직접 조회하지 않고 같은 overview projection을 소비한다.

따라서 동일 request row의 action은 MatchingTab, 요청 목록 API, HomeTab에서 동일하다.

### Action별 decision

요청 action은 공통 `disabledReason` 하나가 아니라 action별 decision으로 전달한다.

```ts
actions: {
  accept: {
    allowed: boolean;
    reason: MatchActionDisabledReason | null;
  }
  reject: {
    allowed: boolean;
    reason: MatchActionDisabledReason | null;
  }
  cancel: {
    allowed: boolean;
    reason: MatchActionDisabledReason | null;
  }
}
```

이 구조가 필요한 이유는 action의 전제조건이 다르기 때문이다.

- `accept`: 양쪽 canonical registration, complete profile, registration snapshot, 동일 기숙사, 시즌 매칭 기간, 호실 선택 마감, active relation 부재를 요구한다.
- `reject`: 받은 pending 요청을 정리하는 action이므로 accept precondition이 stale이어도 허용한다.
- `cancel`: 보낸 pending 요청을 정리하는 action이므로 등록/시즌 action window가 닫혀도 허용한다.
- terminal request: 세 action 모두 닫고 `REQUEST_EXPIRED` 또는 `REQUEST_ALREADY_RESOLVED`를 제공한다.

Read capability projector는 transaction precondition을 가능한 범위까지 미러링하지만 권한 자체는 아니다. 수락 직전 다른 사용자가 매칭을 확정하는 race처럼 read 이후 변한 상태는 mutation transaction의 lock 이후 재검증이 최종 판정한다. Web은 mutation success와 stale failure 모두 authoritative overview refetch로 수렴한다.

## HomeTab 정렬

Home dashboard의 시즌 통계는 registration snapshot participant id 집합과 canonical registration DB predicate를 함께 사용한다.

- 전체/기숙사별 참여자와 매칭 집계가 `registeredAt` 하나만으로 draft row를 포함하지 않는다.
- active match 집계는 양쪽 participant가 canonical registration aggregate를 만족하는 관계만 센다.
- 종료 시즌 참여 이력은 현재 live status가 아니라 `SEASON_REGISTRATION` snapshot 존재를 기준으로 한다. 이후 탈퇴·만료되었더라도 실제 참여했던 시즌은 history에서 사라지지 않는다.
- 최근 받은 요청은 Match overview를 재사용하므로 Home에서 request action capability를 다시 계산하지 않는다.
- current-user public capability도 season registration snapshot과 현재 시즌/기숙사 cutoff/active match를 반영하며 더 이상 `canRequestMatch`, `canStartChat`을 상수로 반환하지 않는다.

Home BFF와 client는 이 값을 표시용으로 소비할 뿐 등록 또는 요청 가능 여부를 다시 합성하지 않는다.

## RoommateTab 정렬

Roommate 검색에서 **목록을 볼 수 있음**과 **해당 상대에게 요청할 수 있음**은 다른 정책이다.

- 미등록 사용자가 same-building scope를 선택하고 registration gate 또는 empty state를 보는 기존 UX는 유지한다.
- profile 공개 정책은 canonical registration snapshot을 viewer와 target 모두에 적용한다.
- public detail의 기본 `canRequestMatch`가 열린 뒤, Roommate search read model이 요청 생성 전제조건을 추가 투영한다.

추가 preflight 사유는 다음과 같다.

| 사유                                      | 의미                                                               |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `MATCH_REQUEST_ALREADY_PENDING`           | 해당 상대와 이미 pending 요청이 존재                               |
| `MATCH_REQUEST_PENDING_LIMIT_REACHED`     | viewer의 보낸 pending 요청 전역 한도 도달                          |
| `MATCH_REQUEST_DIRECTION_LIMIT_REACHED`   | 같은 방향의 요청 횟수 제한 도달                                    |
| `MATCH_REQUEST_DIRECTION_COOLDOWN_ACTIVE` | 동일 pair·방향 terminal request 또는 관계 종료 후 cooldown 진행 중 |

우선순위는 `이미 pending → 전역 pending 한도 → 방향별 횟수 제한 → cooldown`이다. 첫 번째 actionable blocker를 CTA copy에 사용하되 기존 공개/등록/시즌 제한 사유는 보존한다. Bookmark와 chat capability는 match request 전용 quota 때문에 함께 닫지 않는다.

Roommate 검색 후보 범위와 manifest는 탐색 정책을 소유하고, mutation transaction은 요청 생성 직전에 동일 pair·한도·cooldown·active match 상태를 다시 검증한다.

## BFF와 FE 책임

BFF는 다음 책임만 가진다.

- 인증 cookie와 allowlist header를 upstream으로 전달
- shared request/response schema 검증
- upstream 오류를 안전한 Web 응답으로 변환

BFF가 registration 또는 action capability를 다시 계산하면 API와 시각 차이가 생기므로 금지한다.

FE는 다음 원칙을 따른다.

- CTA enabled/disabled는 API의 action별 `allowed`를 그대로 사용한다.
- 제한 안내는 같은 decision의 `reason`을 user-facing copy로 매핑한다.
- countdown이 0이 되었다는 이유만으로 local capability를 변경하지 않는다.
- Home/Matching shell의 season mismatch는 refetch 또는 safe partial state로 닫고 local season을 합성하지 않는다.
- Roommate search는 서버가 내려준 `unavailableReasons`를 설명하되 자체 quota/cooldown 계산을 만들지 않는다.
- Roommate 상세 화면은 검색 row의 pair-specific preflight와 detail API의 최신 기본 공개 capability를 교차 적용한다. 어느 한쪽이라도 action을 닫으면 CTA를 다시 열지 않으며, 검색에서 닫힌 요청 CTA가 상세 진입 후 되살아나지 않는다.

## 주요 구현 위치

| 책임                                  | 구현 위치                                                                                           |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| canonical registration row policy     | `apps/api/src/season-participants/policies/registration-complete-participant.prisma-policy.ts`      |
| current participation aggregate       | `apps/api/src/season-participants/application/current-season-participation-view.query.ts`           |
| Match overview                        | `apps/api/src/matches/overview/match-overview.query.ts`                                             |
| request action projector              | `apps/api/src/matches/requests/presenters/match-request-actions.presenter.ts`                       |
| request list delegation               | `apps/api/src/matches/requests/queries/list-current-season-requests.query.ts`                       |
| Home aggregate/overview reuse         | `apps/api/src/home-dashboard/application/home-dashboard-counts.query.ts`, `home-dashboard.query.ts` |
| Roommate request preflight projection | `apps/api/src/roommate-search/integration/roommate-search.reader.ts`                                |
| request metadata reader               | `apps/api/src/matches/requests/queries/match-request-search-metadata.query.ts`                      |
| shared contracts                      | `packages/shared/src/match/contract/summary.ts`, `packages/shared/src/profile/contract/public.ts`   |
| Matching FE decision mapping          | `apps/web/src/main/tabs/matching/model/matching-request-view.ts`                                    |
| Roommate FE reason mapping            | `apps/web/src/main/tabs/roommate-list/model/actions/roommateActionReasonCopy.ts`                    |

## 검증 기준

- 부분 participant row는 Matching overview나 Home 등록 집계에 포함되지 않는다.
- registration snapshot이 없는 viewer/target은 public match action이 fail-closed한다.
- accept가 stale precondition으로 닫혀도 reject는 계속 가능하다.
- 보낸 pending 요청은 cancel 가능하다.
- overview와 request list가 같은 action decision을 반환한다.
- Home recent request가 overview action decision을 유지한다.
- Roommate CTA가 pending/quota/direction limit/cooldown을 각각 공개 사유로 표현한다.
- BFF와 FE는 capability를 재판정하지 않고 shared schema를 통과한 값을 사용한다.

## 남는 경계

Capability 응답은 조회 시점의 preflight 결과다. 분산된 두 요청 사이의 race, 만료 sweep과 mutation의 경합, block/withdrawal의 동시 변경은 read API만으로 제거할 수 없다. 이 경우 transaction이 user-safe stale/precondition 오류로 닫고 client가 최신 overview 또는 search result를 다시 읽는 것이 정상 동작이다.
