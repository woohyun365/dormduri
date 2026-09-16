# Backend domain data ownership

공유 PostgreSQL/Prisma schema는 **공유 write 권한**을 뜻하지 않는다. 이 문서는 modular monolith의 현재 데이터 소유권,
목적이 제한된 협업과 read debt를 정의한다. 별도 database/service, 범용 repository layer 또는 새 runtime role을 요구하지 않는다.

기준은 [Prisma schema](../../../apps/api/prisma/schema.prisma), 실제 caller와
[service boundary](../../policies/service-boundary.md), [profile model](../../policies/profile-model.md),
[retention policy](../../policies/data-retention.md)다. 아래 소스 경로는 별도 표기가 없으면 `apps/api/src/` 기준이다.

## 판정 규칙

- **Canonical owner**: aggregate의 상태 전이와 불변 조건을 책임지는 capability다. 파일 위치나 Prisma delegate 이름만으로 정하지 않는다.
- **Owner-local**: 해당 owner의 command/repository/handler가 자기 상태를 읽거나 쓴다. `policy`, `query`, `GET`이라는 이름은 무부작용 보장이 아니다.
- **Owner-public collaboration**: 실제 exported service/port 또는 명시된 협업 함수로 owner의 동작을 호출한다. caller에게 그 모델의 임의 write 권한을 주지 않는다.
- **Approved collaborator**: 아래의 정확한 caller·필드·목적·transaction에 한정한 협업이다. 같은 DB/transaction을 쓴다는 이유만으로 승인되지 않는다.
- **Accepted read debt**: 현재 필요한 직접 cross-domain projection/filter다. 반환 DTO와 목적을 제한하고, owner와 재검토 조건을 남긴다. 새 필드·caller 추가는 별도 검토한다.
- **Reference lookup / shared platform**: catalog 조회, DB time/health/transaction/connection 기능이다. schema generation이나 SQL 등록은 업무 write 권한이 아니다.
- **Violation**: 위 경계로 설명할 수 없는 접근이다. guard 통과를 위해 permission을 넓히거나 동작을 몰래 바꾸지 않고, owner·transaction·검증·rollback이 있는 별도 수정으로 다룬다.

`User`처럼 여러 capability가 사용하는 물리 row도 무제한 공동 소유가 아니다. 계정/identity lifecycle의 canonical owner는
users이고, auth의 가입 초기화·credential 변경은 아래 W1에 한정한다. Credential transition은 auth가 책임지고 users의
계정 삭제 tombstone과 구분한다. 동일 필드의 일반 수정 권한으로 확대하지 않는다.

## 모델/aggregate owner

아래 목록은 runtime writer가 없는 모델도 포함한다. Seed/운영 데이터의 존재를 runtime command가 있다는 뜻으로 해석하지 않는다.

| Canonical owner                                                            | 모델                                                                                                                                                                                             | 현재 책임 / entry                                                                                                                                                      |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reference catalog                                                          | `CampusMaster`, `CollegeMaster`                                                                                                                                                                  | 캠퍼스·대학 기준 정보. `prisma/seeds/reference/`, local seed가 publication/fixture를 담당하며 runtime은 조회한다                                                       |
| [dormitories](../../../apps/api/src/dormitories/README.md)                 | `Dormitory`                                                                                                                                                                                      | 기숙사 catalog/선택 reference. `catalog/`, `selection-catalog/`; 시즌별 운영 상태는 seasons 소유                                                                       |
| [seasons](../../../apps/api/src/seasons/README.md)                         | `Season`, `SeasonDormitoryOperation`, `SeasonOperationAuditEvent`                                                                                                                                | 시즌 일정/override와 감사. `operations/` transaction, `runtime/` query; 운영 기숙사 configuration도 이 owner                                                           |
| [users](../../../apps/api/src/users/README.md)                             | `User`, `UserDisplayIdentity`, `UserAcademicIdentity`, `UserAcademicIdentityChangeAllowance`, `UserDismissedNotice`, `UserDisplayIdentityNicknameChangeEvent`, `UserAcademicIdentityChangeEvent` | 계정·표시/학적 identity·수정 허용량·notice dismissal·감사. `identity/`, `onboarding/`, `account-deletion/`, `operations/`; auth capability는 W1                        |
| [auth](../../../apps/api/src/auth/README.md)                               | `LoginAttempt`, `VerificationCode`, `VerificationCodeRequestLog`, `AuthMailOutboxEvent`, `AuthSession`, `AuthSecurityEvent`                                                                      | credential/verification/session/admission/mail/audit와 bounded cleanup. Cleanup도 auth owner이며 worker credential 사용 여부와 별도 축                                 |
| [season-participants](../../../apps/api/src/season-participants/README.md) | `SeasonParticipant`, `SeasonParticipantLifecycleEvent`, `SeasonParticipantProfile`, `SeasonParticipantProfileHistory`                                                                            | 참여 container·등록·철회·기숙사 선택·profile draft/snapshot/history. `participants/`, `registration/`, `deregistration/`, `profile-draft/`, `lifecycle/`, `retention/` |
| [matches](../../../apps/api/src/matches/README.md)                         | `MatchRequest`, `ActiveMatch`, `ActiveMatchUnmatchRequest`, `ActiveMatchLifecycleEvent`, `SeasonMatchHistoryEntry`, `SeasonMatchHistoryEntryRetentionLink`                                       | 요청/수락/해제·만료·시즌 이력 materialization. 이력 retention link는 source-side matches 모델이고 vault 소유권을 넘겨받지 않는다                                       |
| [chat](../../../apps/api/src/chat/README.md)                               | `ConversationThread`, `ConversationThreadLifecycleEvent`, `ConversationThreadMember`, `ConversationMessage`, `ChatRealtimeOutboxEvent`, `ChatRealtimeEventRecipient`                             | thread/member/message 상태, lifecycle, outbox/replay recipient, source retention. `commands/`, `lifecycle/`, `outbox/`, `retention/`                                   |
| [social-safety](../../../apps/api/src/social-safety/README.md)             | `UserBookmark`, `UserBlock`, `UserBlockEvent`, `ReportCase`, `ReportCaseEvent`                                                                                                                   | bookmark/block/report 상태와 증거 reference. `RetentionCase`의 owner는 아님                                                                                            |
| [support](../../../apps/api/src/support/README.md)                         | `SupportTicket`, `SupportTicketMessage`, `SupportFaqArticle`, `SupportFaqPlacement`                                                                                                              | ticket/conversation write와 FAQ publication/read. FAQ는 현재 runtime reader와 seed가 있고 임의 product write 경로는 없음                                               |
| [legal](../../../apps/api/src/legal/README.md)                             | `LegalDocumentVersion`, `LegalAcceptanceRecord`                                                                                                                                                  | 문서 version publication과 사용자 동의 기록. 가입은 legal helper를 같은 transaction으로 호출                                                                           |
| [notices](../../../apps/api/src/notices/README.md)                         | `GlobalNotice`                                                                                                                                                                                   | 공지 publication와 read projection. 현재 runtime writer 없이 seed/fixture와 reader가 있음                                                                              |
| [notifications](../../../apps/api/src/notifications/README.md)             | `UserNotification`, `NotificationCampaign`, `OperatorAlert`, `NotificationOutboxEvent`                                                                                                           | 알림/campaign/운영 alert projection, read marker 및 outbox. Report event를 읽어도 report 상태를 소유하지 않음                                                          |
| [retention](../../../apps/api/src/retention/README.md)                     | `RetainedIdentity`, `ArchiveJob`, `RetentionCase`, `RetainedVaultObject`, `RetainedVaultObjectHold`, `RetainedIdentityHold`, `RetentionAccessLog`, `RetentionReviewJob`                          | anchor/case/vault/hold/access-log/queue/review/disclosure/disposal. Source transformation은 원 domain handler에 남음                                                   |
| [moderation](../../../apps/api/src/moderation/README.md)                   | `ModerationTerm`                                                                                                                                                                                 | 금칙어 판정 capability의 기준 데이터. 중립 platform utility가 아님. Reference seed와 운영 관리 데이터의 경계를 유지                                                    |

`profiles`, `roommate-search`, `home-dashboard`는 공개 projection/search/presentation owner이지 participant/profile 모델의
새 write owner가 아니다. `lifecycle`은 trigger/workload orchestration이고 domain 모델을 인수하지 않는다.
`platform/database`는 client/credential/transaction infrastructure를 소유한다.

## 제한된 direct-write 협업

이 표는 현행 정책·caller·transaction을 대조한 허용 범위다. 다른 파일, 목적, 필드, payload 접근으로 일반화하지 않는다.

| ID  | Caller → foreign model                                                                                                                                                          | 허용 목적과 transaction 경계                                                                                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1  | `auth/registration/signup.command.ts` → `User` 및 nested `UserDisplayIdentity`, `UserAcademicIdentity`; `auth/credentials/{change-password,reset-password}.command.ts` → `User` | 가입의 계정/identity 초기화, credential 변경의 password CAS만. 각 auth Serializable transaction에서 grant/session/audit/mail/legal helper와 협업. 일반 identity 수정·삭제 정책은 users에 남음                                                                                                |
| W2  | `matches/requests/persistence/match-request-acceptance.repository.ts`, `matches/active/persistence/active-match.repository.ts` → `SeasonParticipant`                            | 수락 시 `participantStatus=MATCHED`, `matchedAt=now`; 상호 해제 시 `ACTIVE`, `matchedAt=null`. Matching 상태의 mirror만 변경. Profile/등록/기숙사 필드 권한 아님. Accept/unmatch command transaction 및 chat lifecycle 협업 유지                                                             |
| W3  | `users/operations/override-display-identity-nickname.command.ts` → `SeasonParticipantProfile`                                                                                   | 운영 enforcement의 `nicknameSnapshot`, `nicknameNormalizedSnapshot` 교정만. Identity/audit와 같은 Serializable transaction. 일반 nickname edit가 모든 season snapshot을 덮어쓰는 경로가 아님                                                                                                 |
| W4  | `users/account-deletion/account-deletion.repository.ts` → `AuthSession`, `SeasonParticipantProfile`                                                                             | 계정 삭제 전용 session revoke, profile nickname tombstone·개인 필드 최소화. Worker deletion transaction에서 retained snapshot/job 생성과 함께 수행. 일반 users 기능의 foreign-write 권한 아님                                                                                                |
| W5  | `retention/archive-jobs/create-deletion-archive-jobs.command.ts` → 두 users identity audit 모델                                                                                 | 삭제 transaction에서 `retainedIdentityId` anchor 연결만. 원 audit 내용 redaction은 users의 `identity/retention/` handler가 담당                                                                                                                                                              |
| W6  | `chat/retention/conversation-retained-body.service.ts` → `RetainedVaultObject`                                                                                                  | Worker review transaction의 `CHAT_MESSAGE_BODY` identity-link 최소화만. Active non-archive hold를 보존하고 `subjectUserId`/`subjectRetainedIdentityId` 제거 후 payload 재암호화·digest/keyVersion/metadata 갱신. 모든 식별 연결 제거/익명화를 의미하지 않으며 product disclosure 경로가 아님 |
| W7  | `social-safety/reports/retention/report-retention-reference.service.ts` → `RetentionCase`                                                                                       | Report intake transaction의 `REPORT_REVIEW` reference-only **create**. Source/policy/metadata만 append. 실제 identifier hold 승격, vault payload 생성/복원 권한이 아님                                                                                                                       |

W2는 실제 match/participant owner 계약과 command-flow assertions를 함께
확인한다. W3/W4/W5/W6/W7의 privacy 범위는 위 profile/retention policy가 우선한다. 정책이 바뀌면 allowlist부터 넓히지
말고 관련 transaction과 caller를 다시 검토한다.

## Owner-public / source-handler 협업과 원자성

| Workflow                            | 실제 경계                                                                                                                                                                        | 유지할 조건                                                                                                                                                                                                  |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Match accept / mutual unmatch       | `matches/requests/commands/accept-match-request.command.ts`, `matches/active/commands/request-unmatch.command.ts` → `chat/application/ports/chat-match-thread-lifecycle.port.ts` | Matching write·event와 chat lifecycle port에 **동일 TransactionClient** 전달. Participant context ensure는 command transaction 이전에도 실행될 수 있음                                                       |
| Participant withdrawal              | `season-participants/deregistration/deregister-season-participant.command.ts` → matches withdrawal port + chat withdrawal port                                                   | Active-match 상태를 transaction 안에서 재검증하고 participant 전이·pending request 취소·thread 처리·lifecycle event를 같은 transaction으로 유지. Participant에서 chat table을 직접 쓰는 것으로 대체하지 않음 |
| Block / report side effects         | social-safety command → matches/chat block port, report target chat context port 및 notifications command                                                                        | 전달되는 client와 소스 상태 변경/알림 materialization 경계를 해당 command에서 확인. Port 호출을 보고 모든 후속 작업이 하나의 transaction이라고 추정하지 않음                                                 |
| Signup legal acceptance             | `auth/registration/signup.command.ts` → `legal/commands/record-legal-acceptance.command.ts`                                                                                      | Version 검증과 acceptance append를 signup transaction에 포함. Auth가 legal 내부 table을 임의 관리하지 않음                                                                                                   |
| Account deletion / archive / review | users 삭제 command → retention snapshot/job 함수; retention target registry → users/participant/matches/chat source handler                                                      | 삭제는 worker transaction. 각 archive handler의 source 최소화와 retention case/vault/hold helper는 같은 transaction. Claim/retry/disposal 전체 batch가 하나의 transaction인 것은 아님                        |
| Notification / chat outbox          | notifications create command, chat append-event 함수 → 각 owner outbox 및 recipient                                                                                              | Source event와 outbox append의 caller transaction 보존. 구조적 client type의 `create/update/deleteMany`도 실제 DB write로 검토                                                                               |

Retention의 실제 Nest export는 `RETENTION_SWEEP_PORT`, `RETENTION_OBSERVABILITY_PORT`다. Vault/disclosure/target-handler라는
가상의 DI port를 전제하지 않는다. Source handler는 명시된 retention 함수와
`retention/archive-jobs/targets/archive-target-handlers.ts` registry로 협업한다. 함수가 있다는 사실은 운영 disclosure API에
연결되어 있다는 증거가 아니다. `RetentionWorkerPrismaService`/`RetentionDisclosurePrismaService`의 credential 경계와
업무 owner 경계는 별도다. Type이 `PrismaService`와 호환되어도 실제 주입된 credential을 추적해야 하며, 이 문서는 live DB GRANT를 증명하지 않는다.

### 조회 경로에 숨은 쓰기

- `SeasonParticipantsService.ensureCurrentSeasonParticipant()`는 container `upsert(create, update: {})`를 호출한다.
  Profiles/search/matches의 context에서 사용되며 owner-public creation이다. 모든 participant 조회가 ensure를 호출하는 것은 아니다.
- `ActiveMatchViewQuery`는 pending-unmatch expiry를 동기화한다. `MatchOverviewQuery`는 transaction에서 pending request/해제
  expiry를 처리한다. Chat metadata query에는 transaction을 전달하지 않으므로 **overview 전체가 단일 DB snapshot은 아니다**.
- `MatchesService`의 history 조회는 ended-season history를 먼저 materialize할 수 있다. Rebuild는 **season별** transaction이다.
- Home dashboard는 직접 model write를 하지 않지만 current-user/match overview를 조합한다. Endpoint-wide 무부작용을 약속하지 않는다.
- `active-match-lifecycle-sweep.service.ts`는 request/match/unmatch/event를 처리하며 participant 상태를 직접 복원하지 않는다.
- Season 운영 command는 repository의 `$transaction(fn)`을 사용한다. 이름만 보고 모든 transaction을 Serializable이라고 부르지 않는다.

## Accepted direct read debt

직접 relation `select/include/where/orderBy`, imported selector와 함수로 만든 filter도 읽기에 포함한다. Scalar FK/ID를
전달한 것만으로 해당 모델의 payload를 읽었다고 세지는 않는다. 아래는 현재 필요한 projection의 유지 결정이지 새 caller의
포괄적 승인이나 미래 분리 약속이 아니다. Runtime 빈도/비용은 여기서 측정하지 않았으며 static callsite 수로 추정하지 않는다.

| Caller / foreign data                                                             | 현행 이유·entry                                                                                                                                         | 재검토 조건 / 책임                                                                                                              |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| auth → users account/display                                                      | `credentials/`, `sessions/`, verification eligibility: 로그인/세션/credential 재검증과 actor 표시. Credential tx에서는 동일 client 필요                 | identity 필드/개인정보 정책 확대, tx-aware reader 제공 시 auth + users                                                          |
| users → participant/profile/history, Season                                       | display edit 등록 lock, 학적/birth-year lock, academic-year 허용량, 삭제 전 fail-closed 조건. `identity/`, `account-deletion/`                          | 등록/이력 보존 규칙 변경 또는 owner fact query 제공 시 users + participant/seasons                                              |
| participant → User/identity, Season/operation, ActiveMatch                        | `season-action-user.query.ts`, `season-context.query.ts`, withdrawal: 등록 직전 snapshot/eligibility와 철회 상태 tx 재검증. Backfill은 활성 사용자 scan | 중복 정책 drift, tx-aware query 추가 시 participant + users/seasons/matches                                                     |
| matches → participant/profile/history/User/Season/operation                       | `requests/persistence/`, `active/queries/`, `overview/`, `history/`: 조건 재검증·공개 projection·시간적 이력                                            | eligibility, visibility 또는 retention 변경 시 matches + source owner. Public registration snapshot reader와 direct read를 구별 |
| profiles / roommate-search → participant/profile/User                             | `profiles/targets/`, `roommate-search/candidates/`: 공개 대상 visibility/filter/projection. Metadata는 기존 block/bookmark/match/chat owner API도 사용  | Privacy/schema 변경, 두 번째 projection owner 또는 측정된 데이터량/latency 문제. 현재 DB pagination 보장으로 오해하지 않음      |
| dormitories → SeasonDormitoryOperation                                            | `selection-catalog/prisma-dormitory-selection-catalog.adapter.ts`: 운영 시즌과 selectable catalog 결합, optional caller tx 유지                         | selection 정책/season query contract 변경 시 dormitories + seasons                                                              |
| chat → User/participant, ActiveMatch, UserBlock, Season/operation context         | `context/`, `policies/`, `queries/`, `commands/`, `lifecycle/`: actor/member visibility·대화 가능 여부와 block 상태                                     | 인증/visibility/matching 정책 변경, owner context API 제공 시 chat + source owner                                               |
| notifications → ReportCaseEvent/ReportCase/User/participant                       | `commands/materialize-*.command.ts`, campaign fanout: source event를 알림/alert로 projection하고 수신자 자격 확인                                       | Event contract 안정화/중복 projection 또는 source mutation 제안 시 notifications + social-safety/users                          |
| social-safety → User/participant/profile/Season/match                             | `blocks/`, `bookmarks/`, `reports/resolvers/`: target 상태·목록 visibility·신고 권한 판단. Chat 증거는 owner context port                               | Target/privacy 규칙 변경 또는 owner context API 제공 시 social-safety + source owner                                            |
| support → ReportCase/participant                                                  | `repositories/support-ticket.repository.ts`: 문의 맥락 연결·조회. FAQ article/placement는 support-local                                                 | 개인 필드 확장/공통 context query 제공 시 support + source owner                                                                |
| retention → User, participant/profile history, match history, ConversationThread  | 삭제 전 identifier snapshot, archive target discovery/condition, queue readiness. `retained-identities/`, `archive-jobs/`                               | 새 archive target/status, payload 추가, owner discovery helper 제공 시 retention + source owner                                 |
| Source archive handlers → retention case/vault/hold                               | users/participant/matches/chat `retention/`: 원문 최소화와 hold/review 협업. 일반 product read debt와 달리 worker 목적·credential 제한                  | 대상/hold/payload 정책 변경 시 source owner + retention. Product read나 raw disclosure로 전용 금지                              |
| home-dashboard → season/participant/profile/history/match/chat 및 nested identity | `application/*query.ts`: Home allowlist count/history/next-season projection. Owner-public current-user/overview 결과도 조합                            | 개인정보/집계 정책, 측정된 query 비용 또는 owner summary query 추가 시 Home + source owner                                      |
| lifecycle → season/operation/campus                                               | `adapters/season-boundary-schedule.adapter.ts`: 다음 schedule 시각 결정만                                                                               | Schedule public reader 제공 또는 schedule 의미 변경 시 lifecycle + seasons                                                      |

Campus/college/dormitory, legal version, FAQ, notice, moderation catalog lookup은 reference 목적과 source owner를 함께 기록한다.
Owner-public 서비스로 얻는 DTO와 위 direct read를 혼동하지 않는다. Query 성능 때문에 새 복제/denormalization을 도입할 경우
별도의 데이터 수명·갱신 책임·정합성 결정을 요구한다.

## SQL, nested write와 삭제 영향

- [SQL inventory](../../../apps/api/test/architecture/testing/api-sql-inventory.fixture.ts)는 SQL asset/category를 등록한다.
  Business caller의 권한은 이 문서와 실제 transaction이 정한다. `$queryRawTyped()`도 UPDATE/DELETE일 수 있다.
- Auth: lockout/failure/verification/mail claim/cleanup SQL은 auth 소유 상태를 변경한다. `markVerificationCodeVerified.sql`은
  등록되어 있지만 현재 production caller가 없는 asset이며, 등록만으로 새 사용을 승인하지 않는다.
- Chat: outbox claim/prune는 write, replay cursor/events/recipients와 thread metadata는 read다. Notification outbox claim도 write다.
  Retention queue claim과 access-log disposal은 write다. Matches metadata는 read, row lock은 transaction control을 포함한 read다.
- DB time/readiness와 advisory-lock helper는 platform 기능이며 domain write 권한을 주지 않는다. SQL 등록/문자열 검사는
  실제 lock 획득·격리·rollback을 증명하지 않는다. 이러한 실행 의미는 별도 DB integration 증거로 확인한다.
- Signup의 display/academic identity 생성, verification code의 mail event 생성은 nested write다. Delegate 호출 하나가
  모델 하나만 변경한다고 가정하지 않는다. `connect` 등 FK 연결도 관계 불변 조건을 검토해야 한다.
- Runtime의 물리 delete를 schema FK와 함께 확인한다. Chat outbox 삭제는 recipient를 cascade 삭제하며,
  match-history rebuild의 entry 삭제는 retention link를 cascade 삭제한다. 각각 같은 source owner이지만 보존/재생성 조건을
  바꾸면 별도 검토가 필요하다. VerificationCode cleanup은 mail outbox FK를 SetNull 처리한다.
- 계정 삭제는 User row hard delete가 아니라 tombstone/minimization이다. User/Season/participant의 schema-wide Cascade를
  일반 삭제 권한으로 해석하지 않는다. 새로운 hard delete는 다른 owner의 Cascade/SetNull/Restrict 영향을 전부 재검토한다.

## Runtime 밖의 caller

- `apps/api/prisma/seed.ts`, `prisma/seeds/reference/`, seed fixture는 기준/개발 데이터 publication을 담당한다.
  Runtime command의 authority가 아니며 fixture-only 접근을 production owner 규칙의 예외로 재사용하지 않는다.
- `apps/api/test/`의 integration/stress fixture, `src/**/test-support/`, specs는 재현 환경의 setup/teardown이다.
  Production import를 허용하지 않는다. Generated Prisma/TypedSQL은 schema/SQL 산출물이지 업무 owner가 아니다.
- `apps/api/prisma/migrations/`, `infra/db/`의 migration/role-grant/restore 작업은 별도 운영 권한과 변경 절차를 따른다.
  API caller inventory만으로 운영 script의 실행 권한이나 실제 배포 role 상태를 증명하지 않는다.

## Enforcement와 변경 절차

1. 새 모델/호출부는 owner, operation, affected relation/nested/cascade 모델, 실제 client/transaction, 목적, public surface 또는
   read-debt 이유를 먼저 기록한다. Method-name 검색은 locator일 뿐이며 receiver alias·structural client·TypedSQL·wrapper도 확인한다.
2. 기존 `apps/api/test/architecture/domains/`, `cross-domain/chat-boundary.spec.ts`,
   `testing/api-sql-boundary.spec.ts`를 재사용한다. 새 suite나 raw call 수 고정으로 소유권을 대신하지 않는다.
3. 현행 guard는 모든 vertical deep import나 aliased delegate/모든 mutation method를 다 감지하지 않는다. Positive/negative
   fixture로 입증한 rule만 deterministic-static enforcement라고 부른다. Owner-public same-tx 협업은 positive case로 보존한다.
4. 이 문서는 advisory policy, semantic 분류는 review 결과다. Static guard는 DB privilege boundary나 모든 runtime 경로의 증명이 아니다.
   Credentials, payload privacy, transaction behavior와 실제 wiring 검증은 해당 보안/owner 검증을 별도로 통과해야 한다.
5. 위반이 발견되면 정확한 caller/필드/owner, 사용자 영향, same-tx 요건, 검증과 rollback을 가진 bounded 변경으로 처리한다.
   기존 baseline을 일부러 red로 만들거나 product mutation을 문서/guard 정리 안에 숨기지 않는다.

Service/database 분리는 독립 release·SLO/failure·운영 책임, 안정된 계약과 측정된 coupling 비용이 함께 있을 때 재검토한다.
DB 분리/read replica는 신뢰/복구 경계 또는 지속적인 connection/IO/lock/query 병목 증거가 있을 때 검토한다.
Broker/CDC도 전달/확장/failure 격리 필요가 입증될 때 결정하며, 현재 필요한 원자적 협업을 모양 때문에 eventual consistency로 바꾸지 않는다.
