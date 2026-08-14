# Password reset feature boundary

`apps/web/src/auth/flows/password-reset` owns the public `/password-reset` recovery flow.
The browser requests a neutral reset email, verifies the code, submits a new password with the
HttpOnly reset grant, and then hands the user off to `/login?reset=success`.

## Owned responsibilities

- Two-step school-email verification → new-password state and the separate result state. Email
  entry, code verification, and user-confirmed verified state remain explicit internal states inside
  the first user-facing step.
- Abortable browser requests, code/grant expiry handling, retry-after feedback, and route handoff.
- Password-reset-specific copy, field validation feedback, focus movement, and live status.
- Signup-aligned desktop support rail and mobile full-bleed step sheet.
- Storybook scenarios and guards that keep codes, passwords, and grants out of browser storage.

## Non-owned responsibilities

- API reset-code issuance, mail delivery, limited-grant authorization, password mutation, and
  session invalidation.
- Login state after the reset-success handoff.
- Authenticated account-settings password changes.
- Global cookie/session transport and BFF grant-cookie handling.

## Directory map

| Path                                              | Responsibility                                                                          |
| ------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `PasswordResetPageClient.tsx`                     | Applies the shared session gate, then connects the flow controller and production view. |
| `../../components/AuthSessionTransition.tsx`      | Shared Login/Password Reset checking and authenticated-main-redirect surface.           |
| `PasswordResetFlowView.tsx`                       | Shared production/Storybook composition for steps and feedback.                         |
| `components/PasswordResetLayout.tsx`              | Responsive auth frame and form/feedback ownership.                                      |
| `components/PasswordResetSupportPanel.tsx`        | Desktop sticky support rail and step ledger.                                            |
| `components/PasswordResetStepFrame.tsx`           | Mobile full-bleed and tablet/desktop card boundary.                                     |
| `components/PasswordReset*Step.tsx`               | Step-local form fields, validation, and actions.                                        |
| `../../components/feedback/AuthFeedbackStrip.tsx` | Shared auth feedback presentation primitive.                                            |
| `components/PasswordResetStatusAlert.tsx`         | Password-reset copy, countdown, focus, and restart-action adapter.                      |
| `hooks/usePasswordResetFlow.ts`                   | Discriminated state orchestration, cancellation, TTL, and routing.                      |
| `hooks/usePasswordResetCooldown.ts`               | Shared countdown adapter for code expiry and retry-after.                               |
| `model/password-reset-flow.*`                     | Feature-local state/action/result contracts and reducer.                                |
| `model/password-reset-copy.ts`                    | Password-reset-owned page, action, status, and accessibility copy.                      |
| `model/password-reset-error.mapper.ts`            | Retry-after and restart-required mapping.                                               |

## UX and security invariants

- Reset request/verify responses remain account-existence neutral.
- Session checking completes before the recovery form is exposed. An authenticated session is
  redirected to `/main`; only unauthenticated and recoverable session-unavailable states may enter
  the public reset flow.
- Session-unavailable never implies logout. It keeps password reset available with an explicit
  session retry action.
- A successful request moves directly to verification without an artificial transition delay.
- The verification screen identifies the requested address without claiming mail delivery.
- The code lifetime follows the shared auth policy; verified-grant lifetime prefers the server
  response and uses the shared policy value only as a compatibility fallback.
- Leaving a step or unmounting the flow aborts the active request. A late response cannot advance
  a previous state.
- New-password state cannot navigate back to a code that has already been consumed.
- Field errors render at their field; non-field status renders once below the step heading, matching
  the login feedback scan order. Newly rendered status moves keyboard focus and the viewport to its
  heading so mobile users do not miss feedback outside the current viewport.
- Step 1 retry-after keeps the action label stable, disables the action, and renders the remaining
  time in the compact warning. Network failures keep the current input and action available for
  immediate retry.
- Five invalid verification attempts consume the server-side code. The current browser flow mirrors
  that policy by blocking the code input and verify action while keeping code resend available.
- Verification code, password, grant, and reducer state are never persisted to storage or history.

## Storybook structure

`Auth/Password Reset` is ordered as:

1. `Step 1 School Email Verification/Request`
2. `Step 1 School Email Verification/Code`
3. `Step 2 New Password`
4. `Result`
5. `Session`

Step and result scenarios render `PasswordResetFlowView`; Session Checking and Authenticated
Redirect reuse the same `AuthSessionTransition` rendered by Login and the production route.
Each request-bearing state includes its user-visible network recovery state.
The Code scenarios include the verified state. Like Signup, verification success stays in Step 1
until the user selects `다음 단계`; Step 2 then shows the shared verified-school-email card.

## Verification map

- BFF/client contract: `src/app/api/auth/__tests__/password-reset-route.test.ts`,
  `src/auth/api/__tests__/auth-api.client.test.ts`
- Page flow, cancellation, focus, and feedback: `src/auth/flows/password-reset/__tests__/PasswordReset.test.tsx`
- New-password field behavior: `components/__tests__/PasswordResetNewPasswordStep.test.tsx`
- State invariants: `model/__tests__/password-reset-flow.reducer.test.ts`
- Storage/history boundary: `model/__tests__/password-reset-storage.guard.test.ts`
- Story composition: `src/auth/stories/password-reset/*.stories.tsx`

Full-stack reset completion E2E still requires a reset-code fixture or mail-provider stub. Until
that exists, focused BFF/client tests and the page integration suite are the local regression gate.

## Tailwind v4 rule

Use canonical Tailwind v4 classes and CSS variable shorthand such as
`text-(--knu-text-secondary)`. Keep bracket syntax only for real arbitrary values such as
`min-h-[calc(...)]` and custom grid tracks.
