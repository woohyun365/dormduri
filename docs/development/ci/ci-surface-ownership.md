# CI surface ownership

변경 경로가 어느 표면(surface)에 속하고 어떤 CI lane을 깨우는지, 그 표면의 owner 문서가 무엇인지 정합니다. 이 문서는
현재 분류 규칙의 책임 표입니다. 분류 동작의 원본은 `scripts/ci/lanes/classify-changes.mjs`이고, 아래 표는
`scripts/ci/lanes/classify-changes.test.mjs`가 행마다 대표 경로로 분류기와 대조합니다. 설계 결정과 job graph는
[Monorepo CI architecture](../../architecture/platform/monorepo-ci.md), 분류별 누적 측정 표본은
[Monorepo CI baseline](../../evidence/ci/monorepo-ci-baseline.md), 분류 개선의 문제·측정·결정 기록은
[CI change classification evidence](../../evidence/ci/ci-change-classification-evidence.md)가 소유합니다.

## Lane

`.github/workflows/ci.yml`은 pull request와 `main` push에서 실행됩니다. 분류기는 비교 범위의 변경 경로마다 아래 출력을
켜고, workflow는 켜진 출력의 job만 실행합니다. 모든 경우에 `Classify changed surfaces`와 `CI summary` job은 실행됩니다.
Pull request에서는 분류 출력과 무관하게 `Lifecycle gate` job(PR 본문 `Lifecycle` 절과 정책 우선·영역 기준 존재·리뷰 snapshot 검사,
[작성법](../github/collaboration.md#lifecycle-절))도 실행되고 `CI summary`가 그 결과를 판정합니다. 이 job은 분류 출력이 아니므로
아래 표에 없습니다.
변경 경로가 하나도 없으면 `repoPolicy`와 `agentWorkflow`만 켭니다.

| 출력            | 실행되는 job                                                                 |
| --------------- | ---------------------------------------------------------------------------- |
| `shared`        | Shared contract gate                                                         |
| `api`           | API validation(core, integration shard 2개)                                  |
| `web`           | Web validation(static/build/browser, unit)                                   |
| `storybook`     | Web validation 안의 Storybook static build와 새 story 렌더·axe·스크린샷 검사 |
| `infra`         | Infrastructure validation(static, container config)                          |
| `repoPolicy`    | Repository policy gate(policy script test와 formatting 검사)                 |
| `agentWorkflow` | Agent workflow gate(agent workflow test, package install 없음)               |

표의 "전체"는 일곱 출력을 모두 켜는 경우입니다.

### Policy test suite와 agent workflow lane

`scripts/ci/lanes/run-repo-policy.mjs`는 policy test를 두 suite로 나눠 실행합니다(`scripts/ci/lanes/repo-policy-test-files.mjs`).

- `agent-workflow`: `scripts/ci/agents/**`의 test에서 tree 전체 guard(`agent-guidance-boundary`)를 뺀 것. 저장소 밖 package를 import하지 않아
  Agent workflow gate는 `pnpm install` 없이 실행합니다.
- `repo-policy`: 나머지 전부와 tree 전체 guard. 이 guard는 `prettier`를 import하고 tracked 경로 전체를 읽습니다.
- 인자가 없으면(로컬 `pnpm test:repo-policy`) 두 suite를 모두 실행합니다. Test가 모든 policy test가 정확히 한 suite에 속하는지
  확인합니다.

`agentWorkflow`는 `repoPolicy`가 켜지는 모든 변경에서 켜집니다. Agent workflow test는 agent 표면과 문서·repository 지원 파일을
읽고, 이 경로들이 `repoPolicy`를 켜기 때문입니다. 그래서 agent 표면만 바꾼 PR도 역방향 test(agent 경로를 읽는 비 agent test)와
formatting 검사를 Repository policy gate에서 계속 실행합니다. 이 밖에 agent workflow test가 읽는 product 파일(분류기의
`AGENT_TEST_PRODUCT_INPUTS`, agent suite의 파일 읽기를 trace해 정함)을 바꾸면 그 product lane과 함께 `agentWorkflow`가 켜집니다.
`classify-changes.test.mjs`는 agent test 디렉터리의 파일(agent suite test, helper, fixture)이 이름으로 적거나
`docs/development` 문서가 링크한 tracked product 파일이 모두 이 목록에 있는지 확인합니다.

검사 범위 밖: agent test가 실행하는 `scripts/agents/**` 코드가 이름으로 적은 product 파일, 이름이나 링크 없이 계산된 경로(디렉터리
순회, 문자열 조합)로 읽는 product 파일. 이런 파일을 새로 읽게 하는 변경은 그 PR에서 목록을 갱신해야 하며, 빠지면 그 product
파일만 바꾼 PR이 agent workflow lane을 켜지 않습니다.

## 표면 정의

- `API`: NestJS API와 Prisma schema·migration
- `Web`: Next.js Web과 BFF, Storybook
- `Packages-shared`: Web·API가 함께 쓰는 contract와 schema
- `Packages-config`: 공통 lint·TypeScript 설정 package
- `Platform`: CI workflow, container·infra 설정, infra·observability script, GitHub 저장소 설정 파일
- `Root toolchain`: root package manifest, lockfile, Node 버전, 편집기 설정
- `Repository policy`: CI·Git·GitHub·dependency·artifact script, repository 문서, formatting 설정
- `Agent workflow`: coding agent 지침·adapter·script·test·fixture와 host 설정
- `Local record`: ignored 디렉터리(`.plans`, `.artifacts`, `omx_wiki`)의 tracked 안내 파일

## 경로 family 표

상태는 두 가지입니다.

- **분류됨**: 규칙이 표면에 맞는 lane만 켭니다.
- **의도한 fan-out**: 여러 lane에 실제로 영향을 주는 경로라 전체 lane을 켭니다. 분류기의 `isIntendedFanOut` 목록과
  같아야 하며, test가 행의 상태와 대표 경로를 이 목록과 대조합니다.

규칙에 맞지 않는 경로는 모르는 경로로 전체 lane을 켭니다(fail-open). Tracked 경로에서는 test가 이를 막으므로 표에는
fail-open 행이 없습니다. 새 경로 family는 규칙을 정한 뒤 "분류됨"으로 추가합니다.

| 경로 family                                                                                                                                                                                                                                                                                         | 표면              | 현재 lane                                                | 상태           | Owner                                                                                                                         | 대표 경로                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/**`(agent test 입력 파일은 `agentWorkflow`도 켬)                                                                                                                                                                                                                                          | API               | `api`                                                    | 분류됨         | `apps/api/README.md`                                                                                                          | `apps/api/README.md`                                                                                                                                                                                                                   |
| `apps/web/**`(Storybook 경로 제외)(agent test 입력 파일은 `agentWorkflow`도 켬)                                                                                                                                                                                                                     | Web               | `web`                                                    | 분류됨         | `apps/web/README.md`                                                                                                          | `apps/web/README.md`                                                                                                                                                                                                                   |
| `apps/web/**`의 `.storybook/`·`stories/`·`__stories__/`·`*.stories.*`, `apps/web/src/styles/`·`apps/web/src/screens/`·`apps/web/e2e/storybook/`·`apps/web/playwright.storybook.config.ts`·`apps/web/src/app/globals.css`·`apps/web/postcss.config.mjs`(agent test 입력 파일은 `agentWorkflow`도 켬) | Web               | `web`, `storybook`                                       | 분류됨         | `apps/web/README.md`                                                                                                          | `apps/web/src/main/tabs/chat/__stories__/ChatTab.system.stories.tsx`, `apps/web/src/styles/fonts.ts`                                                                                                                                   |
| `packages/shared/**`(agent test 입력 파일은 `agentWorkflow`도 켬)                                                                                                                                                                                                                                   | Packages-shared   | `shared`, `web`, `api`                                   | 분류됨         | `docs/architecture/monorepo/lifestyle-contract-sharing.md`                                                                    | `packages/shared/package.json`                                                                                                                                                                                                         |
| `packages/eslint-config/**`, `packages/tsconfig/**`                                                                                                                                                                                                                                                 | Packages-config   | 전체                                                     | 의도한 fan-out | `docs/architecture/platform/monorepo-ci.md`                                                                                   | `packages/eslint-config/package.json`, `packages/tsconfig/package.json`                                                                                                                                                                |
| `infra/**`(아래 두 행 제외), `scripts/infra/**`, `scripts/observability/**`(아래 lane script 제외)                                                                                                                                                                                                  | Platform          | `infra`, `repoPolicy`, `agentWorkflow`                   | 분류됨         | `infra/README.md`                                                                                                             | `infra/README.md`, `scripts/infra/check/run.mjs`, `scripts/observability/production/validate-stack.mjs`                                                                                                                                |
| `scripts/artifacts/paths.mjs`, `scripts/infra/compose/profile.mjs`, `scripts/observability/production/environment.mjs`, `scripts/observability/rehearsal/web-bff.mjs`                                                                                                                               | Platform          | `api`, `infra`, `repoPolicy`, `agentWorkflow`            | 분류됨         | `infra/README.md`                                                                                                             | `scripts/artifacts/paths.mjs`, `scripts/infra/compose/profile.mjs`, `scripts/observability/production/environment.mjs`, `scripts/observability/rehearsal/web-bff.mjs`                                                                  |
| `scripts/observability/sentry/check-build.mjs`                                                                                                                                                                                                                                                      | Platform          | `web`, `infra`, `repoPolicy`, `agentWorkflow`            | 분류됨         | `infra/observability/README.md`                                                                                               | `scripts/observability/sentry/check-build.mjs`                                                                                                                                                                                         |
| `infra/db/**`, `infra/deploy/api/**`, `infra/deploy/nginx/**`, `infra/deploy/compose.api.yml`, `infra/deploy/scripts/**`                                                                                                                                                                            | Platform          | `api`, `infra`, `repoPolicy`, `agentWorkflow`            | 분류됨         | `infra/README.md`                                                                                                             | `infra/db/README.md`, `infra/deploy/api/Dockerfile`, `infra/deploy/nginx/conf.d/api.conf`, `infra/deploy/compose.api.yml`, `infra/deploy/scripts/api-release-smoke.sh`                                                                 |
| `infra/deploy/web/**`                                                                                                                                                                                                                                                                               | Platform          | `web`, `infra`, `repoPolicy`, `agentWorkflow`            | 분류됨         | `infra/README.md`                                                                                                             | `infra/deploy/web/Dockerfile`                                                                                                                                                                                                          |
| `docker-compose.dev.yml`, `.dockerignore`                                                                                                                                                                                                                                                           | Platform          | `api`, `infra`, `repoPolicy`, `agentWorkflow`            | 분류됨         | `infra/README.md`                                                                                                             | `docker-compose.dev.yml`, `.dockerignore`                                                                                                                                                                                              |
| `.github/workflows/ci.yml`                                                                                                                                                                                                                                                                          | Platform          | 전체                                                     | 의도한 fan-out | `docs/architecture/platform/monorepo-ci.md`                                                                                   | `.github/workflows/ci.yml`                                                                                                                                                                                                             |
| `.github/workflows/api-ci.yml`                                                                                                                                                                                                                                                                      | Platform          | `api`, `repoPolicy`, `agentWorkflow`                     | 분류됨         | `docs/architecture/platform/monorepo-ci.md`                                                                                   | `.github/workflows/api-ci.yml`                                                                                                                                                                                                         |
| `.github/workflows/web-ci.yml`                                                                                                                                                                                                                                                                      | Platform          | `web`, `repoPolicy`, `agentWorkflow`                     | 분류됨         | `docs/architecture/platform/monorepo-ci.md`                                                                                   | `.github/workflows/web-ci.yml`                                                                                                                                                                                                         |
| `.github/workflows/infra-ci.yml`, `.github/dependabot.yml`                                                                                                                                                                                                                                          | Platform          | `infra`, `repoPolicy`, `agentWorkflow`                   | 분류됨         | `docs/architecture/platform/monorepo-ci.md`, `docs/architecture/platform/dependency-automation.md`                            | `.github/workflows/infra-ci.yml`, `.github/dependabot.yml`                                                                                                                                                                             |
| `.github/workflows/api-restore-drill-manual.yml`                                                                                                                                                                                                                                                    | Platform          | `api`, `infra`, `repoPolicy`, `agentWorkflow`            | 분류됨         | `docs/architecture/platform/monorepo-ci.md`                                                                                   | `.github/workflows/api-restore-drill-manual.yml`                                                                                                                                                                                       |
| `.github/**/*.md`                                                                                                                                                                                                                                                                                   | Platform          | `repoPolicy`, `agentWorkflow`                            | 분류됨         | `docs/development/github/README.md`                                                                                           | `.github/PULL_REQUEST_TEMPLATE.md`, `.github/SECURITY.md`                                                                                                                                                                              |
| `.github/ISSUE_TEMPLATE/**`                                                                                                                                                                                                                                                                         | Platform          | `repoPolicy`, `agentWorkflow`                            | 분류됨         | `docs/development/github/issues-and-work-tracking.md`                                                                         | `.github/ISSUE_TEMPLATE/blocker.yml`, `.github/ISSUE_TEMPLATE/config.yml`, `.github/ISSUE_TEMPLATE/work-item.yml`                                                                                                                      |
| `renovate.json`                                                                                                                                                                                                                                                                                     | Platform          | `repoPolicy`, `agentWorkflow`                            | 분류됨         | `docs/architecture/platform/dependency-automation.md`                                                                         | `renovate.json`                                                                                                                                                                                                                        |
| `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.node-version`, `.lintstagedrc.mjs`                                                                                                                                                                                                       | Root toolchain    | 전체                                                     | 의도한 fan-out | `docs/architecture/platform/monorepo-ci.md`                                                                                   | `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.node-version`, `.lintstagedrc.mjs`                                                                                                                                          |
| `.vscode/**`                                                                                                                                                                                                                                                                                        | Root toolchain    | `repoPolicy`, `agentWorkflow`                            | 분류됨         | `README.md`                                                                                                                   | `.vscode/extensions.json`, `.vscode/settings.json`                                                                                                                                                                                     |
| `scripts/ci/**`(`scripts/ci/agents/**`와 아래 lane script 제외), `scripts/git/**`, `scripts/github/**`, `.husky/**`                                                                                                                                                                                 | Repository policy | `repoPolicy`, `agentWorkflow`                            | 분류됨         | `docs/architecture/platform/monorepo-ci.md`, `docs/development/github/README.md`                                              | `scripts/ci/lanes/classify-changes.mjs`, `scripts/git/validate-commit-message.mjs`, `scripts/github/account-evidence.mjs`, `.husky/pre-commit`                                                                                         |
| `scripts/ci/lanes/run-timed-command.mjs`                                                                                                                                                                                                                                                            | Repository policy | `web`, `api`, `storybook`, `repoPolicy`, `agentWorkflow` | 분류됨         | `docs/architecture/platform/monorepo-ci.md`                                                                                   | `scripts/ci/lanes/run-timed-command.mjs`                                                                                                                                                                                               |
| `scripts/ci/lanes/repo-policy-test-files.mjs`                                                                                                                                                                                                                                                       | Repository policy | `infra`, `repoPolicy`, `agentWorkflow`                   | 분류됨         | `docs/architecture/platform/monorepo-ci.md`                                                                                   | `scripts/ci/lanes/repo-policy-test-files.mjs`                                                                                                                                                                                          |
| `scripts/ci/product/prepare-next-standalone.mjs`                                                                                                                                                                                                                                                    | Repository policy | `web`, `repoPolicy`, `agentWorkflow`                     | 분류됨         | `docs/architecture/platform/monorepo-ci.md`                                                                                   | `scripts/ci/product/prepare-next-standalone.mjs`                                                                                                                                                                                       |
| `scripts/artifacts/**`(위 lane script 제외)                                                                                                                                                                                                                                                         | Repository policy | `infra`, `repoPolicy`, `agentWorkflow`                   | 분류됨         | `.artifacts/README.md`                                                                                                        | `scripts/artifacts/paths.test.mjs`                                                                                                                                                                                                     |
| `scripts/dependencies/**`, `scripts/security/**`                                                                                                                                                                                                                                                    | Repository policy | `repoPolicy`, `agentWorkflow`                            | 분류됨         | `docs/architecture/platform/dependency-automation.md`, `docs/development/github/dependency-updates.md`                        | `scripts/dependencies/dependency-health-contract.mjs`, `scripts/security/dependency-alert-inventory.mjs`                                                                                                                               |
| `scripts/README.md`                                                                                                                                                                                                                                                                                 | Repository policy | `repoPolicy`, `agentWorkflow`                            | 분류됨         | `scripts/README.md`                                                                                                           | `scripts/README.md`                                                                                                                                                                                                                    |
| `.prettierrc`, `.prettierignore`, `.editorconfig`                                                                                                                                                                                                                                                   | Repository policy | `repoPolicy`, `agentWorkflow`                            | 분류됨         | `docs/architecture/platform/monorepo-ci.md`                                                                                   | `.prettierrc`, `.prettierignore`, `.editorconfig`                                                                                                                                                                                      |
| `docs/**`(agent 문서 제외), `README.md`, `CONTRIBUTING.md`, `SERVICE.md`, `.gitignore`                                                                                                                                                                                                              | Repository policy | `repoPolicy`, `agentWorkflow`                            | 분류됨         | `docs/README.md`, `README.md`                                                                                                 | `docs/README.md`, `README.md`, `CONTRIBUTING.md`, `SERVICE.md`, `.gitignore`                                                                                                                                                           |
| `scripts/agents/**`, `AGENTS.md`, `CLAUDE.md`, agent 문서(`docs/development/agent-workflows/**`, `docs/development/agentic-*.md`, `docs/development/troubleshooting/tooling/`의 `agent-*`·`claude-*` 문서), agent test·fixture(`scripts/ci/agents/**`)                                              | Agent workflow    | `repoPolicy`, `agentWorkflow`                            | 분류됨         | `scripts/agents/README.md`, `AGENTS.md`, `docs/development/agent-workflows/README.md`                                         | `scripts/agents/README.md`, `AGENTS.md`, `CLAUDE.md`, `docs/development/agent-workflows/README.md`, `scripts/ci/agents/claude/claude-native-session.test.mjs`                                                                          |
| `.agents/**`, `.claude/**`, `.codex/**`, `.omc-workspace`, `.omx-config.json`                                                                                                                                                                                                                       | Agent workflow    | `repoPolicy`, `agentWorkflow`                            | 분류됨         | `docs/development/agent-workflows/adapters/claude-code.md`, `docs/development/agent-workflows/adapters/codex.md`, `AGENTS.md` | `.claude/agents/knu_explorer.md`, `.claude/agents/knu_executor_xhigh.md`, `.claude/skills/knu-review/SKILL.md`, `.claude/settings.json`, `.codex/config.toml`, `.codex/agents/knu_reviewer.toml`, `.omc-workspace`, `.omx-config.json` |
| `.plans`·`.artifacts`·`omx_wiki` 디렉터리의 tracked 파일                                                                                                                                                                                                                                            | Local record      | `repoPolicy`, `agentWorkflow`                            | 분류됨         | `docs/development/agent-workflows/session-continuity.md`, `.artifacts/README.md`, `AGENTS.md`                                 | `.artifacts/README.md`, `omx_wiki/.gitignore`                                                                                                                                                                                          |

Local record 행의 대표 경로에는 `.plans` 디렉터리 파일을 적지 않습니다. Tracked 문서는 ignored 계획 경로를 근거로
쓰지 않는다는 경계(`scripts/ci/agents/common/agent-guidance-boundary.test.mjs`)를 따르기 때문입니다. 이 디렉터리의 tracked 안내 파일도
같은 규칙으로 `repoPolicy`와 `agentWorkflow`만 켭니다.

Lane job이 실행하거나 import하는 저장소 script는 그 lane도 켭니다. 예를 들어 `scripts/ci/lanes/run-timed-command.mjs`는 Web·API·
Storybook workflow step의 wrapper이고, `scripts/observability/sentry/check-build.mjs`는 Web job이 `pnpm web:sentry:verify-build`로,
`scripts/infra/compose/profile.mjs`는 API job이 `pnpm infra:compose`로 실행합니다. `scripts/artifacts/**`와
`scripts/ci/lanes/repo-policy-test-files.mjs`는 `pnpm infra:check`가 import합니다. Lane package의 파일이 저장소 script를 import하거나
경로로 읽는 경우도 같습니다. API stress harness는 `scripts/artifacts/paths.mjs`를 import하고, API operations test는
`scripts/observability/rehearsal/web-bff.mjs`를 읽습니다.

`classify-changes.test.mjs`는 lane마다 다음을 진입점으로 삼아 이 규칙이 빠지지 않았는지 검사합니다.

- workflow의 `node`·`pnpm` step(pnpm script를 root와 `--dir` package까지 재귀로 펼침)
- lane package의 script와 Web image build
- lane package 파일의 상대 import와 `scripts/...` 경로 문자열

실행·import되는 script는 import closure까지 따라가고, 경로로 읽는 script는 그 파일만 봅니다. 다음은 이 검사 범위 밖입니다.

- Product package가 infra 검사의 입력인 경우(예: `pnpm infra:env:check`가 읽는 API env manifest)
- Lane package 파일이 읽는 저장소 script 밖의 파일(예: API operations test가 읽는 `infra/**`·`docs/**` 문서)
- 계산된 import 경로, `spawn` 인자 배열로 넘긴 경로, `pnpm --filter` 형식의 호출
- 상대 경로 문자열(`'../../scripts/...'`)로 읽는 script, `node ./scripts/...`·`node --옵션 scripts/...` 형식, interpreter 없는
  직접 실행, `.js`·`.sh` 실행
- JS·TS가 아닌 lane package 파일(예: `*.stories.mdx`)이 참조하는 script
- JS·TS인 Storybook 설정·story 파일이 참조하는 script(Storybook이 아니라 Web lane으로만 검사)

이 검사는 repo-policy lane에서 실행됩니다. 그래서 product package 파일만 바꾼 PR이 그 파일이 속한 package의 lane(예: Web)을
켜지 않는 script를 새로 참조하면, 그 PR에서는 검사가 돌지 않고 다음에 repo-policy lane이 실행될 때 실패합니다.

현재 tracked 경로 중 의도하지 않은 fail-open은 없습니다. `classify-changes.test.mjs`가 두 가지를 함께 검사합니다.

- tracked 경로 전체를 하나씩 분류해, 전체 lane을 켜는 경로가 의도한 fan-out 목록(`isIntendedFanOut`)에만 있는지 확인합니다.
- 분류기 규칙의 경로 literal마다 tracked 대상이 있는지 확인합니다. 아직 파일이 없는 경로의 규칙은 두지 않고, 그 경로의
  첫 파일을 추가하는 PR에서 규칙을 정합니다.

## Formatting 검사 범위

Repository policy gate의 formatting 검사(`scripts/ci/lanes/check-formatting.mjs`)는 분류기의 `formatting_scope` 출력을 따릅니다.
Lane 선택과는 별개입니다. 이 출력은 repoPolicy가 켜진 PR과 `main` push에서 검사할 파일만 정합니다.

- `full`: `prettier . -c`로 tree 전체를 검사합니다. 다음 경우입니다.
  - 아래 설정 파일 중 하나가 바뀐 경우
  - 어떤 lane 규칙에도 맞지 않는 경로(모르는 경로의 fail-open)가 있는 경우. 새 Prettier plugin처럼 아직 규칙이 없는
    formatting 입력일 수 있기 때문입니다
  - 변경 경로가 없거나 500개를 넘는 경우
  - 분류에 실패했거나, 비교 기준을 PR base·push 범위로 구하지 못해 직전 commit이나 빈 tree와 비교한 경우
  - 출력이 없거나 비었거나 형식이 맞지 않는 경우(검사 script가 판정)
- `changed`: 변경 경로 중 checkout에 있는 일반 파일만 `prettier -c --ignore-unknown`으로 검사합니다. Prettier가 parser를
  모르는 파일은 건너뛰고, ignore 파일 대상은 전체 검사와 같이 제외합니다. 디렉터리와 symlink는 넘기지 않으며, 남는 파일이
  없으면(삭제만 한 PR) 검사를 건너뜁니다.

설정 파일은 깊이와 관계없이 파일 이름으로 판정합니다. Prettier와 EditorConfig는 파일마다 상위 디렉터리로 올라가며 설정을
찾기 때문입니다.

| 설정 파일                                           | 전체 검사 이유                                                   |
| --------------------------------------------------- | ---------------------------------------------------------------- |
| `.prettierrc`, `.prettierrc.*`, `prettier.config.*` | Prettier 설정                                                    |
| `.prettierignore`, `.gitignore`                     | Prettier가 기본으로 읽는 ignore 파일(검사 대상을 정함)           |
| `.gitattributes`                                    | checkout된 파일의 줄끝을 바꿈                                    |
| `.editorconfig`                                     | Prettier가 읽으며, `.prettierrc`가 들여쓰기·줄끝을 고정하지 않음 |
| `package.json`, `package.yaml`                      | `prettier` key를 담을 수 있음                                    |
| `pnpm-lock.yaml`, `pnpm-workspace.yaml`             | Prettier version(lockfile과 workspace catalog)                   |

Formatting 결과는 파일 내용과 설정·version으로만 정해집니다. 그래서 설정이 그대로면 바뀌지 않은 파일의 결과도 그대로입니다.
이 판단은 비교 기준의 tree가 현재 설정으로 이미 formatting되어 있다는 전제에 기댑니다. `dev`는 strict up-to-date가 꺼져
있어, 설정 PR보다 먼저 CI를 통과한 다른 PR이 설정 PR 뒤에 merge되면 새 설정에 맞지 않는 파일이 남을 수 있습니다. 그 파일은
로컬 `pnpm check`에서 바로 실패하고, CI에서는 그 파일을 바꾸는 PR이나 설정 변경을 포함하는 `dev`→`main` release PR의
전체 검사에서 드러납니다.

삭제된 경로와 rename의 원래 경로는 checkout에 없으므로 검사하지 않고, rename의 새 경로는 검사합니다. 분류기는 rename을
삭제와 추가로 나눠(`git diff --no-renames`) 원래 경로와 새 경로가 모두 lane을 고르게 합니다. 로컬 `pnpm check`는 계속
`prettier . -c`로 전체를 검사합니다.

## 의도한 fan-out과 이유

- `packages/eslint-config/**`, `packages/tsconfig/**`: 모든 workspace의 lint·typecheck 설정을 바꿉니다.
- `.github/workflows/ci.yml`: 분류와 모든 lane의 실행 graph 자체를 바꿉니다.
- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.node-version`, `.lintstagedrc.mjs`: 모든 lane의 install과
  toolchain 입력을 바꿉니다.

## 모르는 경로의 fail-open

어떤 규칙에도 맞지 않는 경로와 비교 기준 계산 실패는 correctness를 우선해 전체 lane으로 fail-open합니다. 이 원칙은
[Monorepo CI architecture](../../architecture/platform/monorepo-ci.md)의 "Alternatives와 consequences"와 "Job graph"가
정합니다. Fail-open은 안전한 기본값이지만 비용이 큽니다. 그래서 tracked 경로는 표면별 규칙으로 분류하고, 모르는
경로의 fail-open은 아직 tracked가 아닌 경로와 분류 실패에만 남깁니다. 규칙을 정하기 전의 대조 결과와 비용은 evidence
문서에 있습니다.

## 새 경로를 추가할 때

새 경로 family를 추가하거나 기존 family의 lane을 바꾸는 PR은 다음 세 가지를 같은 PR에서 바꿉니다.

1. `scripts/ci/lanes/classify-changes.mjs`의 규칙
2. `scripts/ci/lanes/fixtures/change-impact-cases.json` 또는 `classify-changes.test.mjs`의 기대 결과
3. 이 문서의 경로 family 표 행(대표 경로 포함)

대표 경로는 tracked 파일이어야 합니다. 경로가 옮겨지거나 지워지면 test가 실패하므로 같은 PR에서 행을 고칩니다. 규칙
없이 새 tracked 경로 family를 추가하면 그 경로가 전체 lane을 켜므로 tracked 전체 대조 test가 실패합니다. 의도한 fan-out을
늘리는 변경은 `isIntendedFanOut` 목록과 위 "의도한 fan-out과 이유"를 함께 고칩니다.
