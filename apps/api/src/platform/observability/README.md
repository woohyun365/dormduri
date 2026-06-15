# platform/observability

`platform/observability`는 API runtime의 운영 관측 공통 경계를 소유한다.

## 책임

- requestId/correlationId를 생성하거나 안전한 inbound 값을 수용한다.
- `X-Request-Id` response header를 반환한다.
- Nest logger를 Pino 기반 single-line JSON stdout logger로 교체한다.
- request 완료 로그와 exception 로그를 structured event로 남긴다.
- `/internal/metrics` Prometheus scrape endpoint를 제공한다.
- HTTP request total/duration/in-flight와 normalized exception counter를 bounded label로 기록한다.
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

다음 값은 label로 쓰지 않는다.

- raw path/query/body/payload/params
- userId/email/threadId/messageId/sessionId/requestId/correlationId/IP
- token/cookie/authorization/password 같은 credential성 값

`route`는 Express route template 또는 `UNKNOWN_ROUTE`만 사용한다.

## Phase 경계

- Phase 1: logging foundation, request correlation, redaction, exception/prisma pool error logging.
- Phase 2: `/internal/metrics`, Prometheus registry, bounded platform HTTP/exception metrics.
- Phase 3: domain metrics bridge와 domain operation metric/log touch point.
