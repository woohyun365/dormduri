# Web login

`apps/web/src/auth/flows/login`은 공개 로그인 화면의 form state, 입력 검증, BFF login 호출, 로그인 후 `/main` handoff를 소유한다.
세션 authority와 token family 정책은 API/Auth domain이 소유하고, Web login은 browser-visible state에 token 값을 저장하지 않는다.

## 제품 책임

- 강원대학교 이메일로 가입한 사용자가 이메일/비밀번호로 로그인할 수 있게 한다.
- invalid credential, lockout, throttle, network/server failure를 사용자에게 안전한 문구로 안내한다.
- `로그인 유지(최대 7일)` 선택 시 Web BFF cookie transport가 7일 session/token family baseline을 따르도록 request flag를 전달한다.
- 로그인 성공 직후 `/main` 이동 중 상태를 표시하고, route 전환 전 중복 submit과 입력 변경을 막는다.
- 이미 로그인된 사용자가 `/login`에 접근하면 접근 가능한 loading/skeleton을 보여준 뒤 홈으로 이동한다.

## Non-owner boundary

Login은 아래 정책과 데이터를 직접 소유하지 않는다.

- API auth session authority, lockout policy, renewal token rotation, all-session revoke
- `auth-token`, `auth-renewal-token` cookie serialization helper와 upstream token response allowlist
- 회원가입, 비밀번호 재설정, 비밀번호 변경, 메인 홈 dashboard/product state
- 계정 삭제/retention/blocked 상태의 상세 노출 정책

위 항목은 API auth policy, Web BFF shared auth helper, signup/password-reset/main feature owner가 담당한다.
Login 화면은 fail-closed 결과를 일반 사용자 문구로만 표시한다.

## Current flow

1. `app/login/page.tsx` — route metadata, Suspense boundary, server route shell.
2. `LoginPageClient.tsx` — authenticated redirect gate, safe redirect target, router handoff, layout/form composition.
3. `hooks/useLoginForm.ts` — form state, validation, login submit orchestration, lockout/throttle countdown, redirect pending state.
4. `model/*` — field validation, API result → UI state mapping, safe redirect target normalization.
5. `components/*` — presentational layout/form/alert/secondary action/skeleton UI.

## API/BFF contract

| Surface                                    | Responsibility                                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `apps/web/src/auth/api/*`                  | Web auth client wrapper. 429 `Retry-After`/`retryAfterSeconds`, non-JSON, safe BFF error를 UI가 처리 가능한 shape로 보존 |
| `app/api/auth/login/route.ts`              | login body schema parse, upstream `/auth/login` forward, token response allowlist, auth cookie set                       |
| `app/api/auth/session/route.ts`            | access cookie 실패 시 renewal cookie로 `/auth/renew-session` 후 session 재조회                                           |
| `apps/web/src/auth/bff/*`                  | auth cookie serialize/delete, upstream token body redaction boundary                                                     |
| `auth/hooks/useRedirectIfAuthenticated.ts` | `/api/auth/session` BFF 결과로 `/login` 접근자가 이미 인증된 경우 redirect gate 제공                                     |
| `hooks/useLoginRedirectTarget.ts`          | `next` query를 `/main` allowlist로 normalize                                                                             |

Web login은 upstream access/renewal token을 React state, URL, log, response body에 노출하지 않는다.
BFF route가 httpOnly cookie로만 browser session transport를 materialize한다.

## Directory responsibility

현재 구조는 Phase 4 점검 기준으로 권장 구조와 일치한다.
`app/login/page.tsx`는 route shell만 소유하고, `apps/web/src/auth/flows/login` 아래의 root client/hook/model/component 경계도 signup benchmark와 같은 책임 단위를 유지한다.
따라서 Phase 4에서는 추가 nested move나 대규모 rename을 하지 않는다.
`LoginLayout`은 desktop에서 `AuthHeader` container 폭을 main grid와 같은 `max-w-5xl px-5 lg:px-8`로 맞춰 header 로고 좌측과 aside 좌측이 같은 기준선을 사용하게 한다.
독립 운영 서비스 고지는 오른쪽 title/header 영역이 소유하고, 왼쪽 aside는 로그인 도움말만 소유한다.
Desktop aside는 `lg:mt-8` offset으로 오른쪽 form title rhythm에 맞춘다.

| Directory / file                                                              | Responsibility                                                                                |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `app/login/page.tsx`                                                          | route metadata, Suspense fallback, `LoginPageClient` composition only                         |
| `LoginPageClient.tsx`                                                         | auth redirect gate, router callback, login layout/form wiring                                 |
| `components/LoginLayout.tsx`                                                  | mobile/desktop layout, help panel, right-side independent-service notice, PC header alignment |
| `components/LoginForm.tsx`                                                    | controlled presentational form. API/router를 호출하지 않음                                    |
| `components/LoginStatusAlert.tsx`                                             | invalid/locked/throttled/network/server alert rendering                                       |
| `components/LoginRememberMeHint.tsx`                                          | rememberMe helper copy                                                                        |
| `components/LoginAuthenticatedSkeleton.tsx`                                   | session check/redirect pending accessible skeleton                                            |
| `components/LoginSecondaryActions.tsx`                                        | password reset, signup, terms/privacy navigation actions                                      |
| `hooks/useLoginForm.ts`                                                       | submit orchestration, validation, countdown, redirect state                                   |
| `hooks/useLoginRedirectTarget.ts`                                             | safe `/main` redirect target helper                                                           |
| `model/login-form.*`                                                          | form values, field errors, validation types                                                   |
| `model/login-result.mapper.ts`                                                | BFF/API result to UI status/copy/countdown state                                              |
| `model/login-redirect-target.ts`                                              | pure redirect allowlist helper                                                                |
| `__tests__/`, `components/__tests__/`, `hooks/__tests__/`, `model/__tests__/` | shell/component/hook/model regression                                                         |

## Tailwind v4 class rule

Login 범위는 auth root README의 Tailwind v4 canonical class rule을 따른다.
CSS variable shorthand가 가능한 값은 `text-(--knu-text-primary)`처럼 작성하고, `min-h-[calc(...)]`, `lg:grid-cols-[...]`처럼 실제 arbitrary value가 필요한 값만 bracket syntax를 유지한다.
Mobile에서 `자세히 보기`가 두 줄로 쪼개지지 않도록 서비스 고지 링크는 `inline-block whitespace-nowrap`을 유지한다.

## Test interaction rule

- Browser-visible full flow는 `LoginPageClient.test.tsx`와 Playwright smoke에서 검증한다.
- `LoginForm.test.tsx`는 controlled presentational component의 prop callback contract를 좁게 검증하므로 full typing flow보다 direct change event가 더 안정적이다.
- fake timer/countdown이 있는 hook/page path는 timer 안정성을 우선한다.
- 단순 button action처럼 실제 interaction에 가까운 검증이 안전한 경우 `userEvent`를 사용한다.

## Verification map

```bash
pnpm --dir apps/web exec vitest run src/auth/flows/login src/auth/hooks/__tests__/useRedirectIfAuthenticated.test.ts
pnpm --dir apps/web exec vitest run src/app/api/auth/__tests__/login-route.test.ts src/auth/api/__tests__/auth-api.client.test.ts
pnpm --dir apps/api exec vitest run --config ./vitest.config.unit.ts --maxWorkers=50% src/architecture
pnpm web:typecheck
pnpm --dir apps/web exec eslint src/app/login/page.tsx src/auth/hooks/useAuthSession.ts src/auth/hooks/useRedirectIfAuthenticated.ts src/auth/flows/login src/app/main/__tests__/MainRouteShell.test.tsx src/proxy.test.ts e2e/smoke.spec.ts e2e/main-home.fullstack.spec.ts
pnpm api:typecheck
pnpm exec prettier --check --ignore-unknown apps/web/src/app/login/page.tsx apps/web/src/auth/hooks/useAuthSession.ts apps/web/src/auth/flows/login apps/web/e2e docs/04_policy/official/production-deployment-readiness.md .omx/plans/web-login-page-refactor-plan.md
pnpm --dir apps/web exec playwright test e2e/smoke.spec.ts --project=desktop-chromium
git diff --check
```

Full-stack login UI locator를 바꾸면 아래 smoke를 추가 실행한다.

```bash
pnpm --dir apps/web exec playwright test -c playwright.fullstack.config.ts e2e/main-home.fullstack.spec.ts --project=desktop-chromium --grep "로그인 UI 입력"
```

## Operational notes

- Full-stack Playwright/dev server 실행 후 `apps/web/next-env.d.ts`가 `.next/dev/types` 경로로 drift될 수 있다. 생성 파일 drift는 commit하지 말고 revert한다.
- Web-only smoke는 public route와 unauthenticated `/main -> /login` redirect를 API/DB 없이 확인한다.
- Full-stack smoke는 DB/API/Web을 함께 띄워 실제 `/login` UI 입력 → BFF cookie → `/main` handoff를 확인한다.

## Source of truth

| 주제                                            | Source                                                       |
| ----------------------------------------------- | ------------------------------------------------------------ |
| Auth/session policy                             | `docs/04_policy/official/account-authentication.md`          |
| Production deployment/session transport wording | `docs/04_policy/official/production-deployment-readiness.md` |
| Web auth client/BFF helper                      | `apps/web/src/auth/api/*`, `apps/web/src/auth/bff/*`         |
| Login refactor plan                             | `.omx/plans/web-login-page-refactor-plan.md`                 |
| Signup structure benchmark                      | `apps/web/src/auth/flows/signup/README.md`                   |

정책 문서와 화면 문구가 충돌하면 정책 문서를 우선하고 login copy/test를 갱신한다.
