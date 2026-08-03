# Auth API module architecture

이 문서는 `apps/api/src/auth` 내부 책임 경계, public surface, directory ownership, 수정 위치를 빠르게 찾기 위한 server-side boundary map이다.

## Public boundary

외부 domain production code는 auth 내부 command/repository/domain 구현을 직접 import하지 않는다. 필요한 surface는 아래로 제한한다.

- `AuthModule`: auth guard/session/access provider wiring을 제공한다.
- `access/` public surface: `@Public()`, `@OptionalAuth()`, `@RequireCapability()`, `@CurrentUser()`.
- actor context public type/resolver surface: 외부 domain은 `AuthenticatedUserContext`와 `AuthActorContextResolver`만 사용한다. `AuthSessionService`는 auth 내부 session facade다.
- `AuthPasswordVerifier`: 외부 domain이 credential/hash 구현을 알지 않고 account password 확인 capability만 사용하는 public application boundary다.
- `operations/`는 ops boundary다. `AuthOperationsModule`은 non-global module이며 필요한 module이 명시 import한다.

## Directory responsibilities

- `access/`: route-level auth access metadata, capability, current user decorator, authenticated user guard. Domain context guard와 합치지 않는다.
- `application/`: controller-facing facade와 public actor context resolver/type boundary. Workflow orchestration bucket을 두지 않는다.
- `composition/`: `AuthModule` provider/export grouping. Slice provider 목록과 public module export surface를 모듈 decorator에서 분리해 읽기 쉽게 유지한다.
- `contracts/`: shared auth contract behavior regression spec. Shared package layout fitness는 architecture가 소유한다.
- `domain/`: request context와 auth email identity policy처럼 여러 auth flow가 공유하는 pure domain owner. Generic `utils.ts`·`types.ts` bucket은 두지 않고 request/response type은 shared contract, internal result는 owning slice에 둔다. Opaque session token primitive는 `sessions/opaque-token.ts`가 canonical owner다.
- `sessions/`: opaque DB-backed session lifecycle. `auth-session-use-cases.service.ts`, opaque token primitive, current actor/session query, issue/renew/logout/revoke command, repository, renewal/reuse/revoke policy와 low-cardinality renewal metric을 함께 둔다.
- `verification/`: `auth-verification-use-cases.service.ts`, verification code request/verify, purpose-bound grant consume, purpose lock, TypedSQL/Prisma repository를 함께 둔다.
- `credentials/`: `auth-credential-use-cases.service.ts`, login/reset/change password command와 credential admission을 둔다.
  - `credentials/password-hashing/`: Argon2id hash/verify, hash profile adapter, process-local capacity admission을 함께 소유한다.
  - `credentials/password-policy/`: Shared structure policy mapping, API-private common/contextual policy와 blocklist lookup을 함께 소유한다.
- `login-attempts/`: login failure counter, active lock query, failure record/clear command, lockout policy, login network throttle와 no-PII metric을 함께 둔다. 계정 잠금과 IP throttle을 하나의 bucket으로 합치지 않는다.
- `security-events/`: audit/security event service, repository, sanitizer, alert policy, event types를 함께 둔다. raw email/IP/UA/token/password/code를 저장하지 않는다. Login 같은 운영 관측 event는 `recordSafely`로 fail-open할 수 있지만 Signup·Reset·Change Password의 필수 credential lifecycle event는 owning transaction 안에서 `recordInTransaction`으로 기록한다.
- `registration/`: `auth-registration-use-cases.service.ts`, nickname-only signup admission query와 signup command를 함께 둔다. Auth는 lifestyle/intro/profile parser나 display nickname 불변식 자체를 소유하지 않는다.
- `adapters/email/`: `EmailSender` contract, local/test stub sender, SESv2 production sender, provider delegate selection, monitored send wrapper.
- `mappers/`: shared response mapper and user/session presenter.
- `errors/`: user-facing neutral/fail-closed error contract.
- `operations/`: Redis gate, auth cleanup, verification/credential/mail metrics, recent security alert query, health snapshot. Postgres authoritative 기준을 유지한다.

## Hard rules

- Postgres authoritative: Redis는 metric gate 후보일 뿐 auth source-of-truth가 아니다.
- Auth cleanup은 `RetentionWorkerPrismaService`로 실행한다. `auth_cleanup_worker`는 배포 인프라에서 cleanup 전용 credential이 필요할 때 사용하는 예약 role 이름이다.
- `/health/auth`, `/health/realtime`은 `admin:operations:health:read` capability가 필요한 ops-only endpoint이며 public internet health가 아니다.
- `/health`, `/health/ready`는 public liveness/readiness surface다. 운영 metric, dispatcher failure, replay resync reason 같은 상세 운영 정보는 public surface와 분리한다.
- `AuthOperationsModule`은 `@Global()` module이 아니다.
- JWT transport/JWT bridge를 재도입하지 않는다.
- Renewal rotation은 current hash를 previous hash로 옮기고 DB clock 기준 8초 grace를 둔다. Grace 안의 previous token은 stale이며, grace 밖의 old/unknown token만 reuse로 session family를 revoke한다.
- Renewal metric은 `renewed|required|stale|reused` outcome만 기록하고 session/user/token 식별자를 label로 사용하지 않는다.
- Missing/deleted/incomplete account login은 active hash와 같은 Argon2id profile의 canonical dummy hash를 검증한다. Active account lock은 cheap guard로 먼저 반환하는 명시적 예외다.
- 신규·dummy password hash와 seed/fixture는 Argon2id 19MiB/t=2/p=1 단일 profile을 공유한다. 아직 배포된 사용자 데이터가 없으므로 old-hash migration 분기는 두지 않고 production-like capacity gate 결과에 따라 release 전 baseline 전체를 조정한다.
- Signup/Reset/Change/Login/Account deletion의 Argon 연산은 process-local admission을 공유한다. 기본 상한은 동시 4·대기 32·2초 timeout이고 overload는 native queue를 늘리지 않고 bounded 503으로 종료한다.
- Login account lock은 Postgres `LoginAttempt`의 5회/5분 기준이고, network throttle은 trusted `request.ip` 기준 30회/1분 burst와 120회/10분 sustained bucket이다.
- Password reset 성공은 grant consume, password update, session revoke와 함께 같은 serializable transaction에서 해당 subject의 `LoginAttempt`를 제거한다.
- HMAC lookup dimension은 `AUTH_PERSISTENCE_HMAC_KEY_VERSION:digest` 형식이며 key version과 secret을 함께 rotation한다. raw email/IP/UA를 metric label이나 security event dimension에 저장하지 않는다.
- Signup은 account/display identity/academic identity/legal acceptance/grant consume/initial session/필수 audit을 하나의 serializable transaction으로 commit한다.
- Change Password는 password CAS, 기존 session 전체 revoke, replacement session, mail outbox, 필수 audit을 하나의 serializable transaction으로 commit한다. 두 흐름 모두 credential만 반영되는 부분 성공 contract를 만들지 않는다.
- Signup nickname 확인은 active `SIGNUP` grant를 요구하는 현재 사용 가능 여부 조회이며 예약이 아니다. 최종 소유권은 signup transaction의 `nicknameNormalized` unique constraint가 결정한다.
- Final Signup은 grant 기준 5회/10분, Change Password는 actor/session 기준 10회/10분 admission을 expensive password hash/verify 전에 적용한다. Global trusted-IP throttle은 보조 경계이며 login account lock과 상태를 공유하지 않는다.
- Auth mail `ACCEPTED`는 provider 접수 상태다. 최종 delivery/bounce/complaint는 SES Configuration Set event publishing owner가 담당한다.
- 새 `forwardRef()`로 boundary 문제를 봉합하지 않는다.
- 외부 domain production code에서 `auth/commands`, `auth/repositories`, `auth/domain`, `auth/policies`, `auth/adapters`, `auth/sessions`, `auth/verification`, `auth/credentials`, `auth/registration`, `auth/login-attempts`, `auth/security-events`를 직접 import하지 않는다.
- auth API module은 Web rendering/hook/page/component를 소유하지 않는다.

## Architecture guard

Auth architecture/inventory guard는 `apps/api/src/architecture/`의 product-named surface가 소유한다. `apps/api/src/auth` root spec은 controller behavior spec만 남기고, cross-cutting architecture fitness는 architecture surface에서 고정한다.

- Root production TypeScript file은 `auth.module.ts`, `auth.controller.ts`만 허용한다.
- Root spec file은 `auth.controller.spec.ts`만 허용한다.
- `AuthService`는 controller-facing facade이며 direct Prisma/session/verification/login-attempt/security-event orchestration을 하지 않는다.
- `AuthModule` provider/export list는 `composition/auth.providers.ts`, `composition/auth.exports.ts`가 소유한다. `APP_GUARD` 등록 순서는 AuthLoginThrottlerGuard → AuthenticatedUserGuard로 유지한다.
- Top-level `queries/`, `policies/`, `repositories` transition structure는 두지 않는다. Query/policy/repository는 각 owning slice 내부 파일명으로 둔다.
- Opaque session token primitive는 `sessions/opaque-token.ts`, password hash helper는 `credentials/password-hashing/password-hash.ts`가 canonical owner다.
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
- External users-domain account password verification: `application/auth-password-verifier.service.ts`.
- Opaque session issue/renew/logout/revoke/current actor projection: `sessions/`.
- Verification code/grant issue, verify, consume, and ACID repository behavior: `verification/`.
- Login, reset password, change password, and password hashing: `credentials/`.
- Signup nickname validation query, finalization admission, and signup orchestration: `registration/`. Nickname parse/moderation/availability invariant는 `users/identity/display/`의 `DisplayIdentityModule` public provider를 사용한다.
- Login failure lockout and failure counter state: `login-attempts/`.
- Audit/security event sanitize, persistence, and alert policy: `security-events/`.
- Encrypted auth mail envelope, transactional outbox append, bounded dispatcher, and delivery lifecycle: `mail/`.
- Provider selection, SES payload/receipt/tag mapping, bounded provider error category, and monitoring wrapper: `adapters/email/`.
- Shared response/user/session projection helpers: `mappers/`.
- Operational cleanup, verification/credential/mail metrics, security alert evaluation, Redis gate, and `/health/auth` snapshot: `operations/`.
- Auth route access matrix, domain context matrix, root-only/no-JWT/no-forwardRef architecture guard: `architecture/security/auth-access-route-matrix.spec.ts`, `architecture/domain-context/domain-context-route-matrix.spec.ts`, `architecture/domains/auth-boundary.spec.ts`.
- Password policy source/import boundary: `architecture/domains/auth-password-policy-boundary.spec.ts`.
- Shared auth request/response/policy/session contracts: `packages/shared/src/auth/**`; public imports use `@repo/shared/auth` and granular `@repo/shared/auth/*` only.

## Useful verification

```bash
pnpm --dir apps/api exec vitest run --config ./vitest.config.unit.ts --maxWorkers=50% \
  src/architecture/domains/auth-boundary.spec.ts \
  src/architecture/domains/auth-password-policy-boundary.spec.ts \
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
  src/auth/registration/signup-nickname-validation.query.spec.ts \
  src/auth/registration/signup-submission-admission.service.spec.ts \
  src/auth/login-attempts/auth-login-attempt.service.spec.ts \
  src/auth/access/authenticated-user.guard.spec.ts
pnpm api:typecheck
pnpm --dir apps/api exec eslint <changed files without apps/api prefix>
git diff --check
```
