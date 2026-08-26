# Monorepo CI architecture

## 책임

KNU Roommate의 pull request와 default `main` push 검증은 `.github/workflows/ci.yml`이 진입점이다. `dev`는 active ruleset이 PR-only integration과 green `CI summary`를 요구하므로 merge 직후 같은 graph를 다시 실행하지 않는다. Workflow는 변경 경로를 분류하고 필요한 reusable app workflow만 호출한 뒤, 항상 존재하는 `CI summary` job에서 선택된 lane의 성공 여부를 fail-closed로 판정한다.

현재 workflow는 CI만 제공한다. Image publish, production environment approval, deployment identity, rollout, traffic switch, rollback은 포함하지 않는다. Production CD 구현 전 입력은 `docs/development/future-production-deployment-inputs.md`가 소유한다.

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

API Integration/E2E는 disposable PostgreSQL schema race를 피하기 위해 worker 1을 유지한다. K6/Artillery/Docker real load는 일반 CI가 아니라 local/staging rehearsal이 소유한다.

## Build와 cache 경계

- API job은 Shared build와 Prisma generation을 각각 한 번 수행한다.
- API job은 public CI schema migration을 한 번 적용한 뒤 TypedSQL/Prisma prepare를 실행한다. Integration/E2E suite의
  owner-local disposable schema migration은 별도 test isolation 경계다.
- Web job은 Next production build를 한 번 수행하고 같은 standalone artifact로 desktop/mobile Chromium smoke를 실행한다.
- `actions/setup-node`가 pnpm store cache를 관리한다. 이 action은 workflow에서 안정적인 hit/miss output을 제공하지 않으므로 install duration을 관측 신호로 사용한다.
- Web `.next/cache`는 별도 `actions/cache`가 관리하고 `next_build_cache_hit`을 summary에 남긴다. Cache miss에서도 correctness가 유지되어야 한다.

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

Runner minutes도 함께 본다. Job split으로 wall time이 줄어도 total runner minutes가 증가하면 자동 채택하지 않는다. 최근 10개 표본과 산출 근거는 `docs/development/ci/monorepo-ci-baseline.md`에 유지한다.

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
