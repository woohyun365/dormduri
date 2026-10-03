# CI change classification evidence

> **Audience:** human-to-human portfolio, onboarding, and engineering discussion reference.
> 이 문서는 CI 분류 규칙의 owner가 아닙니다. 현재 경로별 표면·lane·owner는
> [CI surface ownership](./ci-surface-ownership.md), 설계 결정과 job graph는
> [Monorepo CI architecture](../../architecture/platform/monorepo-ci.md)가 소유합니다. 분류별 누적 측정 표본은
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
   완전성이 이미 달성합니다(§6).
3. Agent test 배치: `scripts/ci`의 agent test·fixture를 하위 디렉터리로 모아 분류 규칙을 디렉터리 단위로 둡니다.
4. Agent test lane 분리: 측정으로 이득이 확인될 때만 채택합니다.
5. Formatting 검사 범위: formatting 설정이 바뀌지 않은 PR은 변경 파일만 검사합니다.
6. Policy script test critical path: 가장 긴 test 파일의 시간을 줄입니다.

## 6. 개선별 전후 측정

| 개선 항목                        | PR   | 표본 수 | Wall p50 | Wall p95 | 분 올림 합 p50 | 상태     |
| -------------------------------- | ---- | ------: | -------: | -------: | -------------: | -------- |
| 분류 완전성                      | #537 |     0/5 |        - |        - |              - | 표본 0/5 |
| Agent workflow 분류 출력         | -    |       - |        - |        - |              - | 미측정   |
| Agent test 배치                  | -    |       - |        - |        - |              - | 미측정   |
| Agent test lane 분리             | -    |       - |        - |        - |              - | 미측정   |
| Formatting 검사 범위             | #545 |     0/5 |        - |        - |              - | 표본 0/5 |
| Policy script test critical path | -    |       - |        - |        - |              - | 미측정   |

p50은 표본 5개, p95는 표본 10개가 모인 뒤에만 적습니다(Monorepo CI architecture의 표본 규칙).

표본은 해당 PR merge 뒤 자연 발생한 agent-only PR의 `Monorepo CI` workflow run입니다. 개선 전 값은 §3입니다.

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

### Formatting 검사 범위(#545) step 시간

이 개선은 Repository policy gate의 `Verify repository formatting` step만 바꿉니다. 그래서 run 전체 시간과 함께 이 step의
시간을 §2의 step 시간 명령으로 비교합니다. 개선 전에는 모든 run이 `prettier . -c`로 tree 전체를 검사했습니다.

| Run ID        | PR   | Head SHA   | Job | Formatting step |
| ------------- | ---- | ---------- | --: | --------------: |
| `37088505466` | #543 | `69ce428a` |   3 |             20s |
| `37086373593` | #541 | `b5a62079` |   3 |             25s |
| `37084666943` | #539 | `b8aa3ea8` |  11 |             24s |
| `37030067867` | #537 | `87bba80d` |   5 |             28s |
| `37017495949` | #535 | `564eb0bd` |   3 |             35s |

- 개선 전 5개의 step 시간은 20–35s이고 중앙값은 25s입니다. §3의 두 run(34s, 33s)도 같은 범위입니다.
- 개선 뒤 표본은 #545 merge 뒤 formatting 설정을 바꾸지 않은 agent-only PR의 run입니다. 지금은 표본 0/5입니다.
- 개선 뒤 run에서는 step 출력의 `Formatting scope:` 줄로 검사 범위(`full`·`changed`)와 검사한 파일 수를 확인합니다.

## 7. 한계와 재측정 조건

- Baseline은 agent PR 9개입니다. 분류별 p50·p95를 주장하지 않습니다.
- 분 올림 합은 과금 방식을 따른 추정입니다. 실제 청구 금액은 다루지 않습니다.
- 시간 해상도는 1초입니다. 첫 job 전의 runner 대기열은 wall에서 빠지지만, 그 뒤 job의 대기열은 wall에 포함될 수 있습니다.
  Raw에는 대기열이 들어가지 않습니다.
- Runner 사양(CPU 수)이나 Node.js 기본 병렬도가 바뀌면 §4의 병렬도 판단과 §3 step 시간을 다시 측정합니다.

## 8. Interview evidence map

| 질문                               | 근거 절 |
| ---------------------------------- | ------- |
| 어떤 문제를 어떤 수치로 확인했는가 | §1, §3  |
| 원인을 어떻게 좁혔는가             | §2, §4  |
| 왜 다른 방법을 쓰지 않았는가       | §5      |
| 개선 효과를 어떻게 검증하는가      | §2, §6  |
