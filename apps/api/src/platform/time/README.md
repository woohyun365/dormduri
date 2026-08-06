# platform/time

Domain-neutral time/date helper boundary.

## Public boundary

Product domains may import these helpers when they need shared KST local-date behavior. Product lifecycle policy and scheduling semantics stay with the owning domain.

- `kst-date.ts`: KST local date parsing/formatting/comparison helper.

## Directory responsibilities

- `kst-date.ts`: reusable KST date helper.
- `kst-date.spec.ts`: helper behavior regression.

## Hard rules

- Do not place season lifecycle policy, registration window policy, scheduler wiring, or product state transition logic here.
- Do not import Prisma, Nest scheduler, or product domain services.
- Keep helper inputs/outputs explicit and deterministic.

## Product time source-of-truth

`platform/time` owns deterministic KST local-date conversion helpers only. Product/audit persistence must resolve authoritative "now" from the database boundary, not from an ad-hoc application clock.

- Use `PrismaService.getDatabaseNow()` when application code needs the current persisted timestamp.
- Use `apps/api/prisma/sql/getCurrentTimestamp.sql` when TypedSQL/raw SQL owns the timestamp comparison.
- Use `formatKstDate`, `compareKstDate`, and KST parse helpers for date-only conversion after the owning domain has supplied the reference `Date`.
- Do not add a new production `new Date()` or `Date.now()` usage without updating `test/architecture/testing/api-time-source-boundary.spec.ts` with owner, category, and rationale.

Allowed time-source inventory categories:

| Category             | Allowed use                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| `business-db-now`    | Canonical DB timestamp wrappers such as `PrismaService.getDatabaseNow()` and DB-now row parsing.      |
| `cache-ttl`          | Process-local cache or rate-limit expiry that is not persisted product state.                         |
| `date-arithmetic`    | TTL, lease, hold, KST, or cutoff calculations derived from an explicit DB/domain/reference time.      |
| `dispatcher-default` | Worker/dispatcher fallback `now` values where callers can inject the authoritative clock.             |
| `duration-metric`    | Elapsed-time or latency measurement.                                                                  |
| `parser`             | Cursor, request, SQL row, retained payload, or date-string parsing.                                   |
| `response-timestamp` | Error, health, metrics, or alert response/telemetry timestamps that are not business source-of-truth. |

## Architecture guard

- Seasons, lifecycle, auth, and retention policies may consume platform time helpers, but own their product-specific state transitions.
- Product domain root에는 date helper forwarding file을 두지 않는다.

## Where to change time behavior

- KST helper behavior: `kst-date.ts`.
- Season schedule/window policy: seasons owning files.
- Lifecycle scheduler wiring: lifecycle owning files.
- Auth/session/verification TTL policy: auth owning files.

## Useful verification

```bash
pnpm --dir apps/api exec vitest run --config ./vitest.config.unit.ts --maxWorkers=50% src/platform/time/kst-date.spec.ts
pnpm --dir apps/api exec eslint src/platform/time
pnpm exec prettier --check apps/api/src/platform/time/README.md
pnpm api:typecheck
git diff --check
```
