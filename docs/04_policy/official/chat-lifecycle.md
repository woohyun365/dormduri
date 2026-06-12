# 채팅 생명주기 정책

## 문서 범위

이 문서는 1:1 채팅 thread의 생성, 쓰기 권한, read-only/archive 전환, block/report 연동, realtime/outbox, retained body 경계를 다룬다.

- 매칭 request/active match 상태: [matching-lifecycle.md](./matching-lifecycle.md)
- 시즌 상태와 `roomSelectionDate`/`seasonEndDate`: [season-lifecycle.md](./season-lifecycle.md)
- 신고/제재 판단: [incident-enforcement.md](./incident-enforcement.md)
- 데이터 보존과 RRPD retained vault: [data-retention.md](./data-retention.md)
- 알림함 payload/delivery: [notification-inbox.md](./notification-inbox.md)

이 문서는 **chat thread lifecycle과 chat write/read capability의 최종 소유 문서**다.

## Thread 종류와 authority

| thread 종류               | 생성/재사용 기준                                                                | lifecycle authority                   |
| ------------------------- | ------------------------------------------------------------------------------- | ------------------------------------- |
| non-matched direct thread | 같은 season/pair에서 direct chat 진입 또는 message send가 허용될 때 생성/재사용 | chat command/query                    |
| matched pair thread       | active match accept 이후 matched pair relation과 함께 유지                      | chat lifecycle + match lifecycle port |
| archived/past thread      | season 종료, retention, 양측 leave, archive 조건 도달                           | chat lifecycle + retention            |

외부 도메인은 chat table을 직접 mutation하지 않는다. Match, season-participant withdrawal, social-safety block 같은 외부 이벤트는 chat lifecycle port를 통해 chat owner가 thread 상태를 변경한다.

## 상태와 사용자-facing 의미

| 상태                       | 의미                                                   | 읽기                                         | 쓰기                                          |
| -------------------------- | ------------------------------------------------------ | -------------------------------------------- | --------------------------------------------- |
| `OPEN`                     | 현재 대화 가능                                         | 가능                                         | 가능                                          |
| `READ_ONLY`                | 더 이상 새 메시지를 받을 수 없지만 이력 확인 가능      | 가능                                         | 불가                                          |
| `ARCHIVED`                 | 현재 활동 surface에서 제외되고 과거/보존 성격으로 전환 | 제한적 가능 또는 tombstone                   | 불가                                          |
| block-closed direct thread | user block으로 닫힌 non-matched direct thread          | 차단/상대 visibility 정책에 따라 fail-closed | 불가. unblock 후 explicit resume에서만 재검토 |

구현 enum 이름은 shared/prisma contract에서 확정하되, 정책상 `READ_ONLY`/`ARCHIVED`/block-closed의 의미를 혼합하지 않는다.

## Current state / lifecycle trace / outbox / retention source of truth

채팅 thread의 사용자-facing 상태와 운영 추적 상태는 아래처럼 분리한다.

| 영역                                | 소유 책임                                                                                                                 | 하지 않는 일                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `ConversationThread` current row    | REST 조회, realtime payload, write 가능 여부가 참조하는 사용자-facing current state(`status`, `closedReason`, `closedAt`) | lifecycle history 전체를 대체하지 않음                                                   |
| `ConversationThreadLifecycleEvent`  | thread 생성/재개/read-only/archive 같은 상태 전이의 append-only 운영·audit·debug trace                                    | event sourcing source, current state rebuild source, socket replay source로 쓰지 않음    |
| `ChatRealtimeOutboxEvent`           | socket.io publish/replay를 위한 user-facing delivery event                                                                | lifecycle audit log나 retained payload workflow state를 대체하지 않음                    |
| retention owner / `ArchiveJob` 경계 | `THREAD_RETENTION` job, retained vault, retention case/review/access log 같은 보존 workflow state                         | chat lifecycle event table이나 `ConversationThread` row로 workflow state를 중복하지 않음 |

외부 도메인은 `ConversationThreadLifecycleEvent` writer/repository를 직접 호출하지 않는다. Match, season-participant withdrawal, social-safety block, moderation/admin close 같은 외부 이벤트는 chat lifecycle port로 들어오고, chat owner가 current row 변경, realtime outbox append, lifecycle event append를 같은 transaction 경계에서 조율한다.

`ConversationThreadLifecycleEvent`는 전이 사실과 source pointer를 남기는 trace다. 전이 후 현재 상태 판단은 항상 `ConversationThread` current row를 기준으로 하며, event replay로 thread/member/outbox/read model을 재구성하지 않는다.

`ConversationThreadRetentionState`는 현재 도입하지 않는다. Thread archive 이후 원문 보존·tombstone·retry·manual review 상태는 [data-retention.md](./data-retention.md)의 `ArchiveJob(THREAD_RETENTION)` / retained vault / retention review 경계가 소유한다. 단일 thread 기준 retention dashboard나 partial archive workflow state가 실제 운영 요구로 확인되면 별도 이슈로 재검토한다.

## Thread transition matrix

| 전이/상황                         | 사용자-facing current state                                            | realtime/outbox                    | lifecycle event trace                                                              | retention workflow                                            |
| --------------------------------- | ---------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| direct/matched thread 생성·재개   | `OPEN`, 쓰기 가능                                                      | thread/message 변경 outbox append  | `THREAD_CREATED` 또는 `THREAD_REOPENED` 후보                                       | 없음                                                          |
| room selection cutoff             | 대상 thread를 `READ_ONLY`로 전환, 쓰기 불가                            | `chat.thread.updated`              | `THREAD_READ_ONLY` / `ROOM_SELECTION_CUTOFF` 후보                                  | 없음                                                          |
| season end sweep                  | `READ_ONLY` 또는 archive 후보                                          | `chat.thread.updated` 또는 archive | `THREAD_READ_ONLY` 또는 `THREAD_ARCHIVED` / season reason                          | archive 조건 충족 시 `ArchiveJob(THREAD_RETENTION)` 후보      |
| participant withdrawal            | 관련 thread를 `READ_ONLY` 또는 fail-closed surface로 전환              | `chat.thread.updated`              | `THREAD_READ_ONLY` / `PARTICIPANT_WITHDRAWN` 후보                                  | 없음                                                          |
| user block                        | non-matched direct thread를 `READ_ONLY`, visibility는 fail-closed 가능 | `chat.thread.updated`              | `THREAD_READ_ONLY` / `USER_BLOCKED`; block note 저장 금지                          | 없음                                                          |
| moderation/admin close 후보       | 운영 결정에 따라 `READ_ONLY` 또는 archive 후보                         | user-facing 상태 변경 시 outbox    | `THREAD_READ_ONLY` / `MODERATION_ACTION` 또는 `ADMIN_ACTION`; raw detail 저장 금지 | source policy와 retention/disclosure workflow 기준            |
| archive 후 `THREAD_RETENTION` job | `ARCHIVED`, 쓰기 불가, 제한/tombstone read                             | `chat.thread.archived`             | `THREAD_ARCHIVED`; archive job id pointer만 허용                                   | `ArchiveJob`, `RetainedVaultObject`, review/access log가 소유 |

## 생성/쓰기 권한

| 상황                                                                  | 정책                                                                                                |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 같은 dormitory, registration 완료, public target detail/action 가능   | non-matched direct chat 생성/쓰기 후보                                                              |
| active matched pair                                                   | matched pair thread는 `SEASON_MATCHING` + `SEASON_POST_MATCH` 동안 `seasonEndDate` 전까지 쓰기 가능 |
| 기숙사별 `roomSelectionDate` 이후                                     | 신규 match request와 non-matched direct write는 닫힘                                                |
| 캠퍼스 `seasonEndDate` 이후                                           | matched pair thread도 read-only/archive 전환 대상                                                   |
| hidden/deactivated/withdrawn/expired/deleted/deidentified participant | 신규 chat action fail-closed                                                                        |
| 양방향 active block 중 하나라도 존재                                  | 신규 send/resume fail-closed                                                                        |

쓰기 가능 여부는 realtime event가 아니라 DB 상태와 REST snapshot이 source of truth다. Realtime event가 누락되어도 client는 REST snapshot으로 수렴해야 한다.

## Leave / read marker / visibility

| 기능                      | 정책                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- |
| thread detail/read marker | non-member, hidden, archived, left 상태는 not-found 또는 equivalent fail-closed 허용                          |
| leave                     | 기존 user-facing `leave not allowed` 계열 behavior를 보호한다. guard 선차단으로 error code가 바뀌지 않게 주의 |
| 양측 leave                | thread는 current list에서 사라질 수 있으며 archive/retention 기준은 chat lifecycle owner가 판단               |
| read-only thread          | 신고 가능. write는 닫히지만 evidence/abuse 대응 경로는 유지                                                   |

## Block 연동

User block은 viewer-specific relation이며 신고/제재나 participant-level hidden projection과 다르다.

| 이벤트                                                 | chat 처리                                                                                                                                                                                                |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| block create                                           | 같은 season/pair의 non-matched direct `OPEN` thread를 close/read-only 처리. active matched pair block은 거부하고 report/support/admin separation 안내                                                    |
| unblock                                                | thread를 즉시 reopen하지 않음. block relation/event만 닫음                                                                                                                                               |
| explicit resume/send                                   | unblock 이후 사용자가 다시 채팅 action을 수행할 때 active block 양방향 absence를 transaction 내부에서 재확인하고, 같은 season/pair의 non-archived block-closed direct thread를 새 thread보다 우선 재사용 |
| archived/both-left/retention/deleted/new-season thread | reopen하지 않음                                                                                                                                                                                          |

이 구조는 “차단 해제 = 대화 자동 복원” 오해를 막으면서 같은 season/pair의 중복 direct thread 생성을 방지한다.

## Report / safety 연동

- 신고 접수는 intake-only이며, chat thread를 직접 archive/hidden 처리하지 않는다.
- 고위험 신고는 operator alert 또는 즉시 보호 조치 검토 후보가 될 수 있다.
- 일반 신고는 관리자 검토 후 필요한 경우 chat lifecycle side-effect 또는 participant projection을 갱신한다.
- 신고/제재 알림 payload와 `ConversationThreadLifecycleEvent` metadata에는 raw message body, report detail, RRPD payload를 넣지 않는다. 필요한 경우 lifecycle event에는 `sourceReportCaseId` 같은 source pointer만 남기고, 세부 판단·증거는 social-safety 원장 또는 승인된 retention disclosure workflow에서 조회한다.

## Lifecycle event metadata privacy

Lifecycle event metadata는 allowlist 기반 pointer만 저장한다.

| 허용 예시                                                                  | 의미                                   |
| -------------------------------------------------------------------------- | -------------------------------------- |
| `sourceActiveMatchId`, `sourceMatchRequestId`, `sourceUnmatchRequestId`    | match lifecycle source pointer         |
| `sourceBlockId`, `sourceReportCaseId`, `sourceArchiveJobId`                | social-safety/retention source pointer |
| `previousStatus`, `nextStatus`, `previousClosedReason`, `nextClosedReason` | 전이 전후 machine-readable state       |
| `previousThreadKind`, `nextThreadKind`                                     | thread kind 전이 trace                 |

금지: message body, retained body/vault payload/object, report detail, block note raw text, support body, email/token/provider credential, raw Prisma error/stack trace, internal disclosure/audit payload. 운영자가 세부 사유를 확인해야 하면 source domain 원장 또는 approval/access log가 있는 disclosure workflow를 따라간다.

## Realtime / outbox policy

| 항목                 | 정책                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| realtime event       | DB 상태 변화 결과를 빠르게 전달하는 보조 동기화 수단                                                     |
| outbox               | thread/message/read state 변경과 같은 transaction boundary에서 append                                    |
| replay/cursor        | 누락/만료 시 REST snapshot으로 수렴                                                                      |
| logging              | message body, retained body, vault payload, support/report raw detail을 일반 로그에 출력하지 않음        |
| notification handoff | chat notification은 notification writer/outbox boundary를 사용하며 notification payload privacy를 따른다 |

## Retention / RRPD 경계

- 채팅 thread 전체를 계정 삭제만으로 즉시 삭제하지 않는다.
- archive 이후 message body 원문은 [data-retention.md](./data-retention.md)의 `CHAT_MESSAGE_BODY` retained vault 정책을 따른다.
- 사용자-facing row는 tombstone/minimal shell로 degrade할 수 있으며, product API/realtime/cache는 retained vault 원문을 복원하지 않는다.
- 신고/분쟁/수사 협조 목적의 복원은 approval/access log가 있는 운영 disclosure workflow에서만 허용한다.
- `ConversationThreadLifecycleEvent`는 archive/read-only 전이 사실을 추적할 수 있지만, retained body 이동, retry, manual review, disclosure approval/access log의 workflow state를 소유하지 않는다.

## 후행 구현

| 구현 항목                                        | 관련 이슈                 |
| ------------------------------------------------ | ------------------------- |
| block side-effect port adapter                   | #196                      |
| lazy explicit resume/send regression             | #196 / #198               |
| notification payload privacy 정합화              | #196 / #220               |
| replay window/Redis/managed realtime 운영 재점검 | #250 / #251 / #252 / #254 |

## 변경 이력

| 날짜       | 변경 내용                                                                                                                                                                   | 관련 이슈          |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 2026-06-12 | `ConversationThread` current row, lifecycle event trace, realtime outbox, retention workflow state의 책임 경계를 분리하고, lifecycle event metadata privacy 기준을 추가했다 | #228               |
| 2026-06-08 | official policy set의 누락된 chat lifecycle source-of-truth를 추가하고 block/report/notification/retention 경계를 Phase 0 baseline에 맞춰 정리했다                          | #196 / #198 / #220 |
