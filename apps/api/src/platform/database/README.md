# platform/database

Database infrastructure boundary for API modules.

## Public boundary

Product domains may import database platform services when they need runtime Prisma access or a configured worker/disclosure client. Platform database code must remain product-neutral.

- `PrismaModule`: global Prisma provider/export surface.
- `PrismaService`: runtime database client, database clock, retryable transaction helper, pool budget helper.
- `RetentionWorkerPrismaService`: worker credential boundary for retention/auth cleanup execution.
- `RetentionDisclosurePrismaService`: restricted disclosure credential boundary.
- `prisma-error.ts`: Prisma error helper.

## Directory responsibilities

- `prisma.module.ts`: Prisma provider wiring and exports.
- `prisma.service.ts`: runtime/worker/disclosure Prisma services and database utilities.
- `prisma-error.ts`: Prisma error classification helper.
- `*-role-grants.spec.ts`: DB role grant contract guard.
- `migration-baseline.spec.ts`: migration baseline guard.
- `updated-at-ownership.spec.ts`: `updatedAt` ownership guard.

## Hard rules

- Do not place domain SQL/read-model ownership here. Domain query/repository files live in the owning product module.
- Do not import product domain services from platform database code.
- New DB credential boundaries must account for RDS connection pool budget.
- Migration and role grant guards describe infrastructure invariants, not user-facing policy.

## Architecture guard

- `PrismaModule` is the only allowed global platform module.
- Product modules use explicit imports for business dependencies; Prisma global status must not become a generic business dependency escape hatch.
- DB role, migration, and updated-at ownership specs guard infrastructure drift.

## Where to change database behavior

- Runtime Prisma client and transaction helper: `prisma.service.ts`.
- Worker/disclosure Prisma clients: `prisma.service.ts`.
- Prisma provider exports: `prisma.module.ts`.
- DB role grant expectations: `auth-role-grants.spec.ts`, `rrpd-role-grants.spec.ts`.
- Migration baseline or updated-at ownership guards: corresponding spec files.

## Useful verification

```bash
pnpm --dir apps/api exec vitest run --config ./vitest.config.unit.ts --maxWorkers=50% \
  src/platform/database/prisma.service.spec.ts \
  src/platform/database/auth-role-grants.spec.ts \
  src/platform/database/rrpd-role-grants.spec.ts \
  src/platform/database/migration-baseline.spec.ts \
  src/platform/database/updated-at-ownership.spec.ts
pnpm --dir apps/api exec eslint src/platform/database
pnpm exec prettier --check apps/api/src/platform/database/README.md
pnpm api:typecheck
git diff --check
```
