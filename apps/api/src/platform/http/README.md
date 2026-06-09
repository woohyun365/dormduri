# platform/http

HTTP infrastructure boundary for API modules.

## Public boundary

Product domains may import HTTP platform helpers for normalized error bodies, exception filtering, and request validation plumbing. Product policy and domain-specific decision making stay in the owning domain.

- `api-error.ts`: normalized API error body and typed error factory helpers.
- `api-exception.filter.ts`: Nest exception filter for API responses.
- `zod-request*.ts`: Zod request parsing and error extras helpers.
- `account-identity-invariant.error.ts`: maps pure account identity invariant vocabulary to an HTTP/Nest exception body.

## Directory responsibilities

- `api-error.ts`: common response envelope for error bodies and shared helper factories.
- `api-exception.filter.ts`: exception normalization at HTTP boundary.
- `zod-request.ts` and adjacent files: request validation issue formatting.
- `account-identity-invariant.error.ts`: HTTP adapter for `identity/account-identity-invariant.ts`; it does not own identity policy.

## Hard rules

- Do not place business policy in platform/http.
- Domain-specific error code ownership remains with the owning domain or pure shared vocabulary.
- HTTP adapters may map pure domain/shared-kernel vocabulary to Nest exceptions, but must not query DB or call domain services.
- Sensitive values such as raw token, password, verification code, email payload, IP, or UA must not be added to error extras.

## Architecture guard

- `identity/` remains pure shared-kernel; HTTP exception mapping for account identity invariant stays here.
- Platform HTTP helpers do not import product domain services.
- Controller request validation uses common Zod helper behavior consistently.

## Where to change HTTP behavior

- Common API error body shape: `api-error.ts`.
- Exception filter mapping: `api-exception.filter.ts`.
- Zod request issue/extras/type behavior: `zod-request*.ts`.
- Account identity invariant HTTP mapping: `account-identity-invariant.error.ts`.
- Product-specific route error code or policy: owning product domain.

## Useful verification

```bash
pnpm --dir apps/api exec jest --watchman=false --runInBand \
  src/platform/http \
  src/identity/account-identity-invariant.spec.ts \
  src/season-participants/registration
pnpm --dir apps/api exec eslint src/platform/http
pnpm exec prettier --check apps/api/src/platform/http/README.md
pnpm api:typecheck
git diff --check
```
