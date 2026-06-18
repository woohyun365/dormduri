# Chat API module architecture

채팅 도메인의 server-side boundary map이다. 이 문서는 구현 세부가 아니라 다음 세션이 `apps/api/src/chat` 책임, public surface, 수정 위치를 빠르게 파악하기 위한 orientation note다.

## Public boundary

외부 domain은 concrete `ChatService`를 import/inject하지 않는다. 필요한 기능은 목적별 port token을 통해 사용한다.

- `ChatModule`: chat HTTP/realtime/lifecycle provider wiring을 제공한다.
- `CHAT_MATCH_THREAD_LIFECYCLE_PORT`: match accept/unmatch transaction 안에서 matched/direct thread lifecycle을 갱신한다.
- `CHAT_THREAD_WITHDRAWAL_PORT`: season participant withdrawal transaction 안에서 open direct thread를 read-only로 전환하고 realtime outbox를 append한다.
- `CHAT_LIFECYCLE_SWEEP_PORT`: top-level lifecycle sweep에서 chat thread cutoff/season lifecycle을 수렴한다.
- `CHAT_BLOCK_SIDE_EFFECT_PORT`: social-safety block create transaction이 non-matched direct thread close를 요청할 때 사용하는 port contract다. 구현 provider/export는 `lifecycle/chat-block-side-effect.service.ts`와 `composition/`이 소유한다.
- `CHAT_REPORT_TARGET_CONTEXT_PORT`: social-safety report intake가 chat thread/message target context를 검증할 때 사용하는 port contract다. Chat은 report domain status/reason을 알지 않고, thread/message pointer와 allowlist snapshot만 반환한다.
- `REALTIME_*_PORT`: notification/health 등 외부 domain은 chat realtime concrete class 대신 generic realtime token을 사용한다.

## Directory responsibilities

- `adapters/`: notification realtime publisher adapter 같은 external port adapter.
- `application/`: HTTP/Gateway-facing facade, command/user-context helper, public port definitions. `ChatService`는 controller-facing orchestration만 맡고 cross-domain lifecycle port 구현을 소유하지 않는다.
- `commands/`: send/leave/read-marker write use case. DB transaction, idempotency, outbox append는 command owner 책임이다.
- `context/`: route-level chat thread context decorator/guard/resolver. Guard는 route metadata와 request context 주입만 맡고, Prisma 조회는 resolver가 소유한다.
- `contracts/`: shared chat/realtime contract behavior regression spec. Shared package layout fitness는 architecture가 소유한다.
- `errors/`: chat user-facing error contract.
- `events/`: realtime payload mapper allowlist. raw retained body, vault payload, internal audit data를 payload에 넣지 않는다.
- `lifecycle/`: active match, participant withdrawal, season/cutoff lifecycle owner. 외부 domain에서 발생한 chat state side effect는 이 디렉토리의 port 구현으로 들어온다. social-safety block side-effect도 chat thread lifecycle authority를 유지하기 위해 이 경계로 들어온다.
- `lifecycle-events/`: `ConversationThreadLifecycleEvent` append-only audit/debug trace owner. current thread state, realtime payload, retention workflow state를 대체하지 않고, same transaction 안에서 state mutation의 source pointer와 sanitized transition metadata만 남긴다.
- `mappers/`: chat thread/message presenter and response projection helper.
- `outbox/`: transactional outbox persistence, claim, replay owner. payload allowlist와 replay window/prune 정책을 유지한다.
- `pairs/`: actor-target pair entry query/use-case. `GET /threads/with/:targetUserId`의 target validation, existing thread snapshot, send eligibility 조합을 소유하며 guard나 send transaction으로 분산하지 않는다.
- `persistence/`: advisory lock and Prisma select shape helpers.
- `policies/`: pure policy/helper 우선. Nest provider나 Prisma mutation을 넣지 않는다. DB가 필요한 orchestration은 command/query/lifecycle owner에 둔다.
- `queries/`: thread list/detail/subscription/read-only query owner. message body over-fetch를 피하고 pagination/cursor boundary를 유지한다.
- `realtime/`: chat namespace/ticket/auth/subscribe/gateway adapter. domain-neutral publish/metrics/config token은 `apps/api/src/realtime`에 둔다.

## Hard rules

### Lifecycle / realtime / retention source of truth

- `ConversationThread.status`, `closedReason`, `closedAt`, `threadKind`, `activeMatchId`, `lastMessageAt`가 user-facing current thread state의 source of truth다. Read path와 realtime projection은 lifecycle event table로 current state를 rebuild하지 않는다.
- `ConversationThreadLifecycleEvent`는 append-only audit/debug trace다. writer/repository는 create-only이며, event sourcing, read-model rebuild, public response, realtime payload source로 사용하지 않는다.
- `ChatRealtimeOutboxEvent`는 socket/realtime delivery source of truth다. Lifecycle event는 realtime outbox를 대체하지 않고, realtime payload에도 노출하지 않는다.
- Retention workflow state는 `ArchiveJob`, `RetainedVaultObject`, `RetentionCase`, `RetentionReviewJob` owner가 담당한다. `ConversationThreadRetentionState` table/model은 thread-level retention dashboard 필요성이 실제 운영 쿼리로 확인될 때만 별도 이슈에서 검토한다.
- Lifecycle event metadata는 allowlist scalar만 허용한다. message body, retained vault payload, report detail, block note, support body, token/credential/stack/internal audit payload를 저장하지 않는다.
- Source pointer는 owning domain row id만 저장한다. Direct start는 `sourceDomain=CHAT`, match accept/unmatch는 match-owned pointer, social-safety block은 `sourceBlockId=UserBlock.id`만 사용한다.

- 외부 domain production code에서 `../chat/application/chat.service` import 금지.
- `season-participants`와 `social-safety`에서 `conversationThread` / `conversationMessage` 직접 mutation 금지(direct chat table mutation outside chat 금지).
- `social-safety`는 `ChatService` concrete가 아니라 chat port contract로만 block/report side-effect와 report target context를 요청한다.
- `notifications`에서 `chat/realtime/*` concrete class나 `config/chat-realtime.config` 직접 import 금지.
- `ChatThreadContextGuard`는 Prisma를 직접 조회하지 않고 `ChatThreadContextResolver`에 위임한다.
- `leaveThread`의 user-facing `CHAT_THREAD_LEAVE_NOT_ALLOWED` behavior는 service/command path가 보존한다.
- 새 `forwardRef()`로 boundary 문제를 봉합하지 않는다.
- realtime/outbox payload를 일반 로그에 출력하지 않는다.
- user-facing API route/response contract는 refactor만으로 변경하지 않는다.

## Architecture guard

- Root production TypeScript file은 `chat.module.ts`, `chat.controller.ts`만 허용한다.
- Root spec file은 `chat.controller.spec.ts`만 허용한다.
- Cross-domain chat boundary는 `apps/api/src/architecture/cross-domain-chat-boundary.spec.ts`와 `apps/api/src/architecture/chat/chat-boundary.spec.ts`가 고정한다.
- Chat context guard/resolver boundary는 `context/chat-thread-context.guard.spec.ts`, `context/chat-thread-context.resolver.spec.ts`가 고정한다.
- Shared chat/realtime behavior contract는 `contracts/chat-realtime-contract.spec.ts`가 소유한다.
- ChatModule provider/export wiring은 `composition/chat.providers.ts`와 `composition/chat.exports.ts`가 소유한다. `chat.module.ts`는 imports/controllers/provider-export summary만 유지한다.

## Social-safety integration guide

- Block create: `social-safety`는 같은 transaction 안에서 chat table을 직접 update하지 않고 `CHAT_BLOCK_SIDE_EFFECT_PORT.closeDirectThreadsForBlock(...)` contract를 통해 chat lifecycle owner에 위임한다. 생성된 `UserBlock.id`는 `sourceBlockId` pointer로만 전달하며, block note/report/support 원문은 chat lifecycle metadata나 realtime payload에 넣지 않는다.
- Report target: `social-safety`는 chat thread/message table을 직접 read하지 않고 `CHAT_REPORT_TARGET_CONTEXT_PORT`를 통해 reportable thread/message pointer를 검증한다. Port 반환값에는 raw message body, retained vault payload, disclosure/audit internals를 포함하지 않는다.
- Block side-effect 대상: 같은 season/pair의 non-matched direct `OPEN` thread만 close 대상이다. active match 종료는 matches/report/admin review 경계가 소유한다.
- Unblock: immediate reopen을 하지 않는다. unblock transaction은 block relation/event만 닫고, chat thread reopen은 사용자의 명시적 `GET /threads/with/:targetUserId` 또는 `POST /messages` send/resume path에서 lazy 처리한다.
- Explicit resume/send: pair entry query는 active block 양방향 존재 시 resume CTA를 fail-closed로 계산한다. send command는 transaction 내부에서 active block absence를 다시 확인한 뒤, block-closed non-archived direct thread를 새 thread보다 우선 lazy reopen한다.
- Regression 위치: block side-effect adapter 테스트는 `lifecycle/`, source pointer handoff 테스트는 `social-safety/blocks/{commands,side-effects}/`, send/resume 테스트는 `commands/`, pair entry projection 테스트는 `pairs/`에 둔다. `application/chat.service.spec.ts` god spec에 신규 social-safety/block regression을 추가하지 않는다.

## Where to change

- HTTP route delegation: `chat.controller.ts`.
- Controller/Gateway-facing facade delegation: `application/chat.service.ts`.
- Send/leave/read-marker write behavior: `commands/`.
- Thread list/detail/subscription query behavior: `queries/`.
- Actor-target pair entry behavior: `pairs/`.
- Route-level thread context metadata/guard/resolver: `context/`.
- Match/season/participant withdrawal side effects: `lifecycle/`.
- Report target context lookup for social-safety: `reports/`.
- Realtime ticket/auth/gateway/dispatcher/metrics/rate-limit behavior: `realtime/`.
- Transactional outbox and replay behavior: `outbox/`.
- Realtime payload mapping: `events/`.
- Shared chat/realtime response/event contracts: `packages/shared/src/chat/**` and API `contracts/` specs.

## Useful verification

```bash
pnpm --dir apps/api exec vitest run --config ./vitest.config.unit.ts --maxWorkers=50% \
  src/architecture/cross-domain-chat-boundary.spec.ts \
  src/architecture/chat/chat-boundary.spec.ts \
  src/chat/context/chat-thread-context.guard.spec.ts \
  src/chat/context/chat-thread-context.resolver.spec.ts \
  src/chat/contracts/chat-realtime-contract.spec.ts \
  src/chat
pnpm api:typecheck
git diff --check
```
