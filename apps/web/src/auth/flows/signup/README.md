# Web signup

`apps/web/src/auth/flows/signup`은 공개 회원가입 wizard의 화면 상태, 입력 검증, 이탈·만료 복구, BFF 호출 조합을 소유한다.
회원가입은 계정 생성까지의 흐름이며, 룸메 시즌 프로필 작성이나 기숙사 선택을 직접 소유하지 않는다.

## 제품 책임

- 강원대학교 이메일 인증을 통해 가입 가능한 학교 메일 형식과 인증 코드 흐름을 안내한다.
- 최신 이용약관, 개인정보 수집·이용 동의, 법적 만 14세 이상 안내를 확인하고 필수 동의 evidence를 signup request에 포함한다.
- 계정 생성에 필요한 표시 이름과 account academic identity를 수집한다.
  - `nickname`
  - `gender`
  - `campus`
  - `collegeCode`
  - `birthYear`
  - `password`
- `/api/auth/signup` BFF를 통해 shared `SignupRequest` shape만 upstream auth API로 전달한다.
- 가입 완료 후에는 메인 화면에서 현재 시즌 상태, 시즌 프로필 준비, 기숙사 선택 후 룸메 찾기를 이어서 진행해야 함을 안내한다.
- 출생연도 UI는 대학생 사용 맥락에 맞춰 `현재연도 - 30`부터 `현재연도 - 18`까지의 select option을 제공한다.
  법적 자격 문구는 만 14세 이상 고지로 유지하지만, 화면 입력 UX는 대학생 기준의 실사용 범위를 우선한다.

## Non-owner boundary

Signup은 아래 데이터를 생성하거나 저장하지 않는다.

- 시즌 프로필 생활패턴, 룸메 조건, 자기소개(`lifestyle`, `condition`, `intro`)
- 기숙사 선택 draft 또는 registration finalize
- 매칭 요청, 채팅방, 신고/문의, 알림 설정
- `service-intro` 같은 dismissed notice persistence

이 흐름들은 season profile / season participants / main onboarding owner가 담당한다.
가입 완료 화면의 서비스 소개는 one-time handoff copy이며, `다시 보지 않음` 저장 UX는 MainPage bottom sheet/onboarding scope에서 다룬다.

## Current flow

현재 회원가입은 5단계다.

1. `StepEmailVerification` — 학교 이메일 인증 코드 발송·확인.
2. `LegalConsentStep` — active legal bundle 조회, fallback 안내, 필수 동의 수집, stale legal reset.
3. `AccountCredentialsStep` — 닉네임·비밀번호와 닉네임 사용 가능 여부를 canonical signup
   draft validation으로 확인하며, 연결 실패 시 입력값을 유지하고 재시도한다.
4. `AcademicIdentityStep` — 캠퍼스, 성별, 단과대, 출생연도를 확인한 뒤 signup submit.
5. `SignupCompleteStep` — 계정 생성 완료와 가입 후 시즌 여정 안내.

`SignupPageClient.tsx`는 redirect, 이탈 guard, proof 만료 lifecycle, router handoff와 production controller/view 연결만 담당한다.
`useSignupFlow`가 reducer event를 통해 단계 전환, legal stale, email 재인증 복귀, submit 결과를 하나의 state source로 관리한다.
`SignupFlowView`는 같은 production step component를 Storybook에서도 재사용할 수 있는 presentational composition이다.

## API/BFF contract

| Surface                                 | Responsibility                                                                                      |
| --------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `apps/web/src/auth/api/*`               | Web client wrapper. 429 `Retry-After`/`retryAfterSeconds`를 사용자 문구와 countdown metadata로 보존 |
| `app/api/auth/send-signup-code`         | signup 이메일 인증 코드 요청 forward                                                                |
| `app/api/auth/verify-email-code`        | signup 이메일 인증 코드 확인 forward                                                                |
| `app/api/auth/signup/validate-nickname` | 이메일 인증 grant가 있는 브라우저의 닉네임 형식·금칙어·현재 사용 가능 여부만 확인하는 BFF           |
| `app/api/auth/signup`                   | shared `signupRequestSchema`로 body를 검증하고 allowlisted body만 upstream `/auth/signup`에 전달    |
| `model/signup-request.mapper.ts`        | UI state를 shared `SignupRequest`로 변환하며 forbidden profile fields를 출력하지 않음               |

`/api/auth/signup` 응답은 upstream access token을 JSON body에 노출하지 않고 auth cookie로만 설정한다.
Signup BFF는 request body를 cast-only로 통과시키지 않고 shared schema parse guard를 사용한다.
`apps/web/src/auth/api/*`는 login, password reset, signup이 함께 쓰는 Web auth client wrapper이므로
signup feature-local `api/` 아래로 옮기지 않고 auth public facade(`@/auth/api`)로 유지한다.

## Recovery rule

Signup은 입력량이 짧고 비밀번호를 복원할 수 없으므로 browser storage에 작성 중 상태를 저장하거나
`계속 작성` dialog를 제공하지 않는다. 새로고침하거나 signup을 다시 열면 Step 1부터 시작한다.

진행 중 로고 이동은 native `confirm` 대신 signup 전용 이탈 확인 dialog를 사용한다.
브라우저 뒤로가기·새로고침은 `beforeunload`를 best-effort guard로 보완한다.
브라우저 API는 새로고침과 탭 닫기를 구분하지 않으므로 native prompt 노출 여부는 user agent가 결정한다.
API 실패는 사용자 문구 비교가 아니라 error code를 `retryable`, `verification_expired`, `field_error`로 분류한다.
네트워크 오류는 최종 가입 CTA 앞에서 안내한다. 이메일 인증 proof는 30분 동안 유효하며, client timer·foreground 복귀
검사 또는 최종 signup API가 만료를 확인하면 이메일만 유지하고 법적 동의·로그인 정보·학교 정보를 초기화한다.
재인증 후 이전 단계로 복귀하지 않고 정상 Step 1 → Step 2 흐름을 다시 시작한다.

## Directory responsibility

| Directory / file                    | Responsibility                                                                                            |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `SignupPageClient.tsx`              | auth redirect, exit guard, router handoff와 controller/view 연결                                          |
| `SignupFlowView.tsx`                | production과 Storybook이 공유하는 5단계 presentational composition                                        |
| `components/`                       | 단계별 화면, layout, progress, alert, loading UI                                                          |
| `components/SignupLayout.tsx`       | auth header, mobile compact progress와 독립 운영 서비스 footer를 배치                                     |
| `components/SignupSupportPanel.tsx` | 현재 단계 설명, desktop vertical progress, 독립 운영 서비스 고지를 소유하는 context rail                  |
| `components/account-identity/`      | 계정 credentials와 academic identity 입력 section                                                         |
| `components/SignupCompleteStep.tsx` | 가입 완료 후 season journey handoff                                                                       |
| `components/SignupSkeleton.tsx`     | auth redirect 확인 중 접근 가능한 loading UI                                                              |
| `components/email-verification/`    | signup 이메일 인증 요청/확인 hook과 UI. 요청/확인 UI와 hook이 함께 움직이는 slice라 flat하게 풀지 않는다. |
| `components/recovery/`              | 작성 중 이탈 확인 dialog                                                                                  |
| `hooks/useSignupFlow.ts`            | reducer 기반 production flow controller와 API operation orchestration                                     |
| `hooks/useSignupExitGuard.ts`       | 앱 내부 이탈 dialog와 browser beforeunload guard                                                          |
| `model/signup-flow.*`               | step id/count와 production reducer transition 규칙                                                        |
| `model/signup-academic-copy.ts`     | production과 Storybook이 공유하는 캠퍼스 운영 안내 문구                                                   |
| `model/signup-failure-recovery.ts`  | API error code를 typed recovery state로 변환                                                              |
| `model/signup-request.mapper.ts`    | shared `SignupRequest` mapping                                                                            |
| `stories/fixtures/signup/`          | 단계·복구 flow별 production view adapter. 화면 문구와 레이아웃을 독립 복제하지 않음                       |
| `__tests__/`, `model/__tests__/`    | flow, recovery, mapper, shell regression                                                                  |
| `components/__tests__/`             | step component interaction/accessibility regression                                                       |

## Verification map

주요 회귀 테스트는 아래 책임을 잠근다.

- `Signup.test.tsx`
  - 5단계 signup flow
  - legal stale reset
  - 이탈 확인 dialog
  - typed field/retry/verification recovery
  - no `lifestyle`/`intro` submit
  - retry-after countdown integration
- `signup-request.mapper.test.ts`
  - shared `SignupRequest` 생성
  - forbidden profile fields 미출력
- `signup-flow.reducer.test.ts`, `signup-flow.types.test.ts`
  - step bounds와 flow id consistency
- `AccountCredentialsStep.test.tsx`, `AcademicIdentityStep.test.tsx`
  - 계정 정책 검증과 학교·기본 정보 required fields, current-year based birth year select
- `LegalConsentStep.test.tsx`
  - active/fallback legal bundle, stale legal id handling, dialog interaction
- `SignupCompleteStep.test.tsx`
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
| Campus matching copy         | `model/signup-academic-copy.ts`                                                   |

정책 문서와 화면 문구가 충돌하면 정책 문서를 우선하고 signup copy/test를 갱신한다.

## Tailwind v4 class rule

Signup 범위는 auth root README의 Tailwind v4 canonical class rule을 따른다.
CSS variable shorthand가 가능한 값은 `text-(--knu-text-primary)`처럼 작성하고, 실제 arbitrary value가 필요한 layout 값만 bracket syntax를 유지한다.
Mobile 독립 운영 서비스 고지의 `자세히 보기` 링크는 `inline-block whitespace-nowrap`을 유지해 좁은 화면에서 두 줄로 쪼개지지 않게 한다.

## Handoff and follow-up boundary

- #260은 signup 외 login, password reset, password change UX까지 포함하는 큰 Web auth UX 후속 범위다.
  Signup page 범위가 끝나도 #260 전체를 즉시 닫지 않는다.
- #221의 MainPage bottom sheet/onboarding, `service-intro` dismissed persistence, season profile CTA, OFF_SEASON profile tab은 signup feature의 미완료 violation이 아니라 별도 제품 surface다.
- Real browser full signup E2E는 API/DB/email fixture가 필요하므로 Web-only unit/component 검증과 분리한다.
- 후속 작업이 signup owner boundary를 바꾸면 이 README와 관련 테스트를 함께 갱신한다.
