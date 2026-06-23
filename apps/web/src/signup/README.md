# Web signup

`apps/web/src/signup`은 공개 회원가입 wizard의 화면 상태, 입력 검증, draft 저장, BFF 호출 조합을 소유한다.
회원가입은 계정 생성까지의 흐름이며, 룸메 시즌 프로필 작성이나 기숙사 선택을 직접 소유하지 않는다.

## 제품 책임

- 강원대학교 이메일 인증을 통해 가입 가능한 학교 메일 형식과 인증 코드 흐름을 안내한다.
- 최신 이용약관, 개인정보 수집·이용 동의, 만 14세 이상 안내를 확인하고 필수 동의 evidence를 signup request에 포함한다.
- 계정 생성에 필요한 표시 이름과 account academic identity를 수집한다.
  - `nickname`
  - `gender`
  - `campus`
  - `collegeCode`
  - `birthYear`
  - `password`
- `/api/auth/signup` BFF를 통해 shared `SignupRequest` shape만 upstream auth API로 전달한다.
- 가입 완료 후에는 메인 화면에서 현재 시즌 상태, 시즌 프로필 준비, 기숙사 선택 후 룸메 찾기를 이어서 진행해야 함을 안내한다.

## Non-owner boundary

Signup은 아래 데이터를 생성하거나 저장하지 않는다.

- 시즌 프로필 생활패턴, 룸메 조건, 자기소개(`lifestyle`, `condition`, `intro`)
- 기숙사 선택 draft 또는 registration finalize
- 매칭 요청, 채팅방, 신고/문의, 알림 설정
- `service-intro` 같은 dismissed notice persistence

이 흐름들은 season profile / season participants / main onboarding owner가 담당한다.
가입 완료 화면의 서비스 소개는 one-time handoff copy이며, `다시 보지 않음` 저장 UX는 MainPage bottom sheet/onboarding scope에서 다룬다.

## Current flow

현재 회원가입은 4단계다.

1. `StepEmailVerification` — 학교 이메일 인증 코드 발송·확인.
2. `LegalConsentStep` — active legal bundle 조회, fallback 안내, 필수 동의 수집, stale legal reset.
3. `AccountIdentityStep` — 닉네임, 비밀번호, 성별, 캠퍼스, 단과대, 출생연도 입력 후 signup submit.
4. `StepComplete` — 계정 생성 완료와 가입 후 시즌 여정 안내.

`Signup.tsx`는 route-level client shell로 단계 조합과 submit recovery만 담당한다.
입력 저장, request mapping, flow 상태 규칙은 `hooks/`와 `model/` 아래의 작은 단위로 유지한다.

## API/BFF contract

| Surface                              | Responsibility                                                                                      |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `apps/web/src/api/auth.ts`           | Web client wrapper. 429 `Retry-After`/`retryAfterSeconds`를 사용자 문구와 countdown metadata로 보존 |
| `app/api/auth/send-signup-code`      | signup 이메일 인증 코드 요청 forward                                                                |
| `app/api/auth/verify-email-code`     | signup 이메일 인증 코드 확인 forward                                                                |
| `app/api/auth/validate-signup-draft` | canonical draft validation BFF. Legacy `validate-signup-profile` surface는 유지하지 않음            |
| `app/api/auth/signup`                | shared `signupRequestSchema`로 body를 검증하고 allowlisted body만 upstream `/auth/signup`에 전달    |
| `model/signup-request.mapper.ts`     | UI state를 shared `SignupRequest`로 변환하며 forbidden profile fields를 출력하지 않음               |
| `model/signup-draft-storage.ts`      | browser draft allowlist를 normalize하고 legacy step을 현재 4-step flow에 맞게 복원                  |

`/api/auth/signup` 응답은 upstream access token을 JSON body에 노출하지 않고 auth cookie로만 설정한다.
Signup BFF는 request body를 cast-only로 통과시키지 않고 shared schema parse guard를 사용한다.

## Draft storage rule

`signup-draft`는 사용자가 새로고침해도 Step 1~3 입력을 이어갈 수 있게 하는 UX 저장소다.
다음 값만 저장한다.

- `schemaVersion`
- `currentStepId` / `legacyCurrentStep`
- `email`
- `isEmailVerified`
- 필수 legal acceptance ids와 fallback/source flag
- `nickname`
- `gender`
- `campus`
- `collegeCode`
- `birthYear`

다음 값은 저장하지 않는다.

- password / password confirmation
- 인증 코드
- legal document full body
- raw API response
- `lifestyle`, `condition`, `intro`, profile object

회원가입 성공으로 Step 4에 도달하면 draft는 삭제된다.
복구 가능한 legacy step은 Step 3까지만 허용하고, 인증이 풀린 상태에서는 Step 1로 되돌린다.

## Directory responsibility

| Directory / file                 | Responsibility                                         |
| -------------------------------- | ------------------------------------------------------ |
| `Signup.tsx`                     | 4-step shell, auth redirect gate, submit/recovery glue |
| `components/`                    | 단계별 화면, layout, progress, alert, loading UI       |
| `components/email-verification/` | signup 이메일 인증 요청/확인 hook과 UI                 |
| `hooks/useSignupDraftStorage.ts` | browser draft read/write lifecycle bridge              |
| `model/signup-flow.*`            | step id/count와 reducer 규칙                           |
| `model/signup-draft-storage.ts`  | draft serialization allowlist                          |
| `model/signup-request.mapper.ts` | shared `SignupRequest` mapping                         |
| `__tests__/`, `model/__tests__/` | flow, storage, mapper, shell regression                |
| `components/__tests__/`          | step component interaction/accessibility regression    |

## Verification map

주요 회귀 테스트는 아래 책임을 잠근다.

- `Signup.test.tsx`
  - 4단계 signup flow
  - legal stale reset
  - draft restore/clear
  - no `lifestyle`/`intro` submit
  - retry-after countdown integration
- `signup-request.mapper.test.ts`
  - shared `SignupRequest` 생성
  - forbidden profile fields 미출력
- `signup-draft-storage.test.ts`
  - draft allowlist
  - password/code/full legal body/profile fields 미저장
- `signup-flow.reducer.test.ts`, `signup-flow.types.test.ts`
  - step bounds와 flow id consistency
- `AccountIdentityStep.test.tsx`
  - required fields, current-year based birth year select, validation copy
- `LegalConsentStep.test.tsx`
  - active/fallback legal bundle, stale legal id handling, dialog interaction
- `StepComplete.test.tsx`
  - 가입 완료 후 season journey handoff, off-season copy, no `다시 보지 않음`
- `app/api/auth/__tests__/signup-route.test.ts`
  - BFF schema guard, forbidden field reject, token body exposure 방지
- `app/api/auth/__tests__/signup-draft-route.test.ts`
  - canonical draft validation surface

## Source of truth

| 주제                         | Source                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------- |
| Signup/auth responsibility   | `docs/04_policy/official/account-authentication.md`                               |
| Season profile/registration  | `docs/04_policy/official/season-participation.md`                                 |
| Profile model and intro rule | `docs/04_policy/official/profile-model.md`                                        |
| Legal consent contract       | `packages/shared/src/legal/contract.ts`                                           |
| Signup request contract      | `packages/shared/src/auth/contract/requests.ts`                                   |
| College code catalog/schema  | `packages/shared/src/college/catalog.ts`, `packages/shared/src/college/schema.ts` |

정책 문서와 화면 문구가 충돌하면 정책 문서를 우선하고 signup copy/test를 갱신한다.

## Handoff and follow-up boundary

- #260은 signup 외 login, password reset, password change UX까지 포함하는 큰 Web auth UX 후속 범위다.
  Signup page 범위가 끝나도 #260 전체를 즉시 닫지 않는다.
- #221의 MainPage bottom sheet/onboarding, `service-intro` dismissed persistence, season profile CTA, OFF_SEASON profile tab은 signup feature의 미완료 violation이 아니라 별도 제품 surface다.
- Real browser full signup E2E는 API/DB/email fixture가 필요하므로 Web-only unit/component 검증과 분리한다.
- 후속 작업이 signup owner boundary를 바꾸면 이 README와 관련 테스트를 함께 갱신한다.
