# Web Auth Boundary

`apps/web/src/auth`는 Web 클라이언트의 auth feature boundary다.
최종 목표는 로그인, 회원가입, 비밀번호 재설정, auth API client, auth BFF helper, auth 전용 UI/hook/model을 이 경계 아래로 수렴시키는 것이다.
API/NestJS auth domain, DB/session/token/SES/Redis/BackOffice 구현은 이 경계의 소유 범위가 아니다.

## Current baseline

Phase 4 기준으로 이 directory에는 `api/*`, `bff/*`, `components/*`, `hooks/*`, `model/*`, `flows/*`가 존재한다.
Auth-wide component/hook/model은 root shared tree에서 제거되었고, auth session hook은 계정 identity만 반환한다.
공개 auth 화면 구현도 `auth/flows/*` 아래로 이동했으므로 root `src/login`, `src/signup`, `src/password-reset` compatibility path를 두지 않는다.

| Current path                    | Current responsibility                     |
| ------------------------------- | ------------------------------------------ |
| `src/auth/flows/login`          | login flow implementation                  |
| `src/auth/flows/signup`         | signup flow implementation                 |
| `src/auth/flows/password-reset` | password reset flow implementation         |
| `src/auth/api`                  | browser-side auth API facade               |
| `src/auth/bff`                  | App Router auth BFF helper facade          |
| `src/auth/components`           | auth-only shared UI                        |
| `src/auth/hooks`                | auth-only session/redirect/countdown hooks |
| `src/auth/model`                | auth-wide policy constants/model helpers   |

`useExpiryCountdown` is not tracked as an auth-only migration target because it has non-auth product usage.
`CAMPUS_OPTIONS` lives under `src/auth/flows/signup/model/campus-options.ts` because it is signup/account identity UI data, not auth-wide policy.

### Completed migration ledger

| Removed path                              | New owner path                                                      | Completed phase |
| ----------------------------------------- | ------------------------------------------------------------------- | --------------- |
| `src/api/auth.ts`                         | `src/auth/api/*`                                                    | Phase 1         |
| `@/api/auth` import                       | `@/auth/api` public facade                                          | Phase 1         |
| `src/app/api/auth/_shared.ts`             | `src/auth/bff/auth-*`                                               | Phase 2         |
| `src/app/api/auth/_post-route.ts`         | `src/auth/bff/auth-*`                                               | Phase 2         |
| `src/app/api/auth/_request-guard.ts`      | `src/auth/bff/auth-*`                                               | Phase 2         |
| `src/components/AuthHeader.tsx`           | `src/auth/components/*`                                             | Phase 3         |
| `src/components/auth/*`                   | `src/auth/components/*`                                             | Phase 3         |
| `src/hooks/useCurrentUser.ts`             | `src/auth/hooks/useAuthSession.ts`                                  | Phase 3-1       |
| `src/hooks/useRedirectIfAuthenticated.ts` | `src/auth/hooks/*`                                                  | Phase 3         |
| `src/hooks/useCountdown.ts`               | `src/auth/hooks/useAuthCountdown.ts`                                | Phase 3         |
| `src/constants/auth.ts`                   | `src/auth/model/*`, `src/auth/flows/signup/model/campus-options.ts` | Phase 3         |
| `src/login`                               | `src/auth/flows/login`                                              | Phase 4         |
| `src/signup`                              | `src/auth/flows/signup`                                             | Phase 4         |
| `src/password-reset`                      | `src/auth/flows/password-reset`                                     | Phase 4         |

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
    auth-response.ts
    auth-route-handlers.ts
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

## Auth session vs Main profile ownership

- `useAuthSession`은 `/api/auth/session` 결과를 그대로 계정 identity로 다룬다. 반환 타입은 `AuthenticatedSessionUser | null` 범위이며 `UserProfile`이 아니다.
- `auth`는 Display Identity와 Academic Identity를 signup/account setup 입력 및 account/session response 표시 범위로만 다룬다. 생성·검증의 source-of-truth는 API auth/user identity owner다.
- `UserProfile`, 생활패턴, 자기소개, 기숙사 선택, 시즌 참여 상태는 Main/profile/season read path가 소유한다.
- `/main`은 auth session gate 이후 profile/main bootstrap을 별도로 수행한다. profile이 없거나 실패하면 auth 성공으로 위장하지 않고 Main owner의 fallback/error state를 표시한다.
- `auth/to-user-profile.ts` 같은 compatibility mapper는 두지 않는다. mock/dev profile 변환이 필요하면 profile/main owner 쪽에 둔다.

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

The Phase 4 codebase no longer imports `@/api/auth`, route-local `../_shared`, `../_post-route`, `../_request-guard` helpers, root auth shared paths such as `@/constants/auth`, `@/components/AuthHeader`, `@/components/auth`, `@/hooks/useCurrentUser`, `@/hooks/useRedirectIfAuthenticated`, and `@/hooks/useCountdown`, or root flow paths such as `@/login`, `@/signup`, and `@/password-reset`.
External browser consumers use `@/auth/api`, `@/auth/components`, `@/auth/hooks`, and `@/auth/model` facades as appropriate; App Router auth route adapters use the private `@/auth/bff` facade. `@/auth/hooks`의 session hook은 `SessionResponse.user` 계정 identity만 제공하며 `UserProfile`, 생활패턴, 기숙사, 시즌 참여 상태를 생성하지 않는다.
`@/login`, `@/signup`, and `@/password-reset` are removed compatibility paths. Use the App Router page entrypoints for routes and `@/auth/flows/*` only from auth-owned route adapters/tests/docs.

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
Phase 5 should keep these legacy imports failing architecture guard checks:

- `@/api/auth`
- `@/constants/auth`
- `@/components/AuthHeader`
- `@/components/auth`
- `@/hooks/useCurrentUser`
- `@/hooks/useRedirectIfAuthenticated`
- `@/hooks/useCountdown`
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

| Phase     | Boundary outcome                                                                                           |
| --------- | ---------------------------------------------------------------------------------------------------------- |
| Phase 0   | This README and a passing architecture migration ledger exist. No product behavior changes.                |
| Phase 1   | `src/api/auth.ts` is split into `auth/api/*`; external consumers use `@/auth/api`.                         |
| Phase 2   | `app/api/auth/_*.ts` helper logic moves to `auth/bff/*`; route files stay thin App Router adapters.        |
| Phase 3   | Auth-only root components, hooks, and constants move to `auth/components`, `auth/hooks`, and `auth/model`. |
| Phase 3-1 | Auth session hook returns account identity only; Main/profile bootstrap owns `UserProfile`.                |
| Phase 4   | `login`, `signup`, and `password-reset` implementations move to `auth/flows/*`.                            |
| Phase 5   | Architecture guard switches from migration ledger to strict final import enforcement.                      |
| Phase 6   | Auth UX smoke, accessibility, and security regression tests prove the moved boundary still works.          |
| Phase 7   | Final docs/checkpoint clarify #260 close readiness and follow-up issues.                                   |

## Verification map

Phase 4 focused baseline:

```bash
pnpm --dir apps/web exec vitest run \
  src/auth/__tests__/auth-boundary.imports.test.ts \
  src/app/main/__tests__/main-route-boundary.test.ts

pnpm --dir apps/web exec vitest run \
  src/auth/flows/login \
  src/auth/flows/signup \
  src/auth/flows/password-reset

pnpm --dir apps/web exec vitest run \
  src/app/api/auth/__tests__ \
  src/auth/api \
  src/auth/hooks \
  src/auth/components

pnpm exec prettier --check --ignore-unknown \
  apps/web/src/auth \
  apps/web/src/app/login/page.tsx \
  apps/web/src/app/signup/page.tsx \
  apps/web/src/app/password-reset/page.tsx \
  apps/web/src/api/profile.ts \
  apps/web/src/api/profile-user.mapper.ts \
  apps/web/src/main/hooks/useMainBootstrap.ts \
  .omx/plans/web-auth-boundary-final-refactor-plan.md

pnpm --dir apps/web exec eslint src/auth src/app/api/auth src/app/login/page.tsx src/app/signup/page.tsx src/app/password-reset/page.tsx src/app/main
pnpm web:typecheck
pnpm api:typecheck
git diff --check
```

Later phases should add broader `pnpm web:lint`, `pnpm web:test`, and `pnpm web:build` as UI and flow imports move.
Run Playwright only when route smoke, visible auth route behavior, or browser navigation surfaces are changed.

## Source documents

- `.omx/plans/web-auth-boundary-final-refactor-plan.md`
- `.omx/plans/web-login-page-refactor-plan.md`
- `.omx/plans/web-signup-page-refactor-plan.md`
- `.omx/plans/web-password-reset-page-refactor-plan.md`
- `apps/web/src/auth/api/*`
- `apps/web/src/auth/flows/login/README.md`
- `apps/web/src/auth/flows/signup/README.md`
- `apps/web/src/auth/flows/password-reset/README.md`
- `docs/04_policy/official/account-authentication.md`
- `docs/04_policy/official/access-eligibility.md`
- `docs/04_policy/official/legal-basis.md`

If README guidance and official policy conflict, official policy wins and auth README/tests should be updated in the same change.
