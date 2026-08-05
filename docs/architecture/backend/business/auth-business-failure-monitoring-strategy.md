# Auth business failure 응답·관측 경계

**상태**: Accepted / current

## 결정

인증 과정에서 사용자가 교정할 수 있거나 보안상 중립 응답이 필요한 business failure는 안정적인
`code`와 함께 `success: false`로 표현할 수 있습니다. 사용자 문구는 transport 의미나 운영 집계
key로 사용하지 않습니다.

```ts
type AuthBusinessFailure = {
  success: false;
  code: 'AUTH_INVALID_CREDENTIALS';
  error: '이메일 또는 비밀번호가 올바르지 않습니다.';
  userActionable: true;
  fieldErrors?: Record<string, string>;
};
```

반면 malformed request, 인증·인가 실패, rate limit, transport failure처럼 HTTP protocol 의미가
필요한 오류는 공통 exception/filter 경계를 사용합니다.

## 책임 경계

| 책임                                                  | owner                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------ |
| business failure code·userActionable·fieldErrors 구성 | `apps/api/src/auth/errors/auth-failures.ts`                              |
| HTTP exception과 transport mapping                    | `apps/api/src/auth/errors/auth.errors.ts`, `apps/api/src/platform/http/` |
| credential·verification 결과 선택                     | `apps/api/src/auth/credentials/`, `apps/api/src/auth/verification/`      |

## 관측 원칙

- 안정적인 low-cardinality `code`와 outcome만 집계합니다.
- 사용자 문구, raw email, user id, session·token·verification code·password는 metric label로 사용하지 않습니다.
- `fieldErrors`는 입력 교정 위치를 제공할 때만 사용합니다.
- `userActionable: false`는 재입력보다 대기·재시도·재로그인이 필요한 상태를 구분합니다.

## 불변식

- 문구 변경이 dashboard·alert 집계 key를 바꾸지 않아야 합니다.
- 모든 auth 실패를 관성적으로 HTTP 4xx 또는 `200 + success:false` 하나로 통일하지 않습니다.
- account enumeration을 만들 수 있는 실패는 공개 code와 문구까지 중립화합니다.
- 새 failure code는 shared contract와 controller/use-case 회귀 테스트로 고정합니다.
