# 매칭 라이프사이클 정책

## 문서 범위

이 문서는 2인실 기준의 매칭 점수 계산, match request 상태 전이, 확정/해제, 북마크, 리스트 표현을 다룬다. 채팅 thread 생성/아카이브/쓰기 권한은 [chat-lifecycle.md](./chat-lifecycle.md)에서 정의하고, 3인실 그룹 매칭은 [group-matching-lifecycle.md](./group-matching-lifecycle.md)에서 별도로 다룬다.

- 시즌 참여자 등록의 의미와 등록 상태: [season-participation.md](./season-participation.md)

이 문서가 **매칭 상태와 리스트 표현의 최종 소유 문서**다.

## 호환도 계산

### 비교 구조

| 비교 유형             | 개수  | 내용                                     |
| --------------------- | ----- | ---------------------------------------- |
| 행동 ↔ 조건 교차 비교 | 8쌍   | 상대 행동이 내 조건에 맞는지 양방향 계산 |
| 행동 ↔ 특성 교차 비교 | 1쌍   | `sleepHabit` ↔ `noiseSensitivity`        |
| 유사도 비교           | 4필드 | 동일 필드 간 거리/일치도 계산            |

### 행동 ↔ 조건 8쌍

| 행동 필드           | 조건 필드               |
| ------------------- | ----------------------- |
| `smokingBehavior`   | `smokingTolerance`      |
| `phoneBehavior`     | `phoneTolerance`        |
| `earphoneUsage`     | `earphoneExpectation`   |
| `sleepEnvironment`  | `sleepEnvPreference`    |
| `screenUsage`       | `screenTolerance`       |
| `indoorEating`      | `indoorEatingTolerance` |
| `cleanLevel`        | `cleanExpectation`      |
| `drinkingFrequency` | `drinkingTolerance`     |

### 유사도 비교 4필드

| 필드                     | 원칙                           |
| ------------------------ | ------------------------------ |
| `bedtime`                | 시간대 거리                    |
| `wakeTime`               | 시간대 거리, `FLEXIBLE`은 중립 |
| `relationshipStyle`      | 일치/불일치                    |
| `temperatureSensitivity` | 거리 기반                      |

### viewer 기준 점수 해석

사용자 surface의 canonical match score는 항상 `perspectiveScore(viewer, target)` 하나만 사용한다.
즉, 점수는 **viewer 기준 단방향 점수**이며 `min(A→B, B→A)` 공통점수는 사용자 노출 기준으로 사용하지 않는다.

점수 행렬, 정규화 공식, 예외 처리(FLEXIBLE 등)의 구체적 알고리즘은 [matching-algorithm.md](./matching-algorithm.md)를 참조한다.

### 점수 노출 capability 처리 (2레이어)

**1차: UI/도메인 capability 게이팅** — 조건/프로필 완성도에 따라 `scoreVisible`을 분기한다.

| capability             | 조건                                              | 표시                               | 설명                         |
| ---------------------- | ------------------------------------------------- | ---------------------------------- | ---------------------------- |
| `scoreVisible = true`  | viewer와 target 모두 complete season profile 보유 | `perspectiveScore(viewer, target)` | viewer 기준 단방향 정상 점수 |
| `scoreVisible = false` | 위 전제 중 하나라도 미충족                        | 잠금                               | 점수 비노출                  |

`perspectiveScore(A, B)`는 A의 조건/특성으로 B의 행동/패턴을 평가한다. 현재 시즌 search/detail/active match surface에서는 **viewer/target 모두 complete season profile**이고 해당 owner가 `scoreVisible = true`로 판단할 때만 이 점수를 생성/노출한다. 과거 match history detail은 현재 profile로 재계산하지 않고, history materialization 시점에 저장된 `SeasonMatchHistoryEntry.matchScore` snapshot을 viewer 기준 과거 점수로 노출할 수 있다.

**2차: 알고리즘 안전장치** — 만약 null이 알고리즘에 도달하면 해당 Pair는 dynamicMax에서 제외된다 (분자·분모 모두 빠짐). 정상 플로우에서는 UI 게이팅이 먼저 걸러 null이 도달하지 않으며, 이는 방어적 안전장치이다.

### 가중치

| 등급 | 가중치 | 예시                                                 |
| ---- | ------ | ---------------------------------------------------- |
| T1   | 5      | 흡연, 잠버릇↔잠귀                                    |
| T2   | 3      | 통화, 이어폰, 온도 민감도, 취침 소리 환경, 취침 화면 |
| T3   | 2      | 청결, 음주, 취침 시간, 실내 취식                     |
| T4   | 1      | 기상 시간, 관계 스타일                               |

### 표현 원칙

| 항목      | 정책                                                                  |
| --------- | --------------------------------------------------------------------- |
| 빨강      | 사용하지 않음 (부정적 인상 최소화)                                    |
| 음주 필드 | 점수에는 반영, 상세 표시에서는 제외. 쌍별 점수도 비노출 (역추론 방지) |

### 색상 2계층

#### 1계층: 매칭도 뱃지 (UserCard, 홈 매칭 카드)

전체 매칭도 점수 기반 4단계.

| 등급      | 점수   | 색상         | 의미                        |
| --------- | ------ | ------------ | --------------------------- |
| excellent | 85%+   | 초록 (green) | 핵심 갈등 없음              |
| good      | 70~84% | 파랑 (blue)  | 일부 차이, 대화로 조율 가능 |
| fair      | 50~69% | 하늘 (sky)   | 주의 필요, 갈등 요소 존재   |
| low       | <50%   | 회색 (gray)  | 갈등 다수                   |

임계값 설계 근거: T1=5(2쌍=10점), T2=3(5쌍=15점), dynamicMax=35. T1 쌍 1개 0점 시 -14% → 86%(good 경계). T1+T2 복합 0점 시 ~69%(fair).

#### 2계층-A: 항목별 비교 (Compatibility Axis)

상대 생활패턴과 viewer의 원하는 룸메 조건을 1:1로 비교한 항목별 점수 기반 4단계. 시간대처럼 인접한 한 칸 차이(예: 67점)와 통화·미디어 70점 조합은 수용 가능하더라도 실제 생활 조율이 필요하므로 `medium`으로 표현한다. 항목별 `high`는 71점 이상으로 두어 70점 이하의 부분 수용 조합과 구분한다.

| 레벨             | 점수   | 색상                     | 의미                      |
| ---------------- | ------ | ------------------------ | ------------------------- |
| high             | 71%+   | emerald-600 / emerald-50 | 잘 맞아요                 |
| medium           | 50~70% | sky-500 / sky-50         | 괜찮을 수 있어요          |
| low              | <50%   | amber-600 / amber-50     | 주의                      |
| unknown/disabled | —      | gray-500 / gray-50       | 비활성 (게이팅/null 필드) |

#### 2계층-B: 축별/레이더 비교 (Compatibility Dimension)

여러 항목을 묶은 축별 점수와 레이더 차트는 항목별 표현보다 조금 더 보수적으로 4단계를 나눈다. 전체 매칭도 뱃지의 85/70/50 임계값은 변경하지 않는다.

축별 묶음은 사용자에게 해석되는 생활 흐름 기준으로 구성한다. 레이더는 8개 축(Octagon)으로 고정하여 `흡연 → 수면리듬 → 잠버릇 → 수면환경 → 소음기기 → 청소루틴 → 체온성향 → 친밀도` 순서로 읽히게 한다. `SLEEP_HABIT`은 잠버릇과 viewer의 잠귀 민감도만 다루고, `SLEEP_ENVIRONMENT`는 잠들 때 화면·스피커 사용으로 좁힌다. 온도 민감도는 청소·취식에서 분리해 에어컨/난방 기준을 독립적으로 판단한다. Dimension id와 axis id가 같은 문자열을 공유할 수 있으나 Contract에서는 `dimensions[].id`와 `axes[].id` 위치로 구분한다.

| Dimension id         | 사용자-facing 축 | 포함 axis                           |
| -------------------- | ---------------- | ----------------------------------- |
| `SMOKING`            | 흡연             | `SMOKING`                           |
| `SLEEP_RHYTHM`       | 수면리듬         | `BEDTIME`, `WAKE_TIME`              |
| `SLEEP_HABIT`        | 잠버릇           | `SLEEP_HABIT`                       |
| `SLEEP_ENVIRONMENT`  | 수면환경         | `SCREEN_USAGE`, `SLEEP_ENVIRONMENT` |
| `DEVICE_USAGE`       | 소음기기         | `PHONE`, `EARPHONE`                 |
| `CLEAN_SPACE`        | 청소루틴         | `CLEAN_LEVEL`, `INDOOR_EATING`      |
| `TEMPERATURE`        | 체온성향         | `TEMPERATURE`                       |
| `RELATIONSHIP_STYLE` | 친밀도           | `RELATIONSHIP`                      |

| 레벨             | 점수   | 색상                     | 의미                      |
| ---------------- | ------ | ------------------------ | ------------------------- |
| high             | 70%+   | emerald-600 / emerald-50 | 잘 맞아요                 |
| medium           | 50~69% | sky-500 / sky-50         | 괜찮을 수 있어요          |
| low              | <50%   | amber-600 / amber-50     | 주의                      |
| unknown/disabled | —      | gray-500 / gray-50       | 비활성 (게이팅/null 필드) |

## 북마크

북마크는 `social-safety/bookmarks`가 소유하는 viewer-private saved candidate relation이다. 매칭 상태 머신 자체가 아니며, match request/chat 생성 권한을 열지 않는다.

| 항목               | 정책                                                                                                                                                                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 성격               | 비공개 저장. 상대에게 알리지 않음                                                                                                                                                                                                        |
| owner              | `social-safety/bookmarks`                                                                                                                                                                                                                |
| 상한               | 무제한. abuse/운영 지표가 필요하면 후속 제한 가능                                                                                                                                                                                        |
| create/delete 허용 | `SEASON_OPEN` 또는 `SEASON_MATCHING`, viewer/target registration 완료, 같은 dormitory, target detail-viewable, `actions.canBookmark=true`                                                                                                |
| create/delete 금지 | `OFF_SEASON`, `SEASON_POST_MATCH`, viewer/target 미등록, 다른 dormitory, viewer 이미 매칭 확정, target 이미 매칭 확정, 기숙사별 `roomSelectionDate` 이후 action-closed, hidden/deactivated/withdrawn/expired/deleted/deidentified target |
| list 의미          | 현재 viewer가 저장한 active bookmark 중 현재 public target으로 노출 가능한 candidate list                                                                                                                                                |
| list 제외/degrade  | target `hiddenByAdminAt`, `deactivatedAt`, `participantStatus WITHDRAWN/EXPIRED`, `user.deletedAt`, deidentified, registration/profile/snapshot invalid                                                                                  |
| 정렬               | `RECENT` 기본. `MATCH_SCORE`는 visible target subset에만 적용하는 선택 정렬                                                                                                                                                              |
| empty metadata     | active bookmark가 없거나 모두 제외되면 empty bookmark list와 `emptyState` metadata 제공                                                                                                                                                  |
| block side-effect  | block create 시 양방향 active bookmark 제거. unblock 시 bookmark 자동 복원 금지                                                                                                                                                          |
| 시즌 종료          | 캠퍼스 `seasonEndDate` 이후 active bookmark expire/sweep                                                                                                                                                                                 |
| 상대 매칭 확정 후  | 신규 bookmark 불가. 기존 bookmark 표시는 list 제외/degrade 또는 history owner 정책을 따른다                                                                                                                                              |
| 본인 매칭 확정 후  | 신규 bookmark 불가, 기존 결과 열람만 가능                                                                                                                                                                                                |

## 상태 전이

### 2인실 상태 전이도

```text
[탐색/프로필 surface] ──매칭 신청(+선택 note)──→ [PENDING] ──수락──→ [ACTIVE]
                                            │                    │
                                            ├─ 5일/`roomSelectionDate` 만료 → EXPIRED
                                            ├─ 거절 ───────────────────────→ REJECTED
                                            └─ 발신 취소 ─────────────────→ CANCELLED

[ACTIVE] ──상호 합의 해제 또는 관리자 개입──→ [UNMATCHED]
```

### 핵심 해석

- 매칭 요청과 대화는 **완전 분리**한다.
- `PENDING`은 match request 상태이고, 채팅 상태를 의미하지 않는다.
- 수신자가 request를 수락하면 곧바로 `ACTIVE`가 된다.
- 채팅 UI는 match request 생성 surface가 아니며, match request는 **대화방 선행 조건 없이 허용된 프로필/탐색/상세 surface**에서 생성한다.

### 터미널 상태별 재교류 규칙

> 재교류 규칙은 **캠퍼스 시즌 단위**로 적용된다. 같은 방향(A→B) request는 `seasonEndDate` 전까지 누적 생성 5회, terminal 진입 후 cooldown 2일을 따른다. A→B와 B→A는 서로 독립된 direction으로 계산한다.

| 터미널 상태 | 출발      | 같은 방향 재신청                    | 역방향 신청 |
| ----------- | --------- | ----------------------------------- | ----------- |
| `EXPIRED`   | `PENDING` | 가능 (2일 cooldown + 방향별 5회 내) | 가능        |
| `REJECTED`  | `PENDING` | 가능 (2일 cooldown + 방향별 5회 내) | 가능        |
| `CANCELLED` | `PENDING` | 가능 (2일 cooldown + 방향별 5회 내) | 가능        |
| `UNMATCHED` | `ACTIVE`  | 가능 (2일 cooldown + 방향별 5회 내) | 가능        |

### 차단 시 전이 (오케스트레이션)

차단은 매칭 상태 머신 외부에서 처리한다. 차단 핸들러가 request 취소/종료 명령을 호출해 상태 전이를 유발하고, 열린 채팅방 정리는 [chat-lifecycle.md](./chat-lifecycle.md)와 [community-safety.md](./community-safety.md)에서 처리한다.

| 차단 시점 상태 | 처리                    | 상대에게 보이는 것           |
| -------------- | ----------------------- | ---------------------------- |
| `PENDING`      | 자동 취소 (`CANCELLED`) | `요청 종료` 수준의 중립 표현 |
| `ACTIVE`       | **차단 불가**           | —                            |

### 자발적 이탈 시 전이

| 보유 상태 | 처리                                                                                                  |
| --------- | ----------------------------------------------------------------------------------------------------- |
| `ACTIVE`  | **이탈 불가**. `UNMATCHED` 또는 관리자 개입 선행 필요                                                 |
| `PENDING` | 자동 취소 (`CANCELLED`)                                                                               |
| 관계 없음 | same-dormitory/actionable 리스트 제거. `CAMPUS_MERGED` summary browse는 미등록 viewer와 동일하게 유지 |

## 신청 플로우

```text
허용된 summary/detail/action capability surface
  → 매칭 신청
  → PENDING
  → 수락 시 ACTIVE
```

### request 생성 원칙

| 항목                    | 정책                                                                            |
| ----------------------- | ------------------------------------------------------------------------------- |
| 생성 surface            | 대화방 선행 조건 없이 `actions.canRequestMatch = true`인 summary/detail surface |
| 채팅 UI                 | request 생성 surface가 아님                                                     |
| 동시 pending request    | 사용자당 3건                                                                    |
| same pair live pending  | 최대 1건                                                                        |
| request 만료            | 5일 또는 기숙사별 `roomSelectionDate` 도달 시점 중 먼저 오는 시점               |
| cooldown                | `CANCELLED / REJECTED / EXPIRED / UNMATCHED` 후 2일                             |
| 방향별 요청 생성 횟수   | 같은 시즌, 같은 방향 기준 5회                                                   |
| 방향별 횟수 reset       | 캠퍼스 `seasonEndDate`                                                          |
| next season 재요청      | 허용                                                                            |
| request note            | 선택, max 100자                                                                 |
| request note moderation | 저장 전 사전 moderation                                                         |
| 거절 방식               | 버튼 중심, 사유 입력 없음                                                       |

### 요청 surface 추적

`MatchRequestChannel`은 match request 정책의 canonical source가 아니므로 #195에서 제거한다. 요청 발생 surface/funnel 분석이 필요하면 core `MatchRequest` row가 아니라 별도 analytics/event log 후속 이슈에서 다룬다.

### confirmation 원칙

- 발신 전 확인 단계와 수락 전 확인 단계를 모두 둔다.
- 수락 dialog에는 **수락 즉시 ACTIVE**, **다른 pending request 종료**, **다른 conversation read-only/archive** 결과를 함께 고지한다.

### 수락 시점 precondition 재검증

Match request 수락은 request 생성 당시의 capability snapshot만 신뢰하지 않는다. 수락 시점에도 requester와 receiver 모두 아래 조건을 다시 만족해야 한다.

- current season이 존재하고 `SEASON_MATCHING`이며 해당 기숙사 `roomSelectionDate` 전이다.
- 양쪽 모두 registration complete 상태다: `REGISTERED + ASSIGNED + registeredAt + complete season profile + SEASON_REGISTRATION snapshot`.
- 양쪽 모두 같은 캠퍼스/성별/기숙사 action cohort이며 hidden/deactivated/deleted/withdrawn 상태가 아니다.
- 어느 한쪽이라도 상태가 terminal하게 invalid해졌으면 pending request는 stale로 보고 fail-closed 처리한다. Participant visibility/registration/profile snapshot/dormitory/season cutoff invalid처럼 request 자체가 더 이상 성립하지 않는 경우에는 `CANCELLED_BY_SYSTEM + MATCH_PRECONDITION_FAILED`로 닫는다. 자발적 철회/decline은 기존처럼 `WITHDRAWN_PARTICIPANT`를 사용하고, 일시적인 actor 권한 오류는 accept 요청 error로 닫는다.

### request 수신 화면 최소 정보셋

direct match request 수신 화면은 수신자가 수락/거절 전 최소한 아래 정보를 확인할 수 있어야 한다.

| 항목          | 정책                                                                                |
| ------------- | ----------------------------------------------------------------------------------- |
| 프로필 요약   | [roommate-searching.md](./roommate-searching.md)의 summary card projection을 재사용 |
| 매칭점수      | `scoreVisible = true`일 때 현재 매칭도/호환성 점수를 함께 제공                      |
| optional note | 값이 있을 때 함께 노출. request payload이며 profile field가 아님                    |
| `채팅하기`    | chat owner capability가 허용할 때만 제공                                            |

즉, direct request 수신 화면의 contract는 **`summary projection + score capability + optional note + chat capability`**다. Exact summary field set은 [roommate-searching.md](./roommate-searching.md)가 user-facing owner이고, field source/non-exposure 원칙은 [profile-model.md](./profile-model.md)를 따른다. `messageToRoommate`는 request 수신 화면의 profile field가 아니다.

## 채팅과의 관계

채팅 가능 여부는 매칭 가능 여부와 같은 것이 아니다.

| 축               | owner                                    | 설명                                            |
| ---------------- | ---------------------------------------- | ----------------------------------------------- |
| matchability     | 이 문서                                  | 매칭 요청/수락이 가능한가                       |
| chat eligibility | [chat-lifecycle.md](./chat-lifecycle.md) | 새 대화를 시작하거나 기존 thread에 쓸 수 있는가 |

즉, 제한 공개 browse가 가능하더라도 곧바로 매칭 요청이나 채팅이 가능해지는 것은 아니다.

| 항목                                  | 정책                                                |
| ------------------------------------- | --------------------------------------------------- |
| prior chat requirement                | 없음                                                |
| `쪽지보내기` 의미                     | 채팅 UI 진입                                        |
| thread 생성 시점                      | 첫 메시지 전송 시                                   |
| pending request 중 채팅               | 허용                                                |
| open conversation 존재 시 request CTA | profile surface에서 독립 노출                       |
| ACTIVE 생성 시 기존 thread            | 있으면 matched chat으로 승격                        |
| ACTIVE 생성 시 thread 없음            | 첫 post-match 메시지 전송 시 matched chat lazy 생성 |
| ACTIVE 생성 시 다른 conversation      | read-only/archive                                   |

채팅방 구조와 close reason/visibility는 [chat-lifecycle.md](./chat-lifecycle.md)가 소유한다.

## 매칭 확정과 해제

| 항목                                | 정책                                  |
| ----------------------------------- | ------------------------------------- |
| 확정 시점                           | request 수락 즉시                     |
| 확정 후 상태                        | `ACTIVE`                              |
| ACTIVE 생성 시 다른 pending request | 모두 system cancel                    |
| ACTIVE 생성 시 다른 conversation    | read-only/archive                     |
| 해제 방식                           | 상호 합의 해제 또는 관리자 개입       |
| 사용자 unilateral 복구              | 별도 두지 않음                        |
| 해제 후 상태                        | `UNMATCHED`                           |
| 해제 후 재요청                      | 2일 cooldown + 방향별 5회 내에서 가능 |

### 상호 합의 해제 요청 플로우

| 단계                        | 정책                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 해제 요청 대상              | **이번 시즌의 현재 `ACTIVE` 관계만** 대상                                                                  |
| 요청 방식                   | 각 사용자가 현재 `ACTIVE` 관계에 대해 개별 `매칭 취소 요청`을 남긴다                                       |
| 한쪽만 요청한 상태          | `ACTIVE`는 유지되고, 일방의 요청만으로는 해제되지 않는다                                                   |
| 요청 철회                   | 상대가 아직 요청하지 않았다면 본인 요청은 철회할 수 있다                                                   |
| 해제 확정 시점              | 양쪽 요청이 모두 모이면 즉시 `UNMATCHED`                                                                   |
| 허용 기간                   | pair가 속한 기숙사의 `roomSelectionDate` 전까지만 허용                                                     |
| `roomSelectionDate` 경과 후 | 한쪽만 남아 있던 해제 요청은 더 이상 `UNMATCHED`를 만들지 못하며, 결과는 `ACTIVE` 유지가 우선한다          |
| 현재 관계 progress 노출     | current `ACTIVE` 관계 조회는 `0/2`, `1/2`, `2/2(완료)`에 해당하는 상호 합의 진행 상태를 함께 제공해야 한다 |

### history / 집계 원칙

- `ACTIVE`에 도달한 관계는 **성공 매칭 이력**으로 영속 보존한다.
- 이후 상호 합의 해제로 `UNMATCHED`가 되면, 같은 relation row는 `endReason = UNMATCHED_BY_MUTUAL_CONSENT`를 기록한다.
- 따라서 집계는 최소 아래 둘을 모두 구분할 수 있어야 한다.
  - `ACTIVE` 도달 수
  - `ACTIVE` 도달 후 `UNMATCHED` 된 수
- 이후 같은 pair가 다시 매칭 성공하더라도 **새로운 `ActiveMatch` 이력**으로 기록한다. 즉, `매칭 성공 → 해제 → 재매칭 성공`은 서로 다른 두 success 이력이다.

### success 해석

| 층위                                  | 기준                                                                                                                                                                               |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 운영 지표                             | `ACTIVE` 도달                                                                                                                                                                      |
| 사용자-facing 시즌 결과               | `seasonEndDate` 시점의 past-season snapshot success                                                                                                                                |
| 사용자-facing 과거 counterpart detail | 최종 매칭 상대(`MATCHED_SUCCESS`)만 허용. `UNMATCHED_AFTER_SUCCESS`는 “매칭 후 해제된 이력” summary로만 남기고 counterpart final detail을 열지 않음                                |
| 사용자-facing 과거 counterpart score  | `MATCHED_SUCCESS` final counterpart detail에서만 `SeasonMatchHistoryEntry.matchScore` snapshot을 노출. 현재 profile로 재계산하지 않으며 tombstone detail에는 score를 포함하지 않음 |

### ActiveMatch lifecycle event log

`ActiveMatchLifecycleEvent`는 `ActiveMatch` relation의 상태 전이를 설명하기 위한 운영/audit/debug trace다. 사용자-facing current match, history, score, chat capability의 source of truth는 계속 `ActiveMatch`, `ActiveMatchUnmatchRequest`, `SeasonMatchHistoryEntry`, chat domain source row다. Event log를 replay해서 `ActiveMatch` current state나 `SeasonMatchHistoryEntry`를 rebuild하지 않으며, event sourcing/CQRS로 해석하지 않는다.

| 항목                       | 정책                                                                                                                              |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| source of truth            | `ActiveMatch` current-state row가 active relation의 사용자-facing truth다. Event row는 상태 전이의 설명/감사/디버깅 trace다.      |
| append boundary            | 상태 mutation owner가 같은 Prisma transaction 안에서 event를 append한다. mutation rollback 시 event도 남지 않아야 한다.           |
| append 실패                | Audit event append 실패는 해당 state transition 실패로 처리한다. best-effort background logging으로 분리하지 않는다.              |
| relation 단위              | event aggregate는 `ActiveMatch` relation-level 1 row per lifecycle event다. participant별 중복 event row를 만들지 않는다.         |
| user-facing history와 관계 | `SeasonMatchHistoryEntry`는 사용자-facing season history/read model이고, lifecycle event는 internal operations/audit trace다.     |
| retention/read path        | 운영 조회 convenience를 위한 trace이며, 일반 match/history API response나 roommate search capability 계산에 직접 사용하지 않는다. |

권장 event taxonomy와 append point:

| eventType                   | reason                           | actorType            | append point                                                        | source id                |
| --------------------------- | -------------------------------- | -------------------- | ------------------------------------------------------------------- | ------------------------ |
| `ACTIVE_CREATED`            | `MATCH_REQUEST_ACCEPTED`         | `USER`               | match request accept transaction에서 `activeMatch.create` 성공 후   | `sourceMatchRequestId`   |
| `UNMATCH_REQUESTED`         | `USER_REQUESTED_UNMATCH`         | `USER`               | pending unmatch request 생성 후                                     | `sourceUnmatchRequestId` |
| `UNMATCH_REQUEST_CANCELLED` | `USER_CANCELLED_UNMATCH_REQUEST` | `USER`               | viewer pending unmatch request cancel update 후                     | `sourceUnmatchRequestId` |
| `UNMATCH_REQUEST_EXPIRED`   | `ROOM_SELECTION_CUTOFF`          | `SYSTEM`             | roomSelectionDate cutoff sweep가 pending request를 expire 처리한 후 | `sourceUnmatchRequestId` |
| `UNMATCHED`                 | `MUTUAL_UNMATCH_CONSENT`         | `USER`               | 양쪽 pending 충족 후 `ActiveMatch.status = UNMATCHED` update 후     | null                     |
| `SEASON_ENDED`              | `SEASON_ENDED_SWEEP`             | `SYSTEM`             | season-end sweep가 `ActiveMatch.status = SEASON_ENDED` update 후    | null                     |
| `ADMIN_ENDED`               | `ADMIN_ACTION`                   | `ADMIN`              | future admin owner가 active match를 종료할 때                       | null                     |
| `PARTICIPANT_WITHDRAWN`     | `WITHDRAWN_PARTICIPANT`          | `SYSTEM` 또는 `USER` | future withdrawal owner가 active match를 종료할 때                  | null                     |

Metadata는 작은 allowlist snapshot만 허용한다. 허용 후보는 `transitionOwner`, `previousStatus`, `nextStatus`, `previousEndReason`, `nextEndReason`, `previousEndedAt`, `nextEndedAt`, `requestStatus`, `unmatchRequestStatus`, `expiredUnmatchRequestCount`, `canceledPendingMatchRequests`, `chatMatchedThreadUpdated`, `chatDirectThreadsMarkedReadOnly`, `chatDirectThreadsReopened`, `seasonState`, `roomSelectionDate`다.

금지 payload: `MatchRequest.note` 원문, profile/lifestyle raw body, chat message body/retained body/vault payload, email/token/provider access token/phone number, raw request/response body, stack trace, raw Prisma error, internal audit payload, user-facing full identity snapshot. Unknown metadata key는 저장하지 않는다.

## 리스트 표현

### 상태별 리스트 원칙

| 상태                                            | 리스트 표현                    |
| ----------------------------------------------- | ------------------------------ |
| 탐색 가능                                       | 일반 카드                      |
| terminal request (`EXPIRED/REJECTED/CANCELLED`) | 비활성 카드 + `요청 종료` 뱃지 |
| `ACTIVE`                                        | 하단 정렬 + `매칭 완료` 카드   |
| `UNMATCHED`                                     | 비활성 카드 + `매칭 해제` 뱃지 |
| 차단 (Block)                                    | 양방향 리스트 제거             |

> system-cancel된 pending request는 리스트에서는 `요청 종료`처럼 중립적으로 표시하고, 상세에서는 `다른 매칭 완료로 종료` 같은 원인을 설명할 수 있다.

### 매칭 완료 유저

| 항목             | 정책                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 완전 제거        | 하지 않음                                                                                                                                                                                                                                                                                                                                                                          |
| 리스트 위치      | 하단 정렬                                                                                                                                                                                                                                                                                                                                                                          |
| 프로필 열람      | 현재 active matched 상대는 `MATCHED_PARTNER` result-read detail/score 가능. 과거 history detail은 최종 매칭 상대(`MATCHED_SUCCESS`)만 가능하고, `UNMATCHED_AFTER_SUCCESS`는 summary history만 가능. `GENERAL` target은 summary-only exposure + action-closed. 단, target account deletion/de-identification이 발생하면 user-facing full detail보다 tombstone/minimal result가 우선 |
| 새로운 매칭 신청 | 불가                                                                                                                                                                                                                                                                                                                                                                               |
| 필터             | `매칭 가능한 유저만 보기` 제공                                                                                                                                                                                                                                                                                                                                                     |

여기서 `GENERAL` target은 public target cohort 중 viewer의 matched partner가 아닌 registration complete participant를 뜻한다. `summary-only`는 detail/score 노출이 닫힌 exposure level이고, read-only/result-read는 이미 형성된 match result나 thread/history를 읽는 맥락이다. Active matched viewer도 `CAMPUS_MERGED` summary browse와 `SAME_BUILDING_ONLY` summary list를 볼 수 있지만, 둘 다 신규 후보 action surface가 아니므로 카드 CTA는 닫고 단일 안내 pill로 action-closed 상태를 설명한다.

## 자발적 이탈

| 항목             | 정책                                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| 방식             | 시즌 참여 철회(de-registration) action                                                                               |
| 이탈 시 처리     | 미결 request 취소 + 열린 비매칭 conversation 정리 + same-dormitory/actionable 리스트 제거                            |
| terminal reason  | request/history는 `WITHDRAWN_PARTICIPANT`, thread는 `PARTICIPANT_WITHDRAWN` 계열 reason 사용                         |
| 확인 단계        | 결과 사전 고지 dialog                                                                                                |
| 복귀             | 같은 시즌 재참여 불가. 단, registration 완료 target의 `CAMPUS_MERGED` summary browse는 미등록 viewer와 동일하게 허용 |
| 자동 비활성      | 두지 않음                                                                                                            |
| `ACTIVE` 보유 시 | 사용자 직접 철회 불가. `UNMATCHED` 또는 관리자 개입 후에만 별도 처리                                                 |

## Current matching overview read contract

현재 시즌의 보낸/받은 request와 `ACTIVE` relation은 하나의 current overview read로 제공한다.
overview는 history나 group projection을 포함하지 않으며, 둘은 각각의 owner/read path에서 별도로 읽는다.

| 항목                  | 계약                                                                                                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 시간 기준             | API가 기록한 `serverNow`를 응답한다. FE는 countdown 표시에는 사용할 수 있지만 action 허용을 재판정하지 않는다.                                                                                |
| season                | `id`, canonical four-season `state`, viewer 기숙사의 `roomSelectionDate`를 함께 제공한다.                                                                                                     |
| capability            | current matching surface를 읽을 수 있는지와 public reason만 제공한다. 내부 moderation/audit 사유는 노출하지 않는다.                                                                           |
| request rows          | sent/received를 분리하고 각 row에 `canAccept`/`canReject`/`canCancel` 및 단일 public disabled reason을 제공한다.                                                                              |
| active relation       | current `ACTIVE` result와 unmatch progress만 제공한다. `SEASON_POST_MATCH`에서는 result를 유지하되 request/unmatch action은 닫힌다.                                                           |
| ordering / pagination | current-season request는 `createdAt DESC, id DESC`의 안정 순서로 전부 반환한다. pending 동시 상한이 작고 terminal row도 current state 설명에 필요하므로 이 read에는 pagination을 두지 않는다. |
| consistency           | due pending request 정리, request row, active relation은 한 serializable read snapshot에서 읽는다. mutation 직후 FE는 optimistic merge 대신 overview를 다시 읽는다.                           |

overview DTO는 public summary/score visibility allowlist만 재사용한다. hidden, deactivated,
withdrawn, deleted, deidentified target과 raw audit/moderation payload는 current overview의
새 source로 노출하지 않으며, stale action은 다음 overview snapshot의 capability/reason으로 설명한다.

## 기숙사별 매칭 종료

- 캠퍼스 시즌은 `SEASON_OPEN` → `SEASON_MATCHING` → `SEASON_POST_MATCH` → `OFF_SEASON`으로 진행된다.
- 실제 **매칭 가능 종료일**은 사용자가 속한 기숙사의 `roomSelectionDate`를 따른다.
- `roomSelectionDate` 이후에는 신규 match request 생성과 비매칭 대화 쓰기가 종료된다.
- `ACTIVE` 관계는 `seasonEndDate` 전까지 결과 확인 대상으로 유지된다.
- matched pair thread는 `SEASON_POST_MATCH`에서도 `seasonEndDate` 전까지 write를 유지한다.
- 반면 **상호 합의 해제 요청은 `SEASON_MATCHING` + `roomSelectionDate` 전까지만** 허용된다. 즉 `ACTIVE` 관계가 `SEASON_POST_MATCH`까지 유지되더라도 unmatch capability는 다시 열리지 않는다.
- thread leave/hide는 match request나 active relation 종료와 다르며, OPEN/READ_ONLY thread의 사용자별 가시성 제어로 다룬다.

상태별 자동 정리:

- `PENDING` → 자동 취소
- 비매칭 thread → read-only/archive
- `ACTIVE` → 관계는 `seasonEndDate` 전까지 유지
- matched pair thread → `seasonEndDate`까지 write 유지, 이후 read-only, 다음 시즌 current season 오픈 시 archive

따라서 `roomSelectionDate` 이후에는 신규 매칭 형성 행위가 종료되지만, `SEASON_POST_MATCH` 동안 확정 결과 확인은 계속 가능하다. matched pair 채팅은 `seasonEndDate` 전까지 계속 이어질 수 있고, `seasonEndDate` 이후 read-only가 되며, 다음 시즌 current season 오픈 시 archive된다.

## 사용자 차단 (Block)

사용자가 특정 상대를 자발적으로 차단하는 기능. 신고/제재([incident-enforcement.md](./incident-enforcement.md))와는 독립적인 행위이다.

### 차단 정의

| 항목                   | 정책                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| 효과                   | **양방향 리스트 제거**: 내가 차단 → 내 리스트에서 상대 비노출 + 상대 리스트에서도 나 비노출 |
| 매칭 요청              | 양방향 원천 차단                                                                            |
| 상대 고지              | **알리지 않음**                                                                             |
| 해제                   | 언제든 가능 (설정 → 차단 관리)                                                              |
| 상한                   | 무제한                                                                                      |
| 시즌 리셋              | **리셋 안 함**                                                                              |
| 비시즌 / 비운영 캠퍼스 | 가능                                                                                        |

### 차단 시 진행 중 관계 처리

| 상태                       | 처리                                         | 상대에게 보이는 것             |
| -------------------------- | -------------------------------------------- | ------------------------------ |
| `PENDING` 요청 (보낸/받은) | 자동 취소                                    | `요청 종료` 수준의 중립 표현   |
| 열린 비매칭 thread         | 즉시 이용 불가 / read-only 처리              | 차단 사실은 직접 노출하지 않음 |
| `ACTIVE`                   | **차단 불가**. 신고/관리자 분리 후 차단 가능 | —                              |

### 차단과 다른 시스템의 독립성

| 시스템                  | 차단/해제의 영향                                      |
| ----------------------- | ----------------------------------------------------- |
| 방향별 요청 생성 5회    | **영향 없음**. 차단 전 소진된 횟수는 해제 후에도 유지 |
| 2일 cooldown            | **영향 없음**                                         |
| 북마크                  | 차단 시 양방향 자동 제거. 해제 시 복원 안 됨          |
| 신고                    | **독립적 행위**. 차단해도 자동 신고 아님              |
| 동시 pending 슬롯 (3건) | `PENDING` 자동 취소로 슬롯 회복                       |

## 3인실 그룹 매칭

3인실 매칭의 전체 정책은 [group-matching-lifecycle.md](./group-matching-lifecycle.md)를 참조한다. 이 문서(matching-lifecycle.md)는 **2인실 전용**이다.

## 건물 변경과 매칭 상태

| 항목                   | 정책                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| 시즌 매칭 중 건물 변경 | registration 전에는 해당 dormitory `roomSelectionDate` 전까지 변경 가능. registration 후에는 잠김 |
| 오입력 수정            | registration 전 사용자가 직접 변경. registration 후에는 관리자 처리                               |
| 관리자 처리 시 관계    | 기존 관계를 수동 정리                                                                             |

## 매칭 참여 자격

매칭 관련 기능(매칭 신청, 수락, 해제, 결과 확인)은 아래 조건을 모두 충족해야 사용할 수 있다.

| 조건                   | 설명                                                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 회원가입 완료          | 이메일 인증 + 기본 정보 입력                                                                                                                           |
| 운영 캠퍼스            | `campus.isOperated = true` (현재 CHUNCHEON만 해당)                                                                                                     |
| current season         | 시즌이 열려 있고 사용자용 current season이 존재                                                                                                        |
| 시즌 registration 완료 | `REGISTERED + ASSIGNED + registeredAt + complete season profile + registration snapshot`                                                               |
| 기숙사 선택 확정       | registration 전 selection draft(`SELECTED + dormitoryId`)만으로는 부족하며, registration finalize에서 saved valid selection이 `ASSIGNED`로 확정된 상태 |
| 시즌 상태              | 실제 match request/수락은 `SEASON_MATCHING` + 해당 기숙사 `roomSelectionDate` 전에서만 허용                                                            |
| safety/visibility      | deleted/deactivated/hidden participant는 match action 불가                                                                                             |

상세 자격 정책은 [access-eligibility.md](./access-eligibility.md)를, 등록/노출/대화와의 관계는 [season-participation.md](./season-participation.md)를 참조한다.

## Match history RRPD 보존 경계

과거 match history는 survivor의 결과 확인을 위해 event fact를 유지할 수 있지만, viewer/counterpart의 생활패턴·조건·점수 계산용 sensitive snapshot은 계정 삭제/비식별화 이후 hot row에 full payload로 남기지 않는다. 삭제 사용자가 viewer였는지 counterpart였는지에 따라 `SeasonMatchHistoryEntryRetentionLink(subjectRole = VIEWER | COUNTERPART)`를 만들고, 원문 payload는 `RetainedVaultObject(target = MATCH_HISTORY_ENTRY)`로 이동한다.

사용자-facing history summary는 season/result/date와 `탈퇴한 사용자` label을 유지할 수 있다. Deleted/de-identified counterpart detail은 retained vault 복원 없이 tombstone detail로 degrade한다. Tombstone detail은 “탈퇴한 사용자”와 조회 불가 사유만 제공하며 `matchScore`를 포함하지 않는다. Lifestyle/condition snapshot은 operation disclosure 대상일 수 있으나 일반 match/history API, roommate search, chat action capability 계산에는 재사용하지 않는다. Chat thread closure reason/closedAt과 conversation 여부/count는 chat domain source(`ConversationThread`, chat API, realtime event)의 책임이며 `SeasonMatchHistoryEntry` hot row나 match history retained payload에 중복 저장하지 않는다. 단, 삭제/비식별되지 않은 `MATCHED_SUCCESS` final counterpart full detail은 `SeasonMatchHistoryEntry.matchScore` snapshot만 viewer 기준 과거 score로 노출할 수 있다.

## 변경 이력

> Superseded note: 아래 변경 이력의 legacy 용어(`UserProfile`, base profile, `messageToRoommate`, `LIMITED/FULL`, `full/gated`, 자동 `UNASSIGNED` 등)는 historical record다. 현재 정책은 이 문서의 본문과 최신 변경 이력 행을 따른다.

| 날짜       | 변경 내용                                                                                                                                                                                                                                                                                                                                                                               | 관련 이슈                |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 2026-07-14 | current matching overview를 sent/received request와 active relation의 single snapshot read로 정의하고, public capability/action-disabled reason, serverNow, stable current-row ordering, history/group 분리, mutation 후 refetch 및 internal audit/target raw data 비노출 경계를 추가했다                                                                                               | Web MatchingTab refactor |
| 2026-03-14 | 매칭 참여 자격 섹션 추가                                                                                                                                                                                                                                                                                                                                                                | #135                     |
| 2026-03-17 | 재신청 규칙 시즌 단위 적용 명문화: 시즌 종료 시 차단 이력/시도 횟수 초기화                                                                                                                                                                                                                                                                                                              | #151                     |
| 2026-03-17 | 재신청 규칙 횟수 해석 명확화: "총 시도 수 3회" → "같은 방향 시도 수 3회". 방향별 독립 카운팅, 요청 생성이 1회(터미널 상태 무관)                                                                                                                                                                                                                                                         | #151                     |
| 2026-03-18 | nightStudyLocation→nightStudyLight, nightStudyTolerance→nightLightTolerance 리프레이밍. 가중치 스왑: temperature T4→T2, nightStudy T2→T3, indoorEating T3→T4                                                                                                                                                                                                                            | #152                     |
| 2026-03-19 | Phase D: 조건 선택화(음주만 필수) — 조건 미입력 시 해당 Pair dynamicMax 제외. 음주(drinkingFrequency, drinkingTolerance) 가입 시 고정, 비시즌 1회 변경                                                                                                                                                                                                                                  | #157                     |
| 2026-03-19 | Phase C: indoorEating을 유사도 비교(TYPE D)에서 교차 비교(TYPE B)로 변경. indoorEatingTolerance 추가. 교차 비교 7→8쌍, 유사도 5→4필드. indoorEating T4→T3                                                                                                                                                                                                                               | #157                     |
| 2026-03-20 | 표현 원칙: 색상 2계층 구조 신설 (1계층 매칭도 뱃지 85/70/50 임계값 + 2계층 쌍별 emerald/sky/amber/gray). 시도 횟수 카운팅 명확화 (생성 시점, 되돌릴 수 없음). 음주 쌍별 점수 비노출 명시                                                                                                                                                                                                | Sprint 6                 |
| 2026-03-20 | 리스트 표현 테이블에 "차단 → 양방향 리스트 제거" 행 추가. 재신청 규칙의 "차단 이력" → "재신청 제한 이력"으로 용어 명확화                                                                                                                                                                                                                                                                | Sprint 6                 |
| 2026-03-20 | 사용자 차단(Block) 섹션 신설: 양방향 리스트 제거, 매칭 요청 원천 차단, 비고지, 해제 가능, 시즌 리셋 안 함. 진행 중 관계 처리(PENDING 자동 취소, 대화 종료, 확정 시 차단 불가). 다른 시스템과의 독립성 명시                                                                                                                                                                              | Sprint 6                 |
| 2026-03-20 | 조건 미입력 처리 2레이어 구조 명시: 1차 UI 게이팅(8개 중 하나라도 null → 관점 점수 비노출) + 2차 알고리즘 안전장치(dynamicMax 제외)                                                                                                                                                                                                                                                     | #157                     |
| 2026-03-24 | UI 게이팅 3-state 도입: full(양쪽 완성→min) / partial(나만 완성→단방향 perspectiveScore) / gated(내가 미완성→잠금). 양방향 조합 섹션에 partial 예외 추가                                                                                                                                                                                                                                | #178                     |
| 2026-03-25 | 3-state 시즌 모델 반영: 북마크 "시즌 중만" → "시즌 오픈 + 시즌 매칭". 음주 고정 "시즌 중" → "시즌 매칭 중". 건물 변경 "시즌 중" → "시즌 매칭 중 (시즌 오픈 첫 선택 허용)"                                                                                                                                                                                                               | #112                     |
| 2026-03-26 | 상태 전이도 섹션 신설: 2인실 상태 전이 다이어그램, 터미널 상태별 재교류 규칙 테이블, 차단 시 전이(오케스트레이션 패턴), 자발적 이탈 시 전이                                                                                                                                                                                                                                             | #182                     |
| 2026-03-26 | 자발적 이탈 ACTIVE 제한: ACTIVE 매칭 보유 시 "이미 룸메를 구했어요" 이탈 불가. 매칭 해제(UNMATCHED) 선행 필요                                                                                                                                                                                                                                                                           | #182                     |
| 2026-03-26 | `UNMATCHED` 상태 신설: 매칭 확정 후 양측 동의 취소 시 ACTIVE→UNMATCHED 전이. 재교류 양방향 불가 (조합 1회 원칙 확장, CONVERSATION_ENDED와 동일). 리스트 표현 "매칭 해제" 뱃지 행 추가                                                                                                                                                                                                   | #182                     |
| 2026-03-30 | 매칭도 뱃지 "fair" 단계 색상 'amber' → 'sky' 로 변경                                                                                                                                                                                                                                                                                                                                    | #186                     |
| 2026-03-30 | "음주 고정 정책" 섹션 삭제. 음주 필드 편집은 profile-model.md의 일반 규칙으로 통합                                                                                                                                                                                                                                                                                                      | #186                     |
| 2026-03-30 | 대화 생명주기 변경: 양측 무활동 7일/한쪽 무응답 3+4일 → 수락 후 7일 고정 TTL(`acceptedAt + 7일`). 활동 여부 무관 자동 종료. 만료 후 이력 읽기 가능+추가 대화 불가(`CONVERSATION_ENDED`). 한쪽 확정 중 TTL 만료 시 확정 의사 소멸. 리마인더 표현 "24시간 전 1회" → "만료 24시간 전 1회(서비스 내 배너)". 상태 전이도 "3+4일 무응답" 분기 제거                                            | #186                     |
| 2026-03-31 | 거절/만료 알림 "구분하되 중립 표현" 정책 행 삭제                                                                                                                                                                                                                                                                                                                                        | #65                      |
| 2026-03-31 | 3인실 정책을 별도 문서(group-matching-lifecycle.md)로 분리. 3인실 섹션을 참조로 교체, 3인실 리스트 표현 서브섹션 제거. 본 문서는 2인실 전용                                                                                                                                                                                                                                             | #65                      |
| 2026-03-31 | 채팅 생명주기를 별도 문서(chat-lifecycle.md)로 분리. 문서 범위에 참조 추가                                                                                                                                                                                                                                                                                                              | #65                      |
| 2026-03-31 | 대화 TTL 이원화: 탐색 대화(IN_CONVERSATION, GROUP_FORMING) 7일 유지. 확정 대화(ACTIVE, PAIR_OPEN~GROUP_FINAL) 시즌 종료까지 유지. chat-lifecycle.md 참조 추가                                                                                                                                                                                                                           | #65                      |
| 2026-03-31 | 3인실 섹션 전면 재작성: 2+1 모델 상세화, GROUP_CONV_JOIN 용어 도입, 대화 병렬 무제한, GROUP_FORMING 이탈 규칙(비코어 승인불필요, 코어 일방 종료 없음), GROUP_FINAL 전원 동등 Member(코어/비코어 구분 폐지), 멤버 이탈 시 나머지 2명 PAIR_OPEN 복원, 거절 양측 동의 필요, MEMBER_LEAVE 용어 도입, 상태 전이도 추가                                                                       | #65                      |
| 2026-03-31 | 3인실 그룹 리스트 표현 섹션 신설: PAIR_OPEN/GROUP_FORMING 노출, PAIR_FINAL/GROUP_FINAL 제거. 매칭도 평균 표시. 그룹 카드 디자인은 룸메 리스트 탭 실험에서 결정                                                                                                                                                                                                                          | #65                      |
| 2026-03-31 | 3인실 그룹 규칙에 "PAIR_OPEN 진입 시 자동 정리" 조항 추가: A-B 2인 확정 시 양측 미결 개인 신청/대화 자동 취소. 그룹 상태에서 개인 매칭 불가하므로 2인실 확정 시 자동 정리와 동일 원칙 적용                                                                                                                                                                                              | #65                      |
| 2026-04-22 | 캠퍼스 시즌과 기숙사별 매칭 종료일을 분리. 실제 매칭 가능 종료는 기숙사별 `roomSelectionDate`, 시즌성 데이터 리셋은 `seasonEndDate`를 따른다고 명시                                                                                                                                                                                                                                     | #194                     |
| 2026-04-24 | 북마크 사용 가능 시점을 `SEASON_OPEN` + `SEASON_MATCHING` + `SEASON_POST_MATCH`로 보강. `SEASON_POST_MATCH`에서도 생성/해제는 허용하고, 초기화는 `seasonEndDate`에 수행                                                                                                                                                                                                                 | #193                     |
| 2026-04-24 | `roomSelectionDate` 이후 확정 매칭 관계는 바로 해체하지 않고 `SEASON_POST_MATCH` 동안 결과 확인 대상으로 유지하도록 정리. 채팅은 읽기 전용 전환, 운영 관계 정리는 `seasonEndDate`에 수행                                                                                                                                                                                                | #193                     |
| 2026-04-30 | direct match request 수신 화면의 최소 contract를 `프로필 요약 + 매칭점수 + optional note + 채팅하기`로 명시하고, 요약 필드 소유권을 profile-model.md와 분리 정렬                                                                                                                                                                                                                        | #195                     |
| 2026-04-30 | 대화/매칭 분리, direct match request, thread lazy 생성, ACTIVE 즉시 확정, request TTL/cooldown/count/reset, matched pair thread 유지, `UNMATCHED` 재요청 정책을 반영해 2인실 상태 전이와 신청 플로우를 전면 재정의                                                                                                                                                                      | #195                     |
| 2026-05-03 | 시즌 참여자 등록 축과 `SEASON_OPEN` canonical 용어를 반영. 매칭 참여 자격을 `등록 + 건물 배정 + 시즌 상태` 기준으로 재정의하고, `SEASON_POST_MATCH`에서 신규 매칭/신규 채팅 요청 불가 + limited browse 유지 구조를 반영                                                                                                                                                                 | #195                     |
| 2026-05-06 | 상호 합의 해제 요청 플로우를 명시: current `ACTIVE` 대상, 양측 요청 전까지는 `ACTIVE` 유지, 요청 철회 허용, `roomSelectionDate` 전까지만 `UNMATCHED` 허용. success 이력과 success 후 `UNMATCHED` 집계를 구분하는 원칙을 추가                                                                                                                                                            | #195                     |
| 2026-05-07 | `ACTIVE` 사용자에 대한 general profile browse는 `LIMITED`로 보고, `SEASON_POST_MATCH`에서도 `ACTIVE` 결과 확인은 유지되지만 unmatch capability는 재개되지 않는다고 명확화                                                                                                                                                                                                               | #195                     |
| 2026-05-11 | 매칭 점수 canonical 값을 viewer 기준 단방향 `perspectiveScore`로 고정하고, UI/도메인 게이팅을 `full/gated` 2-state로 단순화. 점수 노출 전제를 viewer 조건 8개 완성 + target 핵심 프로필 완성으로 재정의                                                                                                                                                                                 | #195                     |
| 2026-05-12 | 시즌 참여 등록 완료 사용자는 complete season profile을 전제로 본다고 명시하고, 매칭 점수 생성/노출 전제를 `viewer/target 모두 complete season profile`로 재정렬                                                                                                                                                                                                                         | #195                     |
| 2026-05-13 | 자발적 이탈을 시즌 참여 철회 action으로 정렬하고, 미결 request/thread를 withdrawn reason으로 종료하며 같은 시즌 재참여를 막는다고 명시                                                                                                                                                                                                                                                  | #76 / #195               |
| 2026-05-20 | #195 2026-05-20 결정에 맞춰 direct request 요약을 roommate-search summary projection 재사용으로 정리하고, `MatchRequestChannel` 제거 및 registration 완료 조건(`REGISTERED + ASSIGNED + snapshot`)을 match action 전제로 반영했다. Matched partner detail도 account deletion/de-identification 정책을 우선하며, 점수 노출은 `full/gated` 용어 대신 `scoreVisible` capability로 정리한다 | #195                     |
| 2026-05-21 | match action 전제에서 dormitory selection draft(`SELECTED`)와 registration finalize 후 `ASSIGNED`를 구분하고, match action은 saved valid selection이 finalize에서 확정된 registration 완료 상태만 허용한다고 정리했다                                                                                                                                                                   | #195                     |
| 2026-05-25 | match history event fact와 sensitive snapshot payload를 분리하고, 삭제 사용자 관련 snapshot은 `MATCH_HISTORY_ENTRY` retained vault + role link로 보존/최소화한다고 명시                                                                                                                                                                                                                 | #195                     |
| 2026-05-26 | match request 수락 시점에도 requester/receiver의 registration complete, profile snapshot, same-dormitory, roomSelectionDate, safety/visibility precondition을 재검증하고 stale pending request를 fail-closed/system-cancel 대상으로 본다고 명시                                                                                                                                         | #195                     |
| 2026-05-26 | stale pending request의 accept-time terminal reason을 generic `ADMIN_ACTION`이 아니라 `MATCH_PRECONDITION_FAILED`로 분리한다고 명시                                                                                                                                                                                                                                                     | #195                     |
| 2026-05-27 | 매칭 완료 유저의 `MATCHED_PARTNER`/`GENERAL` target 의미와 summary-only exposure/result-read context 차이를 명시                                                                                                                                                                                                                                                                        | #195                     |
| 2026-05-27 | 북마크를 `SEASON_OPEN`/`SEASON_MATCHING`의 same-dormitory candidate action으로 재정의하고, 다른 dormitory와 `SEASON_POST_MATCH` 신규 bookmark action을 닫는다고 명시                                                                                                                                                                                                                    | #195                     |
| 2026-05-27 | 과거 counterpart final detail을 최종 매칭 상대(`MATCHED_SUCCESS`)로 제한하고, `UNMATCHED_AFTER_SUCCESS`는 summary history로만 남긴다고 명시                                                                                                                                                                                                                                             | #195                     |
| 2026-05-27 | 삭제/비식별된 과거 최종 매칭 상대 detail은 retained vault 복원 없이 tombstone detail로 degrade한다고 명시                                                                                                                                                                                                                                                                               | #195                     |
| 2026-05-27 | 과거 최종 매칭 상대(`MATCHED_SUCCESS`) detail에서 viewer 기준 `SeasonMatchHistoryEntry.matchScore` snapshot을 노출하되, tombstone detail에는 score를 포함하지 않는다고 명시                                                                                                                                                                                                             | #195                     |
| 2026-07-10 | 상세 프로필의 하위 호환성 표현을 항목별 axis bucket(71/50)과 축별 dimension/radar bucket(70/50)으로 분리했다. 항목별 70점 이하 부분 수용 조합은 `medium`으로 보며, 전체 매칭점수 뱃지의 85/70/50 임계값은 유지한다.                                                                                                                                                                     | RoommateTab              |
| 2026-05-29 | 정책 문서의 날짜 고정/시간 의존 표현을 문서 본문, 날짜, 맥락 기준 표현으로 정리했다                                                                                                                                                                                                                                                                                                     | #195                     |
| 2026-06-02 | chat thread closure reason/closedAt은 chat domain source의 책임으로 두고, `SeasonMatchHistoryEntry` hot row와 match history retained payload에는 중복 저장하지 않는다고 명시                                                                                                                                                                                                            | #198                     |
| 2026-06-02 | match history hot row/public API/retained payload에서 chat-derived `hadConversation`/conversation count를 제거하고, 대화 통계는 chat domain stats surface가 소유한다고 명시                                                                                                                                                                                                             | #198                     |
| 2026-06-08 | 북마크 owner를 `social-safety/bookmarks`로 명시하고 create/delete/list/sort/empty/block side-effect/season cleanup 기준을 구현 가능한 baseline으로 보강했다                                                                                                                                                                                                                             | #196                     |
| 2026-06-10 | `ActiveMatchLifecycleEvent`를 `ActiveMatch` current-state를 대체하지 않는 운영/audit/debug trace로 정의하고, same-transaction append boundary와 metadata allowlist/no-PII 금지 payload를 명시                                                                                                                                                                                           | #227                     |
| 2026-07-09 | live `ActiveMatch` viewer도 `SEASON_MATCHING` roommate-search에서 `CAMPUS_MERGED`와 `SAME_BUILDING_ONLY` summary list를 볼 수 있지만, 신규 후보 action surface가 아니므로 카드 CTA를 닫고 단일 안내 pill로 설명한다고 정리                                                                                                                                                              | #195                     |
