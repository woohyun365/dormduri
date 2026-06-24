# Password reset feature boundary

`apps/web/src/password-reset` owns the public `/password-reset` recovery screen.
It lets a user request a reset code through the Web BFF, verify the code, set a new password, and then hand off to `/login?reset=success`.

## Owned responsibilities

- `/password-reset` page composition through `PasswordResetPageClient`.
- Feature-local flow state, field state, retry-after countdown, verification-code countdown, and route handoff.
- User-visible password-reset copy and status mapping for BFF/client contract results.
- UI components for email entry, verification, new-password entry, completion, progress, service notice, authenticated-session notice, and inline status alerts.
- Guarding the flow from writing verification code, password, or reset state into browser storage or URL history.

## Non-owned responsibilities

- API reset-code issuance, verification, reset token/session invalidation, and provider-side mail delivery.
- Login form state and authenticated redirect handling after the reset-success handoff.
- Account settings password-change flows for an already authenticated user.
- Global auth cookie/session transport and BFF token handling.

## Directory map

| Path                                     | Responsibility                                                                                                   |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `PasswordResetPageClient.tsx`            | Connects flow hook state/actions to step components and layout.                                                  |
| `components/`                            | Presentational layout, notices, progress, status alert, and step components.                                     |
| `hooks/usePasswordResetFlow.ts`          | Owns reset flow side effects, reducer dispatching, route handoff, cooldown coordination, and retry-after status. |
| `hooks/usePasswordResetSessionNotice.ts` | Optional session probe used only to show a non-blocking authenticated-user notice.                               |
| `hooks/usePasswordResetCooldown.ts`      | Countdown timer primitive for verification-code TTL and retry-after display.                                     |
| `model/password-reset-flow.*`            | Feature-local reducer state/action/result contracts.                                                             |
| `model/password-reset-copy.ts`           | User-facing copy shared by layout and flow status mapping.                                                       |
| `model/password-reset-error.mapper.ts`   | Retry-after normalization and reset-restart code mapping.                                                        |
| `model/password-reset-storage.guard.ts`  | Storage/history write patterns used by the guard test.                                                           |
| `__tests__/PasswordReset.test.tsx`       | Page-level integration regression for the complete flow.                                                         |

## Intentional deviations

- `PasswordResetSkeleton.tsx` is not present because `/password-reset` currently has no loading or Suspense surface.
  Add it only if the route gains a real loading state.
- Step-specific component tests are added only where component-local branches need direct coverage.
  The broad page integration test remains the main regression guard for email, verification, reset, status, and login handoff behavior.
- Legacy compatibility files such as `PasswordReset.tsx` or `Step*` wrappers are intentionally absent.
  Do not reintroduce them unless an external route/import still depends on them.

## Verification map

- BFF/client route contract: `src/app/api/auth/__tests__/password-reset-route.test.ts`, `src/api/__tests__/auth.test.ts`.
- Page flow and route handoff: `src/password-reset/__tests__/PasswordReset.test.tsx`.
- New password form branches: `src/password-reset/components/__tests__/PasswordResetNewPasswordStep.test.tsx`.
- Reducer invariants: `src/password-reset/model/__tests__/password-reset-flow.reducer.test.ts`.
- Storage/history privacy guard: `src/password-reset/model/__tests__/password-reset-storage.guard.test.ts`.
- Metadata/sitemap: `src/app/__tests__/metadata.test.ts`.

Full-stack reset completion E2E is intentionally not part of this feature-local gate because it requires a reset-code fixture or mail provider stub.
Use the focused BFF/client contract and page integration tests as the local regression evidence until that fixture exists.
