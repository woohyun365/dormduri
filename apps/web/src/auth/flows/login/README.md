# Web login

`apps/web/src/auth/flows/login`은 공개 로그인 화면의 form state, 입력 검증, BFF login 호출, 로그인 후 `/main` handoff를 소유한다.
세션 authority와 token family 정책은 API/Auth domain이 소유하고, Web login은 browser-visible state에 token 값을 저장하지 않는다.

## 제품 책임

- 강원대학교 이메일로 가입한 사용자가 이메일/비밀번호로 로그인할 수 있게 한다.
- invalid credential, lockout, throttle, network/server failure를 사용자에게 안전한 문구로 안내한다.
- `로그인 유지(최대 7일)`는 renewal cookie를 브라우저 종료 후에도 유지할지 선택한다. 미체크 세션도 열린 브라우저에서는 access 만료 후 renewal로 복구된다.
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
2. `LoginPageClient.tsx` — authenticated redirect gate, safe redirect target, router handoff, controller/view wiring.
3. `LoginFlowView.tsx` — production과 Storybook이 공유하는 layout/form composition.
4. `hooks/useLoginForm.ts` — form state, validation, login submit orchestration, lockout/throttle countdown, redirect pending state.
5. `model/*` — field validation, API result → UI state mapping, safe redirect target normalization.
6. `components/*` — presentational layout/form/alert/secondary action/skeleton UI.

## API/BFF contract

| Surface                                    | Responsibility                                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `apps/web/src/auth/api/*`                  | Web auth client wrapper. 429 `Retry-After`/`retryAfterSeconds`, non-JSON, safe BFF error를 UI가 처리 가능한 shape로 보존 |
| `app/api/auth/login/route.ts`              | login body schema parse, upstream `/auth/login` forward, token response allowlist, auth cookie set                       |
| `app/api/auth/session/resolve/route.ts`    | 명시적 POST bootstrap에서 access 검증, 필요 시 renewal, browser tri-state 응답을 조합                                    |
| `apps/web/src/auth/bff/*`                  | auth cookie serialize/delete, upstream token body redaction boundary                                                     |
| `auth/hooks/useRedirectIfAuthenticated.ts` | browser session tri-state로 authenticated redirect와 unavailable nonblocking flow를 분리                                 |
| `hooks/useLoginRedirectTarget.ts`          | `next` query를 `/main` allowlist로 normalize                                                                             |

Web login은 upstream access/renewal token을 React state, URL, log, response body에 노출하지 않는다.
BFF route가 httpOnly cookie로만 browser session transport를 materialize한다.

## Directory responsibility

현재 구조는 Login/session 개선 Phase 6 기준으로 controller와 controlled view를 분리한다.
`app/login/page.tsx`는 route shell만 소유하고, `apps/web/src/auth/flows/login` 아래의 root client/hook/model/component 경계도 signup benchmark와 같은 책임 단위를 유지한다.
`LoginPageClient`는 session/router/form orchestration만, `LoginFlowView`는 production과 Storybook이 공유하는 상태별 composition만 담당한다.
`LoginLayout`은 desktop에서 `AuthResponsiveFrame` rail variant를 사용하며, header와 본문을 `max-w-5xl` 기준선에 맞춘다.
왼쪽 안내 rail은 짧은 세로 viewport에서도 우측 form과 함께 밀리지 않도록 sticky로 두고, 오른쪽 title과 같은 상단 기준선에서 시작한다.
Header의 KNU 로고를 form에 반복하지 않으며 독립 운영 고지는 desktop rail과 mobile title 아래에서 각각 한 번만 보이게 한다.

| Directory / file                                                              | Responsibility                                                                    |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `app/login/page.tsx`                                                          | route metadata, Suspense fallback, `LoginPageClient` composition only             |
| `LoginPageClient.tsx`                                                         | auth redirect gate, router callback, login layout/form wiring                     |
| `LoginFlowView.tsx`                                                           | production과 Storybook이 공유하는 controlled presentational composition           |
| `components/LoginLayout.tsx`                                                  | mobile/desktop layout, sticky assurance rail, service notice, PC header alignment |
| `components/LoginForm.tsx`                                                    | controlled presentational form. API/router를 호출하지 않음                        |
| `components/LoginStatusAlert.tsx`                                             | invalid/locked/throttled/network/server alert rendering                           |
| `../../components/feedback/AuthFeedbackStrip.tsx`                             | 인증 flow가 공유하는 compact feedback primitive                                   |
| `components/LoginSessionUnavailableStatus.tsx`                                | session dependency 지연과 login 가능 상태를 함께 안내                             |
| `auth/components/AuthSessionTransition.tsx`                                   | Login과 Password Reset의 session check·authenticated redirect 공통 status surface |
| `components/LoginSecondaryActions.tsx`                                        | password reset, signup, terms/privacy navigation actions                          |
| `hooks/useLoginForm.ts`                                                       | submit orchestration, validation, countdown, redirect state                       |
| `hooks/useLoginRedirectTarget.ts`                                             | safe `/main` redirect target helper                                               |
| `model/login-form.*`                                                          | form values, field errors, validation types                                       |
| `model/login-feedback.copy.ts`                                                | login 전용 결과·경고·session 안내 문구의 단일 presentation owner                  |
| `model/login-result.mapper.ts`                                                | BFF/API result to UI status/copy/countdown state                                  |
| `model/login-redirect-target.ts`                                              | pure redirect allowlist helper                                                    |
| `__tests__/`, `components/__tests__/`, `hooks/__tests__/`, `model/__tests__/` | shell/component/hook/model regression                                             |

## Tailwind v4 class rule

Login 범위는 auth root README의 Tailwind v4 canonical class rule을 따른다.
CSS variable shorthand가 가능한 값은 `text-(--knu-text-primary)`처럼 작성하고, `min-h-[calc(...)]`, `lg:grid-cols-[...]`처럼 실제 arbitrary value가 필요한 값만 bracket syntax를 유지한다.

Known login 상태의 사용자 문구는 API `error` 문자열을 그대로 렌더링하지 않는다. API는 상태 code와
`remainingSeconds`/`retryAfterSeconds`를 전달하고, Web은 `login-feedback.copy.ts`에서 일관된 문구를
결정한다. 이를 통해 API fallback 문구와 Storybook fixture가 화면 문구의 별도 source of truth가 되지
않게 한다.
Mobile에서 `자세히 보기`가 두 줄로 쪼개지지 않도록 서비스 고지 링크는 `inline-block whitespace-nowrap`을 유지한다.
Login form은 320px에서 `-mx-5 border-y p-5` full-bleed sheet를 사용하고 `sm:`부터 rounded card와 shadow를 복원한다.

## Test interaction rule

- Browser-visible full flow는 `LoginPageClient.test.tsx`와 Playwright smoke에서 검증한다.
- `LoginForm.test.tsx`는 controlled presentational component의 prop callback contract를 좁게 검증하므로 full typing flow보다 direct change event가 더 안정적이다.
- fake timer/countdown이 있는 hook/page path는 timer 안정성을 우선한다.
- 단순 button action처럼 실제 interaction에 가까운 검증이 안전한 경우 `userEvent`를 사용한다.

## Verification map

```bash
pnpm --dir apps/web exec vitest run src/auth/flows/login src/auth/hooks/__tests__/useRedirectIfAuthenticated.test.ts
pnpm --dir apps/web exec vitest run src/app/api/auth/__tests__/login-route.test.ts src/auth/api/__tests__/auth-api.client.test.ts
pnpm --dir apps/web typecheck:product
pnpm --dir apps/web typecheck:test
pnpm --dir apps/web typecheck:storybook
pnpm --dir apps/web storybook:build
pnpm --dir apps/api exec vitest run --config ./vitest.config.unit.ts --maxWorkers=50% src/architecture
pnpm --dir apps/web exec eslint src/app/login/page.tsx src/auth/hooks/useAuthSession.ts src/auth/hooks/useRedirectIfAuthenticated.ts src/auth/flows/login src/app/main/__tests__/MainRouteShell.test.tsx src/proxy.test.ts e2e/smoke.spec.ts e2e/main-home.fullstack.spec.ts
pnpm api:typecheck
pnpm exec prettier --check --ignore-unknown apps/web/src/app/login/page.tsx apps/web/src/auth/hooks/useAuthSession.ts apps/web/src/auth/flows/login apps/web/e2e docs/policies/production-runtime-safety.md .omx/plans/web-login-page-refactor-plan.md
pnpm --dir apps/web exec playwright test e2e/smoke.spec.ts --project=desktop-chromium
git diff --check
```

## Storybook

Storybook은 별도 controller를 만들지 않고 production `LoginFlowView`에 controlled state만 주입한다.

```text
Auth/Login/
  Entry/
    Ready
    Remember Me
    Authenticated Redirect
    Session Unavailable
  Validation/
    Empty Email
    Empty Password
    Invalid Email
  Submission/
    Pending
    Redirecting
  Result/
    Invalid Credentials
    Locked
    Throttled
    Network Error
    Server Unavailable
    Reset Complete
```

Result story의 문구는 `login-result.mapper.ts`, validation story는 `login-form.validation.ts` 결과를 사용해 production copy와 독립적으로 drift하지 않게 한다.

Full-stack login UI locator를 바꾸면 아래 smoke를 추가 실행한다.

```bash
pnpm --dir apps/web exec playwright test -c playwright.fullstack.config.ts e2e/main-home.fullstack.spec.ts --project=desktop-chromium --grep "로그인 UI 입력"
```

## Operational notes

- Full-stack Playwright/dev server 실행 후 `apps/web/next-env.d.ts`가 `.next/dev/types` 경로로 drift될 수 있다. 생성 파일 drift는 commit하지 말고 revert한다.
- Web-only smoke는 public route와 unauthenticated `/main -> /login` redirect를 API/DB 없이 확인한다.
- Full-stack smoke는 DB/API/Web을 함께 띄워 실제 `/login` UI 입력 → BFF cookie → `/main` handoff를 확인한다.
- `auth-session.fullstack.spec.ts`는 remember-off access 만료 후 renewal rotation과 logout 후 unauthenticated 수렴을 검증한다.
- Browser 종료 시 session cookie 제거 자체는 jsdom/unit test로 재현하지 않는다. 자동화 테스트는 `Max-Age` 부재와 access 만료 후 renewal 복구를 검증하고, 실제 종료 동작은 browser smoke에서 확인한다.
- 여러 tab이 같은 renewal token을 동시에 사용하면 한 요청만 cookie를 회전한다. 나머지는 stale 응답에서 cookie를 유지하고 browser session resolve를 한 번 재시도한다.
- API 관측은 login outcome, real/dummy password verify p95·in-flight, renewal outcome만 low-cardinality metric으로 남기며 운영 절차는 `infra/runbooks/incidents/auth-session.md`를 따른다.

## Source of truth

| 주제                                            | Source                                                        |
| ----------------------------------------------- | ------------------------------------------------------------- |
| Auth/session policy                             | `docs/policies/account-authentication.md`                     |
| Production deployment/session transport wording | `docs/policies/production-runtime-safety.md`                  |
| Web auth client/BFF helper                      | `apps/web/src/auth/api/*`, `apps/web/src/auth/bff/*`          |
| Login/session architecture plan                 | `.omx/plans/login-session-policy-design-architecture-plan.md` |
| Signup structure benchmark                      | `apps/web/src/auth/flows/signup/README.md`                    |

정책 문서와 화면 문구가 충돌하면 정책 문서를 우선하고 login copy/test를 갱신한다.
