# privacy/deidentification

Deleted or deidentified user display fallback policy.

## Public boundary

Product read models may import this helper when they need a safe display label for a user whose account identity must not be shown.

- `resolveProfileTombstoneDisplayName`: resolves the display name for deleted/deidentified profile surfaces.
- `resolveProfileDisplayName`: returns a safe display name from already-authorized profile/user projection input.

## Directory responsibilities

- `deidentified-display.policy.ts`: product-facing display labels and resolver helpers.
- `README.md`: display fallback ownership and consumer rules.

## Hard rules

- Do not duplicate deleted/deidentified labels in profile, match, chat, report, or retention read models.
- Do not read retained identity payloads from this helper.
- Do not add Prisma/Nest/HTTP dependencies here.
- Do not decide whether a profile is visible here; visibility policy belongs to the owning product domain.

## Where to change

- Display fallback string or resolver behavior: `deidentified-display.policy.ts`.
- Visibility, block, report, profile exposure, or match/chat action policy: owning product domain.
- Account deletion transaction and retained identity disposal: users account-deletion/retention and retention owner.

## Useful verification

```bash
pnpm --dir apps/api exec vitest run --config ./vitest.config.unit.ts --maxWorkers=50% src/profiles src/social-safety src/users/account-deletion
pnpm exec prettier --check apps/api/src/privacy/deidentification/README.md
pnpm api:typecheck
git diff --check
```
