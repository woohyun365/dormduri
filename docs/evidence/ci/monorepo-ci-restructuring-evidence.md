# Monorepo CI restructuring evidence

> **Audience:** human-to-human portfolio, onboarding, and engineering discussion reference.
> 이 문서는 CI 규칙의 owner가 아닙니다. 현재 job graph·예산·설계 결정은
> [Monorepo CI architecture](../../architecture/platform/monorepo-ci.md), 경로별 lane은
> [CI surface ownership](../../development/ci/ci-surface-ownership.md)이 소유합니다. Run별 stage 시간, A/B 상세, fingerprint
> cohort, cache inventory는 측정 원장인 [Monorepo CI baseline](./monorepo-ci-baseline.md)에 둡니다. 이후 agent 경로의
> 분류 개선은 [CI change classification evidence](./ci-change-classification-evidence.md)가 이어서 기록합니다.

이 문서는 monorepo CI를 처음 구조화한 개선과 이어진 hosted 성능 개선을 기록합니다. 첫 구조화는 변경 분류에 따른 lane 선택과
준비 작업 1회화입니다. 문제, 측정 방법, 개선 전 baseline, 원인, 대안, 개선별 전후 측정을 순서대로 적습니다. 회고가 아니라
측정 기록이며, 모든 수치는 run ID·commit·명령 중 하나로 다시 산출할 수 있습니다.

## 1. 문제와 관측 증상

개선 전 CI는 `API CI`(`.github/workflows/api-ci.yml`)와 `Web CI`(`.github/workflows/web-ci.yml`) 두 workflow였습니다. 둘
다 `pull_request`와 `dev`·`main` push에서 `paths` 조건 없이 실행됐습니다(`git show dfa5bc43^:.github/workflows/api-ci.yml`).
그래서 어떤 변경이든 "변경 감지 → API·Web lane 모두 실행"이었습니다.

- 2026-06-22–07-14에 merge된 PR 10개(#287–#302)는 모두 API job과 Web job을 실행했습니다. Wall 284–445s, job 시간
  합(raw) 551–747s, job별 분 올림 합 10–14분입니다(§3).
- Web만 바꾼 PR 3개(#295–#297)도 PostgreSQL service를 띄우는 API job을 294–303s(분 올림 5–6분) 실행했습니다.
- 한 workflow 안에서도 준비 작업이 반복됐습니다. API workflow 한 번에 Shared build와 Prisma generate가 각각 7회, Web
  workflow 한 번에 Shared build 6회와 Next production build 2회였습니다(호출 경로는
  [baseline의 "Current command graph"](./monorepo-ci-baseline.md#current-command-graph)).
- API integration test는 suite마다 disposable schema를 만들고 migration을 적용해, full 실행 한 번에 migration이
  41회였습니다(local, 2026-08-06).

## 2. 측정 방법과 재현 명령

### Run 단위 시간

[CI change classification evidence §2](./ci-change-classification-evidence.md#2-측정-방법과-재현-명령)와 같은 정의를
씁니다. `skipped`가 아닌 job만 세고, GitHub API의 job `startedAt`·`completedAt`에서 계산합니다.

- wall: 마지막 job 종료 − 첫 job 시작
- raw: job별 (종료 − 시작)의 합
- 분 올림 합: job별 시간을 분 단위로 올린 값의 합. GitHub의 job 단위 분 올림 과금 방식을 따른 추정이며 청구서 값이
  아닙니다.

개선 전 PR은 workflow가 두 개이므로, PR 최종 head SHA의 성공한 `pull_request` run을 모두 모은 뒤 두 run의 job을 합쳐 같은
식으로 계산합니다.

```bash
sha=$(gh pr view <번호> --json headRefOid --jq .headRefOid)
gh run list --commit "$sha" --json databaseId,workflowName,event,conclusion \
  --jq '.[] | select(.event == "pull_request" and .conclusion == "success") | "\(.workflowName)\t\(.databaseId)"'
```

개선 직후 표본은 `gh run list --workflow ci.yml --created 2026-08-06..2026-08-23`의 성공한 `pull_request` run입니다.
선택된 lane은 실행된 job 이름으로 구분합니다.

### 표본 규칙

p50은 표본 5개, p95는 표본 10개가 모인 뒤에만 적습니다. p50은 중앙값(짝수 개면 가운데 두 값의 평균), p95는
nearest-rank입니다. 한두 번의 의도적 실행(A/B source run)은 p50·p95로 올리지 않습니다. 2026-08-26 이후 run은
`pnpm ci:performance:collect`·`pnpm ci:performance:report`로 수집했으며, dependency fingerprint가 다른 run을 한 cohort로
섞지 않습니다(도구와 cohort 규칙은 [baseline](./monorepo-ci-baseline.md#run-head-dependency-fingerprint-cohort)).

## 3. Baseline

개선 전 PR 10개입니다. 분류는 [baseline의 2026-08-06 표](./monorepo-ci-baseline.md#최근-10개-merged-pr-표본)를 따릅니다.

| PR   | 분류        | API run       | Web run       | API job | Web job | Wall |  Raw | 분 올림 합 |
| ---- | ----------- | ------------- | ------------- | ------: | ------: | ---: | ---: | ---------: |
| #302 | Shared/root | `29311900784` | `29311900780` |    302s |    445s | 445s | 747s |       14분 |
| #301 | Shared/root | `28764961975` | `28764961981` |    311s |    383s | 383s | 694s |       13분 |
| #298 | Shared/root | `28215670092` | `28215670082` |    307s |    380s | 380s | 687s |       13분 |
| #297 | Web-only    | `28157558248` | `28157558364` |    294s |    357s | 357s | 651s |       11분 |
| #296 | Web-only    | `28091086988` | `28091087000` |    303s |    355s | 355s | 658s |       12분 |
| #295 | Web-only    | `28084001473` | `28084001427` |    299s |    338s | 338s | 637s |       11분 |
| #294 | Shared/root | `28072089886` | `28072089897` |    293s |    327s | 327s | 620s |       11분 |
| #292 | Shared/root | `27999394966` | `27999394942` |    307s |    290s | 308s | 597s |       11분 |
| #291 | Shared/root | `27934281576` | `27934281580` |    310s |    295s | 310s | 605s |       11분 |
| #287 | Shared/root | `27924359215` | `27924359214` |    284s |    267s | 284s | 551s |       10분 |

| 지표       |    p50 |  p95 |
| ---------- | -----: | ---: |
| Wall       | 346.5s | 445s |
| Raw        |   644s | 747s |
| 분 올림 합 |   11분 | 14분 |

- 당시 API job의 test는 unit뿐이었습니다(`pnpm test:api`). Integration·E2E·stress는 CI에서 실행하지 않았습니다(§4).
- 단계별 p50은 API static 1m 23s, API unit 2m 01s, Web static·unit·build 묶음 3m 47s, browser smoke 54s입니다
  ([baseline의 단계별 표](./monorepo-ci-baseline.md#최근-10개-merged-pr-표본)).

## 4. 원인

### Workflow 단위 실행

두 workflow에는 변경 경로를 보는 단계가 없었습니다. 그렇다고 workflow의 `paths` 조건으로 거르면, 건너뛴 workflow의 필수
check가 pending으로 남아 merge를 막습니다
([CI change classification evidence §5](./ci-change-classification-evidence.md#5-대안과-기각-근거)). 그래서 workflow 안에서
변경을 분류하고, 항상 실행되는 집계 job 하나를 필수 check로 두는 구조가 필요했습니다.

### Public command의 자체 준비

`api:test`, `api:build` 같은 public command는 fresh checkout에서 단독 실행되도록 Shared build와 Prisma generate를 각자
포함합니다. CI가 이런 command를 여러 개 이어 부르면서 같은 준비가 반복됐습니다. Web도 browser smoke의 Playwright
webServer가 Next production build를 다시 실행했습니다.

### 검사 범위 확대 뒤의 critical path

`754d6fce`(2026-08-05)는 API CI의 test를 unit(`pnpm test:api`)에서 unit·integration·E2E·stress(`pnpm test:api:ci`)로
넓혔습니다. 같은 commit의 local 검증은 integration 40 files / 225 tests입니다. 그 결과 선택 실행 도입 직후 full run
`32154640034`(2026-08-18)에서는 API job 625s와 Web job 623s가 함께 critical path였습니다. Shared는 68s, Infra는 57s·92s,
repository policy는 10s였습니다. 개선 전 run `29311900784`·`29311900780`과 비교하면 API job은 302s에서 625s로 두 배, Web job은 445s에서 623s로
늘었습니다. Web job이 늘어난 원인은 이 문서에서 따로 분리하지 않았습니다.

## 5. 대안과 기각 근거

### 기각

- **모든 변경에서 전체 CI:** 가장 단순하지만 제품과 무관한 변경에도 API·Web runner 비용을 냅니다(`dfa5bc43`의
  `Rejected` trailer). 알 수 없는 경로와 분류 실패만 correctness 우선으로 전체 lane을 실행합니다.
- **Workflow `paths`/`paths-ignore` trigger:** 필수 check가 pending으로 남습니다(§4).
- **Repository 분리:** Web·API가 공유 contract를 같은 변경에서 검증해야 하므로, contract publish와 호환성 관리 비용이 더
  큽니다([architecture](../../architecture/platform/monorepo-ci.md#alternatives와-consequences)).
- **Job을 먼저 많이 분할:** wall은 줄어도 install 반복과 job별 분 올림으로 raw·분 올림 합이 늘 수 있습니다. 한 job 안의
  준비 재사용을 먼저 적용하고, 분할은 측정으로 이득이 확인될 때만 채택했습니다.
- **같은 runner에서 integration worker 2:** hosted run `33075360973`의 integration stage가 206s로, 개선 전 p50 240s 대비
  14.2% 감소에 그쳐 acceptance 35%에 못 미쳤습니다. 2 vCPU runner에서 migration과 test가 같은 자원을 경쟁합니다.
- **Web build artifact를 job 사이로 전송:** standalone output 약 54MiB를 옮겨도 11s인 build를 없애지 못하고 두 번째
  install이 생깁니다.
- **`ubuntu-slim` repository policy:** docs-only run `33142464458`에서 161s로 늘어 docs feedback이 느려졌습니다.
- **API TypeScript build-info cache, Next cache 제거, Playwright browser cache, product arm64·larger runner:** 측정 또는
  호환성 근거가 부족했습니다([baseline](./monorepo-ci-baseline.md#compiler-and-native-cache-evidence)).
- **Turborepo·remote cache 즉시 도입:** native workflow 개선 뒤에도 대표 narrow PR에서 비용을 포함한 추가 이득이 남을
  때만 재검토합니다(architecture의 revisit 조건).

### 채택(개선 항목)

1. 변경 분류와 선택 실행: `classify` job이 변경 경로를 lane으로 분류하고, 선택된 reusable workflow만 실행합니다.
   `CI summary` 하나가 필수 check입니다.
2. 준비 작업 1회화: CI는 lane마다 prepare를 한 번 실행하고 `*:prepared` command를 씁니다. Browser smoke는 이미 만든
   standalone output으로 실행합니다. Integration은 domain lifecycle 단위로 sandbox를 합쳐 migration을 줄입니다.
3. `dev` push 재실행 제거
4. Web unit 환경 분리(Node·jsdom project)
5. API integration shard(독립 PostgreSQL을 가진 runner 2개)
6. Web unit job 분리
7. Compiler·cache·runner 조정
8. 측정 체계: 고정 denominator, cohort report, 측정 epoch와 run-head fingerprint

## 6. 개선별 전후 측정

| 개선 항목              | Commit·PR                                                              | 측정 종류            | 개선 전                            | 개선 후                                |
| ---------------------- | ---------------------------------------------------------------------- | -------------------- | ---------------------------------- | -------------------------------------- |
| 변경 분류와 선택 실행  | `dfa5bc43`(#299, `dev` 반영 #304·#305)                                 | 자연 표본            | 모든 PR이 API·Web 실행             | Infra·policy PR wall p50 79s, 6분(n=5) |
| 준비 작업 1회화        | `dfa5bc43`                                                             | command graph, local | Shared build 7·6회, Next build 2회 | lane마다 1회; migration 41→27회        |
| `dev` push 재실행 제거 | `f5a87971`(#365)                                                       | 실행 횟수            | merge마다 같은 graph 2회           | 1회                                    |
| Web unit 환경 분리     | `ad785078`(#370)                                                       | hosted 관측 2회      | Web unit stage p50 267s            | 181s, 184s                             |
| API integration shard  | `b65b7e9e`(#371)                                                       | hosted attempt 2회   | integration stage p50 240s         | 느린 shard 114s, 133s                  |
| Web unit job 분리      | `09d13704`(#372), `7a8899ea`(#373)                                     | source run           | Web-only wall 460s, 12분           | 283s, 13분                             |
| Compiler·cache·runner  | `b8720f9e`(#374), `ec5ed0a1`(#377)                                     | source run 3회       | full PR wall p50 616s, 28분        | 330s, 31분                             |
| 측정 체계              | `7f7bfbde`(#364), `ab11431f`(#366), `092c49a5`(#380), `3e7ac004`(#381) | -                    | -                                  | §2의 표본 규칙                         |

### 변경 분류와 선택 실행: 도입 직후 자연 표본

`dfa5bc43`은 2026-08-06 commit이고, 2026-08-14 PR #304·#305로 `dev`에 들어갔습니다. 2026-08-14–08-21의 성공한
`pull_request` run 42개를 선택된 lane별로 나누면 다음과 같습니다. 표본 단위는 run이며, 같은 PR의 rebase·재push run도 각각 셉니다. Job 수에는 classify와
`CI summary`가 들어갑니다.

| 선택된 lane                            | Run | Job |       Wall | Wall p50 | Raw p50 | 분 올림 합 |
| -------------------------------------- | --: | --: | ---------: | -------: | ------: | ---------: |
| Shared·API·Web·Infra·repository policy |  31 |   8 | 525–3,350s |     648s |  1,418s |   p50 28분 |
| API·Web·Infra·repository policy        |   1 |   7 |       644s |        - |       - |       27분 |
| API·Infra·repository policy            |   2 |   6 | 632–1,334s |        - |       - |    16–17분 |
| Web·repository policy                  |   3 |   4 |   494–638s |        - |       - |    11–13분 |
| Infra·repository policy                |   5 |   5 |     78–85s |      79s |    141s |    p50 6분 |

- 선택 실행은 의도대로 동작했습니다. Infra·문서·설정 PR 5개(run 5개)는 API·Web 없이 job 5개, wall p50 79s, 분 올림
  6분이었습니다. 개선 전에는 같은 종류의 PR도 API·Web job을 모두 실행했습니다.
- Web·repository policy run 3개는 한 Dependabot PR(`actions/cache` 갱신)의 rebase run이고, API·Infra·repository policy run
  2개는 PostgreSQL·nginx image 호환 PR 2개입니다.
- Full fan-out run 31개는 PR 21개에서 나왔습니다. 그중 20개는 root toolchain, package manifest, workflow 파일을 바꿔 의도한
  fan-out입니다. Dependency 갱신 PR 14개(`dependabot/**`, `chore/dependabot-*`, `chore/renovate-*`), `dev`→`main` 승격 PR
  4개(#305·#336·#349·#352), workflow를 바꾼 #304, `package.json`을 바꾼 #348입니다. 나머지 #346은 당시 규칙 밖 경로였던
  `renovate.json` 때문에 전체 lane으로 fail-open했습니다. 이런 규칙 밖 경로는 이후
  [CI change classification evidence](./ci-change-classification-evidence.md)가 다룹니다.
- Full run의 p95는 wall 1,309s, raw 1,508s, 분 올림 30분입니다. Wall 상위 두 값(1,309s, 3,350s)은 raw가 1,340s·1,439s로
  다른 run과 비슷해, 뒤 job의 대기열이 wall에 들어간 경우입니다(§7).
- Full run은 개선 전 wall p50 346.5s보다 깁니다. 선택 실행 때문이 아니라 §4의 검사 범위 확대 때문이며, 이 run들이 다음
  개선의 denominator가 됐습니다.

### 준비 작업 1회화

[Baseline의 "Prepare-once 적용 결과"](./monorepo-ci-baseline.md#prepare-once-적용-결과)와
["Migration evidence"](./monorepo-ci-baseline.md#migration-evidence)가 상세를 소유합니다.

- Shared build는 lane마다 1회, Prisma generate는 API lane 1회, Next production build는 Web lane 1회로 줄었습니다.
- Integration 40 files / 225 tests를 domain lifecycle 단위 27 files / 225 tests로 합쳐 migration이 41회에서 27회로 줄었습니다.
  Behavior name set은 전후 같습니다. Local command는 259.72s에서 202.55s로 22.0% 줄었습니다(local warm run).

### `dev` push 재실행 제거

PR #364의 같은 변경이 PR run `32939047806`(589s, 분 올림 25분)과 merge 뒤 `dev` push run `32939810146`(622s, 29분)으로
두 번 실행됐습니다. `dev` ruleset이 이미 PR-only integration과 green `CI summary`를 요구하므로 두 번째 실행은 새 검증
경계를 더하지 않았습니다. `f5a87971`(#365) 뒤 CI는 pull request와 `main` push에서만 실행됩니다.

### Hosted 성능 개선(#370–#377)

Denominator는 #366이 고정한 full PR 5개(`32939047806`, `32945877705`, `32952015500`, `33031304442`, `33041754596`)입니다.
Wall p50 616s, raw 1,416s, 분 올림 28분, 표준 Linux list rate 환산 `$0.168`이며, stage p50은 Web unit 267s, API
integration 240s입니다. 아래 결과는 모두 의도적으로 실행한 source run이라 p50·p95로 올리지 않았습니다.

- **Web unit 환경 분리(#370):** run `33048619750`에서 221 files / 1,232 cases를 그대로 실행하며 Web unit stage가 181s, 일회
  재실행 184s였습니다. 267s 대비 32.2%, 31.1% 감소입니다.
- **API integration shard(#371):** run `33077630757`의 두 attempt에서 느린 shard가 114s, 133s였고, 중앙값 123.5s는 240s 대비
  48.5% 감소입니다. 두 attempt 모두 27 files / 225 tests를 정확히 한 번씩 실행했습니다. 대신 API-only run의 분 올림
  17–18분은 15분 advisory를 넘었습니다.
- **Web unit job 분리(#372·#373):** 이전 Web-only run `33050305663`(460s, raw 521s, 12분) 대비 final run `33083313967`은
  283s, raw 543s, 13분이었습니다. Wall은 38.5% 줄고 raw는 4.2%, 분 올림은 1분 늘었습니다.
- **Compiler·cache·runner(#374·#377):** final run `33141634646`은 wall 330s, raw 1,543s, 31분, `$0.170`이었습니다. Full PR
  p50 대비 wall은 46.4% 줄고 raw는 9.0%, 분 올림은 10.7%, list gross는 약 1.2% 늘었습니다. 691 files / 3,403 cases를
  통과했습니다. 채택한 것은 Nest ESM SWC(API build 13s → 3s), stable Next cache, Web TypeScript build-info, slim
  classify·summary입니다.

### 이후 자연 표본(참고)

[CI change classification evidence §3](./ci-change-classification-evidence.md#3-baseline)의 agent PR 중 전체 lane을 실행한
8개(2026-10-01–10-02)는 개선 뒤 full graph의 자연 run입니다. Job 11개, wall 274–555s(p50 381s), raw 1,507–1,947s(p50
1,632.5s), 분 올림 33–39분(p50 34분)이었습니다.

- Wall p50은 #366 denominator 616s보다 짧고, 분 올림 합은 28분보다 많습니다. Job을 나눠 wall을 줄인 대신 job 수와 job별
  분 올림이 늘었습니다.
- 분 올림 33–39분은 architecture의 full/shared fan-out advisory 30분을 넘습니다.
- 이 run들은 dependency epoch와 test inventory가 #366 cohort와 달라 같은 cohort로 비교하지 않습니다. 표본 8개라 p95는
  적지 않습니다.

## 7. 한계와 재측정 조건

- 개선 전 PR 10개의 API job은 unit만 실행했습니다. 개선 뒤 full run은 integration·E2E·stress와 Shared·Infra·repository policy
  lane을 더 실행하므로, full run 시간을 개선 전후로 직접 비교하지 않습니다. 개선 효과는 같은 inventory의 stage·A/B
  비교(§6)로 판단합니다.
- [Baseline의 2026-08-06 표](./monorepo-ci-baseline.md#최근-10개-merged-pr-표본)는 workflow duration 합과 선형 보간 p95(wall
  7m 01s)입니다. 이 문서는 job 단위 시간과 nearest-rank p95(445s)를 씁니다. 같은 run의 계산 방식 차이입니다.
- #370–#377의 결과는 의도적 source run입니다. 개선 뒤 자연 cohort의 p50·p95 확정은 Issue #382가 추적합니다.
- 첫 job 뒤의 대기열은 wall에 들어갑니다. Raw에는 대기열이 들어가지 않습니다.
- 분 올림 합과 list rate 환산은 과금 방식을 따른 추정입니다. 실제 청구 금액은 다루지 않습니다.
- Full fan-out의 분 올림 합이 advisory 30분을 넘는 상태가 이어지면 job graph를 다시 검토합니다(architecture의 revisit 조건).

## 8. Interview evidence map

| 질문                               | 근거 절 |
| ---------------------------------- | ------- |
| 어떤 문제를 어떤 수치로 확인했는가 | §1, §3  |
| 원인을 어떻게 좁혔는가             | §4      |
| 왜 다른 방법을 쓰지 않았는가       | §5      |
| 개선 효과를 어떻게 검증하는가      | §2, §6  |
| 개선이 만든 trade-off는 무엇인가   | §6, §7  |
