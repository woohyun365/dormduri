# Monorepo CI baseline

API/Web CI 구조를 최적화하기 전에 현재 command graph, 반복 준비 작업, 실행시간과 known blocker를
재현 가능하게 기록합니다. 이 문서는 성능 개선의 비교 기준이며 제품 정책의 source of truth는
아닙니다.

## 측정 기준

- 기준일: 2026-08-06
- 런타임: Node.js 24, pnpm 11.7.0
- 원격 기준: GitHub-hosted `ubuntu-24.04`
- 로컬 기준: 개발 장비의 warm dependency/store 상태
- 시간은 서로 다른 환경 간 절대 성능 비교가 아니라 같은 command graph의 전후 비교에만 사용합니다.

## Frozen dependency input for the next measurement set

2026-08-26 기준 다음 CI 성능 표본은 `dev` commit
`db9638295f8191eced847950fb704c19ae780ba8`의 dependency/toolchain 상태를 기준으로 수집합니다. 정확한 input SHA-256,
acceptance run, queue, security, cache snapshot은 `scripts/ci/fixtures/ci-performance-baseline.json`의
`dependencyBaseline`이 소유합니다.

| Boundary               | Frozen value                                                       |
| ---------------------- | ------------------------------------------------------------------ |
| Node / pnpm            | Node 24.19.0 / pnpm 11.7.0                                         |
| pnpm action            | v6.0.10 / `0977fd99...`                                            |
| PostgreSQL             | 18.6 / `d3e1620b...a65b2`                                          |
| Alertmanager           | 0.34.0 / `690c7b52...0340d`                                        |
| Grafana                | 13.2.0 / `3fd54ae1...2429b`                                        |
| Security               | open alerts 0, reviewed dismissed residuals 4                      |
| Dependency queue       | open PR 0, Dashboard approvals 0, Automated PRs owner-verified off |
| Actions cache snapshot | 29 entries / 7,475,286,431 bytes (about 6.96GiB)                   |
| Current test inventory | 690 files / 3,401 cases                                            |

Accepted hosted runs are PR #356 `32688187840`, #357 `32691749046`, #358 `32694665874`, #362 `32910632496`, and #363
`32936730911`. A security-critical dependency change invalidates this freeze or requires explicit reconciliation before later
samples are compared.

This is a CI measurement input, not production release evidence. Grafana 13.2 local recovery samples increased from a prior 17.3s
sample to 25.3s and 27.4s while staying within health/resource gates; production persistent-volume rollback and provider billing
remain separate release/owner evidence.

## Working tree ownership

측정 당시 아래 파일은 이 CI/test cleanup과 무관한 선행 작업이므로 수정하거나 완료 근거에 포함하지
않습니다.

- `apps/api/test/architecture/matching/pair-only-policy-boundary.spec.ts`
- `apps/web/src/auth/flows/signup/components/__tests__/LegalConsentStep.test.tsx`
- `apps/web/src/landing/components/__tests__/LandingHeader.test.tsx`
- `apps/web/src/landing/sections/LandingSupportSection.test.tsx`
- `DESIGN.md`

CI/test cleanup은 `scripts/ci/`, API test runner/integration support, Web Home/Matching/RoommateTab
architecture·Storybook test와 이 문서를 소유합니다.

## Historical GitHub Actions baseline

최근 성공 PR run은 현재 Vitest lane 분리 이전 실행이므로 절대적인 최신 suite 시간은 아니지만,
workflow setup과 repeated preparation 비용의 기준으로 사용합니다.

| Workflow | Run           | 총 시간 | 주요 구간                                                               |
| -------- | ------------- | ------: | ----------------------------------------------------------------------- |
| API CI   | `29311900784` |  5m 02s | PostgreSQL 24s, install 26s, static 1m 22s, API tests 2m 02s, build 28s |
| Web CI   | `29311900780` |  7m 25s | cache 7s, install 16s, `check:web` 5m 08s, Chromium 31s, smoke 1m 01s   |

### 최근 10개 merged PR 표본

2026-08-06에 `gh pr list/view`, `gh run list/view`로 최종 head SHA의 성공한 pull request workflow를
수집했습니다. 이 표본은 selective monorepo orchestrator 반영 전이라 모든 PR에서 API와 Web이 함께
실행된 개선 전 기준입니다. Runner 합계는 API와 Web duration의 합, wall은 두 workflow 중 긴 값입니다.

| PR   | 분류        |    API |    Web |   Wall | Runner 합계 |
| ---- | ----------- | -----: | -----: | -----: | ----------: |
| #302 | Shared/root | 5m 05s | 7m 28s | 7m 28s |     12m 33s |
| #301 | Shared/root | 5m 15s | 6m 27s | 6m 27s |     11m 42s |
| #298 | Shared/root | 5m 11s | 6m 23s | 6m 23s |     11m 34s |
| #297 | Web-only    | 4m 58s | 6m 00s | 6m 00s |     10m 58s |
| #296 | Web-only    | 5m 06s | 5m 58s | 5m 58s |     11m 04s |
| #295 | Web-only    | 5m 02s | 5m 41s | 5m 41s |     10m 43s |
| #294 | Shared/root | 4m 57s | 5m 30s | 5m 30s |     10m 27s |
| #292 | Shared/root | 5m 11s | 4m 53s | 5m 11s |     10m 04s |
| #291 | Shared/root | 5m 13s | 4m 59s | 5m 13s |     10m 12s |
| #287 | Shared/root | 4m 48s | 4m 31s | 4m 48s |      9m 19s |

| 분류        | 표본 | Wall p50 | Wall p95 | Runner p50 | Runner p95 |
| ----------- | ---: | -------: | -------: | ---------: | ---------: |
| Web-only    |    3 |   5m 58s |   6m 00s |    10m 58s |    11m 03s |
| Shared/root |    7 |   5m 30s |   7m 10s |    10m 27s |    12m 18s |
| 전체        |   10 |   5m 50s |   7m 01s |    10m 51s |    12m 10s |

최근 10개에는 API-only PR이 없어 API-only p50/p95는 미측정입니다. 새 orchestrator에서 각 분류별 성공
run 10개가 쌓인 뒤 같은 방식으로 다시 측정해야 하며, 이 baseline만으로 selective CI 목표 달성을
주장하지 않습니다.

개선 전 10개 workflow의 단계별 p50/p95:

| Stage                                |    p50 |    p95 |
| ------------------------------------ | -----: | -----: |
| API install                          |    25s |    26s |
| API Shared build + Prisma generation |     8s |    10s |
| API public schema migration          |     2s |     3s |
| API static                           | 1m 23s | 1m 25s |
| API aggregate tests                  | 2m 01s | 2m 05s |
| API build                            |    28s |    31s |
| Web pnpm cache restore               |     7s |     8s |
| Web install                          |    16s |    19s |
| Web aggregate static/unit/build      | 3m 47s | 4m 46s |
| Browser install                      |    27s |    32s |
| Browser smoke                        |    54s | 1m 00s |

## Current command graph

### API workflow 한 번당 반복 준비 횟수

| 준비 작업                     |                       횟수 | 호출 경로                                                                  |
| ----------------------------- | -------------------------: | -------------------------------------------------------------------------- |
| shared build                  |                          7 | workflow 1 + `check:api` 1 + unit/integration/e2e/stress 4 + `build:api` 1 |
| Prisma generate               |                          7 | workflow 1 + `check:api` 1 + unit/integration/e2e/stress 4 + `build:api` 1 |
| public schema migration       |                          1 | workflow의 `prisma migrate deploy`                                         |
| integration sandbox migration | integration 실행 결과 참조 | disposable schema 생성마다 `prisma migrate deploy`                         |

### Web workflow 한 번당 반복 준비 횟수

| 준비 작업             | 횟수 | 호출 경로                                                               |
| --------------------- | ---: | ----------------------------------------------------------------------- |
| shared build          |    6 | workflow 1 + lint/typecheck/test/build 4 + Playwright webServer build 1 |
| Next production build |    2 | `check:web` 1 + Playwright webServer 1                                  |

로컬 public command가 독립 실행 가능한 성질은 유지하되, CI aggregate에서는 준비된 command를 사용해
이 반복을 제거하는 것이 후속 작업의 목표입니다.

## Prepare-once 적용 결과

2026-08-06 구현 기준 command graph는 다음과 같습니다.

| Lane   | Shared build | Prisma generate | Next build | 실행 경계                                             |
| ------ | -----------: | --------------: | ---------: | ----------------------------------------------------- |
| Shared |            1 |               0 |          0 | build 후 prepared contract test                       |
| API    |            1 |               1 |          0 | `api:prepare` 후 prepared check/test/build            |
| Web    |            1 |               0 |          1 | `web:prepare`, prepared check, prebuilt browser smoke |

Public app 명령은 fresh checkout에서 단독 실행할 수 있도록 준비 작업을 포함한다. GitHub Actions는
`.github/workflows/ci.yml`이 선택한 reusable app workflow에서만 `*:prepared` capability를 사용한다.
Playwright는 이미 생성한 standalone artifact에 `static`과 `public`을 복사한 뒤 기동하며, source
artifact가 없으면 browser test 전에 fail-fast한다.

## Local baseline

구조 cleanup 전 기준:

| Command/lane       | 결과                          |    시간 |
| ------------------ | ----------------------------- | ------: |
| API unit           | passed                        |  18.06s |
| API integration    | passed                        | 216.19s |
| API E2E            | passed                        |   5.32s |
| API stress harness | passed                        |   0.88s |
| Web lint           | Chat lint blocker             |  17.15s |
| Web typecheck      | passed                        |  10.71s |
| Web Vitest         | 1212 passed, 4 stale failures |  32.02s |
| Web build          | passed                        |  11.62s |

구조 cleanup 후 검증:

| Command/lane       | 결과                            |                                          시간 |
| ------------------ | ------------------------------- | --------------------------------------------: |
| API unit           | 382 files / 1693 tests passed   |                 Vitest 18.79s, command 21.35s |
| API integration    | 40 files / 225 tests passed     |               Vitest 256.15s, command 259.72s |
| API E2E            | 1 file / 1 test passed          |                   Vitest 5.62s, command 8.14s |
| API stress harness | 17 files / 74 tests passed      |                   Vitest 0.83s, command 3.28s |
| Web lint           | 기존 Chat error 1개·warning 1개 |                                command 20.36s |
| Web typecheck      | passed                          |                                command 16.14s |
| Web Vitest         | 204 files / 1179 tests passed   | latest Vitest 30.13s; measured command 35.15s |

## Change classifier evidence

초기 red baseline에서 `node --test scripts/ci/classify-changes.test.mjs`는 workflow의 전체 실행 동작을
모델링해 6개 fixture 중 root-toolchain 1개만 통과하고 5개가 실패했습니다.

- Web-only가 API/repo-policy까지 실행됨
- API-only가 Web/repo-policy까지 실행됨
- shared contract가 repo-policy까지 실행됨
- API database infra가 Web까지 실행됨
- docs-only가 Web/API까지 실행됨

현재 classifier는 Web-only, Storybook-only, API-only, Shared, root toolchain, API infra, docs-only,
unknown path fixture를 모두 통과합니다. Unknown path와 comparison failure는 모든 lane을 실행하는
fail-open validation으로 수렴하고, classifier job 자체가 실패하면 `CI summary`가 fail-closed합니다.

`node --test scripts/ci/*.test.mjs`는 classifier, policy source, standalone artifact, workflow command
boundary를 함께 검증하며 current CD boundary test를 포함해 통과합니다.

## Web build-once local evidence

- Web product/test/e2e/Storybook typecheck 통과
- Web Vitest 204 files / 1179 tests 통과, Vitest 30.08s
- Next production build 통과, compile 3.1s
- prebuilt Playwright server 기동 시 Next build 재호출 없음
- prebuilt desktop/mobile Chromium targeted smoke 2건 통과
- 조건부 Storybook static build 통과
- 현재 browser smoke는 21 passed / 2 skipped / 5 stale locator failures
- Web lint는 기존 Chat error 1개와 warning 1개로 중단

Reusable Web workflow는 job duration을 `$GITHUB_STEP_SUMMARY`에 기록한다. Web-only PR p95는 실제
orchestrator run이 누적된 뒤 최근 run 기준으로 갱신하며 cache hit를 correctness 전제로 사용하지
않는다.

## Known blockers and stale assertions

구조 cleanup 전 Web baseline은 다음을 별도 문제로 확인했습니다.

- Chat hook lint: effect 내부 state update
- Chat room lint: effect dependency warning
- Landing policy source가 retired numbered docs 경로를 고정
- Home overlay가 이전 fixed-body scroll lock을 기대
- Roommate search cursor recovery가 복구된 append 결과를 누락

Landing/Home/Roommate의 stale assertion은 observable production behavior와 tracked docs 경로 기준으로
정리합니다. Chat lint는 이 작업의 소유 범위가 아니므로 별도 blocker로 유지합니다.

## Migration evidence

Integration helper는 `KNU_INTEGRATION_MIGRATION_EVIDENCE_FILE`을 명시한 검증 실행에서만 성공한
sandbox migration을 JSONL로 기록합니다. 환경 변수가 없으면 파일·production log를 만들지 않습니다.

실행 예:

```bash
KNU_INTEGRATION_MIGRATION_EVIDENCE_FILE=/tmp/knu-integration-migrations.jsonl \
  pnpm --dir apps/api test:integration
wc -l /tmp/knu-integration-migrations.jsonl
```

2026-08-06 최적화 전 full integration 실행은 40 files / 225 tests를 통과했고 disposable schema
migration을 **41회** 실행했습니다. Domain lifecycle case를 같은 sandbox runner로 합친 뒤에는
27 files / 225 tests가 201.93초(Vitest), 202.55초(command)에 통과했고 migration은 **27회**였습니다.

Behavior name set은 전후 동일하며 migration 14회(약 34.1%)를 제거했습니다. 259.72초였던 기존
command baseline과 비교하면 local warm run은 57.17초(약 22.0%) 단축되었습니다. Access control,
migration status, connection-time처럼 독립 schema가 의미를 갖는 suite는 합치지 않았습니다.

통합 후 p95를 판정할 원격 run evidence는 아직 누적되지 않았지만 local full run이 5분 이내이므로
API fast/DB job split은 적용하지 않습니다. Integration/E2E는 DB race를 피하기 위해 worker 1을 유지합니다.
