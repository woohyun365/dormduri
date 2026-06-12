# platform/security

Domain-neutral security primitive boundary.

## Public boundary

Product domains may import these helpers when they need stable serialization or opaque HMAC token primitives. Product token lifecycle and persistence stay with the owning domain.

- `opaque-hmac-token.ts`: HMAC-backed opaque token creation/verification primitive.
- `stable-json.ts`: stable JSON serialization helper for signed payloads.

## Directory responsibilities

- `opaque-hmac-token.ts`: primitive signing and verification helper. It does not decide session TTL, rotation, reuse detection, or revocation policy.
- `stable-json.ts`: deterministic serialization helper used by signing primitives.

## Hard rules

- Do not store or log raw secrets, passwords, session tokens, verification codes, IP, or UA here.
- Do not add auth session lifecycle or refresh/renewal state machine logic here.
- Do not import Prisma, Nest provider wiring, or product domain services.
- Product domains must define their own token purpose, TTL, storage, rotation, and audit policy.

## Architecture guard

- Auth opaque session semantics are owned by `auth/sessions`.
- Platform security helpers remain pure and domain-neutral.
- Signed payload serialization must stay stable across equivalent object key order.

## Where to change security behavior

- Opaque HMAC token primitive: `opaque-hmac-token.ts`.
- Stable serialization helper: `stable-json.ts`.
- Auth session token lifecycle: `auth/sessions`.
- Verification code/password/session credential policy: auth owning slice.

## Useful verification

```bash
pnpm --dir apps/api exec vitest run --config ./vitest.config.unit.ts --maxWorkers=50% src/platform/security src/auth/sessions/opaque-token.spec.ts
pnpm --dir apps/api exec eslint src/platform/security
pnpm exec prettier --check apps/api/src/platform/security/README.md
pnpm api:typecheck
git diff --check
```
