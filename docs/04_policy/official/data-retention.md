# 데이터 보유기간 정책

## 문서 범위

이 문서는 서비스가 수집하는 데이터의 보유기간, 탈퇴 시 처리, 채팅/로그 분리 보관 원칙을 다룬다.

- 시즌 전환 시 데이터 처리 대상(초기화/유지/보존): [season-lifecycle.md](./season-lifecycle.md)
- 채팅 thread 상태와 read-only/archive: [chat-lifecycle.md](./chat-lifecycle.md)
- 신고/제재 기록: [community-safety.md](./community-safety.md)
- 지원/문의 기록: [support-communication.md](./support-communication.md)
- 알림함 payload: [notification-inbox.md](./notification-inbox.md)
- 수사기관 협조: [service-boundary.md](./service-boundary.md)

## 보유기간 총괄

| #   | 데이터 분류                                                                | 보유 기간                                                    | 파기/처리 시점                                                                                                                                                     | 근거                                   |
| --- | -------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| 1   | 계정 데이터 (탈퇴 후)                                                      | 5일 이내                                                     | 탈퇴 요청 수락 즉시 active 식별 정보 비식별화, 정상 탈퇴 anchor는 5일 제한 보존 후 폐기                                                                            | 개인정보보호법 제21조, 서비스 정책     |
| 2   | 초기화 데이터 (건물 배정, 북마크, 재신청 제한)                             | 시즌성                                                       | 캠퍼스 `seasonEndDate`에 초기화                                                                                                                                    | 서비스 정책 (season-lifecycle)         |
| 3   | 운영 로그 (제재, 관리자 조치)                                              | 3년                                                          | 생성일로부터 3년 경과 후 파기                                                                                                                                      | 내부 방침, 분쟁 대응                   |
| 4   | 채팅 데이터 (메시지 본문)                                                  | archive 보존 + 2년 단위 identity-link review                 | archive 후 원문은 RRPD retained vault로 분리하고 user-facing row는 tombstone 처리. 고정 “무기한 열람”이 아니라 2년 단위 식별 연결 검토와 active hold 재평가를 예약 | 서비스 정책, 처리방침 고지             |
| 5   | 유지 데이터 (`UserDisplayIdentity`, current/past season profile, 생활패턴) | 계정 활성 기간                                               | 탈퇴 요청 수락 즉시 user-facing 식별/생활패턴 필드 비식별화                                                                                                        | 서비스 이용 목적 존속                  |
| 6   | 매칭·사용자 차단(Block)·신고 이력                                          | 3년                                                          | 생성일로부터 3년 경과 후 파기                                                                                                                                      | 부정이용 방지 + 사용자 이력 열람       |
| 7   | 접속 로그 (개인정보처리시스템)                                             | 1년                                                          | 생성일로부터 1년 경과 후 파기                                                                                                                                      | 개인정보보호법 안전성 확보조치 기준    |
| 8   | 지원/문의 ticket                                                           | 일반 문의: 종결 후 1년, 신고/제재/이의 신청 연계 ticket: 3년 | closure 또는 관련 case 종료 기준으로 파기. 신고/제재 증거·appeal은 #6 retention과 동기화                                                                           | 문의 처리, 분쟁 대응, 사용자 이력 확인 |
| 9   | 사용자 알림함 (`UserNotification`)                                         | 기본 1년                                                     | 생성일 또는 읽음 처리 후 1년 경과 시 user-facing inbox에서 정리. 원천 event/audit는 각 owner 보관 기간을 따름                                                      | 서비스 운영 안내와 사용자 확인 이력    |

## RRPD / retained vault 용어

서비스는 탈퇴·비식별화 이후에도 신고·분쟁·제재·수사기관 협조·법적 보존처럼 제한된 목적을 위해 복원 가능 payload를 별도 보관할 수 있다. 이 내부 보관 payload를 **제한 보존 개인정보(Restricted Retained Personal Data, RRPD)** 로 부른다.

| 용어                          | 의미                                                               | 사용자-facing 노출         |
| ----------------------------- | ------------------------------------------------------------------ | -------------------------- |
| `tombstone`                   | product row에 남기는 삭제/보존 표시 문구                           | 노출 가능                  |
| `DEIDENTIFIED`                | 원 사용자를 직접 식별할 수 없도록 축소된 상태값                    | 노출 가능                  |
| `RRPD retained vault payload` | 암호화·접근통제·접근로그 아래 제한 보존되는 복원 가능 원문 payload | product app 노출 금지      |
| `RetainedVaultObject`         | RRPD payload의 기술 저장 단위                                      | product app 직접 조회 금지 |
| `RetainedIdentity`            | 탈퇴 계정 식별 anchor                                              | product app 직접 조회 금지 |

RRPD는 복원 가능한 키와 연결 정보를 전제로 하므로 “익명정보”가 아니다. 문서와 코드에서는 `anonymous`/`anonymized profile` 표현을 피하고, user-facing은 `탈퇴한 사용자`/`DEIDENTIFIED`/tombstone으로, 내부 보존 payload는 RRPD/retained vault로 구분한다.

## 보존 이벤트 구분

서비스는 아래 이벤트를 같은 것으로 보지 않는다.

| 이벤트                         | 기본 의미                              | 비고                                                   |
| ------------------------------ | -------------------------------------- | ------------------------------------------------------ |
| `seasonEndDate`                | 현재 시즌 운영 종료 / snapshot 전환    | 곧바로 계정 삭제나 비식별화를 뜻하지 않음              |
| account delete                 | 요청 수락 즉시 계정 식별 정보 비식별화 | 정상 탈퇴 identifier anchor만 5일 제한 보존 후 폐기    |
| report / enforcement / dispute | 별도 보존 근거 발생                    | 일반 삭제보다 우선할 수 있음                           |
| legal hold / 수사기관 요청     | 법적 보존 필요                         | 일반 삭제 흐름보다 우선                                |
| retention period end           | 보존 사유 종료                         | identifier anchor 폐기 또는 irreversible anonymization |

### 보존 우선순위

보존 사유가 충돌할 때는 아래 순서로 해석한다.

1. legal hold / 적법한 수사기관 요청
2. 신고 / 제재 / 분쟁 대응 보존
3. 접속 로그 등 별도 법령상 보존 의무
4. 일반 탈퇴 계정 삭제 흐름

즉, 일반 탈퇴 요청이 있어도 **법적 보존·신고·분쟁 대응 사유가 있으면 일반 삭제 흐름보다 우선**한다.

## 탈퇴 시 데이터 처리

### 기본 원칙

탈퇴 시에는 계정 식별 정보를 요청 수락 transaction 안에서 즉시 삭제/비식별화한다. 정상 탈퇴의 식별 복원 anchor는 `RetainedIdentity` restricted vault에만 5일 제한 보존하고, 만료 시 `originalUserId`, `emailHash`, encrypted identifier payload, key version을 폐기한다. 다만 채팅 데이터는 상대방과의 공동 이력, 분쟁 대응, 사용자 과거 이력 제공을 고려해 **thread 전체를 일괄 삭제하지 않는다**.

계정 삭제 요청은 현재 시즌 참여 상태와 분리해서 처리한다. current season에 등록 중인 사용자는 삭제 요청이 수락되지 않으며, 가능한 경우 시즌 참여 철회(de-registration)를 먼저 안내하거나 시즌 종료 후 다시 삭제를 요청해야 한다. 철회 등으로 삭제 요청이 수락되면 별도 pending/cancel 기간 없이 즉시 비식별화가 완료된다. 5일은 사용자 복구 유예가 아니라 **정상 탈퇴 identifier anchor의 제한 보존 기간**이다. 시즌 종료, 시즌 참여 철회, 계정 삭제 요청은 서로 다른 이벤트이며, 법적 보존·신고·분쟁 대응 사유가 있으면 일반 삭제보다 보존이 우선한다.

프로필 데이터는 아래처럼 구분해서 본다.

| 구분                   | 정책                                                                                                                                                                                                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 표시 identity          | 계정 활성 기간 동안 `UserDisplayIdentity`가 nickname을 소유하고, 탈퇴 요청 수락 즉시 비식별 표시명으로 대체                                                                                                                                                           |
| current season profile | `SeasonParticipantProfile`이 current draft/final aggregate를 소유하고, 탈퇴 요청 수락 시 user-facing search/detail/chat/profile-tab 경로에서 제거 또는 비식별화                                                                                                       |
| season profile history | `SeasonParticipantProfileHistory`가 registration/retention snapshot을 소유한다. history라는 이유만으로 user-facing full detail을 계속 노출하지 않으며, 탈퇴 요청 수락 후에는 tombstone/pseudonymized read model로 degrade하거나 restricted retention scope로 분리한다 |
| 과거 시즌 결과 스냅샷  | 사용자-facing 과거 이력 정책에 따라 별도 보관 범주로 본다                                                                                                                                                                                                             |

### Season profile / 시즌 결과 보존 경계

구현 정합성 메모:

- `UserProfile` / `UserProfileHistory`는 #195 profile cleanup 이후 retention/archive canonical target이 아니다.
- current/past season profile audit owner는 `SeasonParticipantProfileHistory`다.
- `SeasonParticipantProfile`은 current season draft/final aggregate row이며, `seasonEndDate`는 current row 삭제 이벤트가 아니다. 다음 시즌은 새 `SeasonParticipant` + 새 `SeasonParticipantProfile` draft로 시작한다.
- `SeasonParticipantProfileHistory`는 registration snapshot(`source = SEASON_REGISTRATION`, `registeredAtSnapshot != null`)과 retention snapshot을 구분한다.
- Registration 전 current draft는 history row로 만들지 않으며, self read model에서 “등록 안 함” 상태로 합성한다.
- 변경이 없는 저장 요청은 의미 없는 중복 history를 만들지 않는 방향으로 정합성을 유지한다.
- Account delete 이후 식별 정보 분리/보존 anchor는 `RetainedIdentity`를 기준으로 잡고, 초기 archive tier는 same-DB hot archive(`HOT_DB`)를 기본으로 둔다.
- 정상 탈퇴 path에서는 `RetainedIdentity` 생성 자체가 full `SeasonParticipantProfileHistory` retention snapshot을 자동 생성하지 않는다. 신고·분쟁·제재·legal hold 같은 별도 보존 사유가 있을 때만 호출자가 명시적으로 snapshot 보존을 선택한다.
- #212 matched partner profile history read보다 account deletion/de-identification 정책이 우선한다. target participant/user가 탈퇴·비식별 상태이면 user-facing history/detail은 full profile이 아니라 tombstone/minimal result로 degrade한다.

| 구분                   | 기본 처리                                                                                    | 비고                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 표시 identity          | 탈퇴 요청 수락 즉시 식별 정보 정책과 함께 비식별화                                           | `UserDisplayIdentity`                                                                           |
| current season profile | 현재 시즌 공개/탐색/매칭 기준으로 사용, 탈퇴 요청 수락 시 user-facing 경로에서 제거/비식별화 | `seasonEndDate` 자체가 즉시 비식별화를 뜻하지 않음                                              |
| season profile history | 시즌 결과/분쟁 대응과 연결될 수 있는 보존 범주                                               | registration snapshot / retention snapshot 구분. 정상 탈퇴 후 user-facing full detail 노출 금지 |
| 과거 시즌 결과 스냅샷  | 사용자-facing 과거 이력 정책에 따라 보존                                                     | 상대가 탈퇴/비식별화된 경우 tombstone/minimal result로 degrade                                  |

### 5일 이내 삭제/분리 대상

| 데이터                 | 처리 방식                                                                                                                                                                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 이메일                 | 탈퇴 요청 수락 즉시 active `User`에서 삭제/비식별 대체. 정상 탈퇴 anchor의 encrypted payload/email hash는 5일 후 폐기                                                                                                                    |
| 닉네임                 | 탈퇴 요청 수락 즉시 `UserDisplayIdentity`를 `탈퇴한 사용자` 등 비식별 표시명으로 대체                                                                                                                                                    |
| current season profile | 탈퇴 요청 수락 즉시 user-facing 프로필 필드 null/empty 또는 비식별화 처리                                                                                                                                                                |
| season profile history | 탈퇴 요청 수락 후 user-facing full detail로 계속 노출하지 않음. past history는 `탈퇴한 사용자`, season result/status/date, 필요한 minimal summary만 제공하고 `intro`, optional additional, lifestyle/condition detail은 기본 숨김/마스킹 |
| 캠퍼스/기숙사 정보     | 탈퇴 요청 수락 즉시 계정/profile 표시 경로에서 제거. 시즌/history 보존은 별도 정책을 따름                                                                                                                                                |
| 계정 연결 키           | `RetainedIdentity` restricted vault에만 5일 제한 보존하고 채팅/로그 보관 구조와 분리                                                                                                                                                     |

### 채팅 관련 탈퇴 처리

| 항목                       | 정책                                           |
| -------------------------- | ---------------------------------------------- |
| thread 전체 삭제           | 기본 정책으로 두지 않음                        |
| 메시지 본문                | 유지 가능                                      |
| 사용자 표시명              | `탈퇴한 사용자` 등 비식별 표시명으로 대체 가능 |
| 계정 식별 정보             | 삭제 또는 비식별화                             |
| 본문 내 자가 입력 개인정보 | 운영/정책 기준에 따라 별도 처리                |

서비스는 한 사용자의 탈퇴를 이유로 **상대방이 포함된 채팅 이력 전체를 자동 삭제하지 않는다**. 탈퇴 시점에는 계정 식별 정보와 메시지 본문을 분리해, 필요한 이력은 유지하되 개인 식별 연결은 약화시키는 방향을 기본으로 한다.

### ArchiveJob / retention transformation 처리

계정 삭제 요청이 수락되는 transaction 안에서 계정 식별 정보 분리의 anchor인 `RetainedIdentity`를 만들고, 보존 사유와 기간은 `RetentionCase` + `RetainedIdentityHold`로 기록한다. `RetainedIdentity` 자체는 더 이상 `ArchiveJobTarget`이 아니며, `ArchiveJob`은 user-facing hot row에서 원문 payload를 분리·최소화해야 하는 domain payload transformation만 표현한다.

| 대상                     | 정책                                                                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NICKNAME_AUDIT`         | 닉네임 감사 이력의 이전/다음 닉네임과 운영 metadata를 retained vault로 이동하고 hot row를 redaction 처리                                                                              |
| `SEASON_PROFILE_HISTORY` | 시즌 참여 프로필 변경 이력의 full snapshot을 retained vault로 이동하고 hot history row를 minimal evidence로 축소                                                                      |
| `MATCH_HISTORY`          | 과거 시즌 결과/관계 이력의 role별 sensitive snapshot을 retained vault로 이동하고 event fact/count/result는 유지                                                                       |
| `THREAD_RETENTION`       | 채팅 thread archive 이후 메시지 원문을 `RetainedVaultObject(target = CHAT_MESSAGE_BODY)`로 이동하고 사용자-facing `ConversationMessage.body`는 tombstone 문구로 대체하는 pipeline job |

`ArchiveJob`은 `PENDING` / `WAITING_CONDITION` / `SUCCEEDED` / `RETRY_SCHEDULED` / `FAILED_MANUAL_REVIEW` 상태로 관리한다. `THREAD_RETENTION`은 thread가 아직 사용자-facing `ARCHIVED` 상태가 아니면 `WAITING_CONDITION`으로 대기하며 retry 횟수를 소비하지 않는다. 실패한 job은 재시도 횟수와 다음 실행 시각을 남기며, 키 누락·무결성 충돌·지원하지 않는 target handler처럼 자동 처리로 안전하게 분류할 수 없는 경우 `manualReviewRequired = true`와 함께 수동 검토 상태로 남긴다.

메시지 본문에 사용자가 직접 입력한 개인정보/민감정보가 포함될 가능성은 자동 NLP/regex 부분 마스킹으로 처리하지 않는다. thread가 archive 단계에 들어가면 원문 전체를 암호화된 retained body vault로 이동하고, 사용자-facing 본문은 전체 tombstone 문구로 대체한다. 복원은 신고·분쟁·수사·법적 보존 workflow에서 승인 사유와 접근 로그가 있을 때만 허용한다.

### RetainedVaultObject restricted vault

`RetainedVaultObject`는 `RetainedIdentity`와 별개의 RRPD payload 저장 단위다. `RetainedIdentity`가 삭제 계정 식별 anchor라면, `RetainedVaultObject`는 닉네임 감사 이력, 학업 identity 변경 감사 이력, 시즌 프로필 히스토리, 매칭 히스토리 스냅샷, 채팅 메시지 본문 같은 domain payload 원문을 암호화 보존한다.

이름이 비슷한 reason enum은 아래처럼 책임을 분리한다. `RetentionCaseReason`은 삭제 계정 식별 anchor hold(`RetainedIdentityHold`)와 retained vault payload hold(`RetainedVaultObjectHold`)가 함께 참조하는 canonical 보존 사유다. 예를 들어 일반 탈퇴 identity anchor는 `ACCOUNT_DELETION` hold로 5일 후 폐기될 수 있지만, 같은 thread의 chat payload는 survivor 공동 이력/신고 가능성을 이유로 별도 `CHAT_THREAD_ARCHIVE` case에 묶일 수 있다.

| 대상                    | hot row 처리                                                                                                    | retained vault 처리                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| nickname audit          | 이전/다음 닉네임을 tombstone/redacted 값으로 최소화                                                             | 원 previous/next nickname, actor/reason metadata 보존                          |
| academic identity audit | hot audit row의 이전/다음 `collegeCode`/`birthYear`와 직접 식별 가능한 actor detail을 redaction marker로 최소화 | 원 academic identity change event payload, actor/reason/approval metadata 보존 |
| season profile history  | registration evidence는 유지, lifestyle/condition/intro/additional detail은 null/empty로 최소화                 | 원 시즌 프로필 snapshot 보존                                                   |
| match history           | event fact/count/result는 유지, 삭제 subject의 nickname/profile/score snapshot은 최소화                         | role별(`VIEWER`/`COUNTERPART`) 원 snapshot 보존                                |
| chat message body       | `ConversationMessage`는 tombstone event shell만 유지                                                            | `CHAT_MESSAGE_BODY` payload로 원문 보존                                        |

일반 product/user-facing read path는 `RetainedVaultObject`를 복원하지 않는다. 운영 disclosure는 `accessedBy`, `accessReason`, `approvalReference`, `purpose`를 요구하고 `RetentionAccessLog`를 남긴다. retained payload는 retained 중 HMAC digest를 가질 수 있으나, disposal 시 `encryptedPayload`, `keyVersion`, `payloadDigest`를 모두 null 처리한다.

`UserAcademicIdentityChangeAllowance`는 retained vault 대상이 아니다. correction allowance는 감사 원문이 아니라 live self-service 가능 횟수/주기 상태이므로 계정 삭제 시 삭제/cascade하며, user-facing tombstone이나 retained vault hot marker를 만들지 않는다.

### RetainedIdentity restricted vault

`RetainedIdentity`는 user-facing 표시용 테이블이 아니라 **탈퇴 후 식별 복원 가능성을 제한적으로 보존하는 restricted vault anchor**다. 일반 운영 화면에서 자유 조회하는 대상이 아니며, 백오피스 UI가 구현되기 전에도 아래 base 규칙을 따른다.

| 항목                                                                                                                          | 정책                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| active `User` / `UserDisplayIdentity` / `SeasonParticipantProfile` / user-facing `SeasonParticipantProfileHistory` projection | 탈퇴 요청 수락 즉시 이메일·비밀번호·표시 identity·프로필 식별 정보를 삭제 또는 `탈퇴한 사용자`로 비식별 대체. history storage는 보존 사유에 따라 남을 수 있으나 user-facing full detail projection은 닫는다 |
| `RetainedIdentity.originalUserId` / `emailHash`                                                                               | 정상 탈퇴는 5일 제한 보존 anchor. 신고·분쟁·제재·legal hold로 승격되면 해당 보존 사유 기간을 따른다                                                                                                         |
| encrypted identifier payload                                                                                                  | 별도 암호키가 있을 때만 임시 식별 복원이 가능하도록 저장. 암호키는 애플리케이션 DB와 분리 관리해야 함                                                                                                       |
| 접근 승인                                                                                                                     | `accessReason`, `approvalReference`, `purpose`, `accessedBy`가 없는 식별 복원은 허용하지 않음                                                                                                               |
| 접근 로그                                                                                                                     | 식별 복원 성공/거부/만료 폐기 모두 `RetentionAccessLog`로 남김                                                                                                                                              |
| 보존 만료                                                                                                                     | `retentionHoldUntil`이 지나고 legal hold가 없으면 `originalUserId`, `emailHash`, encrypted payload를 폐기하고 폐기 로그를 남김                                                                              |

이 구조는 개인정보보호법 제21조의 파기/분리 보관 원칙과 제28조·제29조의 접근자 제한/안전조치 요구를 API base 계층에서 먼저 반영하기 위한 최소 구조다. 실제 운영자 권한 매트릭스, 승인 워크플로, 수사기관 공문 접수/반출 절차는 별도 backoffice workflow에서 구현한다.

운영 환경에서는 retained identity 식별 복원을 위해 `RETENTION_IDENTITY_ENCRYPTION_KEY_BASE64`(32-byte key의 base64)와 `RETENTION_IDENTITY_KEY_VERSION`을 DB 밖의 secret store에서 관리한다. 키가 없으면 `RetainedIdentity` row는 생성되더라도 이메일 등 평문 식별자 복원은 불가능한 상태로 남긴다.

### 채팅 메시지 archive와 2년 단위 identity-link review

채팅 메시지는 상대방 공동 이력, 신고/분쟁 대응, 과거 대화 맥락 보존 목적 때문에 기본적으로 thread 전체를 즉시 파기하지 않는다. 다만 archive 보존은 운영자가 식별 가능한 상태로 무제한 열람한다는 뜻이 아니며, `CHAT_THREAD_ARCHIVE` retention case와 2년 단위 identity-link review job으로 active hold와 disposal 가능성을 재평가한다.

| 시점                     | 처리                                                                                                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 계정 삭제 요청 수락      | 계정 식별 정보는 active user/profile에서 제거하고, thread archive job을 생성                                                                                                  |
| archive job 생성         | thread가 archive 전이면 `WAITING_CONDITION`으로 대기하고, archive 후 원문을 `RetainedVaultObject(target = CHAT_MESSAGE_BODY)`로 이동한 뒤 사용자-facing 본문을 tombstone 처리 |
| archive 후 2년 단위      | 메시지와 사용자 식별 연결의 필요성, active legal/report/dispute hold, disposal 가능성을 재검토하는 identity-link review를 예약                                                |
| legal hold / 신고 / 분쟁 | 보존 사유가 있으면 일반 만료보다 우선하며, 접근 로그와 승인 근거를 남김                                                                                                       |

국내 개인정보보호법은 일반 채팅 메시지에 대해 일률적인 “최대 보유기간 N년”을 직접 정하지 않는다. 따라서 서비스는 처리방침에 목적·보유기간·파기/분리 절차를 명확히 공개하고, 목적 달성 또는 보존 사유 종료 시 식별 연결을 약화하거나 파기한다.

### 신고 접수 계정 예외

신고가 접수된 계정은 탈퇴 시 정상 탈퇴 5일 anchor 폐기 대상에서 분리하고, 별도 보관한다.

| 항목           | 정책                                                   |
| -------------- | ------------------------------------------------------ |
| 분리 보관 대상 | 내부 user ID, 해시된 이메일, 접속 로그, 신고 관련 기록 |
| 보관 기간      | 신고 이력 보관 기간(3년)과 동일                        |
| 접근 제한      | 관리자 전용. 외부 미공개                               |
| 보관 근거      | 분쟁 대응 및 서비스 운영 정책                          |

### 법적 보존 / 신고 / 분쟁 대응 우선 원칙

- 신고 접수, 제재, 분쟁 대응, 법적 보존 필요가 발생하면 **일반 삭제보다 보존이 우선**할 수 있다.
- 이 경우 current season profile, 과거 시즌 결과, 관련 채팅/로그는 분리 보관 또는 비식별화된 상태로 유지될 수 있다.
- 다만 이런 예외 보존도 무기한 자유 보존을 뜻하지 않으며, 적용 근거와 보유 기간은 별도 법적 근거와 처리방침에 따라 제한된다.

### 5일 anchor 폐기 후 늦은 신고

정상 탈퇴 후 5일이 지나 `RetainedIdentity` identifier anchor가 폐기된 뒤 신고가 접수되면, 서비스는 이미 폐기한 `originalUserId`, email hash, encrypted identifier payload를 복구하지 않는다.

| 시점                                                           | 처리                                                                                                                                                             |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 탈퇴 전 또는 5일 anchor 폐기 전 신고/분쟁/제재/legal hold 발생 | `RetentionCase` + `RetainedIdentityHold`를 `REPORT_REVIEW` / `DISPUTE_RESPONSE` / `ENFORCEMENT_RECORD` / `LEGAL_HOLD` 보존 사유로 추가하고 해당 보존 기간을 적용 |
| 5일 anchor 폐기 후 최초 신고 접수                              | 남아 있는 비식별 actor key, thread/message id, timestamp, 사용자 제출 evidence, retained chat body vault 등으로 evidence-only review를 수행                      |
| 수사기관 협조 요청                                             | 폐기된 account identifier anchor는 제공하지 않고, 법적 절차와 보유 중인 비식별/증거 데이터 범위 안에서만 협조                                                    |

모든 정상 탈퇴 계정의 identifier anchor를 향후 신고 가능성만으로 장기 보존하지 않는다.

## 채팅 데이터 분리 보관

채팅 데이터는 계정 데이터와 **동일한 층으로 취급하지 않는다**.

| 층위                  | 정책                                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 계정 식별 정보        | 탈퇴 시 삭제/비식별화 대상                                                                                                 |
| 메시지 본문           | archive 전에는 user-facing 본문 유지, archive 후에는 `RetainedVaultObject(target = CHAT_MESSAGE_BODY)` + tombstone display |
| 운영/접속 로그        | 일반 채팅과 분리 보관                                                                                                      |
| 사용자-facing 상태    | `read-only/archive`                                                                                                        |
| 내부 retention anchor | `RetentionCase`/`RetainedVaultObjectHold`로 보존 사유와 기간을 관리하고 승인/로그/키 기반으로만 복원                       |

### 분리 원칙

1. `read-only/archive`는 **사용자-facing 상태**이지 내부 파기 기준이 아니다.
2. 메시지 본문과 계정 식별 정보는 분리해 설계한다.
3. 사용자가 본문에 직접 입력한 개인정보/민감정보는 일반 텍스트와 동일하게 보지 않고 운영/신고 정책으로 다룬다.
4. 채팅 보관 구조와 접속 로그 보관 구조는 분리한다.
5. retained vault payload는 product application에서 복원하지 않으며, 운영 disclosure service만 접근 로그와 승인 근거를 남기고 복원한다.

## RRPD DB 접근 통제와 운영 관측

RRPD retained vault는 application owner guard만으로 보호하지 않고 DB credential 경계도 분리한다. 일반 product runtime은 `RetainedVaultObject` 원문 payload와 `RetainedIdentity` 식별 복원 payload를 직접 조회하지 않는 것을 원칙으로 하며, retention worker/disclosure 경로만 별도 credential과 승인·로그 요구사항을 통해 접근한다.

| DB 역할                | 책임                                       | RRPD 접근 원칙                                                                                                 |
| ---------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `app_runtime`          | 일반 API/user-facing runtime               | 일반 서비스 테이블만 사용. retained vault/identifier payload 직접 SELECT/WRITE 금지                            |
| `retention_worker`     | archive, disposal, review, lifecycle sweep | payload 이동·폐기·review job 처리에 필요한 RRPD read/write 허용                                                |
| `retention_disclosure` | 승인된 disclosure owner                    | 승인 근거가 있는 retained payload/identifier read와 `RetentionAccessLog` 기록만 허용. 일반 서비스 write는 제한 |
| `migrator`             | schema/grant 관리                          | DDL, grant/revoke, role setup 전용                                                                             |

PostgreSQL 일반 trigger는 SELECT를 감사할 수 없으므로 retained payload 조회 감사는 application disclosure path의 `RetentionAccessLog`와 DB role 차단을 1차 기준으로 한다. production에서 SELECT-level DB audit이 필요하면 pgaudit 또는 DB vendor audit 기능을 별도 운영 보강으로 검토한다.

운영 관측은 외부 monitoring vendor에 종속하지 않는 structured signal을 먼저 기준으로 둔다. lifecycle sweep은 due job 수, manual review 수, retry exhaustion, key unavailable, vault retained/disposed count, access log disposal count, sweep latency를 metric/alert event로 남겨야 한다. 이 signal은 admin/backoffice UI와 별개로 production logic 운영성에 해당한다.

## 법적 근거 정리

| 근거                                | 적용 항목                                                      | 비고                                                                  |
| ----------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------- |
| 개인정보보호법 제21조               | #1, #5 (계정 식별 정보·display identity·season profile 데이터) | 탈퇴 시 지체 없이 삭제/분리                                           |
| 개인정보보호법 제21조 단서          | 신고/분쟁/제재/legal hold 예외                                 | 별도 보존이 필요한 경우 다른 개인정보와 분리 저장·관리                |
| 개인정보보호법 제28조·제29조        | `RetainedIdentity` 및 `RetainedVaultObject` 접근 통제/감사     | 접근자 최소화, 접근권한 제한, 접속기록/접근로그 보관                  |
| 개인정보보호법 제30조               | 처리방침 공개                                                  | 보유기간, 파기절차, 예외 보존 항목 공개                               |
| 개인정보보호법 안전성 확보조치 기준 | #7 (접속 로그)                                                 | 1년 이상                                                              |
| 서비스 정책 및 처리방침             | #4 (채팅 데이터), RRPD retained vault                          | 계정 식별 정보와 메시지 본문 분리 보관, 2년 단위 identity-link review |
| 내부 방침 및 분쟁 대응              | #3, #6 (운영 로그, 신고/이력)                                  | 증거 보존과 사용자 이력 열람                                          |

### 적용되지 않는 법령

| 법령                     | 사유                                                                           |
| ------------------------ | ------------------------------------------------------------------------------ |
| 전자상거래법 제6조       | KNU Roommate는 금전 거래가 없으므로 적용 대상 아님                             |
| 통신비밀보호법 제15조의2 | 전기통신사업자 적용 여부는 별도 검토 대상. 현재 문서는 서비스 정책 기준만 다룸 |

## 연동 정책

| 문서                     | 연동 내용                                                             |
| ------------------------ | --------------------------------------------------------------------- |
| season-lifecycle.md      | `roomSelectionDate`와 `seasonEndDate` 기준 초기화/유지/보존 대상 정의 |
| chat-lifecycle.md        | read-only/archive와 내부 보관을 분리하는 thread 정책                  |
| community-safety.md      | 본문 내 개인정보/민감정보, 신고/제재 기록 보관                        |
| service-boundary.md      | 수사기관 협조 시 제공 가능한 로그/이력 범위                           |
| incident-enforcement.md  | 증거 보관, 사용자 제출 자료, 탈퇴 계정 신고 처리                      |
| support-communication.md | support ticket/appeal/email optional consent 보관 경계                |
| notification-inbox.md    | user-facing notification payload와 source owner audit 분리            |

## 후행 구현

이 정책의 구체적 구현(식별 정보 분리, 비식별화/retained vault key 구조, soft/hard delete, 로그 계층 분리 등)은 BE 데이터 모델 설계와 탈퇴/파기 설계에서 다룬다.

## 변경 이력

> Superseded note: 아래 변경 이력의 legacy 용어(`UserProfile`, base profile, `messageToRoommate`, `LIMITED/FULL`, `full/gated`, 자동 `UNASSIGNED`, `ArchiveTier.HOT_DB` 등)는 historical record다. 현재 정책은 이 문서의 본문과 최신 변경 이력 행을 따른다.

| 날짜       | 변경 내용                                                                                                                                                                                                                                                                                                                                                                                   | 관련 이슈                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 2026-06-08 | support ticket과 notification inbox 보관 기준을 추가하고 신고/제재/이의 신청 연계 ticket은 #6 retention과 동기화한다고 명시했다                                                                                                                                                                                                                                                             | #79 / #220 / #196        |
| 2026-05-29 | 정책 문서의 날짜 고정/시간 의존 표현을 문서 본문, 날짜, 맥락 기준 표현으로 정리했다                                                                                                                                                                                                                                                                                                         | #195                     |
| 2026-05-29 | Academic identity 변경 감사 이력을 retained vault 대상에 추가하고, `UserAcademicIdentityChangeAllowance`는 계정 삭제 시 삭제/cascade되는 live operational state로 정리했다                                                                                                                                                                                                                  | #195                     |
| 2026-05-26 | RRPD DB role 기반 접근 통제(`app_runtime`/`retention_worker`/`retention_disclosure`)와 retention lifecycle observability/alert signal 원칙을 추가                                                                                                                                                                                                                                           | #195                     |
| 2026-05-26 | BE/DB 최종 retention 구조에 맞춰 `ArchiveTier`, `ArchiveJobTarget.RETAINED_IDENTITY`, `RetainedIdentityRetentionReason`, 구 access log 이원화 표현을 제거하고, `RetentionCase`/`RetainedIdentityHold`/`RetentionAccessLog` 중심 구조로 정합화                                                                                                                                               | #195                     |
| 2026-05-25 | RRPD(제한 보존 개인정보)와 `RetainedVaultObject` 공통 vault를 canonical 용어/구조로 추가하고, nickname audit / season profile history / match history / chat body 원문을 hot DB marker가 아니라 retained vault + user-facing minimization으로 처리하도록 정책 baseline을 갱신                                                                                                               | #195                     |
| 2026-05-20 | #195 2026-05-20 결정에 맞춰 `UserProfileHistory`/`ArchiveJobTarget.USER_PROFILE_HISTORY`를 retention canonical target에서 제거하고, `SeasonParticipantProfileHistory` registration/retention snapshot 중심으로 보존 경계를 정리했다. 정상 탈퇴/비식별화는 current profile뿐 아니라 user-facing history full detail에도 우선하며, `ArchiveTier.HOT_DB`는 same-DB logical archive 경계로 유지 | #195 / #148              |
| 2026-05-14 | account deletion의 5일을 삭제 대기/복구 유예가 아니라 삭제 요청 수락 즉시 비식별화 후 정상 탈퇴 identifier anchor를 5일 제한 보존하는 파기 SLA로 재정의. 삭제 대기·취소·사후 확정 흐름을 제거하고, 5일 후 늦은 신고는 evidence-only review로 처리하되 5일 전 신고·분쟁·제재·legal hold는 보존 사유로 승격한다고 명시                                                                        | #76 / #148               |
| 2026-03-14 | 신규 작성                                                                                                                                                                                                                                                                                                                                                                                   | #145                     |
| 2026-03-17 | 법적 근거 표현 정밀화: "내부 방침"→민법 근거, "5일" 역일 추정 명시, "법률"→"법령" 원문 반영                                                                                                                                                                                                                                                                                                 | #154                     |
| 2026-03-17 | Landing FAQ 파기 안내에 예외 보관 존재 고지 추가, 처리방침 유도 문구 반영                                                                                                                                                                                                                                                                                                                   | #147                     |
| 2026-03-20 | #6 "차단" → "사용자 차단(Block)"으로 용어 명확화 (재신청 제한과 구분)                                                                                                                                                                                                                                                                                                                       | Sprint 6                 |
| 2026-03-29 | #6 보관 목적에 "사용자 이력 열람" 추가. season-lifecycle.md 과거 이력 열람 정책 연동                                                                                                                                                                                                                                                                                                        | #186                     |
| 2026-03-30 | #2 초기화 데이터 범위 명확화: "건물, 매칭, 북마크" → "건물 배정, 북마크, 재신청 제한". 진행 중 매칭/대화 상태는 삭제가 아닌 터미널 전이(season-lifecycle.md)이므로 #2 범위에서 제외. 이력 레코드는 #6 보관                                                                                                                                                                                  | #186                     |
| 2026-04-22 | 매칭 종료(`roomSelectionDate`)와 시즌 종료(`seasonEndDate`)를 분리. 채팅 보관 기간은 매칭 종료 기준, 시즌성 운영 데이터 초기화는 시즌 종료 기준으로 정리                                                                                                                                                                                                                                    | #194                     |
| 2026-04-30 | 채팅 데이터 90일 파기 정책을 기본 유지 + 탈퇴 시 식별 정보 삭제/비식별화 구조로 전환하고, 계정 식별 정보·메시지 본문·로그를 분리 보관하는 방향으로 전면 갱신                                                                                                                                                                                                                                | #195                     |
| 2026-05-04 | 보존 이벤트 구분, 보존 우선순위, 기본 프로필/시즌 참여 프로필/과거 시즌 결과 스냅샷의 보존 경계를 추가 정리                                                                                                                                                                                                                                                                                 | #195                     |
| 2026-05-13 | `UserProfileHistory` / `SeasonParticipantProfileHistory`를 append-only 변경 이력으로 해석하되, 동일 owner의 최신 row를 최종 snapshot으로 읽는 규칙과 변경 없는 저장 요청의 no-op history 원칙을 추가                                                                                                                                                                                        | #195                     |
| 2026-05-13 | current season 참여 중 계정 삭제 요청을 수락하지 않고, 시즌 참여 철회와 계정 삭제를 별도 이벤트로 분리하며, 5일 삭제/분리 기준을 실제 삭제 요청 수락 시점으로 명시                                                                                                                                                                                                                          | #76 / #148               |
| 2026-05-13 | 계정 삭제 처리 시 `RetainedIdentity` 기준 deletion archive job을 생성하고, `HOT_DB` logical archive·retry·manual review 상태로 관리하는 정책을 추가. 메시지 본문 PII는 자동 마스킹하지 않고 수동 검토 job으로 분류한다고 명시                                                                                                                                                               | #76 / #148 / #211 / #212 |
| 2026-05-14 | `RetainedIdentity`를 restricted vault anchor로 정의하고, 접근 권한 분리·접근 로그·승인 사유·암호키 기반 임시 식별 복원·보존 만료 폐기 base 규칙을 추가. 채팅 메시지는 기본 무기한 archive를 유지하되 2년 후 식별 연결 검토 기준을 명시                                                                                                                                                      | #76 / #148 / #195        |
| 2026-05-14 | 채팅 `THREAD_RETENTION`을 manual review ticket이 아니라 archive 대기→encrypted retained body vault→전체 tombstone pipeline으로 정리                                                                                                                                                                                                                                                         | #76 / #148 / #195        |
