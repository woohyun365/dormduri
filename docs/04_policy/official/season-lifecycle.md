# 시즌 운영 정책

## 문서 범위

이 문서는 시즌의 상태 모델, 일정 산출, 지원 건물, 상태별 기능 허용 범위, 시즌 전환 시 데이터 처리 방식을 다룬다.

- 시즌 참여자 등록의 의미와 시즌 참여 프로필: [season-participation.md](./season-participation.md)
- 프로필 수정 가능 범위: [profile-model.md](./profile-model.md)

이 문서가 **시즌 기반 기능 on/off의 최종 소유 문서**다.

## 시즌 상태 모델

서비스는 4개 상태를 순환한다.

| 상태                    | 코드                | 설명                                                                                                           |
| ----------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------- |
| **비시즌**              | `OFF_SEASON`        | 시즌 외 기간. 타인 browse와 current season profile 작성은 닫히고, 표시 identity와 과거 이력 read만 가능        |
| **시즌 오픈 기간**      | `SEASON_OPEN`       | 학기 시작 후 season profile 작성/수정, registration, summary 탐색이 가능. 매칭 신청은 비활성                   |
| **시즌 매칭**           | `SEASON_MATCHING`   | 매칭 활성 기간. Registration 전 season profile 작성/수정은 가능하나 registration 완료 후 profile은 잠금        |
| **시즌 마감 정리 기간** | `SEASON_POST_MATCH` | 신규 registration/match는 종료됐지만 시즌은 아직 종료 전. 확정 결과 확인과 read-only profile/history 안내 기간 |

상태 전이:

```
OFF_SEASON → SEASON_OPEN → SEASON_MATCHING → SEASON_POST_MATCH → OFF_SEASON
```

## 시즌 일정

### 자동화 공식

시즌 상태머신은 **캠퍼스별 단일 시즌**을 기준으로 운영한다.
관리자는 캠퍼스 시즌에 대해 아래 값을 명시적으로 입력한다.

- `preparationStartDate`
- `matchingStartDate`
- `seasonEndDate`

기숙사별 실제 호실선택일은 별도 `운영 기숙사 메타`로 관리한다.

| 항목                                           | 설명                              |
| ---------------------------------------------- | --------------------------------- |
| 시즌 준비 시작 (`preparationStartDate`)        | 캠퍼스 시즌 준비 시작일           |
| 시즌 매칭 시작 (`matchingStartDate`)           | 캠퍼스 공통 매칭 시작일           |
| 시즌 종료 (`seasonEndDate`)                    | 매칭 외 시즌성 데이터 정리 기준일 |
| 기숙사별 실제 호실선택일 (`roomSelectionDate`) | 해당 기숙사의 실제 매칭 종료일    |

### 상태 판정

```
현재일 < preparationStart                         → OFF_SEASON
preparationStart ≤ 현재일 < matchingStart         → SEASON_OPEN
matchingStart ≤ 현재일 ≤ 마지막 운영 기숙사 종료일 → SEASON_MATCHING
마지막 운영 기숙사 종료일 < 현재일 ≤ seasonEnd    → SEASON_POST_MATCH
seasonEnd < 현재일                                → OFF_SEASON
```

### 시즌 속성

| 항목                 | 정책                                                         |
| -------------------- | ------------------------------------------------------------ |
| 시즌 오픈 기간       | 학기 시작 이후 운영 설정 기준                                |
| 시즌 매칭 기간       | `matchingStartDate` ~ 기숙사별 `roomSelectionDate`           |
| 운영 주기            | 학기당 1회, 연 2회                                           |
| 데이터 소스          | 강원대 학생생활관 공식 일정                                  |
| 관리자 입력값        | `preparationStartDate`, `matchingStartDate`, `seasonEndDate` |
| 클라이언트 반영 방식 | 서버 API                                                     |

### 사용자용 시즌 조회 해석 기준

- 사용자용 `current season` 조회는 **운영 캠퍼스**만 대상으로 한다.
- 운영 캠퍼스라도 **current season row가 하나도 없으면** 사용자용 `current season` 리소스는 없는 것으로 본다.
- future season row만 미리 등록돼 있어도 사용자용 `current season` 리소스를 그 row로 승격하지 않는다. 다음 시즌 preview는 별도 query/API responsibility다.
- 비운영 캠퍼스는 사용자용 `current season` 리소스를 따로 갖지 않는다.
- 매칭 종료까지 남은 일수와 시즌 종료까지 남은 일수는 **서로 다른 값**으로 취급한다. 하나의 단일 종료 countdown으로 합치지 않는다.

### 운영 override와 current season 계산 기준

- 사용자용 `current season`의 source of truth는 **운영 캠퍼스**의 `Season` row와 해당 시즌의 운영 기숙사 메타다.
- `preparationStartDate` ~ `seasonEndDate` 범위에 들어온 row만 current season 후보가 된다. future season row는 일정 예고/운영 준비 데이터일 뿐 사용자용 current season으로 승격하지 않는다.
- 활성 override는 current season 후보로 선택된 row의 **effective state 계산**에만 적용한다. override가 시즌 일정, 운영 기숙사, season history snapshot, audit/history 원장을 대체하지 않는다.
- override window(`overrideStartedAt`/`overrideEndsAt`) 밖의 override 값은 사용자용 state 계산에 영향을 주지 않는다.
- 운영자가 schedule/override를 변경하는 경우 변경 사유와 실행 actor는 별도 operations audit log로 남겨야 한다. `Season.override*` columns만으로 운영 변경 이력을 복원하려고 해서는 안 된다.
- 같은 캠퍼스에 현재 기간이 겹치는 row는 운영상 만들지 않는 것이 원칙이다. #208 backend operations는 overlap/lost update를 막는 validation과 optimistic concurrency를 제공해야 한다.
- #209 cache/memoization은 이 계산 결과를 한 logical request 안에서 재사용하기 위한 성능 최적화다. cache가 Postgres `Season`/`SeasonDormitoryOperation` source of truth를 대체하지 않는다.

### 캠퍼스 시즌 vs 기숙사별 실제 호실선택일

- 시즌 준비 시작/매칭 시작/시즌 종료는 **캠퍼스 시즌**이 소유한다.
- 같은 캠퍼스 내에서 기숙사별 실제 호실선택일이 다를 수 있으므로, 기숙사별 실제 날짜는 별도 `운영 기숙사 메타`로 저장한다.
- **매칭 가능 기간의 종료는 기숙사별 `roomSelectionDate`**를 따른다.
- **건물 배정 초기화, 북마크 초기화, 시즌성 운영 데이터 정리**는 캠퍼스 `seasonEndDate`를 따른다.
- 같은 캠퍼스 안에서도 운영 기숙사 목록은 시즌마다 달라질 수 있다.

### 설계 근거

명시적 시즌 윈도우 + 기숙사별 실제 종료일 구조를 채택한 이유:

- 학기 시작 시점(1/1, 7/1)부터 준비 기간을 열고 운영자가 직접 조정할 수 있다.
- 같은 캠퍼스 안에서도 기숙사별 실제 호실선택일 차이를 수용할 수 있다.
- 매칭 종료와 시즌 종료를 분리해 운영/정리 절차를 명확히 할 수 있다.
- 상세 결정 과정: `docs/03_planning/sprint-6/112-season-model-redesign.md`, `docs/03_planning/sprint-7/194-campus-dormitories-seasons-api.md`

## 지원 건물

### 포함 건물

| 건물   | 인실  | 비고              |
| ------ | ----- | ----------------- |
| 퇴계관 | 3인실 | 남                |
| 다산관 | 2인실 | 남, 향토학사 포함 |
| 예지원 | 2인실 | 여, 향토학사 포함 |
| 난지원 | 3인실 | 여                |
| 국지원 | 3인실 | 여                |
| 새롬관 | 2인실 | 남/여             |
| 이룸관 | 2인실 | 남/여             |
| 다온관 | 2인실 | 남/여             |

### 제외 건물

| 건물           | 제외 사유                            |
| -------------- | ------------------------------------ |
| 율곡관         | 법전원 전용                          |
| 국제생활관     | 외국인 중심, 생활 조건 상이          |
| 국제인재양성관 | 외국인/지자체 추천 중심, 수요 불명확 |

### 방 유형 유추

유저가 별도로 2인실/3인실을 선택하지 않는다.
건물 DB가 방 유형을 결정한다.

### 사용자용 건물 master / 선택 목록 / 안내 노출 기준

- 사용자용 건물 master directory는 정책상 지원 건물 기준으로 노출할 수 있다.
- 사용자용 건물 **선택 목록**은 **current season의 운영 기숙사만** 노출한다.
- current season row는 있으나 `SeasonDormitoryOperation.isOperated = true` row가 0개면 선택 목록은 빈 배열이어야 하며, 사용자 상태 해석도 최대 `SEASON_OPEN`까지만 허용한다.
- 건물 상세에는 최소한 건물명, 캠퍼스, 인실, 성별 정책이 포함되어야 한다.
- 건물 안내에는 최소한 아래 정보가 포함되어야 한다.
  - 화장실 구조
  - 편의시설
  - 시설/식당 연락처
  - 캠퍼스 공통 생활 규칙
  - 비상 연락처
  - 공식 홈페이지

## 상태별 기능 허용 범위

| 기능                        | 비시즌 (OFF_SEASON)  | 시즌 오픈 기간 (SEASON_OPEN)                                                                                                                                                                        | 시즌 매칭 (SEASON_MATCHING)                                                                                                | 시즌 마감 정리 기간 (SEASON_POST_MATCH)                                                                                            |
| --------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| season profile 생성/수정    | 불가                 | registration 전 가능                                                                                                                                                                                | registration 전 가능                                                                                                       | 불가(write locked)                                                                                                                 |
| 기숙사 선택 저장            | 불가                 | 별도 season participation/dormitory selection API로 current `SeasonParticipant` row에 `SELECTED + dormitoryId` draft 저장 가능. complete profile은 저장 조건이 아니며 registration 전까지 변경 가능 | 별도 API로 가능. complete profile은 저장 조건이 아니며 해당 dormitory `roomSelectionDate` 전까지 registration 전 변경 가능 | 불가                                                                                                                               |
| 시즌 registration finalize  | 불가                 | complete profile + 저장된 valid dormitory selection draft 검증 후 가능                                                                                                                              | complete profile + 저장된 valid dormitory selection draft + 해당 dormitory `roomSelectionDate` 전 가능                     | 불가                                                                                                                               |
| 시즌 참여 철회              | 해당 없음            | 가능                                                                                                                                                                                                | 가능 (live `ActiveMatch` 보유 시 불가)                                                                                     | 불가                                                                                                                               |
| 프로필 탐색(summary browse) | 타인 browse 비활성화 | registration 완료 target summary 가능. 미등록 viewer도 summary는 볼 수 있음                                                                                                                         | registration 완료 target summary 가능. 등록 완료 viewer는 same-building 중심                                               | registration 완료 target list-summary browse 가능. 기본 scope는 `CAMPUS_MERGED`이며 등록 viewer를 same-building으로 더 좁히지 않음 |
| detail/score                | 불가                 | `canViewFull`/`scoreVisible` target만 가능                                                                                                                                                          | `canViewFull`/`scoreVisible` target만 가능. live match 보유자는 matched partner 중심                                       | matched partner result-read detail/score만 유지. 단, 상대 account deletion/de-identification이 우선한다                            |
| 북마크                      | 불가                 | registration 완료 + capability 허용 시 가능                                                                                                                                                         | registration 완료 + capability 허용 시 가능                                                                                | 유지/해제 중심. 신규 정책은 matching owner가 제한                                                                                  |
| `쪽지보내기` / 새 대화 시작 | 불가                 | `REGISTERED + ASSIGNED + registeredAt + complete profile + 같은 건물/성별` 전제에서만 가능                                                                                                          | 같은 전제 + 내 기숙사 `roomSelectionDate` 전까지 가능                                                                      | 신규 불가                                                                                                                          |
| 비매칭 대화 쓰기            | 불가                 | chat policy 조건 충족 시 가능                                                                                                                                                                       | **가능** (내 기숙사 `roomSelectionDate` 전까지)                                                                            | 불가(read-only)                                                                                                                    |
| matched pair 대화 쓰기      | 불가                 | 해당 없음                                                                                                                                                                                           | **가능** (`ACTIVE` 이후)                                                                                                   | **가능** (`seasonEndDate` 전까지 유지)                                                                                             |
| 매칭 신청/수락              | 불가                 | **불가**                                                                                                                                                                                            | `REGISTERED + ASSIGNED + registeredAt + complete profile + 같은 건물/성별 + 해당 기숙사 roomSelectionDate 전`일 때만 가능  | 불가                                                                                                                               |
| 신고                        | 가능                 | 가능                                                                                                                                                                                                | 가능                                                                                                                       | 가능                                                                                                                               |
| 차단                        | 가능                 | 가능                                                                                                                                                                                                | 가능                                                                                                                       | 가능                                                                                                                               |
| 기숙사 선택 변경/잠금       | 불가                 | complete profile 여부와 무관하게 registration 전 변경 가능. registration 후 잠금                                                                                                                    | complete profile 여부와 무관하게 registration 전 + 해당 dormitory `roomSelectionDate` 전 변경 가능. registration 후 잠금   | 불가                                                                                                                               |
| 과거 이력 열람              | 가능                 | 가능                                                                                                                                                                                                | 가능                                                                                                                       | 가능                                                                                                                               |

세부 참여/노출/매칭/대화 규칙은 [season-participation.md](./season-participation.md)가 최종 소유하고, 프로필 작성/잠금 범위는 [profile-model.md](./profile-model.md)가 최종 소유한다.

정합성 메모:

- 이 표의 `프로필 탐색`은 기본적으로 **roommate-search summary 탐색**을 뜻한다.
- OFF_SEASON에는 base profile 기반 타인 browse를 열지 않는다.
- Search target canonical root는 `User`가 아니라 registration 완료 `SeasonParticipant`다.
- Detail 조회는 `canViewFull = true` / `detailViewable = true` target에 한해서만 연다.
- 미등록 또는 selection-required viewer도 시즌 기간 registration 완료 target의 summary card는 볼 수 있으나 score/detail/match/chat action은 닫힌다.
- `SEASON_POST_MATCH` summary browse는 신규 action을 닫은 action-closed browse다. 등록 완료 viewer와 미등록 viewer 모두 기본 `CAMPUS_MERGED` summary scope를 사용하며, full detail/score는 matched partner result-read capability가 있을 때만 열린다.
- `read-only` 표현은 저장 모델과 결과 읽기 맥락을 구분해서 사용한다. `ConversationThread.status = READ_ONLY`는 chat thread 상태이고, profile final/read-only는 registration 이후 write lock이다. Summary-only exposure는 `read-only`와 같은 계층이 아니다.
- Registration 전 current draft profile은 public target이 아니다.

### 시즌 중 미참여 / selection-required 유저

| 상태                                       | 정책                                                                                                                          |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| 미참여 / season profile 없음               | 시즌 기간 registration 완료 target summary card는 볼 수 있으나 detail/score/action은 불가                                     |
| season profile draft 있음, registration 전 | self read/write에는 보이지만 public target/history row가 아님. selection draft는 profile complete 여부와 독립적으로 저장 가능 |
| profile 미완성, 기숙사 선택 저장 후        | `SELECTED` draft는 존재하지만 `profileCompletionRequired` 상태. 참여 완료가 아님                                              |
| complete profile, 기숙사 선택 전           | `dormitorySelectionRequired` 상태. 참여 완료가 아님                                                                           |
| complete profile, 기숙사 선택 저장 후      | `SELECTED` registration candidate. 참여 완료 전이며 등록 전까지 기숙사 선택 변경 가능                                         |
| `REGISTERED + UNASSIGNED` legacy 상태      | 더 이상 신규 생성하지 않는다. 발견 시 selection-required/unavailable 상태로 migration 또는 정합성 보정 대상                   |
| registration 완료                          | `REGISTERED + ASSIGNED + registeredAt + complete profile + registration snapshot`                                             |

`UNASSIGNED`는 더 이상 “참여 완료지만 건물만 없는 상태”가 아니다. 기숙사 선택 전이거나 운영/검증 조건 때문에 registration을 완료할 수 없는 상태는 capability에서 `profileCompletionRequired`, `dormitorySelectionRequired`, `registrationUnavailable`처럼 명시한다.

### 악용 방지 설계

| 악용 유형           | 설명                                           | 방지 방식                                                                                                                                                         |
| ------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 매칭 후 프로필 변경 | 매칭 성사 후 프로필 정보 변경 (비흡연→흡연 등) | 시즌 매칭 + 건물 배정 = 프로필 잠금                                                                                                                               |
| 풀 탐색 최적화      | 프로필을 바꿔가며 유리한 조합 탐색             | 시즌 오픈에서 매칭 비활성 → registration 완료 후 profile 잠금. Selection-required/legacy UNASSIGNED는 summary-only이며 detail/score/action이 닫히므로 최적화 불가 |

## 기숙사 선택 시점

| 항목                                    | 정책                                                                                                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 시즌 오픈 기간 중 기존 가입자           | season profile 생성/수정과 기숙사 선택 draft 저장은 registration 전 독립 순서로 가능 → registration finalize 시 completeness + saved selection 재검증 |
| 시즌 오픈 기간 중 신규 가입자           | signup은 profile을 만들지 않는다. 시즌 화면에서 별도 season profile/registration 흐름을 진행                                                          |
| 시즌 매칭 중 유입 (재학생 추가 합격 등) | registration 전 사용자는 season profile 생성/수정과 최초 기숙사 선택 가능. 선택 dormitory의 `roomSelectionDate` 전이어야 함                           |

기숙사 선택 값은 current season의 `SeasonParticipant`가 소유한다. 저장 단계는 별도 `UserDormitorySelection`/account-level row 없이 `SeasonParticipant.dormitorySelectionState = SELECTED`, `SeasonParticipant.dormitoryId != null` draft로 표현한다. `SEASON_OPEN` / `SEASON_MATCHING` 동안 별도 season participation / dormitory selection API/service가 선택 목록, campus/gender/roomSelectionDate 검증, `SELECTED` draft 저장/변경, registration finalize의 `ASSIGNED` 확정을 소유한다. `PATCH /api/users/me`와 계정 row/base profile은 기숙사 선택 write path가 아니다.

## 시즌 중 가입자 처리

| 항목                         | 시즌 오픈 기간                                                    | 시즌 매칭                                                                               | 시즌 마감 정리 기간              |
| ---------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------- |
| 가입                         | 허용                                                              | 허용                                                                                    | 허용                             |
| signup profile orchestration | 없음                                                              | 없음                                                                                    | 없음                             |
| season profile 작성          | registration 전 허용                                              | registration 전 허용                                                                    | 불가                             |
| registration finalize        | complete profile + 저장된 valid dormitory selection draft 시 허용 | complete profile + 저장된 valid dormitory selection draft + `roomSelectionDate` 전 허용 | 불가                             |
| 이후 수정                    | registration 전만 가능, registration 후 잠금                      | registration 전만 가능, registration 후 잠금                                            | current season profile read-only |
| 매칭 참여                    | 불가 (매칭 비활성)                                                | registration 완료 + `ASSIGNED` + 내 기숙사 종료 전 가능                                 | 불가                             |

## 입사 취소 처리

| 시점                                   | 처리                                                                                               |
| -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 시즌 오픈 중                           | 시즌 참여 철회로 current season pool에서 이탈. 미결 요청/비매칭 thread는 withdrawn reason으로 정리 |
| 시즌 매칭 중 (매칭 전)                 | 시즌 참여 철회로 pool에서 제거. 같은 시즌 재참여 불가                                              |
| 시즌 매칭 중 (live `ActiveMatch` 보유) | 사용자 직접 철회 불가. `UNMATCHED` 또는 관리자 개입 후 별도 처리                                   |

## 시즌 중 계정 삭제 요청

계정 삭제는 시즌 참여 철회와 분리된 retention/de-identification 이벤트다. 현재 시즌에 등록 중인 사용자의 삭제 요청은 수락하지 않고, 시즌 참여 철회 가능 여부 또는 시즌 종료 후 재요청을 안내한다. 철회 등으로 계정 삭제 요청이 수락되면 별도 cancel 가능한 유예 상태 없이 즉시 active user/display identity/season profile 식별 정보를 비식별화하고, 정상 탈퇴 identifier anchor만 `RetainedIdentity`에 5일 제한 보존한 뒤 폐기한다. 시즌 종료 이벤트가 계정 삭제/비식별화 이벤트를 자동으로 발생시키지는 않는다.

## 시즌 종료와 보존/삭제 이벤트의 구분

- `roomSelectionDate`와 `seasonEndDate`는 **시즌 운영 종료 기준**이지, 곧바로 계정 삭제/비식별화 시점을 뜻하지 않는다.
- `seasonEndDate`가 되면 현재 시즌의 운영 관계는 past-season snapshot / history 성격으로 전환될 수 있다.
- 반면 계정 삭제, 신고/분쟁 대응, 법적 보존, 관리자 보존 조치는 **별도의 retention 이벤트**로 취급한다.
- 따라서 `seasonEndDate` 이후에도 과거 시즌 결과 확인용 정보는 보존 정책 범위 안에서 유지될 수 있다.

## 시즌 전환 시 데이터 처리

| 데이터                                                               | 정리 기준                                                                     | 처리                                                                                                                                                                                                                            |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 미확정 관계 (`PENDING`)                                              | **기숙사별 `roomSelectionDate`**                                              | 서비스가 자동 종료 처리 (`PENDING` → 자동 취소)                                                                                                                                                                                 |
| 비매칭 대화 (`ConversationThread`)                                   | **기숙사별 `roomSelectionDate`**                                              | read-only/archive 전환                                                                                                                                                                                                          |
| 확정 매칭 관계 (`ACTIVE`, `PAIR_OPEN`, `GROUP_FINAL`)                | **캠퍼스 `seasonEndDate`**                                                    | `SEASON_POST_MATCH` 동안 결과 확인 대상으로 유지하고, `seasonEndDate` 시점에 past-season snapshot으로 보관하면서 운영 관계를 종료한다                                                                                           |
| matched pair 대화 (채팅방)                                           | **캠퍼스 `seasonEndDate`**                                                    | `SEASON_MATCHING` + `SEASON_POST_MATCH` 동안 쓰기 허용, `seasonEndDate` 이후 read-only 전환. 다음 시즌 current season 오픈 시 archive. leave로 숨긴 thread도 동일 기준을 따른다. 상세: [chat-lifecycle.md](./chat-lifecycle.md) |
| 건물 배정                                                            | **캠퍼스 `seasonEndDate`**                                                    | 초기화                                                                                                                                                                                                                          |
| 재신청 제한/시도 횟수                                                | **캠퍼스 `seasonEndDate`**                                                    | 초기화 (다음 시즌에서 새로 카운팅)                                                                                                                                                                                              |
| 북마크                                                               | **캠퍼스 `seasonEndDate`**                                                    | `social-safety/bookmarks` owner가 active bookmark를 expire/sweep. block side-effect로 제거된 bookmark는 unblock 시 복원하지 않음                                                                                                |
| 사용자 차단(Block) 목록                                              | 사용자 행동 기반, 시즌과 무관                                                 | 시즌 전환으로 초기화하지 않음                                                                                                                                                                                                   |
| 매칭 이력 요약 (상대·상태·날짜)                                      | **보관** ([data-retention.md](./data-retention.md) #6, 3년. 사용자 열람 가능) | 사용자-facing past result로 보관하되 상대 탈퇴/비식별화 시 tombstone/minimal result로 degrade                                                                                                                                   |
| 시즌 결과 summary count                                              | **보관**                                                                      | distinct-target 기준의 대화/보낸 요청/받은 요청/최종 결과 snapshot 유지                                                                                                                                                         |
| season profile final fields(생활패턴/원하는 조건/`intro`/additional) | **캠퍼스 `seasonEndDate`**                                                    | current season의 final/read-only row와 `SeasonParticipantProfileHistory(source = SEASON_REGISTRATION)` snapshot으로 보관한다. 다음 시즌 profile draft로 자동 이월하지 않는다                                                    |
| 표시 identity / 가입 identity(`nickname`, `gender`, `campus`)        | 계정 유지 기간                                                                | live `UserDisplayIdentity`/`User`는 계정 identity로 유지한다. 과거 시즌 read는 registration 당시 snapshot(`nicknameSnapshot`, `genderSnapshot`, `campusCodeSnapshot`)을 우선 사용한다                                           |
| 계정                                                                 | 계정 유지 기간                                                                | 유지. 단, account deletion/de-identification이 수락되면 current profile과 history user-facing read는 data-retention 정책에 따라 tombstone/minimal result로 degrade한다                                                          |
| 운영 로그                                                            | 보존 (보관 기간은 [data-retention.md](./data-retention.md) 참조)              | user-facing profile과 분리해 restricted/audit scope로 보관                                                                                                                                                                      |

`seasonEndDate`는 `SeasonParticipantProfile` current row 삭제 이벤트가 아니다. 해당 row는 종료된 시즌의 final/read-only aggregate로 남고, user-facing past read는 `SeasonParticipantProfileHistory` registration snapshot을 우선한다. 다음 시즌은 새 `SeasonParticipant`와 새 `SeasonParticipantProfile` draft를 생성하며, 이전 season profile final fields를 current draft로 자동 복사하지 않는다.

"매칭 종료"는 **해당 기숙사의 `roomSelectionDate`**,
"시즌 종료"는 **캠퍼스 시즌의 `seasonEndDate`**를 의미한다.

> **`roomSelectionDate`와 `seasonEndDate`의 책임은 다르다.**
>
> `roomSelectionDate` 이후에는 **신규 매칭 형성 및 미확정 대화**가 종료된다. 반면 **확정 매칭 관계와 상대 확인 정보, matched pair 대화는 `seasonEndDate` 전까지 유지**되며, 이 구간이 `SEASON_POST_MATCH`다.
> `seasonEndDate`에 도달하면 운영 관계는 past-season snapshot으로 넘어가고, 건물 배정·북마크·재신청 제한도 함께 정리된다. 자세한 상태 전이는 [matching-lifecycle.md](./matching-lifecycle.md), 보관 규칙은 [data-retention.md](./data-retention.md) 참조.

## 시즌 상태 변화와 realtime 채팅 통지

시즌 상태머신은 채팅 realtime event의 상위 정책 authority다. Realtime event는 시즌/채팅 상태 변화를 사용자 device에 빠르게 전달하는 통지이며, 시즌 상태·thread status·write capability를 새로 결정하지 않는다.

| 상태 변화                                 | 채팅 정책 효과                                                             | realtime 통지 원칙                                                                                              |
| ----------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 기숙사별 `roomSelectionDate` 도달         | 미확정 관계와 비매칭 대화는 종료/read-only/archive 전환 대상               | 관련 thread/member의 상태 변화는 chat lifecycle owner가 DB transaction으로 저장하고 outbox event로 통지한다     |
| `ACTIVE` 확정 후 `SEASON_POST_MATCH` 진입 | matched pair 대화는 `seasonEndDate` 전까지 쓰기 가능                       | realtime event가 누락되어도 REST snapshot은 계속 같은 write capability를 반환해야 한다                          |
| 캠퍼스 `seasonEndDate` 도달               | 확정 매칭 관계와 matched pair 대화가 past-season/read-only 성격으로 전환   | thread update/archive event는 outbox/replay 대상으로 남기고, client는 cursor 만료 시 REST snapshot으로 수렴한다 |
| 계정 삭제/비식별화 수락                   | 시즌 상태와 별개로 사용자-facing 정보가 tombstone/minimal result로 degrade | chat retained body 원문은 socket/realtime event, replay, cache, 일반 log로 노출하지 않는다                      |

- realtime event 발행은 상태 전이의 결과이지 상태 전이의 원인이 아니다.
- chat realtime outbox/replay 기본 정책은 [chat-lifecycle.md](./chat-lifecycle.md)의 "실시간 전송과 동기화 정책"을 따른다.
- `clientMessageId`, message body 1,000자 제한, read marker, 60초 realtime ticket은 채팅 command/auth 정책이며 시즌 상태머신이 값을 재정의하지 않는다.
- `replay` window 운영 재점검, multi-node/Redis 전환, managed realtime service 도입, 운영 metric threshold 확정은 후속 운영 이슈(#252, #250, #251, #254)에서 다룬다.

## 시즌 종료 사용자 안내

| 대상        | 안내 내용                                                                                                                                                             | 시점                  |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 전체 사용자 | 시즌 종료 예정 + 데이터 초기화 범위(건물 배정/북마크) 및 매칭·대화 자동 종료 처리 사전 고지                                                                           | 시즌 매칭 종료 7일 전 |
| 미확정 유저 | 매칭 미확정 상태에서 시즌이 종료되면 미결 신청이 자동 취소됨을 안내                                                                                                   | 시즌 매칭 종료 3일 전 |
| 확정 유저   | 비매칭 대화는 `roomSelectionDate` 이후 읽기 전용으로 전환되지만, **확정 매칭 채팅은 `seasonEndDate` 전까지 유지**되고 시즌 종료 시 past-season 결과로 정리된다고 안내 | 시즌 매칭 종료 3일 전 |

안내 방식은 서비스 내 배너 또는 in-app notification으로 제공한다. Push 알림은 MVP에서 두지 않는다. 알림 payload와 delivery channel 경계는 [notification-inbox.md](./notification-inbox.md)를 따른다.

D-7/D-3 안내는 별도 상태(`APPROACHING_END`)가 아닌 `SEASON_MATCHING` 상태 내에서 **매칭 종료까지 남은 일수**로 UI 분기한다. 시즌 종료 안내가 필요할 때는 **시즌 종료까지 남은 일수**를 별도 기준으로 사용한다.

## 과거 시즌 이력 열람

사용자는 과거 시즌의 매칭 이력을 열람할 수 있다.

| 항목           | 정책                                                                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 열람 대상      | 본인이 참여한 과거 시즌의 매칭 이력                                                                                                           |
| 노출 정보      | 시즌명, 본인 배정 건물(당시 스냅샷, 건물 단위), 상대 닉네임(당시 스냅샷), 최종 상태, 날짜, 관계 맥락 태그(보낸 요청/받은 요청/대화/매칭 성사) |
| 비노출 정보    | 매칭도 점수, 인실, 상대 건물 정보, 메시지 내용                                                                                                |
| 열람 가능 시점 | 모든 시즌 상태에서 열람 가능 (`OFF_SEASON`, `SEASON_OPEN`, `SEASON_MATCHING`, `SEASON_POST_MATCH`)                                            |
| 보관 기간      | [data-retention.md](./data-retention.md) #6 (3년)                                                                                             |
| 탈퇴 상대 표시 | "탈퇴한 사용자"로 익명화                                                                                                                      |
| 비운영 캠퍼스  | 가능 (본인 이력)                                                                                                                              |

닉네임 스냅샷은 이력 생성 시점(터미널 상태 도달 또는 시즌 종료)의 닉네임을 저장한다. 이후 상대가 닉네임을 변경해도 이력에는 당시 닉네임이 유지된다.

건물 스냅샷은 해당 시즌에 본인에게 배정되었던 건물을 의미하며, 건물 단위까지만 노출한다. 인실 정보와 상대의 건물 정보는 노출하지 않는다.

관계 맥락 태그는 과거 시즌 이력에서 사용자가 어느 단계의 활동을 보고 있는지 설명하기 위한 보조 정보다. 상태의 원인·행위자를 과도하게 상세 공개하지 않는 범위에서, "보낸 요청/받은 요청/대화/매칭 성사" 수준의 사용자 관점 맥락을 함께 노출할 수 있다.

과거 시즌 이력은 **운영 상태머신 자체**를 그대로 재생하는 화면이 아니라, 사용자가 그 시즌에 어떤 활동을 했고 최종적으로 어떤 결과를 맞았는지 회고하는 **시즌 결과 스냅샷 UI**로 본다. 따라서 시즌 종료 시 내부 운영 상태가 `ACTIVE → UNMATCHED`로 정리되더라도, 사용자가 그 시즌을 성공적으로 마친 경우 과거 시즌 요약/이력에서는 `매칭 성사` 결과를 우선 노출할 수 있다. 반대로 시즌 중 실제 매칭 해제 사건이 발생한 경우에는 `매칭 해제` 이력으로 노출할 수 있다.

과거 시즌 summary count는 아래 기준을 따른다.

- **대화 count**: `matched thread`, `read-only thread`를 포함해 **대화한 distinct 상대 수**로 센다.
- **보낸 요청 count**: 같은 시즌에 **요청을 보낸 distinct 상대 수**로 센다.
- **받은 요청 count**: 같은 시즌에 **요청을 받은 distinct 상대 수**로 센다.
- **최종 결과**: 운영 지표는 `ACTIVE` 도달을 따로 계산할 수 있지만, 사용자-facing 시즌 결과는 `seasonEndDate` 시점 snapshot success를 우선한다.

### UI 배치 (구현 참고 — 정책 아님)

> 아래는 현재 구현 방향 메모이며, 디자인 확정 후 변경될 수 있다.

매칭 탭 내부에서 현재 시즌과 과거 이력을 구분하여 접근할 수 있도록 한다. 홈 탭의 시즌 요약 카드에서 과거 이력으로 drill-down한다. 비시즌에는 과거 이력이 기본 노출된다. 구체적인 네비게이션 방식(서브탭, 아코디언, 드롭다운 등)은 디자인 확정 시 결정한다.

## 다음 시즌 예고

| 항목       | 정책                                                              |
| ---------- | ----------------------------------------------------------------- |
| 노출 방식  | 비시즌 메인 배너 (다음 시즌 등록 시 일정 표시 허용)               |
| 카운트다운 | 다음 시즌 등록 시 D-Day 표시 허용 (#184 결정, 사용자 기대감 유지) |
| Push 알림  | MVP에서는 두지 않음                                               |

## 1차 합격자 제한

| 항목           | 정책                       |
| -------------- | -------------------------- |
| 서비스 검증    | 별도 증빙 없이 자기 신고   |
| 거짓 입력 대응 | 사후 제재 + 시즌 리셋 자정 |

서비스는 학교의 호실 선택 권한을 직접 검증하지 않는다.
학교 시스템이 최종 권한을 가진다.

## 계정 삭제 retention transformation과 시즌 종료의 분리

시즌 종료(`seasonEndDate`)는 운영 관계를 past-season history로 전환하는 이벤트이고, 계정 삭제/비식별화는 별도의 retention transformation 이벤트다. 계정 삭제가 수락되면 current `UserDisplayIdentity`, `SeasonParticipantProfile`, session/account identity는 즉시 tombstone/minimize되며, nickname audit, season profile history, match history snapshot, chat message body 원문은 필요 범위에서 RRPD retained vault로 분리된다.

따라서 시즌 종료만으로 retained vault payload가 생성되지는 않는다. 반대로 계정 삭제가 발생하면 해당 사용자의 current/past season row는 season state와 별개로 user-facing full detail에서 제거되거나 `탈퇴한 사용자` summary로 degrade된다. 등록 완료 사용자의 현재 시즌 삭제 요청 차단 정책은 유지하며, 철회/종료 후 삭제가 수락되는 경우에도 retention target transformation은 deletion event 기준으로 실행한다.

## 변경 이력

> Superseded note: 아래 변경 이력의 legacy 용어(`UserProfile`, base profile, `messageToRoommate`, `LIMITED/FULL`, `full/gated`, 자동 `UNASSIGNED` 등)는 historical record다. 현재 정책은 이 문서의 본문과 최신 변경 이력 행을 따른다.

| 날짜       | 변경 내용                                                                                                                                                                                                                                                                                                      | 관련 이슈         |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| 2026-03-17 | 시즌 전환 테이블에 "재신청 차단/시도 횟수: 초기화" 추가                                                                                                                                                                                                                                                        | #151              |
| 2026-03-20 | 시즌별 기능 테이블: 신고·차단 행 추가, "같은 건물 배정 유저만" → "동일 건물 (건물 단위 격리)" 명확화, 비시즌 "읽기 전용" → "매칭 기능 비활성"                                                                                                                                                                  | Sprint 6          |
| 2026-03-20 | 시즌 전환 테이블에 "사용자 차단(Block) 목록: 유지" 행 추가. "재신청 차단" → "재신청 제한"으로 용어 명확화                                                                                                                                                                                                      | Sprint 6          |
| 2026-03-25 | 시즌 중 UNASSIGNED 유저 정책 신설: 프로필 탐색 불가(빈 리스트 + 건물 선택 유도 안내), 매칭·북마크 불가                                                                                                                                                                                                         | #112              |
| 2026-03-25 | **3-state 모델 전환**: 2-state(비시즌/시즌) → 3-state(OFF_SEASON/SEASON_OPEN/SEASON_MATCHING). 호실선택일 기반 자동화 공식 도입. APPROACHING_END 상태 폐기(daysUntilEnd UI 분기로 대체). 악용 방지 설계·입사 취소 처리 섹션 추가                                                                               | #112              |
| 2026-03-29 | **과거 시즌 이력 열람 정책 신설**: 사용자가 과거 시즌 매칭 이력을 UI에서 열람 가능. 닉네임(스냅샷)+상태+날짜 노출. 매칭도/건물/메시지 비노출. 탈퇴 상대 익명화. "초기화"와 "이력 보관" 구분 명확화. 상태별 기능 테이블·데이터 처리 테이블에 반영                                                               | #186              |
| 2026-03-29 | **다음 시즌 예고 정책 변경**: "카운트다운 두지 않음" → "다음 시즌 등록 시 D-Day 표시 허용". 사용자 기대감 유지 목적. Math.max(30일) 왜곡도 함께 제거                                                                                                                                                           | #184              |
| 2026-03-30 | 과거 시즌 이력 보강: 최종 상태 외에 사용자 관점의 **관계 맥락 태그(보낸 요청/받은 요청/대화/매칭 성사)** 를 보조 정보로 노출 가능하도록 명시                                                                                                                                                                   | #186              |
| 2026-03-30 | 과거 시즌 이력 열람 정책 보강: 과거 시즌 헤더에서 **본인 배정 건물 스냅샷(건물 단위)** 노출 허용. 인실/상대 건물은 계속 비노출                                                                                                                                                                                 | #186              |
| 2026-03-30 | 시즌 전환 데이터 처리 정밀화: "매칭 확정/대화 상태: 초기화" + "미결 신청: 자동 취소" → 상태별 터미널 전이로 통합(`PENDING`→자동취소, `IN_CONVERSATION`→자동종료, `ACTIVE`→자동해제). 이력 레코드는 data-retention.md #6 보관. 사용자 안내 "데이터 초기화 범위" 표현 정밀화                                     | #186              |
| 2026-04-22 | 시즌 모델을 **캠퍼스 시즌 윈도우 + 기숙사별 매칭 종료** 구조로 재정의. `SEASON_PREPARATION`, `SEASON_POST_MATCH` 추가. 캠퍼스 시즌은 `preparationStartDate`/`matchingStartDate`/`seasonEndDate`를 기준으로 하고, 실제 매칭 종료는 기숙사별 `roomSelectionDate`를 따른다                                        | #194              |
| 2026-04-22 | 사용자용 시즌 조회는 운영 캠퍼스 + 현재/예정 시즌 기준으로만 해석하고, 매칭 종료 countdown과 시즌 종료 countdown을 분리한다고 명시. 건물 master directory와 건물 선택 목록을 구분하고, 선택 목록은 현재/예정 시즌 운영 기숙사만 노출한다고 명시. 건물 상세/안내의 최소 노출 정보 기준 추가                     | #194              |
| 2026-04-24 | 사용자용 `seasons/current`와 `dormitories/selectable` 해석을 current season 기준으로 고정. future season preview는 별도 query/API responsibility로 분리하고, operated dormitory가 0개인 current season은 사용자 상태를 최대 `SEASON_PREPARATION`까지만 허용하도록 보강                                         | #193              |
| 2026-04-24 | 공개 프로필 탐색 범위를 same-gender cohort로 명시하고, `SEASON_POST_MATCH`를 확정 결과 확인/프로필 정리 기간으로 확정. `roomSelectionDate` 이후에도 확정 매칭 관계는 `seasonEndDate` 전까지 유지되며, 북마크 생성/해제도 계속 허용한다고 보강                                                                  | #193              |
| 2026-04-30 | `쪽지보내기`와 비매칭/확정 대화 쓰기 권한을 시즌 상태별 기능 테이블에 분리하고, 비매칭 대화는 `roomSelectionDate`, matched pair 대화는 `seasonEndDate`를 종료 기준으로 정리. 과거 시즌 summary count를 distinct-target 기준으로 보강                                                                           | #195              |
| 2026-05-03 | `SEASON_PREPARATION` canonical 용어를 `SEASON_OPEN`으로 전환. 시즌 참여자 등록과 시즌 참여 프로필 정책을 반영해 상태별 기능 허용 범위, 미참여/미배정 browse, post-match limited browse, matched partner read-only 정책을 정렬                                                                                  | #195              |
| 2026-05-04 | 시즌 종료와 계정 삭제/법적 보존 이벤트를 분리하고, 공개/결과 확인 정보가 보존 정책 범위 안에서 유지될 수 있음을 명시                                                                                                                                                                                           | #195              |
| 2026-05-07 | `SEASON_MATCHING`의 live `ActiveMatch` 사용자는 matched partner `FULL` + general `LIMITED` browse로 읽고, `SEASON_POST_MATCH`의 general browse는 **등록 완료 사용자 cohort 한정 LIMITED**로 해석한다고 명확화                                                                                                  | #195              |
| 2026-05-13 | 건물 선택은 `SeasonParticipant` 소유의 시즌성 데이터이며 `SEASON_OPEN`/`SEASON_MATCHING` 동안만 저장·patch하고, `SEASON_POST_MATCH` 이후와 `OFF_SEASON`에는 patch/계정 저장을 하지 않는다고 명시                                                                                                               | #211 / #76        |
| 2026-05-13 | 시즌 참여 철회를 상태별 기능으로 추가하고, current season 참여 중 계정 삭제 요청은 수락하지 않으며 시즌 종료 후 실제 삭제 요청이 가능하다고 명시                                                                                                                                                               | #76 / #195        |
| 2026-05-14 | 계정 삭제를 요청 수락 즉시 비식별화 + 정상 탈퇴 identifier anchor 5일 제한 보존으로 재정의하고, 시즌 종료와 삭제/비식별화 이벤트의 분리를 정합화                                                                                                                                                               | #76 / #148 / #195 |
| 2026-05-20 | #195 2026-05-20 결정에 맞춰 OFF_SEASON 타인 browse를 닫고, season profile 작성과 registration finalize를 분리했다. 기숙사 선택은 별도 season participation API/service가 소유하며 `ASSIGNED`가 registration 완료 조건이고, season final fields는 다음 시즌 current draft로 자동 이월하지 않는다고 정리         | #195              |
| 2026-05-21 | dormitory selection 저장을 current `SeasonParticipant` row의 `SELECTED + dormitoryId` draft로 명시하고, complete profile 전에도 registration 전 저장/변경 가능하되 finalize에서 complete profile + saved valid selection을 재검증한다고 정리                                                                   | #195              |
| 2026-05-25 | 시즌 종료와 계정 삭제 RRPD transformation을 분리하고, 삭제 수락 시 nickname/profile/match/chat 원문 payload가 retained vault로 이동한다는 기준을 추가                                                                                                                                                          | #195              |
| 2026-05-26 | `SEASON_POST_MATCH` summary browse를 viewer 등록 여부와 무관한 `CAMPUS_MERGED` read-only scope로 정리하고, detail/score/action은 capability별로 닫는다고 명시                                                                                                                                                  | #195              |
| 2026-05-27 | `SEASON_POST_MATCH`를 단일 read-only phase로 부르지 않고 action-closed browse/result-read context/read-only storage state를 분리해 해석하도록 정리                                                                                                                                                             | #195              |
| 2026-05-29 | 정책 문서의 날짜 고정/시간 의존 표현을 문서 본문, 날짜, 맥락 기준 표현으로 정리했다                                                                                                                                                                                                                            | #195              |
| 2026-06-01 | Issue #198 Phase 0 기준으로 시즌 상태 변화와 chat realtime 통지의 authority 경계를 추가했다. `roomSelectionDate`, `seasonEndDate`, 계정 삭제/비식별화에 따른 thread update/archive/tombstone 통지는 outbox/replay로 동기화하되, write/read 권한 결정은 시즌·채팅 DB 상태와 REST snapshot이 소유한다고 명시했다 | #198              |
| 2026-06-05 | API 구현 cleanup에서 season participant backfill owner를 lifecycle command로 이동했지만, backfill은 여전히 current season eligible verified users에 participant row를 보강하고 lifecycle event는 audit trace로만 남긴다는 정책을 유지한다고 명시했다                                                           | #222 / #224       |
| 2026-06-05 | season operations override는 current state 계산 override이며 audit/history 원장이 아니고, future row/current row/운영 campus semantics는 유지해야 한다고 명시했다. #209 cache는 request-level 최적화일 뿐 Postgres source of truth를 대체하지 않는다고 정리했다                                                | #208 / #209       |
| 2026-06-08 | 시즌 종료 시 bookmark cleanup owner와 시즌 안내의 in-app notification primary/Push 제외 경계를 notification-inbox.md와 정합화했다                                                                                                                                                                              | #196 / #220       |

## 원문 소스

- `docs/04_policy/season-policy.md`
- `docs/04_policy/eligibility.md`
- `docs/04_policy/profile-exposure.md`
