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

## PR과 merge

1. 변경 범위에 가장 가까운 targeted test를 먼저 실행합니다.
2. 관련 lint, typecheck, build, integration, repository policy를 확장합니다.
3. staged 범위와 unrelated 파일 제외를 다시 확인합니다.
4. commit은 하나의 의도와 Lore evidence를 가집니다.
5. PR은 `dev`를 target으로 하며 실제 검증 결과와 검증 공백을 기록합니다.
6. Required CI가 green이 된 뒤 merge합니다.
7. merge 후 local `dev`를 fast-forward하고, 다음 dependent work는 그 상태에서 새 branch를 만듭니다.

`dev -> main` 승격은 feature PR과 별도의 integration 경계입니다. External provider 설정은 default branch 반영이 필요할 수
있지만, repository owner 승인과 green CI 없이 직접 main을 수정하지 않습니다.

## 예외와 복구

- Production incident나 security hotfix도 명시적인 owner authority가 없다면 direct push 대신 가장 작은 fix branch와 PR을
  사용합니다.
- branch를 잘못 선택했어도 unrelated work를 reset하지 않습니다. 새 branch 생성, commit 이동, cherry-pick처럼 git
  history가 설명 가능한 복구를 사용합니다.
- PR이 실패하면 같은 branch에서 원인을 해결하고 fresh checks를 읽습니다. 실패한 branch를 새 branch로 복제해 evidence를
  분산시키지 않습니다.
