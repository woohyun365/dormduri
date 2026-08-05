# Notices API module architecture

이 문서는 `apps/api/src/notices`의 server-side boundary map이다. `notices`는 개인 알림함(`notifications`)이 아니라 운영자가 게시한 **global 1:N notice read path**를 소유한다. 사용자별 delivery/read state를 만들지 않고, 공개 window를 만족하는 공지만 list/detail로 노출한다.

## Public boundary

외부 domain production code는 notices 내부 query/repository/mapper를 직접 import하지 않는다. 필요한 surface는 아래로 제한한다.

- `NoticesModule`: global notice HTTP route와 provider wiring을 제공한다.
- `NoticesController`: `/api/notices`, `/api/notices/:noticeId` HTTP route parsing/delegation을 소유한다.
- `NoticesService`: controller-facing facade다. broad operation center facade가 아니며, global notice read use case delegation만 맡는다.
- `@repo/shared/notices`: Web BFF/API response contract의 source of truth다.

## Directory responsibilities

새 코드는 아래 responsibility owner를 따른다.

- `application/`: controller-facing facade. `NoticesService`는 route response behavior를 유지하는 얇은 delegation surface로 제한한다.
- `composition/`: `NoticesModule` provider/export grouping source of truth. provider 추가는 module decorator에 직접 흩뿌리지 않는다.
- `contracts/`: shared notice contract behavior regression specs.
- `errors/`: notices user-facing error contract.
- `mappers/`: DB row → shared contract presenter/mapper. Preview response에는 `body`를 넣지 않는다.
- `queries/`: published window, cursor, list/detail read use case owner.
- `repositories/`: Prisma-backed global notice read repository. Query owner가 요구하는 최소 row shape만 반환한다.

## Hard rules

- 공지사항은 개인 알림함의 `SEASON_SYSTEM_NOTICE` filter가 아니다. `notifications` delivery/read-state와 notices 1:N broadcast read path를 섞지 않는다.
- List preview에는 notice `body`를 포함하지 않는다. 상세 body는 `GET /api/notices/:noticeId`에서만 반환한다.
- `publishedAt is not null`, `publishedAt <= now`, `expiresAt is null or now < expiresAt` 조건을 만족하지 않으면 list에서 제외하고 detail은 404로 fail-closed한다.
- Home/Web은 fake notice rows를 만들지 않는다. 공지가 없으면 empty state로 수렴한다.
- notice payload에 support body, report evidence, stack/upstream raw error, internal audit payload를 넣지 않는다.
- 새 behavior는 root file을 늘리지 않고 owner directory에 둔다. Root production TypeScript surface는 `notices.controller.ts`, `notices.module.ts`만 유지한다.
- Admin/backoffice notice authoring UI/API는 이 boundary의 read path와 별도 이슈에서 다룬다.

## Architecture guard

- Root production TypeScript file은 `notices.controller.ts`, `notices.module.ts`만 허용한다.
- Module provider/export list는 `composition/notices.providers.ts`와 `composition/notices.exports.ts`로 읽을 수 있어야 한다.
- Shared notice contract는 `packages/shared/src/notices/**`와 `@repo/shared/notices` canonical nested package layout을 사용한다.
- Public notice read path는 public route일 수 있지만, user-specific notification/support state와 결합하지 않는다.

## Where to change notices behavior

- HTTP route parsing and delegation: `notices.controller.ts`.
- Controller-facing delegation: `application/notices.service.ts`.
- List/detail read behavior: `queries/global-notice.query.ts`.
- List cursor encode/decode: `queries/global-notice-list.cursor.ts`.
- Prisma row lookup and published-window SQL: `repositories/global-notice.repository.ts`.
- DB row → response projection: `mappers/global-notice.presenter.ts`.
- User-facing error codes/messages: `errors/notices.errors.ts`.
- Provider/export wiring: `composition/notices.providers.ts`, `composition/notices.exports.ts`.
- Shared API/BFF contract: `packages/shared/src/notices/contract.ts`.

## Policy references

- `docs/policies/notification-inbox.md`: 개인 알림 payload는 pointer-only를 유지하고 공지/지원 raw body를 섞지 않는다.
- `docs/policies/support-communication.md`: FAQ/support ticket self-only detail과 in-app notification primary 정책을 유지한다.
- `docs/policies/service-boundary.md`: user-facing product path에서 운영 내부 payload를 노출하지 않는다.

## Useful verification

```bash
pnpm --dir apps/api exec vitest run --config ./vitest.config.unit.ts --maxWorkers=50% \
  src/architecture/domains/notices-boundary.spec.ts \
  src/notices/contracts/global-notice-contract.spec.ts \
  src/notices/queries/global-notice-list.cursor.spec.ts \
  src/notices/queries/global-notice.query.spec.ts \
  src/architecture/security/auth-access-route-matrix.spec.ts
pnpm --dir apps/api exec eslint src/notices src/app.module.ts src/architecture/security/auth-access-route-matrix.spec.ts
pnpm api:typecheck
git diff --check
```
