# API integration tests

실제 Nest application, Prisma, SQL helper와 disposable PostgreSQL schema가 필요한 product invariant를 검증한다.

## Runner와 격리

- 수집: `test/integration/**/*.integration.spec.ts`
- 실행: `pnpm --dir apps/api test:integration`
- 격리: suite별 disposable schema, case 사이 truncate, `app close → sandbox cleanup`
- 실행 안전성: `pool: 'forks'`, `fileParallelism: false`, `--maxWorkers=1`

## 구조

```text
test/integration/
├── _support/
│   ├── fixtures/              # reference, participant, match, auth context별 좁은 fixture
│   ├── integration-app.ts
│   ├── integration-db.ts
│   └── integration-suite.ts
├── auth/
│   ├── registration/
│   ├── credentials/
│   ├── sessions/
│   └── verification/
├── users/display-identity/
├── chat/                      # message, rate-limit, read-marker, outbox, lifecycle
├── retention/                 # retained identity, archive/review job, vault, thread retention
├── roommate-search/           # scope/manifest, exposure, filters, pagination
├── season-participants/       # profile draft, dormitory, registration, concurrency
└── <small-domain>/            # 한 책임이면 불필요한 하위 디렉터리를 만들지 않음
```

대형 legacy suite의 공통 setup은 수집되지 않는 `*.integration-cases.ts` registrar가 보존한다. 수집되는 얇은 `*.integration.spec.ts`가 lifecycle owner를 선택하므로, targeted 실행과 assertion 보존을 함께 만족한다. 새 테스트는 가능한 한 owning spec에 직접 작성하고 registrar를 다시 거대화하지 않는다.

## Fixture boundary

- `_support`는 test infrastructure이며 product `support/` 도메인과 다르다.
- barrel 없이 필요한 fixture module을 직접 import한다.
- unrelated setup은 production mapper를 재사용할 수 있지만 mapper/persistence 검증의 expected data는 명시적으로 작성한다.
- 표준 lifecycle은 `useIntegrationTestSuite`를 우선하고 custom env/cross-test state가 있으면 직접 hook을 유지하며 이유를 기록한다.

## Coverage labels

`policy-matrix`, `transaction-atomicity`, `concurrency-race`, `idempotency`, `side-effect-rollback`, `stale-state-recheck`, `db-time-boundary`, `worker-claim`, `security-boundary`, `query-cost-guard`, `retention-archive`, `wrapper-contract`, `transaction-infrastructure`를 사용한다.

Mutation test는 visible preflight 후 authoritative state를 바꾸고, transaction 내부 재검증 결과와 ghost side effect 부재를 함께 검증한다. Query budget은 fixture setup 전체가 아니라 안정적인 product action만 감싼다.

## Targeted commands

```bash
pnpm --dir apps/api exec vitest run --config ./vitest.config.integration.ts --maxWorkers=1 test/integration/auth/registration/signup-transaction.integration.spec.ts
pnpm --dir apps/api exec vitest run --config ./vitest.config.integration.ts --maxWorkers=1 test/integration/chat/messages.integration.spec.ts
pnpm --dir apps/api exec vitest run --config ./vitest.config.integration.ts --maxWorkers=1 test/integration/roommate-search/filters.integration.spec.ts
```

경로 이동 시 `test/architecture/testing/api-acid-coverage.spec.ts`의 concrete coverage reference와 관련 runbook을 함께 갱신한다. exact file inventory guard는 만들지 않는다.
