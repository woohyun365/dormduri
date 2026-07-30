# Password reset feature boundary

`apps/web/src/auth/flows/password-reset` owns the public `/password-reset` recovery screen.
It lets a user request a reset code through the Web BFF, verify the code, set a new password, and then hand off to `/login?reset=success`.

## Owned responsibilities

- `/password-reset` page composition through `PasswordResetPageClient`.
- Feature-local flow state, field state, retry-after countdown, verification-code countdown, and route handoff.
- User-visible password-reset copy and status mapping for BFF/client contract results.
- UI components for email entry, verification, new-password entry, completion, progress, service notice, authenticated-session notice, and inline status alerts.
- Mobile/desktop help copy for mailbox/spam-folder checks and desktop layout stability around dynamic verification feedback.
- Guarding the flow from writing verification code, password, or reset state into browser storage or URL history.

## Non-owned responsibilities

- API reset-code issuance, verification, reset token/session invalidation, and provider-side mail delivery.
- Login form state and authenticated redirect handling after the reset-success handoff.
- Account settings password-change flows for an already authenticated user.
- Global auth cookie/session transport and BFF token handling.

## Directory map

| Path                                                   | Responsibility                                                                                                   |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `PasswordResetPageClient.tsx`                          | Connects route/session handoff, flow controller, and the production view.                                        |
| `PasswordResetFlowView.tsx`                            | Production and Storybook composition for steps, status, notices, and layout.                                     |
| `components/PasswordResetLayout.tsx`                   | Login-like page shell, desktop help panel, right-side service notice, stable form card anchor.                   |
| `components/PasswordResetEmailHelpMessage.tsx`         | Shared mailbox/spam-folder help copy used by mobile email step and desktop aside.                                |
| `components/PasswordResetEmailStep.tsx`                | Email input step and mobile mailbox/spam-folder help block.                                                      |
| `components/PasswordResetVerificationStep.tsx`         | Verification-code entry and in-step sent-code notice card.                                                       |
| `components/`                                          | Presentational layout, notices, progress, status alert, and step components.                                     |
| `hooks/usePasswordResetFlow.ts`                        | Owns reset flow side effects, reducer dispatching, route handoff, cooldown coordination, and retry-after status. |
| `hooks/usePasswordResetSessionNotice.ts`               | Optional session probe used only to show a non-blocking authenticated-user notice.                               |
| `hooks/usePasswordResetCooldown.ts`                    | Countdown timer primitive for verification-code TTL and retry-after display.                                     |
| `model/password-reset-flow.*`                          | Feature-local reducer state/action/result contracts.                                                             |
| `model/password-reset-copy.ts`                         | User-facing copy shared by layout and flow status mapping.                                                       |
| `model/password-reset-error.mapper.ts`                 | Retry-after normalization and reset-restart code mapping.                                                        |
| `model/__tests__/password-reset-storage.guard.test.ts` | Self-contained source guard that prevents storage/history writes of reset secrets.                               |
| `__tests__/PasswordReset.test.tsx`                     | Page-level integration regression for the complete flow and layout/copy invariants.                              |

## UX copy and security notes

## Test cleanup map

- `__tests__/PasswordReset.test.tsx`: step 전환, focus, role, field error와 영역 순서는
  회귀 경계로 유지한다. 색상·간격·responsive utility class를 직접 고정한 assertion은
  layout 개선 단계에서 semantic locator 또는 viewport smoke로 교체한다.
- `components/__tests__/PasswordResetNewPasswordStep.test.tsx`: password field label,
  autocomplete, validation과 submit contract만 소유하며 시각 token snapshot은 추가하지 않는다.
- `hooks/__tests__/usePasswordResetCooldown.test.tsx`: countdown의 시간 의미만 소유하고
  timer 표현 class는 검증하지 않는다.
- `model/__tests__/password-reset-flow.reducer.test.ts`: state transition만 소유한다.
- `model/__tests__/password-reset-storage.guard.test.ts`: code, password, grant의 browser
  storage·history 기록 금지를 검사하는 source boundary이므로 유지한다.
- `stories/password-reset/*.stories.tsx`: production `PasswordResetFlowView`를 사용하고
  interaction은 role·label·사용자 문구를 기준으로 검증한다.

- Password reset request/verify APIs remain neutral and must not reveal whether the account exists.
- The screen also avoids raw account-existence wording in the main success path.
  After code request, the verification step shows an in-step `인증 코드 안내` status card with `발송 완료: {email}` so the user can confirm which address they entered without treating the card as account existence proof.
- The mobile email step and desktop aside share `PasswordResetEmailHelpMessage`.
  Current copy highlights `주소와 스팸함` so the user knows what to check without adding a separate bottom help card.
- The previous standalone code TTL explainer is intentionally absent from the verification step.
  Cooldown and retry-after behavior still belongs to the hook/status logic, while the step keeps the form compact on mobile.
- The form card is top-anchored.
  Feedback such as authenticated-session notice or retry-after alert grows below the active form instead of pushing the title/header area.

## Intentional deviations

- `PasswordResetSkeleton.tsx` is not present because `/password-reset` currently has no loading or Suspense surface.
  Add it only if the route gains a real loading state.
- Step-specific component tests are added only where component-local branches need direct coverage.
  The broad page integration test remains the main regression guard for email, verification, reset, status, and login handoff behavior.
- Legacy compatibility files such as `PasswordReset.tsx` or `Step*` wrappers are intentionally absent.
  Do not reintroduce them unless an external route/import still depends on them.
- Do not add a duplicate bottom `인증 코드 안내` section outside the verification step.
  The sent-code notice is owned by `PasswordResetVerificationStep`.

## Tailwind v4 class rule

Password reset follows the auth root Tailwind v4 canonical class rule.
Use CSS variable shorthand such as `text-(--knu-text-secondary)` and scale spacing such as `lg:mt-32` when possible.
Keep bracket syntax only for real arbitrary values such as `min-h-[calc(...)]` and `lg:grid-cols-[...]`.

## Verification map

- BFF/client route contract: `src/app/api/auth/__tests__/password-reset-route.test.ts`, `src/auth/api/__tests__/auth-api.client.test.ts`.
- Page flow and route handoff: `src/auth/flows/password-reset/__tests__/PasswordReset.test.tsx`.
- New password form branches: `src/auth/flows/password-reset/components/__tests__/PasswordResetNewPasswordStep.test.tsx`.
- Reducer invariants: `src/auth/flows/password-reset/model/__tests__/password-reset-flow.reducer.test.ts`.
- Storage/history privacy guard: `src/auth/flows/password-reset/model/__tests__/password-reset-storage.guard.test.ts`.
- Metadata/sitemap: `src/app/__tests__/metadata.test.ts`.

Full-stack reset completion E2E is intentionally not part of this feature-local gate because it requires a reset-code fixture or mail provider stub.
Use the focused BFF/client contract and page integration tests as the local regression evidence until that fixture exists.
