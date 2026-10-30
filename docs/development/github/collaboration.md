# GitHub collaboration guide

## 변경 시작

구현 변경은 [Branch and PR strategy](./branch-and-pr-strategy.md)에 따라 fresh `dev`에서 bounded branch를 생성한 뒤
진행합니다. 분석·계획처럼 source mutation이 없는 요청은 branch를 강제하지 않습니다.

1. 현재 사용자 요청, branch, `HEAD`, `git status --short`를 확인합니다.
2. unrelated working-tree 변경은 수정·삭제·stage하지 않습니다.
3. 변경 범위에 가장 가까운 production owner, contract, test를 먼저 찾습니다.
4. 작은 diff와 targeted verification을 우선합니다.

변경 전에 `prospective outcome`, `acceptance`, `non-scope`를 한 문장씩 정합니다. 구현 중 scope drift를 발견하면
[Branch and PR strategy](./branch-and-pr-strategy.md)의 네 가지 disposition인 `required-current`,
`prerequisite-predecessor`, `independent-follow-up`, `unrelated-or-speculative`로 분류합니다. 현재 acceptance가 바뀌기 전에
분류하고, 독립 작업은 branch에 넣지 않고 Issue 또는 successor로 이동합니다.

PR 전에는 [Branch readiness evidence](./branch-readiness.md)를 실행합니다. Script가 수집하는 path·line·CI lane은 context이고,
개발자 또는 repository-aware agent가 outcome·acceptance·owner boundary를 명시적으로 disposition합니다. 숫자만으로 branch를
거절하지 않으며, `scope-audit-required`는 PR body에 근거와 결론을 남기고 `stop-and-split`은 push 전에 분리합니다.

Coding agent를 사용한다면 root [`AGENTS.md`](../../../AGENTS.md)와 필요한
[agent workflow guide](../agent-workflows/README.md)를 읽습니다.

## Local Git hook

- `pre-commit`: `pnpm check:fast`로 staged file의 formatter와 local 작업 공간 배치(root 밖 `.omc`·`.omx`, 옛 root 이름)를 빠르게 확인합니다.
- `commit-msg`: repository 제목 구조와 literal `\\n` 오염을 확인합니다.
- hook은 `--no-verify`로 우회할 수 있으므로 merge correctness의 source of truth가 아닙니다.
- 전체 lint, typecheck, build, test는 hook에 추가하지 않고 변경 범위의 local verification과 CI가 담당합니다.

## Commit

- 제목과 본문은 root `AGENTS.md`의 한국어 conventional commit과 Lore protocol을 따릅니다.
- issue 번호는 관련 issue가 있을 때 연결합니다.
- 여러 줄 메시지는 message file 또는 heredoc과 `git commit -F`를 사용합니다.
- commit은 하나의 검토 가능한 의도와 검증 경계를 가집니다.
- Renovate commit prefix도 같은 `type(scope): 한글 설명` 구조를 사용하며 bot update라는 이유로 별도 제목 체계를 만들지
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

### Lifecycle 절

PR template의 `Lifecycle` 절은 CI `Lifecycle gate` job이 읽는 입력입니다. Job은 변경 분류와 무관하게 모든 pull request에서
실행되고 `CI summary`가 그 결과를 판정합니다. 검사 id(`W-SCOPE`·`W-POLICY`·`W-CITE`·`W-IRREV`·`L-CONFIRM`·`W-AREA`·`W-REVIEW`·
`W-CAUSE`)별 결과와 이유는 job summary에 남고, 판정 원본은 `scripts/ci/lifecycle/`입니다.

- 절이나 `변경 등급` 줄이 없거나 모르는 값이면 feature로 계산합니다. 제품 경로를 바꾸는 bugfix·hotfix도 등급 줄을 써야 아래
  정책 근거 누락이 fail이 아닌 경고가 됩니다. 정책 우선 검사에서 trivial은 비가역 경로와 Owner 확인만 계산합니다.
- `정책 도메인`에는 [경로 → 정책 도메인 표](../../policies/README.md#경로--정책-도메인-표)가 diff에서 판정한 도메인을 모두
  적습니다. 판정·선언한 도메인마다 그 정책의 규칙 id를 `인용 규칙`으로 인용하거나 `정책 영향 없음: <도메인> — <이유>` 줄을
  둡니다. id·접두어·인용 형식은 [정책 README](../../policies/README.md#규칙-id와-인용)가 소유합니다.
- `docs/policies/path-domains.json`·`docs/product/artifact-map.json`을 바꾸면 등급과 무관하게, feature·policy-change가
  `docs/policies/<도메인>.md`를 바꾸면 그 파일마다 `Owner 확인: <파일 경로> <YYYY-MM-DD>` 줄을 둡니다. 두 JSON 파일의
  `confirmedBy`는 Owner가 내용을 확인한 날짜와 이 작업의 issue 번호이고, 본문이 그 issue를 참조해야 합니다. 이 검사는
  override로 낮출 수 없습니다.
- trivial·bugfix·hotfix가 비가역 경로(path-domains.json의 `irreversiblePaths`: DB migration, 배포 설정)를 바꾸면 fail입니다.
  필요하면 `override: W-IRREV — <이유> — <재검토 조건>` 줄로 경고로 낮추고 리뷰가 그 근거를 봅니다.
- 제품 경로(path-domains.json의 `productRoots`)를 바꾸면 경로마다 영역 리뷰 기준이 있어야 합니다(`W-AREA`). 영역은
  [KNU domain binding](../agent-workflows/domain/knu-binding.md#영역-검사)의 경로 키로 판정합니다. 영역이 없는 경로는 PR base의
  제외 표 행에 맞으면 경고이고, 아니면 feature·policy-change에서 fail, trivial·bugfix·hotfix에서 경고입니다. 영역 키와 pack 절은
  PR head로 판정해 같은 PR에서 더해도 되지만, PR이 더한 제외 행은 그 PR에 적용되지 않습니다. 그래서 새 제품 디렉터리는 같은 PR에
  영역 키와 pack 절을 더하거나, 제외 행을 먼저 merge하거나, `override: W-AREA — <이유> — <재검토 조건>` 줄로 경고로 낮추고 리뷰가
  그 근거를 봅니다. 분기 뒤 base가 제외 행을 지우고 영역 키를 더했으면 branch를 base로 갱신합니다.
- 독립 리뷰가 PASS한 snapshot은 등급과 무관하게
  `리뷰 PASS: <reviewId> base=<sha> head=<sha> diff=<sha256|none> untracked=<sha256|none>` 줄로 적습니다. 값은 공통 리뷰
  결과의 `reviewedSnapshot`이고 host adapter digest(`KNU review snapshot sha256:…` 등)가 아닙니다.
  `node scripts/ci/lifecycle/review-snapshot-check.mjs --result <결과 JSON>`이 PASS 결과에서 이 줄을 만듭니다.
  `<reviewId>`는 결과 `dispatchId`에서 `review-dispatch-` 접두를 뺀 값, `diff`는 `dirtyDiffDigest`, `untracked`는
  `untrackedInputDigests`를 경로 순 `<path>\t<digest>` 줄로 이은 sha256이고, digest는 `sha256:` 접두 없는 64자이며 값이 없으면
  `none`입니다. PASS 회차마다 줄을 더할 수 있고 형식이 맞는 마지막 줄을 대조합니다. `W-REVIEW`는 그 head가 PR head와 다르면(PASS
  뒤 바뀐 파일을 summary에 적음), PASS head를 저장소에서 찾지 못하면(rebase 등), diff·untracked가 `none`이 아니면, 줄이 없거나
  형식이 틀리면 경고합니다.
- 리뷰 기준 문서(`docs/development/agent-workflows/review-criteria/**`), reviewer prompt 원본, reviewer 모델 정책 파일을 바꾸는 PR은
  held-out 재채점 결과를 `재채점: <통과|실패> <YYYY-MM-DD> <사용 기록 id>` 줄로, 재채점이 그 변경을 재지 않으면
  `재채점: 해당 없음 — <이유>` 줄로 적습니다. 경로 목록은 `review-snapshot-check.mjs`의 `RESCORE_TRIGGER_PATHS`와 그 test가
  고정합니다. 그 경로를 바꾼 PR에 줄이 없거나 형식이 틀리거나 값이 `실패`면 `W-REVIEW`가 경고하고, `실패`는 merge 전에 Owner가
  판단합니다.
- bugfix·hotfix는 고치는 결함이 들어온 PR을 `원인 PR: #<번호>` 또는 `원인 PR: 모름 — <이유>` 줄로 적습니다. 줄이 없거나 형식이
  틀리면 `W-CAUSE`가 경고하고, 다른 등급은 판정하지 않습니다.
- `W-REVIEW`·`W-CAUSE`는 경고만 내고, 비교할 revision을 읽지 못해도 경고로 남겨 job을 실패시키지 않습니다.
- author가 `renovate[bot]`·`dependabot[bot]`이거나 base가 `main`이면 모든 fail이 경고입니다.
- Job은 실행될 때 PR 본문을 REST API로 읽습니다. 본문을 고친 뒤에는 push 없이 실패한 `Lifecycle gate` job을 re-run합니다.
  `gh pr create --body`처럼 본문을 직접 넘겨 PR을 만들 때도 template의 `Lifecycle` 절을 넣습니다.

Durable follow-up, blocker, dependency와 completion evidence는 [Issues and work tracking](./issues-and-work-tracking.md)을
따릅니다. `dev` 대상 PR은 `Refs #N` 또는 Development sidebar로 연결하고, default branch인 `main` 승격에서 전체
acceptance가 포함된 Issue만 `Closes #N`으로 종료합니다.

## Dependency update flow

- 모든 version update와 보안 update PR은 Renovate가 `dev`를 대상으로 생성하고(npm/pnpm, GitHub Actions, Dockerfile,
  Docker Compose, `.node-version`), 제품 변경과 같은 integration gate를 거친 뒤 `main`으로 승격합니다. Dependabot은 alert만 맡습니다.
  Dependabot security update는 `target-branch`와 상관없이 default branch를 대상으로 하므로 저장소 Settings에서 끕니다.
- security·patch·minor PR과 Docker image digest PR은 `CI summary`가 통과하고 `dev`에 최신이면 Renovate가 squash merge합니다.
  major와 GitHub Actions digest PR은 사람이 검토합니다. 자세한 절차는
  [Dependency update operations](./dependency-updates.md)를 따릅니다.
- minor/patch update는 Renovate의 bounded owner group 안에서만 묶습니다. major update와 서로 다른 runtime stack은 원인
  격리를 위해 독립 PR로 유지합니다. 예외는 함께 움직이는 ESLint core pair(`eslint`·`@eslint/js`) major의 `eslint-major`
  승인 줄 하나입니다. pnpm은 update type과 관계없이 root와 CI 입력을 한 승인 줄로 묶고 사람이 merge합니다.
- Renovate는 label을 붙이지 않습니다. custom label이 필요하다면 원격 repository에 실제로 존재하는지 먼저 확인합니다.
- 두 bot은 default branch의 설정을 읽습니다. 기존 PR은 설정 변경만으로 target branch가 바뀐다고 가정하지 않고, 설정이
  default branch에 반영된 뒤 close/recreate 여부를 확인합니다.

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
