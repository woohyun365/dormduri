# Chat API module architecture

Issue #198 실시간 채팅 구현의 서버-side boundary map이다. 이 문서는 코드 구현 세부가 아니라 다음 세션이 `apps/api/src/chat` 책임을 빠르게 파악하기 위한 orientation note다.

## Public boundary

외부 domain은 concrete `ChatService`를 import/inject하지 않는다. 필요한 기능은 목적별 port token을 통해 사용한다.

- `CHAT_MATCH_THREAD_LIFECYCLE_PORT`: match accept/unmatch transaction 안에서 matched/direct thread lifecycle을 갱신한다.
- `CHAT_THREAD_WITHDRAWAL_PORT`: season participant withdrawal transaction 안에서 open direct thread를 read-only로 전환하고 realtime outbox를 append한다.
- `CHAT_LIFECYCLE_SWEEP_PORT`: common lifecycle sweep에서 chat thread cutoff/season lifecycle을 수렴한다.
- `REALTIME_*_PORT`: notification/health 등 외부 domain은 chat realtime concrete class 대신 generic realtime token을 사용한다.

## Directory responsibilities

- `context/`: route-level chat thread context decorator/guard/resolver. Guard는 route metadata와 request context 주입만 맡고, Prisma 조회는 resolver가 소유한다.
- `application/`: HTTP/Gateway-facing facade와 public port definitions. `ChatService`는 controller-facing orchestration만 맡고 cross-domain lifecycle port 구현을 소유하지 않는다.
- `commands/`: send/leave/read-marker write use case. DB transaction, idempotency, outbox append는 command owner 책임이다.
- `queries/`: thread list/detail/subscription/read-only query owner. message body over-fetch를 피하고 pagination/cursor boundary를 유지한다.
- `pairs/`: actor-target pair entry query/use-case. `GET /threads/with/:targetUserId`의 target validation, existing thread snapshot, send eligibility 조합을 소유하며 guard나 send transaction으로 분산하지 않는다.
- `lifecycle/`: active match, participant withdrawal, season/cutoff lifecycle owner. 외부 domain에서 발생한 chat state side effect는 이 디렉토리의 port 구현으로 들어온다.
- `policies/`: pure policy/helper 우선. Nest provider나 Prisma mutation을 넣지 않는다. DB가 필요한 orchestration은 command/query/lifecycle owner에 둔다.
- `outbox/`: transactional outbox persistence, claim, replay owner. payload allowlist와 replay window/prune 정책을 유지한다.
- `realtime/`: chat namespace/ticket/auth/subscribe/gateway adapter. domain-neutral publish/metrics/config token은 `apps/api/src/realtime`에 둔다.
- `events/`: realtime payload mapper allowlist. raw retained body, vault payload, internal audit data를 payload에 넣지 않는다.

## Hard rules

- 외부 domain production code에서 `../chat/application/chat.service` import 금지.
- `season-participants`에서 `conversationThread` / `conversationMessage` 직접 mutation 금지(direct chat table mutation outside chat 금지).
- `notifications`에서 `chat/realtime/*` concrete class나 `config/chat-realtime.config` 직접 import 금지.
- 새 `forwardRef()`로 boundary 문제를 봉합하지 않는다.
- realtime/outbox payload를 일반 로그에 출력하지 않는다.
- user-facing API route/response contract는 refactor만으로 변경하지 않는다.

## Useful verification

```bash
pnpm --dir apps/api test -- src/common/architecture/cross-domain-chat-boundary.spec.ts src/chat --runInBand
pnpm --dir apps/api test:integration -- chat.integration.spec.ts unmatch.integration.spec.ts notifications.integration.spec.ts --runInBand
pnpm check:api
git diff --check
```
