# 지원/문의 커뮤니케이션 정책

## 문서 범위

이 문서는 사용자 문의, 신고/제재 이의 신청, FAQ, 이메일 회신 동의, 지원 알림 경계를 다룬다.

- 신고 사유와 제재 판단: [incident-enforcement.md](./incident-enforcement.md)
- 콘텐츠 안전 기준: [community-safety.md](./community-safety.md)
- 알림함 payload/privacy: [notification-inbox.md](./notification-inbox.md)
- 보관 기간과 RRPD 접근: [data-retention.md](./data-retention.md)

이 문서는 **support ticket / inquiry / appeal communication의 최종 소유 문서**다.

## 용어와 owner

| 용어                        | 의미                                                                           | owner                                        |
| --------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------- |
| support ticket              | 사용자가 서비스 운영자에게 보내는 일반 문의/버그/계정/시즌/매칭/신고 관련 요청 | support                                      |
| appeal                      | 제재, 임시조치, 신고 처리 결과에 대한 이의 신청                                | support intake + incident-enforcement review |
| FAQ                         | 반복 문의를 줄이기 위한 공개 도움말 콘텐츠                                     | support                                      |
| email optional consent      | 문의 답변을 이메일로도 받겠다는 사용자 선택                                    | support                                      |
| in-app support notification | 답변 등록, 상태 변경, 추가 정보 요청을 알리는 알림함 항목                      | notifications via support writer             |

## 지원 카테고리 baseline

| 카테고리    | 예시                                     | 연결 policy                                     |
| ----------- | ---------------------------------------- | ----------------------------------------------- |
| 계정/인증   | 로그인, 이메일 인증, 비밀번호, 탈퇴      | account-authentication.md / data-retention.md   |
| 시즌/기숙사 | 시즌 등록, 기숙사 선택, 참여 철회        | season-lifecycle.md / season-participation.md   |
| 매칭/채팅   | 요청, 확정, 대화, read-only 전환         | matching-lifecycle.md / chat-lifecycle.md       |
| 신고/차단   | 신고 접수 상태, 차단 관리                | incident-enforcement.md / matching-lifecycle.md |
| 이의 신청   | 제재/임시조치/신고 처리 결과 재검토 요청 | incident-enforcement.md                         |
| 기타/버그   | 위 카테고리에 속하지 않는 운영 문의      | support                                         |

## Support ticket lifecycle

| 상태               | 의미                               | 사용자-facing 동작                                         |
| ------------------ | ---------------------------------- | ---------------------------------------------------------- |
| `OPEN`             | 접수 완료, 아직 답변 없음          | 접수 확인 알림 가능                                        |
| `WAITING_USER`     | 추가 정보 요청                     | 사용자가 답변/첨부 보완 가능                               |
| `WAITING_OPERATOR` | 사용자가 보완했고 운영자 확인 대기 | 중복 제출을 막고 기존 ticket thread에 누적                 |
| `RESOLVED`         | 답변 또는 처리 완료                | 답변 알림 가능, 재문의는 새 ticket 또는 reopen 정책에 따름 |
| `CLOSED`           | 운영상 종료                        | read-only                                                  |

지원 ticket은 신고/제재 결정을 직접 수행하지 않는다. 신고 사유 판단, 제재 단계, 임시조치, 외부기관 이관은 [incident-enforcement.md](./incident-enforcement.md)가 소유한다.

## API/access baseline

| API                                                              | access                  | 정책                                                                           |
| ---------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------ |
| `GET /api/support/faq`, `GET /api/support/faq/:articleId`        | public                  | `published=true` FAQ만 반환하고 unpublished article은 숨긴다.                  |
| `POST /api/support/tickets`                                      | protected               | 본인 ticket 생성 + 첫 사용자 메시지를 같은 transaction으로 기록한다.           |
| `GET /api/support/tickets`, `GET /api/support/tickets/:ticketId` | protected               | 본인 ticket만 list/detail 조회할 수 있다.                                      |
| `POST /api/support/tickets/:ticketId/messages`                   | protected               | `CLOSED`가 아니면 본인 follow-up을 append하고 `WAITING_OPERATOR`로 전환한다.   |
| `GET /api/operations/support/tickets*`                           | `admin:support:read`    | 운영 queue/detail read. BackOffice UI가 아니라 backend protected API다.        |
| `POST /api/operations/support/tickets/:ticketId/replies`         | `admin:support:reply`   | 운영자 답변 메시지를 append하고 `WAITING_USER`/`RESOLVED`/`CLOSED`로 전환한다. |
| `POST /api/operations/support/tickets/:ticketId/resolve`         | `admin:support:resolve` | 메시지 추가 없이 `RESOLVED`/`CLOSED` 상태로 수렴한다.                          |

## Appeal policy

- 이의 신청은 support ticket의 category로 접수하되, 판단 owner는 incident-enforcement review다.
- 이의 신청에는 제재/임시조치 대상, 사용자 설명, 필요한 경우 첨부 자료가 포함될 수 있다.
- user-facing reply에는 신고인 정보, 내부 심사 메모, RRPD payload, 운영자 개인 식별 정보를 포함하지 않는다.
- 이의 결과 알림은 in-app notification이 primary이며, 사용자가 이메일 회신에 동의한 경우 이메일 사본을 보낼 수 있다.

## Email optional consent

| 항목           | 정책                                                                                   |
| -------------- | -------------------------------------------------------------------------------------- |
| 기본 채널      | in-app support inbox / notification                                                    |
| 이메일 회신    | 사용자가 ticket별로 선택한 경우에만 발송                                               |
| 이메일 payload | ticket 상태, 답변 요약, 앱 내 확인 유도. 신고 원문/RRPD/민감 첨부 원문은 포함하지 않음 |
| 동의 철회      | ticket 답변 전까지 철회 가능. 철회 후에는 in-app만 사용                                |
| 운영 로그      | 이메일 발송 성공/실패, provider message id, retry 상태를 민감값 없이 기록              |

## FAQ policy

- FAQ는 공개 도움말 콘텐츠이며 개인 사건/신고 결과를 포함하지 않는다.
- FAQ 항목은 `question`, `answer`, `category`, `published`, `updatedAt`을 기본 속성으로 본다.
- FAQ는 support ticket을 대체하지 않는다. 사용자가 해결하지 못한 경우 ticket 생성으로 이어져야 한다.
- 신고/제재/개인정보/탈퇴 FAQ는 각 official policy 문서의 source-of-truth를 요약해야 하며, 정책 owner와 충돌하면 policy 문서를 우선한다.

## Notification handoff

지원 도메인은 notification outbox나 realtime dispatcher를 직접 소유하지 않는다.

| 이벤트         | notification kind 후보           | payload 원칙                                                 |
| -------------- | -------------------------------- | ------------------------------------------------------------ |
| ticket 접수    | `SUPPORT_TICKET_CREATED`         | ticket id, category, 상태, 발생시각                          |
| 답변 등록      | `SUPPORT_TICKET_REPLIED`         | ticket id, 상태, 답변 존재 여부. 답변 본문 원문 제외         |
| 추가 정보 요청 | `SUPPORT_TICKET_ACTION_REQUIRED` | ticket id, required action code                              |
| 이의 결과      | `SUPPORT_APPEAL_RESOLVED`        | appeal/support ticket id, 결과 category. 내부 심사 메모 제외 |

MVP의 사용자 통지는 in-app notification이 primary다. Push와 native email marketing/campaign은 이 문서 범위가 아니며 [notification-inbox.md](./notification-inbox.md)의 제외 범위를 따른다.

## 보관/개인정보 경계

- support ticket 본문과 첨부는 운영 문의 처리 목적의 개인정보가 될 수 있다.
- 신고/제재 관련 ticket은 incident/report retention과 같은 3년 보관 기준에 맞춘다.
- 일반 support ticket은 처리 완료 후 운영상 필요한 기간만 보관하고, 구체 기간은 [data-retention.md](./data-retention.md)가 소유한다.
- support notification payload에는 raw support body, 이메일 주소, 첨부 원문, RRPD payload를 넣지 않는다.

## 후행 구현

| 구현 항목                   | 관련 이슈                            |
| --------------------------- | ------------------------------------ |
| support ticket API backend  | #79                                  |
| FAQ API backend             | #220                                 |
| support notification writer | #220 / #196                          |
| appeal review workflow      | #79 / incident-enforcement follow-up |

## 변경 이력

| 날짜       | 변경 내용                                                                                                | 관련 이슈         |
| ---------- | -------------------------------------------------------------------------------------------------------- | ----------------- |
| 2026-06-08 | support ticket/FAQ backend route, capability, self-only access, notification writer 구현 기준을 반영했다 | #79 / #220        |
| 2026-06-08 | support ticket, appeal, FAQ, email optional consent, notification handoff baseline을 추가했다            | #79 / #220 / #196 |
