# `common/` migration bucket

Status: temporary migration bucket for
`.omx/plans/api-common-final-structure-refactor-plan.md`.

Do not add new runtime files under `apps/api/src/common`.

Moved platform runtime owners:

- `http/` → `platform/http`
- `prisma/` → `platform/database`
- `security/` → `platform/security`

Do not recreate `http/`, `prisma/`, or `security/` under `apps/api/src/common`.

Known final-removal targets:

- `account-identity-invariant.owner.ts` → `identity/account-identity-invariant`
- `deidentification/` → `privacy/deidentification`
- `domain-context/` → `platform/domain-context` plus domain-owned requirement types
- `lifecycle/` → `lifecycle` or `operations/lifecycle`
- `lifestyle/` → `season-participants/lifestyle`
- `moderation/` → `moderation`

Test-only architecture/conformance surfaces live under `apps/api/src/architecture`.
Do not add architecture, contract, or reference-data specs under `apps/api/src/common`.

Architecture guard:

- `apps/api/src/architecture/common-boundary.spec.ts`

This README is a source-of-truth lock for Phase 0 of the api-common final
structure refactor. It is not a reason to keep `common/` as a final owner.
