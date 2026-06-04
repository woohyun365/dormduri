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
- `application/`: controller-facing facade와 public actor context resolver/type boundary.
- `commands/`: transition compatibility 위치다. Phase D 이후 login command만 남아 있고 signup/reset/change는 slice로 이동했다. 여기서 transition compatibility는 기존 import/후속 Phase와 충돌하지 않도록 잠시 유지하는 경로라는 뜻이다.
- `queries/`: auth eligibility read projection 등 transition compatibility 위치다.
- `domain/`: opaque token, request context, user view 같은 pure/domain helper.
- `repositories/`: transition compatibility 위치다. Phase D 이후 verification repository는 `verification/`이 소유한다.
- `sessions/`: opaque DB-backed session lifecycle. current actor/session query, issue/renew/logout/revoke command, repository, renewal/reuse/revoke policy를 함께 둔다.
- `verification/`: verification code request/verify, proof consume, purpose lock, TypedSQL/Prisma repository를 함께 둔다.
- `credentials/`: password hash/verify helper와 reset/change password command를 함께 둔다.
- `registration/`: signup command, signup draft validation, lifestyle schema validation을 함께 둔다.
- `adapters/email/`: `EmailSender` contract, stub/provider adapter, monitored send wrapper.
- `policies/`: pure policy/helper. Nest provider나 Prisma mutation을 넣지 않는다.
- `mappers/`: shared response mapper and user/session presenter.
- `errors/`: user-facing neutral/fail-closed error contract.
- `operations/`: Redis gate, auth cleanup, metrics, health snapshot. Postgres authoritative 기준을 유지한다.

## Hard rules

- Postgres authoritative: Redis는 metric gate 후보일 뿐 auth source-of-truth가 아니다.
- Auth cleanup은 현재 `RetentionWorkerPrismaService`로 실행한다. `auth_cleanup_worker`는 future infra role이다.
- `/health/auth`는 `admin:operations:health:read` capability가 필요한 ops-only endpoint이며 public internet health가 아니다.
- `AuthOperationsModule`은 `@Global()` module이 아니다.
- JWT transport/JWT bridge를 재도입하지 않는다.
- 새 `forwardRef()`로 boundary 문제를 봉합하지 않는다.
- 외부 domain production code에서 `auth/commands`, `auth/repositories`, `auth/domain`, `auth/policies`, `auth/adapters`, `auth/sessions`, `auth/verification`, `auth/credentials`, `auth/registration`을 직접 import하지 않는다.
- Web rendering/hook/page/component 작업은 auth Phase 8 범위가 아니다.

## Phase 9 transition guard

`auth-architecture-boundary.spec.ts`는 Phase 9 최종 목표와 현재 migration debt를 함께 고정한다.

- 최종 목표 root production TypeScript file은 `auth.module.ts`, `auth.controller.ts`만 허용한다.
- Phase A 이후에는 `transitionRootCompatibilityFiles`와 `transitionRootImplementationFiles` allowlist를 단계별로 줄인다.
- `AuthService`는 controller-facing facade가 최종 목표이며, 현재 direct Prisma/session/verification/login-attempt/security-event orchestration은 explicit migration debt다.
- Phase C 이후 session lifecycle은 `sessions/` slice가 소유하고, root `AuthSessionService`는 기존 call site 호환을 위한 thin facade로만 남긴다.
- Phase D 이후 verification/credentials/registration use case는 각 slice가 소유하고, root files는 기존 import 호환 wrapper로만 남긴다.
- 외부 domain은 최종적으로 `auth/access/*`, `auth/application/auth-actor-context*`, `auth/auth.module`만 import해야 한다. 현재 root compatibility wrapper와 operations-only imports는 transition surface로만 허용한다.
- policy/domain helper는 Nest provider와 `PrismaService`를 import하지 않는 pure boundary로 유지한다.

## Useful verification

```bash
pnpm --dir apps/api exec jest --watchman=false --runInBand \
  src/auth/auth-architecture-boundary.spec.ts \
  src/auth/auth-route-metadata.inventory.spec.ts \
  src/auth/domain-context-route-metadata.inventory.spec.ts \
  src/auth/auth.service.spec.ts \
  src/auth/auth-session.service.spec.ts \
  src/auth/verification/auth-verification.service.spec.ts \
  src/auth/verification/verification-code.repository.spec.ts \
  src/auth/registration/auth-signup-validation.service.spec.ts \
  src/auth/auth-login-attempt.service.spec.ts \
  src/auth/authenticated-user.guard.spec.ts
pnpm typecheck
pnpm --dir apps/api exec eslint <changed files without apps/api prefix>
git diff --check
```
