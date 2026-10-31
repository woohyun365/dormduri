# platform/observability

`platform/observability`는 API runtime의 운영 관측 공통 경계를 소유한다.

## 책임

- requestId/correlationId를 생성하거나 안전한 inbound 값을 수용한다.
- `X-Request-Id` response header를 반환한다.
- Nest logger를 Pino 기반 single-line JSON stdout logger로 교체한다.
- request 완료 로그와 exception 로그를 structured event로 남긴다.
- `/internal/metrics` Prometheus scrape endpoint를 제공한다.
- HTTP request total/duration/in-flight와 normalized exception counter를 bounded label로 기록한다.
- domain operation metric은 platform-owned bridge를 통해 Prometheus registry에 기록한다.
- 로그/metrics 기록 실패가 product request 실패로 전파되지 않게 한다.

## 로그 privacy

로그 event는 route template, method, status class, duration, bounded operation/outcome,
error code/name, hashed actor/session 같은 운영 필드만 담는다.

다음 값은 로그에 남기지 않는다.

- raw email/password/verification code
- JWT/access/refresh token, cookie, Authorization header
- raw request/response body
- chat/support/report body, retained vault/encrypted payload
- raw userId/threadId/messageId/sessionId/IP label

## Metrics endpoint

- endpoint: `GET /internal/metrics`
- `METRICS_ENABLED=false`이면 endpoint는 disabled 상태로 닫힌다.
- production에서는 `METRICS_BEARER_TOKEN`이 필요하며, 요청은 `Authorization: Bearer <token>` 형식이어야 한다.
- local/test에서 token이 없으면 scrape를 열어 두지만, production 배포에서는 nginx/private network/allowlist와 token guard를 함께 사용한다.
- response는 Prometheus text format이고 `@prometheus-io/client` registry가 process/default metrics와 API platform metrics를
  소유한다.
- controller는 registry 수집이 성공한 뒤 Nest HTTP adapter로 성공 응답의 Content-Type을 지정한다.
- 수집 실패는 공통 exception filter가 `application/json`으로 응답한다. 성공 응답용 text Content-Type이나 별도 native
  writer를 재사용하지 않는다. 기존 오류 body/status, no-store 및 Retry-After 동작은 유지한다. 알 수 없는 실패는 500,
  명시적인 service-unavailable 오류는 503이며 일괄 변환하지 않는다.

## HTTP lifecycle 경계

- request-context middleware는 안전한 inbound request/correlation ID만 수용하고, 없거나 잘못된 request ID는 UUID로
  대체한다. correlation ID fallback, `X-Request-Id` 응답과 downstream AsyncLocalStorage 전파를 함께 소유한다.
- request logging interceptor는 native response의 `finish`에만 완료 로그를 기록한다. `close`만 발생한 요청까지
  완료 로그로 처리하는 정책은 없다.
- HTTP metrics interceptor는 native response의 `finish`와 `close`를 관찰하되 request metric과 in-flight 감소를
  한 번만 처리한다. 관측 실패는 request stream으로 전파하지 않는다.
- route-template 추출과 exception log mapping은 필요한 필드만 가진 structural carrier를 받는다. metrics guard의
  Authorization 읽기에도 native request 전체를 전달하지 않는다.

Middleware는 Node HTTP headers/setHeader와 no-arg next callback만, 두 interceptor는 method와 Node response의
once/statusCode만 타입으로 요구한다. Adapter request 타입 전체를 전달하거나 별도 공통 transport facade를 만들지
않는다. Node finish/close listener와 AsyncLocalStorage 실행 시점은 그대로 유지한다. Observable 완료나 finish를 client
수신 완료로 해석하지 않으며, close-only의 기본 statusCode 200도 client 성공을 증명하지 않는다.

### Route template

HTTP adapter(`@nestjs/platform-node`의 NodeAdapter)는 request에 일치한 route를 남기지 않는다. 그래서 route template은
Nest가 route 등록에 쓰는 controller·handler path metadata를 이어 만든다(`logging/request-route.ts`). API는 global
prefix와 versioning을 쓰지 않으므로 두 path가 template 전체다.

- 두 interceptor는 handler 실행 context에서 template을 직접 계산한다.
- Guard·throttle 거절처럼 interceptor 전에 끝나는 요청은 이 module의 global guard(`RequestRouteTemplateGuard`)가
  request에 기록한 template을 exception filter가 읽는다. AppModule이 이 module을 AuthModule보다 먼저 import해 이
  guard가 인증·throttle guard보다 먼저 돈다. `test/integration/platform/request-route-template.integration.spec.ts`가
  실제 AppModule에서 401·429 거절 log의 template을 고정한다.
- 어떤 route와도 맞지 않는 요청(대소문자가 다른 path 포함)은 `UNKNOWN_ROUTE`다.

Adapter import 예외는 `test/architecture/platform/http-transport-boundary.spec.ts`가 `platform/http/http-adapter.ts`
하나로 한정한다. Middleware/interceptor spec과 `platform/http/http-response-boundary.spec.ts`가 이벤트 횟수·close-only/실패
정리·response header·요청별 async context를 검증한다.

## Metrics label policy

허용 label은 bounded cardinality 값으로 제한한다.

- HTTP request metrics: `method`, `route`, `status_class`
- Exception metrics: `code`, `status_class`, `domain`
- In-flight gauge: `route`
- Domain metrics: `domain`, `operation`, `outcome`, `dispatcher`, `scope`, `reason`, `campus`, `cache`, `target`, `state`, `action`, `sort`, `phase`

다음 값은 label로 쓰지 않는다.

- raw path/query/body/payload/params
- userId/email/threadId/messageId/sessionId/requestId/correlationId/IP
- token/cookie/authorization/password 같은 credential성 값

`route`는 Nest path metadata로 만든 route template 또는 `UNKNOWN_ROUTE`만 사용한다.

## Domain metrics bridge

도메인 코드는 `@prometheus-io/client`를 직접 import하지 않는다. Metric name/help/label/bucket은 owning domain의
`*.metric.definitions.ts`가 소유한다. Domain module은 `DomainMetricDefinitionsModule.register()`로 정의를
등록하고 `DOMAIN_METRICS_PORT`를 통해 bounded metric만 기록한다.

독립 module lifecycle이 있는 기능은 definition을 해당 slice에 recorder와 함께 둔다. 하나의 module이 여러
내부 slice recorder를 함께 등록하는 경우에는 module-level definition catalog를 둘 수 있으며, recorder의
비즈니스 timing과 label 값 결정 책임은 계속 각 owning slice에 남긴다.

Platform은 registry, counter/gauge/histogram primitive, label validation, Prometheus adapter만 소유한다.
동일 metric name 중복, 금지 label, 잘못된 histogram bucket은 definition 등록 시 fail-fast한다.

현재 bridge 범위:

- chat realtime: socket 연결 수, dispatch batch, outbox lag, rejection, prune outcome
- auth request lifecycle: verification, credential, mail, login, hash, session, signup outcome
- auth operations: cleanup deleted/failure/batch saturation
- health: readiness result/failure/duration
- seasons operations: current season query/cache, 운영 schedule/override action outcome
- retention: backlog gauge, sweep duration, review job count
- Prisma platform: managed pg pool snapshot, Serializable transaction retry/exhausted
- roommate-search: request duration/outcome, sort, candidate pipeline count

제품 도메인의 in-memory snapshot을 `/health/realtime`, `/health/auth` 같은 route로 노출하지 않는다.
Request·mail·credential·cleanup·realtime lifecycle 경보는 owner-local counter/gauge와 Prometheus rule이
담당하며 감사 로그를 다시 읽어 metric을 만들지 않는다. Public readiness는 runtime routing에 필요한
bounded aggregate만 반환한다.

## 관측 책임

- logging foundation은 request correlation, redaction, exception/Prisma pool error logging을 소유한다.
- `/internal/metrics`와 Prometheus registry는 bounded platform HTTP/exception metric을 제공한다.
- domain metrics bridge는 각 domain operation의 bounded metric/log touch point를 연결한다.
- 제품 metric 추가는 platform adapter 수정 없이 owning module의 definition catalog와 owning slice recorder 변경으로 끝나야 한다.

## Infra stack

Local/staging Prometheus, Grafana, Loki, Alloy 구성은 repo root의 `infra/observability`가 소유한다.
API code는 `/internal/metrics`와 JSON stdout log만 제공하고, stack 실행/노출/secret 관리는 infra runbook에서 다룬다.
