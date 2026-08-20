import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  ]) {
    assert.match(branchStrategy, new RegExp(boundary, 'u'));
  }
  assert.match(branchStrategy, /`dev`와 `main`에 직접 commit·push하지 않/u);
  assert.doesNotMatch(branchStrategy, /\.omx\/plans/u);
  assert.match(remoteSettings, /PENDING_ACCOUNT_TIER/u);
  assert.match(remoteSettings, /GitHub Pro/u);
  assert.match(remoteSettings, /Require branches to be up to date/u);
  assert.match(remoteSettings, /CI summary.*GitHub Actions/su);
  assert.match(remoteSettings, /active_caches_size_in_bytes/u);
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
  assert.doesNotMatch(remoteSettings, /gh api[^\n]*--method\s+(?:PATCH|PUT|POST|DELETE)/u);
});

test('Copilot uses a bounded adapter instead of duplicating the orchestration contract', () => {
  const instructions = read('.github/copilot-instructions.md');

  for (const currentBoundary of [
    'AGENTS.md',
    '현재 사용자 요청',
    'current working tree',
    '요청 범위 밖 파일',
    'targeted test',
  ]) {
    assert.ok(
      instructions.includes(currentBoundary),
      `missing Copilot boundary: ${currentBoundary}`,
    );
  }

  for (const duplicatedWorkflow of ['.omx/plans', '$team', '$ralph', '<agent_catalog>']) {
    assert.ok(
      !instructions.includes(duplicatedWorkflow),
      `Copilot adapter duplicates workflow guidance: ${duplicatedWorkflow}`,
    );
  }

  assert.ok(instructions.split('\n').length <= 12, 'Copilot adapter must stay concise');
});

test('Renovate owns npm updates while Dependabot retains non-npm ecosystems', () => {
  const dependabot = read('.github/dependabot.yml');
  const renovate = JSON.parse(read('renovate.json'));
  const collaboration = read('docs/development/github/collaboration.md');
  const workspace = read('pnpm-workspace.yaml');
  const lockfile = read('pnpm-lock.yaml');
  const targetBranches = dependabot.match(/target-branch: 'dev'/gu) ?? [];

  assert.doesNotMatch(dependabot, /package-ecosystem: 'npm'/u);
  assert.equal(targetBranches.length, 7);
  assert.equal(renovate.enabled, true);
  assert.deepEqual(renovate.enabledManagers, ['npm']);
  assert.deepEqual(renovate.baseBranchPatterns, ['dev']);
  assert.equal(renovate.automerge, false);
  assert.match(workspace, /^\s{2}typescript: 6\./mu);
  assert.doesNotMatch(workspace, /^\s{2}typescript: 7\./mu);
  assert.doesNotMatch(lockfile, /typescript@7(?:\.|:)/u);
  assert.match(dependabot, /actions-minor-patch:/u);
  assert.match(dependabot, /observability-minor-patch:/u);
  assert.match(dependabot, /update-types:\n\s+- 'minor'\n\s+- 'patch'/u);
  assert.match(dependabot, /package-ecosystem: 'github-actions'/u);
  assert.match(dependabot, /package-ecosystem: 'docker'/u);
  assert.match(dependabot, /package-ecosystem: 'docker-compose'/u);
  assert.match(dependabot, /prefix: 'ci\(deps\): 자동 업데이트'/u);
  assert.doesNotMatch(dependabot, /^\s+labels:/mu);
  assert.doesNotMatch(dependabot, /multi-ecosystem-groups:/u);
  assert.match(collaboration, /npm\/pnpm version update PR은 Renovate가 `dev`를 대상으로/u);
  assert.match(collaboration, /security update는 GitHub의 default branch/u);
});
