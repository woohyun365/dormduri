# Monorepo CI architecture

## 책임

KNU Roommate의 pull request와 default `main` push 검증은 `.github/workflows/ci.yml`이 진입점이다. `dev`는 active ruleset이 PR-only integration과 green `CI summary`를 요구하므로 merge 직후 같은 graph를 다시 실행하지 않는다. Workflow는 변경 경로를 분류하고 필요한 reusable app workflow만 호출한 뒤, 항상 존재하는 `CI summary` job에서 선택된 lane의 성공 여부를 fail-closed로 판정한다.

현재 workflow는 CI만 제공한다. Image publish, production environment approval, deployment identity, rollout, traffic switch, rollback은 포함하지 않는다. Production CD 구현 전 입력은 `docs/development/future-production-deployment-inputs.md`가 소유한다.

## Decision과 drivers

이 저장소는 사용자 Web, BFF, API와 공유 contract를 하나의 TypeScript workspace로 유지한다. CI 비용만 줄이기 위해
repository를 분리하지 않고, 변경 surface 분류·준비 작업 재사용·상태 격리·선택적 병렬화로 실행 graph를 개선한다.

결정의 drivers는 다음과 같다.

- `packages/shared`의 request/response schema와 상수는 Web/API가 같은 변경에서 함께 검증해야 한다.
- 하나의 lockfile과 catalog는 framework·validation·test toolchain의 버전 drift를 줄인다.
- FE/BE/contract 변경을 한 PR에서 atomic하게 검토할 수 있어 별도 schema publish와 compatibility coordination이 줄어든다.
- lint, typecheck, test와 onboarding command를 공통화할 수 있다.
- 반대로 root/shared/lockfile 변경은 여러 lane과 cache를 무효화하고, 무분별한 job 분리는 cache transfer·install·분 단위
  billing을 반복한다.

## Alternatives와 consequences

- **Repository 분리:** 독립 release/data/ownership 경계가 생기기 전에는 contract publish와 호환성 관리 비용이 더 크므로
  채택하지 않는다.
- **모든 변경에서 전체 CI:** 가장 단순하지만 제품과 무관한 문서/tooling 변경에도 API/Web runner 비용을 발생시키므로
  사용하지 않는다. 알 수 없는 경로와 분류 실패만 correctness 우선으로 fail-open한다.
- **먼저 job을 많이 분할:** wall time은 줄어도 raw compute, cache transfer와 job별 올림 비용이 증가할 수 있어 기본값으로
  사용하지 않는다. 한 job 안의 준비 재사용과 환경 분리를 먼저 측정한다.
- **Turborepo/remote cache 즉시 도입:** native workflow 개선 이후에도 대표 narrow PR에서 충분한 hit와 추가 절감이 확인될
  때만 재검토한다.

결과적으로 monorepo의 atomic change 장점은 유지되지만, root/shared 변경의 넓은 fan-out은 의도된 비용으로 남는다. 성능
최적화는 wall time만이 아니라 raw compute, job-rounded minutes, transfer/storage와 실패·retry waste를 함께 통과해야 한다.

## Job graph

```text
classify
  ├─ shared        # packages/shared 또는 root/shared contract 변경
  ├─ api           # apps/api와 API-owned infra 변경
  ├─ web           # apps/web 변경
  ├─ infra         # infra와 observability 변경
  ├─ repo-policy   # CI/workflow/root policy와 repository formatting
  └─ CI summary    # 선택된 모든 lane의 결과를 하나의 required check로 판정
```

- Web-only 변경은 API/PostgreSQL lane을 실행하지 않는다.
- API-only 변경은 Web/Playwright lane을 실행하지 않는다.
- Shared/root toolchain 변경은 Shared, API, Web을 함께 검증한다.
- Storybook-owned 변경은 Web lane 안에서만 Storybook static build를 추가한다.
- Docs-only 변경은 product lane을 실행하지 않는다.
- 비교 기준 계산 실패 또는 알 수 없는 경로는 모든 검증 lane으로 fail-open한다.

분류 source of truth는 `scripts/ci/classify-changes.mjs`이며 path matrix는 `scripts/ci/fixtures/`와 Node built-in tests가 고정한다.

## Public command와 prepared command

Public command는 fresh checkout에서 단독 실행할 수 있도록 Shared build나 Prisma generation을 포함한다. CI는 app job마다 prepare를 한 번만 실행하고 이후 `*:prepared` command만 사용한다.

| 목적               | Local public command                  | CI command                               |
| ------------------ | ------------------------------------- | ---------------------------------------- |
| API 준비           | public command가 자동 수행            | `pnpm api:prepare`                       |
| API static         | `pnpm api:check`                      | `pnpm api:check:prepared`                |
| API unit           | `pnpm api:test`                       | `pnpm api:test:prepared`                 |
| API integration    | `pnpm api:test:integration`           | `pnpm api:test:integration:prepared`     |
| API E2E            | `pnpm api:test:e2e`                   | `pnpm api:test:e2e:prepared`             |
| API stress harness | `pnpm api:test:stress`                | `pnpm api:test:stress:prepared`          |
| API build          | `pnpm api:build`                      | `pnpm api:build:prepared`                |
| Web 준비           | public command가 자동 수행            | `pnpm web:prepare`                       |
| Web static         | `pnpm web:lint`, `pnpm web:typecheck` | 각 prepared command                      |
| Web unit           | `pnpm web:test`                       | `pnpm web:test:prepared`                 |
| Web build          | `pnpm web:build`                      | `pnpm web:build:prepared`                |
| Web browser smoke  | `pnpm web:e2e`                        | `pnpm web:e2e:prepared`                  |
| Storybook static   | `pnpm web:storybook:build`            | Storybook 변경일 때 `ci:storybook:build` |

API Integration의 local/full command는 suite별 UUID PostgreSQL schema와 fork process isolation을 전제로 worker 2를
사용한다. Hosted CI는 두 runner가 각각 독립 PostgreSQL service와 Vitest shard 하나를 소유한다. E2E는 core API job에서
worker 1을 유지한다. K6/Artillery/Docker real load는 일반 CI가 아니라 local/staging rehearsal이 소유한다.

## Build와 cache 경계

- API job은 Shared build와 Prisma generation을 각각 한 번 수행한다.
- API job은 public CI schema migration을 한 번 적용한 뒤 TypedSQL/Prisma prepare를 실행한다. Integration/E2E suite의
  owner-local disposable schema migration은 별도 test isolation 경계다.
- Web job은 Next production build를 한 번 수행하고 같은 standalone artifact로 desktop/mobile Chromium smoke를 실행한다.
- `actions/setup-node`가 pnpm store cache를 관리한다. 이 action은 workflow에서 안정적인 hit/miss output을 제공하지 않으므로 install duration을 관측 신호로 사용한다.
- Web `.next/cache`는 별도 `actions/cache`가 관리하고 `next_build_cache_hit`을 summary에 남긴다. Cache miss에서도 correctness가 유지되어야 한다.
- Cache는 repository별 10GiB 경계와 7일 retention을 사용한다. pnpm과 Next family를 별도로 측정하며, 80%부터 eviction
  churn 검토 신호로 사용한다.
- Routine 성공 artifact는 downstream consumer가 없으면 업로드하지 않는다. 현재 browser/infra evidence는 7일 안에
  만료되며, cache와 달리 Actions artifact/Packages shared allowance에 포함된다.

## Web unit test environment 경계

Web unit tests는 한 Vitest process와 한 CI job 안에서 두 project로 실행한다.

- Node-safe `.ts` tests: Node environment, DOM setup 없음
- `.tsx` tests와 명시적 `.dom.test.ts`: jsdom environment, `src/test-setup.ts` 적용
- Current inventory: Node 107 files / 621 cases, jsdom 114 files / 611 cases; total 221 files / 1,232 cases
- Pool: repeated local correctness/timing을 통과한 `threads`; 고정 `maxWorkers`는 사용하지 않음

DOM 의존 TypeScript test는 suffix로 owner를 드러내며, `scripts/ci/web-vitest-project-ownership.test.mjs`가 exact-once
inventory, Node project의 Testing Library exclusion, jsdom-only setup을 고정한다. Test project는 별도 GitHub job이나
artifact로 분리하지 않는다. 현재 evidence에서 shard의 install/cache/billed-minute 중복을 정당화할 필요가 없기 때문이다.

Hosted Web-only evidence는 동일 221 files / 1,232 cases에서 Web unit 181s와 one-time rerun 184s를 기록했다. 이전 full-PR
stage provisional p50 267s 대비 각각 32.2%, 31.1% 감소했고 default first-attempt Web-only run은 12 rounded billed minutes로
15-minute advisory boundary 안에 있다. 자연 발생 post-change sample이 추가되기 전에는 이 두 observation을 안정된 p50이나
p95로 승격하지 않는다.

## API integration database 경계

Integration spec은 UUID가 포함된 disposable schema를 생성하고 migration, runtime `DATABASE_URL`, app, truncate, cleanup을
해당 suite가 소유한다. `integration-db.ts`는 schema 생성 후 migration을 적용하고 `app close → DROP SCHEMA CASCADE` 순서로
정리한다. Local/full command는 이 process isolation을 이용해 worker 2를 사용한다.

Hosted runner에서는 같은 job의 worker 2가 CPU와 PostgreSQL resource를 공유해 frozen p50 대비 목표 개선율을 충족하지
못했다. CI는 stable Vitest `1/2`, `2/2` shard를 별도 runner와 PostgreSQL service에 배치하고 각 shard 내부를 worker 1로
유지한다. Current inventory 27 files / 225 tests / 27 migrations는 local shard 기준 14 files / 123 tests / 15 migrations와
13 files / 102 tests / 12 migrations로 정확히 합쳐진다. E2E/stress는 integration shard에 포함하지 않으며 top-level
fail-closed summary가 reusable API workflow의 모든 job 결과를 집계한다.

## Stage timing evidence

`scripts/ci/run-timed-command.mjs`는 install, prepare, static, unit, DB suite, build, browser 단계를 실행하면서 `GITHUB_STEP_SUMMARY`에 시간과 성공 여부를 남긴다. 실패한 command의 exit code를 그대로 반환하므로 timing 수집이 gate 의미를 바꾸지 않는다.

API summary 단계:

- install
- public schema migration
- prepare
- static
- runtime config/health contract
- unit
- integration-db
- e2e-db
- stress-harness
- build
- compose

Web summary 단계:

- install
- prepare
- static
- unit
- build
- optional Storybook
- browser install
- browser smoke
- Next cache hit/miss

## Historical baseline과 performance budget

2026-08-06에 수집한 최근 10개 merged PR은 현재 selective orchestrator가 merge되기 전의 unconditional API/Web workflow 결과다. 따라서 아래 값은 개선 전 기준이며 새 구조의 달성 결과가 아니다.

| 변경 분류   | 표본 | PR wall p50 | PR wall p95 | runner 합계 p50 | runner 합계 p95 |
| ----------- | ---: | ----------: | ----------: | --------------: | --------------: |
| Web-only    |    3 |      5m 58s |      6m 00s |         10m 58s |         11m 03s |
| Shared/root |    7 |      5m 30s |      7m 10s |         10m 27s |         12m 18s |
| 전체        |   10 |      5m 50s |      7m 01s |         10m 51s |         12m 10s |

최근 10개 표본에는 API-only PR이 없으므로 API-only p50/p95는 미측정 상태다. Selective workflow가 원격에서 실행된 뒤 분류별 성공 run 10개가 쌓이기 전에는 목표 달성을 주장하지 않는다.

개선 전 단계별 p50/p95:

| Lane stage                           |    p50 |    p95 |
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

Rollout budget:

| 분류                |    p95 목표 |
| ------------------- | ----------: |
| Web-only            |     5m 이하 |
| API-only            |     5m 이하 |
| Shared/root fan-out |     8m 이하 |
| Docs-only           | 1m 30s 이하 |

Job-rounded billed-minute advisory budget:

| 분류                | p95 budget |
| ------------------- | ---------: |
| Full/shared fan-out | 30 minutes |
| API-only            | 15 minutes |
| Web-only            | 15 minutes |
| Infra-only          | 10 minutes |
| Docs/config/tooling |  5 minutes |

Runner minutes도 함께 본다. Job split으로 wall time이 줄어도 total runner minutes가 증가하면 자동 채택하지 않는다. 최근 10개 표본과 산출 근거는 `docs/development/ci/monorepo-ci-baseline.md`에 유지한다.

비용 budget은 초기에는 advisory다. 표준 private-repository Linux 2-core list rate는 2026-08-26 공식 문서 기준
`$0.006/min`이며, 포함 minutes 할인 전 gross estimate에만 사용한다. 표본 5개 전에는 p50, 10개 전에는 p95를 게시하지
않는다. 실제 discount/net은 별도 Plan-Read credential을 child process에만 주입하는 `pnpm github:account:evidence`의
allowlisted 결과와 owner Billing UI/CSV가 일치할 때만 비용 ledger에 반영한다. PR별 list-price estimate와 account-level
discount/net은 서로 다른 책임이므로 합산하거나 대체하지 않는다.

## Verification과 revisit trigger

- `pnpm ci:performance:collect`는 run identity, changed paths, expected/observed lane, stage, cache, tests, artifact, retry/waste와
  list-price gross estimate를 `artifacts/local/ci-performance/`에 저장한다.
- `pnpm ci:performance:resources`는 cache family와 artifact/Packages visibility를 별도 snapshot으로 수집한다.
- `pnpm ci:performance:report`는 dependency fingerprint가 같은 자연 발생 PR만 cohort 통계로 집계한다.
- `pnpm github:account:evidence`는 billing token을 daily gh와 분리하고 account usage·repository resource의 sanitized
  snapshot만 `artifacts/local/github/`에 기록한다.
- Concurrent contributor, stale-base failure, p95 budget 초과, cache 80% 이상 churn, test inventory drift 또는 default-branch
  검증 공백이 관측되면 분류·ruleset·job graph를 재검토한다.
- Repository 분리는 독립 release/data/ownership boundary가 실제로 생겼을 때, Turborepo/remote cache는 native 개선 후에도
  대표 narrow PR에서 비용을 포함한 추가 이득이 남을 때만 재검토한다.

## Branch protection 적용

Optional app job은 변경 분류에 따라 `skipped`될 수 있으므로 개별 API/Web/Infra job이 아니라 `CI summary` 하나를 required
check로 사용한다.

- `dev-integration-gate`: exact `dev`, PR 필수, conversation resolution, linear history, squash only, `CI summary`, force
  push/deletion 차단.
- `main-release-gate`: default `main`, PR 필수, conversation resolution, merge commit only, `CI summary`, force push/deletion
  차단.
- Strict up-to-date는 한 owner의 순차 integration과 Actions 비용을 고려해 기본 off다. Concurrent contributor 또는 stale-base
  failure가 관측되면 재검토한다.

Check 이름이나 workflow/job 이름을 변경할 때 ruleset과 이 문서를 함께 갱신한다. Repository setting mutation은 tracked
source merge로 완료됐다고 주장하지 않고 `remote-repository-settings.md`의 read-only evidence로 확인한다.

## 변경 시 검증

```bash
node --test scripts/ci/*.test.mjs
pnpm api:check
pnpm api:test:ci
pnpm api:build
pnpm web:check
pnpm web:e2e
```

변경 범위에 맞는 targeted command를 먼저 실행하고, workflow/classifier 변경은 repo policy tests와 app별 full gate로 마감한다. Alias 제거 시에는 package scripts, README, workflow, runbook callsite를 함께 검색한다.
