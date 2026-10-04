# CI change classification evidence

> **Audience:** human-to-human portfolio, onboarding, and engineering discussion reference.
> 이 문서는 CI 분류 규칙의 owner가 아닙니다. 현재 경로별 표면·lane·owner는
> [CI surface ownership](../../development/ci/ci-surface-ownership.md), 설계 결정과 job graph는
> [Monorepo CI architecture](../../architecture/platform/monorepo-ci.md)가 소유합니다. 선택 실행을 처음 도입한 구조 개선은
> [Monorepo CI restructuring evidence](./monorepo-ci-restructuring-evidence.md), run별 측정 원장은
> [Monorepo CI baseline](./monorepo-ci-baseline.md)에 둡니다. 이 개선의 개선 전 표본(agent PR 9개)은 §3에 둡니다.

이 문서는 변경 분류 개선의 문제, 측정 방법, 개선 전 baseline, 원인, 대안과 개선별 전후 측정을 기록합니다. 회고가
아니라 측정 기록이며, 모든 수치는 run ID·commit·명령 중 하나로 다시 산출할 수 있습니다.

## 1. 문제와 관측 증상

Agent workflow 파일(`.claude/**`, `.codex/**`, agent 문서·script·test)만 바꾼 PR이 product lane 전체를 실행했습니다.
2026-10-01–10-02(UTC)에 `dev`로 merge된 agent PR 9개(#516–#532 짝수) 중 8개가 CI job 11개를 모두 실행했습니다.

- 8개 run: wall 274–555s, job 시간 합(raw) 1,507–1,947s, job별 분 올림 합 33–39분
- 이 8개 run의 raw 합 13,402s 중 11,776s(87.9%)가 API·Web·Shared·Infra job이었습니다. Run당 평균 1,472s입니다.
- 정상 분류된 1개(#524)는 job 3개(classify, repository policy, summary)였습니다. Wall 221s, raw 214s, 분 올림 합 6분입니다.
- 9개 PR의 변경 파일(`gh pr view <번호> --json files`)을 분류기로 replay하면 전체 lane을 켠 8개 PR의 원인은 모두
  `.claude/skills/**` 또는 `.claude/agents/knu_executor_xhigh.md`입니다. 의도한 fan-out 경로와 `apps/`·`packages/`·`infra/`
  변경은 9개 PR 모두 0개입니다.

정상 분류된 run도 [Monorepo CI architecture](../../architecture/platform/monorepo-ci.md)의 Docs-only rollout budget(p95
1m 30s)과 Docs/config/tooling billed budget(p95 5분)을 넘었습니다.

## 2. 측정 방법과 재현 명령

### Run 단위 시간

`skipped`가 아닌 job만 셉니다. 시간은 GitHub API의 job `startedAt`·`completedAt`(초 단위)에서 계산합니다.

- wall: 마지막 job 종료 − 첫 job 시작
- raw: job별 (종료 − 시작)의 합
- 분 올림 합: job별 시간을 분 단위로 올린 값의 합. GitHub의 job 단위 분 올림 과금 방식을 따른 추정이며 청구서 값이
  아닙니다.

```bash
gh run view <run-id> --json jobs,headSha --jq '
  (.jobs | map(select(.conclusion != "skipped"))) as $j
  | ($j | map((.completedAt | fromdateiso8601) - (.startedAt | fromdateiso8601))) as $d
  | [($j | length),
     (($j | map(.completedAt | fromdateiso8601) | max) - ($j | map(.startedAt | fromdateiso8601) | min)),
     ($d | add),
     ($d | map(. / 60 | ceil) | add),
     .headSha[0:8]] | @tsv'
```

PR 번호는 `gh pr list --state merged --search <headSha> --json number`로 확인합니다.

### Step 시간

같은 API의 job `steps[]`에서 step별 (종료 − 시작)을 계산합니다.

```bash
gh run view <run-id> --json jobs --jq '
  .jobs[] | select(.name == "Repository policy gate") | .steps[]
  | "\(.name)\t\((.completedAt | fromdateiso8601) - (.startedAt | fromdateiso8601))"'
```

### 분류기 replay

`scripts/ci/classify-changes.mjs`의 `classifyChanges`를 직접 호출합니다. 아래는 tracked 경로마다 한 번씩 분류해 전체
lane이 켜지는 경로 수를 셉니다. 기준 commit은 `0eafa5cd`이며, 이 commit을 checkout한 working tree에서 실행해야 같은 값이
나옵니다(`git ls-files`와 분류기를 working tree에서 읽습니다).

```bash
node --input-type=module -e "
import { execFileSync as x } from 'node:child_process';
import { classifyChanges as c } from './scripts/ci/classify-changes.mjs';
const paths = x('git', ['ls-files'], { encoding: 'utf8' }).trim().split('\n');
console.log(paths.length, paths.filter((p) => Object.values(c([p])).every(Boolean)).length);
"
```

최근 commit replay는 `git log --first-parent -n 60 --format=%H 0eafa5cd`의 commit마다
`git diff --name-only <sha>^ <sha>`를 같은 함수로 분류합니다.

## 3. Baseline

| Run ID        | PR   | Head SHA   | Job | Wall |    Raw | 분 올림 합 |
| ------------- | ---- | ---------- | --: | ---: | -----: | ---------: |
| `36947143906` | #532 | `bc8c5aae` |  11 | 391s | 1,783s |       36분 |
| `36887031039` | #530 | `0f7de5a6` |  11 | 555s | 1,947s |       39분 |
| `36884682748` | #528 | `44d84603` |  11 | 313s | 1,595s |       34분 |
| `36880041098` | #526 | `29e2757a` |  11 | 388s | 1,632s |       33분 |
| `36866809462` | #524 | `ea0aee5e` |   3 | 221s |   214s |        6분 |
| `36864907371` | #522 | `42c03798` |  11 | 343s | 1,597s |       34분 |
| `36829430338` | #520 | `ec9ab75b` |  11 | 374s | 1,633s |       34분 |
| `36813431219` | #518 | `dcf800f4` |  11 | 395s | 1,708s |       35분 |
| `36795700788` | #516 | `6b502dd8` |  11 | 274s | 1,507s |       33분 |

Repository policy gate의 step 시간(초). Job 전체는 job 시작·종료 기준이라 setup·post step을 포함합니다.

| Run ID        | Install | Policy script test | `prettier . -c` | Job 전체 |
| ------------- | ------: | -----------------: | --------------: | -------: |
| `36947143906` |      33 |                106 |              34 |      195 |
| `36866809462` |      31 |                 97 |              33 |      185 |

정상 분류된 `36866809462`의 critical path는 classify job 24s 뒤의 repository policy job 185s입니다.

## 4. 원인

### 규칙 밖 경로의 fail-open

아래 줄 번호와 규칙 설명은 commit `0eafa5cd` 기준입니다.

`classifyChanges`는 규칙에 맞지 않는 경로 하나만 있어도 모든 lane을 켭니다(`scripts/ci/classify-changes.mjs:163-165`).
`.github/` 아래의 규칙 밖 경로와 root toolchain 목록도 전체 lane입니다(`:158-161`). Claude 역할 파일은 이름을 열거한
정규식만 repository policy로 분류합니다(`:27-28`). 그래서 새 역할 파일은 규칙 밖 경로가 됩니다.

### Tracked 전수 replay

`0eafa5cd`의 tracked 경로 2,915개 중 65개가 전체 lane입니다.

- 의도한 fan-out 16개: `packages/eslint-config/**` 5, `packages/tsconfig/**` 5, `.github/workflows/ci.yml`, root
  toolchain 5개
- 의도하지 않은 fail-open 49개:

| Family                                     | 경로 수 |
| ------------------------------------------ | ------: |
| `scripts/dependencies/**`                  |      14 |
| `.codex/**`                                |       5 |
| `.claude/**`(skills 3, 역할 1, settings 1) |       5 |
| `.plans` 디렉터리의 tracked 파일           |       4 |
| `.github/ISSUE_TEMPLATE/**`                |       3 |
| `scripts/security/**`                      |       3 |
| `.artifacts/**`(tracked)                   |       2 |
| `.vscode/**`                               |       2 |
| `scripts/artifacts/**`                     |       2 |
| `.prettierrc`, `.editorconfig`             |       2 |
| `CONTRIBUTING.md`, `SERVICE.md`            |       2 |
| `.omc-workspace`, `.omx-config.json`       |       2 |
| `omx_wiki/**`(tracked)                     |       1 |
| `renovate.json`                            |       1 |
| `scripts/README.md`                        |       1 |

### 최근 commit replay

`0eafa5cd` 기준 first-parent 60개 commit 중 21개가 전체 lane으로 분류됩니다.

### 정상 분류 run의 시간 구성

Agent 파일 변경도 repository policy gate를 실행합니다. 이 job의 시간은 install(31–33s), policy script test(97–106s),
`prettier . -c`(33–34s)가 대부분입니다(§3). Policy script test는 test 파일을 한 번에 하나씩 실행합니다.

- `scripts/ci/run-repo-policy.mjs`는 `node --test`에 `--test-concurrency`를 넘기지 않습니다.
- [Node.js CLI 문서](https://nodejs.org/docs/latest-v24.x/api/cli.html#--test-concurrency): "concurrency defaults to
  `os.availableParallelism() - 1`."
- [GitHub-hosted runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners): private 저장소의
  표준 Linux runner는 CPU 2개입니다. 이 저장소는 private입니다(`gh repo view --json visibility`). 따라서 기본 병렬도는
  1이고, 파일 단위 순차 실행은 이 두 사실에서 나온 판단입니다.

## 5. 대안과 기각 근거

### 기각

- **Workflow `paths`/`paths-ignore` trigger:** 필수 check가 막힙니다.
  [Troubleshooting required status checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks#handling-skipped-but-required-checks):
  path filtering으로 건너뛴 workflow는 "Associated checks stay in a "Pending" state and block merging"입니다. 이
  저장소는 `CI summary` 하나를 필수 check로 쓰고, job 단위 조건(`if:`)으로 lane을 고릅니다.
- **`.github/workflows` 하위 디렉터리로 agent workflow 분리:**
  [Reuse workflows](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows): "Subdirectories of the
  `workflows` directory are not supported."
- **Agent test를 CI에서 제외:** agent 계약의 회귀 방어를 잃습니다.
- **모르는 경로의 fail-open 폐지:** 분류 누락이 검사 누락이 됩니다. Correctness 우선 원칙을 유지합니다.

### 채택(개선 항목)

1. 분류 완전성: 의도하지 않은 fail-open family마다 표면에 맞는 규칙을 둡니다. Tracked 전수 test가 의도한 fan-out 밖의
   전체 lane을 막습니다.
2. Agent workflow 분류 출력: agent lane job이 쓸 분류 출력을 둡니다. Agent 파일만 바뀐 PR의 product lane 미실행은 분류
   완전성이 이미 달성합니다(§6). 출력을 소비하는 job 없이 출력만 두면 CI에서 검증할 수 없으므로, 이 출력은 Agent test lane
   분리와 같은 변경에서 둡니다.
3. Agent test 배치: `scripts/ci`의 agent test·fixture를 하위 디렉터리로 모아 분류 규칙을 디렉터리 단위로 둡니다.
4. Agent test lane 분리: agent workflow test를 package install 없는 job으로 나눠 agent-only PR의 critical path를 줄입니다.
   개선 전 측정과 예상치로 채택했고, merge 뒤 표본으로 효과를 확인합니다(§6).
5. Formatting 검사 범위: formatting 설정이 바뀌지 않은 PR은 변경 파일만 검사합니다.
6. Policy script test critical path: 가장 긴 test 파일의 시간을 줄입니다.

## 6. 개선별 전후 측정

| 개선 항목                        | PR   | 표본 수 | Wall p50 | Wall p95 | 분 올림 합 p50 | 상태                             |
| -------------------------------- | ---- | ------: | -------: | -------: | -------------: | -------------------------------- |
| 분류 완전성                      | #537 |     5/5 |     181s |        - |            5분 | 표본 5/5                         |
| Agent workflow 분류 출력         | #553 |       - |        - |        - |              - | Agent test lane 분리와 함께 측정 |
| Agent test 배치                  | #543 |       - |        - |        - |              - | 시간 측정 대상 아님              |
| Agent test lane 분리             | #553 |     2/5 |        - |        - |              - | 표본 2/5                         |
| Formatting 검사 범위             | #545 |     3/5 |        - |        - |              - | 표본 3/5                         |
| Policy script test critical path | -    |       - |        - |        - |              - | 미측정                           |

p50은 표본 5개, p95는 표본 10개가 모인 뒤에만 적습니다(Monorepo CI architecture의 표본 규칙).

표본은 해당 PR merge 뒤 자연 발생한 agent-only PR의 `Monorepo CI` workflow run입니다. Agent-only PR은 agent 표면 경로를 바꾸고
product lane 없이 실행한 PR입니다. #553 전에는 classify·repository policy·summary job 3개, #553 뒤에는 Agent workflow gate가 더해진
job 4개를 실행합니다. 개선 전 값은 §3입니다. 시간을 바꾸지 않는 개선은 시간 표본
대신 동등성 검증을 적습니다.

### 분류 완전성(#537) 정적 replay

§2의 replay 명령을 #537의 분류기로 다시 실행한 결과입니다. CI 시간 표본이 아니라 분류 결과의 전후 비교입니다.

| 대상                                       | 개선 전(`0eafa5cd`) | #537 |
| ------------------------------------------ | ------------------: | ---: |
| Tracked 경로 중 전체 lane                  |                  65 |   16 |
| 그중 의도한 fan-out 밖                     |                  49 |    0 |
| 최근 first-parent 60개 commit 중 전체 lane |                  21 |    7 |
| Agent PR 9개 중 전체 lane                  |                   8 |    0 |

- #537의 tracked 경로 수는 #535의 문서 2개가 더해진 2,917개입니다.
- 60개 commit 중 남은 7개 가운데 6개는 root toolchain 파일(`package.json`, `pnpm-lock.yaml`)을 바꿔 의도한 fan-out입니다.
  그중 1개는 이후 이름이 바뀌어 지금 tree에 없는 local workspace 경로도 바꿨습니다. 나머지 1개는 그런 옛 경로만 바꿨고,
  모르는 경로로 fail-open합니다(commit `059bf6da`).
- Agent PR 9개는 모두 `repoPolicy`만 선택합니다.

### 분류 완전성(#537) 시간 표본

#537 merge 뒤 agent-only PR의 run입니다. §2의 run 단위 시간 명령으로 산출했습니다.

| Run ID        | PR   | Head SHA   | Job | Wall |  Raw | 분 올림 합 |
| ------------- | ---- | ---------- | --: | ---: | ---: | ---------: |
| `37086373593` | #541 | `b5a62079` |   3 | 181s | 177s |        5분 |
| `37088505466` | #543 | `69ce428a` |   3 | 176s | 171s |        5분 |
| `37122518625` | #547 | `a0e9c9ef` |   3 | 177s | 171s |        5분 |
| `37125113375` | #549 | `761d53f1` |   3 | 235s | 192s |        5분 |
| `37130366695` | #551 | `e0afecb9` |   3 | 217s | 211s |        5분 |

- 다섯 run 모두 job 3개(classify, repository policy, summary)만 실행했습니다. 개선 전 agent PR 9개 중 8개는 job 11개, wall
  274–555s, 분 올림 합 33–39분이었습니다(§1).
- 표본 5개의 wall p50은 181s, raw p50은 177s, 분 올림 합은 5개 모두 5분입니다. p95는 표본 10개 뒤에 적습니다.

### Agent test lane 분리(#553) 개선 전 기준과 예상

위 #537 표본 5개가 개선 전 기준입니다. 모두 job 3개이고 Repository policy gate 하나가 policy test 전체를 실행했습니다. §2의
step 시간 명령으로 이 job을 나누면 다음과 같습니다.

| 구간                                                     |     시간 |
| -------------------------------------------------------- | -------: |
| Repository policy gate                                   | 148–171s |
| Policy test step                                         |  77–114s |
| Install 관련(Setup pnpm + Install + Post Setup Node.js)  |   41–48s |
| 그 밖의 test 밖 시간(set up, checkout, setup-node, post) |    7–10s |
| Formatting step                                          |    1–25s |

- Formatting step은 #545 전 run(#541·#543, tree 전체 20–25s)과 뒤 run(#547·#549·#551, 변경 파일 1–2s)이 섞여 있습니다. 아래
  예상은 formatting을 Repository policy gate에 남기므로 agent job의 critical path에는 들어가지 않습니다.

- Agent test 비율은 run `36947143906`(#532)의 policy step 출력에서 잽니다. 이 run은 test 파일을 한 번에 하나씩 실행했습니다. 파일별
  시간은 그 파일의 마지막 결과 줄과 앞 파일의 마지막 결과 줄 사이 시각 차이이고, 파일 경계는 파일별 test 수와 test 이름 순서로
  정합니다. Policy test 105.8s 중 agent test 42개가 101.3s(95.7%)이고, 그중 tree 전체를 읽는 guard 2개(1.2s)를 뺀 옮겨지는 몫은
  100.0s(94.5%)입니다.
- Agent workflow test 중 tree 전체를 읽는 2개를 뺀 나머지는 `node_modules` 없는 checkout에서 모두 통과합니다. 남은 2개 중
  하나는 `prettier`를 import합니다. 그래서 이 2개는 Repository policy gate에 남기고, Agent workflow gate는 install 없이 실행합니다.
- 예상(추정, 측정 아님): 표본마다 policy test step의 94.5%를 install 없는 새 job으로 옮기고, 새 job의 test 밖 시간을 5–19s,
  formatting step을 #545 뒤 값(1–2s)으로 둡니다. Agent-only PR의 wall은 표본별로 42–73s 줄고, raw는 새 job의 test 밖 시간만큼
  5–19s 늘고, 분 올림 합은 5–7분(classify 1 + summary 1 + repository policy 1–2 + agent workflow 2–3)입니다. Full fan-out PR은 product lane이 critical path라 wall은 그대로입니다.
- 비교한 대안(같은 방식의 추정): 두 job 모두 install하면 #545 뒤 표본에서 wall이 6–8s 줄고 raw가 54–56s(두 번째 job의 install
  포함 test 밖 시간) 늘어납니다. Agent job 하나로 합치면 기존 Repository policy gate와 같은 일을 한 job에서 하므로 wall·raw
  변화가 거의 없습니다. 둘 다 critical path를 줄이지 못해 채택하지 않았습니다.
- 개선 뒤 표본은 #553 merge 뒤 agent-only PR의 run이고, 지금은 2/5입니다(아래 절).

### Agent test lane 분리(#553) 시간 표본

#553 merge 뒤 agent-only PR의 run입니다. 앞 표본과 같이 PR마다 merge된 head의 run을 쓰고, §2의 run 단위 시간 명령과 step 시간
명령으로 산출했습니다.

| Run ID        | PR   | Head SHA   | Job | Wall |  Raw | 분 올림 합 |
| ------------- | ---- | ---------- | --: | ---: | ---: | ---------: |
| `37171086025` | #555 | `526f9872` |   4 |  92s | 149s |        6분 |
| `37179618039` | #557 | `d3080a59` |   4 | 149s | 199s |        6분 |

| Run ID        | Classify | Repository policy gate | Agent workflow gate | CI summary |
| ------------- | -------: | ---------------------: | ------------------: | ---------: |
| `37171086025` |      15s |                    61s |                 69s |         4s |
| `37179618039` |      16s |                    57s |                122s |         4s |

- 두 run 모두 job 4개이고 product lane은 실행하지 않았습니다.
- Repository policy gate: install 관련(Setup pnpm + Install + Post Setup Node.js) 44s·43s, policy test step 7s·5s, formatting step
  1s·1s입니다. 개선 전 표본에서는 이 job이 148–171s였습니다.
- Agent workflow gate: install 없이 test step 62s·112s, 그 밖의 시간 7s·10s입니다. 예상한 test 밖 시간 5–19s 안입니다.
- 위 예상과 비교: wall은 개선 전 p50 181s보다 89s·32s 짧습니다(예상 42–73s 감소). Raw는 개선 전 p50 177s보다 28s 짧고 22s
  깁니다(예상 5–19s 증가). 분 올림 합은 6분·6분입니다(예상 5–7분).
- #557의 Agent workflow gate가 #555보다 53s 길었습니다. Test step 출력의 test별 시간으로 나누면, #557이 더한 test 33개(894 → 927)는
  합 약 6s이고, 두 run에 모두 있는 test 894개는 60.1s에서 약 102s로 늘었습니다. 같은 test가 느려진 원인은 이 두 run으로 가리지
  않았습니다.
- #557에는 merge 전 실패 run `37179149839`(`be578dc3`, repository policy test 실패, wall 149s, raw 196s, 분 올림 합 5분)가 있습니다.
  merge된 head의 run이 아니라 표본에 넣지 않았지만, 재실행 비용으로는 PR 하나가 run 2회를 쓴 것입니다.
- p50은 표본 5개 뒤에 적습니다.

### 분류 완전성(#537) 리뷰에서 찾은 under-selection

규칙을 좁히면 fail-open 때문에 우연히 실행되던 lane이 빠질 수 있습니다. #537의 독립 리뷰 세 회차에서 lane job이 실행하거나
import하는 저장소 script가 그 lane을 켜지 않는 경로를 찾았습니다. 대응으로 이런 script를 lane별로 지정하고, workflow step,
package script, Web image build, lane package 파일의 import와 경로 참조에서 출발해 import closure를 따라가는 test를 두었습니다.
규칙은 [CI surface ownership](../../development/ci/ci-surface-ownership.md)이 소유합니다.

| 발견 회차 | Script                                                                                   | 실행·참조 경로                                         | 구분                                        |
| --------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------- |
| 1차       | `scripts/artifacts/paths.mjs`                                                            | `pnpm infra:check` import                              | #537이 만든 공백                            |
| 1차       | `scripts/ci/run-timed-command.mjs`                                                       | Web·API step wrapper                                   | 기존 공백                                   |
| 1차       | `scripts/ci/repo-policy-test-files.mjs`                                                  | `pnpm infra:check` import                              | 기존 공백                                   |
| 2차       | `scripts/observability/sentry/check-build.mjs`, `scripts/ci/prepare-next-standalone.mjs` | Web job의 pnpm script, Playwright smoke·Web Dockerfile | 기존 공백                                   |
| 2차       | `scripts/infra/compose/profile.mjs`, `scripts/observability/production/environment.mjs`  | API job의 `pnpm infra:compose`와 그 import             | 기존 공백                                   |
| 3차       | `scripts/artifacts/paths.mjs`                                                            | API stress harness import                              | #537이 만든 공백(전에는 fail-open으로 실행) |
| 3차       | `scripts/observability/rehearsal/web-bff.mjs`                                            | API operations test가 경로로 읽음                      | 기존 공백                                   |
| 3차       | `scripts/ci/run-timed-command.mjs`                                                       | Storybook step wrapper                                 | 기존 공백                                   |

- 회차마다 test를 먼저 실패시킨 뒤(1차 4건, 2차 4건, 3차 3건) 규칙을 추가했습니다.
- 3차 회차의 mutation 9건은 모두 test 실패로 잡혔습니다.
- 계산된 경로, `spawn` 인자, `pnpm --filter` 형식처럼 이 test가 따라가지 않는 경로는 표면 문서에 검사 범위 밖으로 적었습니다.

### Agent test 배치(#543) 동등성

Agent test 43개와 fixture 12개를 `scripts/ci/agents/{common,claude,codex}/`로 옮긴 변경입니다. 분류 결과와 실행 시간은 바뀌지
않으므로 시간 표본 대신 이동 전후가 같다는 것을 확인했습니다.

- Repository policy test 1,238/1,238이 이동 전후 같고, test 이름 목록은 경로만 다릅니다.
- Test discovery 82개의 basename이 같고, tracked 참조에 옛 경로가 0건입니다.
- 이 배치는 이후 agent test를 디렉터리 단위로 분류하는 기준입니다.

### Formatting 검사 범위(#545) step 시간

이 개선은 Repository policy gate의 `Verify repository formatting` step이 검사하는 파일 범위를 바꿉니다. 같은 PR에서 rename의 원래
경로도 lane을 고르게 했으므로, 파일을 lane 밖으로 옮기는 PR에서는 선택되는 lane이 늘 수 있습니다. 그래서 run 전체 시간과 함께 이
step의 시간을 §2의 step 시간 명령으로 비교합니다. 개선 전에는 모든 run이 `prettier . -c`로 tree 전체를 검사했습니다.

| Run ID        | PR   | Head SHA   | Job | Formatting step |
| ------------- | ---- | ---------- | --: | --------------: |
| `37088505466` | #543 | `69ce428a` |   3 |             20s |
| `37086373593` | #541 | `b5a62079` |   3 |             25s |
| `37084666943` | #539 | `b8aa3ea8` |  11 |             24s |
| `37030067867` | #537 | `87bba80d` |   5 |             28s |
| `37017495949` | #535 | `564eb0bd` |   3 |             35s |

- 개선 전 5개의 step 시간은 20–35s이고 중앙값은 25s입니다. §3의 두 run(34s, 33s)도 같은 범위입니다.
- 개선 뒤 표본은 #545 merge 뒤 formatting 설정을 바꾸지 않은 agent-only PR의 run입니다. 지금은 표본 3/5입니다.

| Run ID        | PR   | Head SHA   | Formatting scope     | Formatting step |
| ------------- | ---- | ---------- | -------------------- | --------------: |
| `37122518625` | #547 | `a0e9c9ef` | `changed`, 파일 4개  |              1s |
| `37125113375` | #549 | `761d53f1` | `changed`, 파일 10개 |              1s |
| `37130366695` | #551 | `e0afecb9` | `changed`, 파일 19개 |              2s |

- 개선 뒤 run에서는 step 출력의 `Formatting scope:` 줄로 검사 범위(`full`·`changed`)와 검사한 파일 수를 확인합니다.

#545 자신의 run과 로컬 측정은 표본이 아니라 동작 확인입니다. #545는 `.github/workflows/ci.yml`을 바꿔 전체 lane을 실행하므로
agent-only 표본에 넣지 않습니다.

| 측정                          | 환경                                                 | 검사 범위           | Formatting 검사 시간 |
| ----------------------------- | ---------------------------------------------------- | ------------------- | -------------------: |
| Run `37101560534`(`ad565715`) | GitHub Actions, Repository policy gate               | `changed`, 파일 9개 |                   1s |
| 로컬 3회 반복(`cbf203f6`)     | macOS, Node.js 24, `scripts/ci/check-formatting.mjs` | `full`(tree 전체)   |          9.99–10.34s |
| 로컬 3회 반복                 | 같음                                                 | `changed`, 파일 9개 |           0.27–0.28s |

- Run `37101560534`의 step 로그는 `FORMATTING_SCOPE: changed`, `Formatting scope: changed (9 files)`,
  `All matched files use Prettier code style!`입니다.
- 같은 PR에서 변경 경로를 `git diff --no-renames`로 구하게 바꿨습니다. Rename의 원래 경로도 lane을 고르므로, 파일을 lane 밖으로
  옮기는 PR에서 그 lane이 빠지던 under-selection이 사라졌습니다.
- 리뷰에서 찾은 fail-closed 공백도 고쳤습니다. `changed`인데 경로 목록이 비어 있던 경우의 검사 생략, 대체 비교 기준(직전
  commit·빈 tree)에서의 범위 축소, 규칙 밖 경로와 `.gitattributes` 변경에서의 범위 축소입니다. 지금 동작은 표면 문서의
  "Formatting 검사 범위" 절이 소유합니다.

## 7. 한계와 재측정 조건

- Baseline은 agent PR 9개입니다. 분류별 p50·p95를 주장하지 않습니다.
- 분 올림 합은 과금 방식을 따른 추정입니다. 실제 청구 금액은 다루지 않습니다.
- 시간 해상도는 1초입니다. 첫 job 전의 runner 대기열은 wall에서 빠지지만, 그 뒤 job의 대기열은 wall에 포함될 수 있습니다.
  Raw에는 대기열이 들어가지 않습니다.
- Runner 사양(CPU 수)이나 Node.js 기본 병렬도가 바뀌면 §4의 병렬도 판단과 §3 step 시간을 다시 측정합니다.

## 8. Interview evidence map

| 질문                                  | 근거 절 |
| ------------------------------------- | ------- |
| 어떤 문제를 어떤 수치로 확인했는가    | §1, §3  |
| 원인을 어떻게 좁혔는가                | §2, §4  |
| 왜 다른 방법을 쓰지 않았는가          | §5      |
| 개선 효과를 어떻게 검증하는가         | §2, §6  |
| 검증 중 발견한 공백을 어떻게 다뤘는가 | §6      |
