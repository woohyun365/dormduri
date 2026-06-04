# Auth API module architecture

Auth 제품 완성 Phase 8 이후의 server-side boundary map이다. 이 문서는 구현 세션이 `apps/api/src/auth` 책임을 빠르게 찾기 위한 orientation note이며, 사용자-facing auth behavior를 변경하는 정책 문서가 아니다.

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
- Auth cleanup은 현재 `RetentionWorkerPrismaService`로 실행한다. `auth_cleanup_worker`는 future infra role이다.
- `/health/auth`, `/health/realtime`은 `admin:operations:health:read` capability가 필요한 ops-only endpoint이며 public internet health가 아니다.
- `/health`, `/health/ready`는 현재 public liveness/readiness baseline으로 유지한다. 운영 metric, dispatcher failure, replay resync reason 같은 상세 운영 정보는 public surface와 분리한다.
- `AuthOperationsModule`은 `@Global()` module이 아니다.
- JWT transport/JWT bridge를 재도입하지 않는다.
- 새 `forwardRef()`로 boundary 문제를 봉합하지 않는다.
- 외부 domain production code에서 `auth/commands`, `auth/repositories`, `auth/domain`, `auth/policies`, `auth/adapters`, `auth/sessions`, `auth/verification`, `auth/credentials`, `auth/registration`, `auth/login-attempts`, `auth/security-events`를 직접 import하지 않는다.
- Web rendering/hook/page/component 작업은 auth Phase 8 범위가 아니다.

## Phase 9 transition guard

`auth-architecture-boundary.spec.ts`는 Phase 9 최종 목표와 현재 migration debt를 함께 고정한다.

- 최종 목표 root production TypeScript file은 `auth.module.ts`, `auth.controller.ts`만 허용한다.
- Phase A 이후에는 `transitionRootCompatibilityFiles`와 `transitionRootImplementationFiles` allowlist를 단계별로 줄인다.
- `AuthService`는 controller-facing facade가 최종 목표이며, 현재 direct Prisma/session/verification/login-attempt/security-event orchestration은 explicit migration debt다.
- Phase G 이후 `AuthModule` provider/export list는 `composition/auth.providers.ts`, `composition/auth.exports.ts`가 소유한다. `APP_GUARD` 등록 순서는 ThrottlerGuard → AuthenticatedUserGuard로 유지한다.
- Phase G-1 이후 top-level `queries/`, `policies/`, `repositories` transition structure는 최종 target에서 제거한다. Query/policy/repository는 각 owning slice 내부 파일명으로 둔다.
- Phase G-1 이후 opaque session token primitive는 `sessions/opaque-token.ts`, password hash helper는 `credentials/password-hash.ts`가 canonical owner다.
- Phase G-2 이후 `application/auth-use-cases.service.ts` bucket은 제거되고 workflow orchestration은 `verification/`, `registration/`, `credentials/`, `sessions/` slice-local use-case provider가 소유한다.
- Phase C 이후 session lifecycle은 `sessions/` slice가 소유하고, root `AuthSessionService`는 기존 call site 호환을 위한 thin facade로만 남긴다.
- Phase D 이후 verification/credentials/registration use case는 각 slice가 소유하고, root files는 기존 import 호환 wrapper로만 남긴다.
- Phase D-1/D-2 이후 auth-local lifestyle parser와 generic `commands/` directory는 제거되었다. 남은 root compatibility file은 exact `export *` re-export만 허용하며, removal trigger는 Phase F root wrapper cleanup이다.
- Phase E 이후 login-attempt/security-event use case는 각각 `login-attempts/`, `security-events/` slice가 소유하고, root files는 기존 import 호환 wrapper로만 남긴다.
- 외부 domain은 최종적으로 `auth/access/*`, `auth/application/auth-actor-context*`, `auth/auth.module`만 import해야 한다. 현재 root compatibility wrapper와 operations-only imports는 transition surface로만 허용한다.
- policy/domain helper는 Nest provider와 `PrismaService`를 import하지 않는 pure boundary로 유지한다.

## Useful verification

```bash
pnpm --dir apps/api exec jest --watchman=false --runInBand \
  src/auth/auth-architecture-boundary.spec.ts \
  src/auth/auth-route-metadata.inventory.spec.ts \
  src/auth/domain-context-route-metadata.inventory.spec.ts \
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
pnpm typecheck
pnpm --dir apps/api exec eslint <changed files without apps/api prefix>
git diff --check
```
