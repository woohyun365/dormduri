# Monorepo CI architecture

## 책임

KNU Roommate의 pull request와 default `main` push 검증은 `.github/workflows/ci.yml`이 진입점이다. `dev`는 active ruleset이 PR-only integration과 green `CI summary`를 요구하므로 merge 직후 같은 graph를 다시 실행하지 않는다. Workflow는 변경 경로를 분류하고 필요한 reusable app workflow만 호출한다. Pull request에서는 분류와 무관하게 `Lifecycle gate`도 실행하고, 항상 존재하는 `CI summary` job에서 선택된 lane과 `Lifecycle gate`의 성공 여부를 fail-closed로 판정한다.

현재 workflow는 CI만 제공한다. Image publish, production environment approval, deployment identity, rollout, traffic switch, rollback은 포함하지 않는다. Production CD 구현 전 입력은 `docs/deploy/production-environment.md`가 소유한다.

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
  ├─ api
  │   ├─ core      # static, runtime contract, unit, E2E, stress, build, compose
  │   ├─ shard 1   # integration 1/2 + 독립 PostgreSQL
  │   └─ shard 2   # integration 2/2 + 독립 PostgreSQL
  ├─ web
  │   ├─ core      # static, build, optional Storybook, browser smoke
  │   └─ unit      # Node/jsdom Vitest projects
  ├─ infra         # infra와 observability 변경
  ├─ repo-policy   # CI/workflow/root policy, tree 전체 guard와 repository formatting
  └─ agent-workflow # agent workflow test(package install 없음)
lifecycle-gate     # 모든 pull request(분류와 무관): PR 본문 Lifecycle 절과 정책 우선·영역 기준 존재·리뷰 snapshot 검사
CI summary         # 선택된 모든 lane과 pull request의 lifecycle-gate 결과를 하나의 required check로 판정
```

- Web-only 변경은 API/PostgreSQL lane을 실행하지 않는다.
- API-only 변경은 Web/Playwright lane을 실행하지 않는다.
- Shared/root toolchain 변경은 Shared, API, Web을 함께 검증한다.
- Storybook-owned 변경은 Web lane 안에서만 Storybook static build를 추가한다.
- Docs-only 변경은 product lane을 실행하지 않는다.
- Agent workflow(host 설정, agent script·test·문서), repository 지원 script·설정, tracked local record 변경도 repo-policy lane과
  agent-workflow lane만 실행한다. Agent workflow test가 읽는 product 파일을 바꾸면 그 product lane과 함께 agent-workflow lane도
  실행한다. 다만 lane job이 실행·import하거나 lane package 파일이 import·참조하는 저장소 script는 그 lane도 실행한다.
- 비교 기준 계산 실패 또는 알 수 없는 경로는 모든 검증 lane으로 fail-open한다.
- `Lifecycle gate`는 `pull_request` event 조건으로만 실행되고 `CI summary`도 같은 조건으로 선택 여부를 정한다. Job은 실행 시점의
  PR 본문을 REST API로 읽고(`pull-requests: read`는 이 job에만), event의 base·head merge-base부터 head까지의 diff에 정책 우선
  검사와 영역 기준 존재 검사, 경고만 내는 리뷰 snapshot 검사를 적용한다. 본문 API·경로 표 JSON·merge-base 오류와, 제품 경로를
  바꾼 PR의 리뷰 기준 catalog·영역 검사 제외 표 형식 오류는 job 실패다. Push에서는 건너뛰고 `CI summary`는 그 `skipped`를 통과로
  본다. 검사 판정은 `scripts/ci/lifecycle/`, PR 작성법은 [GitHub collaboration guide](../../development/github/collaboration.md#lifecycle-절)가
  소유한다.
- Repo-policy lane의 formatting 검사는 formatting 설정이 그대로이고 PR base·push 범위 기준의 변경 목록을 얻은 경우에만
  변경 파일로 좁히고, 그 밖에는 tree 전체를 검사한다. 판정 규칙은 CI surface ownership의 "Formatting 검사 범위"가 소유한다.

경로 family별 표면·lane·owner와 새 경로를 추가하는 절차는
[CI surface ownership](../../development/ci/ci-surface-ownership.md)이 소유한다. 분류 개선의 문제·측정·결정 기록은
[CI change classification evidence](../../evidence/ci/ci-change-classification-evidence.md)에 둔다.

분류 source of truth는 `scripts/ci/lanes/classify-changes.mjs`이며 path matrix는 `scripts/ci/lanes/fixtures/`와 Node built-in tests가 고정한다.

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
- API runtime emit은 ESM-configured Nest SWC를 사용하고 TypeScript noEmit typecheck는 static gate가 별도로 소유한다. API는
  private runtime app이므로 declaration emit을 build artifact로 사용하지 않는다.
- API job은 public CI schema migration을 한 번 적용한 뒤 TypedSQL/Prisma prepare를 실행한다. Integration/E2E suite의
  owner-local disposable schema migration은 별도 test isolation 경계다.
- Web core job은 Next production build를 한 번 수행하고 같은 workspace의 standalone artifact로 desktop/mobile Chromium
  smoke를 실행한다. Web unit job은 독립적으로 실행되어 static/build/browser와 wall time을 공유하지 않는다.
- `actions/setup-node`가 pnpm store cache를 관리한다. 이 action은 workflow에서 안정적인 hit/miss output을 제공하지 않으므로 install duration을 관측 신호로 사용한다.
- Web TypeScript build-info는 architecture, lockfile, config, source-aware exact key와 config-compatible restore prefix를
  사용한다. 상대 경로만 포함하는 약 865KB 파일이며 stateful DB나 secret을 포함하지 않는다. API build-info는 hosted
  static stage를 줄이지 못해 cache하지 않는다.
- Web `.next/cache`는 별도 `actions/cache`가 관리하고 `next_build_cache_hit`을 summary에 남긴다. Key는 OS/architecture,
  lockfile, Next/package/tsconfig toolchain으로 고정하고 source hash를 포함하지 않는다. Turbopack이 changed source를
  invalidation하며, corrective push마다 새 230MB entry를 만드는 대신 PR ref마다 한 entry를 재사용한다.
- Cache는 repository별 10GiB 경계와 7일 retention을 사용한다. pnpm과 Next family를 별도로 측정하며, 80%부터 eviction
  churn 검토 신호로 사용한다.
- Routine 성공 artifact는 downstream consumer가 없으면 업로드하지 않는다. Playwright report와 failure evidence는
  browser failure에서만 업로드하고 7일 안에 만료한다. Cache와 달리 Actions artifact/Packages shared allowance에
  포함된다.

Web standalone output은 약 54MiB uncompressed이고 browser consumer가 하나뿐이다. Build와 browser를 별도 runner로 나누면
artifact upload/download와 두 번째 install이 생기지만 production build 11초를 제거하지 못한다. 따라서 build artifact를
Actions storage로 전송하지 않고 core job의 workspace에서 직접 재사용한다.

## Compiler와 runner 경계

Nest default TypeScript emit은 current local median 6.42s였고 configured ESM SWC는 1.59s였다. SWC output은 production
788 JS/source-map paths, decorator metadata, `dist/main.js`, health startup과 non-root Docker runtime을 보존한다. Default Nest
SWC의 CommonJS output, `dist/src` nesting, spec emit은 current ESM deployment와 호환되지 않아 사용하지 않는다. Current
compiler contract는 `apps/api/test/architecture/platform/api-build-compiler-boundary.spec.ts`가 고정한다.

Next 16은 Turbopack을 기본 bundler로 사용하고 repository에 Babel fallback config가 없다. Cross-run filesystem cache를
제거한 hosted A/B에서 production build가 cached 10s에서 cold 43s로 증가했으므로 cache는 retained decision이다. Build cache
flag를 별도로 강제하지 않고 current Next default/config compatibility를 lockfile upgrade 때 재검증한다.

Classify, Lifecycle gate, CI summary는 product compile을 수행하지 않으므로 official `ubuntu-slim` 1-core x64 runner를 사용한다.
Repository policy는 slim에서 docs/config feedback budget을 넘겨 standard `ubuntu-24.04`로 복구했다. Shared/API/Web/Infra도
standard x64에 남는다. Product arm64는 Prisma, SWC, Argon2, Playwright, Docker와 cache architecture parity를 증명하기
전에는 사용하지 않는다. Larger runner는 personal repository의 current owner surface가 아니며 cost-neutral evidence도 없어
사용하지 않는다.

## Web unit test environment 경계

Web unit tests는 전용 Web unit CI job의 한 Vitest process 안에서 두 project로 실행한다.

- Node-safe `.ts` tests: Node environment, DOM setup 없음
- `.tsx` tests와 명시적 `.dom.test.ts`: jsdom environment, `src/test-setup.ts` 적용
- Current inventory: Node 107 files / 621 cases, jsdom 114 files / 611 cases; total 221 files / 1,232 cases
- Pool: repeated local correctness/timing을 통과한 `threads`; 고정 `maxWorkers`는 사용하지 않음

DOM 의존 TypeScript test는 suffix로 owner를 드러내며, `scripts/ci/product/web-vitest-project-ownership.test.mjs`가 exact-once
inventory, Node project의 Testing Library exclusion, jsdom-only setup을 고정한다. Node/jsdom project를 각각 별도 GitHub
job이나 artifact로 나누지 않는다. Unit cohort 전체만 static/build/browser core와 병렬화한다.

Hosted Web-only evidence는 동일 221 files / 1,232 cases에서 Web unit 181s와 one-time rerun 184s를 기록했다. 이전 full-PR
stage provisional p50 267s 대비 각각 32.2%, 31.1% 감소했고 default first-attempt Web-only run은 12 rounded billed minutes로
15-minute advisory boundary 안에 있다. 자연 발생 post-change sample이 추가되기 전에는 이 두 observation을 안정된 p50이나
p95로 승격하지 않는다.

## Web workflow DAG 경계

Web unit은 current Web job에서 가장 긴 독립 cohort였고 production build나 browser artifact를 소비하지 않는다. Hosted
evidence에서 unit만 별도 runner로 이동했을 때 workflow wall은 460s에서 286s로 줄었고 raw compute와 rounded billing은
bounded하게 증가했다. 상세 수치는 [CI baseline](../../evidence/ci/monorepo-ci-baseline.md)이 소유한다.

Static, build, Storybook, browser는 core job에 남는다. Static/build/browser를 더 나누는 구조, Web Node/jsdom project별
shard, API core의 추가 split, 별도 nested summary runner는 duplicated install과 job rounding 대비 추가 acceptance 근거가
없어 채택하지 않는다. Reusable workflow 전체 결과와 top-level `CI summary`가 child failure나 cancellation을 fail-closed하게
집계한다.

## API integration database 경계

Integration spec은 UUID가 포함된 disposable schema를 생성하고 migration, runtime `DATABASE_URL`, app, truncate, cleanup을
해당 suite가 소유한다. `integration-db.ts`는 schema 생성 후 migration을 적용하고 `app close → DROP SCHEMA CASCADE` 순서로
정리한다. Local/full command는 이 process isolation을 이용해 worker 2를 사용한다.

Hosted runner에서는 같은 job의 worker 2가 CPU와 PostgreSQL resource를 공유해 frozen p50 대비 목표 개선율을 충족하지
못했다. CI는 stable Vitest `1/2`, `2/2` shard를 별도 runner와 PostgreSQL service에 배치하고 각 shard 내부를 worker 1로
유지한다. Current inventory 27 files / 225 tests / 27 migrations는 local shard 기준 14 files / 123 tests / 15 migrations와
13 files / 102 tests / 12 migrations로 정확히 합쳐진다. E2E/stress는 integration shard에 포함하지 않으며 top-level
fail-closed summary가 reusable API workflow의 모든 job 결과를 집계한다.

두 hosted 반복에서 느린 shard도 frozen integration p50 대비 acceptance를 넘었고 full-run job rounding 환산은 기존
baseline의 20% 증가 상한 안에 남았다. API-only run은 15-minute advisory를 초과하므로 duplicated install/prepare와 artifact
reuse는 후속 DAG 최적화 대상이다. Timing과 cost 수치는
[CI baseline](../../evidence/ci/monorepo-ci-baseline.md)이 소유한다.

## Stage timing evidence

`scripts/ci/lanes/run-timed-command.mjs`는 install, prepare, static, unit, DB suite, build, browser 단계를 실행하면서 `GITHUB_STEP_SUMMARY`에 시간과 성공 여부를 남긴다. 실패한 command의 exit code를 그대로 반환하므로 timing 수집이 gate 의미를 바꾸지 않는다.

Historical pre-optimization evidence와 active post-change measurement epoch는 같은 fixture가 소유하지 않는다.
`ci-performance-baseline.json`은 비교 denominator를 immutable하게 보존하고, `ci-performance-active-epoch.json`은 current
dependency/image input을 소유한다. Actions collector는 current checkout이 아니라 각 workflow run head commit의 input을
읽어 fingerprint를 생성한다. Image input은 `infra/image-inventory.json`과 그 inventory가 가리키는 owner 파일의 image
reference이므로 tag나 digest만 바뀐 image update도 fingerprint를 바꾼다. Report는 epoch, exact input hash, event, change
surface가 다른 표본을 하나의 cohort로 합치지 않는다.

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

Web core summary 단계:

- install
- prepare
- static
- build
- optional Storybook
- browser install
- browser smoke
- Next cache hit/miss

Web unit summary 단계:

- install
- prepare
- unit

## Historical baseline과 performance budget

선택 실행 도입 전에는 모든 PR이 API·Web workflow를 함께 실행했다. 2026-08-06에 수집한 최근 merged PR 10개의 wall p50은
5m 50s였고, 당시 API job은 unit test만 실행했다. 같은 시기에 API CI가 integration·E2E·stress까지 실행하게 되면서 full
fan-out의 critical path가 API·Web job으로 바뀌었다. 개선 전 표본, 단계별 p50/p95, 개선별 전후 측정은
[Monorepo CI restructuring evidence](../../evidence/ci/monorepo-ci-restructuring-evidence.md)와
[CI baseline](../../evidence/ci/monorepo-ci-baseline.md)이 소유한다. 아래 budget은 분류별 성공 run이 쌓인 뒤 판정하며,
개선 전 표본만으로 목표 달성을 주장하지 않는다.

Rollout budget:

| 분류                |    p95 목표 |
| ------------------- | ----------: |
| Web-only            |     5m 이하 |
| API-only            |     5m 이하 |
| Shared/root fan-out |     8m 이하 |
| Docs-only           | 1m 30s 이하 |
| Agent workflow      |     4m 이하 |

Job-rounded billed-minute advisory budget:

| 분류                | p95 budget |
| ------------------- | ---------: |
| Full/shared fan-out | 30 minutes |
| API-only            | 15 minutes |
| Web-only            | 15 minutes |
| Infra-only          | 10 minutes |
| Docs/config/tooling |  5 minutes |
| Agent workflow      |  7 minutes |

Product lane이 없는 PR(Docs-only, Docs/config/tooling, Agent workflow)은 모두 `repoPolicy`와 `agentWorkflow`를 선택해
classify, Repository policy gate, Agent workflow gate, CI summary를 실행한다(pull request에서는 Lifecycle gate도). Lane 선택이 같으므로 Agent workflow 분류는 변경
경로로 고른다: agent 지침·adapter·script·test·host 설정을 바꾼 PR이다. 성능 collector의 surface는 lane 기준이라 이 셋을
`docs-config-tooling-only`로 묶는다. 그래서 Agent workflow 예산은 collector의 advisory budget fixture에 두지 않고
[CI baseline](../../evidence/ci/monorepo-ci-baseline.md)의 분류별 표본으로 판정한다.
Agent workflow 목표는 job 분리 뒤 agent-only 표본 14개의 p95에서 정한 회귀 방지선이다. Wall은 p95 3m 32s를 올린 4m, job 분
올림 합은 p95와 같은 7분이다. Docs-only와 Docs/config/tooling 목표는 Agent workflow gate가 생기기 전부터 있던 값이다. 지금 product
lane이 없는 PR은 Agent workflow gate가 critical path이고, 이런 PR 15개(agent-only 14, Docs/config/tooling 1)의 job 분 올림 합 p95
7분이 Docs/config/tooling 목표를 넘는다. Docs 경로만 바꾼 PR의 표본은 1개라 Docs-only 목표는 아직 판정하지 않는다
([CI change classification evidence](../../evidence/ci/ci-change-classification-evidence.md) §6).
`Lifecycle gate`는 이 표본 뒤에 더해진 job이라 위 job 분 올림 합에 들어 있지 않고, 모든 pull request에 `ubuntu-slim` job 하나를 더한다.

Runner minutes도 함께 본다. Job split으로 wall time이 줄어도 total runner minutes가 증가하면 자동 채택하지 않는다. 표본과 산출 근거는 `docs/evidence/ci/`에 유지한다.

비용 budget은 초기에는 advisory다. 표준 private-repository Linux 2-core list rate는 2026-08-26 공식 문서 기준
`$0.006/min`이며, 포함 minutes 할인 전 gross estimate에만 사용한다. 표본 5개 전에는 p50, 10개 전에는 p95를 게시하지
않는다. 실제 discount/net은 별도 Plan-Read credential을 child process에만 주입하는 `pnpm github:account:evidence`의
allowlisted 결과와 owner Billing UI/CSV가 일치할 때만 비용 ledger에 반영한다. PR별 list-price estimate와 account-level
discount/net은 서로 다른 책임이므로 합산하거나 대체하지 않는다.

## Verification과 revisit trigger

- `pnpm ci:performance:collect`는 run identity, changed paths, expected/observed lane, stage, cache, tests, artifact, retry/waste와
  list-price gross estimate를 `.artifacts/tools/ci-performance/`에 저장한다.
- `pnpm ci:performance:resources`는 cache family와 artifact/Packages visibility를 별도 snapshot으로 수집한다.
- `pnpm ci:performance:report`는 dependency fingerprint가 같은 자연 발생 PR만 cohort 통계로 집계한다.
- `pnpm github:account:evidence`는 billing token을 daily gh와 분리하고 account usage·repository resource의 sanitized
  snapshot만 `.artifacts/tools/github/`에 기록한다.
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
node --test scripts/ci/{lanes,performance,contracts,product,lifecycle}/*.test.mjs
pnpm api:check
pnpm api:test:ci
pnpm api:build
pnpm web:check
pnpm web:e2e
```

변경 범위에 맞는 targeted command를 먼저 실행하고, workflow/classifier 변경은 repo policy tests와 app별 full gate로 마감한다. Alias 제거 시에는 package scripts, README, workflow, runbook callsite를 함께 검색한다.
