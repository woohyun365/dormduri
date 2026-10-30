import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const repoRoot = process.cwd();

function read(path) {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

test('pull request input asks for current risk and verification evidence', () => {
  const template = read('.github/PULL_REQUEST_TEMPLATE.md');

  for (const heading of [
    '## Summary',
    '## Related',
    '## Lifecycle',
    '## Changes',
    '## Risk / Migration / Operations',
    '## Verification',
    '## UI Evidence',
  ]) {
    assert.ok(template.includes(heading), `missing PR section: ${heading}`);
  }

  for (const staleInput of ['- [ ] FE+BE', '`pnpm test`', '`tsc --noEmit`']) {
    assert.ok(!template.includes(staleInput), `stale PR input: ${staleInput}`);
  }

  for (const currentInput of [
    '`pnpm test:repo-policy`',
    '`pnpm api:check`',
    '`pnpm web:check`',
    'Not tested',
  ]) {
    assert.ok(template.includes(currentInput), `missing current PR input: ${currentInput}`);
  }
});

test('the collaboration guide explains how the Lifecycle section is read', () => {
  const collaboration = read('docs/development/github/collaboration.md');
  const pullRequest = collaboration.slice(
    collaboration.indexOf('## Pull request'),
    collaboration.indexOf('\n## ', collaboration.indexOf('## Pull request') + 1),
  );

  assert.match(pullRequest, /`Lifecycle` 절/u);
  assert.match(pullRequest, /feature로 계산/u);
  assert.match(pullRequest, /Lifecycle gate/u);
  assert.match(pullRequest, /re-run/u);
  assert.match(pullRequest, /본문을 직접 넘겨/u);
});

test('developer documentation separates local feedback, CI, and remote settings', () => {
  const index = read('docs/development/github/README.md');
  const branchStrategy = read('docs/development/github/branch-and-pr-strategy.md');
  const collaboration = read('docs/development/github/collaboration.md');
  const remoteSettings = read('docs/development/github/remote-repository-settings.md');
  const developmentIndex = read('docs/development/README.md');

  assert.match(index, /\.\/collaboration\.md/u);
  assert.match(index, /\.\/branch-and-pr-strategy\.md/u);
  assert.match(index, /\.\/remote-repository-settings\.md/u);
  assert.match(developmentIndex, /\.\/github\/README\.md/u);
  assert.match(collaboration, /pre-commit.*pnpm check:fast/su);
  assert.match(collaboration, /merge correctness/u);
  assert.match(collaboration, /CI summary/u);
  assert.doesNotMatch(collaboration, /\.omx\/plans/u);
  assert.match(collaboration, /branch-and-pr-strategy\.md/u);
  for (const boundary of [
    'integration branch',
    'origin/dev',
    'fast-forward',
    'git switch -c',
    'bounded PR',
    'Dependent acceptance batching',
    '같은 acceptance 결과',
    'Feature branch push',
    '별도 Monorepo CI',
    'stacked PR',
    'DESIGN.md',
    'Remote push budget',
    'local-green',
    'corrective push',
    'active run',
    '[skip ci]',
    'failed job',
    'Pre-PR CI lane preflight',
    'classifyChanges',
    'git diff --name-only',
    'repoPolicy',
    'environment gap',
    'feature/fix/chore branch -> dev: squash merge',
    'dev -> main integration: merge commit',
    'dev-integration-gate',
    'main-release-gate',
  ]) {
    assert.match(branchStrategy, new RegExp(boundary, 'u'));
  }
  assert.match(branchStrategy, /`dev`와 `main`에 직접 commit·push하지 않/u);
  assert.doesNotMatch(branchStrategy, /\.omx\/plans/u);
  assert.match(remoteSettings, /PENDING_ACCOUNT_TIER/u);
  assert.match(remoteSettings, /GitHub Pro/u);
  assert.match(remoteSettings, /Require branches to be up to date/u);
  assert.match(remoteSettings, /CI summary.*GitHub Actions/su);
  assert.match(remoteSettings, /Actions cache policy/u);
  assert.match(remoteSettings, /2GB/u);
  assert.match(remoteSettings, /10GB/u);
  assert.match(remoteSettings, /checkedAt:/u);
  assert.match(remoteSettings, /gh api/u);
  assert.doesNotMatch(remoteSettings, /gh api .*--method (?:PATCH|PUT|POST|DELETE)/u);
});

test('remote-setting handoff exposes expected values, evidence states, and mutation boundaries', () => {
  const remoteSettings = read('docs/development/github/remote-repository-settings.md');

  for (const expectedSetting of [
    'sha_pinning_required',
    'allowed_actions',
    'delete_branch_on_merge',
    'default_workflow_permissions=read',
    'CI summary',
    'Vulnerability alerts',
    'Dependabot security updates',
    'enabled=false',
    'squash merge',
    'merge commit',
    'dev-integration-gate',
    'main-release-gate',
    'Force push',
    'Branch deletion',
  ]) {
    assert.ok(
      remoteSettings.includes(expectedSetting),
      `missing remote setting: ${expectedSetting}`,
    );
  }

  for (const evidenceState of [
    'VERIFIED_REMOTE',
    'VERIFIED_OWNER_UI',
    'PENDING_OWNER_ACTION',
    'PENDING_ACCOUNT_TIER',
    'PENDING_EVIDENCE',
  ]) {
    assert.ok(remoteSettings.includes(evidenceState), `missing evidence state: ${evidenceState}`);
  }

  for (const evidenceField of [
    'checkedAt:',
    'operator:',
    'actual:',
    'blocker:',
    'verification command:',
    'evidence link:',
  ]) {
    assert.ok(remoteSettings.includes(evidenceField), `missing evidence field: ${evidenceField}`);
  }

  assert.match(remoteSettings, /read-only/u);
  assert.match(remoteSettings, /owner 승인/u);
  assert.match(remoteSettings, /selected; GitHub-owned/u);
  assert.match(remoteSettings, /sha_pinning_required=true/u);
  assert.match(remoteSettings, /dev-integration-gate/u);
  assert.match(remoteSettings, /main-release-gate/u);
  assert.match(remoteSettings, /delete_branch_on_merge=true/u);
  assert.match(remoteSettings, /Rulesets.*classic Branches/su);
  assert.match(remoteSettings, /Remote branch inventory.*`main`, `dev`/su);
  assert.match(remoteSettings, /Environments.*0/su);
  assert.match(remoteSettings, /CI summary.*GitHub Actions/su);
  assert.match(remoteSettings, /enabled=false.*paused=false/su);
  assert.match(remoteSettings, /\| Dependabot security updates\s+\| disabled/u);
  assert.match(remoteSettings, /\| Allow auto-merge\s+\| disabled/u);
  assert.doesNotMatch(remoteSettings, /gh api[^\n]*--method\s+(?:PATCH|PUT|POST|DELETE)/u);
});

test('GitHub operator authentication stays layered, least-privilege, and secret-free', () => {
  const agents = read('AGENTS.md');
  const index = read('docs/development/github/README.md');
  const authentication = read('docs/development/github/authentication-and-operator-access.md');
  const execution = read('docs/development/agent-workflows/agent-execution-contract.md');

  assert.match(index, /\.\/authentication-and-operator-access\.md/u);
  for (const boundary of [
    'Git credential',
    'gh browser OAuth',
    'GitHub connector',
    'GitHub Actions `GITHUB_TOKEN`',
    'gh auth setup-git',
    '`repo`',
    '`read:org`',
    '`gist`',
    '`workflow`',
    'Plan: Read',
    'Only select repositories',
    'Always ask',
    'Allow read actions',
    'Allow low-risk actions',
    'Allow all actions',
    'Permissions',
    'Skills',
    'Read actions',
    'Information',
    'read-only',
    'multiple account',
    'gh-fix-ci',
    'gh-address-comments',
    'Recovery matrix',
    'CLI-first',
    'Connector-first',
    'same-surface',
    'Silent',
  ]) {
    assert.match(authentication, new RegExp(boundary, 'u'));
  }

  assert.match(authentication, /Billing.*Plan: Read.*repository access 없음/su);
  assert.match(authentication, /2026-09-25 만료/u);
  assert.match(authentication, /checkedAt: 2026-08-27/u);
  assert.match(authentication, /ghs_APPID_JWT/u);
  assert.match(authentication, /opaque credential/u);
  assert.match(authentication, /최소 520자/u);
  assert.match(authentication, /ghs_\[A-Za-z0-9\.\\-_\]\{36,\}/u);
  assert.match(authentication, /Connector permission: `Allow read actions`/u);
  assert.match(authentication, /gh auth status --show-token.*금지/su);
  assert.match(authentication, /Shell-capable local Codex\/Claude.*`gh` CLI-first/su);
  assert.match(authentication, /ChatGPT Web \(지원된 Connector\).*GitHub Connector-first/su);
  assert.match(authentication, /다른 no-shell host는 실제 지원·승인된 Connector/u);
  assert.match(authentication, /Mutation 전에.*duplicate.*Mutation 뒤에는 같은 surface/su);
  assert.match(authentication, /Silent\s+fallback.*tool switching/su);
  assert.match(authentication, /Connector 기반 skill\/workflow.*intentional\s+override/su);
  assert.match(
    authentication,
    /Local token을 Connector에 전달하거나 Connector credential을 shell로 추출하지 않습니다/u,
  );
  assert.match(
    agents,
    /local coding session.*`gh` CLI-first.*shell이 없는 session.*GitHub Connector-first/su,
  );
  assert.match(
    execution,
    /shell-capable local session.*`gh` CLI-first.*No-shell host는 실제 지원·승인된.*Connector.*ChatGPT Web의 GitHub Connector-first/su,
  );
  assert.match(execution, /같은 대상이 이미 존재.*같은 surface로 결과를 read back/su);
  assert.doesNotMatch(authentication, /\.omx\/plans/u);
  assert.doesNotMatch(authentication, /\b(?:ghp|github_pat)_[A-Za-z0-9_]{12,}\b/u);
  assert.doesNotMatch(authentication, /Authorization:\s*Bearer\s+\S+/iu);
});

test('Renovate owns every version update while Dependabot keeps alerts only', () => {
  const renovate = JSON.parse(read('renovate.json'));
  const collaboration = read('docs/development/github/collaboration.md');
  const workspace = read('pnpm-workspace.yaml');
  const lockfile = read('pnpm-lock.yaml');
  const actionsGroup = renovate.packageRules.find(
    ({ groupName }) => groupName === 'actions-minor-patch',
  );

  assert.equal(existsSync(resolve(repoRoot, '.github/dependabot.yml')), false);
  assert.equal(existsSync(resolve(repoRoot, '.github/dependabot.yaml')), false);
  assert.equal(renovate.enabled, true);
  assert.deepEqual(renovate.enabledManagers, [
    'npm',
    'github-actions',
    'dockerfile',
    'docker-compose',
  ]);
  assert.deepEqual(renovate.baseBranchPatterns, ['dev']);
  assert.equal(renovate.automerge, false);
  assert.equal(renovate.platformAutomerge, false);
  assert.match(workspace, /^\s{2}typescript: 6\./mu);
  assert.doesNotMatch(workspace, /^\s{2}typescript: 7\./mu);
  assert.doesNotMatch(lockfile, /typescript@7(?:\.|:)/u);
  assert.match(renovate.commitMessagePrefix, /^chore\(deps\): /u);
  assert.match(actionsGroup.commitMessagePrefix, /^ci\(deps\): /u);
  assert.equal(renovate.labels, undefined);
  assert.match(
    collaboration,
    /모든 version update와 보안 update PR은 Renovate가 `dev`를 대상으로/u,
  );
  assert.match(collaboration, /Dependabot은 alert만 맡습니다/u);
});

test('bounded change guidance classifies scope drift before mutation', () => {
  const branchStrategy = read('docs/development/github/branch-and-pr-strategy.md');
  const collaboration = read('docs/development/github/collaboration.md');

  for (const disposition of [
    'required-current',
    'prerequisite-predecessor',
    'independent-follow-up',
    'unrelated-or-speculative',
  ]) {
    assert.match(branchStrategy, new RegExp(disposition, 'u'));
  }

  for (const requiredInput of ['prospective outcome', 'acceptance', 'non-scope']) {
    assert.match(branchStrategy, new RegExp(requiredInput, 'iu'));
  }

  assert.match(branchStrategy, /Storybook.*새로운 design direction.*follow-up/su);
  assert.match(branchStrategy, /backend.*prerequisite-predecessor.*unrelated cleanup/isu);
  assert.match(collaboration, /scope drift.*네 가지 disposition/isu);
  assert.match(collaboration, /현재 acceptance가 바뀌기 전에/u);
});

test('Issues own durable outcomes, blockers, dependencies, and trigger-gated scheduling', () => {
  const index = read('docs/development/github/README.md');
  const collaboration = read('docs/development/github/collaboration.md');
  const issueGuide = read('docs/development/github/issues-and-work-tracking.md');
  const workItem = read('.github/ISSUE_TEMPLATE/work-item.yml');
  const blocker = read('.github/ISSUE_TEMPLATE/blocker.yml');
  const config = read('.github/ISSUE_TEMPLATE/config.yml');

  assert.match(index, /issues-and-work-tracking\.md/u);
  assert.match(collaboration, /Issues and work tracking/u);
  for (const boundary of [
    'durable work item',
    'transient local diagnostic',
    'blocked work',
    'unblock evidence',
    'revisit trigger',
    'sub-issue',
    'Milestone',
    'GitHub Projects',
    'status:blocked',
  ]) {
    assert.match(issueGuide, new RegExp(boundary, 'iu'));
  }
  assert.match(issueGuide, /세 개 이상의 Issue.*dated release/isu);
  assert.match(issueGuide, /다섯 개보다 많은.*independently scheduled/isu);

  for (const field of ['Outcome', 'Acceptance', 'Non-scope', 'Evidence']) {
    assert.match(workItem, new RegExp(field, 'u'));
  }
  for (const field of ['Blocked work', 'Cause', 'Owner', 'Unblock evidence', 'Revisit trigger']) {
    assert.match(blocker, new RegExp(field, 'u'));
  }
  assert.match(blocker, /status:blocked/u);
  assert.match(config, /blank_issues_enabled:\s*false/u);
});

test('pull request template keeps dev references separate from main closing semantics', () => {
  const template = read('.github/PULL_REQUEST_TEMPLATE.md');

  assert.match(template, /Refs #번호/u);
  assert.match(template, /Development sidebar/u);
  assert.match(template, /`main`.*Closes #번호/su);
  assert.match(template, /Outcome/u);
  assert.match(template, /Non-scope/u);
  assert.match(template, /Follow-up disposition/u);
  assert.doesNotMatch(template, /Issue:\s*<!--\s*Closes #번호 또는 해당 없음/u);
});

test('asynchronous agent writes use distinct Git ownership while the leader integrates', () => {
  const branchStrategy = read('docs/development/github/branch-and-pr-strategy.md');
  const orchestration = read('docs/development/agent-workflows/orchestration.md');

  assert.match(orchestration, /\.\.\/github\/branch-and-pr-strategy\.md/u);
  assert.match(orchestration, /Git branch\/worktree isolation/u);
  assert.match(orchestration, /agent review.*human approval.*대체하지/iu);

  for (const boundary of [
    'read-only.*share.*checkout',
    'one write-capable.*current checkout',
    'distinct fresh branch',
    'separate worktree',
    'sibling.*same branch',
    'leader.*fan-in',
  ]) {
    assert.match(branchStrategy, new RegExp(boundary, 'isu'));
  }
});

test('branch readiness stays advisory, semantic, and discoverable before pre-PR CI', () => {
  const packageJson = JSON.parse(read('package.json'));
  const index = read('docs/development/github/README.md');
  const branchStrategy = read('docs/development/github/branch-and-pr-strategy.md');
  const readiness = read('docs/development/github/branch-readiness.md');
  const template = read('.github/PULL_REQUEST_TEMPLATE.md');

  assert.equal(
    packageJson.scripts['git:branch-readiness'],
    'node scripts/git/branch-readiness.mjs',
  );
  assert.match(index, /\.\/branch-readiness\.md/u);
  assert.match(branchStrategy, /Pre-PR CI lane preflight/u);
  assert.match(branchStrategy, /pnpm git:branch-readiness/u);
  assert.match(template, /Scope audit/u);

  for (const contract of [
    'Deterministic evidence',
    'Declared semantic disposition',
    'cohesive',
    'scope-audit-required',
    'stop-and-split',
    'decisionSource=model-mediated',
    'lockfile',
    'codemod',
    'commit count',
    'single-writer boundary',
  ]) {
    assert.match(readiness, new RegExp(contract, 'iu'));
  }

  assert.match(readiness, /classifyChanges\(\)/u);
  assert.match(readiness, /advisory/u);
  assert.doesNotMatch(readiness, /\.omx\/plans|Phase\s+\d/iu);
});

function localBranchCleanupSection() {
  const guide = read('docs/development/github/branch-and-pr-strategy.md');
  const heading = '## Local branch cleanup\n';
  assert.ok(guide.includes(heading), 'missing canonical local branch cleanup procedure');
  return guide.split(heading)[1].split('\n## ')[0];
}

function assertCleanupSafetyContract(section) {
  // Bounded document assertions, not an executable Git deletion gate.
  for (const contract of [
    /업무 권한.*MERGED.*CI.*대신하지/su,
    /같은 repository.*PR.*head OID.*local tip.*expected base/su,
    /merge OID.*fresh target.*ancestor/su,
    /squash.*원본 commit ancestry.*필수 조건이 아니/su,
    /현재 dev 전체 tree.*비교하지 않/u,
    /`git branch --merged`.*증거.*대신하지 않/u,
    /\| 추가 commit·branch 이름 재사용[ \t]*\|[^\n]*retained-with-reason/u,
    /\| OPEN·CLOSED-unmerged·unpublished[ \t]*\|[^\n]*retained-with-reason/u,
    /\| `\[gone\]`·CI green만 확인[ \t]*\|[^\n]*retained-with-reason/u,
    /\| feature upstream에만 포함[ \t]*\|[^\n]*`-d`[^\n]*retained-with-reason/u,
    /\| current·`main`·`dev`·보호 ref[ \t]*\|[^\n]*보존/u,
    /\| 모든 registered worktree[ \t]*\|[^\n]*locked[^\n]*보존/u,
    /\| 소유권·provider 증거 불명[ \t]*\|[^\n]*retained-with-reason/u,
    /SHA.*reflog만.*복구.*보장하지 않/su,
    /bundle.*verify.*list-heads/su,
    /self-contained bundle.*제외된 prerequisite.*독립적으로 보존/su,
    /삭제 직전.*ref\/OID.*worktree.*재확인/su,
    /원자적 lock.*아니/su,
    /`-D`.*별도.*강제 삭제.*권한.*복구/su,
    /실패를 자동.*강제 삭제.*전환하지 않/u,
    /동일 이름.*새 ref.*덮어쓰지 않/u,
  ]) {
    assert.match(section, contract);
  }
  assert.doesNotMatch(section, /git branch -d[^\n]*\|\|[^\n]*git branch -D/u);
  assert.doesNotMatch(section, /git branch[^\n]*\|[^\n]*xargs[^\n]*git branch -D/u);
}

test('local cleanup separates ref surfaces, task scope, and execution authority', () => {
  const section = localBranchCleanupSection();
  assert.match(section, /local branch.*refs\/heads/su);
  assert.match(section, /remote branch.*서버/su);
  assert.match(section, /remote-tracking.*refs\/remotes/su);
  assert.match(section, /task-local.*전체.*audit.*별도/su);
  assert.match(section, /remote 삭제.*worktree 제거.*GC.*별도/su);
  assert.match(section, /advisory-policy.*deterministic-static.*강제하지 않/su);
  assert.doesNotMatch(
    section,
    /\.omx\/plans|\.?artifacts\/(?:local|plans|tools)\/\S*\d{4}-\d{2}-\d{2}/u,
  );
});

test('post-merge cleanup requires integration, protection, recovery, and revalidation', () => {
  assertCleanupSafetyContract(localBranchCleanupSection());
});

test('cleanup contract assertions reject bounded unsafe guidance mutations', () => {
  const section = localBranchCleanupSection();
  assertCleanupSafetyContract(section);
  for (const removedClause of [
    /업무 권한[^\n]*/u,
    /\| feature upstream에만 포함[ \t]*\|[^\n]*/u,
    /\| 모든 registered worktree[ \t]*\|[^\n]*/u,
    /SHA[^\n]*reflog만[^\n]*/u,
    /self-contained bundle[^\n]*/u,
    /삭제 직전[^\n]*/u,
    /실패를 자동[^\n]*/u,
  ]) {
    assert.match(section, removedClause);
    assert.throws(() => assertCleanupSafetyContract(section.replace(removedClause, '')), {
      name: 'AssertionError',
    });
  }
  for (const unsafeCommand of [
    'git branch -d branch || git branch -D branch',
    'git branch --merged | xargs git branch -D',
  ]) {
    assert.throws(() => assertCleanupSafetyContract(`${section}\n${unsafeCommand}`), {
      name: 'AssertionError',
    });
  }
});

test('integration handoff records deleted or retained local branches through the canonical owner', () => {
  const lifecycle = read('docs/development/agent-workflows/development-lifecycle.md');
  assert.match(lifecycle, /branch-and-pr-strategy\.md#local-branch-cleanup/u);
  assert.match(lifecycle, /deleted.*retained-with-reason/su);
  assert.match(lifecycle, /보존 이유.*다음.*조건/su);
  const section = localBranchCleanupSection();
  assert.match(section, /삭제 후.*ref.*없.*확인/su);
  assert.match(section, /retained-with-reason.*완료.*실패.*아닙/su);
});
