# Chat API module architecture

Issue #198 실시간 채팅 구현의 server-side boundary map이다. 이 문서는 구현 세부가 아니라 다음 세션이 `apps/api/src/chat` 책임, public surface, 수정 위치를 빠르게 파악하기 위한 orientation note다.

## Public boundary

외부 domain은 concrete `ChatService`를 import/inject하지 않는다. 필요한 기능은 목적별 port token을 통해 사용한다.

- `ChatModule`: chat HTTP/realtime/lifecycle provider wiring을 제공한다.
- `CHAT_MATCH_THREAD_LIFECYCLE_PORT`: match accept/unmatch transaction 안에서 matched/direct thread lifecycle을 갱신한다.
- `CHAT_THREAD_WITHDRAWAL_PORT`: season participant withdrawal transaction 안에서 open direct thread를 read-only로 전환하고 realtime outbox를 append한다.
- `CHAT_LIFECYCLE_SWEEP_PORT`: top-level lifecycle sweep에서 chat thread cutoff/season lifecycle을 수렴한다.
- `REALTIME_*_PORT`: notification/health 등 외부 domain은 chat realtime concrete class 대신 generic realtime token을 사용한다.

## Directory responsibilities

- `adapters/`: notification realtime publisher adapter 같은 external port adapter.
- `application/`: HTTP/Gateway-facing facade, command/user-context helper, public port definitions. `ChatService`는 controller-facing orchestration만 맡고 cross-domain lifecycle port 구현을 소유하지 않는다.
- `commands/`: send/leave/read-marker write use case. DB transaction, idempotency, outbox append는 command owner 책임이다.
- `context/`: route-level chat thread context decorator/guard/resolver. Guard는 route metadata와 request context 주입만 맡고, Prisma 조회는 resolver가 소유한다.
- `contracts/`: shared chat/realtime contract behavior regression spec. Shared package layout fitness는 architecture가 소유한다.
- `errors/`: chat user-facing error contract.
- `events/`: realtime payload mapper allowlist. raw retained body, vault payload, internal audit data를 payload에 넣지 않는다.
- `lifecycle/`: active match, participant withdrawal, season/cutoff lifecycle owner. 외부 domain에서 발생한 chat state side effect는 이 디렉토리의 port 구현으로 들어온다.
- `mappers/`: chat thread/message presenter and response projection helper.
- `outbox/`: transactional outbox persistence, claim, replay owner. payload allowlist와 replay window/prune 정책을 유지한다.
- `pairs/`: actor-target pair entry query/use-case. `GET /threads/with/:targetUserId`의 target validation, existing thread snapshot, send eligibility 조합을 소유하며 guard나 send transaction으로 분산하지 않는다.
- `persistence/`: advisory lock and Prisma select shape helpers.
- `policies/`: pure policy/helper 우선. Nest provider나 Prisma mutation을 넣지 않는다. DB가 필요한 orchestration은 command/query/lifecycle owner에 둔다.
- `queries/`: thread list/detail/subscription/read-only query owner. message body over-fetch를 피하고 pagination/cursor boundary를 유지한다.
- `realtime/`: chat namespace/ticket/auth/subscribe/gateway adapter. domain-neutral publish/metrics/config token은 `apps/api/src/realtime`에 둔다.

## Hard rules

- 외부 domain production code에서 `../chat/application/chat.service` import 금지.
- `season-participants`에서 `conversationThread` / `conversationMessage` 직접 mutation 금지(direct chat table mutation outside chat 금지).
- `notifications`에서 `chat/realtime/*` concrete class나 `config/chat-realtime.config` 직접 import 금지.
- `ChatThreadContextGuard`는 Prisma를 직접 조회하지 않고 `ChatThreadContextResolver`에 위임한다.
- `leaveThread`의 user-facing `CHAT_THREAD_LEAVE_NOT_ALLOWED` behavior는 service/command path가 보존한다.
- 새 `forwardRef()`로 boundary 문제를 봉합하지 않는다.
- realtime/outbox payload를 일반 로그에 출력하지 않는다.
- user-facing API route/response contract는 refactor만으로 변경하지 않는다.

## Architecture guard

- Root production TypeScript file은 `chat.module.ts`, `chat.controller.ts`만 허용한다.
- Root spec file은 `chat.controller.spec.ts`만 허용한다.
- Cross-domain chat boundary는 `apps/api/src/architecture/cross-domain-chat-boundary.spec.ts`와 chat-local `application/chat-architecture-boundary.spec.ts`가 고정한다.
- Chat context guard/resolver boundary는 `context/chat-thread-context.guard.spec.ts`, `context/chat-thread-context.resolver.spec.ts`가 고정한다.
- Shared chat/realtime behavior contract는 `contracts/chat-realtime-contract.spec.ts`가 소유한다.
- ChatModule provider/export wiring은 현재 module file이 소유한다. Provider list가 더 커지면 auth/dormitories/season-participants처럼 `composition/` 분리를 별도 refactor로 다룬다.

## Where to change

- HTTP route delegation: `chat.controller.ts`.
- Controller/Gateway-facing facade delegation: `application/chat.service.ts`.
- Send/leave/read-marker write behavior: `commands/`.
- Thread list/detail/subscription query behavior: `queries/`.
- Actor-target pair entry behavior: `pairs/`.
- Route-level thread context metadata/guard/resolver: `context/`.
- Match/season/participant withdrawal side effects: `lifecycle/`.
- Realtime ticket/auth/gateway/dispatcher/metrics/rate-limit behavior: `realtime/`.
- Transactional outbox and replay behavior: `outbox/`.
- Realtime payload mapping: `events/`.
- Shared chat/realtime response/event contracts: `packages/shared/src/chat/**` and API `contracts/` specs.

## Useful verification

```bash
pnpm --dir apps/api exec jest --watchman=false --runInBand \
  src/architecture/cross-domain-chat-boundary.spec.ts \
  src/chat/application/chat-architecture-boundary.spec.ts \
  src/chat/context/chat-thread-context.guard.spec.ts \
  src/chat/context/chat-thread-context.resolver.spec.ts \
  src/chat/contracts/chat-realtime-contract.spec.ts \
  src/chat
pnpm api:typecheck
git diff --check
```
