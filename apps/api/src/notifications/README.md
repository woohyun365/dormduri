# Notifications API module architecture

알림함 도메인의 server-side boundary map이다. 이 문서는 다음 세션이 `apps/api/src/notifications` 책임, public surface, 수정 위치를 빠르게 파악하기 위한 orientation note다.

## Public boundary

외부 domain은 notification outbox/repository/dispatcher/payload internals를 import하지 않는다. 필요한 기능은 purpose-specific port token으로 사용한다.

- `NotificationsModule`: notification HTTP read model, writer port, chat compatibility writer wiring을 제공한다.
- `NOTIFICATION_WRITER`: social-safety/support/system/chat이 durable `UserNotification` + outbox append를 요청할 때 사용하는 generic writer port다.
- `CHAT_THREAD_NOTIFICATION_WRITER`: chat thread created notification을 위한 compatibility adapter token이다. 내부 구현은 `NOTIFICATION_WRITER`를 호출한다.
- `NotificationQueryService`: internal module export가 필요한 read facade다. User-facing HTTP route는 `NotificationsService`와 controller가 소유한다.
- `NOTIFICATION_REALTIME_PUBLISHER`: notification outbox dispatcher가 realtime publish를 요청하는 port다. 현재 host는 chat realtime module이며, external domain은 dispatcher concrete를 직접 import하지 않는다.

## Directory responsibilities

- `application/`: controller-facing facade와 public port definitions. `NotificationsService`는 query delegation만 맡는다.
- `application/ports/`: external domain이 import할 수 있는 notification writer/realtime/chat compatibility port token과 types.
- `commands/`: durable notification write use case. `create-notification.command.ts`가 generic writer source of truth이고 chat-specific command는 adapter다.
- `composition/`: module provider/export summary와 dispatcher host provider handoff. External module은 outbox concrete가 아니라 composition provider를 사용한다.
- `contracts/`: notification shared contract behavior regression spec.
- `errors/`: notification user-facing error contract.
- `mappers/`: `UserNotification` response projection allowlist.
- `outbox/`: notification outbox claim/publish/retry persistence and dispatcher orchestration. External domain import 금지.
- `policies/`: notification payload privacy allowlist. report detail, block note, support body, email, RRPD/retained vault payload를 금지한다.
- `queries/`: notification list/unread/read state query owner and cursor policy.

## Hard rules

- `chat`, `social-safety`, `support` production code는 `notifications/outbox`, `notifications/policies`, `notifications/mappers`, `notifications/commands`를 직접 import하지 않는다.
- 외부 domain은 notification 생성 시 `NOTIFICATION_WRITER` 또는 compatibility token만 사용한다.
- `CHAT_THREAD_NOTIFICATION_WRITER`는 compatibility adapter일 뿐 main writer가 아니다.
- payload는 반드시 `notification-payload.policy.ts` allowlist를 통과해야 한다.
- realtime/outbox payload와 support/report raw body를 일반 로그에 출력하지 않는다.
- user-facing notification API route/response contract는 refactor만으로 변경하지 않는다.
- root production TypeScript file은 `notifications.module.ts`, `notifications.controller.ts`만 허용한다.

## Architecture guard

- Root production file boundary는 `apps/api/src/architecture/notifications/notifications-boundary.spec.ts`가 고정한다.
- Cross-domain notification/chat realtime boundary는 `apps/api/src/architecture/cross-domain-chat-boundary.spec.ts`가 고정한다.
- Shared notification contract layout은 `apps/api/src/architecture/contracts/layout/notification-shared-contract-layout.spec.ts`가 고정한다.
- Payload privacy guard는 `policies/notification-payload.policy.spec.ts`와 dispatcher spec이 고정한다.

## Where to change

- HTTP route delegation: `notifications.controller.ts`.
- Controller-facing facade delegation: `application/notifications.service.ts`.
- Generic notification append behavior: `commands/create-notification.command.ts`.
- Chat thread notification adapter behavior: `commands/create-chat-thread-notification.command.ts`.
- Notification list/unread/read query behavior: `queries/`.
- Notification response projection: `mappers/notification-presenter.ts`.
- Payload privacy policy: `policies/notification-payload.policy.ts`.
- Outbox claim/publish/retry behavior: `outbox/`.
- Module provider/export wiring: `composition/`.

## Useful verification

```bash
pnpm --dir apps/api test -- src/notifications --runInBand
pnpm --dir apps/api test -- src/architecture/notifications/notifications-boundary.spec.ts src/architecture/cross-domain-chat-boundary.spec.ts src/architecture/module-boundary.spec.ts --runInBand
pnpm api:typecheck
git diff --check
```
