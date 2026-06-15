# platform/observability

`platform/observability`는 API runtime의 운영 관측 공통 경계를 소유한다.

## 책임

- requestId/correlationId를 생성하거나 안전한 inbound 값을 수용한다.
- `X-Request-Id` response header를 반환한다.
- Nest logger를 Pino 기반 single-line JSON stdout logger로 교체한다.
- request 완료 로그와 exception 로그를 structured event로 남긴다.
- 로그 기록 실패가 product request 실패로 전파되지 않게 한다.

## 로그 privacy

로그 event는 route template, method, status class, duration, bounded operation/outcome,
error code/name, hashed actor/session 같은 운영 필드만 담는다.

다음 값은 로그에 남기지 않는다.

- raw email/password/verification code
- JWT/access/refresh token, cookie, Authorization header
- raw request/response body
- chat/support/report body, retained vault/encrypted payload
- raw userId/threadId/messageId/sessionId/IP label

## Phase 경계

- Phase 1: logging foundation, request correlation, redaction, exception/prisma pool error logging.
- Phase 2: `/internal/metrics`와 Prometheus registry.
- Phase 3: domain metrics bridge와 domain operation metric/log touch point.
