# Web Auth Boundary

`apps/web/src/auth`는 Web 클라이언트의 auth feature boundary다.
로그인, 회원가입, 비밀번호 재설정, auth API client, auth BFF helper, auth 전용 UI/hook/model을 소유한다.
API/NestJS auth domain, DB/session/token/SES/Redis/BackOffice 구현은 이 경계의 소유 범위가 아니다.

Migration history는 commit과 `.omx/plans/web-auth-boundary-final-refactor-plan.md`에 남긴다.
이 README는 새 작업자가 따라야 할 **최종 auth Web boundary contract**만 설명한다.

## Final directory contract

```text
apps/web/src/auth/
  README.md
  api/                 # browser-side auth API facade
  bff/                 # App Router auth BFF helper facade
  components/          # auth-only shared UI
  hooks/               # auth-only session/redirect/countdown hooks
  model/               # auth-wide policy constants/model helpers
  flows/
    login/             # login flow implementation
    signup/            # signup flow implementation
    password-reset/    # password reset flow implementation
```

내부 파일명은 리팩터링 과정에서 바뀔 수 있다.
안정적으로 지켜야 하는 것은 `auth/api`, `auth/bff`, `auth/components`, `auth/hooks`, `auth/model`, `auth/flows/*`의 소유권과 import boundary다.

`useExpiryCountdown`은 auth 외부 product usage가 있어 auth-only migration target으로 취급하지 않는다.
`CAMPUS_OPTIONS`는 signup/account identity UI data이므로 `src/auth/flows/signup/model/campus-options.ts`에 둔다.

## Ownership

- `auth`는 Web auth UI와 account identity/session gate를 소유한다.
- `useAuthSession`은 `/api/auth/session` 결과를 그대로 계정 identity로 다룬다. 반환 타입은 `AuthenticatedSessionUser | null` 범위이며 `UserProfile`이 아니다.
- session 확인이 지연되거나 실패하면 auth 화면이 skeleton에 무한 대기하지 않도록 bounded timeout 후 unauthenticated state로 수렴한다.
- `auth`는 Display Identity와 Academic Identity를 signup/account setup 입력 및 account/session response 표시 범위로만 다룬다. 생성·검증의 source-of-truth는 API auth/user identity owner다.
- `UserProfile`, 생활패턴, 자기소개, 기숙사 선택, 시즌 참여 상태는 Main/profile/season read path가 소유한다.
- `/main`은 auth session gate 이후 profile/main bootstrap을 별도로 수행한다. profile이 없거나 실패하면 auth 성공으로 위장하지 않고 Main owner의 fallback/error state를 표시한다.
- `auth/to-user-profile.ts` 같은 compatibility mapper는 두지 않는다. mock/dev profile 변환이 필요하면 profile/main owner 쪽에 둔다.

## Public/private import rule

External Web features should consume auth through a small public facade:

- `@/auth/api` for browser-side auth client calls such as login, logout, session, signup, and reset.
- `@/auth/components`, `@/auth/hooks`, `@/auth/model` only for explicitly exported auth-wide UI/hook/model helpers.
- `@/auth` only if a broader facade becomes necessary.

Private implementation areas should not be deep-imported by non-auth features:

- `@/auth/bff/*`
- `@/auth/flows/*/components/*`
- `@/auth/flows/*/hooks/*`
- `@/auth/flows/*/model/*`
- `@/auth/components/*` except through an auth-owned facade if one is added.

External browser consumers use public facades instead of deep private paths.
App Router auth route adapters are the only non-auth files allowed to import the private `@/auth/bff` facade.
App Router page adapters may import their single route client entrypoint under `@/auth/flows/*/*PageClient`.

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

Route handlers must preserve upstream status, `Retry-After`, cookie mutation, and token-like response redaction.

## Blocked compatibility surfaces

The final auth boundary does not keep compatibility re-export files only to preserve old import paths.
Architecture guard keeps these paths/imports blocked:

| Blocked surface                           | Replacement / owner                                                 |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `src/api/auth.ts`, `@/api/auth`           | `src/auth/api/*`, `@/auth/api`                                      |
| `src/app/api/auth/_shared.ts`             | `src/auth/bff/*`                                                    |
| `src/app/api/auth/_post-route.ts`         | `src/auth/bff/*`                                                    |
| `src/app/api/auth/_request-guard.ts`      | `src/auth/bff/*`                                                    |
| `src/components/AuthHeader.tsx`           | `src/auth/components/*`                                             |
| `src/components/auth/*`                   | `src/auth/components/*`                                             |
| `src/hooks/useCurrentUser.ts`             | `src/auth/hooks/useAuthSession.ts`                                  |
| `src/hooks/useRedirectIfAuthenticated.ts` | `src/auth/hooks/*`                                                  |
| `src/hooks/useCountdown.ts`               | `src/auth/hooks/useAuthCountdown.ts`                                |
| `src/constants/auth.ts`                   | `src/auth/model/*`, `src/auth/flows/signup/model/campus-options.ts` |
| `src/login`, `@/login`                    | `src/auth/flows/login` + `app/login/page.tsx`                       |
| `src/signup`, `@/signup`                  | `src/auth/flows/signup` + `app/signup/page.tsx`                     |
| `src/password-reset`, `@/password-reset`  | `src/auth/flows/password-reset` + `app/password-reset/page.tsx`     |
| `src/auth/to-user-profile.ts`             | Main/profile owner mock/dev profile mapping if needed               |
| `src/auth/hooks/useCurrentUser.ts`        | `src/auth/hooks/useAuthSession.ts` account identity only            |

If an external feature still needs auth behavior, expose that behavior through the auth public facade instead of adding a compatibility wrapper.

## Security and accessibility invariants

- Browser-visible state must not store access tokens, renewal tokens, verification codes, reset passwords, or reset secrets in local/session storage or URL history.
- BFF responses must redact token-like fields from JSON bodies and use httpOnly cookie transport for session materialization.
- Password reset code request and verification copy must avoid account enumeration.
- Signup payloads must not include lifestyle/profile fields owned by season profile flows.
- Redirect helpers must allow internal safe targets only.
- Auth forms and status messages should be tested through accessible role/name/text queries.
- Error/status UI should expose user-friendly copy and not raw upstream stack or provider messages.

## Verification map

Focused architecture and route boundary guard:

```bash
pnpm --dir apps/web exec vitest run \
  src/auth/__tests__/auth-boundary.imports.test.ts \
  src/app/main/__tests__/main-route-boundary.test.ts
```

Auth regression suites:

```bash
pnpm --dir apps/web exec vitest run \
  src/app/api/auth/__tests__ \
  src/auth/api \
  src/auth/hooks \
  src/auth/components \
  src/auth/flows/login \
  src/auth/flows/signup \
  src/auth/flows/password-reset
```

Web-only auth smoke:

```bash
pnpm --dir apps/web exec playwright test -c playwright.config.ts e2e/smoke.spec.ts
```

This smoke keeps `/login`, `/signup`, `/password-reset`, and unauthenticated `/main` redirect visible without requiring a live API/DB.
Full API-backed signup/reset journeys belong to a separate full-stack E2E lane.

Broader verification when auth boundary or route behavior changes:

```bash
pnpm --dir apps/web exec eslint src/auth src/app/api/auth src/app/login/page.tsx src/app/signup/page.tsx src/app/password-reset/page.tsx src/app/main
pnpm web:typecheck
pnpm api:typecheck
git diff --check
```

## Close readiness and follow-ups

#260 can be considered close-ready when these final boundary checks pass:

- root auth API/component/hook/constant/flow compatibility surfaces are absent.
- non-auth code cannot deep-import private auth BFF or flow internals.
- App Router entries stay thin and are the only allowed framework exceptions.
- auth session hook returns account identity only and does not synthesize Main/profile/season view models.
- Web-only smoke proves public auth route shells and unauthenticated `/main` redirect.
- BFF/security regression proves token-like redaction, cookie transport, `Retry-After`, and sensitive storage invariants.

Remaining follow-up candidates are explicitly outside this boundary cleanup:

- full API-backed signup/reset E2E with mail code seam and DB seed.
- `profileApi.getMyProfile()` non-development real endpoint implementation.
- broader visual/manual QA for auth pages.

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
