# Monorepo CI baseline

API/Web CI 구조를 최적화하기 전에 현재 command graph, 반복 준비 작업, 실행시간과 known blocker를
재현 가능하게 기록합니다. 이 문서는 성능 개선의 비교 기준이며 제품 정책의 source of truth는
아닙니다.

## 측정 기준

- 기준일: 2026-08-06
- 런타임: Node.js 24, pnpm 11.7.0
- 원격 기준: product jobs는 GitHub-hosted `ubuntu-24.04`, stateless orchestration은 `ubuntu-slim`
- 로컬 기준: 개발 장비의 warm dependency/store 상태
- 시간은 서로 다른 환경 간 절대 성능 비교가 아니라 같은 command graph의 전후 비교에만 사용합니다.

## Frozen dependency input for the next measurement set

2026-08-26 기준 다음 CI 성능 표본은 `dev` commit
`db9638295f8191eced847950fb704c19ae780ba8`의 dependency/toolchain 상태를 기준으로 수집합니다. 정확한 input SHA-256,
acceptance run, queue, security, cache snapshot은 `scripts/ci/fixtures/ci-performance-baseline.json`의
`dependencyBaseline`이 소유합니다.

`fileSha256`는 현재 표본이 계속 일치해야 하는 dependency/image input입니다. `workflowBaselineSha256`는 최적화 전 workflow
comparison snapshot이며 workflow 최적화 이후 current tree와 달라지는 것이 정상입니다.

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

### First frozen-input event pair

The same accepted change ran once for PR #364 and again automatically after squash merge to `dev`.

| Event        | Run           | Wall | Raw compute | Rounded billed minutes |                   Tests |
| ------------ | ------------- | ---: | ----------: | ---------------------: | ----------------------: |
| Pull request | `32939047806` | 589s |      1,196s |                     25 | 690 files / 3,401 cases |
| `dev` push   | `32939810146` | 622s |      1,405s |                     29 | 690 files / 3,401 cases |

The active `dev` ruleset already requires PR-only integration and a green `CI summary`, so the second equivalent graph did not add
a distinct acceptance boundary. Monorepo CI therefore runs on pull requests and `main` pushes; routine `dev` merge pushes do not
start another graph. `main` remains a separate default-branch evidence owner until its release/security responsibilities are
narrowed with evidence.

Collect additional runs without storing raw logs:

```bash
pnpm ci:performance:collect -- \
  --repo=woohyun365/knu_roommate \
  --run-id=<run-id> \
  --output=artifacts/local/ci-performance/<dataset>.json
```

The collector accepts completed runs and records run/job/stage timing, queue, raw compute, per-job rounded minutes, runner labels,
cache hit/size, test counts, artifact metadata, PR/base identity, expected/observed lane, retry와 failed/cancelled compute를
기록합니다. Natural PRs populate surface cohorts; no-op PRs are not created only to increase sample count.

현재 resource snapshot과 cohort report를 함께 생성합니다.

```bash
pnpm ci:performance:resources -- \
  --repo=woohyun365/knu_roommate \
  --output=artifacts/local/ci-performance/resources-<date>.json

pnpm ci:performance:report -- \
  --input=artifacts/local/ci-performance/<dataset>.json \
  --resource-inventory=artifacts/local/ci-performance/resources-<date>.json \
  --output=artifacts/local/ci-performance/cohort-report.json
```

Report는 중복 run ID를 제거하고 dependency fingerprint가 다른 표본이나 frozen input을 변경한 run을 거부합니다. 주요
성능 cohort는 `pull_request` event만 사용하며, 과거 `dev` push처럼 다른 event는 별도 event cohort로 남겨 섞인 통계를
만들지 않습니다.

## Current frozen-input cohort

2026-08-27 현재 동일 dependency fingerprint로 재수집한 성공 run은 다음과 같습니다.

| Event          | Run           | Observed surface | Wall | Raw compute | Rounded billed | Gross list estimate |
| -------------- | ------------- | ---------------- | ---: | ----------: | -------------: | ------------------: |
| Pull request   | `32939047806` | full             | 589s |      1,196s |             25 |              $0.150 |
| Retired `push` | `32939810146` | full             | 622s |      1,405s |             29 |              $0.174 |
| Pull request   | `32945877705` | full             | 618s |      1,425s |             30 |              $0.180 |
| Pull request   | `32952015500` | full             | 659s |      1,539s |             30 |              $0.180 |
| Pull request   | `33031304442` | full             | 590s |      1,299s |             27 |              $0.162 |
| Pull request   | `33041754596` | full             | 616s |      1,416s |             28 |              $0.168 |

Gross estimate는 2026-08-26 [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)의
표준 Linux 2-core list rate `$0.006/min`을 job별 rounded minute에 적용한 값입니다.
Included minutes discount와 실제 net invoice가 아니며, Billing UI/API evidence 없이 비용 ledger의 실제 지출로 합산하지
않습니다.

Full PR cohort는 5개이며 provisional p50은 wall 616s, raw compute 1,416s, rounded billed 28분, list gross `$0.168`입니다.
p95는 10개 전까지 게시하지 않습니다. API-only, Web-only, Infra-only, docs/config/tooling-only cohort도 아직 없습니다.

Phase 6/7의 provisional stage denominator:

| Stage                 | Sample count |  Min |  Max | Provisional p50 |
| --------------------- | -----------: | ---: | ---: | --------------: |
| Web unit tests        |            5 | 182s | 315s |            267s |
| Web static checks     |            5 | 108s | 156s |            144s |
| API integration tests |            5 | 227s | 246s |            240s |
| API unit tests        |            5 | 133s | 142s |            140s |
| API static checks     |            5 |  71s |  78s |             73s |
| Web production build  |            5 |   8s |  11s |              9s |
| API production build  |            5 |  15s |  16s |             15s |

Generated local authority is `artifacts/local/ci-performance/phase5-final-provisional-report.json`. Full PR operations report zero
retry, failed job, cancelled job, and wasted compute across the comparable dataset.

### Current Web-only environment partition evidence

PR #370 run `33048619750` preserves 221 Vitest files / 1,232 cases and 26 browser cases while running only Web and repository-policy
lanes.

| Observation              | Web unit |                Full workflow wall |               Raw compute |                Rounded billed |  Gross list estimate |
| ------------------------ | -------: | --------------------------------: | ------------------------: | ----------------------------: | -------------------: |
| First attempt            |     181s |                              453s |                      518s |                            12 |             `$0.072` |
| One-time stability rerun |     184s | not a first-attempt cohort sample | aggregated retry evidence | 12 incremental / 24 aggregate | `$0.072` incremental |

The two hosted unit observations improve from the 267s frozen provisional p50 by 32.2% and 31.1%. Both attempts passed without a
test failure or source correction. The deliberate rerun is retained as operational retry cost and stability evidence, not as a
second natural PR sample. Local repeated runs and coverage also passed; current project ownership is Node 107 files / 621 cases and
jsdom 114 files / 611 cases.

This candidate does not publish a post-change p50 or p95 yet. Additional compatible Web-only PRs accumulate naturally. The first
attempt remains inside the 15-minute Web-only billed advisory boundary, while the 453s workflow wall shows that later workflow/DAG
work is still needed to reach the broader 300~360s narrow-PR target.

Generated local evidence:

- `artifacts/local/ci-performance/web-environment-partition-pr370.json`
- `artifacts/local/ci-performance/web-environment-partition-pr370-rerun.json`

PR `32939047806`의 변경은 현재 classifier 기준 Infra+repository-policy였지만 당시 workflow는 Shared/API/Web까지
실행했습니다. `observedSurface=full`, `expectedSurface=infra-only`, `selectionMatchesObservedJobs=false`로 기록되어 변경 분류
false positive와 실제 runner 비용을 구분합니다.

## Current cache, artifact, and Packages inventory

2026-08-27 read-only inventory:

| Resource        | Current evidence                                           | Boundary / interpretation                                   |
| --------------- | ---------------------------------------------------------- | ----------------------------------------------------------- |
| Actions cache   | 29 entries / 7,475,286,431 bytes / 69.6% of 10GiB          | pnpm 15개·4,744,577,759B, Next 14개·2,730,708,672B          |
| Artifacts       | active 104개 / 8,178,655 bytes / observed retention 7 days | expired metadata 247개; active size는 allowance보다 작음    |
| GitHub Packages | owner-verified zero                                        | 별도 `read:packages` credential 없이 owner UI evidence 사용 |

Cache는 80%부터 key churn과 eviction을 검토합니다. Artifact와 Packages는 shared storage이고 cache 10GiB는 별도 경계입니다.
Owner Billing UI와 Packages billing contract의 2GB를 effective shared boundary로 사용하고, Actions 문서의 GitHub Pro
artifact 1GB 표기는 provider reference 차이로 별도 보존합니다. 현재 active artifact 약 7.8MiB는 어느 경계보다도 작습니다.

같은 기간의 account-level sanitized usage는 `pnpm github:account:evidence`로 수집합니다. 2026-08 상세 usage는 Actions Linux
3,143분과 Actions Storage 6.259958986 GB-hours이며, gross/discount 모두 `$18.860103243`, net `$0`으로 확인했습니다. 이
account billing evidence는 위 PR별 list-price estimate를 대체하지 않고 실제 할인·지출을 해석하는 별도 계층입니다.

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

## Historical local baseline (2026-08-06)

아래 값은 prepare-once 구조를 적용하기 전후의 당시 local 비교 자료입니다. 현재 CI 성공 여부나 current blocker를 뜻하지
않습니다.

구조 변경 전 기준:

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

구조 변경 후 검증:

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

- Web product/test/e2e/Storybook static build 통과
- Frozen remote inventory 기준 Web Vitest 221 files / 1,232 tests 통과
- Next production build와 Sentry artifact boundary 통과
- prebuilt Playwright server 기동 시 Next build 재호출 없음
- prebuilt desktop/mobile Chromium targeted smoke 2건 통과
- Full remote browser smoke 26건 통과

Reusable Web workflow는 job duration을 `$GITHUB_STEP_SUMMARY`에 기록한다. Web-only PR p95는 실제
orchestrator run이 누적된 뒤 최근 run 기준으로 갱신하며 cache hit를 correctness 전제로 사용하지
않는다.

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

Current sequential rerun은 27 files / 225 tests / 27 migrations를 99.86s command, 95.48s test span에 완료했습니다. Suite별
UUID schema를 유지한 same-job worker 2 candidate는 세 번 연속 225/225 tests와 27 migrations를 통과했고 test span은
47.42s, 48.73s, 53.69s였습니다. Canonical command도 55.93s에 통과했습니다. Sequential span 대비 반복 median은 약 49.0%
감소했습니다.

첫 hosted worker 2 실행 `33075360973`은 27 files / 225 tests를 통과했지만 integration stage가 206s로, frozen p50 240s
대비 약 14.2% 감소하는 데 그쳤습니다. Local process에서는 효과가 컸지만 2 vCPU hosted runner에서 migration과 test가 같은
resource를 경쟁하므로 35% acceptance를 충족하지 못했습니다.

Accepted candidate는 API core job에서 integration을 분리하고, 독립 PostgreSQL service를 가진 두 runner가 stable Vitest
`1/2`, `2/2` shard를 실행합니다. Local shard inventory는 14 files / 123 tests / 15 migrations와 13 files / 102 tests / 12
migrations로 정확히 27 files / 225 tests / 27 migrations를 구성합니다. E2E는 DB/HTTP lifecycle이 달라 core job에서 worker
1을 유지합니다.

PR #371 run `33077630757`의 first attempt에서 shard stage는 113s와 114s, deliberate second attempt에서는 133s와
98s였습니다. 각 attempt의 느린 shard 114s, 133s median 123.5s는 frozen p50 240s 대비 약 48.5% 감소했고 두 번 모두 27
files / 225 tests를 정확히 한 번씩 통과했습니다. First attempt는 816 raw compute seconds / 18 rounded billed minutes,
second attempt 단독분은 823 raw seconds / 17 rounded minutes였습니다. Collector의 attempt 2 aggregate 1,639s / 35분은 두
실행의 합계이므로 단일 run 비용으로 해석하지 않습니다.

Frozen full baseline 25분에서 기존 API job 10분을 first/second attempt의 core+shard 14분/13분으로 치환하면 29분(+16%)과
28분(+12%)입니다. 둘 다 global 20% ceiling 안이지만 API-only 17~18분은 15-minute advisory를 초과합니다. 후속
DAG/artifact work는 중복 install/prepare를 줄여 이 advisory gap을 해결해야 하며, 자연 발생 표본이 쌓이기 전에는 이
두 deliberate attempt를 안정된 p50/p95로 승격하지 않습니다.

## Web workflow DAG evidence

PR #372 first source run `33082156350`은 Web unit cohort를 static/build/browser core와 별도 runner로 실행했습니다. Phase 6
final source `33050305663`의 Web-only workflow는 460s wall / 521 raw compute seconds / 12 rounded minutes였고 단일 Web job은
439s / 8분이었습니다. Candidate는 다음과 같습니다.

| Boundary                      | Wall | Rounded billed | Selected work                                           |
| ----------------------------- | ---: | -------------: | ------------------------------------------------------- |
| Web static/build/browser core | 265s |            5분 | static 148s, build 11s, prebuilt browser 27s            |
| Web unit                      | 208s |            4분 | 221 files / 1,232 tests, stage 154s                     |
| Whole Web-only workflow       | 286s |           13분 | 563 raw compute seconds, 1,258 total browser+unit cases |

Workflow wall은 174s, 약 37.8% 감소했습니다. Raw compute는 42s(+8.1%), rounded billing은 1분(+8.3%) 증가해 global
20%/35% gate 안에 남습니다. Production build는 한 번만 실행됐고 browser는 같은 core workspace의 standalone output을
사용했습니다.

첫 candidate는 성공 Playwright report 211,474 bytes를 7일 artifact로 업로드했습니다. Routine success report를 소비하는
operator workflow가 없으므로 final candidate는 성공 업로드를 제거하고 failure report/test-results만 7일 보존합니다.
Standalone build 약 54MiB는 consumer가 하나뿐이고 build 자체가 11s여서 upload/download 후보를 채택하지 않았습니다.

Final source run `33083313967`은 283s wall / 543 raw seconds / 13 rounded minutes였고 Web core 261s, Web unit 198s,
221 files / 1,232 unit tests, 26 browser cases를 통과했습니다. 성공 artifact는 0개였습니다. Phase 6 final 대비 wall은
177s(약 38.5%) 감소했고 raw compute는 22s(+4.2%), rounded billing은 1분(+8.3%) 증가했습니다. 두 source run이 같은
correctness와 cost boundary를 통과했지만 자연 발생 cohort가 아니므로 안정된 p50/p95로 승격하지 않습니다.

## Compiler and native cache evidence

PR #374 first source run `33139355819`은 compiler dependency 때문에 frozen dependency input이 의도적으로 바뀐 full-change
표본입니다. Workflow는 372s wall / 1,616 raw compute seconds / 34 rounded minutes / `$0.184` list gross로 통과했고 691 files /
3,403 cases를 실행했습니다. Phase 5 provisional full p50 616s / 1,416s / 28분 / `$0.168`와 비교하면 wall은 약 39.6%
감소했지만 first-run dependency/cache miss와 Storybook을 포함해 raw는 14.1%, rounded minutes는 21.4%, list gross는 9.5%
증가했습니다. Exact cache-hit source가 확인되기 전에는 최종 cost acceptance로 사용하지 않습니다.

| Candidate                       | First hosted evidence                           | Decision state                                   |
| ------------------------------- | ----------------------------------------------- | ------------------------------------------------ |
| Nest ESM SWC                    | API build 13s → 3s; local median 6.42s → 1.59s  | correctness parity 통과, retained candidate      |
| API TypeScript build-info       | miss static 73s; exact restore 2s + static 75s  | rejected; transfer보다 saved compute가 낮음      |
| Web TypeScript build-info       | miss static 120s; exact restore 2s + static 92s | retained candidate                               |
| Next cache removal              | cached build 10s → cold build 43s               | rejected; stable toolchain/config key로 복구     |
| `ubuntu-slim` classify          | 9s standard → 17s slim, rounded 1분             | `$0.006` → `$0.002`, retained candidate          |
| `ubuntu-slim` repository policy | 71s/2분 standard → 128s/3분 slim                | `$0.012` → `$0.006`, non-critical path candidate |
| `ubuntu-slim` summary           | 4s standard → 5s slim, rounded 1분              | `$0.006` → `$0.002`, retained candidate          |

변경 전 cache inventory는 30 entries / 7,626,505,766 bytes였습니다. Next family가 16 entries / 3,190,697,223 bytes,
pnpm이 14 / 4,435,808,543 bytes를 소유했습니다. Next cache는 regeneration보다 유리하므로 유지하되 source hash를 key에서
제거해 같은 PR의 corrective push가 새 large entry를 만들지 않게 합니다. TypeScript build-info는 합계 약 1.5MB이며 local
cold/warm typecheck는 API 8.19s/4.69s, Web 19.09s/11.19s였습니다.

Second source run `33139988461`은 383s wall / 1,577 raw seconds / 33 rounded minutes / `$0.178` list gross로 691 files /
3,403 cases를 통과했습니다. Phase 5 provisional full p50 대비 wall은 약 37.8% 감소했고 raw는 11.4%, rounded minutes는
17.9%, list gross는 6.0% 증가해 explicit 20%/35% gate 안에 들어왔습니다. SWC build는 4s였고 slim
classify/repository-policy/summary는 24s/123s/3s, `$0.002`/`$0.006`/`$0.002`였습니다.

API build-info exact hit은 static stage를 줄이지 못했으므로 final workflow에서 제거합니다. Web build-info는 static을
120s에서 92s로 줄여 유지합니다. Stable Next key는 second run에서 기존 source-hash cache와 호환되지 않아 37s cold build
후 최초 entry를 만들었습니다. Final source는 같은 key의 exact hit과 API cache 제거를 검증한 뒤 acceptance를 확정합니다.

Pnpm cache는 dependency install 재생성 비용 때문에 유지합니다. Playwright browser cache는 restore와 download 시간이
유사하고 Linux system dependency를 cache할 수 없다는 upstream guidance에 따라 채택하지 않습니다. Product arm64/larger
runner도 native/tooling parity와 current owner availability가 없어 채택하지 않습니다.
