# 이메일 인증 요청 identity와 stale response 방어

**상태**: Current
**마지막 검증 환경**: Next.js 16, React 19
**현재 owner**: `apps/web/src/auth/flows/signup/`, `apps/web/src/auth/flows/password-reset/`

## 증상

이메일 A로 인증 코드를 요청한 직후 입력을 이메일 B로 바꾸면, 늦게 완료된 A 요청이 현재 UI를
verification 단계로 전환하거나 B로 발송된 것처럼 보이게 할 수 있습니다.

## 원인

현재 입력값과 실제 요청 subject를 같은 state로 취급하거나, 이전 비동기 요청이 여전히 최신 요청인지
확인하지 않으면 stale completion이 새 화면 상태를 덮어씁니다. Timer cleanup만으로는 이미 시작된 network
response를 무효화할 수 없습니다.

## 해결

두 flow는 같은 불변식을 서로 다른 owner-local 방식으로 지킵니다.

- Signup은 `requestedEmail`과 증가하는 `requestId`를 사용해 현재 요청만 반영합니다.
- Password Reset은 reducer state가 요청 이메일을 step identity로 고정하고 `AbortController`로 이전 요청을 취소합니다.
- 이메일 변경은 code, countdown, retry-after, field/action feedback과 verification context를 함께 초기화합니다.
- Verification과 이후 step은 입력 중인 값이 아니라 성공한 요청의 이메일만 사용합니다.

## 검증

- 전송 중 이메일 변경 후 이전 요청 성공이 다음 step을 열지 않아야 합니다.
- 새 요청 이후 과거 요청이 늦게 끝나도 feedback·countdown·requested email을 덮지 않아야 합니다.
- Unmount 또는 flow restart 이후 완료된 요청이 state를 갱신하지 않아야 합니다.

```bash
pnpm --filter @repo/shared build
pnpm --dir apps/web exec vitest run \
  src/auth/flows/signup/components/email-verification/__tests__/useSignupEmailVerification.dom.test.ts \
  src/auth/flows/password-reset/__tests__/PasswordReset.test.tsx
```

## 참고

- [React: Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects)
- [React: Preserving and Resetting State](https://react.dev/learn/preserving-and-resetting-state)
