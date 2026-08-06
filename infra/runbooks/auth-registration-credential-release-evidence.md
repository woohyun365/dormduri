# Auth registration·credential lifecycle release evidence

이 runbook은 Signup, Change Password, Logout의 원자적 lifecycle과 nickname 사전 확인 경계를 release candidate에서 검증하는 최소 evidence다. 아직 production 사용자 데이터가 없으므로 기존 사용자 백업이나 dual-write migration은 범위에 포함하지 않는다.

## 1. Shared·API·Web static gate

```bash
pnpm --filter @repo/shared typecheck
pnpm api:typecheck
pnpm web:typecheck
pnpm --filter @repo/shared lint
pnpm api:lint
pnpm web:lint
```

Signup/Change Password failure schema에 제거된 부분 성공 code가 다시 포함되지 않는지, Browser response가 access/renewal token이나 internal normalized nickname을 노출하지 않는지 함께 확인한다.

## 2. Auth·Users owner unit evidence

```bash
pnpm --dir apps/api exec vitest run \
  --config ./vitest.config.unit.ts \
  --maxWorkers=50% \
  src/auth/contracts/auth-shared-contract.spec.ts \
  src/auth/registration/auth-registration-use-cases.service.spec.ts \
  src/auth/registration/signup-nickname-validation-admission.service.spec.ts \
  src/auth/registration/signup-nickname-validation.query.spec.ts \
  src/auth/registration/signup-submission-admission.service.spec.ts \
  src/auth/registration/signup.command.spec.ts \
  src/auth/credentials/change-password-admission.service.spec.ts \
  src/auth/credentials/change-password.command.spec.ts \
  src/users/identity/display/display-identity-nickname-policy.service.spec.ts \
  src/users/identity/display/display-identity.repository.spec.ts \
  src/users/identity/display/update-display-identity.command.spec.ts \
  test/operations/platform/observability-infra.spec.ts
```

Nickname parse/moderation/current availability는 Users Display Identity owner를 사용하고, Auth는 signup admission과 finalization만 orchestration하는지 확인한다. 사전 확인은 reservation이 아니며 final unique conflict는 안정적인 field recovery로 수렴해야 한다.

## 3. PostgreSQL transaction evidence

```bash
pnpm --dir apps/api exec vitest run \
  --config ./vitest.config.integration.ts \
  --maxWorkers=1 \
  test/integration/auth/auth-lifecycle.integration.spec.ts \
  test/integration/users/display-identity/user-identity-transaction.integration.spec.ts
```

각 suite는 disposable PostgreSQL schema에 baseline migration을 적용한다. 필수 확인 항목은 다음과 같다.

- concurrent same nickname signup은 성공 1건이며 reservation/ghost row가 없다.
- Signup grant consume, account, display/academic identity, legal acceptance, initial session, 필수 event는 함께 commit 또는 rollback된다.
- Change Password의 password CAS, 기존 session revoke, replacement session, mail outbox, 필수 event는 함께 commit 또는 rollback된다.
- Reset/Change 동시 mutation과 stale password writer가 최신 credential을 덮어쓰지 않는다.
- 성공한 Change Password 뒤 기존 active session은 0개이고 replacement session은 정확히 1개다.

## 4. Browser BFF·flow evidence

```bash
pnpm --dir apps/web exec vitest run \
  src/app/api/auth/__tests__/signup-nickname-route.test.ts \
  src/app/api/auth/__tests__/signup-route.test.ts \
  src/auth/bff/__tests__/auth-route-handlers.test.ts \
  src/auth/flows/signup/__tests__/Signup.test.tsx \
  src/auth/flows/signup/__tests__/SignupNicknameRaceStoryScenario.test.tsx
```

Signup nickname 확인, final signup, Change Password, Logout BFF가 strict request contract를 사용하고 token은 HttpOnly cookie에만 저장하는지 확인한다. Final nickname race는 다른 signup 입력을 보존한 채 nickname 입력으로 복구해야 한다.

## 5. Fresh database·reference data evidence

```bash
pnpm --dir apps/api prisma:generate
pnpm --dir apps/api prisma:validate
pnpm --dir apps/api exec vitest run \
  --config ./vitest.config.integration.ts \
  --maxWorkers=1 \
  test/integration/platform/migration-status.integration.spec.ts
pnpm --dir apps/api exec vitest run \
  --config ./vitest.config.unit.ts \
  test/operations/reference-data/reference-seed-scripts.spec.ts
```

Migration status integration은 기존 development DB가 아니라 disposable fresh schema를 생성하고 `prisma migrate deploy`를 실행한다. 실제 reference seed 실행은 폐기 가능한 development/staging database URL을 명시한 release rehearsal에서만 수행한다.

```bash
NODE_ENV=test \
DATABASE_URL='postgresql://<disposable-target>' \
DIRECT_URL='postgresql://<disposable-target>' \
MIGRATION_DATABASE_URL='postgresql://<disposable-target>' \
RETENTION_WORKER_DATABASE_URL='postgresql://<disposable-target>' \
RETENTION_DISCLOSURE_DATABASE_URL='postgresql://<disposable-target>' \
pnpm --dir apps/api prisma:seed:reference
```

모든 URL은 동일한 disposable schema를 가리켜야 한다. Local Prisma config가 `apps/api/.env`를 source of truth로 사용하는 개발 shell과 분리하기 위해 rehearsal은 `NODE_ENV=test`를 명시한다.

Production 사용자 생성 이후에는 destructive DB recreation을 rollback으로 사용하지 않는다.

## 6. Metrics·alerts·privacy evidence

```bash
API_BASE_URL=https://staging.example.internal \
METRICS_BEARER_TOKEN='private-value' \
infra/deploy/scripts/api-release-smoke.sh
```

Smoke는 다음 credential lifecycle metric definition을 확인한다.

- `api_auth_signup_nickname_validation_total`
- `api_auth_signup_final_admission_total`
- `api_auth_signup_password_hash_total`
- `api_auth_signup_password_hash_duration_seconds`
- `api_auth_sensitive_mutations_total`

Prometheus rule load에서 signup finalization abuse, sensitive mutation throttle spike, credential durability failure alert를 확인한다. Metric label, security event metadata, structured log에 raw password/email/nickname/IP/token/grant가 없는지 별도로 점검한다.

## 7. Password Policy handoff

현재 Argon2id 19MiB/t=2/p=1의 registration/credential lifecycle correctness는 이 runbook이 검증한다. Capacity 결정은 별도의 4GB/2CPU H1~H7/H9 local constrained evidence와 명시적인 H8/AWS reference 미수행 risk acceptance가 소유한다.

필수 후속 evidence는 다음과 같다.

- 같은 release image/container에서 19MiB endpoint latency와 admission 동작 확인
- login success/failure, signup, reset, change-password endpoint mix
- API RSS/CPU/event-loop lag/DB connection과 endpoint p95/p99
- target·dummy·seed/fixture가 동일한 19MiB/t=2/p=1 profile을 사용하는지 확인
- process-local Argon in-flight·queue·timeout과 bounded overload 동작 확인

이 runbook의 unit/integration 통과만으로 19MiB capacity를 다시 승인하지 않는다.

## 8. Dead caller·secret-free evidence

```bash
rg 'validate-signup-draft|validateSignupDraft|signupDraftValidation' apps packages docs
rg 'AUTH_ACCOUNT_CREATED_LOGIN_REQUIRED|AUTH_PASSWORD_CHANGED_LOGIN_REQUIRED' apps packages docs
```

두 명령은 production caller 0건이어야 한다.

```txt
release_sha:
shared_api_web_static: pass | fail
auth_users_unit: pass | fail
auth_postgres_integration: pass | fail
browser_bff_flow: pass | fail
fresh_schema_migration: pass | fail
reference_seed_disposable_db: pass | fail | blocked
credential_metrics_scrape: pass | fail | blocked
prometheus_rule_load: pass | fail | blocked
argon_19mib_mixed_workload: pass | fail | blocked
rollback_mode: fresh-development-db
blockers:
redaction_confirmed: true
```

실제 email, nickname, verification grant, password, cookie, Authorization header, HMAC secret, DB URL은 evidence에 기록하지 않는다.
