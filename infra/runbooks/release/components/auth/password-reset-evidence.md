# Auth password reset release evidence

이 runbook은 Password Reset/Auth 구조 변경을 release candidate에서 검증하는 최소 evidence 경계다. 아직 production 사용자 데이터가 없으므로 DB backup 자동화나 기존 사용자 data migration은 이 단계의 범위가 아니다.

완료 결과는 `infra/runbooks/release/production-release-evidence.md`의 Password Reset component에
연결하며, 이 문서에서는 전체 release의 최종 판정을 선언하지 않는다.

## 1. Automated recovery evidence

```bash
pnpm --dir apps/api exec vitest run \
  --config ./vitest.config.e2e.ts \
  test/e2e/auth/password-reset-recovery.e2e-spec.ts

pnpm --dir apps/api exec vitest run \
  --config ./vitest.config.integration.ts \
  --maxWorkers=1 \
  test/integration/auth/verification/verification-lifecycle.integration.spec.ts \
  test/integration/auth/auth-lifecycle.integration.spec.ts
```

첫 E2E는 disposable PostgreSQL schema에 baseline migration을 적용한 뒤 다음 HTTP 흐름을 검증한다.

1. 기존 비밀번호 로그인과 active session 생성
2. reset request와 encrypted mail outbox append
3. code verify와 15분 single-use grant 발급
4. 새 비밀번호 저장, 전체 session revoke, audit/outbox commit
5. grant replay 거부, 이전 비밀번호 로그인 실패, 새 비밀번호 로그인 성공

Integration lane은 동시 grant consume, verification attempt 원자성, outbox `SKIP LOCKED` claim과 worker lease restart를 검증한다. 각 suite는 새 schema에 `prisma migrate deploy`를 실행하고 종료 시 schema를 제거하므로 현재 development data의 backup을 만들지 않는다.

## 2. Web/BFF recovery evidence

```bash
pnpm --dir apps/web exec vitest run \
  src/app/api/auth/__tests__/password-reset-route.test.ts \
  src/auth/flows/password-reset/__tests__/PasswordReset.test.tsx \
  src/auth/flows/password-reset/model/__tests__/password-reset-flow.reducer.test.ts

pnpm --dir apps/web typecheck
pnpm --dir apps/web storybook:build
```

Browser JSON에는 raw grant를 노출하지 않고 HttpOnly cookie만 reset authority를 전달하는지, reset 완료 또는 restart-required에서 cookie가 제거되는지 확인한다.

## 3. SES sandbox smoke

먼저 private shell에서 설정 경계만 확인한다.

```bash
EMAIL_PROVIDER=ses \
SES_REGION=ap-northeast-2 \
SES_FROM_EMAIL=no-reply@example.com \
SES_CONFIGURATION_SET=knu-roommate-staging \
AUTH_SES_SMOKE_RECIPIENT=success@simulator.amazonses.com \
pnpm --dir apps/api auth:ses:smoke -- --dry-run
```

AWS credential, verified identity와 Configuration Set event destination이 준비된 staging/sandbox에서 `--dry-run`을 제거한다. 출력은 recipient나 provider raw error를 포함하지 않고 `accepted`, provider message id 존재 여부 또는 bounded failure category만 기록한다.

`accepted`는 SES API 접수 증거다. Configuration Set의 delivery/bounce/complaint event가 CloudWatch/SNS/EventBridge destination에 도착한 별도 evidence가 있어야 release gate를 통과한다.

## 4. Abuse/timing/worker evidence

```bash
pnpm --dir apps/api test:stress

STRESS_TARGET_URL=https://staging.example.internal \
STRESS_ALLOWED_HOSTS=staging.example.internal \
pnpm --dir apps/api stress:http:auth-recovery
```

`auth-recovery-abuse`는 실제 사용자나 메일을 만들지 않는 미존재 subject로 동일 subject abuse, campus NAT 정상 흐름, 분산 request/invalid-code burst를 실행한다. 확인 항목은 다음과 같다.

- public neutral response와 응답 내 email/code 비노출
- 5xx 없음, expected 429만 허용
- p95 1.2초, p99 2초 이내
- 동일 subject/IP와 분산 subject/IP의 bounded throttle
- 기본 release rate에서 여러 subject가 공유하는 campus NAT IP에 429가 발생하지 않음
- valid grant single-use, outbox claim과 worker restart는 PostgreSQL integration lane에서 통과

이 smoke 하나만으로 Argon2id capacity를 승인하지 않는다. 19MiB/t=2/p=1과 admission 기본값은 별도의 4GB/2CPU H1~H7/H9 local constrained evidence와 명시적인 H8/AWS reference 미수행 risk acceptance로 결정되었으며, 이 runbook은 reset lifecycle correctness만 검증한다.

## 5. Metrics and alerts

```bash
API_BASE_URL=https://staging.example.internal \
METRICS_BEARER_TOKEN='private-value' \
infra/deploy/scripts/api-release-smoke.sh
```

Smoke는 metrics endpoint의 anonymous 접근 거부와 함께 다음 metric definition을 확인한다.

- `api_auth_verification_operations_total`
- `api_auth_credential_transitions_total`
- `api_auth_mail_dispatch_total`
- `api_auth_mail_outbox_lag_seconds`

Prometheus rule load와 alert fixture test에서 owner-local mail failure counter와 outbox lag alert를 확인한다. Reset abuse는 `api_auth_verification_operations_total`의 accepted/throttled 비율과 code request backstop 동작으로 검증한다.

## 6. Development-stage rollback

현재 release된 사용자 데이터가 없으므로 rollback은 다음 범위로 제한한다.

1. API/Web image 또는 commit을 직전 검증 버전으로 되돌린다.
2. disposable development/staging DB를 제거한다.
3. initial baseline migration과 reference seed로 fresh DB를 다시 만든다.
4. recovery E2E, role grant, metrics smoke를 다시 실행한다.

기존 development data backup·복원 script, verification grant dual-read, email-only proof downgrade flag는 만들지 않는다. 첫 production 사용자 생성 이후에는 destructive DB recreation을 금지하고 forward-fix migration과 정식 backup/restore runbook을 사용한다.

## 7. Secret-free evidence

```txt
release_sha:
recovery_e2e: pass | fail
auth_integration: pass | fail
web_bff_flow: pass | fail
fresh_schema_migration: pass | fail
ses_api_acceptance: pass | fail | blocked
ses_delivery_event: pass | fail | blocked
auth_recovery_stress: pass | fail | blocked
auth_metrics_scrape: pass | fail | blocked
prometheus_rule_load: pass | fail | blocked
rollback_mode: fresh-development-db
blockers:
redaction_confirmed: true
```

실제 email, verification code, grant, password, cookie, Authorization header, HMAC secret, DB URL은 evidence에 기록하지 않는다.
