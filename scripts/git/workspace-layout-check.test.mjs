import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

import { findWorkspaceLayoutIssues, listUntrackedEntries } from './workspace-layout-check.mjs';

const repoRoot = resolve(import.meta.dirname, '../..');

function fixtureRepository(files) {
  const root = mkdtempSync(resolve(tmpdir(), 'knu-layout-'));
  const git = (cwd, ...args) => spawnSync('git', args, { cwd, encoding: 'utf8' });
  git(root, 'init', '-q');
  writeFileSync(resolve(root, '.gitignore'), readFileSync(resolve(repoRoot, '.gitignore')));
  git(root, 'add', '.gitignore');
  for (const [path, tracked] of files) {
    mkdirSync(dirname(resolve(root, path)), { recursive: true });
    writeFileSync(resolve(root, path), 'x\n');
    if (tracked) git(root, 'add', path);
  }
  return { root, git };
}

test('host runtime state below the root and retired root names are reported', () => {
  const issues = findWorkspaceLayoutIssues([
    'apps/web/.omx/',
    'docs/development/troubleshooting/.omc/',
    'artifacts/',
    'local-docs/',
    'references/',
  ]);

  assert.deepEqual(
    issues.map((issue) => [issue.path, issue.kind]),
    [
      ['apps/web/.omx/', 'nested-runtime-state'],
      ['docs/development/troubleshooting/.omc/', 'nested-runtime-state'],
      ['artifacts/', 'retired-root'],
      ['local-docs/', 'retired-root'],
      ['references/', 'retired-root'],
    ],
  );
});

test('root runtime state, tracked host configuration and local workspace roots are accepted', () => {
  assert.deepEqual(
    findWorkspaceLayoutIssues([
      '.omc/',
      '.omx/',
      'omx_wiki/session-log-2099-01-01.md',
      '.omx-config.json',
      '.artifacts/tools/',
      '.local-docs/',
      '.plans/root-plan.md',
      'node_modules/',
      'docs/references/',
      'apps/web/artifacts/',
    ]),
    [],
  );
});

test('untracked listing collapses ignored trees and nested repositories', () => {
  const { root, git } = fixtureRepository([
    ['apps/web/package.json', true],
    ['apps/web/.omx/logs/next-dev.log', false],
    ['docs/guide.md', true],
    ['docs/x/.omc/state.json', false],
    ['.artifacts/README.md', true],
    ['.artifacts/tools/claude-native/.omx/state.json', false],
    ['node_modules/pkg/.omc/state.json', false],
    ['artifacts/local/result.json', false],
    ['.omc/state.json', false],
    ['.omx/state.json', false],
  ]);
  try {
    mkdirSync(resolve(root, 'worktrees/linked'), { recursive: true });
    git(resolve(root, 'worktrees/linked'), 'init', '-q');
    mkdirSync(resolve(root, 'worktrees/linked/.omc'));
    writeFileSync(resolve(root, 'worktrees/linked/.omc/state.json'), 'x\n');

    const issues = findWorkspaceLayoutIssues(listUntrackedEntries(root));
    assert.deepEqual(issues.map((issue) => issue.path).sort(), [
      'apps/web/.omx/',
      'artifacts/',
      'docs/x/.omc/',
    ]);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test('the pre-commit fast check runs the layout detector after lint-staged', () => {
  const manifest = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8'));
  assert.equal(
    manifest.scripts['check:fast'],
    'pnpm lint-staged && node scripts/git/workspace-layout-check.mjs',
  );
});

test('host adapters anchor runtime state at the repository root', () => {
  const tracked = spawnSync('git', ['ls-files', '--error-unmatch', '.omc-workspace'], {
    cwd: repoRoot,
  });
  assert.equal(tracked.status, 0, '.omc-workspace is tracked');

  const claude = readFileSync(
    resolve(repoRoot, 'docs/development/agent-workflows/adapters/claude-code.md'),
    'utf8',
  );
  const codex = readFileSync(
    resolve(repoRoot, 'docs/development/agent-workflows/adapters/codex.md'),
    'utf8',
  );
  for (const guide of [claude, codex]) {
    assert.match(guide, /### 저장소 root와 runtime state 위치/u);
    assert.match(guide, /workspace-layout-check\.mjs/u);
    assert.match(guide, /\.artifacts\//u);
  }
  assert.match(claude, /`\.omc-workspace`/u);
  assert.match(codex, /OMX_ROOT/u);
});
