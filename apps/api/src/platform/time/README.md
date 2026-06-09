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

## Architecture guard

- Seasons, lifecycle, auth, and retention policies may consume platform time helpers, but own their product-specific state transitions.
- Root compatibility date helper files are not introduced in product domain directories.

## Where to change time behavior

- KST helper behavior: `kst-date.ts`.
- Season schedule/window policy: seasons owning files.
- Lifecycle scheduler wiring: lifecycle owning files.
- Auth/session/verification TTL policy: auth owning files.

## Useful verification

```bash
pnpm --dir apps/api exec jest --watchman=false --runInBand src/platform/time/kst-date.spec.ts
pnpm --dir apps/api exec eslint src/platform/time
pnpm exec prettier --check apps/api/src/platform/time/README.md
pnpm api:typecheck
git diff --check
```
