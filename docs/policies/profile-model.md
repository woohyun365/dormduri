# 프로필 모델 정책

## 문서 범위

이 문서는 사용자-facing profile 필드의 구조, 닉네임 표시 identity, season profile 작성/잠금, 필드 레벨 public 노출 원칙을 다룬다.

- 계정/비밀번호/세션: [account-authentication.md](./account-authentication.md)
- 시즌별 기능 on/off: [season-lifecycle.md](./season-lifecycle.md)
- 시즌 참여자 등록과 시즌 참여 프로필: [season-participation.md](./season-participation.md)
- 매칭 계산 공식: [matching-lifecycle.md](./matching-lifecycle.md)
- 룸메이트 찾기 탭의 검색/필터 계약: [roommate-searching.md](./roommate-searching.md)

## 기본 식별/표시 필드

| 필드          | owner                                           | 정책                                                                                                                             |
| ------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `nickname`    | `UserDisplayIdentity`                           | 사용자 표시 이름. service-wide case-insensitive unique                                                                           |
| `gender`      | `User` / `SeasonParticipant.genderSnapshot`     | 가입 identity이며, 시즌 참여 row 생성 시 snapshot으로 고정해 matching/search 조건에 사용                                         |
| `campus`      | `User` / `SeasonParticipant.campusCodeSnapshot` | 계정 레벨 속성이며, 시즌 참여 row 생성 시 snapshot으로 고정                                                                      |
| `collegeCode` | `UserAcademicIdentity` / registration snapshot  | 계정 학업 identity. registration finalize 시 season profile/history snapshot에 복사                                              |
| `birthYear`   | `UserAcademicIdentity` / registration snapshot  | 계정 학업/연령 identity. registration finalize 시 season profile/history snapshot에 복사하고 search `ageBand` 계산 source로 사용 |

`UserProfile`은 더 이상 profile owner가 아니다. Signup/auth는 계정과 표시 identity를 생성할 뿐, lifestyle/condition/intro를 orchestration하지 않는다. Auth API와 auth module은 lifestyle parser를 소유하지 않으며, lifestyle/condition validation source는 shared lifestyle contract와 season-participants/profile domain이다.

### live 표시 identity와 registration snapshot

- `UserDisplayIdentity`는 계정의 live display identity owner다. current-user 계정/설정 화면과 닉네임 변경 정책은 이 값을 사용한다.
- draft/registration 준비 UI가 닉네임을 보여줘야 할 때는 `SeasonProfileDraftResponse`의 내부 snapshot을 기대하지 않고 `CurrentUserResponse.displayIdentity.nickname`을 표시 source로 사용한다. `SeasonProfileDraftResponse`는 season draft fields만 반환하며 nickname/display identity를 포함하지 않는다.
- `SeasonParticipantProfile.nicknameSnapshot`은 registration finalize 시점의 season-facing 표시 이름 snapshot이다.
- registration 완료 target의 roommate-search summary/detail, matched partner history read, past season result read는 `nicknameSnapshot`을 우선 사용한다.
- registration 전 draft self read는 live `UserDisplayIdentity`를 함께 보여줄 수 있지만, finalize 전까지 public target snapshot으로 취급하지 않는다.
- 일반 사용자 닉네임 변경은 current season에서 현재 registration 완료 상태인 동안 잠긴다. Registration 전 draft/selection-only 사용자는 기존 닉네임 정책을 통과하면 변경할 수 있고, 철회/거절 상태는 같은 시즌 재등록이 불가능하므로 current registration snapshot lock 대상에서 제외한다.
- 닉네임 변경은 이후 registration snapshot에만 반영된다. 이미 확정된 season registration history snapshot을 일반 사용자 변경으로 자동 변경하지 않는다. 신고/제재 등 운영자 override는 일반 `PATCH /api/users/me`가 아니라 별도 enforcement path에서만 예외적으로 처리한다.

## 닉네임 규칙

| 항목         | 정책                                                                                                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 길이         | NFKC canonicalization 이후 2자 이상 8자 이하                                                                                                                                                            |
| 허용 문자    | 완성형 한글 또는 ASCII 영문 중 한 문자 체계만 사용. 숫자는 함께 사용할 수 있지만 숫자만으로 구성할 수 없음                                                                                              |
| 혼합 문자    | `안녕hi`, `헬로world`처럼 한글과 영문을 섞은 닉네임은 moderation 전에 구조 오류로 거절                                                                                                                  |
| 공백         | 앞뒤 공백은 제거하며 내부 공백·구두점·기호·emoji·단독 자모는 허용하지 않음                                                                                                                              |
| 중복         | NFKC canonical value의 lowercase normalized key를 기준으로 서비스 전체 unique. DB `nicknameNormalized` unique constraint가 경쟁 상태의 최종 방어선                                                      |
| moderation   | 구조 검증을 통과한 뒤 PostgreSQL active moderation term을 적용. 사용자 오류에는 탐지된 금칙어를 노출하지 않음                                                                                           |
| 예약어       | 서비스 운영·tombstone 표시와 혼동되는 닉네임은 차단                                                                                                                                                     |
| 변경 주기    | 30일 1회. 단, current season에서 현재 registration 완료 상태이면 일반 사용자 닉네임 변경 action은 registration snapshot lock으로 거부한다. 현재 API error code는 `NICKNAME_LOCKED_BY_SEASON`을 유지한다 |
| lock 해제    | registration 전 draft/selection-only, current season 없음/OFF_SEASON, 철회/거절 상태는 registration snapshot lock 대상이 아니며 기존 30일/중복/예약어 정책만 따른다                                     |
| 제재 시 예외 | 신고/제재/개인정보 노출 대응을 위한 운영자 override path에서 임시 닉네임 대체와 30일 cooldown / registration snapshot lock 우회가 가능하다. 일반 사용자 API에는 노출하지 않는다                         |

### 예약어 규칙

| 언어 | 매칭 방식 | 예시                           |
| ---- | --------- | ------------------------------ |
| 한글 | 포함 검사 | 관리자, 운영자, 운영팀, 테스트 |
| 영문 | 정확 일치 | admin, system, test, demo      |

### canonicalization과 이력

- Shared `parseDisplayIdentityNickname`이 canonical display value, normalized key, 문자 체계를 함께 결정한다.
- 회원가입, 사용자 변경, 운영자 정책 변경은 같은 parser와 moderation owner를 사용한다.
- 새 정책은 신규 가입과 이후 변경부터 적용한다. 이미 확정된 시즌 프로필·매칭 이력의 닉네임 snapshot은 당시 표시값이므로 일괄 재작성하지 않는다.

## SeasonParticipantProfile 구조

사용자-facing "프로필"은 기본적으로 current season의 `SeasonParticipantProfile`을 뜻한다. 이 row는 current season draft/final aggregate이며, registration 전에는 self read/write draft, registration 후에는 final/read-only aggregate다. 비시즌에는 새 season profile을 생성/수정하지 않고, profile tab에서는 `UserDisplayIdentity`와 과거 season profile history를 읽는다. 다음 시즌은 이전 row를 자동 이월하지 않고 새 `SeasonParticipant`와 새 `SeasonParticipantProfile` draft를 만든다.

### 수면 패턴 (필수 6개)

| 필드               | 설명                                              |
| ------------------ | ------------------------------------------------- |
| `bedtime`          | 취침 시간                                         |
| `wakeTime`         | 기상 시간 (`FLEXIBLE` 포함)                       |
| `sleepHabit`       | 잠버릇                                            |
| `sleepEnvironment` | 잠들 때 소리 방식 (안 틀어요/이어폰/스피커)       |
| `screenUsage`      | 잠들 때 활동 (그냥 자요/음악만/영상·게임 등 화면) |
| `noiseSensitivity` | 잠귀                                              |

`screenUsage`와 `sleepEnvironment`는 조건부 관계다. `screenUsage`가 음악/영상일 때만 `sleepEnvironment`를 입력하고, 그냥 자요 선택 시 `sleepEnvironment`는 `QUIET`로 해석한다.

### 생활 패턴 (필수 8개)

| 필드                     | 설명                                    |
| ------------------------ | --------------------------------------- |
| `smokingBehavior`        | 흡연 여부                               |
| `indoorEating`           | 실내 취식                               |
| `phoneBehavior`          | 실내 통화 (전화, 디스코드 등 음성 대화) |
| `earphoneUsage`          | 이어폰 사용 (소리 출력 방식)            |
| `cleanLevel`             | 방 청소                                 |
| `drinkingFrequency`      | 음주 빈도 (4단계, public non-exposure)  |
| `relationshipStyle`      | 관계 스타일                             |
| `temperatureSensitivity` | 온도 민감도                             |

### 원하는 룸메 조건 (8개)

| 필드                    | 설명                | registration complete 요건 |
| ----------------------- | ------------------- | -------------------------- |
| `smokingTolerance`      | 흡연 여부           | 필수                       |
| `indoorEatingTolerance` | 실내 취식           | 필수                       |
| `phoneTolerance`        | 실내 통화 여부      | 필수                       |
| `earphoneExpectation`   | 이어폰 사용 여부    | 필수                       |
| `cleanExpectation`      | 방 청소             | 필수                       |
| `drinkingTolerance`     | 음주 (LOW_ONLY/ANY) | 필수, public non-exposure  |
| `sleepEnvPreference`    | 잘 때 스피커 볼륨   | 필수                       |
| `screenTolerance`       | 잘 때 화면 밝기     | 필수                       |

### Academic identity / Additional profile fields

| 필드          | owner                                          | registration complete 요건 | 정책                                                                                                                                                             |
| ------------- | ---------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `collegeCode` | `UserAcademicIdentity` → registration snapshot | 필수                       | 계정 학업 identity다. Season profile draft optional field가 아니며, finalize 시 `SeasonParticipantProfile`/`SeasonParticipantProfileHistory` snapshot에 복사한다 |
| `birthYear`   | `UserAcademicIdentity` → registration snapshot | 필수                       | exact birth year로 저장한다. `ageBand`는 search에서만 season reference year 기준으로 계산한다                                                                    |
| `grade`       | `SeasonParticipantProfile`                     | 필수                       | 시즌별 학년 additional profile. Registration 이후 다른 season profile field와 함께 잠근다                                                                        |
| `mbti`        | `SeasonParticipantProfile`                     | 필수                       | 프로필 작성/수정에서는 4자리 full MBTI(`ENFP` 등)를 요구한다. Search filter는 별도 `mbtiTraits` dimension pattern을 사용할 수 있다                               |

`collegeCode`와 `birthYear`는 더 이상 season draft의 optional additional 입력이 아니다. Account-level `UserAcademicIdentity`가 canonical owner이며, season registration은 해당 값을 snapshot으로 고정한다. Draft/registration 준비 UI가 단과대나 출생연도를 보여줘야 할 때도 `SeasonProfileDraftResponse`가 아니라 `CurrentUserResponse.academicIdentity`를 표시 source로 사용한다. `SeasonProfileDraftResponse`는 `grade`/`mbti` 같은 season additional draft만 반환하고 account academic identity를 포함하지 않는다. `UserAcademicIdentity`는 `UserDisplayIdentity`처럼 active verified account의 account identity invariant에 속한다. 누락은 정상 사용자 상태가 아니라 signup/account setup atomicity 위반 또는 migration gap이며, current-user도 `ACCOUNT_IDENTITY_INCOMPLETE / USER_ACADEMIC_IDENTITY_REQUIRED`로 fail-closed해야 한다. Registration finalize/public snapshot/search도 동일하게 fail-closed해야 한다. Current season registration 완료 후 일반 사용자 `UserAcademicIdentity` 변경도 registration snapshot lock으로 잠기며 API는 `ACADEMIC_IDENTITY_LOCKED_BY_REGISTRATION`을 반환한다. 그 외 correction policy 위반은 `birthYear`는 `ACADEMIC_BIRTH_YEAR_LOCKED_AFTER_REGISTRATION`, `collegeCode`는 `ACADEMIC_COLLEGE_CHANGE_ALLOWANCE_EXHAUSTED`처럼 field-specific code로 구분한다. `birthYear`는 1회 카운터가 아니라 최초 `SEASON_REGISTRATION` snapshot 존재 여부로 잠그며, 아직 한 번도 registration finalize를 완료하지 않았다면 account setup mistake correction을 횟수로 제한하지 않는다. `grade`와 full `mbti`는 season additional profile로 남지만 registration complete 필수 요건이다. `messageToRoommate`는 더 이상 profile field가 아니며 DB column/history/contract/public response/request schema/test에서 제거 대상이다.

### 텍스트

| 필드    | 정책                                                                                                                     |
| ------- | ------------------------------------------------------------------------------------------------------------------------ |
| `intro` | season profile 공개 텍스트, max 200. 입력은 optional이며 미작성 시 persistence/response는 빈 문자열 `''`로 normalize한다 |

Direct match request의 선택 note는 profile field가 아니라 request payload이며, 제한 길이와 moderation은 [matching-lifecycle.md](./matching-lifecycle.md)와 [community-safety.md](./community-safety.md)가 소유한다.

## 프로필 완성도 / 매칭 기능 준비도

| 항목                          | 정책                                                                                                                                                                                                                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| season profile draft          | `SEASON_OPEN` / `SEASON_MATCHING` registration 전까지 생성/수정 가능                                                                                                                                                                                                                                         |
| registration complete 요건    | 수면 6 + 생활 8 + 원하는 룸메 조건 8개 + account `UserAcademicIdentity(collegeCode, birthYear)` + season additional `grade`, full `mbti`가 complete이고, registration 전 저장된 valid dormitory selection draft가 finalize에서 `ASSIGNED`로 확정되어야 함. `intro`는 optional이며 빈 문자열로 normalize 가능 |
| 매칭/채팅/점수 노출 준비 완료 | registration complete(`REGISTERED + ASSIGNED + registeredAt + complete profile`) 이후 후속 owner가 capability를 계산                                                                                                                                                                                         |
| optional 텍스트               | `intro`는 optional input이며 completeness 필수 요건이 아니다. `collegeCode`, `birthYear`, `grade`, `mbti`는 registration complete 필수 요건이다                                                                                                                                                              |

## 프로필 계층 / persistence 정합성

| 계층                   | owner                             | 정책                                                                                                                                |
| ---------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 표시 identity          | `UserDisplayIdentity`             | `nickname`, `nicknameNormalized`, `nicknameChangedAt`만 소유                                                                        |
| current season profile | `SeasonParticipantProfile`        | current season draft/final aggregate row를 소유. registration 전 draft write model이고, registration 후 final/read-only aggregate다 |
| season profile history | `SeasonParticipantProfileHistory` | registration snapshot과 retention snapshot을 소유. current operational write model이 아니다                                         |

- `UserProfile` / `UserProfileHistory`는 profile canonical model에서 제거한다.
- `SeasonParticipantProfile`의 lifestyle / roommate condition / `intro` / season additional fields(`grade`, `mbti`)는 이번 scope에서 별도 DB component table로 분리하지 않는다. `collegeCode`/`birthYear`는 account academic identity에서 registration snapshot으로 복사된다.
- registration 전 current draft는 `updatedAt`만 갱신하고 history row를 만들지 않는다.
- registration 완료 transaction에서 current `SeasonParticipantProfile`을 final/read-only로 잠그고, 동시에 `SeasonParticipantProfileHistory(source = SEASON_REGISTRATION, registeredAtSnapshot)` row를 만든다.
- profile 문서의 `read-only`는 profile row의 사용자 write lock 또는 과거 snapshot read를 뜻한다. Roommate-search의 `summary-only` exposure, match/chat action capability, chat `READ_ONLY` thread status와 같은 계층이 아니다.
- `source = SEASON_REGISTRATION` row는 `registeredAtSnapshot`을 반드시 가진다. retention/admin/manual snapshot처럼 registration event가 아닌 row는 null을 허용한다.
- `seasonEndDate`는 current `SeasonParticipantProfile` row 삭제 이벤트가 아니다. current row는 해당 시즌의 final/read-only aggregate로 남고, past read는 history snapshot을 우선 사용한다.
- 다음 시즌 profile은 새 `SeasonParticipant` + 새 `SeasonParticipantProfile` draft로 생성한다. 이전 시즌 current/final row나 history snapshot을 다음 시즌 current profile로 자동 이월하지 않는다.

## 시즌별 작성/잠금 범위

### 기본 원칙

1. `OFF_SEASON`에는 current season profile create/edit을 열지 않는다. 사용자는 표시 identity와 과거 season profile/history만 읽거나 닉네임 정책에 따라 수정한다.
   - 직전 시즌 shortcut은 `GET /api/seasons/previous/profile`을 사용한다.
   - 종료된 특정 시즌의 자기 registration snapshot은 authenticated owner에 한해 `GET /api/seasons/:seasonId/profile/me`로 읽는다. 해당 시즌 참여자가 아니거나 registration snapshot이 없거나 redacted된 경우 full detail을 합성하지 않고 EMPTY로 응답한다.
2. `SEASON_OPEN` / `SEASON_MATCHING`에는 registration 전까지 current season profile을 생성/수정할 수 있다.
3. 기숙사 선택 저장은 registration 전 draft 상태이며 별도 `UserDormitorySelection`/account-level row가 아니라 current `SeasonParticipant` row의 `dormitorySelectionState = SELECTED`, `dormitoryId != null`만 저장한다. 이 단계에서는 complete profile, `REGISTERED`, `registeredAt`, history snapshot을 만들거나 요구하지 않고 registration 전까지 변경 가능하다.
4. 시즌 registration finalize는 저장된 기숙사 선택과 complete profile을 다시 검증한 뒤 같은 transaction에서 `REGISTERED + ASSIGNED + registeredAt + history snapshot`을 확정한다.
5. registration 이후에는 `SeasonParticipantProfile` 전체를 잠근다. Season additional fields(`grade`, `mbti`)도 예외 없이 함께 잠긴다. Account academic identity 변경은 일반 사용자 self-service로 registration snapshot에 소급 반영하지 않는다.
6. registration 이후 current season 동안 일반 사용자 live nickname 변경도 잠긴다. 이 lock은 현재 `isParticipantRegistered` 상태를 기준으로 하며, 철회/거절 상태는 재등록이 불가능하므로 lock 대상에서 제외한다.
7. `SEASON_POST_MATCH`는 결과 확인/정리 기간이며 current season profile과 등록 완료 사용자의 닉네임은 read-only다.

### 상태별 작성/잠금 매트릭스

| 항목 / 상태                                           | `OFF_SEASON`        | `SEASON_OPEN` registration 전   | `SEASON_OPEN` registration 완료        | `SEASON_MATCHING` registration 전 | `SEASON_MATCHING` registration 완료    | `SEASON_POST_MATCH`               |
| ----------------------------------------------------- | ------------------- | ------------------------------- | -------------------------------------- | --------------------------------- | -------------------------------------- | --------------------------------- |
| season profile create/edit                            | 불가                | 가능                            | 불가                                   | 가능                              | 불가                                   | 불가                              |
| `intro`                                               | 불가                | 가능(optional, 빈 문자열 허용)  | 잠금                                   | 가능(optional, 빈 문자열 허용)    | 잠금                                   | read-only                         |
| 수면/생활/조건 fields                                 | 불가                | 가능                            | 잠금                                   | 가능                              | 잠금                                   | read-only                         |
| account academic identity(`collegeCode`, `birthYear`) | account 정책에 따름 | registration 전 correction 가능 | snapshot 잠금                          | registration 전 correction 가능   | snapshot 잠금                          | snapshot read-only                |
| season additional fields(`grade`, `mbti`)             | 불가                | 가능·필수                       | 잠금                                   | 가능·필수                         | 잠금                                   | read-only                         |
| registration snapshot history                         | 생성 안 함          | 생성 안 함                      | finalize 시 1회 생성                   | 생성 안 함                        | finalize 시 1회 생성                   | 새 생성 없음                      |
| public target 노출                                    | 없음                | registration 전 노출 없음       | summary/detail capability owner가 계산 | registration 전 노출 없음         | summary/detail capability owner가 계산 | read-only capability owner가 계산 |

## 과거 final matched partner profile history read

사용자-facing 과거 시즌 이력에서 “최종 매칭 상대의 당시 프로필”을 열 때는 current season profile draft나 `SeasonMatchHistoryEntry`의 점수 계산용 lifestyle/condition snapshot 컬럼을 full profile source로 재사용하지 않는다. 단, `SeasonMatchHistoryEntry.matchScore` 자체는 profile detail source가 아니라 history result의 viewer 기준 점수 snapshot이므로 `MATCHED_SUCCESS` final counterpart full detail에서 score field로 노출할 수 있다.

| 항목                 | 정책                                                                                                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| owner                | `SeasonParticipantProfileHistory`                                                                                                                                                   |
| 조회 anchor          | `/api/matches/history`가 반환한 특정 이력 entry의 `entryId`                                                                                                                         |
| 권한                 | 해당 entry의 `viewerParticipantId` 소유자만 조회 가능                                                                                                                               |
| 허용 결과            | final matched partner profile read가 의미 있는 최종 매칭(`MATCHED_SUCCESS`) 이력. `UNMATCHED_AFTER_SUCCESS`는 summary history로만 유지                                              |
| snapshot 기준        | 해당 시즌 종료 시점 이하의 최신 season participant profile history row. 없으면 같은 시즌의 latest registration/retention snapshot fallback                                          |
| 비사용 source        | `SeasonMatchHistoryEntry`의 lifestyle/condition snapshot 컬럼은 full profile read source로 쓰지 않음                                                                                |
| 노출 필드            | detail capability가 허용하는 public fields와 viewer 기준 `matchScore` snapshot. `drinkingFrequency`, `drinkingTolerance`처럼 상대에게 공개하지 않는 필드는 포함하지 않음            |
| 탈퇴/비식별 우선순위 | target user/participant가 account deletion 또는 de-identification 상태이면 snapshot 존재 여부와 무관하게 user-facing full detail을 반환하지 않고 tombstone/minimal result로 degrade |

이 API는 사용자-facing final matched partner profile history read만 다룬다. admin/dispute/debug 조회, restricted audit query, backoffice permission matrix는 별도 후속 범위로 둔다. 신고/분쟁/법적 보존용 복원은 user-facing API가 아니라 restricted audit/backoffice workflow에서만 가능하다.

### 탈퇴/비식별화와 profile read 우선순위

Account deletion/de-identification 정책은 matched partner history read보다 우선한다. 정상 탈퇴 요청이 수락되면 current `SeasonParticipantProfile`은 user-facing search/detail/chat/profile-tab 경로에서 제거 또는 비식별화하고, `SeasonParticipantProfileHistory`도 user-facing full detail로 계속 노출하지 않는다. 탈퇴 후 past history는 `탈퇴한 사용자`, season result/status/date, 필요한 minimal summary 같은 tombstone/pseudonymized read model로 degrade하며, `intro`, optional additional, lifestyle/condition detail은 기본적으로 숨김/마스킹한다.

## 필드 레벨 노출 정책

### roommate-search summary card field set

룸메이트 찾기 summary card는 [roommate-searching.md](./roommate-searching.md)가 user-facing owner다. `profile-model.md`는 필드 source와 public non-exposure 원칙만 제공한다.

| 필드                | 정책                                                                                                                                                                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nickname`          | registration 완료 target summary/detail/history는 `SeasonParticipantProfile.nicknameSnapshot` 우선. current-user 계정/설정 화면은 live `UserDisplayIdentity` 사용. Current season registration 완료 후 일반 사용자 live nickname 변경은 registration snapshot lock으로 잠김 |
| `intro`             | season profile summary 텍스트                                                                                                                                                                                                                                               |
| `smokingBehavior`   | 핵심 생활 마찰 정보로 summary 노출                                                                                                                                                                                                                                          |
| `sleepHabit`        | 핵심 생활 마찰 정보로 summary 노출                                                                                                                                                                                                                                          |
| `relationshipStyle` | 관계 성향 판단용 summary 노출                                                                                                                                                                                                                                               |

Direct match request 수신 화면의 프로필 요약은 별도 profile field set을 만들지 않고 roommate-search summary projection을 재사용한다. Request note는 match request payload이며 profile field가 아니다.

Roommate-search summary에서 profile detail로 진입하는 경우에는 search response가 발급한 `detailEntryToken`으로 정상 entry context를 확인한다. 이 token은 권한 부여 수단이 아니라 “해당 viewer가 해당 season/search summary entry를 정상적으로 받았다”는 context proof이며, profile detail owner는 token 검증 후에도 최신 public target policy를 다시 계산한다. Full detail을 제공할 수 없으면 retained payload를 복원하지 않고 tombstone shell로 degrade할 수 있으며, token이 없거나 위조/만료된 direct/probing 접근은 fail-closed한다.

### detail field set / public non-exposure

상세 열람은 `canViewFull = true` / `detailViewable = true`인 target에 대해서만 가능하다. 상세에는 public non-exposure 필드를 제외한 season profile public lifestyle 필드를 제공한다.

| 필드                | 매칭 반영 | summary 노출 | detail 노출 | 사유                                |
| ------------------- | --------- | ------------ | ----------- | ----------------------------------- |
| `drinkingFrequency` | O         | X            | X           | 사회적 낙인으로 정직 응답 저해 가능 |
| `drinkingTolerance` | O         | X            | X           | 조건 노출 시 역추론 가능            |

음주 정보는 매칭 점수에는 반영되지만, roommate-search summary와 detail 둘 다에서 표시하지 않는다. 음주 쌍(Pair 2)의 쌍별 점수도 호환성 상세에 표시하지 않는다. 단, self read/write와 completeness 규칙에서는 다른 lifestyle/condition 필드와 동일하게 다룬다.

## Onboarding dismissed notice

Signup/auth는 profile orchestration을 하지 않는다. 가입 후 서비스 소개/onboarding modal의 “다시 보지 않음” 상태는 profile field가 아니라 `UserDismissedNotice(userId, noticeKey, dismissedAt)` 같은 범용 dismissed notice로 저장한다.

- 신규 가입자는 해당 notice가 없거나 false/null 상태다.
- Dismiss API가 호출되면 current-user read model에서 dismissed 상태를 true로 보여준다.
- 이 flag는 season profile 생성 여부, registration 완료 여부, matching/chat capability와 독립이다.

## 설계 원칙

1. Profile canonical source는 `SeasonParticipantProfile`이다.
2. Signup/auth는 profile orchestration을 하지 않는다.
3. Season profile과 season registration은 분리한다.
4. Registration snapshot은 season profile 공개/탐색/매칭 참여 시작 시점을 고정한다.
5. Summary/detail/score/history projection owner를 분리한다.
6. 필드 구조 변경은 이 문서가 단독 소유하고, search UX는 [roommate-searching.md](./roommate-searching.md)가 소유한다.

## RRPD retained vault와 profile history minimization

`SeasonParticipantProfileHistory`는 registration evidence와 과거 matched partner profile read의 canonical source지만, 계정 삭제/비식별화 이후에도 full lifestyle/additional snapshot을 hot row에 계속 보존하는 저장소가 아니다. 삭제 사용자의 history 원문 payload는 `RetainedVaultObject(target = SEASON_PROFILE_HISTORY)`로 이동하고, hot history row는 `redactedAt`, `redactionReason`, `retainedVaultObjectId`를 남긴 뒤 nickname tombstone과 nullable detail field로 최소화한다.

사용자-facing 과거 matched partner detail은 final history가 `MATCHED_SUCCESS`인 최종 매칭 상대에 한해 `redactedAt IS NULL`인 history row만 full-detail source로 사용할 수 있다. `UNMATCHED_AFTER_SUCCESS`는 summary history로만 유지한다. Redacted row 또는 삭제/비식별 target은 retained vault를 복원하지 않고 `detailState = TOMBSTONE`, `canViewFull = false`인 minimal detail shell로 degrade할 수 있다. 운영/신고/분쟁/법적 보존 목적의 복원은 profile API가 아니라 RRPD disclosure workflow에서 approval/access log를 남기고 수행한다.

## 변경 이력

> Superseded note: 아래 변경 이력의 legacy 용어(`UserProfile`, base profile, `messageToRoommate`, `LIMITED/FULL`, `full/gated`, 자동 `UNASSIGNED` 등)는 historical record다. 현재 정책은 이 문서의 본문과 최신 변경 이력 행을 따른다.

| 날짜       | 변경 내용                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 관련 이슈      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| 2026-03-19 | 룸메 조건 재설계: 조건 선택화(음주만 필수), 음주 가입 시 고정(비시즌 1회 변경), screenTolerance 3옵션(NO_SCREEN/LOW_OK/SCREEN_OK), drinkingTolerance 2옵션(LOW_ONLY/ANY), cleanExpectation 태도 기반 통일                                                                                                                                                                                                                                                                      | #157           |
| 2026-03-19 | 생활 패턴 재설계: indoorEating/phoneBehavior/earphoneUsage/drinkingFrequency enum 변경, indoorEatingTolerance 추가 (조건 8개), cleanLevel 필드명 변경                                                                                                                                                                                                                                                                                                                          | #157           |
| 2026-03-19 | `screenUsage` 필드 추가 (수면 6개), `screenTolerance` 조건 추가 (조건 7개). sleepEnvironment를 소리 전용으로 재정의. 소리/빛 2축 분리                                                                                                                                                                                                                                                                                                                                          | #157           |
| 2026-03-20 | 음주 변경 정책 명확화: "닉네임 정책과 동일 패턴" → "비시즌당 1회 (닉네임 30일 1회보다 엄격, 게이밍 방지)". 음주 쌍별 점수도 호환성 상세 비노출 명시 (역추론 방지)                                                                                                                                                                                                                                                                                                              | Sprint 6       |
| 2026-03-20 | 조건 미입력 게이팅 기준 구체화: "8개 중 하나라도 null이면 해당 사용자의 관점 점수 잠금" 명시. 양방향(A→B, B→A) 독립 판정 기술                                                                                                                                                                                                                                                                                                                                                  | #157           |
| 2026-03-24 | UI 게이팅 3-state 도입: full(양쪽 완성→min) / partial(나만 완성→단방향 perspectiveScore) / gated(내가 미완성→잠금). 완성 유저가 미완성 유저를 볼 때 내 기준 점수 표시 (뱃지 `(!)` + 안내)                                                                                                                                                                                                                                                                                      | #178           |
| 2026-03-25 | 시즌별 수정 가능 범위 테이블 2열(비시즌/시즌) → 3열(비시즌/시즌 오픈/시즌 매칭)로 확장. 시즌 오픈 = 전체 수정 가능, 시즌 매칭 = 잠금. 수정 원칙 갱신                                                                                                                                                                                                                                                                                                                           | #112           |
| 2026-03-25 | 추가 프로필(college, grade, mbti, birthYear) 시즌 중 "고정" → "수정 가능"으로 변경. 매칭 점수에 영향 없는 정보이므로 잠금 불필요                                                                                                                                                                                                                                                                                                                                               | #112           |
| 2026-03-30 | 음주 편집 정책 단순화: drinkingFrequency→일반 생활패턴과 동일, drinkingTolerance→일반 조건과 동일. 전용 행 삭제, 원칙 #2/#3/#6 수정                                                                                                                                                                                                                                                                                                                                            | #186           |
| 2026-03-30 | 음주 수정 기간 3-state 반영: "비시즌당 1회" → "비시즌 + 시즌 오픈 기간에 1회". 시즌 오픈은 매칭 시작 전이므로 변경 허용. 수정 원칙 #6 및 시즌별 수정 가능 범위 테이블 갱신                                                                                                                                                                                                                                                                                                     | #186           |
| 2026-04-22 | 시즌 상태를 `SEASON_PREPARATION` / `SEASON_MATCHING` / `SEASON_POST_MATCH`로 재정의하고, 시즌 마감 정리 기간의 프로필 수정 원칙을 별도 검토 항목으로 분리                                                                                                                                                                                                                                                                                                                      | #194           |
| 2026-04-24 | 닉네임 변경 가능 기간을 시즌 외 30일 1회로 재정의하고, `SEASON_POST_MATCH`에서 프로필 수정은 재허용하되 닉네임은 `seasonEndDate` 전까지 고정하도록 확정                                                                                                                                                                                                                                                                                                                        | #193           |
| 2026-04-30 | direct match request 수신 화면의 프로필 요약 필드를 `nickname`, `intro`, `messageToRoommate(optional)`, `smokingBehavior`, `sleepHabit`, `relationshipStyle`로 명시하고, request note를 프로필 필드와 분리                                                                                                                                                                                                                                                                     | #195           |
| 2026-05-07 | `SEASON_POST_MATCH`를 기본 프로필 복귀 구간이 아니라 **현재 시즌 프로필 read-only 유지 구간**으로 명확화. 포스트매치 동안 프로필 수정은 전면 불가하고, 기본 프로필 수정 재개는 `OFF_SEASON`부터라고 정리                                                                                                                                                                                                                                                                       | #195           |
| 2026-05-11 | 원하는 룸메 조건 8개를 전부 nullable로 재정의하고, 시즌 참여 등록 요건을 핵심 프로필(수면/생활 패턴) 완성으로 분리. 매칭 점수는 viewer 기준 단방향 단일값으로 고정하고 `full/gated` 2-state만 유지하도록 정책 갱신                                                                                                                                                                                                                                                             | #195           |
| 2026-05-12 | 음주 필드(`drinkingFrequency`, `drinkingTolerance`)의 현재 특별취급은 프로필/상세 비노출만 남고, signup/base profile/season profile의 저장·수정·완성도 규칙은 다른 lifestyle/condition 필드와 동일하다고 명확화                                                                                                                                                                                                                                                                | #195           |
| 2026-05-12 | 시즌 참여 등록 요건을 `수면/생활 패턴 + 원하는 룸메 조건` 전체 complete로 확장하고, 시즌 프로필 수정 시 null 재도입을 금지하는 invariant를 추가. `gated`는 persisted score state가 아니라 점수 미생성 상태라고 명확화                                                                                                                                                                                                                                                          | #195           |
| 2026-05-13 | 과거 final matched partner profile history read는 `SeasonParticipantProfileHistory`의 시즌 최종 snapshot을 source로 삼고, score snapshot 컬럼을 full profile source로 재사용하지 않으며 public `FULL` 비노출 필드는 계속 숨긴다고 명시                                                                                                                                                                                                                                         | #212 / #148    |
| 2026-05-13 | `messageToRoommate`를 season-local 필드가 아니라 추가 프로필과 같은 sync 대상 필드로 정리. `SEASON_OPEN`/`SEASON_MATCHING` 등록 사용자의 수정은 base profile과 season profile에 함께 반영되고, 비시즌에도 마지막 공개 메시지가 이어진다고 명시                                                                                                                                                                                                                                 | #195           |
| 2026-05-20 | #195 2026-05-20 결정에 맞춰 base `UserProfile`/signup profile orchestration을 제거하고, profile 개념을 `SeasonParticipantProfile` 중심으로 단일화했다. `messageToRoommate`를 제거하고 `intro`와 optional additional fields(`collegeCode`, `grade`, `mbti`, `birthYear`)를 season profile 필드로 고정했으며, current row와 history snapshot 역할, live `UserDisplayIdentity`와 `nicknameSnapshot`, deletion/de-identification 우선순위, summary/detail capability 용어를 재정의 | #195           |
| 2026-05-21 | dormitory selection draft가 profile completeness와 독립적으로 current `SeasonParticipant` row에 저장되고, registration finalize에서 complete profile과 함께 `ASSIGNED`로 확정된다는 전제를 프로필 완성도/잠금 범위에 정합화했다                                                                                                                                                                                                                                                | #195           |
| 2026-05-25 | RRPD retained vault 기준에 맞춰 `SeasonParticipantProfileHistory`의 원문 payload 분리, hot row minimization, `redactedAt IS NULL` detail source 원칙을 추가                                                                                                                                                                                                                                                                                                                    | #195           |
| 2026-05-26 | 같은 nickname 변경 요청은 error가 아니라 `SAME_NICKNAME` no-op metadata로 성공 반환하며, 이 판정은 registration snapshot lock/cooldown/moderation/unique check보다 먼저 수행한다고 명시                                                                                                                                                                                                                                                                                        | #195           |
| 2026-05-27 | profile read-only 표현을 registration 이후 write lock / snapshot read 의미로 한정하고, summary-only exposure·action capability·chat `READ_ONLY` thread와 구분했다                                                                                                                                                                                                                                                                                                              | #195           |
| 2026-05-27 | 과거 matched partner detail source를 final history `MATCHED_SUCCESS`로 제한하고, `UNMATCHED_AFTER_SUCCESS`는 summary history로만 유지한다고 명시                                                                                                                                                                                                                                                                                                                               | #195           |
| 2026-05-27 | 탈퇴/비식별·redacted target은 retained vault 복원 없이 tombstone detail shell로 degrade할 수 있다고 명시                                                                                                                                                                                                                                                                                                                                                                       | #195           |
| 2026-05-27 | 과거 최종 매칭 상대(`MATCHED_SUCCESS`) full detail에서 `SeasonMatchHistoryEntry.matchScore`를 viewer 기준 과거 점수 snapshot으로 노출할 수 있고 tombstone detail에는 score를 포함하지 않는다고 명시                                                                                                                                                                                                                                                                            | #195           |
| 2026-05-28 | search summary entry 기반 profile detail 진입은 `detailEntryToken`으로 context를 확인하고, full detail 불가 시 retained payload 복원 없이 tombstone shell로 degrade한다고 명시했다                                                                                                                                                                                                                                                                                             | #195           |
| 2026-05-29 | `collegeCode`/`birthYear`를 account-level `UserAcademicIdentity`로 승격하고, `grade`/full `mbti`를 season additional 필수 요건으로 정리했다. `intro`는 optional input + 빈 문자열 response/persistence로 전환하고, MBTI profile write와 search trait filter의 책임을 분리했다. Nickname과 academic identity의 registration 이후 self-service 잠금을 `registration snapshot lock` 용어로 통일하고, academic identity 전용 lock/correction error code를 명시했다                 | #195           |
| 2026-05-29 | `UserAcademicIdentity`를 active verified account invariant이자 registration readiness input으로 명시하고, missing identity는 current-user/registration finalize/public snapshot/search 모두 fail-closed한다고 정리했다                                                                                                                                                                                                                                                         | #195           |
| 2026-05-29 | 정책 문서의 날짜 고정/시간 의존 표현을 문서 본문, 날짜, 맥락 기준 표현으로 정리했다                                                                                                                                                                                                                                                                                                                                                                                            | #195           |
| 2026-05-30 | draft/registration 준비 UI의 account 표시 source를 명확화했다. 닉네임은 `CurrentUserResponse.displayIdentity`, 단과대/출생연도는 `CurrentUserResponse.academicIdentity`를 사용하며 `SeasonProfileDraftResponse`에는 account identity를 포함하지 않는다고 명시했다                                                                                                                                                                                                              | #195           |
| 2026-05-30 | `birthYear` correction은 1회 카운터가 아니라 최초 `SEASON_REGISTRATION` snapshot 존재 여부 기준이며, registration finalize 전에는 횟수 제한 없이 account setup mistake correction을 허용한다고 명시했다                                                                                                                                                                                                                                                                        | #195           |
| 2026-06-04 | Auth 제품 정책 기준을 반영했다. auth/signup은 lifestyle/condition/intro parser를 소유하지 않고, lifestyle validation owner는 shared lifestyle contract와 season-participants/profile domain이라고 명시했다                                                                                                                                                                                                                                                                     | Auth 제품 완성 |
| 2026-07-28 | 닉네임을 NFKC canonicalization 이후 한글 또는 영문 단일 문자 체계로 제한하고, 숫자-only·mixed-script를 구조 오류로 분리했다. Shared parser → DB moderation → normalized unique constraint 순서와 과거 season snapshot 비재작성 원칙을 명시했다                                                                                                                                                                                                                                 | #299           |
