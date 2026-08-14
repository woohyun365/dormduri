# 이용 자격 정책

## 문서 범위

이 문서는 누가 가입할 수 있고, 누가 매칭에 참여할 수 있는지, 그리고 건물/캠퍼스 변경을 어떤 수준까지 허용하는지를 다룬다.

- 시즌별 기능 on/off: [season-lifecycle.md](./season-lifecycle.md)
- 시즌 참여자 등록의 의미와 등록 가능 시점: [season-participation.md](./season-participation.md)
- 프로필 수정 가능 범위: [profile-model.md](./profile-model.md)
- 매칭 상태 전이: [matching-lifecycle.md](./matching-lifecycle.md)

## 가입 자격

| 항목             | 정책                                         |
| ---------------- | -------------------------------------------- |
| 가입 대상        | `@kangwon.ac.kr` 이메일 인증이 가능한 재학생 |
| 가입 단계        | 이메일 인증만으로 가입 가능                  |
| 기숙사 입주 증빙 | 요구하지 않음                                |

서비스는 "재학생 인증", "season profile 작성", "dormitory selection draft 저장/변경", "시즌 registration finalize"를 분리해서 본다.
가입은 재학생이면 가능하고, 실제 매칭 참여는 **registration 완료(`REGISTERED + ASSIGNED + registeredAt + complete profile + SEASON_REGISTRATION snapshot`)** 이후 가능하다. Signup/auth는 profile orchestration을 하지 않는다.

## 시즌 참여자 등록 자격

| 항목                            | 정책                                                                                                                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| season profile 작성 가능 조건   | 회원가입 완료 + 운영 캠퍼스 + current season 존재 + `SEASON_OPEN`/`SEASON_MATCHING`                                                                                               |
| registration finalize 가능 조건 | complete season profile + 저장된 valid dormitory selection draft + registration lock 없음                                                                                         |
| 등록 가능 시점                  | `SEASON_OPEN`, `SEASON_MATCHING`                                                                                                                                                  |
| 등록 불가 시점                  | `OFF_SEASON`, `SEASON_POST_MATCH`                                                                                                                                                 |
| 등록 의미                       | current season의 `SeasonParticipantProfile`을 snapshot으로 고정하고, 저장된 기숙사 선택 draft를 `ASSIGNED`로 확정하며 `registeredAt`과 `SEASON_REGISTRATION` snapshot을 남긴 상태 |

## 매칭 참여 자격

| 항목                       | 정책                                                                                                                                                                                                                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 매칭 참여 조건             | 회원가입 완료 + 운영 캠퍼스 + current season + registration 완료 + `ASSIGNED` 기숙사 + 해당 기숙사 `roomSelectionDate` 전                                                                                                                                                                 |
| registration과 참여의 관계 | registration은 필요조건이지만, active match/read-only/safety 상태에 따라 action capability는 별도 판단                                                                                                                                                                                    |
| 기숙사 선택 의미           | 학교 배정 결과를 자기 신고해 registration 전 current `SeasonParticipant` row의 `dormitorySelectionState = SELECTED`, `dormitoryId != null`로 저장하는 행위. 별도 `UserDormitorySelection`/account-level row가 아니며, complete profile 전에도 저장 가능하고 registration 전까지 변경 가능 |
| registration finalize 의미 | complete profile과 저장된 valid dormitory selection draft를 재검증해 `REGISTERED + ASSIGNED + registeredAt + SEASON_REGISTRATION snapshot`으로 확정하는 행위                                                                                                                              |
| 입주 확인 방식             | 기숙사 선택 = 합격 선언                                                                                                                                                                                                                                                                   |
| 거짓 입력 대응             | 사후 제재 + 시즌 리셋 자정                                                                                                                                                                                                                                                                |

별도 증빙 업로드는 요구하지 않는다. 기숙사 배정 화면 캡처 제출은 관리자 리소스와 개인정보 노출 측면에서 채택하지 않는다.

## 사용자 상태

| 상태                      | 정의                                                                                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 계정 보유                 | 회원가입 완료, current season registration 없음                                                                                                             |
| season profile draft      | registration 전 current `SeasonParticipantProfile`이 있으나 public target/history row가 아닌 상태                                                           |
| dormitory selection draft | registration 전 current `SeasonParticipant` row에 `SELECTED + dormitoryId`가 저장된 상태. profile complete 여부와 무관하게 저장 가능하지만 참여 완료가 아님 |
| registration candidate    | complete season profile과 저장된 valid dormitory selection draft가 있어 finalize 가능한 상태                                                                |
| registration 완료         | `REGISTERED + ASSIGNED + registeredAt + complete profile + SEASON_REGISTRATION snapshot`                                                                    |
| 매칭 가능                 | registration 완료 + 시즌/노출/기숙사/성별/roomSelectionDate 조건 충족                                                                                       |
| 매칭 확정                 | 서비스 내 active match 완료                                                                                                                                 |

각 상태에서 가능한 기능의 시간축 차이는 [season-lifecycle.md](./season-lifecycle.md)를 따른다.

## 기숙사 선택 정책

| 항목              | 정책                                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 선택 정보 성격    | 희망 건물이 아니라 학교 배정 결과 입력                                                                                                                        |
| 입력 UI 원칙      | 전용 모달/전용 흐름 + 재확인 단계. complete profile 전에도 선택 저장은 가능하되 registration finalize에서 profile completeness를 재검증                       |
| write owner       | `PATCH /api/users/me`가 아니라 별도 season participation / dormitory selection API/service                                                                    |
| persistence owner | 별도 `UserDormitorySelection`/account-level row가 아니라 current season `SeasonParticipant.dormitorySelectionState`와 `SeasonParticipant.dormitoryId` columns |
| 시즌 매칭 중 변경 | registration 전에는 `roomSelectionDate` 전까지 저장/변경 가능. registration 후에는 선택 잠금                                                                  |
| 오입력 수정       | registration 전 사용자가 직접 변경. registration 후 오입력은 문의하기를 통한 관리자 처리                                                                      |
| 재검토 조건       | 오입력 문의 빈도가 의미 있게 높아질 경우                                                                                                                      |

기숙사 선택은 가벼운 preference 선택이 아니라, **registration 완료와 매칭 풀 진입을 위한 필수 입력**으로 본다. 단, registration 완료 자체는 저장된 기숙사 선택과 complete season profile을 함께 재검증하는 별도 finalize 단계에서만 확정된다.

사용자용 기숙사 **선택 목록**은 **current season의 운영 기숙사만** 노출한다. future season preview/사전 노출은 이 목록 책임이 아니며, 필요 시 별도 query/API로 분리한다.

## 캠퍼스 정책

| 항목        | 정책                                             |
| ----------- | ------------------------------------------------ |
| 캠퍼스 변경 | 관리자 요청으로만 변경                           |
| 근거        | 입학 시 고정 속성에 가깝고 변경 사례가 극히 드묾 |

### 캠퍼스 운영 상태

캠퍼스 운영 여부는 사용자 상태가 아닌 **캠퍼스 엔티티의 속성**(`isOperated`)으로 관리한다.

| 항목          | 정책                                                                   |
| ------------- | ---------------------------------------------------------------------- |
| 현재 운영     | `CHUNCHEON`만 `isOperated = true`                                      |
| 비운영 캠퍼스 | `SAMCHEOK`, `DOGYE` 등. 가입 가능, 매칭 서비스 미제공                  |
| 운영 전환     | `isOperated` 플래그 변경으로 즉시 기능 활성화. 사용자 상태 변경 불필요 |

### 비운영 캠퍼스 사용자 기능 범위

| 기능                | 비운영 캠퍼스                                                       | 운영 캠퍼스                                                                                  |
| ------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 가입/로그인         | 가능                                                                | 가능                                                                                         |
| 표시 identity 관리  | 가능                                                                | 가능                                                                                         |
| season profile 작성 | current season 리소스가 없으면 불가                                 | `SEASON_OPEN`/`SEASON_MATCHING` registration 전 가능                                         |
| 기숙사 선택         | 자동 `UNASSIGNED` 등록 완료를 만들지 않음. registration unavailable | registration 전 selection draft 저장/변경 가능                                               |
| 프로필 탐색         | OFF_SEASON과 current season 미운영 상태에서는 타인 browse 비활성화  | registration 완료 target summary 탐색                                                        |
| 매칭 신청           | **불가** (disabled + 안내)                                          | 가능 (`SEASON_MATCHING` + registration 완료 + `ASSIGNED` + 내 기숙사 `roomSelectionDate` 전) |
| 북마크              | **불가** (disabled + 안내)                                          | capability 허용 시 가능                                                                      |
| 신고                | **가능** (콘텐츠 안전)                                              | 가능                                                                                         |
| 차단                | **가능** (자기 보호)                                                | 가능                                                                                         |
| 채팅                | 불가                                                                | 가능                                                                                         |
| 과거 이력 열람      | **가능** (본인 이력)                                                | 가능                                                                                         |

비운영 캠퍼스 사용자에게는 운영 필요 기능을 비활성화하고 Main 진입 시 "이 캠퍼스는 현재 매칭 서비스를 운영하지 않습니다" 배너를 표시한다. 운영 캠퍼스가 아니거나 current season operated dormitory가 0개이면 `UNASSIGNED` 자동 등록 완료를 만들지 않고 registration unavailable / selection unavailable 상태로 안내한다.

### 비운영 캠퍼스의 사용자용 조회 해석

- 사용자용 기숙사 선택 목록은 빈 결과로 해석한다.
- 사용자용 `current season` 조회 리소스는 별도로 두지 않는다.
- 사용자용 공개 프로필 탐색은 current season registration 완료 cohort가 없으므로 타인 browse 비활성화로 해석한다.
- 즉, 비운영 캠퍼스는 가입/표시 identity/과거 이력 열람은 가능하지만, season registration finalize와 match/chat 리소스는 제공하지 않는다.

### 매칭 참여 자격 (내부 필터)

매칭 참여 조건에 캠퍼스 운영 상태와 `ASSIGNED` registration 완료 상태를 포함한다. UI에는 노출하지 않는 내부 필터링 요소다.

```
매칭 자격 = 회원가입 완료 + campus.isOperated = true + current season + REGISTERED + ASSIGNED + registeredAt + complete season profile + SEASON_REGISTRATION snapshot + roomSelectionDate 전
```

## 시즌 중 가입자

| 항목                         | 정책                                                                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 가입 허용                    | 허용                                                                                                                                   |
| signup profile orchestration | 없음                                                                                                                                   |
| season profile 생성          | `SEASON_OPEN`, `SEASON_MATCHING` registration 전 가능                                                                                  |
| registration finalize        | complete profile + 저장된 valid dormitory selection draft 통과 시 가능                                                                 |
| 이후 수정                    | registration 전만 가능. registration 후 season profile 잠금                                                                            |
| 기숙사 선택                  | 별도 season participation API로 registration 전 저장/변경 가능. complete profile은 선택 저장 조건이 아니라 registration completed 조건 |

## 자격 미충족 안내 원칙

| 상태                     | 정책                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| season profile 미완성    | 참여 버튼/API는 registration finalize 대신 profile completion 필요 상태를 반환                                                       |
| 기숙사 선택 전           | 매칭 기능은 비활성화되지만, 기숙사 선택 필요 상태를 인지 가능해야 함                                                                 |
| selection unavailable    | operated dormitory 없음, campus/gender mismatch, roomSelectionDate 경과 등은 registration unavailable / selection unavailable로 안내 |
| `UNASSIGNED` legacy 상태 | 참여 완료가 아니며, 새 코드 path에서 생성하지 않는다                                                                                 |
| 안내 방식                | disabled 액션 + 설명성 안내                                                                                                          |

정확한 UI/접근성 표현은 구현 이슈에서 정하되,
정책상 방향은 "숨김"보다 "인지 가능한 비활성"이다.

## 변경 이력

> Superseded note: 아래 변경 이력의 legacy 용어(`UserProfile`, base profile, `messageToRoommate`, `LIMITED/FULL`, `full/gated`, 자동 `UNASSIGNED` 등)는 historical record다. 현재 정책은 이 문서의 본문과 최신 변경 이력 행을 따른다.

| 날짜       | 변경 내용                                                                                                                                                                                                                                                                                                                              | 관련 이슈  |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 2026-03-14 | 캠퍼스 운영 상태·비운영 캠퍼스 기능 범위·매칭 참여 자격(내부 필터) 추가                                                                                                                                                                                                                                                                | #135       |
| 2026-03-20 | 비운영 캠퍼스 기능 범위 재설계: Mock Touring → UI 동일 + 운영 기능 Block. 신고·차단 허용 추가. 건물 배정 "불가" → "UNASSIGNED 자동 지정"으로 변경                                                                                                                                                                                      | Sprint 6   |
| 2026-03-25 | 자격 미충족 안내에 "UNASSIGNED (시즌 중)" 행 추가: 빈 리스트 + 건물 선택 유도                                                                                                                                                                                                                                                          | #112       |
| 2026-03-25 | 3-state 시즌 모델 반영: 건물 변경 "시즌 중 불가" → "시즌 매칭 중 불가 (시즌 오픈 첫 선택 허용)". 매칭 "시즌 중" → "시즌 매칭". 북마크 "시즌 중" → "시즌 오픈 + 시즌 매칭". 건물 입력 "가입 직후" → "시즌 오픈부터"                                                                                                                     | #112       |
| 2026-03-29 | 비운영 캠퍼스 기능 범위에 "과거 이력 열람: 가능" 행 추가                                                                                                                                                                                                                                                                               | #186       |
| 2026-04-22 | 사용자용 건물 선택 목록은 current season 운영 기숙사만 노출하고, 비운영 캠퍼스는 사용자용 current season 리소스를 별도로 두지 않는다고 명시. 건물 master directory와 건물 선택 목록을 구분                                                                                                                                             | #194, #193 |
| 2026-04-22 | 시즌 준비 기간(`SEASON_PREPARATION`) 명칭 반영. 매칭 신청은 시즌 매칭 + 건물 입력 + 해당 기숙사 `roomSelectionDate` 이전에만 가능하도록 정교화                                                                                                                                                                                         | #194       |
| 2026-04-24 | 비운영 캠퍼스의 공개 프로필 탐색 범위를 운영 캠퍼스 유저 열람 허용에서 **same-campus + same-gender browse-only**로 조정                                                                                                                                                                                                                | #193       |
| 2026-05-03 | 시즌 참여자 등록 정책을 반영해 매칭 참여 자격을 `가입 + 등록 + 건물 배정` 구조로 재정의하고, 등록 가능 시점과 상태 모델을 보강. `SEASON_OPEN` canonical 용어 반영                                                                                                                                                                      | #195       |
| 2026-05-04 | 운영 캠퍼스 current season의 `등록 + 미배정` / `UNASSIGNED` 사용자는 빈 리스트가 아니라 **same-campus + same-gender `LIMITED` browse**를 유지하고, 매칭·북마크·새 채팅만 비활성으로 본다고 정렬                                                                                                                                        | #195       |
| 2026-05-20 | #195 2026-05-20 결정에 맞춰 signup/profile orchestration과 자동 `UNASSIGNED` 등록 완료를 제거하고, registration 완료 조건을 `REGISTERED + ASSIGNED + complete season profile`로 정리했다. 비운영 캠퍼스/current season 선택 불가 상황은 registration unavailable로 안내하며 legacy `UNASSIGNED` browse 표현은 historical record로 둔다 | #195       |
| 2026-05-21 | dormitory selection을 registration 전 current `SeasonParticipant` row의 `SELECTED + dormitoryId` draft로 명시하고, 별도 account-level selection row 없이 registration 전 저장/변경 가능하되 finalize에서 complete profile과 함께 재검증한다고 정리했다                                                                                 | #195       |
| 2026-05-29 | 정책 문서의 날짜 고정/시간 의존 표현을 문서 본문, 날짜, 맥락 기준 표현으로 정리했다                                                                                                                                                                                                                                                    | #195       |
