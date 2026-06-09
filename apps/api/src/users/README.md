# Users API module architecture

이 문서는 `apps/api/src/users`의 server-side boundary map이다. `users`는 모든 user-related table의 owner가 아니라, authenticated account self-service API와 account-owned identity/current-user/deletion orchestration을 소유한다.

## Public boundary

외부 domain production code는 users 내부 owner/repository/helper를 직접 import하지 않는다. 필요한 surface는 아래로 제한한다.

- `UsersModule`: account self-service route와 provider wiring을 제공한다.
- `UsersController`: `/api/users/me`, `/api/users/me/onboarding`, `/api/users/me/delete` HTTP route delegation을 소유한다.
- `UsersService`: controller-facing facade다. 임의의 cross-domain user table access point가 아니며, route response/error behavior를 유지하는 얇은 delegation surface로 제한한다.
- `CurrentUserViewModule` / `CurrentUserViewService`: current authenticated user read model assembly surface다. mutation owner가 아니다.
- `USER_RETENTION_SWEEP_PORT`: lifecycle-facing account deletion retention sweep surface다. User-facing domain은 product read/write를 위해 이 port를 직접 호출하지 않는다.
- Top-level `apps/api/src/identity`의 identity invariant helper는 pure shared-kernel이다. Persistence-backed account identity behavior는 users identity owner가 소유한다.

## Directory responsibilities

현재 directory에는 root owner file이 남아 있다. 새 코드는 root file을 확장하기보다 아래 responsibility owner를 따른다.

- `application/`: controller-facing facade와 public port type.
- `current-user/`: current-user read model query, select, mapper, presenter, capability/service-state composition.
- `identity/display/`: live display identity, nickname format/moderation/cooldown, registration snapshot lock, display nickname update.
- `identity/academic/`: account academic identity correction, birth-year registration snapshot guard, college correction allowance.
- `identity/audit/`: display/academic identity change audit append/query helper.
- `onboarding/`: dismissed notice command/query behavior.
- `account-deletion/`: account deletion request, password-check bridge use, immediate de-identification, retained identity/archive job delegation.
- `retention/`: lifecycle-facing users retention sweep port implementation.
- `operations/`: admin/support/enforcement-facing nickname override와 audit query seam. Public controller는 노출하지 않는다.
- `errors/`: users route and account self-service user-facing error contract.
- `contracts/`: shared user contract behavior regression specs.
- `composition/`: `UsersModule` provider/export grouping source of truth.

## Hard rules

- Refactors must not change user-facing route paths, response shapes, error codes, token/session policy, DB schema semantics, or account deletion side effects.
- `users` does not own auth credential/session/password policy. Account deletion may use the auth password-hash bridge, but credential/session lifecycle stays in auth.
- `users` does not own season profile lifestyle/condition/registration writes, public profile/search policy, match/chat action policy, notification inbox behavior, social-safety report review outcome, or account-level enforcement engine.
- Account deletion fails closed for a current registered participant. Accepted deletion immediately de-identifies active account identity and must not restore retained payload through user-facing product paths.
- Top-level `identity/` remains pure shared-kernel code. Do not add Nest providers, Prisma clients, HTTP adapters, or module wiring there.
- Campus service-state resolution is seasons/runtime domain context vocabulary. Users consumes `seasons/runtime/campus-service-state.query.ts` for current-user projection, but must not own campus/season runtime state.
- `ModerationModule` remains an explicit non-global dependency for public text validation such as nickname checks.
- Do not hide dependency cycles with new `forwardRef()` or business `@Global()` modules.
- New external-domain integrations must use narrow purpose-specific ports rather than importing `UsersService` as a broad user data facade.

## Architecture guard

Users architecture fitness belongs under `apps/api/src/architecture/users/` and cross-cutting architecture specs.

- Root production TypeScript surface는 최종적으로 `users.controller.ts`, `users.module.ts`만 허용한다. 기존 root owner file은 이전 배치이며 새 behavior 확장 지점으로 사용하지 않는다.
- 기존 root owner file은 새 behavior 확장 지점이 아니다.
- Module provider/export list는 `composition/users.providers.ts`와 `composition/users.exports.ts`로 읽을 수 있어야 한다.
- Lifecycle adapter는 broad controller-facing service behavior가 아니라 narrow users retention sweep surface에 의존해야 한다.
- `season-participants` production code는 account identity invariant failure를 위해 users route error를 import하지 않아야 한다.
- Shared user contract는 shared contract architecture spec이 소유하는 canonical nested package layout을 가져야 한다.

## Where to change users behavior

- HTTP route parsing and delegation: `users.controller.ts`.
- Controller-facing delegation: `application/users.service.ts`.
- Current-user read model projection: `current-user/` owner files. Canonical placement is `current-user/current-user-view.service.ts`, `current-user/current-user.select.ts`, and `current-user/current-user.presenter.ts`. Campus service-state projection comes from `seasons/runtime/campus-service-state.query.ts`.
- Display nickname self-service update: `identity/display/` owner files. Canonical placement is `identity/display/update-display-identity.command.ts`, `identity/display/display-identity.repository.ts`, `identity/display/display-identity-edit.policy.ts`, and `identity/display/nickname-cooldown.policy.ts`.
- Academic identity correction: `identity/academic/update-academic-identity.command.ts`, `academic-identity.repository.ts`, `academic-college-change-allowance.repository.ts`, `academic-identity-audit.repository.ts`.
- Identity audit append/query: `identity/audit/` owner files. Display nickname audit canonical placement is `identity/audit/display-identity-nickname-audit.repository.ts`.
- Onboarding notice dismiss/readback: `onboarding/dismiss-onboarding-notice.command.ts`, `onboarding/onboarding-notice.repository.ts`, `onboarding/onboarding-notice.policy.ts`.
- Account deletion and immediate de-identification: `account-deletion/request-account-deletion.command.ts`, `account-deletion/account-deletion-precondition.policy.ts`, `account-deletion/account-deletion.repository.ts`, `account-deletion/account-deletion-deidentification.mapper.ts`.
- Retention sweep adapter behavior: `retention/user-retention-sweep.service.ts`, `application/ports/user-retention-sweep.port.ts`, and lifecycle adapter wiring.
- Operations nickname override/audit query seam: `operations/` owner files. No public operations controller is exposed here.
- Users-specific error contract: `errors/` owner files. Existing placement is `users.errors.ts`.

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
  src/architecture/module-boundary.spec.ts \
  src/architecture/security/auth-access-route-matrix.spec.ts
pnpm api:typecheck
git diff --check
```
