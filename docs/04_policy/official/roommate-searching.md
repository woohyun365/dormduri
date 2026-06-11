# 룸메이트 찾기 정책

## 문서 범위

이 문서는 `룸메이트 찾기 탭`의 검색 범위, summary card, detail 권한, 점수/필터/정렬 capability를 다룬다.

- 시즌 참여 registration 완료 조건: [season-participation.md](./season-participation.md)
- 프로필 필드 의미와 노출 원칙: [profile-model.md](./profile-model.md)
- 매칭 점수 의미: [matching-lifecycle.md](./matching-lifecycle.md)
- 채팅/매칭 capability 전제: [chat-lifecycle.md](./chat-lifecycle.md), [access-eligibility.md](./access-eligibility.md)

이 문서가 **룸메이트 찾기 검색 UX와 필터링 contract의 최종 소유 문서**다.

## 검색 owner / detail owner

- roommate-search는 **여러 사람의 카드용 summary list 조회**를 소유한다.
- profile API(`GET /api/profiles/:targetId`)는 **detail 조회**만 소유한다.
- 이 문서에서 별도 단서 없이 쓰는 `browse` / `탐색`은 기본적으로 **roommate-search summary 탐색**을 뜻한다.
- roommate-search는 season state와 scope purpose에 따라 **신규 후보 탐색 list** 또는 **post-match cohort review list**를 제공한다. 현재 active matched 상태인 target은 public target 자체가 아니어서가 아니라, 신규 후보가 아니므로 discovery list에서 제외한다. 단, `SEASON_POST_MATCH + SAME_BUILDING_ONLY` cohort review에서는 신규 후보 탐색이 아니므로 active matched target도 같은 기숙사 cohort에 포함할 수 있다.
- 카드 목록은 `exposure.listSummaryVisible = true`인 target만 반환한다.
- Search response item에는 정상 summary entry에서 진입했음을 증명하는 `detailEntryToken`을 포함한다. 이 token은 권한 부여 수단이 아니라 context proof이며, detail API는 token 검증 후에도 요청 시점의 정책을 다시 계산한다.
- 정상 summary entry에서 detail로 진입한 경우, full detail 권한이 없어도 서버는 retained payload를 복원하지 않고 `detailState = TOMBSTONE`, `canViewFull = false`, `detailViewable = true`인 안내 shell을 반환할 수 있다.
- 목록 응답 이후 target이 탈퇴/비식별화/숨김/매칭 상태 변경/registration snapshot redaction 등으로 full detail을 더 이상 제공할 수 없어도, 유효한 entry context가 있으면 tombstone으로 degrade할 수 있다.
- URL 직접 입력, 임의 targetId 호출, token 없음/위조/만료처럼 정상 entry context를 확인할 수 없는 detail 호출은 `404 PROFILE_NOT_VISIBLE` 또는 동등한 permission error로 fail-closed 처리한다.

## 정책 용어 / capability 계층

이 문서에서 쓰는 `summary`, `detail`, `action`, `read-only`는 같은 계층이 아니다. 특히 `summary`는 특정 FE component 이름이 아니라 API/read-model의 **목록용 최소 projection**을 뜻한다. FE는 이 projection을 카드, 리스트, row 등 어떤 UI로도 표현할 수 있다.

| 축                       | 질문                                 | canonical 표현                                        | 정책 의미                                                                                                           |
| ------------------------ | ------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Public target relation   | 이 target은 viewer와 어떤 관계인가?  | `GENERAL`, `MATCHED_PARTNER`                          | `GENERAL`은 matched partner가 아닌 public target이고, `MATCHED_PARTNER`는 viewer의 확정 매칭 상대 context다         |
| Exposure level           | 이 target을 어디까지 볼 수 있는가?   | list-summary exposure, detail-viewable, score-visible | `exposure.listSummaryVisible`, `exposure.detailViewable`/`exposure.canViewFull`, `exposure.scoreVisible`로 분리한다 |
| Action capability        | 지금 새 행동을 할 수 있는가?         | action-open/action-closed                             | `actions.canBookmark`, `actions.canRequestMatch`, `actions.canStartChat` 같은 CTA/command 가능 여부다               |
| Result-read context      | 이미 형성된 결과·관계·이력을 읽는가? | result-read                                           | matched partner result, past match history, existing thread처럼 이미 생성된 row/context를 읽는 경우다               |
| Thread/Profile read-only | 저장 모델이 쓰기 잠김 상태인가?      | `READ_ONLY` thread, final/read-only profile aggregate | chat thread status 또는 registration 이후 profile write lock을 뜻한다. list-summary exposure와 같은 말이 아니다     |

용어 규칙:

- `summary-only`는 **list-summary exposure만 가능하고 detail/score가 닫힌 상태**를 뜻한다. Action capability는 별도 축이지만, summary-only target은 대부분 match/chat action도 함께 닫힌다.
- `read-only`는 가능하면 저장 모델/결과 읽기 맥락에만 쓴다. `READ_ONLY` 대문자 표기는 chat thread status를 뜻한다.
- `SEASON_POST_MATCH` 전체를 단일 “read-only phase”로 부르지 않는다. 정확히는 **general target은 action-closed list-summary browse**, matched/result context는 **result-read**, matched thread는 `seasonEndDate` 전까지 write 예외를 가진다.

## 검색 scope / canonical query root

룸메이트 찾기 검색은 아래 두 scope만 지원한다.

| scope                | 의미                                                              |
| -------------------- | ----------------------------------------------------------------- |
| `CAMPUS_MERGED`      | 같은 캠퍼스 + 같은 성별의 registration 완료 target summary를 조회 |
| `SAME_BUILDING_ONLY` | 같은 기숙사 후보 또는 post-match cohort를 조회                    |

중요:

- OFF_SEASON 타인 browse는 비활성화한다.
- 특정 다른 건물 하나를 지정하는 검색은 지원하지 않는다.
- Search canonical query root는 `User`/base profile이 아니라 current season의 `SeasonParticipant`다.
- Target cohort는 registration 완료 participant만 포함한다: `REGISTERED + ASSIGNED + registeredAt + complete SeasonParticipantProfile + SEASON_REGISTRATION snapshot + visible participant`. Registration 전 `SELECTED` selection draft는 public search target이 아니다.
- Active matched target은 위 public target cohort에 속할 수는 있지만, roommate-search 신규 후보 discovery list에서는 제외한다. Current matched partner, request/chat, past final matched history는 search discovery가 아니라 각 도메인의 result-read/context owner가 처리한다.
- `GENERAL` target은 위 public target cohort 중 viewer의 `MATCHED_PARTNER`가 아닌 target을 뜻한다.
- `MATCHED_PARTNER` target은 viewer와 이미 확정된 match/result context가 있는 target이며, 일반 action target과 별도로 result-read detail/score가 열릴 수 있다.
- Registration 전 current draft profile은 self read model에만 쓰며 public search target이 아니다.
- Hidden/deactivated/withdrawn/expired/deleted/deidentified participant는 summary/detail/action capability에서 제외한다. `hiddenByAdminAt`/`deactivatedAt`은 current visibility projection으로, `WITHDRAWN`/`EXPIRED`는 terminal participant status로, deleted/deidentified는 identity/retention owner의 fail-closed 상태로 해석한다.

## 시즌 상태별 검색 결과 해석

| 상태                | viewer 상태                             | 허용 scope                            | 검색 대상                                                                  | 결과 해석                                                                                                                                                                           |
| ------------------- | --------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OFF_SEASON`        | 전체                                    | 없음                                  | 없음                                                                       | 타인 browse 비활성화. profile tab self history/read만 별도 지원                                                                                                                     |
| `SEASON_OPEN`       | 미등록 또는 selection-required          | `CAMPUS_MERGED`                       | registration 완료 participant                                              | list-summary exposure 가능, detail/score/action 불가                                                                                                                                |
| `SEASON_OPEN`       | registration 완료 + `ASSIGNED`          | `CAMPUS_MERGED`, `SAME_BUILDING_ONLY` | registration 완료 participant                                              | list-summary exposure는 가능. 같은 dormitory target만 detail/score/bookmark/chat 가능. 다른 dormitory target은 summary-only + action-closed                                         |
| `SEASON_MATCHING`   | 미등록 또는 selection-required          | `CAMPUS_MERGED`                       | registration 완료 participant                                              | list-summary exposure 가능, detail/score/action 불가                                                                                                                                |
| `SEASON_MATCHING`   | registration 완료 + `ASSIGNED` + 미매칭 | `SAME_BUILDING_ONLY`                  | registration 완료 same-dormitory participant                               | same-dormitory target만 detail/score/bookmark 가능. match request/chat write는 `roomSelectionDate` 전까지만 가능                                                                    |
| `SEASON_MATCHING`   | live `ActiveMatch` 있음                 | `SAME_BUILDING_ONLY`                  | 신규 후보 discovery list에서는 active matched target 제외                  | roommate-search는 신규 후보가 아니면 제외한다. Current matched partner detail/score는 search가 아니라 result-read context에서 유지한다                                              |
| `SEASON_POST_MATCH` | 전체                                    | `CAMPUS_MERGED`                       | active matched target을 제외한 registration 완료 participant               | `GENERAL` target은 action-closed list-summary browse. matched partner detail/score는 search가 아니라 result-read context로만 유지하며 target deletion/de-identification 정책이 우선 |
| `SEASON_POST_MATCH` | registration 완료 + `ASSIGNED`          | `SAME_BUILDING_ONLY`                  | 같은 기숙사 registration 완료 participant. active matched target 포함 가능 | `POST_MATCH_COHORT_REVIEW` 목적의 same-dorm cohort list. 신규 후보/action 목적이 아니므로 filter/score/action은 닫고 `NICKNAME` cursor만 제공한다                                   |

`SEASON_MATCHING`에서 `CAMPUS_MERGED`와 `SAME_BUILDING_ONLY`는 같은 registration 완료 viewer에게 동시에 기본 탐색 범위로 열리는 개념이 아니다. 미등록/selection-required viewer는 summary-only `CAMPUS_MERGED` browse만 가능하고, registration 완료 + `ASSIGNED` viewer는 action precondition과 같은 dormitory boundary를 공유하기 위해 `SAME_BUILDING_ONLY`를 사용한다. `SEASON_OPEN`과 `SEASON_POST_MATCH`는 summary browse의 성격이 다르므로 registration 완료 viewer에게도 `CAMPUS_MERGED` summary를 허용할 수 있다. 다만 `SEASON_OPEN`의 다른 dormitory target은 summary-only이며, bookmark는 매칭 후보를 같은 dormitory 안에서 빠르게 다시 찾기 위한 action이므로 허용하지 않는다. `SEASON_POST_MATCH + SAME_BUILDING_ONLY`는 action 후보 탐색이 아니라 같은 기숙사 cohort review이므로 active matched target을 포함할 수 있지만, filter/score/action은 열지 않는다.

### `SEASON_POST_MATCH` summary scope

`SEASON_POST_MATCH`는 신규 registration/match/direct-chat action을 닫는 **action-closed result period**이지, summary browse cohort를 registration 완료 viewer에게만 축소하는 구간이 아니다. 따라서 POST summary list의 기본 scope는 viewer 등록 여부와 무관하게 `CAMPUS_MERGED`다. 단, registration 완료 + `ASSIGNED` viewer가 같은 기숙사 season cohort를 회고/확인하는 `SAME_BUILDING_ONLY` scope를 요청할 수 있으며, 이 scope는 `POST_MATCH_COHORT_REVIEW` purpose로 active matched target을 포함할 수 있다. 이 경우에도 detail/score는 matched partner result-read context에서만 유지되고, 삭제/비식별 target은 tombstone/minimal result가 우선한다.

`canEnterRoommateSearch` 같은 current-user coarse capability는 “검색 탭 진입 가능”만 의미하며, detail/score/action 가능 여부는 search item의 `exposure.canViewFull`, `exposure.detailViewable`, `exposure.scoreVisible`, `actions`를 따라야 한다. Search response의 scope 사용 가능 여부는 item capability와 분리된 `scopeAvailability`가 표현한다.

### Discovery availability notice

Search response는 user payload를 다시 노출하지 않는 response-level 안내로 `availabilityNotices`를 제공할 수 있다.

| code                               | 의미                                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| `MATCHED_TARGETS_EXCLUDED`         | active matched target은 신규 후보가 아니므로 discovery list에서 제외됐다      |
| `DISCOVERY_ACTIONABLE_ONLY`        | 현재 list는 신규 후보 탐색/action candidate 중심으로 구성됐다                 |
| `SCOPE_RESTRICTED_BY_VIEWER_STATE` | viewer의 registration/selection 상태 때문에 사용할 수 있는 scope가 제한됐다   |
| `POST_MATCH_ACTION_CLOSED`         | post-match 기간에는 summary browse는 가능하지만 신규 action은 닫혀 있다       |
| `DETAIL_UNAVAILABLE_BY_POLICY`     | 일부 summary-visible target은 detail 진입 시 정책 안내 tombstone이 될 수 있다 |

Notice는 `code`, `severity`, optional `message`로 구성한다. 정책 검증과 서버 테스트는 `code` 중심으로 고정하고, 문구는 제품 surface에서 override할 수 있다. Safety/hidden/deleted로 제외된 target 수나 identity는 notice로 노출하지 않는다. Active matched 제외 count도 roommate-search response 1차 계약에는 포함하지 않으며, 필요하면 별도 집계 service가 제공한다.

### result-read와 현재 활동 read의 구분

`resultRead.context`는 roommate-search/profile detail item이 “이미 형성된 match/result 관계”를 근거로 detail/score를 열 수 있는지를 설명하는 target-context flag다. 예를 들어 `CURRENT_MATCHED_PARTNER`는 viewer가 현재 active matched 상대를 결과 맥락에서 읽는 경우다. 과거 match history의 `PAST_MATCH_HISTORY` detail은 그 시즌의 최종 매칭 상대(`MATCHED_SUCCESS`)에게만 열며, `UNMATCHED_AFTER_SUCCESS`는 summary history로만 남긴다.

반면 내가 보낸/받은 pending match request, request 취소, 수락/거절, 기존 thread 목록 같은 **현재 활동 read/command**는 match/chat owner가 소유한다. 이들은 `resultRead.context`가 `NONE`이어도 각 도메인 API에서 조회될 수 있다. 즉 `result-read`는 “모든 읽기 가능성”이 아니라, public target/profile item에서 **결과 관계 때문에 열리는 detail/score 읽기 맥락**이다.

## Summary card / detail / score capability

Public contract는 `LIMITED/FULL` exposure enum을 쓰지 않고 아래 capability를 내려준다.

| field/capability                                   | 정책                                                                                                     |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `relation.type`                                    | `GENERAL` / `MATCHED_PARTNER` target 관계                                                                |
| `exposure.listSummaryVisible`                      | search result에 summary projection을 포함할지 여부                                                       |
| `exposure.canViewFull` / `exposure.detailViewable` | detail API를 열 수 있는지 여부                                                                           |
| `exposure.scoreVisible`                            | `matchScore`를 summary/detail에 포함할 수 있는지 여부                                                    |
| `actions.canBookmark`                              | same-dormitory candidate bookmark 가능 여부. 다른 dormitory 또는 result-only target에는 열지 않는다      |
| `actions.canRequestMatch`                          | match request CTA 가능 여부                                                                              |
| `actions.canStartChat`                             | chat UI entry / first message 가능 여부                                                                  |
| `actions.unavailableReasons`                       | action-closed 이유. 사용자-facing 문구는 client/제품 문구 owner가 변환                                   |
| `resultRead.context`                               | `NONE`, `CURRENT_MATCHED_PARTNER`, `PAST_MATCH_HISTORY`, `EXISTING_THREAD` 등 이미 형성된 결과 읽기 맥락 |

### Bookmark action/list contract

`actions.canBookmark`는 target이 bookmark 가능한지를 나타내는 action capability다. 실제 bookmark relation과 list는 `social-safety/bookmarks`가 소유하며, 이 문서는 public target projection이 bookmark owner에게 제공해야 하는 read 기준만 정의한다.

| 항목               | 정책                                                                                                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| action open        | same-dormitory, detail-viewable, registration 완료, hidden/deactivated/withdrawn/expired/deleted/deidentified 제외, `SEASON_OPEN`/`SEASON_MATCHING` action window |
| action closed      | 다른 dormitory, summary-only target, result-only target, `SEASON_POST_MATCH`, `roomSelectionDate` 이후, viewer/target matched 확정                                |
| list target filter | active bookmark row가 있어도 현재 public target으로 노출 불가하면 list에서 제외 또는 tombstone/degrade                                                            |
| sort               | `RECENT`는 bookmark relation 시간 기준. `MATCH_SCORE`는 현재 visible target subset에만 적용                                                                       |
| empty state        | 저장된 row가 없거나 visible target이 없으면 empty list와 `emptyState` metadata를 반환                                                                             |

### Summary card field set

모든 summary-visible target은 detail 가능 여부와 무관하게 동일 field set을 사용한다.

| 필드                                               | 정책                                                                                                           |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `profileSummary.nickname`                          | registration 완료 target은 `SeasonParticipantProfile.nicknameSnapshot`; 탈퇴/비식별 target은 tombstone display |
| `profileSummary.intro`                             | season profile 소개                                                                                            |
| `profileSummary.smokingBehavior`                   | 핵심 생활 마찰 정보                                                                                            |
| `profileSummary.sleepHabit`                        | 핵심 생활 마찰 정보                                                                                            |
| `profileSummary.relationshipStyle`                 | 관계 성향 정보                                                                                                 |
| `exposure.canViewFull` / `exposure.detailViewable` | detail 가능 여부                                                                                               |
| `exposure.scoreVisible` / `matchScore?`            | score 가능 target에만 포함                                                                                     |
| `actions`                                          | `canRequestMatch`, `canStartChat`를 안정적으로 boolean 제공                                                    |

`messageToRoommate`는 summary/detail/request schema에서 제거한다. `collegeCode`/`birthYear`는 account academic identity에서 registration snapshot으로 고정되고, `grade`/`mbti`는 season additional profile이다. 이 값들은 summary 기본 field set에는 포함하지 않으며, manifest가 허용하는 detail-capable scope filter에서만 사용한다.

### Detail / score

- Full detail은 `exposure.canViewFull = true` target만 허용한다.
- 정상 summary entry에서 진입했지만 full detail을 볼 수 없는 target은 `detailEntryToken` 검증 후 tombstone shell로 안내할 수 있다.
- `detailEntryToken`이 없거나 위조/만료/다른 viewer·season·target에 대해 재사용되면 direct/probing 접근으로 보고 `404 PROFILE_NOT_VISIBLE`로 닫는다.
- `matchScore`는 `exposure.scoreVisible = true` target에만 포함한다.
- `drinkingFrequency`, `drinkingTolerance`는 public non-exposure 필드이므로 summary와 detail 둘 다에서 보이지 않는다.
- 타인의 roommate condition fields는 detail에 노출하지 않는다.
- 미등록 viewer 또는 selection-required viewer는 시즌 기간 등록 완료 target summary를 볼 수 있으나, detail/score/match/chat action은 닫힌다.

## Manifest / filter 정책

Roommate-search는 UI가 현재 scope에서 어떤 필터/정렬을 열 수 있는지 선제적으로 알 수 있도록 manifest를 제공한다. Manifest는 UI 편의를 위한 advisory가 아니라 BE query validation의 공개 계약이다. Search response의 manifest가 항상 최종 authoritative이며, 별도 preflight endpoint는 UX 최적화용이다.

### Manifest 제공 방식

| surface                           | 정책                                                                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Search response embedded manifest | 모든 search response에 현재 `scope`, `purpose`, `filter`, `sort`, `manifestRevision`, `availabilityNotices`를 포함한다          |
| Preflight endpoint                | scope toggle/bottom sheet를 미리 구성하기 위해 같은 manifest를 제공한다. 실제 제출 검증은 search response/owner가 다시 수행한다 |
| manifestRevision                  | scope-specific manifest hash + active college catalog revision을 포함한다. 보안 토큰이 아니라 drift detection key다             |
| stale manifest                    | stale preflight로 불가능한 query가 제출되면 `400 INVALID_ROOMMATE_SEARCH_QUERY`로 닫고 최신 manifest 기반 재동기화를 유도한다   |

### Scope purpose와 필터 가능 범위

| scope / purpose                                                                       | 필터 정책                                                                                                                  | 정렬 정책                                                         |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `CAMPUS_MERGED` / broad preview                                                       | 필터 없음. 넓은 미리보기 목록이며 summary-safe filter도 제공하지 않는다                                                    | `NICKNAME` cursor                                                 |
| `SAME_BUILDING_ONLY` / actionable detail discovery (`SEASON_OPEN`, `SEASON_MATCHING`) | detail-capable target을 대상으로 lifestyle public fields + academic/additional filters를 제공한다                          | `MATCH_SCORE` cursor를 기본 후보로 제공, `NICKNAME` fallback 가능 |
| `SAME_BUILDING_ONLY` / cohort review (`SEASON_POST_MATCH`)                            | 결과 회고용 same-dorm cohort list. 신규 action 목적이 아니므로 additional/detail filter와 score sort는 1차 제공하지 않는다 | `NICKNAME` cursor                                                 |

`CAMPUS_MERGED`에서 필터를 두지 않는 이유는 field가 summary에 보인다는 사실만으로 그 field를 filtering oracle로 열면 scope purpose가 흐려지기 때문이다. `summary-only` exposure는 list-summary projection을 안정적으로 제공하기 위한 노출 계층이고, filter availability는 별도 manifest owner가 `scope purpose + viewer state + season state`로 결정한다.

### Filter field contract

| field                   | query shape                                                                                 | 허용 scope                                       | 정책                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| lifestyle public fields | dotted scalar params (`smokingBehavior=NO` 등)                                              | `SAME_BUILDING_ONLY` actionable detail discovery | 상대의 공개 가능한 생활/수면 profile field 기반 filter                                                                      |
| `college`               | `college.operator`, `college.values[]`                                                      | `SAME_BUILDING_ONLY` actionable detail discovery | viewer campus active college catalog 안에서 `INCLUDE` 또는 `EXCLUDE` 단일 operator만 허용                                   |
| `grade`                 | `grade.operator`, `grade.values[]` 또는 구현 단계의 동등 normalized shape                   | `SAME_BUILDING_ONLY` actionable detail discovery | season additional profile 기반 filter                                                                                       |
| `mbtiTraits`            | `mbtiTraits.energy`, `mbtiTraits.perception`, `mbtiTraits.decision`, `mbtiTraits.lifestyle` | `SAME_BUILDING_ONLY` actionable detail discovery | profile write는 full MBTI를 요구하지만 search는 각 차원 one-of 또는 wildcard(null)를 허용                                   |
| `ageBand`               | `ageBand.values[]`                                                                          | `SAME_BUILDING_ONLY` actionable detail discovery | account `birthYear` snapshot을 season reference year 기준 bucket으로 계산                                                   |
| `minScore`              | `minScore=90\|80\|70\|60`                                                                   | `SAME_BUILDING_ONLY` actionable detail discovery | query-time score calculation 이후 적용되는 post-score threshold filter. `minScore`만 요청해도 `MATCH_SCORE` 정렬로 적용된다 |

공통 validation:

1. 상대의 원하는 룸메 조건 기반 필터는 두지 않는다.
2. `CAMPUS_MERGED`에서 어떤 filter든 요청하면 `400 INVALID_ROOMMATE_SEARCH_QUERY`다.
3. `SAME_BUILDING_ONLY`라도 current purpose가 cohort review이거나 detail/action discovery가 아니면 additional/detail filter를 닫는다.
4. 같은 field에서 include와 exclude를 동시에 허용하지 않는다.
5. `excludeMyCollege` 같은 FE convenience shortcut은 BE contract에 두지 않는다. FE는 current-user/manifest를 바탕으로 `college.operator=EXCLUDE&college.values[]=...`를 구성한다.
6. Valid filter 결과가 0명이면 400이 아니라 200 empty list + `FILTER_RESULT_EMPTY` availability notice를 반환한다.
7. Nested filter는 GET dotted query params로 직렬화하고, API boundary normalizer가 query digest 계산 전에 typed normalized object로 변환한다.
8. `minScore`는 DB candidate filter가 아니라 score 계산 이후의 post-score filter다. `minScore + sort=NICKNAME`은 의미 충돌이므로 `400 INVALID_ROOMMATE_SEARCH_QUERY`다.

### Option source

| option             | source                                                                    |
| ------------------ | ------------------------------------------------------------------------- |
| lifestyle enum     | shared const/schema                                                       |
| grade enum         | shared const/schema                                                       |
| MBTI full options  | shared 16-combo const/schema                                              |
| MBTI trait options | shared dimension const/schema                                             |
| ageBand            | season reference year와 birthYear policy에서 계산한 shared bucket         |
| college            | viewer campus active `CollegeMaster` catalog 또는 동등 reference endpoint |

## 정렬 / pagination 정책

| 정렬          | 정책                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `NICKNAME`    | `SeasonParticipantProfile.nicknameNormalizedSnapshot + participantId` cursor boundary                                                       |
| `MATCH_SCORE` | viewer 기준 query-time score calculation 결과를 사용하고, `matchScore DESC + nickname + participantId` deterministic cursor boundary를 사용 |

중요:

- Cursor-only pagination을 사용하며 offset compatibility bridge를 두지 않는다.
- Request는 `limit`, `cursor?`, `scope`, `sort`, dotted filters를 사용한다. Response는 `pageInfo.nextCursor`, `pageInfo.hasNextPage`, `availabilityNotices`, manifest를 제공한다.
- Cursor는 HMAC signed opaque token이며 viewer/season/scope/sort/query digest/last item boundary/expiry를 포함한다.
- Cursor TTL은 10분이다. 만료, signature mismatch, query digest mismatch는 `400 INVALID_ROOMMATE_SEARCH_QUERY`다.
- `MATCH_SCORE` sort는 `SAME_BUILDING_ONLY` actionable detail discovery에서만 제공한다. `CAMPUS_MERGED`와 `SEASON_POST_MATCH` cohort review는 `NICKNAME` sort를 사용한다.
- `MATCH_SCORE` 계산은 user-facing request 시점의 최신 public target policy와 filter 결과를 기준으로 수행한다.
- `minScore` threshold는 cursor `queryDigest`에 포함된다. 같은 cursor를 다른 threshold에 재사용하면 `400 INVALID_ROOMMATE_SEARCH_QUERY`다.
- Score cache/projection은 1차 canonical 정책이 아니다. 성능 병목이 실측되면 bounded cache를 별도 후속으로 도입하되, cache는 correctness source가 아니라 performance hint로만 취급한다.

## 변경 이력

> Superseded note: 아래 변경 이력의 legacy 용어(`UserProfile`, base profile, `messageToRoommate`, `LIMITED/FULL`, `full/gated`, 자동 `UNASSIGNED` 등)는 historical record다. 현재 정책은 이 문서의 본문과 최신 변경 이력 행을 따른다.

| 날짜       | 변경 내용                                                                                                                                                                                                                                                                                              | 관련 이슈          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| 2026-06-05 | public target cohort 제외 조건을 hidden/deactivated/withdrawn/expired/deleted/deidentified matrix로 명확화하고, `hiddenByAdminAt`/`deactivatedAt`은 current visibility projection, `WITHDRAWN`/`EXPIRED`는 terminal participant status로 해석한다고 정리했다                                           | #222 / #223 / #196 |
| 2026-05-31 | `MATCH_SCORE` cursor 정책에 `minScore` preset post-score filter를 추가했다. 허용 preset은 90/80/70/60점 이상이며, threshold는 cursor queryDigest에 포함한다                                                                                                                                            | #195               |
| 2026-05-31 | `MATCH_SCORE` 정렬 정책을 precomputed table root에서 query-time score calculation + deterministic cursor로 재정의하고, repair/coverage notice를 1차 runtime contract에서 제거했다                                                                                                                      | #195, #247         |
| 2026-05-29 | 정책 문서의 날짜 고정/시간 의존 표현을 문서 본문, 날짜, 맥락 기준 표현으로 정리했다                                                                                                                                                                                                                    | #195               |
| 2026-05-29 | filter manifest를 canonical query contract로 추가하고, `CAMPUS_MERGED` no-filter, `SAME_BUILDING_ONLY` detail discovery filter, `SEASON_POST_MATCH + SAME_BUILDING_ONLY` cohort review, dotted query params, `college` negative filter, `mbtiTraits`, `ageBand`, score cursor 정책을 명시했다          | #195               |
| 2026-05-28 | roommate-search를 신규 후보 discovery surface로 고정하고 active matched target을 discovery list에서 제외한다고 명시했다. 정상 summary entry detail 진입용 `detailEntryToken`, tombstone 안내 shell, cursor-only pagination, `availabilityNotices` 계약을 추가했다                                      | #195               |
| 2026-05-27 | full detail 가능 target이 race/state change로 더 이상 full profile을 제공할 수 없을 때 retained payload 복원 없이 tombstone detail을 반환하는 정책을 추가했다                                                                                                                                          | #195               |
| 2026-05-27 | 과거 match history detail은 최종 매칭 상대(`MATCHED_SUCCESS`)에게만 허용하고, `UNMATCHED_AFTER_SUCCESS`는 summary history로만 유지한다고 명시했다                                                                                                                                                      | #195               |
| 2026-06-08 | bookmark action/list contract를 `actions.canBookmark`와 public target projection 관점에서 보강하고, visible target subset/empty state/sort 기준을 명시했다                                                                                                                                             | #196               |
| 2026-05-27 | bookmark를 same-dormitory candidate action으로 한정하고, 다른 dormitory target은 summary가 보여도 bookmark/action을 닫는다고 명시했다. `resultRead.context`가 current activity read 전체가 아니라 public target detail/score의 결과 관계 맥락임을 보강했다                                             | #195               |
| 2026-05-27 | shared/API v1 contract를 `relation`/`exposure`/`actions`/`resultRead`/`profileSummary` 축 구조로 교체하고, search scope 가능 여부를 `scopeAvailability`, current-user 검색 진입 가능 여부를 `canEnterRoommateSearch`로 명명했다                                                                        | #195               |
| 2026-05-27 | `summary-only`, action capability, result-read, `READ_ONLY` thread/profile write lock을 서로 다른 정책 축으로 분리하고, `GENERAL`/`MATCHED_PARTNER` target 용어를 명시했다                                                                                                                             | #195               |
| 2026-05-26 | `SEASON_MATCHING`에서는 registration 완료 viewer가 `SAME_BUILDING_ONLY`를 쓰고, 미등록/selection-required viewer만 summary-only `CAMPUS_MERGED`를 쓴다는 scope 분리를 명시했다                                                                                                                         | #195               |
| 2026-05-26 | `SEASON_POST_MATCH` summary scope를 viewer 등록 여부와 무관한 `CAMPUS_MERGED` read-only browse로 확정하고, detail/score는 matched partner capability로만 유지된다고 명시했다                                                                                                                           | #195               |
| 2026-05-21 | search target cohort에서 registration 전 `SELECTED` selection draft를 제외하고, `REGISTERED + ASSIGNED + registeredAt + complete profile + SEASON_REGISTRATION snapshot` 상태만 public target으로 본다고 명시했다                                                                                      | #195               |
| 2026-05-20 | #195 2026-05-20 결정에 맞춰 OFF_SEASON 타인 browse를 비활성화하고 search root를 `SeasonParticipant`로 고정했다. `LIMITED/FULL` 결과 모드를 제거하고 `relation`/`exposure`/`actions`/`resultRead` capability로 카드·상세·점수·액션을 분리했으며, summary-only filter는 visible summary field로 제한했다 | #195               |
| 2026-05-12 | 문서 신설. `룸메이트 찾기 탭`의 검색 scope(`CAMPUS_MERGED`, `SAME_BUILDING_ONLY`), 시즌 상태별 노출 해석, `LIMITED/FULL`별 필터 가능 범위, `FULL` 전용 detail/score 규칙을 정리                                                                                                                        | #195               |
| 2026-05-13 | search summary와 profile detail owner를 분리하고, 시즌 중 target cohort를 season participant로 한정. `SEASON_OPEN`의 merged 허용, `SEASON_MATCHING/POST_MATCH`의 registered viewer same-building only, 시즌 미참여 viewer merged LIMITED summary 규칙을 반영                                           | #195               |
