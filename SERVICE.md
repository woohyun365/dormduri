# KNU Roommate — 서비스 설명

> 개발 과정과 기술 의사결정은 [README.md](./README.md)를 참고합니다.

## 한 줄 소개

KNU Roommate는 강원대학교 재학생이 시즌별 기숙사 배정과 생활패턴을 기준으로 룸메이트 후보를 탐색하고, 대화와 매칭 요청을 통해 최종 룸메이트를 결정하도록 돕는 서비스입니다.

## 해결하려는 문제

기숙사 룸메이트는 한 학기 생활 만족도에 큰 영향을 주지만, 실제로는 단톡방·커뮤니티·지인 소개처럼 파편화된 채널에 의존하는 경우가 많습니다.

이 방식에는 다음 문제가 있습니다.

- 흡연, 수면, 통화, 청결, 실내 취식 같은 생활 마찰 요소를 구조적으로 비교하기 어렵다.
- “좋은 사람”과 “같이 살기 편한 사람”을 구분하기 어렵다.
- 재학생 인증, 신고, 차단, 탈퇴 후 이력 처리 같은 안전장치가 약하다.
- 학교의 시즌/기숙사 운영 일정과 실제 룸메이트 찾기 흐름이 분리되어 있다.

KNU Roommate는 이 문제를 **학교 이메일 인증 + 시즌 registration + 생활패턴 기반 검색 + 같은 기숙사 매칭 + 제한적 데이터 보존 정책**으로 풀려고 합니다.

## 핵심 사용자

- 강원대학교 재학생
- 기숙사 입사를 준비하며 룸메이트를 미리 찾고 싶은 사용자
- 같은 기숙사 안에서 생활패턴이 맞는 후보를 비교하고 싶은 사용자
- 과거 시즌 매칭 결과와 채팅 이력을 안전하게 확인하고 싶은 사용자

가입과 매칭 참여는 같은 의미가 아닙니다. 가입은 학교 이메일 인증으로 가능하지만, 실제 룸메이트 탐색·매칭 action은 시즌 상태, 기숙사 선택, 프로필 완성도, registration 완료 여부에 따라 달라집니다.

## 서비스의 핵심 개념

### 1. 계정 identity와 시즌 프로필 분리

서비스는 사용자의 정보를 한 덩어리의 “프로필”로 보지 않습니다.

| 정보                              | 의미                                                             |
| --------------------------------- | ---------------------------------------------------------------- |
| `User`                            | 로그인 가능한 계정                                               |
| `UserDisplayIdentity`             | 닉네임 같은 표시 identity                                        |
| `UserAcademicIdentity`            | 단과대, 출생연도 같은 학업 identity                              |
| `SeasonParticipant`               | 특정 시즌에 참여하는 사용자 anchor                               |
| `SeasonParticipantProfile`        | 해당 시즌의 생활패턴/조건/추가 프로필 draft 또는 final aggregate |
| `SeasonParticipantProfileHistory` | registration 시점 또는 보존 사유가 있는 season profile snapshot  |

이 분리 덕분에 가입, 시즌 준비, 시즌 등록, 공개 탐색, 과거 이력, 탈퇴/비식별화를 서로 다른 정책으로 다룰 수 있습니다.

### 2. 시즌 registration

사용자는 가입만으로 바로 매칭 대상이 되지 않습니다.

시즌 registration은 다음이 모두 충족될 때 완료됩니다.

- 현재 시즌이 존재한다.
- 시즌 프로필 필수 항목이 complete 상태다.
- 기숙사 선택 draft가 저장되어 있고 현재 시즌에서 유효하다.
- 단과대/출생연도 같은 account academic identity가 존재한다.
- registration finalize transaction에서 `REGISTERED + ASSIGNED + registeredAt` 상태와 profile history snapshot이 함께 생성된다.

registration 전 profile draft와 dormitory selection draft는 독립적으로 저장할 수 있지만, public search/detail target은 registration 완료 participant만 될 수 있습니다.

### 3. 룸메이트 찾기

룸메이트 찾기 탭은 “타인의 전체 프로필을 무조건 나열하는 기능”이 아니라, 시즌 상태와 viewer 상태에 따라 허용된 summary list를 제공하는 기능입니다.

| scope                | 의미                                                                          |
| -------------------- | ----------------------------------------------------------------------------- |
| `CAMPUS_MERGED`      | 같은 캠퍼스 + 같은 성별 registration 완료 사용자의 넓은 미리보기 summary list |
| `SAME_BUILDING_ONLY` | 같은 기숙사 후보 또는 post-match cohort review list                           |

주요 정책은 다음과 같습니다.

- OFF_SEASON에는 타인 browse를 비활성화한다.
- 미등록 사용자는 active season에서 summary-only preview만 볼 수 있다.
- registration 완료 + 같은 기숙사 조건을 만족해야 detail, score, match/chat action이 열린다.
- active matched target은 신규 후보 discovery list에서는 제외하지만, post-match cohort review에서는 같은 기숙사 결과 확인 목적으로 포함될 수 있다.
- 정상 summary entry에서 진입한 detail만 tombstone degrade가 가능하고, URL 직접 입력·위조 token·만료 token은 fail-closed 처리한다.

### 4. 필터와 정렬

필터 UI가 현재 scope에서 어떤 필드를 사용할 수 있는지는 서버 manifest가 알려줍니다.

- `GET /api/roommate-search/manifest`는 scope별 filter/sort 가능성을 사전 제공한다.
- search response에도 manifest를 다시 포함해 stale UI state를 방어한다.
- `CAMPUS_MERGED`는 넓은 미리보기 성격이므로 필터를 열지 않는 방향이다.
- `SAME_BUILDING_ONLY`에서는 생활패턴, 단과대 include/exclude, 학년, MBTI trait, 나이 band, min score preset 같은 필터를 다룬다.
- cursor pagination은 offset 대신 signed cursor token과 query digest를 사용한다.
- score 정렬은 DB projection table을 미리 만들지 않고, same-dorm candidate를 제한한 뒤 application layer에서 query-time 계산한다.

### 5. 매칭과 채팅

매칭 요청과 채팅은 분리되어 있습니다.

- 매칭 요청은 profile/search/detail surface에서 `canRequestMatch = true`일 때 생성한다.
- 채팅 UI는 match request 생성 surface가 아니다.
- 첫 메시지를 보낼 때 thread가 생성된다.
- match request 수락 즉시 `ACTIVE` 매칭이 된다.
- `ACTIVE`가 되면 다른 pending request와 일반 conversation은 정리된다.
- matched pair thread는 `seasonEndDate` 전까지 쓰기 가능하고, 일반 thread는 `roomSelectionDate` 이후 read-only/archive로 전환된다.

thread가 열려 있어도 상태가 바뀌면 `canSendMessage=false`와 reason payload를 내려 UI가 “왜 입력이 닫혔는지” 설명할 수 있게 합니다.

### 6. 과거 이력과 탈퇴 사용자 처리

과거 최종 매칭 상대의 detail은 result-read context로 볼 수 있습니다. 다만 상대가 탈퇴했거나 비식별화된 경우에는 full detail을 복원하지 않고 `탈퇴한 사용자` 또는 tombstone/minimal result로 degrade합니다.

탈퇴 시에는 다음을 분리합니다.

- 사용자 화면에 남는 표시: 즉시 비식별화 또는 tombstone 처리
- 신고·분쟁·법적 보존을 위한 제한 보존 payload: retained vault로 분리
- 운영 접근: 목적, 승인 근거, 접근자, access log가 있어야만 가능

즉, 서비스는 “모든 데이터를 즉시 삭제”하거나 “사용자 화면에 계속 노출”하는 방식이 아니라, 사용자-facing 비식별화와 제한 보존을 분리합니다.

## 시즌별 사용자 경험

| 시즌 상태         | 미등록 사용자                                  | registration 완료 사용자                                          |
| ----------------- | ---------------------------------------------- | ----------------------------------------------------------------- |
| OFF_SEASON        | 타인 browse 없음. 자기 계정/과거 이력 중심     | 타인 browse 없음. 과거 이력과 결과 확인 중심                      |
| SEASON_OPEN       | 같은 캠퍼스 summary preview 가능               | campus summary + 같은 기숙사 detail/score/bookmark/chat 준비 가능 |
| SEASON_MATCHING   | summary preview 가능                           | 같은 기숙사 후보 detail/score, match request, chat action 가능    |
| SEASON_POST_MATCH | campus summary browse 가능, 신규 action은 닫힘 | same-dorm cohort review 가능. 신규 action보다 결과 read 중심      |

정확한 capability는 항상 서버가 계산한 `scopeAvailability`, `exposure`, `actions`, `resultRead`, `availabilityNotices`를 기준으로 합니다.

## 서비스가 보장하는 것

- 강원대학교 이메일 기반 최소 재학생 인증
- 시즌별 registration 완료 여부에 따른 search/detail/action 제한
- 생활패턴과 원하는 룸메 조건 기반 매칭 점수
- 같은 기숙사 중심 후보 탐색
- match request / active match / chat thread 상태 전이
- 탈퇴·비식별화된 사용자의 user-facing 정보 노출 제한
- retained vault 기반 제한 보존 foundation

## 서비스가 보장하지 않는 것

- 학교 기숙사 배정 자체
- 특정 호실 배정 성공
- 사용자가 입력한 프로필 내용의 절대적 진실성
- 외부 채널에서 이루어진 합의 결과
- 신고/분쟁/법적 판단의 자동 해결

KNU Roommate는 학교 기숙사 시스템을 대체하는 서비스가 아니라, 룸메이트 탐색과 합의 과정을 안전하고 구조적으로 돕는 서비스입니다.

## API 관점의 대표 흐름

```text
1. POST /auth/send-signup-code
2. POST /auth/verify-email-code
3. POST /auth/signup
4. GET  /api/users/me
5. PUT  /api/seasons/current/profile
6. POST /api/seasons/current/participation/dormitory-selection
7. POST /api/seasons/current/participation/registration
8. GET  /api/roommate-search/manifest?scope=SAME_BUILDING_ONLY
9. GET  /api/roommate-search?scope=SAME_BUILDING_ONLY&sort=MATCH_SCORE&limit=20
10. GET /api/profiles/:targetUserId?detailEntryToken=...
11. POST /api/matches/requests
12. POST /api/chat/messages
```

## 정책 문서

세부 운영 규칙은 로컬 정책 문서 세트를 source of truth로 둡니다.

- `docs/04_policy/official/account-authentication.md` — 계정/인증
- `docs/04_policy/official/profile-model.md` — account identity, season profile, field exposure
- `docs/04_policy/official/season-participation.md` — 시즌 참여 registration
- `docs/04_policy/official/roommate-searching.md` — search scope, manifest, summary/detail/action capability
- `docs/04_policy/official/matching-lifecycle.md` — match request, active match, score policy
- `docs/04_policy/official/chat-lifecycle.md` — chat thread lifecycle
- `docs/04_policy/official/data-retention.md` — 탈퇴, RRPD retained vault, disposal
- `docs/04_policy/official/legal-basis.md` — 법적 근거와 처리방침 기준
