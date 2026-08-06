# platform/database

Database infrastructure boundary for API modules.

## Public boundary

Product domains may import database platform services when they need runtime Prisma access or a configured worker/disclosure client. Platform database code must remain product-neutral.

- `PrismaModule`: global Prisma provider/export surface.
- `PrismaService`: runtime database client, database clock, retryable transaction helper, pool budget helper.
- `RetentionWorkerPrismaService`: worker credential boundary for retention/auth cleanup execution.
- `RetentionDisclosurePrismaService`: restricted disclosure credential boundary.
- `prisma-error.ts`: Prisma error helper.

모든 Prisma PostgreSQL connection session timezone은 `UTC`로 고정한다. 제품의 KST
날짜 표현은 `platform/time`에서 명시적으로 변환하며, `timestamptz` transport를 DB
session timezone에 맡기지 않는다. `getDatabaseNow()`도 adapter의 timestamp 문자열
해석에 의존하지 않도록 epoch seconds를 UTC `Date`로 변환한다.

## Directory responsibilities

- `prisma.module.ts`: Prisma provider wiring and exports.
- `prisma.service.ts`: runtime/worker/disclosure Prisma services and database utilities.
- `prisma-error.ts`: Prisma error classification helper.
- `test/operations/database/*-role-grants.spec.ts`: DB role grant artifact guard.
- `test/operations/database/migration-baseline.spec.ts`: migration baseline guard.
- `test/operations/database/updated-at-ownership.spec.ts`: `updatedAt` ownership guard.

## SQL / TypedSQL boundary

Product-owned SQL lives under `apps/api/prisma/sql/*.sql` and is consumed through generated TypedSQL exports from `src/generated/prisma/sql.js`. This keeps SQL review, generated result typing, and ownership in one place.

- Add or move a SQL asset only with `prisma:generate` and `test/architecture/testing/api-sql-boundary.spec.ts` inventory updates.
- Use `pg_advisory_xact_lock` for transaction-scoped advisory locks; session-scoped advisory locks are not allowed.
- Worker claim SQL that uses `FOR UPDATE SKIP LOCKED` must stay bounded with `LIMIT`, deterministic `ORDER BY`, and explicit lease/update semantics.
- SQL time functions such as `CURRENT_TIMESTAMP` and `NOW()` must be registered with owner/rationale in the SQL boundary guard.
- Product code should call generated TypedSQL helpers via `$queryRawTyped(...)`; do not spread direct `$queryRaw` / `$executeRaw` string queries through product domains.

## Hard rules

- Do not place domain SQL/read-model ownership here. Domain query/repository files live in the owning product module.
- Do not import product domain services from platform database code.
- New DB credential boundaries must account for RDS connection pool budget.
- Migration and role grant guards describe infrastructure invariants, not user-facing policy.
- Production migration/role grant execution scripts live in `infra/db`; operation specs guard their invariants outside the runtime source tree.

## Architecture guard

- `PrismaModule` is the only allowed global platform module.
- Product modules use explicit imports for business dependencies; Prisma global status must not become a generic business dependency escape hatch.
- DB role, migration, and updated-at ownership specs guard infrastructure drift.

## Where to change database behavior

- Runtime Prisma client and transaction helper: `prisma.service.ts`.
- Worker/disclosure Prisma clients: `prisma.service.ts`.
- Prisma provider exports: `prisma.module.ts`.
- DB role grant expectations: `test/operations/database/auth-role-grants.spec.ts`, `test/operations/database/rrpd-role-grants.spec.ts`.
- Migration baseline or updated-at ownership guards: `test/operations/database/`의 corresponding spec files.

## Useful verification

```bash
pnpm --dir apps/api exec vitest run --config ./vitest.config.unit.ts --maxWorkers=50% \
  src/platform/database/prisma.service.spec.ts \
  test/operations/database/auth-role-grants.spec.ts \
  test/operations/database/rrpd-role-grants.spec.ts \
  test/operations/database/migration-baseline.spec.ts \
  test/operations/database/updated-at-ownership.spec.ts
pnpm --dir apps/api exec eslint src/platform/database
pnpm exec prettier --check apps/api/src/platform/database/README.md
pnpm api:typecheck
git diff --check
```
