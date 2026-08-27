# API test runner guide

`apps/api`의 테스트 runner source of truth다. Unit은 production source와 colocate하고, cross-cutting architecture와 별도 환경이 필요한 검증은 `test/`에 둔다.

## Command matrix

| Lane                             | 명령                                   | 수집 범위 / 책임                                                                     |
| -------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------ |
| Unit + architecture + operations | `pnpm --dir apps/api test`             | `src/**/*.spec.ts`, `test/architecture/**/*.spec.ts`, `test/operations/**/*.spec.ts` |
| Integration                      | `pnpm --dir apps/api test:integration` | disposable PostgreSQL을 사용하는 `test/integration/**/*.integration.spec.ts`         |
| E2E                              | `pnpm --dir apps/api test:e2e`         | 실제 HTTP 경계의 `test/e2e/**/*.e2e-spec.ts`                                         |
| Stress harness                   | `pnpm --dir apps/api test:stress`      | K6/Artillery/Docker 실행기가 아닌 parser·fixture·redaction·static contract           |
| Local aggregate                  | `pnpm api:test:ci`                     | 준비 작업 후 위 네 lane을 순차 실행                                                  |
| CI prepared aggregate            | `pnpm api:test:ci:prepared`            | workflow에서 Shared/Prisma 준비를 마친 뒤 위 네 lane만 실행                          |
| Coverage                         | `pnpm --dir apps/api test:cov`         | unit V8 coverage                                                                     |
| Product typecheck                | `pnpm --dir apps/api typecheck`        | production source                                                                    |
| Test typecheck                   | `pnpm --dir apps/api typecheck:test`   | test support와 별도 runner source                                                    |
| Shared contract                  | `pnpm shared:test`                     | Shared build 후 schema behavior와 public export surface 검증                         |

K6, Artillery, Docker load는 일반 CI aggregate에 포함하지 않는다. 승인된 로컬 rehearsal 또는 운영 evidence 수집에서 `stress:*` 명령을 별도로 실행한다.

Shared contract lane의 public 명령 `pnpm shared:test`는 fresh checkout에서 단독 실행할 수 있도록 build를 선행한다. CI prepare-once 경계에서는 Shared build 후 `pnpm shared:test:prepared`를 사용하고, `pnpm shared:typecheck:test`로 test source를 별도 검사한다. Monorepo change classifier는 `packages/shared/**` 변경을 Shared lane과 API/Web consumer 검증 모두에 fan-out한다.

API public 명령은 fresh checkout에서 단독 실행할 수 있도록 `ci:prepare`를 포함한다. workflow와 root aggregate는 `pnpm api:prepare`를 한 번 실행한 뒤 `*:prepared` 명령만 호출한다. prepared 명령은 Shared build나 Prisma generate를 암묵적으로 다시 실행하지 않는다.

## Authoring rules

- Vitest API는 `vitest`에서 명시적으로 import한다.
- 제품 behavior spec은 production source와 함께 두고 실제 함수·서비스·repository의 관찰 가능한 결과를 검증한다. 자기 구현 파일을 `node:fs`로 다시 읽어 문자열을 비교하지 않는다.
- import 방향·public surface·purity 같은 정적 invariant는 `test/architecture`, SQL·migration·배포 artifact·runbook evidence는 `test/operations`가 소유한다.
- `@repo/shared` schema behavior와 package export surface는 `packages/shared/test`가 소유한다. API는 transport/presenter 또는 API-local orchestration만 검증한다.
- Integration spec 하나는 하나의 user journey 또는 transaction invariant를 소유하고, 공통 DB seed와 app lifecycle은 `test/integration/_support`에서 재사용한다.
- Integration은 suite별 UUID schema ownership을 전제로 `pool: 'forks'`, `fileParallelism: true`, `--maxWorkers=2`를
  사용한다. E2E는 `fileParallelism: false`, `--maxWorkers=1`을 유지한다.
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

Password reset HTTP transaction evidence는 `test/e2e/auth/password-reset-recovery.e2e-spec.ts`, SES sandbox operation은 `test/operations/release/auth/`, 실행 경계는 `infra/runbooks/release/components/auth/password-reset-evidence.md`를 따른다.
