# GitHub collaboration guide

## 변경 시작

구현 변경은 [Branch and PR strategy](./branch-and-pr-strategy.md)에 따라 fresh `dev`에서 bounded branch를 생성한 뒤
진행합니다. 분석·계획처럼 source mutation이 없는 요청은 branch를 강제하지 않습니다.

1. 현재 사용자 요청, branch, `HEAD`, `git status --short`를 확인합니다.
2. unrelated working-tree 변경은 수정·삭제·stage하지 않습니다.
3. 변경 범위에 가장 가까운 production owner, contract, test를 먼저 찾습니다.
4. 작은 diff와 targeted verification을 우선합니다.

Coding agent를 사용한다면 root [`AGENTS.md`](../../../AGENTS.md)와 필요한
[agent workflow guide](../agent-workflows/README.md)를 읽습니다.

## Local Git hook

- `pre-commit`: `pnpm check:fast`로 staged file의 formatter를 빠르게 확인합니다.
- `commit-msg`: repository 제목 구조와 literal `\\n` 오염을 확인합니다.
- hook은 `--no-verify`로 우회할 수 있으므로 merge correctness의 source of truth가 아닙니다.
- 전체 lint, typecheck, build, test는 hook에 추가하지 않고 변경 범위의 local verification과 CI가 담당합니다.

## Commit

- 제목과 본문은 root `AGENTS.md`의 한국어 conventional commit과 Lore protocol을 따릅니다.
- issue 번호는 관련 issue가 있을 때 연결합니다.
- 여러 줄 메시지는 message file 또는 heredoc과 `git commit -F`를 사용합니다.
- commit은 하나의 검토 가능한 의도와 검증 경계를 가집니다.
- Dependabot prefix도 같은 `type(scope): 한글 설명` 구조를 사용하며 bot update라는 이유로 별도 제목 체계를 만들지
  않습니다.

## Pull request

PR 본문은 다음 질문에 답해야 합니다.

- 왜 변경했는가?
- 사용자가 보게 될 결과와 contract 변화는 무엇인가?
- migration, secret/config, security, operations, rollback 영향이 있는가?
- 어떤 명령과 UI evidence로 검증했는가?
- 검증하지 못한 범위는 무엇인가?

해당하지 않는 조건부 항목은 `해당 없음`으로 표시할 수 있습니다. 파일별 변경 목록이나 실행하지 않은 모든 명령을
체크하는 ritual checklist로 사용하지 않습니다.

## Dependabot update flow

- 일반 version update PR은 `dev`를 대상으로 생성하고, 제품 변경과 같은 integration gate를 거친 뒤 `main`으로
  승격합니다.
- security update는 GitHub의 default branch 정책에 따라 `main`을 대상으로 처리합니다. `target-branch` 설정으로 이
  경계를 우회하지 않습니다.
- npm과 GitHub Actions의 minor/patch update는 같은 owner 범위에서만 묶습니다. major update와 서로 다른 runtime
  stack은 원인 격리를 위해 독립 PR로 유지합니다.
- Dependabot label은 GitHub 기본값을 사용합니다. custom label이 필요하다면 원격 repository에 실제로 존재하는지
  먼저 확인합니다.
- 기존 PR은 설정 변경만으로 target branch가 바뀐다고 가정하지 않습니다. 설정이 default branch에 반영된 뒤
  close/recreate 여부를 확인합니다.

## Canonical verification

변경에 가장 가까운 targeted test를 먼저 실행하고 필요할 때 다음 gate를 확장합니다.

- staged files: `pnpm check:fast`
- repository policy: `pnpm test:repo-policy`
- API: `pnpm api:check`
- Web: `pnpm web:check`
- Infrastructure static: `pnpm infra:check:static`
- 전체 static check: `pnpm check`

CI는 changed-path classifier가 필요한 lane만 선택하고 `CI summary`가 최종 결과를 합칩니다. Local hook 성공만으로 PR
검증이 완료되었다고 보고하지 않습니다.

## Remote settings

Actions policy, merge strategy, branch protection, Dependabot security setting은 repository 파일만으로 적용 여부를 증명할
수 없습니다. 기대값과 현재 상태는 [Remote repository settings](./remote-repository-settings.md)에 secret 없이 기록하고,
실제 변경은 repository owner 권한과 명시적 승인 아래 수행합니다.
