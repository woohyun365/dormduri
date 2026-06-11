# Users API module architecture

이 문서는 `apps/api/src/users`의 server-side boundary map이다. `users`는 모든 user-related table의 owner가 아니라, authenticated account self-service API와 account-owned identity/current-user/deletion orchestration을 소유한다.

## Public boundary

외부 domain production code는 users 내부 owner/repository/helper를 직접 import하지 않는다. 필요한 surface는 아래로 제한한다.

- `UsersModule`: account self-service route와 provider wiring을 제공한다.
- `UsersController`: `/api/users/me`, `/api/users/me/onboarding`, `/api/users/me/delete` HTTP route delegation을 소유한다.
- `UsersService`: controller-facing facade다. 임의의 cross-domain user table access point가 아니며, route response/error behavior를 유지하는 얇은 delegation surface로 제한한다.
- `CurrentUserViewModule` / `CurrentUserViewService`: current authenticated user read model assembly surface다. mutation owner가 아니다.
- Top-level `apps/api/src/identity`의 identity invariant helper는 pure shared-kernel이다. Persistence-backed account identity behavior는 users identity owner가 소유한다.
- Account identity invariant HTTP mapping은 `platform/http/account-identity-invariant.error.ts`가 소유한다. Users route error namespace를 cross-domain invariant adapter로 사용하지 않는다.
- Campus operated/current-season service-state projection은 `seasons/runtime/campus-service-state.query.ts`가 소유한다. Users는 current-user response assembly에서 이 stable query를 소비한다.

## Directory responsibilities

새 코드는 아래 responsibility owner를 따른다.

- `application/`: controller-facing facade, update-current-user orchestration, public port type.
- `current-user/`: current-user read model query, select, mapper, presenter, capability/service-state composition.
- `identity/display/`: live display identity, nickname format/moderation/cooldown, registration snapshot lock, display nickname update.
- `identity/academic/`: account academic identity correction, birth-year registration snapshot guard, college correction allowance.
- `identity/audit/`: display/academic identity change audit append/query helper.
- `identity/retention/`: nickname/academic identity audit archive handlers that transform users-owned source rows for retention archive jobs. Sweep scheduling and execution stay in `retention/application/ports/retention-sweep.port.ts`.
- `onboarding/`: dismissed notice command/query behavior.
- `account-deletion/`: account deletion request, password-check bridge use, immediate de-identification, retained identity/archive job delegation.
- `operations/`: admin/support/enforcement-facing nickname override command와 display nickname audit list query seam. Public controller는 노출하지 않는다.
- `errors/`: users route and account self-service user-facing error contract.
- `contracts/`: shared user contract behavior regression specs.
- `composition/`: `UsersModule` provider/export grouping source of truth.

## Hard rules

- Refactors must not change user-facing route paths, response shapes, error codes, token/session policy, DB schema semantics, or account deletion side effects.
- `users` does not own auth credential/session/password policy. Account deletion may use the auth password-hash bridge, but credential/session lifecycle stays in auth.
- `users` does not own season profile lifestyle/condition/registration writes, public profile/search policy, match/chat action policy, notification inbox behavior, social-safety report review outcome, or account-level enforcement engine.
- Account deletion fails closed for a current registered participant. Accepted deletion immediately de-identifies active account identity and must not restore retained payload through user-facing product paths.
- Do not create root `users/retention/` as a placeholder or sweep owner. Users-owned retained source row transformations live under `identity/retention/`. Retention sweep execution is owned by `retention/application/ports/retention-sweep.port.ts`.
- Top-level `identity/` remains pure shared-kernel code. Do not add Nest providers, Prisma clients, HTTP adapters, or module wiring there.
- Campus service-state resolution is seasons/runtime domain context vocabulary. Users consumes `seasons/runtime/campus-service-state.query.ts` for current-user projection, but must not own campus/season runtime state.
- Account identity invariant failure uses identity pure vocabulary plus platform HTTP adapter. Users route errors remain users account self-service errors.
- `ModerationModule` remains an explicit non-global dependency for public text validation such as nickname checks.
- Do not hide dependency cycles with new `forwardRef()` or business `@Global()` modules.
- New external-domain integrations must use narrow purpose-specific ports rather than importing `UsersService` as a broad user data facade.

## Architecture guard

Users architecture fitness belongs under `apps/api/src/architecture/users/` and cross-cutting architecture specs.

- Root production TypeScript surface는 `users.controller.ts`, `users.module.ts`만 허용한다. Root owner file로 새 behavior를 확장하지 않는다.
- Root `users/retention/` directory is intentionally absent. Architecture guard expects users identity archive handlers under `identity/retention/` and retention sweep execution through `RETENTION_SWEEP_PORT`.
- Module provider/export list는 `composition/users.providers.ts`와 `composition/users.exports.ts`로 읽을 수 있어야 한다.
- Lifecycle adapter는 users의 broad controller-facing service behavior나 users-owned retention sweep port에 의존하지 않는다. Retention sweep 실행은 `retention/application/ports/retention-sweep.port.ts`가 소유한다.
- `season-participants` production code는 account identity invariant failure를 위해 users route error를 import하지 않아야 한다.
- Shared user contract는 `packages/shared/src/user/**`와 `@repo/shared/user/**` canonical nested package layout을 사용한다.

## Where to change users behavior

- HTTP route parsing and delegation: `users.controller.ts`.
- Controller-facing delegation: `application/users.service.ts`.
- Current-user read model projection: `current-user/` owner files. Canonical placement is `current-user/current-user-view.service.ts`, `current-user/current-user.select.ts`, and `current-user/current-user.presenter.ts`. Campus service-state projection comes from `seasons/runtime/campus-service-state.query.ts`.
- Account identity invariant HTTP mapping: `platform/http/account-identity-invariant.error.ts`; pure invariant vocabulary: `identity/account-identity-invariant.ts`.
- Display nickname self-service update: `identity/display/` owner files. Canonical placement is `identity/display/update-display-identity.command.ts`, `identity/display/display-identity.repository.ts`, `identity/display/display-identity-edit.policy.ts`, and `identity/display/nickname-cooldown.policy.ts`.
- Academic identity correction: `identity/academic/update-academic-identity.command.ts`, `academic-identity.repository.ts`, `academic-college-change-allowance.repository.ts`, `academic-identity-audit.repository.ts`.
- Identity audit append/query: `identity/audit/` owner files. Display nickname audit canonical placement is `identity/audit/display-identity-nickname-audit.repository.ts`.
- Identity audit retained payload archive handlers: `identity/retention/nickname-audit-archive.handler.ts`, `identity/retention/academic-identity-audit-archive.handler.ts`.
- Onboarding notice dismiss/readback: `onboarding/dismiss-onboarding-notice.command.ts`, `onboarding/onboarding-notice.repository.ts`, `onboarding/onboarding-notice.policy.ts`.
- Account deletion and immediate de-identification: `account-deletion/request-account-deletion.command.ts`, `account-deletion/account-deletion-precondition.policy.ts`, `account-deletion/account-deletion.repository.ts`, `account-deletion/account-deletion-deidentification.mapper.ts`.
- Account deletion retained identity/archive job creation: `account-deletion/request-account-deletion.command.ts` and retention nested command/port imports. Lifecycle sweep execution is owned by `retention/application/ports/retention-sweep.port.ts`.
- Operations nickname override/audit query seam: `operations/override-display-identity-nickname.command.ts`, `operations/list-display-identity-nickname-audit.query.ts`. No public operations controller is exposed here.
- Users-specific error contract: `errors/users.errors.ts`.

## Policy references

정책 문서 점검 결과, 아래 공식 정책 문서는 account self-service boundary를 독립적으로 설명하므로 README 추가만으로 충분하다.

- `docs/04_policy/official/profile-model.md`: account display identity, account academic identity, registration snapshot lock, onboarding dismissed notice, deletion/de-identification profile read priority.
- `docs/04_policy/official/account-authentication.md`: signup account identity invariant, academic correction policy, account invariant fail-closed behavior, credential/session ownership.
- `docs/04_policy/official/data-retention.md`: account deletion, immediate de-identification, retained identity restricted vault, identifier anchor disposal, retained payload access boundary.
- `docs/04_policy/official/service-boundary.md`: user-facing product path는 retained payload를 복원하지 않는다.

## Useful verification

```bash
pnpm exec prettier --check apps/api/src/users/README.md
pnpm --dir apps/api exec jest --watchman=false --runInBand \
  src/users \
  src/architecture/users/users-boundary.spec.ts \
  src/architecture/module-boundary.spec.ts \
  src/architecture/common-boundary.spec.ts \
  src/architecture/security/auth-access-route-matrix.spec.ts
pnpm api:typecheck
git diff --check
```
