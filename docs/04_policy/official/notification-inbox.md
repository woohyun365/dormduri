# 알림함 정책

## 문서 범위

이 문서는 사용자 in-app notification inbox, notification writer/outbox payload privacy, delivery channel 경계를 다룬다.

- 시즌 종료/운영 안내: [season-lifecycle.md](./season-lifecycle.md)
- 신고/제재 고지: [incident-enforcement.md](./incident-enforcement.md)
- 지원 문의 알림: [support-communication.md](./support-communication.md)
- 보관 기간과 RRPD: [data-retention.md](./data-retention.md)

이 문서는 **notification inbox와 payload privacy의 최종 소유 문서**다.

## Delivery channel baseline

| 채널                      | MVP 정책                                                | 비고                                                      |
| ------------------------- | ------------------------------------------------------- | --------------------------------------------------------- |
| In-app notification inbox | primary                                                 | API/BFF와 realtime sync가 읽기/상태 변경을 소유           |
| Realtime event            | 보조 동기화                                             | DB 상태가 source of truth. 누락 시 REST snapshot으로 수렴 |
| Push notification         | 제외                                                    | native push/device token/campaign은 후속 이슈             |
| Email notification        | support ticket별 optional consent 또는 운영 고지에 한정 | marketing/campaign 제외                                   |
| Operator alert sink       | 내부 운영 handoff                                       | 사용자 알림함이 아니며 local/test 기본 sink는 disabled    |

## Notification owner matrix

| 이벤트 계열                        | owner                                | writer 사용                                | payload 허용 범위                                      |
| ---------------------------------- | ------------------------------------ | ------------------------------------------ | ------------------------------------------------------ |
| chat thread created                | chat                                 | chat compatibility writer → generic writer | thread id, actor/recipient id, occurredAt              |
| report status / enforcement notice | social-safety / incident-enforcement | generic writer                             | report/ticket id, status category, generic reason code |
| profile mismatch feedback          | social-safety → notifications        | generic writer                             | report id, feedback prompt code, occurredAt            |
| support ticket update              | support                              | generic writer                             | support ticket id, category, status/action code        |
| season lifecycle notice            | seasons/lifecycle                    | generic writer                             | season id/campus/dormitory id, notice kind, deadline   |
| system notice                      | operations/system                    | generic writer                             | notice id, title key, severity                         |

Notification writer는 durable `UserNotification` row와 outbox append를 같은 transaction boundary에서 수행한다. 외부 도메인은 notification outbox/repository/dispatcher concrete를 직접 import하지 않는다.

## Payload privacy baseline

Notification payload는 allowlist DTO이며, 아래 raw/민감값을 넣지 않는다.

| 금지 payload                                             | 이유                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------ |
| report detail, raw evidence body, report screenshot body | 신고 원문/증거는 report/support owner와 RRPD 경계에서만 처리 |
| support body, support reply body 원문                    | 문의 본문은 support ticket detail에서 권한 확인 후 조회      |
| block note/internal moderation note                      | 운영 내부 판단과 사용자별 relation을 노출하지 않음           |
| email, nickname, academic identity 원문                  | identity projection은 각 domain read model이 소유            |
| RRPD/retained vault payload/key/reference                | product notification에 복원 가능 개인정보를 싣지 않음        |
| stack trace, provider raw error                          | 운영 로그 전용                                               |

User-facing 알림은 “상태가 바뀌었다/확인할 항목이 있다”를 알려주는 pointer다. 상세 본문과 증거는 각 owner API에서 다시 권한을 확인하고 제공한다.

## Inbox behavior

| 기능                       | 정책                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| list                       | 최신순 기본. cursor pagination 사용                                                           |
| unread count               | `readAt is null` 기준                                                                         |
| mark read                  | 사용자 본인의 notification만 가능                                                             |
| mark all read              | 사용자 본인의 unread notification만 일괄 read 처리. 반환값은 updatedCount/readAt pointer      |
| duplicate                  | `(recipientUserId, kind, sourceType, sourceId)` 단위 idempotent append                        |
| retention/deletion         | [data-retention.md](./data-retention.md)의 notification inbox 보관 기준을 따른다              |
| deleted/deidentified actor | notification payload의 actor 표시를 직접 신뢰하지 않고 owner read model에서 tombstone/degrade |

### Support notification payload

- `SUPPORT_TICKET_CREATED` payload는 `supportTicketId`, `category`, `status=OPEN`, `occurredAt`만 포함한다.
- `SUPPORT_TICKET_REPLIED` payload는 `supportTicketId`, `status`, `occurredAt`만 포함한다.
- `SUPPORT_TICKET_ACTION_REQUIRED`와 `SUPPORT_APPEAL_RESOLVED`는 contract/policy allowlist로 남기되, 실제 action-required/appeal-result delivery는 해당 owner 구현 시점에 연결한다.
- support ticket body, reply body, email, raw appeal detail, RRPD payload는 notification payload에 넣지 않는다.

### Profile mismatch feedback

허위 프로필 신고 중 생활패턴/주관적 필드 불일치는 제재 알림이 아니라 다음 시즌 프로필 재검토를 유도하는 feedback/prompt pointer다.

- `PROFILE_MISMATCH_FEEDBACK` payload는 `reportId`, `promptCode`, `occurredAt`만 포함한다.
- reporter id, 신고 detail, 증거 본문, mismatch 원문은 notification payload에 넣지 않는다.
- 실제 prompt rendering/hook/page는 Web 후속 범위이며, backend inbox는 delivery pointer만 소유한다.

### Campaign and operator alert separation

- `NotificationCampaign`은 season/system notice를 bounded chunk로 per-user inbox에 fanout하는 내부 operations state다.
- Campaign fanout은 idempotent append와 cursor/progress를 사용하며, marketing/native push campaign은 이 문서 범위가 아니다.
- `OperatorAlert`는 high-risk report 등 운영자 확인이 필요한 내부 alert다. 사용자-facing notification row를 만들지 않는다.
- External Discord/Slack류 sink는 adapter seam만 두고, 실제 webhook/secret 값은 배포 환경에서 주입한다. local/test 기본 sink는 disabled/noop로 동작한다.

## Realtime/outbox policy

- Outbox event는 notification row 생성 결과를 delivery worker/realtime에 전달하기 위한 내부 이벤트다.
- Realtime event는 상태 전이의 원인이 아니며, client는 cursor 만료/누락 시 REST list/unread count로 수렴해야 한다.
- Dispatch 실패는 retry/backoff 대상이다. 실패 로그에는 payload 원문, report/support body, RRPD payload를 출력하지 않는다.
- Native push/device token과 marketing campaign은 MVP notification inbox와 분리된 후속 범위다.

## 후행 구현

| 구현 항목                             | 관련 이슈                      |
| ------------------------------------- | ------------------------------ |
| report/support notification kind 추가 | #196 / #220                    |
| operator alert external channel value | #220 follow-up                 |
| native push/device token              | follow-up                      |
| notification retention cleanup        | operations/retention follow-up |

## 변경 이력

| 날짜       | 변경 내용                                                                                                      | 관련 이슈   |
| ---------- | -------------------------------------------------------------------------------------------------------------- | ----------- |
| 2026-06-08 | support ticket created/replied pointer-only notification payload 구현 기준을 반영했다                          | #79 / #220  |
| 2026-06-08 | `PROFILE_MISMATCH_FEEDBACK`, read-all, bounded campaign, operator alert 분리/disabled sink baseline을 추가했다 | #220 / #196 |
| 2026-06-08 | in-app notification primary, Push 제외, generic writer/outbox, payload privacy baseline을 추가했다             | #196 / #220 |
