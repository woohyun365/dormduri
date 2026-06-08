# Support API module architecture

Support 도메인의 server-side boundary map이다. 이 문서는 다음 세션이 `apps/api/src/support`의 support ticket, appeal intake, FAQ, notification handoff 책임과 수정 위치를 빠르게 파악하기 위한 orientation note다.

## Public boundary

- `SupportModule`: support ticket/FAQ HTTP API provider wiring을 제공한다. 외부 도메인에 production provider를 export하지 않는다.
- `support tickets`: 계정/시즌/매칭/신고 관련 사용자 문의 thread를 소유한다. 사용자는 본인 ticket만 list/detail/reply할 수 있다.
- `appeals`: 제재·임시조치·신고 처리 결과에 대한 이의 신청 intake를 `APPEAL` category와 `appealCategory` metadata로 접수한다. 판단은 incident-enforcement/review owner가 소유한다.
- `FAQ`: published FAQ read model을 제공한다. `published=false` article은 public API에서 not found 또는 list 제외로 fail-closed 한다.
- `support notifications`: notification outbox/repository/command concrete를 직접 import하지 않고 `NOTIFICATION_WRITER` port로 pointer-only in-app notification을 요청한다.

## Directory responsibilities

- `application/`: `SupportService` controller-facing facade. Ticket command/query/FAQ query에만 위임한다.
- `commands/`: ticket 생성, user message append, operator reply, resolve/close write use case. Ticket/message/status/notification 변경은 transaction 안에서 처리한다.
- `queries/`: own/operations ticket list/detail, FAQ published read model, cursor encode/decode owner.
- `policies/`: status transition, support payload privacy, ownership helper. Notification internals나 Prisma mutation을 넣지 않는다.
- `repositories/`: `SupportTicket`, `SupportTicketMessage`, `SupportFaqArticle` persistence owner. Notification/report/enforcement 판단을 하지 않는다.
- `presenters/`: ticket/message/FAQ response allowlist projection. Ticket list/detail root에 email/raw support body/RRPD payload를 노출하지 않는다.
- `notifications/`: `NOTIFICATION_WRITER` adapter. Payload는 ticket id/status/action pointer만 포함한다.
- `contracts/`: shared/API support contract behavior regression spec.
- `composition/`: `SupportModule` provider/export grouping.
- `errors/`: user-facing support error contract.

## Hard rules

- Support production code는 retained vault/RRPD disclosure internals를 직접 import하지 않는다.
- Support production code는 `notifications/outbox`, `notifications/commands`, `notifications/policies` concrete를 import하지 않는다. Generic `NOTIFICATION_WRITER` port만 사용한다.
- Support notification payload에는 support body, reply body, email, raw appeal detail, RRPD payload를 넣지 않는다.
- Email reply는 ticket별 optional consent field로만 저장한다. Email provider delivery는 mail delivery owner가 소유한다.
- Appeal intake는 review 요청이지 제재 outcome mutation이 아니다.
- Operations API는 BackOffice UI가 아니라 capability-protected backend endpoint다.
- support API module은 Web rendering/hook/page/component를 소유하지 않는다.

## Architecture guard

- Root production TypeScript file은 `support.module.ts`, `support.controller.ts`만 허용한다.
- Contract spec은 `contracts/support-contract.spec.ts`가 소유한다.
- Support root production file boundary, retained vault import guard, notification concrete import guard는 `apps/api/src/architecture/social-safety/social-safety-boundary.spec.ts`가 고정한다.
- Route access matrix는 `apps/api/src/architecture/security/auth-access-route-matrix.spec.ts`가 고정한다.
- Prisma model/index guard는 architecture social-safety persistence spec이 고정한다.

## Where to change

- HTTP route parsing/delegation: `support.controller.ts`.
- Controller-facing facade: `application/support.service.ts`.
- Ticket create/user message/operator reply/resolve transaction behavior: `commands/`.
- Ticket list/detail and FAQ read behavior: `queries/`.
- Ticket/message/FAQ persistence shape: `repositories/`.
- Status transition and payload privacy rule: `policies/`.
- User-facing response projection: `presenters/`.
- In-app support notification handoff: `notifications/support-notification.service.ts`.
- Shared request/response contracts: `packages/shared/src/support/contract.ts` and `contracts/support-contract.spec.ts`.
- Persistence schema/migration SQL: `apps/api/prisma/schema.prisma` and the initial migration SQL.

## Route matrix

- Public FAQ:
  - `GET /api/support/faq`
  - `GET /api/support/faq/:articleId`
- Protected user ticket API:
  - `POST /api/support/tickets`
  - `GET /api/support/tickets`
  - `GET /api/support/tickets/:ticketId`
  - `POST /api/support/tickets/:ticketId/messages`
- Operations API:
  - `GET /api/operations/support/tickets` — `admin:support:read`
  - `GET /api/operations/support/tickets/:ticketId` — `admin:support:read`
  - `POST /api/operations/support/tickets/:ticketId/replies` — `admin:support:reply`
  - `POST /api/operations/support/tickets/:ticketId/resolve` — `admin:support:resolve`

## Useful verification

```bash
pnpm --dir apps/api exec jest --watchman=false --runInBand \
  src/support \
  src/architecture/social-safety/social-safety-boundary.spec.ts \
  src/architecture/social-safety/*.spec.ts \
  src/architecture/security/auth-access-route-matrix.spec.ts \
  src/architecture/module-boundary.spec.ts
pnpm api:typecheck
pnpm --dir apps/api exec eslint <changed support files without apps/api prefix>
git diff --check
```
