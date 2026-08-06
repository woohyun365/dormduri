# API test runner guide

`apps/api`의 테스트 runner source of truth다. Unit은 production source와 colocate하고, cross-cutting architecture와 별도 환경이 필요한 검증은 `test/`에 둔다.

## Command matrix

| Lane                             | 명령                                   | 수집 범위 / 책임                                                                     |
| -------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------ |
| Unit + architecture + operations | `pnpm --dir apps/api test`             | `src/**/*.spec.ts`, `test/architecture/**/*.spec.ts`, `test/operations/**/*.spec.ts` |
| Integration                      | `pnpm --dir apps/api test:integration` | disposable PostgreSQL을 사용하는 `test/integration/**/*.integration.spec.ts`         |
| E2E                              | `pnpm --dir apps/api test:e2e`         | 실제 HTTP 경계의 `test/e2e/**/*.e2e-spec.ts`                                         |
| Stress harness                   | `pnpm --dir apps/api test:stress`      | K6/Artillery/Docker 실행기가 아닌 parser·fixture·redaction·static contract           |
| CI aggregate                     | `pnpm test:api:ci`                     | 위 네 lane을 순차 실행                                                               |
| Coverage                         | `pnpm --dir apps/api test:cov`         | unit V8 coverage                                                                     |
| Product typecheck                | `pnpm --dir apps/api typecheck`        | production source                                                                    |
| Test typecheck                   | `pnpm --dir apps/api typecheck:test`   | test support와 별도 runner source                                                    |

K6, Artillery, Docker load는 일반 CI aggregate에 포함하지 않는다. 승인된 로컬 rehearsal 또는 운영 evidence 수집에서 `stress:*` 명령을 별도로 실행한다.

## Authoring rules

- Vitest API는 `vitest`에서 명시적으로 import한다.
- Integration/E2E는 `pool: 'forks'`, `fileParallelism: false`, `--maxWorkers=1`을 유지한다.
- `test/operations`는 DB·reference data·infra artifact와 외부 provider/release smoke의 bounded contract를 검증한다. 실제 side effect 실행은 명시적 script와 env guard를 사용한다.
- Stress raw artifact는 `test/stress/reports/.tmp-*`에 mode `0600`으로 만들고 종료 시 제거한다. parser와 renderer source는 `test/stress/evidence`가 소유한다.
- `jest` runner/dependency를 재도입하지 않는다.

## Runner owner

- 공통 transform: `vitest.config.base.ts`
- lane config: `vitest.config.{unit,integration,e2e,stress}.ts`
- semantic collection guard: `test/architecture/testing/api-test-runner-boundary.spec.ts`
- Integration guide: `test/integration/README.md`
- Stress guide: `test/stress/README.md`

## Auth release evidence

Password reset HTTP transaction evidence는 `test/e2e/auth/password-reset-recovery.e2e-spec.ts`, SES sandbox operation은 `test/operations/release/auth/`, 실행 경계는 `infra/runbooks/auth-password-reset-release-evidence.md`를 따른다.
