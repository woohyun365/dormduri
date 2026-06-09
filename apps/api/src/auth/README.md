# Auth API module architecture

이 문서는 `apps/api/src/auth` 내부 책임 경계, public surface, directory ownership, 수정 위치를 빠르게 찾기 위한 server-side boundary map이다.

## Public boundary

외부 domain production code는 auth 내부 command/repository/domain 구현을 직접 import하지 않는다. 필요한 surface는 아래로 제한한다.

- `AuthModule`: auth guard/session/access provider wiring을 제공한다.
- `access/` surface 또는 root compatibility wrapper: `@Public()`, `@OptionalAuth()`, `@RequireCapability()`, `@CurrentUser()`.
- actor context public type/resolver surface: 외부 domain은 `AuthenticatedUserContext`와 `AuthActorContextResolver`만 사용한다. `AuthSessionService`는 auth 내부 compatibility facade다.
- `operations/`는 ops boundary다. `AuthOperationsModule`은 non-global module이며 필요한 module이 명시 import한다.

## Directory responsibilities

- `access/`: route-level auth access metadata, capability, current user decorator, authenticated user guard. Domain context guard와 합치지 않는다.
- `application/`: controller-facing facade와 public actor context resolver/type boundary. Workflow orchestration bucket을 두지 않는다.
- `composition/`: `AuthModule` provider/export grouping. Slice provider 목록과 public module export surface를 모듈 decorator에서 분리해 읽기 쉽게 유지한다.
- `contracts/`: shared auth contract behavior regression spec. Shared package layout fitness는 architecture가 소유한다.
- `domain/`: request context, constants/types/utils 같은 pure/domain helper. Opaque session token primitive는 `sessions/opaque-token.ts`가 canonical owner다.
- `sessions/`: opaque DB-backed session lifecycle. `auth-session-use-cases.service.ts`, opaque token primitive, current actor/session query, issue/renew/logout/revoke command, repository, renewal/reuse/revoke policy를 함께 둔다.
- `verification/`: `auth-verification-use-cases.service.ts`, verification code request/verify, proof consume, purpose lock, TypedSQL/Prisma repository를 함께 둔다.
- `credentials/`: `auth-credential-use-cases.service.ts`, `password-hash.ts`, login/reset/change password command를 함께 둔다. 외부 users deletion은 `application/auth-password-hash.ts` bridge만 사용한다.
- `login-attempts/`: login failure counter, active lock query, failure record/clear command, lockout policy를 함께 둔다. 로그인 실패 5회 잠금 기준과 TTL은 behavior contract로 보존한다.
- `security-events/`: audit/security event service, repository, sanitizer, alert policy, event types를 함께 둔다. raw email/IP/UA/token/password/code를 저장하지 않고, event 기록 실패는 user flow를 막지 않는 fail-safe boundary다.
- `registration/`: `auth-registration-use-cases.service.ts`, signup command와 signup draft validation을 함께 둔다. Auth는 lifestyle/intro/profile parser를 소유하지 않는다.
- `adapters/email/`: `EmailSender` contract, stub/provider adapter, monitored send wrapper.
- `mappers/`: shared response mapper and user/session presenter.
- `errors/`: user-facing neutral/fail-closed error contract.
- `operations/`: Redis gate, auth cleanup, metrics, health snapshot. Postgres authoritative 기준을 유지한다.

## Hard rules

- Postgres authoritative: Redis는 metric gate 후보일 뿐 auth source-of-truth가 아니다.
- Auth cleanup은 `RetentionWorkerPrismaService`로 실행한다. `auth_cleanup_worker`는 배포 인프라에서 cleanup 전용 credential이 필요할 때 사용하는 예약 role 이름이다.
- `/health/auth`, `/health/realtime`은 `admin:operations:health:read` capability가 필요한 ops-only endpoint이며 public internet health가 아니다.
- `/health`, `/health/ready`는 public liveness/readiness surface다. 운영 metric, dispatcher failure, replay resync reason 같은 상세 운영 정보는 public surface와 분리한다.
- `AuthOperationsModule`은 `@Global()` module이 아니다.
- JWT transport/JWT bridge를 재도입하지 않는다.
- 새 `forwardRef()`로 boundary 문제를 봉합하지 않는다.
- 외부 domain production code에서 `auth/commands`, `auth/repositories`, `auth/domain`, `auth/policies`, `auth/adapters`, `auth/sessions`, `auth/verification`, `auth/credentials`, `auth/registration`, `auth/login-attempts`, `auth/security-events`를 직접 import하지 않는다.
- auth API module은 Web rendering/hook/page/component를 소유하지 않는다.

## Architecture guard

Auth architecture/inventory guard는 `apps/api/src/architecture/`의 product-named surface가 소유한다. `apps/api/src/auth` root spec은 controller behavior spec만 남기고, cross-cutting architecture fitness는 architecture surface에서 고정한다.

- Root production TypeScript file은 `auth.module.ts`, `auth.controller.ts`만 허용한다.
- Root spec file은 `auth.controller.spec.ts`만 허용한다.
- `AuthService`는 controller-facing facade이며 direct Prisma/session/verification/login-attempt/security-event orchestration을 하지 않는다.
- `AuthModule` provider/export list는 `composition/auth.providers.ts`, `composition/auth.exports.ts`가 소유한다. `APP_GUARD` 등록 순서는 ThrottlerGuard → AuthenticatedUserGuard로 유지한다.
- Top-level `queries/`, `policies/`, `repositories` transition structure는 두지 않는다. Query/policy/repository는 각 owning slice 내부 파일명으로 둔다.
- Opaque session token primitive는 `sessions/opaque-token.ts`, password hash helper는 `credentials/password-hash.ts`가 canonical owner다.
- `application/auth-use-cases.service.ts` bucket은 두지 않는다. Workflow orchestration은 `verification/`, `registration/`, `credentials/`, `sessions/` slice-local use-case provider가 소유한다.
- Session lifecycle은 `sessions/` slice가 소유한다.
- Verification/credentials/registration use case는 각 slice가 소유한다.
- Auth-local lifestyle parser와 generic `commands/` directory는 두지 않는다.
- Login-attempt/security-event use case는 각각 `login-attempts/`, `security-events/` slice가 소유한다.
- 외부 domain은 `auth/access/*`, `auth/application/auth-actor-context*`, `auth/auth.module`과 명시적 operations boundary만 import한다.
- policy/domain helper는 Nest provider와 `PrismaService`를 import하지 않는 pure boundary로 유지한다.

## Where to change auth behavior

- HTTP request/response parsing, cookie/header transport, and controller delegation: `auth.controller.ts`.
- Public route access mode, capability metadata, and current-user decorator behavior: `access/`.
- Controller-facing use-case delegation only: `application/auth.service.ts`.
- External-domain actor lookup/type surface: `application/auth-actor-context.*`.
- External users-domain password check bridge: `application/auth-password-hash.ts`.
- Opaque session issue/renew/logout/revoke/current actor projection: `sessions/`.
- Verification code/proof issue, verify, consume, and ACID repository behavior: `verification/`.
- Login, reset password, change password, and password hashing: `credentials/`.
- Signup draft validation and signup orchestration: `registration/`.
- Login failure lockout and failure counter state: `login-attempts/`.
- Audit/security event sanitize, persistence, and alert policy: `security-events/`.
- Mail sending adapter and monitoring wrapper: `adapters/email/`.
- Shared response/user/session projection helpers: `mappers/`.
- Operational cleanup, Redis gate metrics, and `/health/auth` snapshot: `operations/`.
- Auth route access matrix, domain context matrix, root-only/no-JWT/no-forwardRef architecture guard: `architecture/security/auth-access-route-matrix.spec.ts`, `architecture/domain-context/domain-context-route-matrix.spec.ts`, `architecture/auth-boundary.spec.ts`.
- Shared auth request/response/policy/session contracts: `packages/shared/src/auth/**`; public imports use `@repo/shared/auth` and granular `@repo/shared/auth/*` only.

## Useful verification

```bash
pnpm --dir apps/api exec jest --watchman=false --runInBand \
  src/architecture/auth-boundary.spec.ts \
  src/architecture/security/auth-access-route-matrix.spec.ts \
  src/architecture/domain-context/domain-context-route-matrix.spec.ts \
  src/auth/application/auth.service.spec.ts \
  src/auth/verification/auth-verification-use-cases.service.spec.ts \
  src/auth/registration/auth-registration-use-cases.service.spec.ts \
  src/auth/credentials/auth-credential-use-cases.service.spec.ts \
  src/auth/sessions/auth-session-use-cases.service.spec.ts \
  src/auth/sessions/auth-session.service.spec.ts \
  src/auth/credentials/login.command.spec.ts \
  src/auth/credentials/reset-password.command.spec.ts \
  src/auth/credentials/change-password.command.spec.ts \
  src/auth/registration/signup.command.spec.ts \
  src/auth/sessions/opaque-token.spec.ts \
  src/auth/verification/auth-verification.service.spec.ts \
  src/auth/verification/verification-code.repository.spec.ts \
  src/auth/registration/auth-signup-validation.service.spec.ts \
  src/auth/login-attempts/auth-login-attempt.service.spec.ts \
  src/auth/access/authenticated-user.guard.spec.ts
pnpm api:typecheck
pnpm --dir apps/api exec eslint <changed files without apps/api prefix>
git diff --check
```
