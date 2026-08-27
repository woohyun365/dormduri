# API integration tests

실제 Nest application, Prisma, SQL helper와 disposable PostgreSQL schema가 필요한 product invariant를 검증한다.

## Runner와 격리

- 수집: `test/integration/**/*.integration.spec.ts`
- 실행: `pnpm --dir apps/api test:integration`
- 격리: suite별 disposable schema, case 사이 truncate, `app close → sandbox cleanup`
- side effect 격리: 자동 mail dispatcher는 끄고, worker 동작은 owning test가 명시적으로 호출
- 실행 안전성: `pool: 'forks'`, `fileParallelism: true`, `--maxWorkers=2`; 각 fork는 suite별 UUID schema를 독립 소유

## 구조

```text
test/integration/
├── _support/
│   ├── fixtures/              # reference, participant, match, auth context별 좁은 fixture
│   ├── integration-app.ts
│   ├── integration-db.ts
│   └── integration-suite.ts
├── auth/
│   ├── auth-lifecycle.integration.spec.ts
│   ├── auth-service.integration-cases.ts
│   ├── auth-users-transaction.integration-cases.ts
│   └── verification/
├── users/display-identity/
├── chat/chat-lifecycle.integration.spec.ts
├── retention/retention-lifecycle.integration.spec.ts
├── roommate-search/roommate-search-lifecycle.integration.spec.ts
├── season-participants/season-registration-lifecycle.integration.spec.ts
└── <small-domain>/            # 한 책임이면 불필요한 하위 디렉터리를 만들지 않음
```

대형 suite의 공통 setup은 수집되지 않는 `*.integration-cases.ts` registrar가 보존한다. 같은 fixture와
schema lifecycle을 공유할 수 있는 case owner는 domain runner 하나가 함께 등록한다. Access control,
migration status, DB time boundary처럼 격리 자체가 검증 의미인 runner는 독립 schema를 유지한다.
새 테스트는 가능한 한 owning spec에 직접 작성하고 registrar를 다시 거대화하지 않는다.

## Fixture boundary

- `_support`는 test infrastructure이며 product `support/` 도메인과 다르다.
- barrel 없이 필요한 fixture module을 직접 import한다.
- unrelated setup은 production mapper를 재사용할 수 있지만 mapper/persistence 검증의 expected data는 명시적으로 작성한다.
- 표준 lifecycle은 `useIntegrationTestSuite`를 우선하고 custom env/cross-test state가 있으면 직접 hook을 유지하며 이유를 기록한다.
- Suite cleanup은 app close 실패와 DB cleanup 실패를 독립적으로 수집해 한 쪽 오류 때문에 다른 정리가 생략되지 않게 한다.

## Coverage labels

`policy-matrix`, `transaction-atomicity`, `concurrency-race`, `idempotency`, `side-effect-rollback`, `stale-state-recheck`, `db-time-boundary`, `worker-claim`, `security-boundary`, `query-cost-guard`, `retention-archive`, `wrapper-contract`, `transaction-infrastructure`를 사용한다.

Mutation test는 visible preflight 후 authoritative state를 바꾸고, transaction 내부 재검증 결과와 ghost side effect 부재를 함께 검증한다. Query budget은 fixture setup 전체가 아니라 안정적인 product action만 감싼다.

## Targeted commands

```bash
pnpm --dir apps/api exec vitest run --config ./vitest.config.integration.ts --maxWorkers=1 test/integration/auth/auth-lifecycle.integration.spec.ts
pnpm --dir apps/api exec vitest run --config ./vitest.config.integration.ts --maxWorkers=1 test/integration/chat/chat-lifecycle.integration.spec.ts
pnpm --dir apps/api exec vitest run --config ./vitest.config.integration.ts --maxWorkers=1 test/integration/roommate-search/roommate-search-lifecycle.integration.spec.ts
```

경로 이동 시 `test/architecture/testing/api-acid-coverage.spec.ts`의 concrete coverage reference와 관련 runbook을 함께 갱신한다. exact file inventory guard는 만들지 않는다.

## Migration evidence

```bash
KNU_INTEGRATION_MIGRATION_EVIDENCE_FILE=/tmp/knu-integration-migrations.jsonl \
  pnpm --dir apps/api ci:test:integration
wc -l /tmp/knu-integration-migrations.jsonl
```

Evidence opt-in이 없으면 파일이나 product log를 만들지 않는다. Current full suite는 27 files / 225 tests / migration
27회다. Sequential baseline span 95.48s에서 worker 2 반복 span 47.42s, 48.73s, 53.69s로 감소했으며 세 번 모두 같은
inventory와 migration count를 통과했다. Worker 3 이상이나 별도 CI job shard는 추가 cost evidence가 없으므로 사용하지
않는다. Targeted one-file debugging command는 noise를 줄이기 위해 `--maxWorkers=1`을 유지한다.
