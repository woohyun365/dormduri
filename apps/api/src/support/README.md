# Support API module architecture

Support 도메인의 server-side boundary map이다. 이 문서는 support ticket, appeal, FAQ, support notification handoff를 구현할 때 다음 세션이 책임 경계와 금지 경계를 빠르게 파악하기 위한 orientation note다.

## Public boundary

- `support tickets`: 계정/시즌/매칭/신고 관련 사용자 문의 thread를 소유한다.
- `appeals`: 제재·임시조치·신고 처리 결과에 대한 이의 신청 intake를 소유한다. 판단 owner는 incident-enforcement review다.
- `FAQ`: 공개 도움말 콘텐츠를 소유한다. Official policy와 충돌하면 policy 문서를 우선한다.
- `support notifications`: notification outbox/repository concrete가 아니라 generic notification writer port로 in-app notification을 요청한다.

## Directory responsibilities

- `application/ports/`: notification writer, incident review handoff 등 외부 연결 port.
- `tickets/`: support ticket command/query/policy/repository owner.
- `appeals/`: appeal intake command/query/policy owner. Enforcement decision은 여기서 직접 수행하지 않는다.
- `faq/`: FAQ read model and publication policy.
- `composition/`: future module provider/export grouping.
- `contracts/`: API/shared contract regression specs.

## Hard rules

- `support` production code는 retained vault/RRPD disclosure internals를 직접 import하지 않는다.
- Support notification payload에는 support body, reply body, email, appeal raw detail, RRPD payload를 넣지 않는다.
- Email reply는 ticket별 optional consent가 있을 때만 사용한다.
- Appeal intake는 review 요청이지 제재 decision mutation이 아니다.
- BackOffice/admin UI는 support API boundary와 분리된 후속 범위다.

## Architecture guard

- `apps/api/src/architecture/social-safety/social-safety-boundary.spec.ts`가 support의 retained vault disclosure import 금지를 함께 고정한다.
- Shared/API contract red specs는 `apps/api/src/support/support-contract.red.spec.ts`에서 고정한다.

## Where to change

- Support shared contract: `packages/shared/src/support/contract.ts`.
- Support notification kinds: `packages/shared/src/notifications/contract.ts`.
- Policy source of truth: `docs/04_policy/official/support-communication.md` and `notification-inbox.md`.

## Useful verification

```bash
pnpm --dir apps/api test -- src/support/support-contract.red.spec.ts src/architecture/social-safety/social-safety-boundary.spec.ts --runInBand
pnpm api:typecheck
git diff --check
```
