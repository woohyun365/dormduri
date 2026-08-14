# Realtime API integration architecture

이 문서는 `apps/api/src/realtime`의 공통 realtime integration boundary를 빠르게 찾기 위한 server-side boundary map이다. Realtime은 제품 domain 정책이 아니라 transport token, connection handoff, outbox/dispatcher integration에 필요한 neutral surface를 소유한다.

## Public boundary

제품 domain은 realtime primitive를 직접 사용할 수 있지만, message policy와 notification policy를 realtime으로 이전하지 않는다.

- `realtime.tokens.ts`: realtime dispatcher/gateway integration에 쓰는 DI token owner.

## Directory responsibilities

- `realtime.tokens.ts`: neutral realtime provider token. Product-specific payload contract를 소유하지 않는다.
- `README.md`: realtime integration 책임과 금지 경계 설명.

## Hard rules

- Chat message send/read policy는 chat domain이 소유한다.
- Notification fanout, inbox, campaign, operator alert policy는 notifications domain이 소유한다.
- Auth session/ticket validation semantics는 auth domain이 소유한다.
- Realtime primitive는 product DB write transaction을 직접 수행하지 않는다.
- Raw token/session/user-sensitive payload를 log/metric payload에 남기지 않는다.

## Architecture guard

- Product domain은 purpose-specific port/token으로 realtime dispatcher를 소비한다.
- Realtime common surface는 chat/matches/notifications/auth concrete service를 import하지 않는다.
- 운영 telemetry는 owner-local Prometheus metric으로 기록하며 health snapshot reader port를 만들지 않는다.

## Where to change realtime behavior

- Common realtime provider token: `realtime.tokens.ts`.
- Chat realtime ticket and message flow: chat realtime owner.
- Notification realtime delivery and outbox: notifications realtime/outbox owner.
- Auth session transport and ticket validation: auth sessions/access owner.

## Useful verification

```bash
pnpm --dir apps/api exec vitest run --config ./vitest.config.unit.ts --maxWorkers=50% src/architecture/common-boundary.spec.ts src/architecture/module-boundary.spec.ts
pnpm --dir apps/api exec eslint src/realtime
pnpm exec prettier --check apps/api/src/realtime/README.md
pnpm api:typecheck
git diff --check
```
