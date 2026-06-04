# Platform API module architecture

이 문서는 `apps/api/src/platform` 내부 책임 경계, public surface, directory ownership, 수정 위치를 빠르게 찾기 위한 server-side platform boundary map이다. Platform은 제품 domain이 아니라 API 제품을 지탱하는 neutral infrastructure/shared primitive 계층이다.

## Public boundary

제품 domain production code는 platform primitive를 직접 import할 수 있지만, platform production code는 제품 domain을 import하지 않는다.

- `database/PrismaModule`: runtime/retention Prisma client wiring을 제공한다. 현재 유일하게 허용된 `@Global()` module 예외다.
- `database/PrismaService`: runtime DB access, database clock, retryable transaction helper, connection pool budget 계산을 제공한다.
- `database/RetentionWorkerPrismaService`, `database/RetentionDisclosurePrismaService`: retention worker/disclosure 전용 DB credential boundary다.
- `http/`: controller/filter/error/request parsing 공통 primitive다. 제품별 error code/schema는 owning domain이 소유한다.
- `security/`: opaque HMAC token, stable JSON serialization 같은 reusable crypto/serialization primitive다. 제품별 token lifecycle/state machine은 owning domain이 소유한다.
- `domain-context/`: route metadata key/setter/narrowing helper만 제공한다. 실제 requirement vocabulary와 guard behavior는 chat/matches/season-participants 같은 owning domain이 소유한다.

## Directory responsibilities

- `database/`: Prisma module/service, Prisma error helper, DB role grant guard, migration baseline guard, updated-at ownership guard, connection pool budget logic. Domain SQL/query business owner는 이 디렉토리에 두지 않는다.
- `http/`: API exception filter, normalized API error factory, Zod request issue/extras/types/helper. Controller-facing request/response contract는 owning domain 또는 shared contract package가 소유한다.
- `security/`: domain-neutral security primitive. Raw secret/logging 정책이나 auth session semantics를 소유하지 않는다.
- `domain-context/`: generic metadata primitive. `current-season-participant`, `chat-thread-member`, `active-match-participant` 같은 product vocabulary를 소유하지 않는다.

## Hard rules

- Platform production code는 `auth`, `chat`, `matches`, `season-participants`, `users`, `profiles`, `notifications`, `moderation`, `lifecycle`, `retention` 등 제품 domain을 import하지 않는다.
- Business capability module은 platform에 두지 않는다. 예: moderation은 `moderation/`, lifecycle sweep orchestration은 `lifecycle/`가 canonical owner다.
- `PrismaModule`만 `@Global()` 예외로 허용한다. 새 global business module로 DI 경계를 숨기지 않는다.
- 새 `forwardRef()`로 module graph 문제를 봉합하지 않는다.
- Platform helper는 product behavior, user-facing response/error code, route policy를 바꾸지 않는다.
- Domain-specific TypedSQL/raw query는 해당 domain repository/query owner에 둔다. DB infra guard나 role/migration baseline만 `platform/database`에 둔다.
- Crypto primitive는 raw token/password/code/IP/UA를 로그에 남기지 않는 상위 domain 정책을 전제로 제공한다. 민감값 저장/마스킹 정책은 owning domain에서 고정한다.

## Architecture guard

Platform boundary는 `apps/api/src/architecture/common-boundary.spec.ts`와 `apps/api/src/architecture/module-boundary.spec.ts`가 고정한다.

- `platform`은 product-domain import를 하지 않는다.
- `common/http`, `common/prisma`, `common/security`는 재생성하지 않는다.
- `common/domain-context`는 재생성하지 않고 `platform/domain-context`가 generic primitive만 소유한다.
- `@Global()`은 `platform/database/prisma.module.ts`만 허용한다.
- Affected module graph는 `CommonModule` fallback 없이 explicit owner imports를 사용한다.

## Where to change platform behavior

- Prisma client/connection role/pool budget/database clock/retryable transaction: `database/prisma.service.ts`.
- Prisma module global export surface: `database/prisma.module.ts`.
- DB role grant and migration/updated-at architecture guards: `database/*.spec.ts`.
- API error shape and exception filter mapping: `http/api-error.ts`, `http/api-exception.filter.ts`.
- Zod request validation issue formatting: `http/zod-request*.ts`.
- Opaque HMAC token primitive or stable JSON serialization: `security/opaque-hmac-token.ts`, `security/stable-json.ts`.
- Generic route context metadata primitive: `domain-context/domain-context.decorator.ts`.
- Domain requirement type/guard behavior: owning domain under `chat/context`, `matches/context`, `season-participants/context`; not platform.

## Useful verification

```bash
pnpm --dir apps/api exec jest --watchman=false --runInBand \
  src/architecture/common-boundary.spec.ts \
  src/architecture/module-boundary.spec.ts \
  src/platform/http \
  src/platform/database/prisma.service.spec.ts \
  src/platform/database/auth-role-grants.spec.ts \
  src/platform/database/rrpd-role-grants.spec.ts \
  src/platform/database/migration-baseline.spec.ts \
  src/platform/database/updated-at-ownership.spec.ts \
  src/platform/domain-context
pnpm api:typecheck
pnpm --dir apps/api exec eslint <changed files without apps/api prefix>
git diff --check
```
