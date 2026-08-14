# API health boundary

`health/`는 사용자 API process의 **liveness와 traffic readiness만** 소유한다. 제품 도메인의 운영
snapshot, 관리자 조회, 경고 판정은 이 module에 추가하지 않는다.

## Public routes

- `GET /health`, `GET /health/live`: process가 응답 가능한지만 확인한다. DB나 provider를 조회하지 않는다.
- `GET /health/ready`: 단일 DB TypedSQL probe와 immutable runtime bootstrap receipt를 확인한다.

Readiness 응답은 aggregate `status`와 bounded `failureCodes`만 반환한다. DB timing, secret source/origin,
mount path, provider 설정과 raw error는 public response에 포함하지 않는다.

## Runtime checks

- `checks/database-health.check.ts`: DB connectivity, DB clock, Prisma migration baseline을 하나의 bounded
  query로 확인한다.
- `checks/runtime-bootstrap-health.check.ts`: `env`, `mounted-files`, `aws-secrets-manager`가 bootstrap 전에
  만든 secret-free receipt가 존재하는지만 확인한다.
- `health-observability.service.ts`: readiness outcome/failure code/duration을 bounded metric으로 기록하고
  상태 전환만 structured log로 남긴다.
- `health-metric.definitions.ts`: HealthModule이 등록하는 readiness counter/histogram definition catalog다.
  Health는 하나의 module/runtime slice이므로 definition은 root에 두고 recorder와 platform adapter를 섞지 않는다.

Static config, required secret과 email provider 설정은 ConfigModule/listener 이전 bootstrap에서
fail-fast한다. 일시적인 mail delivery 장애는 Auth owner-local metric과 alert가 소유하며 global readiness를
내리지 않는다.

## 금지 사항

- Auth, Chat 등 제품 module import
- `/health/auth`, `/health/realtime` 같은 in-memory snapshot route
- 사용자·이메일·IP·token 또는 raw provider/DB error 노출
- readiness 요청마다 bootstrap schema나 secret inventory 재검증

실제 secret origin과 Lightsail 전달 증거는 `infra/runbooks/release/components/api-secrets-manager/`와
`infra/runbooks/release/components/lightsail-runtime/`가 소유한다.
