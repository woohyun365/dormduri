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

Missing versus wrong-type input is classified in Zod's synchronous per-parse error callback, before input redaction. Only fixed,
source-aware `invalid_type` messages are produced there; raw input is neither retained nor enabled with `reportInput`. Schema-owned
custom errors retain their higher priority. The final formatter consumes the resolved message instead of inferring missing input
from a redacted issue. Other issue codes keep their existing localization; `details.sourceMessage` for ordinary `invalid_type`
contains the resolved localized message. Actual shared-schema and HTTP privacy tests protect this contract; golden changes must
be reviewed field-by-field rather than regenerated to hide differences.

Auth metadata extraction belongs to `auth/access/auth-request-context.decorator.ts`; chat ticket IP binding belongs to
`chat/realtime/chat-request-ip.decorator.ts`. Controllers receive context values/IP strings rather than native requests. Actor and
domain-context carriers are structural; only guards that read path values require a `params` field. `request-context-binding.spec.ts`
locks the independent HTTP/chat proxy settings, metadata and token forwarding, actor identity and ticket rate-limit behavior.

## Response and native lifecycle ownership

The exception filter resolves `HttpAdapterHost.httpAdapter` inside `catch()`. Equivalent header/status/reply operations use the
Nest adapter; health readiness and metrics response headers also use the adapter. Request route/log metadata uses narrow structural
types rather than native request types. Error paths still use `originalUrl ?? url`; Retry-After keeps its existing coercion and extras
precedence. Observability failures remain fail-open, while response write failures are not silently swallowed.

`test/architecture/platform/http-transport-boundary.spec.ts` permits the production Express import only in `http-runtime.ts`,
which owns Express trust-proxy and middleware registration (Helmet precedes optional non-cookie CORS). The following platform
owners retain Node HTTP lifecycle semantics without importing the full Express Request/Response types:

| Owner                                                  | Required boundary                                                                                     |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `observability/logging/request-context.middleware.ts`  | Node request headers, response setHeader and a no-arg next callback for request IDs/AsyncLocalStorage |
| `observability/logging/request-logging.interceptor.ts` | RequestRouteShape + method, Node response statusCode and finish-only logging                          |
| `observability/metrics/http-metrics.interceptor.ts`    | The same narrow request shape, Node response finish/close with exactly-once finalization              |

Types reuse `node:http` members and the existing `RequestRouteShape`, not a shared transport facade. Listener registration and
AsyncLocalStorage timing remain unchanged. Observable/controller completion is not response completion; Node finish is not proof
of client receipt. A close-only response does not produce a completion log, while metrics still finalizes once with its current
statusCode (a default 200 on abort does not prove client success). Express route shape and trust-proxy assumptions remain explicit;
narrowing types is not full adapter portability or a zero-native-dependency claim.

The exception filter owns the JSON representation of the common error envelope. It explicitly sets `application/json` through
the Nest adapter before replying, replacing any pre-set success or non-JSON media type without an adapter warning. Metrics sets
its registry Content-Type only after successful collection; collection failures use the common JSON error response. Unknown
failures remain 500 and explicit service-unavailable errors remain 503, with the existing Retry-After/envelope behavior.
`http-response-boundary.spec.ts` exercises the real Nest/Express response, successful scrape, collection and pre-set-header errors,
metrics access rejection, request IDs, async context and event counts. Adjacent runtime/filter/interceptor tests cover ordering,
coercion and completion paths. Response-write failures remain visible; already-sent/streaming recovery is not a new policy here.
Remove/review native exceptions only with their owner and regression proof, not to obtain a zero-import count.

HTTP ingress configuration owns trust-proxy and CORS. The direct API does not parse browser cookies or own cookie policy/settings;
browser authentication cookies belong to the Web/BFF. Do not restore an unused cookie parser/config surface without a direct-API
consumer contract. Cookie vocabulary in log redaction and forbidden metric labels remains necessary.

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
