# Auth API module architecture

Auth 제품 완성 Phase 8 이후의 server-side boundary map이다. 이 문서는 구현 세션이 `apps/api/src/auth` 책임을 빠르게 찾기 위한 orientation note이며, 사용자-facing auth behavior를 변경하는 정책 문서가 아니다.

## Public boundary

외부 domain production code는 auth 내부 command/repository/domain 구현을 직접 import하지 않는다. 필요한 surface는 아래로 제한한다.

- `AuthModule`: auth guard/session/access provider wiring을 제공한다.
- `access/` surface 또는 root compatibility wrapper: `@Public()`, `@OptionalAuth()`, `@RequireCapability()`, `@CurrentUser()`.
- actor context public type/resolver surface: 현재 compatibility 기간에는 `AuthenticatedUserContext`/`AuthSessionService` wrapper를 유지한다.
- `operations/`는 ops boundary다. `AuthOperationsModule`은 non-global module이며 필요한 module이 명시 import한다.

## Directory responsibilities

- `access/`: route-level auth access metadata, capability, current user decorator, authenticated user guard. Domain context guard와 합치지 않는다.
- `application/`: controller-facing facade와 public actor context resolver/type boundary.
- `commands/`: signup/login/reset/change/session renewal/logout 같은 write use case orchestration.
- `queries/`: current session/user lookup, signup draft validation, auth eligibility read projection.
- `domain/`: opaque token, password hash, verification proof, request context, user view 같은 pure/domain helper.
- `repositories/`: Prisma/TypedSQL, serializable transaction, advisory lock, conditional update, DB projection shape.
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
- 외부 domain production code에서 `auth/commands`, `auth/repositories`, `auth/domain`, `auth/policies`, `auth/adapters`를 직접 import하지 않는다.
- Web rendering/hook/page/component 작업은 auth Phase 8 범위가 아니다.

## Phase 9 transition guard

`auth-architecture-boundary.spec.ts`는 Phase 9 최종 목표와 현재 migration debt를 함께 고정한다.

- 최종 목표 root production TypeScript file은 `auth.module.ts`, `auth.controller.ts`만 허용한다.
- Phase A 이후에는 `transitionRootCompatibilityFiles`와 `transitionRootImplementationFiles` allowlist를 단계별로 줄인다.
- `AuthService`는 controller-facing facade가 최종 목표이며, 현재 direct Prisma/session/verification/login-attempt/security-event orchestration은 explicit migration debt다.
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
  src/auth/auth-verification.service.spec.ts \
  src/auth/auth-verification.store.spec.ts \
  src/auth/auth-login-attempt.service.spec.ts \
  src/auth/authenticated-user.guard.spec.ts
pnpm typecheck
pnpm --dir apps/api exec eslint <changed files without apps/api prefix>
git diff --check
```
