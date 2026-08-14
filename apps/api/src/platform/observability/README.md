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
- response는 Prometheus text format이고 `prom-client` registry가 process/default metrics와 API platform metrics를 소유한다.

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

`route`는 Express route template 또는 `UNKNOWN_ROUTE`만 사용한다.

## Domain metrics bridge

도메인 코드는 `prom-client`를 직접 import하지 않는다. Metric name/help/label/bucket은 owning domain의
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
