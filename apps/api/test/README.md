# apps/api test runner guide

이 문서는 `apps/api` 테스트 러너의 source of truth다. API 테스트는 **Vitest + SuperTest** 조합을 사용한다. SuperTest는 HTTP request harness이고, Vitest는 test runner/assertion/mocking surface다.

## API tests use Vitest + SuperTest

- Vitest: test runner, assertion, mocking API의 source of truth.
- SuperTest: Nest HTTP integration/e2e에서 request harness 역할만 맡는다.

## Command matrix

| 목적                        | 명령                                                                                                     | 비고                                                                                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| API unit 전체               | `pnpm api:test`                                                                                          | repo root alias. 내부적으로 `apps/api` Vitest unit config를 실행한다.                                                                  |
| API unit 직접 실행          | `pnpm --dir apps/api test`                                                                               | `vitest.config.unit.ts`, `--maxWorkers=50%`.                                                                                           |
| API integration 전체        | `pnpm --dir apps/api test:integration`                                                                   | `vitest.config.integration.ts`, DB sandbox 안정성을 위해 `--maxWorkers=1`.                                                             |
| API e2e 전체                | `pnpm --dir apps/api test:e2e`                                                                           | `vitest.config.e2e.ts`, e2e spec이 없어도 green이 되도록 `passWithNoTests`를 유지한다.                                                 |
| API coverage                | `pnpm --dir apps/api test:cov`                                                                           | Vitest V8 coverage provider 사용.                                                                                                      |
| Architecture guard targeted | `pnpm --dir apps/api exec vitest run --config ./vitest.config.unit.ts --maxWorkers=50% src/architecture` | 구조/경계 회귀를 빠르게 확인할 때 사용한다.                                                                                            |
| TypeScript check            | `pnpm api:typecheck`                                                                                     | source TypeScript typecheck. Vitest config 직접 typecheck가 필요하면 별도 `tsc --ignoreConfig ... vitest.config.*.ts` 명령을 사용한다. |

## Authoring rules

- 새 API spec은 `vitest`에서 필요한 API를 명시 import한다.

  ```ts
  import { beforeEach, describe, expect, it, vi } from 'vitest';
  ```

- mock은 `vi.fn()`, `vi.spyOn()`, `vi.mock()`, `vi.useFakeTimers()`를 사용한다.
- `jest` global, `jest.Mock*` type, `@jest/globals`, Jest config file, Jest runner dependency를 재도입하지 않는다.
- HTTP integration/e2e에서는 SuperTest default import를 유지한다.

  ```ts
  import request from 'supertest';
  ```

- Integration/e2e는 DB schema/env mutation이 있으므로 serial-safe config를 유지한다: `pool: 'forks'`, `fileParallelism: false`, CLI `--maxWorkers=1`.
- Request fixture의 user-agent 문자열처럼 제품/테스트 데이터에 포함된 단순 문자열 `jest`는 runner API가 아니므로 금지 대상이 아니다.
- `test:cov`가 생성하는 `apps/api/coverage/`는 generated artifact다. ESLint는 이 디렉터리를 lint하지 않고, coverage 품질 정책은 별도 threshold로만 다룬다.

## Where to change runner behavior

- 공통 Vitest/Nest SWC transform: `apps/api/vitest.config.base.ts`.
- Unit include/setup: `apps/api/vitest.config.unit.ts`, `apps/api/test/setup/vitest.setup.ts`.
- Integration include/setup: `apps/api/vitest.config.integration.ts`, `apps/api/test/setup/vitest.integration.setup.ts`.
- E2E include/setup: `apps/api/vitest.config.e2e.ts`.
- Official scripts: root `package.json`의 `api:test`, `test:api`, `api:test:integration`; API `package.json`의 `test*` scripts.
- Runner regression guard: `apps/api/src/architecture/api-test-runner-boundary.spec.ts`.
