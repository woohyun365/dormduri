# Branch and pull request strategy

이 문서는 KNU Roommate에서 구현 변경을 시작하고 통합하는 Git branch 책임을 정의합니다. 분석·계획처럼 source를
수정하지 않는 요청에는 branch 생성을 강제하지 않지만, 구현 요청은 edit·stage 전에 이 경계를 확인합니다.

## Branch 책임

| Branch                             | 책임                                                        |
| ---------------------------------- | ----------------------------------------------------------- |
| `main`                             | 검증된 release 기준과 default-branch provider 설정          |
| `dev`                              | 다음 통합을 위한 integration branch와 모든 일반 PR의 target |
| feature/fix/chore/perf/docs branch | 하나의 bounded implementation과 review·CI·rollback 경계     |

`dev`와 `main`에 직접 commit·push하지 않습니다. 사용자가 최신 integration baseline 위에서 구현하라고 요청한 경우에도
의미는 `dev`를 기준으로 삼는 것이지 `dev`가 implementation branch가 된다는 뜻이 아닙니다.

## 구현 시작 preflight

1. 현재 사용자 요청, branch, `HEAD`, `git status --short`를 확인합니다.
2. unrelated tracked·staged·untracked 파일과 사용자 소유 파일을 `doNotTouch`로 분리합니다. `DESIGN.md`처럼 작업 범위가
   아닌 파일을 stash, reset, delete, stage하지 않습니다.
3. `origin/dev`를 fetch합니다.
4. task working tree가 깨끗하면 local `dev`를 `origin/dev`에 fast-forward만 한 뒤 branch를 생성합니다.
5. task-owned uncommitted 파일이 이미 local `dev` 위에 있으면 reset하거나 임시 commit하지 않습니다. 현재 검증한
   `dev` HEAD에서 즉시 branch를 생성하고 파일이 그대로 유지되는지 확인합니다.
6. branch identity를 확인한 뒤에만 edit·stage·commit합니다.

예시:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git fetch origin dev
git switch dev
git merge --ff-only origin/dev
git switch -c feat/<bounded-outcome>
```

이미 task-owned 변경이 local `dev`에 있는 경우에는 fetch/merge로 working tree를 흔들기 전에 기준점을 확인하고 다음처럼
branch만 먼저 생성합니다.

```bash
git switch -c chore/<bounded-outcome>
git status --short
```

Local `dev`가 `origin/dev`와 diverge했다면 force/reset으로 숨기지 않고 commit graph와 작업 소유자를 먼저 확인합니다.

## Bounded PR

하나의 branch와 PR은 다음을 함께 설명할 수 있는 한 가지 결과를 소유합니다.

- objective와 사용자·운영 결과
- owned files와 제외 파일
- contract·migration·runtime 영향
- targeted regression과 확장 검증
- rollback 또는 clean forward-fix
- 알려진 gap과 다음 dependent unit

파일 수가 아니라 독립적으로 review·검증·rollback 가능한 책임을 기준으로 PR을 나눕니다. 단지 commit/PR 수를 줄이려고
dependency automation, product change, infrastructure, test topology를 한 branch에 누적하지 않습니다.

### Prospective change contract

Source mutation 전에 다음 세 문장을 현재 요청과 repository evidence로 작성합니다.

- `prospective outcome`: 이번 branch가 사용자·운영자·개발자에게 제공할 한 가지 결과
- `acceptance`: 그 결과가 완료됐음을 증명할 동작·contract·test·운영 evidence
- `non-scope`: 중요하지만 현재 결과와 독립적이거나 아직 evidence가 부족한 작업

이 계약은 고정된 최초 추측이 아닙니다. 현재 acceptance가 잘못됐다는 evidence가 나오면 owner authority 아래 수정할 수
있지만, branch 이름을 그대로 둔 채 새로운 outcome program을 흡수하는 근거로 사용하지 않습니다.

### Scope drift disposition

구현 중 새 개선점이나 누락을 발견하면 수정하기 전에 다음 네 가지 중 하나로 분류합니다.

| Disposition                | 기준                                            | 행동                                                  |
| -------------------------- | ----------------------------------------------- | ----------------------------------------------------- |
| `required-current`         | 현재 acceptance를 참으로 만들 수 없는 필수 작업 | 현재 branch에 유지하고 acceptance·verification을 갱신 |
| `prerequisite-predecessor` | 독립 review·rollback이 가능한 선행 조건         | 현재 mutation을 멈추고 predecessor Issue/PR로 분리    |
| `independent-follow-up`    | 가치가 있지만 현재 결과가 없어도 정확함         | Issue 또는 successor로 연결하고 현재 branch에서 제외  |
| `unrelated-or-speculative` | 현재 evidence·outcome·revisit trigger가 없음    | 구현하지 않고 폐기하거나 근거 있는 backlog로만 보존   |

다음 시점에는 line/commit 수와 무관하게 semantic checkpoint를 수행합니다.

- 계획된 acceptance slice가 검증됐을 때
- 인접 cleanup·새 기능·새 design direction을 발견했을 때
- prospective PR title, outcome 또는 non-scope가 달라질 때
- migration, trust, rollback, release owner가 추가될 때

예를 들어 현재 Storybook fixture로 합의된 visual direction을 구현하는 반복은 같은 outcome에 속할 수 있습니다. 그러나
Storybook 검토 중 선택한 **새로운 design direction** 또는 인접 페이지 개선은 `independent-follow-up`으로 둡니다.
backend 구현에서 현재 contract가 성립하려면 선행 mutation이 필요한 경우 `prerequisite-predecessor`로 분리하고, 발견한
unrelated cleanup은 별도 Issue로 옮기거나 구현하지 않습니다.

Scope audit 결과 서로 독립적으로 review 가능한 outcome, 다른 rollback·migration·security·release boundary, 또는
미병합 미래 작업에 의존하는 acceptance가 확인되면 현재 branch를 더 키우지 않고 predecessor/successor로 나눕니다.
Generated file, lockfile, codemod처럼 큰 diff는 context로 표시하되 크기만으로 분리하지 않습니다.

### Dependent acceptance batching

선행 contract/baseline과 바로 뒤의 implementation이 **같은 acceptance 결과**를 증명하고 아직 PR을 열지 않았다면, 두
단계를 같은 branch와 PR에 review 가능한 별도 commit으로 결합할 수 있습니다. 이는 모든 Phase를 합치는 일반 규칙이 아니라
다음 조건을 모두 만족하는 비용 최적화 예외입니다.

- 후속 구현이 선행 contract의 결과를 직접 소비한다.
- 동일한 owner, risk, rollback과 최종 verification 경계를 가진다.
- 결합 diff가 한 PR에서 이해 가능하고 실패 원인을 분리할 수 있다.
- Feature branch push만 존재하며 아직 `pull_request` CI가 시작되지 않았다.
- 별도 commit으로 contract와 implementation evidence를 구분하고 `dev` 대상 squash merge에서 통합한다.

이 조건이면 선행 PR의 별도 full workflow를 제거해 같은 acceptance의 중복 실행을 줄일 수 있습니다. `dev` merge push는
active PR-only ruleset과 required `CI summary`를 신뢰하므로 별도 Monorepo CI를 다시 실행하지 않습니다. 반대로 서로
다른 lockfile·migration·runtime owner, 독립 rollback, provider/production gate, 큰 toolchain migration은 비용을 이유로
결합하지 않습니다. 이미 PR review나 hosted CI가 시작됐다면 새 작업을 뒤늦게 밀어 넣지 않습니다.

## Plan과 branch

구현 가능한 plan은 최소한 다음을 명시합니다.

- baseline integration branch와 PR target
- implementation 전에 만들 branch 또는 naming rule
- 서로 의존하는 unit의 merge 순서
- 함께 review할 수 있는 bounded PR 단위
- provider·credential·production처럼 branch 밖에서 승인할 external gate
- 각 PR의 stop condition과 후속 branch의 시작 조건

Plan 작성 자체는 source mutation이 아니므로 branch 생성이 필수는 아닙니다. Plan 구현이 시작될 때는 fresh integration
branch에서 bounded branch를 생성합니다.

## Dependent work와 stacked PR

- dependent unit은 선행 PR이 `dev`에 병합된 뒤 fresh `dev`에서 시작하는 것이 기본입니다.
- stacked PR은 독립 review가 가능하고 base 관계가 명확할 때만 예외적으로 사용합니다.
- stacked PR을 `dev`로 전환하기 전에는 선행 merge 결과에 rebase하고 fresh CI를 다시 요구합니다.
- 같은 lockfile, migration, workflow, generated file을 여러 sibling branch가 동시에 소유하지 않습니다.

따라서 stacked PR은 기본 전략이 아니며, 긴 plan을 하나의 long-lived branch에서 수행하는 것도 기본 전략이 아닙니다.

## Agent Git ownership과 비동기 작업

Agent orchestration은 Git mutation authority를 자동으로 만들지 않습니다. Async 작업은 다음 boundary를 따릅니다.

- `read-only` agents may share the current checkout when they do not mutate the index or working tree.
- `one write-capable agent` owns the current checkout and branch at a time.
- 별도 asynchronous writer는 `distinct fresh branch`와 명시적인 owned/non-owned paths를 가져야 하며, 가능하면
  `separate worktree`에서 실행합니다.
- sibling agents do not push to the same branch and do not resolve each other's conflicts implicitly.
- the leader owns fan-in: 결과를 검토하고 integration 순서, verification, merge와 다음 fresh baseline을 결정합니다.
- local runtime state, child completion message, task label은 commit·push·merge 권한의 증거가 아닙니다.

현재 checkout에서 writer가 이미 작업 중이면 다른 child는 read-only evidence만 제공하거나 sequential handoff로 대기합니다.
미래에 반복적으로 production owner를 맡는 인간 contributor가 추가되면 CODEOWNERS와 non-author approval을 별도 remote-setting
결정으로 검토하며, agent review를 human approval로 가장하지 않습니다.

## Remote push budget

Local iteration은 빠른 feedback 경계이고 remote push는 GitHub Actions 사용량을 발생시키는 검증 이벤트입니다. Bounded PR
원칙은 유지하되, 같은 결과를 얻기 위한 불필요한 remote synchronization을 줄입니다.

1. 첫 push 전에 작업 범위의 targeted test, repository policy, lint/format과 diff check를 가능한 범위까지 local-green으로
   만듭니다.
2. 기본 remote budget은 reviewable branch의 최초 full validation push 1회와, 실제 remote evidence에 근거한 corrective push
   1회입니다. 세 번째 source push가 필요하면 이전 결과에서 일괄 수정하지 못한 이유를 checkpoint/PR에 남깁니다.
3. 동일한 active run 중 cosmetic text, PR body, local evidence만 변경하는 source push를 하지 않습니다. 같은 outcome의 변경을
   모아서 한 번에 push합니다.
4. PR title/body/label처럼 repository file을 바꿀 필요가 없는 metadata는 GitHub UI/API에서 수정하고 source push를 만들지
   않습니다.
5. Remote failure 뒤에는 모든 annotation과 log를 먼저 읽고 같은 root cause의 fix를 하나의 corrective push로 묶습니다.
   반복적인 trial push를 debugging loop로 사용하지 않습니다.
6. Provider permission, billing, budget 같은 control-plane 문제는 source를 변경하지 않습니다. GitHub가 prior success를
   보존하면 failed job만 rerun하고, source/workflow가 바뀐 경우에만 새 full run을 시작합니다.
7. `cancel-in-progress`는 superseded completion을 막지만 이미 사용한 runner minutes를 복구하지 않습니다. 알려진 security,
   credential, destructive migration 문제를 중단할 때만 active run을 즉시 supersede합니다.
8. Draft PR도 현재 `pull_request` workflow를 실행합니다. Remote test runner 용도로만 draft를 일찍 열지 않고, hosted-only
   evidence나 PR에서만 할 수 있는 review(사람 reviewer 등)가 필요할 때 생성합니다.
9. Agent 독립 검토는 hosted CI 없이 local commit의 diff와 검증 기록으로 할 수 있으므로 첫 push 전에 받습니다. PR을 먼저
   열면 검토 지적을 고칠 때마다 선택된 lane 전체가 다시 실행됩니다. 검토 입력에 hosted-only evidence가 꼭 필요하면 그 이유를
   PR에 남기고 먼저 push합니다.
10. `[skip ci]`, direct `dev`/`main` push, red fail-closed summary merge는 정상적인 비용 절감 수단이 아닙니다.
11. Review 시작 후 단순 history 미화를 위한 force-push를 피합니다. 추가 bounded commit으로 evidence를 보존하고 `dev`
    대상 squash merge를 bounded integration history 정리 경계로 사용합니다.

이 전략은 PR 수를 무작정 줄이지 않습니다. 서로 독립적인 owner와 rollback 경계는 별도 PR로 유지하고, CI 비용은 safe
change selection, local-green 검증, 같은 목적의 batch와 failed-job rerun으로 줄입니다.

## Pre-PR CI lane preflight

Feature branch push 자체는 현재 Monorepo CI를 시작하지 않지만 draft를 포함한 PR 생성은 `pull_request` workflow를 즉시
시작합니다. 따라서 최초 PR 생성 전에 GitHub와 동일한 changed-path classifier로 예상 lane을 확인하고, 선택된 lane의 가장
가까운 local gate를 실행합니다. 문서나 설정 변경처럼 보여도 root toolchain 또는 미분류 경로가 포함되면 fail-open으로 모든
lane이 선택될 수 있으므로 파일 종류만 보고 CI 범위를 추측하지 않습니다.

1. `git fetch origin dev` 후 [Branch readiness evidence](./branch-readiness.md)를 실행합니다. 간단한 변경은 outcome,
   acceptance, non-scope를 command line에 선언하고, owner/boundary 판단이 필요하면 task-local JSON을 사용합니다.

```bash
pnpm git:branch-readiness -- \
  --base origin/dev \
  --outcome '한 가지 결과' \
  --acceptance '완료 evidence' \
  --non-scope '독립 작업' \
  --json
```

2. `scope-audit-required`이면 current code·contract·test를 읽고 PR의 `Scope audit`에 signal, facts, disposition,
   exclusion과 gap을 기록합니다. `stop-and-split`이면 remote push 전에 predecessor/successor로 나눕니다. Path·line·commit
   count는 context이며 그 자체로 pass/fail gate가 아닙니다.
3. 현재 branch의 merge-base, `origin/dev...HEAD` changed path, dirty working tree와 `doNotTouch` 제외가 의도와 맞는지
   확인합니다. Raw evidence를 직접 대조할 때는 `git diff --name-only origin/dev...HEAD`를 사용합니다.
4. Branch readiness command가 CI가 import하는 동일한 `classifyChanges()`로 출력한 예상 lane을 확인합니다. 필요한 경우
   다음 raw classifier 확인으로 evidence를 교차 검증할 수 있습니다.

```bash
node --input-type=module <<'NODE'
import { execFileSync } from 'node:child_process';
import { classifyChanges } from './scripts/ci/classify-changes.mjs';

const paths = execFileSync(
  'git',
  ['diff', '--name-only', '--diff-filter=ACDMRTUXB', 'origin/dev...HEAD'],
  { encoding: 'utf8' },
)
  .trim()
  .split(/\n/u)
  .filter(Boolean);

console.log(JSON.stringify({ paths, classification: classifyChanges(paths) }, null, 2));
NODE
```

5. 항상 task-targeted regression을 먼저 실행하고, classifier 결과에 따라 다음 경계를 확장합니다.

| Selected lane                  | Pre-PR local gate                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| `repoPolicy`                   | `pnpm test:repo-policy`                                                                           |
| `shared`, `api`, `web`         | local PostgreSQL 준비 후 `pnpm check`; API runtime 변경은 관련 API test lane을 추가               |
| `storybook`                    | `pnpm --dir apps/web ci:storybook:build`                                                          |
| `infra`                        | `pnpm infra:check:static`; runtime/Compose 변경일 때만 `pnpm infra:check`까지 확장                |
| 여러 product lane 또는 unknown | 위 gate를 합치되 같은 build·prepare를 불필요하게 반복하지 않고 가장 강한 aggregate command를 우선 |

6. 실제 assertion·type·format·build 실패는 첫 push 전에 해결합니다. Agent sandbox의 port binding 차단, provider credential,
   Docker authority처럼 source 변경으로 해결할 수 없는 **environment gap**은 같은 명령을 적절한 local authority에서 한 번만
   재검증하고, 계속 제한되면 PR 검증 공백에 기록합니다. 환경 제한을 추측으로 고치거나 trial push로 디버깅하지 않습니다.
7. 독립 검토가 필요한 변경은 push할 HEAD 기준의 검토 결과를 먼저 받습니다([PR과 merge](#pr과-merge) 5단계). 예상 lane, scope audit,
   local-green 결과, 환경 gap, 독립 검토 결과, `doNotTouch` 파일을 PR body에 한 번에 기록한 뒤 branch를 한 번 push하고 PR을
   생성합니다. Remote failure가 발생하면 전체 log를 읽어 하나의 corrective push로 묶습니다.

## PR과 merge

1. 변경 범위에 가장 가까운 targeted test를 먼저 실행합니다.
2. 관련 lint, typecheck, build, integration, repository policy를 확장합니다.
3. staged 범위와 unrelated 파일 제외를 다시 확인합니다.
4. commit은 하나의 의도와 Lore evidence를 가집니다.
5. merge 전 독립 검토가 필요한 변경([QA disposition](../agent-workflows/qa.md#independent-review-disposition))은 이 local
   commit에서 검토를 받습니다. 지적 수정과 재검토도 push 전에 끝내고, 수정 commit은 local에 모읍니다. 검토 뒤 preflight
   수정 등으로 source가 바뀌면 그 delta를 push 전에 다시 검토합니다. Hosted-only evidence가 필요한 예외는
   [Remote push budget](#remote-push-budget) 9를 따릅니다.
6. [Pre-PR CI lane preflight](#pre-pr-ci-lane-preflight)를 거쳐 branch를 한 번 push하고 PR을 만듭니다. PR은 `dev`를
   target으로 하며 실제 검증 결과, 검증 공백과 독립 검토 결과를 기록합니다.
7. Required CI가 green이 된 뒤 target branch가 허용하는 merge method로 merge합니다.
8. merge 후 local `dev`를 fast-forward하고 [local branch disposition](#local-branch-cleanup)을 기록합니다.
   다음 dependent work는 그 상태에서 새 branch를 만듭니다.

`dev -> main` 승격은 feature PR과 별도의 integration 경계입니다. External provider 설정은 default branch 반영이 필요할 수
있지만, repository owner 승인과 green CI 없이 직접 main을 수정하지 않습니다.

### Target별 merge method

```text
feature/fix/chore branch -> dev: squash merge
dev -> main integration: merge commit
```

- `dev`는 bounded PR의 여러 review commit을 하나의 의도 단위로 squash해 linear history를 유지합니다.
- `main`은 장기 integration branch인 `dev`를 merge commit으로 받아 `dev` commit ancestry와 명시적인 release integration
  point를 보존합니다.
- `dev -> main`에서 squash를 사용하지 않습니다. 같은 파일 snapshot이 반영돼도 Git이 `dev` ancestry를 잃어 후속 promotion
  conflict와 byte-identical reconciliation을 만들 수 있습니다.
- Repository setting은 squash와 merge commit을 모두 허용하되, active `dev-integration-gate`는 squash only,
  `main-release-gate`는 merge only로 제한합니다. 상세 expected/actual evidence는 `remote-repository-settings.md`가 소유합니다.

## Local branch cleanup

통합 완료 시 이번 task-local branch를 `deleted` 또는 `retained-with-reason`으로 인계합니다. 전체 local branch inventory
audit는 별도 요청·대상 확정이 필요한 작업이며, 현재 PR 완료를 다른 작업/세션의 일괄 정리 권한으로 확대하지 않습니다.
업무 권한은 현재 요청의 cleanup 대상·행동에서 확인합니다. MERGED, CI green, reviewer PASS는 삭제 승인을 대신하지 않습니다.
권한이 없거나 증거가 모호하면 보존 이유와 다시 판단할 조건을 남기고, 독립적인 다음 구현은 계속할 수 있습니다.

| Ref surface         | 의미와 정리 경계                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| local branch        | 현재 clone의 `refs/heads/*`; 아래 절차의 대상                                                                                                     |
| remote branch       | GitHub 등 서버의 branch; merge 후 자동 삭제돼도 local ref는 남음                                                                                  |
| remote-tracking ref | local 관측값 `refs/remotes/*`; `git fetch origin --prune`은 사라진 remote ref의 관측값을 정리할 뿐 local branch를 삭제하거나 병합을 증명하지 않음 |

### 판정과 보호

1. 저장소 identity, 정확한 ref 이름/OID, upstream, 현재 branch/status와 `git worktree list --porcelain`을 확인합니다.
   `main`·`dev` 및 owner가 보호한 ref, 모든 registered worktree와 다른 세션의 작업을 후보에서 제외합니다.
2. 같은 repository의 PR, merged head OID와 local tip의 일치, expected base, 실제 merge OID를 확인합니다.
   merge OID가 fresh target history의 ancestor인지 확인합니다. ref 이름이나 과거 PR 번호만으로 연결하지 않습니다.
   squash에서는 원본 commit ancestry가 필수 조건이 아니며, PR head→merge 결과의 변경 반영을 별도로 확인합니다.
   target이 전진했다면 현재 dev 전체 tree와 원본 branch tree를 단순 비교하지 않습니다.
   `git branch --merged`의 후보 목록도 PR·권한·소유권 증거를 대신하지 않습니다.
3. 아래 판정에서 하나라도 보존 조건이면 삭제하지 않습니다. 이름이 재사용되거나 추가 commit이 있으면 기존 merged PR의
   승인을 새 tip에 전용하지 않고 다시 소유권·통합 여부를 확인합니다.

| 관찰                             | Disposition                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| 정확한 merged tip·통합 증거 있음 | 보호 충돌이 없을 때만 삭제 후보; 권한·복구·재확인까지 충족해야 실행                        |
| 추가 commit·branch 이름 재사용   | `retained-with-reason`; 현재 tip의 소유권·별도 통합 증거 확인                              |
| OPEN·CLOSED-unmerged·unpublished | `retained-with-reason`; 완료하지 않은 작업으로 보존                                        |
| `[gone]`·CI green만 확인         | `retained-with-reason`; remote 부재/테스트 성공은 merge 증거가 아님                        |
| feature upstream에만 포함        | `-d`가 성공할 수 있어도 dev 통합 증거가 없으면 `retained-with-reason`                      |
| current·`main`·`dev`·보호 ref    | 보존; 자신의 clean checkout에서 안전하게 다른 branch로 이동한 뒤에만 current 후보를 재판정 |
| 모든 registered worktree         | attached·locked·경로 unavailable 모두 보존; 다른 worktree를 강제로 전환·제거하지 않음      |
| 소유권·provider 증거 불명        | `retained-with-reason`; 확인할 owner·증거·권한을 다음 조건으로 기록                        |

### 실행·복구·인계

1. 대상 ref/OID, upstream, repository·PR·base·merge 증거와 보호 판정을 고정합니다. 복구는 위험에 비례해 준비합니다.
   원본 tip이 보존할 target history에 도달 가능하면 그 history로 ref를 복원할 수 있습니다. squash 원본처럼 도달 가능하지
   않은 commit은 삭제 전에 적절한 bundle과 ref manifest 등으로 객체 보존을 확인하거나 branch를 보존합니다.
   bundle은 `git bundle verify`와 `git bundle list-heads`로 의존 history와 정확한 tip 포함 여부를 확인합니다.
   self-contained bundle을 사용하거나 제외된 prerequisite가 이번 삭제 대상 밖의 history/ref 또는 검증한 backup에
   독립적으로 보존됨을 확인합니다. 현재 checkout의 verify 성공만으로 삭제 후 prerequisite 생존을 보장하지 않으며,
   이를 확인할 수 없으면 branch를 보존합니다.
   SHA 기록이나 삭제되는 branch의 reflog만으로 복구를 보장하지 않습니다. branch 삭제는 그 reflog도 삭제합니다.
2. 삭제 직전 ref/OID·target·current branch/status·worktree 상태를 재확인합니다. 관찰은 원자적 lock이 아니므로 다른 writer와
   조율하고, ref 이동·새 attachment·증거 불일치가 있으면 중단·재판정합니다. 다중 writer 경쟁을 배제할 수 없으면 보존합니다.
3. 승인된 정확한 단일 branch에 `git branch -d -- <branch>`를 우선 사용합니다. 이 명령은 설정된 upstream(없으면 HEAD)의
   도달 가능성을 검사하므로 성공 자체가 dev 통합 증거는 아닙니다. 위 판정을 명령의 성공 여부로 대체하지 않습니다.
   실패를 자동으로 강제 삭제로 전환하지 않습니다. `-D`는 별도 확인된 강제 삭제 범위의 권한과 통합·보호·복구 조건이
   모두 갖춰진 정확한 ref에만 사용합니다. blanket deletion이나 삭제 loop를 기본 절차로 두지 않습니다.
4. 삭제 후 정확한 local ref가 없는지 확인하고 다른 ref/worktree가 바뀌지 않았는지 확인합니다. 실패·변동을 숨기지 않습니다.
   복구 시에도 동일 이름의 새 ref를 덮어쓰지 않습니다. manifest와 보존 history/bundle로 정확한 tip을 되살리되 upstream
   등 branch 설정은 별도 확인합니다. reflog/history 복원과 설정 복원은 같은 주장이 아닙니다.
5. handoff에 branch/tip·통합 PR·`deleted` 또는 `retained-with-reason`·근거·복구 위치 또는 보존 이유·다음 판단 조건을
   남깁니다. `retained-with-reason`도 정리 판정의 완료이며 삭제 실패를 감추는 표현은 아닙니다.

Local cleanup은 remote 삭제, worktree 제거, GC를 포함하지 않습니다. 각각 별도 범위·권한을 확인하고 복구 객체를 지우지
않습니다. 개인 경로·과거 branch inventory·bundle receipt는 local artifact/handoff에 두며 장기 정책에 복제하지 않습니다.
이 절차는 advisory-policy이고 관련 문서 회귀는 deterministic-static 정합성 검사입니다. Agent의 실제 삭제 판단이나
host 권한을 강제하지 않으며, 새 CLI·hook·상태 파일 설치를 요구하지 않습니다.

## 예외와 복구

- Production incident나 security hotfix도 명시적인 owner authority가 없다면 direct push 대신 가장 작은 fix branch와 PR을
  사용합니다.
- branch를 잘못 선택했어도 unrelated work를 reset하지 않습니다. 새 branch 생성, commit 이동, cherry-pick처럼 git
  history가 설명 가능한 복구를 사용합니다.
- PR이 실패하면 같은 branch에서 원인을 해결하고 fresh checks를 읽습니다. 실패한 branch를 새 branch로 복제해 evidence를
  분산시키지 않습니다.
