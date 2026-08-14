# 비밀번호 재설정 시작 경로 timing 방어

**상태**: Accepted / current

## 위협

비밀번호 재설정 코드 요청에서 가입 이메일과 미가입 이메일의 처리 시간이 크게 다르면 계정
존재 여부를 추정할 수 있습니다. 공개 응답을 동일하게 만드는 것만으로는 처리 시간 차이를
제거할 수 없습니다.

## 결정

- Signup과 Password Reset 인증 코드 요청은 계정 존재 여부와 무관하게 중립적인 성공 응답을 반환합니다.
- 요청 처리가 빠르게 끝나더라도 공통 최소 응답 시간인 `400ms`를 보장합니다.
- 미가입 계정에 fake 메일을 보내거나 불필요한 password hash를 수행하지 않습니다.
- provider 내부 오류나 계정 존재 여부를 공개 응답에 포함하지 않습니다.

현재 owner는 다음과 같습니다.

| 책임                                             | owner                                                                       |
| ------------------------------------------------ | --------------------------------------------------------------------------- |
| 최소 응답 시간과 대기 정책                       | `apps/api/src/auth/verification/request/auth-verification-timing.policy.ts` |
| 계정 존재 여부에 따른 code 후보 생성과 공통 응답 | `apps/api/src/auth/verification/auth-verification.service.ts`               |

## 이유

공통 floor는 외부 side effect를 위조하지 않으면서 coarse timing gap을 줄입니다. 완전한 constant-time
보장은 아니며 network·mail outbox·database 부하에 따른 분산은 남습니다. 따라서 floor 값은 임의로
키우지 않고 existing/missing 요청의 p50·p95 관측 근거가 있을 때만 조정합니다.

## 불변식

- account existence에 따라 공개 status·body·사용자 문구를 분기하지 않습니다.
- metric과 log label에 raw email, code, token을 넣지 않습니다.
- throttle 응답은 계정 존재 여부가 아니라 동일한 공개 제한 정책을 따릅니다.
- mail provider 또는 배포 토폴로지가 바뀌면 timing 분포를 다시 측정합니다.
