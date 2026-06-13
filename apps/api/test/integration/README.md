# API integration tests

`apps/api/test/integration` contains API integration suites that run against a disposable PostgreSQL schema through Vitest. These tests validate product-level behavior that needs the real Nest application, Prisma, SQL helpers, transactions, and outbox/worker boundaries.

## Runner and isolation

- Runner: Vitest integration config (`apps/api/vitest.config.integration.ts`).
- Discovery: `test/integration/**/*.integration.spec.ts`.
- Default execution is serial-safe: integration suites run with `--maxWorkers=1`, `pool: 'forks'`, and `fileParallelism: false`.
- Database isolation is owned by `_support/`. Each suite gets a disposable schema and tests truncate tables between cases.

## Directory layout

Integration specs are grouped by product/domain owner. Test-only helpers live under `_support/`; the `support/` directory is the product support domain.

```text
apps/api/test/integration/
  _support/
    active-match-lifecycle-event-assertions.ts
    integration-app.ts
    integration-db.ts
    integration-fixtures.ts
    integration-query-trace.ts
  platform/
    integration-fixtures.integration.spec.ts
    migration-status.integration.spec.ts
    time-boundary.integration.spec.ts
    timestamps.integration.spec.ts
  auth/
    auth.service.integration.spec.ts
    auth-users-transaction.integration.spec.ts
    auth-verification.store.integration.spec.ts
  users/
    account-deletion.integration.spec.ts
    users.integration.spec.ts
  seasons/
    season-transition.integration.spec.ts
  season-participants/
    season-registration.integration.spec.ts
  matches/
    match-history.integration.spec.ts
    matches.integration.spec.ts
    unmatch.integration.spec.ts
  chat/
    chat.integration.spec.ts
  notifications/
    notifications.integration.spec.ts
  retention/
    retention-db-access-control.integration.spec.ts
    retention.integration.spec.ts
  profiles/
    profile-match-score.integration.spec.ts
  roommate-search/
    roommate-search.integration.spec.ts
  social-safety/
    social-safety-block.integration.spec.ts
    social-safety-bookmark.integration.spec.ts
    social-safety-report.integration.spec.ts
  support/
    support.integration.spec.ts
```

## Domain ownership map

| Domain directory       | Integration specs                                                                                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth/`                | `auth/auth.service.integration.spec.ts`, `auth/auth-users-transaction.integration.spec.ts`, `auth/auth-verification.store.integration.spec.ts`                                                |
| `chat/`                | `chat/chat.integration.spec.ts`                                                                                                                                                               |
| `matches/`             | `matches/match-history.integration.spec.ts`, `matches/matches.integration.spec.ts`, `matches/unmatch.integration.spec.ts`                                                                     |
| `notifications/`       | `notifications/notifications.integration.spec.ts`                                                                                                                                             |
| `platform/`            | `platform/integration-fixtures.integration.spec.ts`, `platform/migration-status.integration.spec.ts`, `platform/time-boundary.integration.spec.ts`, `platform/timestamps.integration.spec.ts` |
| `profiles/`            | `profiles/profile-match-score.integration.spec.ts`                                                                                                                                            |
| `retention/`           | `retention/retention-db-access-control.integration.spec.ts`, `retention/retention.integration.spec.ts`                                                                                        |
| `roommate-search/`     | `roommate-search/roommate-search.integration.spec.ts`                                                                                                                                         |
| `season-participants/` | `season-participants/season-registration.integration.spec.ts`                                                                                                                                 |
| `seasons/`             | `seasons/season-transition.integration.spec.ts`                                                                                                                                               |
| `social-safety/`       | `social-safety/social-safety-block.integration.spec.ts`, `social-safety/social-safety-bookmark.integration.spec.ts`, `social-safety/social-safety-report.integration.spec.ts`                 |
| `support/`             | `support/support.integration.spec.ts`                                                                                                                                                         |
| `users/`               | `users/account-deletion.integration.spec.ts`, `users/users.integration.spec.ts`                                                                                                               |

## Helper boundary

- `_support/` is test helper only. It must not represent a product domain.
- `support/` is the product support domain integration directory.
- Domain specs import helpers from `../_support/*`.
- Avoid deep relative helper imports. If a future suite becomes deeper than one domain directory, add a small helper barrel under `_support/` instead of adding brittle path chains.

## Coverage taxonomy

Use these labels when describing integration coverage or updating coverage inventory guards.

| Label                   | Meaning                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| `policy-matrix`         | Official policy state matrix allows/rejects actions deterministically.                     |
| `transaction-atomicity` | A partial failure inside a transaction rolls back all related writes.                      |
| `concurrency-race`      | Concurrent requests converge to one deterministic final state.                             |
| `idempotency`           | Retry/replay does not create duplicate rows or duplicate effects.                          |
| `side-effect-rollback`  | Rejected or rolled-back work leaves no ghost event/outbox/notification/audit row.          |
| `stale-state-recheck`   | State read before a transaction is rechecked inside the transaction before mutation.       |
| `db-time-boundary`      | Business time uses DB/KST/CURRENT_TIMESTAMP boundaries intentionally.                      |
| `worker-claim`          | SKIP LOCKED, lease, or bounded claim paths do not double-claim work.                       |
| `security-boundary`     | Route/capability/error/probing boundaries stay closed and non-leaky.                       |
| `query-cost-guard`      | Test data catches N+1, scan, or write amplification regressions within bounded local data. |

## Commands

Run a single integration file:

```bash
pnpm --dir apps/api exec vitest run --config ./vitest.config.integration.ts --maxWorkers=1 test/integration/<domain>/<file>.integration.spec.ts
```

Examples:

```bash
pnpm --dir apps/api exec vitest run --config ./vitest.config.integration.ts --maxWorkers=1 test/integration/platform/migration-status.integration.spec.ts
pnpm --dir apps/api exec vitest run --config ./vitest.config.integration.ts --maxWorkers=1 test/integration/auth/auth.service.integration.spec.ts
pnpm --dir apps/api exec vitest run --config ./vitest.config.integration.ts --maxWorkers=1 test/integration/support/support.integration.spec.ts
```

Run all integration tests:

```bash
pnpm --dir apps/api test:integration
```

Run the integration structure guard:

```bash
pnpm --dir apps/api exec vitest run --config ./vitest.config.unit.ts --maxWorkers=50% src/architecture/testing/api-integration-structure.spec.ts
```

## Update rules

- When adding or moving an integration spec, update this README and `apps/api/src/architecture/testing/api-integration-structure.spec.ts` together.
- Keep DB-mutating integration/e2e suites serial-safe unless a test explicitly proves parallel safety.
- Keep helper code under `_support/`; product behavior specs belong under their domain directory.
- Do not add runner-specific migration guidance here. The API test runner source of truth is `apps/api/test/README.md` and the runner guard under `apps/api/src/architecture/api-test-runner-boundary.spec.ts`.
