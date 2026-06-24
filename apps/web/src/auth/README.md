# Web Auth Boundary

`apps/web/src/auth`는 Web 클라이언트의 auth feature boundary다.
최종 목표는 로그인, 회원가입, 비밀번호 재설정, auth API client, auth BFF helper, auth 전용 UI/hook/model을 이 경계 아래로 수렴시키는 것이다.
API/NestJS auth domain, DB/session/token/SES/Redis/BackOffice 구현은 이 경계의 소유 범위가 아니다.

## Current baseline

Phase 1 기준으로 이 directory에는 `to-user-profile.ts`와 browser-side auth API client인 `api/*`가 존재한다.
개별 화면 구현과 auth-wide BFF/helper/component/hook/model은 아직 아래 legacy 위치에 남아 있다.
이 경로들은 Phase 1에서 의도적으로 허용되는 migration ledger이며, 최종 구조가 아니다.

| Current path                                      | Current responsibility                                               | Target phase                      |
| ------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------- |
| `src/app/api/auth/_shared.ts`                     | BFF upstream forwarding, cookie transport, token-like body redaction | Phase 2                           |
| `src/app/api/auth/_post-route.ts`                 | generic auth mutation route adapter helper                           | Phase 2                           |
| `src/app/api/auth/_request-guard.ts`              | strict JSON body parsing, request/response guard                     | Phase 2                           |
| `src/components/AuthHeader.tsx`                   | auth-only brand header                                               | Phase 3                           |
| `src/components/auth/PasswordRequirementList.tsx` | auth password policy UI                                              | Phase 3                           |
| `src/hooks/useCurrentUser.ts`                     | auth session query hook used by route gates and main shell           | Phase 3                           |
| `src/hooks/useRedirectIfAuthenticated.ts`         | auth page redirect gate                                              | Phase 3                           |
| `src/hooks/useCountdown.ts`                       | auth verification/retry-after countdown helper                       | Phase 3 if auth-only remains true |
| `src/constants/auth.ts`                           | auth policy constants plus signup-only account identity options      | Phase 3                           |
| `src/login`                                       | login flow implementation                                            | Phase 4                           |
| `src/signup`                                      | signup flow implementation                                           | Phase 4                           |
| `src/password-reset`                              | password reset flow implementation                                   | Phase 4                           |

`useExpiryCountdown` is not tracked as an auth-only migration target because it has non-auth product usage.

### Completed migration ledger

| Removed path        | New owner path             | Completed phase |
| ------------------- | -------------------------- | --------------- |
| `src/api/auth.ts`   | `src/auth/api/*`           | Phase 1         |
| `@/api/auth` import | `@/auth/api` public facade | Phase 1         |

## Final target structure

```text
apps/web/src/auth/
  README.md
  api/
    client.ts
    request-json.ts
    error-mapper.ts
    auth-api.types.ts
    index.ts
  bff/
    auth-forward.ts
    auth-cookies.ts
    auth-request-guard.ts
    auth-response-policy.ts
    index.ts
  components/
    AuthHeader.tsx
    AuthPageShell.tsx
    AuthFormCard.tsx
    AuthStatusAlert.tsx
    PasswordRequirementList.tsx
  hooks/
    useAuthSession.ts
    useRedirectIfAuthenticated.ts
    useAuthCountdown.ts
  model/
    policy-constants.ts
    safe-redirect.ts
  flows/
    login/
    signup/
    password-reset/
```

The exact internal file names may change when a later phase finds a smaller split.
The boundary rule is stable: auth-owned browser, BFF, UI, hook, and model code should live under `auth/` unless Next.js requires a framework entrypoint elsewhere.

## Public/private import rule

External Web features should consume auth through a small public facade.
The final public surface is expected to be one of the following:

- `@/auth/api` for browser-side auth client calls such as login, logout, session, signup, and reset.
- `@/auth` only if a broader facade becomes necessary.

Private implementation areas should not be deep-imported by non-auth features:

- `@/auth/bff/*`
- `@/auth/flows/*/components/*`
- `@/auth/flows/*/hooks/*`
- `@/auth/flows/*/model/*`
- `@/auth/components/*` except through an auth-owned facade if one is added.

The Phase 1 codebase no longer imports `@/api/auth`; external consumers now use `@/auth/api`.
`@/login`, `@/signup`, and `@/password-reset` remain migration inputs until the flow move phase.
Those paths are migration inputs, not final public APIs.

## App Router exception

Next.js App Router entrypoints must remain under `apps/web/src/app`.
Do not move these files into `auth/`:

- `app/api/auth/<route>/route.ts`
- `app/login/page.tsx`
- `app/signup/page.tsx`
- `app/password-reset/page.tsx`

Instead, keep route/page files thin.
Final shape should be:

```text
app/login/page.tsx -> auth/flows/login/LoginPageClient
app/signup/page.tsx -> auth/flows/signup/SignupPageClient
app/password-reset/page.tsx -> auth/flows/password-reset/PasswordResetPageClient
app/api/auth/<route>/route.ts -> auth/bff helpers + route-local schema/policy
```

Route handlers should preserve upstream status, `Retry-After`, cookie mutation, and token-like response redaction when their helpers move to `auth/bff`.

## No compatibility re-export target

The final auth boundary should not keep compatibility re-export files only to preserve old import paths.
Phase 5 should make these imports fail architecture guard checks:

- `@/api/auth`
- `@/constants/auth`
- `@/components/AuthHeader`
- `@/components/auth`
- `@/hooks/useCurrentUser`
- `@/hooks/useRedirectIfAuthenticated`
- `@/hooks/useCountdown` if it remains auth-only
- `@/login`
- `@/signup`
- `@/password-reset`

If an external feature still needs auth behavior, expose that behavior through the auth public facade instead of adding a compatibility wrapper.

## Security and accessibility invariants

- Browser-visible state must not store access tokens, renewal tokens, verification codes, reset passwords, or reset secrets in local/session storage or URL history.
- BFF responses must redact token-like fields from JSON bodies and use httpOnly cookie transport for session materialization.
- Password reset code request and verification copy must avoid account enumeration.
- Signup payloads must not include lifestyle/profile fields owned by season profile flows.
- Redirect helpers must allow internal safe targets only.
- Auth forms and status messages should be tested through accessible role/name/text queries.
- Error/status UI should expose user-friendly copy and not raw upstream stack or provider messages.

## Phase migration map

| Phase   | Boundary outcome                                                                                           |
| ------- | ---------------------------------------------------------------------------------------------------------- |
| Phase 0 | This README and a passing architecture migration ledger exist. No product behavior changes.                |
| Phase 1 | `src/api/auth.ts` is split into `auth/api/*`; external consumers use `@/auth/api`.                         |
| Phase 2 | `app/api/auth/_*.ts` helper logic moves to `auth/bff/*`; route files stay thin App Router adapters.        |
| Phase 3 | Auth-only root components, hooks, and constants move to `auth/components`, `auth/hooks`, and `auth/model`. |
| Phase 4 | `login`, `signup`, and `password-reset` implementations move to `auth/flows/*`.                            |
| Phase 5 | Architecture guard switches from migration ledger to strict final import enforcement.                      |
| Phase 6 | Auth UX smoke, accessibility, and security regression tests prove the moved boundary still works.          |
| Phase 7 | Final docs/checkpoint clarify #260 close readiness and follow-up issues.                                   |

## Verification map

Phase 1 focused baseline:

```bash
pnpm --dir apps/web exec vitest run \
  src/auth/api \
  src/auth/__tests__/auth-boundary.imports.test.ts \
  src/app/api/auth/__tests__ \
  src/login \
  src/signup \
  src/password-reset

pnpm exec prettier --check --ignore-unknown \
  apps/web/src/auth/README.md \
  apps/web/src/auth/api \
  apps/web/src/auth/__tests__/auth-boundary.imports.test.ts \
  .omx/plans/web-auth-boundary-final-refactor-plan.md

pnpm --dir apps/web exec eslint src/auth
pnpm api:typecheck
git diff --check
```

Later phases should add `pnpm web:typecheck`, `pnpm web:lint`, `pnpm web:test`, and `pnpm web:build` as imports move.
Run Playwright only when route smoke, visible auth route behavior, or browser navigation surfaces are changed.

## Source documents

- `.omx/plans/web-auth-boundary-final-refactor-plan.md`
- `.omx/plans/web-login-page-refactor-plan.md`
- `.omx/plans/web-signup-page-refactor-plan.md`
- `.omx/plans/web-password-reset-page-refactor-plan.md`
- `apps/web/src/auth/api/*`
- `apps/web/src/login/README.md`
- `apps/web/src/signup/README.md`
- `apps/web/src/password-reset/README.md`
- `docs/04_policy/official/account-authentication.md`
- `docs/04_policy/official/access-eligibility.md`
- `docs/04_policy/official/legal-basis.md`

If README guidance and official policy conflict, official policy wins and auth README/tests should be updated in the same change.
