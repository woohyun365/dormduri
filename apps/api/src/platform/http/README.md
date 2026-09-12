# platform/http

HTTP infrastructure boundary for API modules.

## Public boundary

Product domains may import HTTP platform helpers for normalized error bodies, exception filtering, and request validation plumbing. Product policy and domain-specific decision making stay in the owning domain.

- `api-error.ts`: normalized API error body and typed error factory helpers.
- `api-exception.filter.ts`: Nest exception filter for API responses.
- `zod-request*.ts`: Zod request parsing and error extras helpers.
- `zod-request.pipe.ts`: synchronous Nest parameter binding for existing request parsers.
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

## Request binding convention

Use `ZodRequestPipe` with Nest's `@Body`, `@Query`, or `@Param` to pass parsed data to the handler. The callback calls the existing
`parseRequestBody`, `parseQueryObject`, `parsePathParam`, or query-value helper with the route's current schema and error policy.
There is no second DTO schema, new error formatter, request-scoped provider, or module registration. Pipes are stateless shared
instances; do not store per-request data on them. Existing schemas are synchronous; async schema support is not added speculatively.

```ts
@Body(new ZodRequestPipe((body: unknown) =>
  parseRequestBody(requestSchema, body ?? {}, '기존 요청 오류 메시지'),
)) body: ParsedRequest
```

`body ?? {}` is route-specific compatibility, not a global default. Preserve schema transforms, optional `undefined`, custom
codes/messages/field names and parsed service arguments. Authentication and business invariants stay with their existing owners.

Nest resolves different parameters concurrently. When error order matters, extract one raw aggregate and parse it in one ordered
Pipe callback. Dormitories uses the entire query to validate campus before optional gender. Support ticket writes, season operation writes and block writes use
route-local, side-effect-free parameter decorators to collect their coupled path/body values, then validate the path before the body. Do not
independently pipe coupled parameters or grow a generic request facade. Guard rejection precedes binding; relative actor/token
decorator failures and other parameter validation must be checked through actual Nest requests, not inferred from argument order.

`zod-request-binding.spec.ts` runs the real pilot controllers, guard and exception filter with fake services on a loopback Nest
application. It locks status/envelope/details and parsed input, observes bound `transform` calls, and removes a binding as a negative
control. `zod-request-rollout.spec.ts` covers the remaining controllers through actual binding, preserves pre-migration error snapshots,
checks ordered path/body combinations and verifies validation before command/throttle side effects. Direct handler tests only prove
delegation after parsing. New request shapes need their own multiple-invalid matrix. Local semantic parsers remain domain-owned;
general parsing helpers remain available to Pipe callbacks, not handler bodies. The architecture guard also rejects direct handler calls
to these helpers (including named aliases and namespace imports).

`test/architecture/platform/http-transport-boundary.spec.ts` owns the exact native-import exceptions. Current auth/chat request
carriers and health response access are transitional debt, not a general product exemption. The HTTP runtime owns trust-proxy and
middleware; logging/metrics response-event owners retain completion semantics. Filter response writing must preserve the existing
non-JSON content-type compatibility until a deliberate contract change is approved. Remove/review each exception with its owner
and regression proof; do not equate a zero-import count with correctness. Existing regression owners include `http-runtime.spec.ts`,
`api-exception.filter.spec.ts`, request-context/logging specs and metrics controller/interceptor specs.

## Useful verification

```bash
pnpm --dir apps/api exec vitest run --config ./vitest.config.unit.ts --maxWorkers=50% \
  src/platform/http \
  src/identity/account-identity-invariant.spec.ts \
  src/season-participants/registration
pnpm --dir apps/api exec eslint src/platform/http
pnpm exec prettier --check apps/api/src/platform/http/README.md
pnpm api:typecheck
git diff --check
```
