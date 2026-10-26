import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

import * as layoutCheck from './workspace-layout-check.mjs';

const { findWorkspaceLayoutIssues, listUntrackedEntries } = layoutCheck;
const repoRoot = resolve(import.meta.dirname, '../..');

function fixtureTree(files) {
  const root = mkdtempSync(resolve(tmpdir(), 'knu-layout-tree-'));
  for (const [path, content] of files) {
    mkdirSync(dirname(resolve(root, path)), { recursive: true });
    if (content !== null) writeFileSync(resolve(root, path), content);
  }
  return root;
}

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
    mkdirSync(resolve(root, 'worktrees/nested'), { recursive: true });
    git(resolve(root, 'worktrees/nested'), 'init', '-q');
    mkdirSync(resolve(root, 'worktrees/nested/.omc'));
    writeFileSync(resolve(root, 'worktrees/nested/.omc/state.json'), 'x\n');
    // A linked worktree has a .git file instead of a directory.
    git(
      root,
      '-c',
      'user.name=fixture',
      '-c',
      'user.email=fixture@example.com',
      'commit',
      '-qm',
      'init',
    );
    assert.equal(git(root, 'worktree', 'add', '-q', 'linked-worktree').status, 0);
    mkdirSync(resolve(root, 'linked-worktree/.omc'));
    writeFileSync(resolve(root, 'linked-worktree/.omc/state.json'), 'x\n');

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

test('top-level entries outside the manifest are reported; exclusions and tracked directories pass', () => {
  const trackedTopLevel = new Set([
    'apps',
    'docs',
    'scripts',
    '.claude',
    '.codex',
    '.omc-workspace',
  ]);
  const issues = findWorkspaceLayoutIssues(
    [
      'tmp-not-a-root/',
      'notes.txt',
      'build/',
      'node_modules/',
      '.DS_Store',
      'next-env.d.ts',
      '.env.local',
      'pnpm-debug.log.1',
      'x.tsbuildinfo',
      'apps/web/.next/',
      'apps/web/tmp/',
      'docs/scratch/',
      '.local-docs/',
      '.plans/root-plan.md',
      '.artifacts/tools/',
      'omx_wiki/log.md',
      '.omc/',
      '.omx/',
      '.claude/settings.local.json',
      '.codex/state/',
    ],
    { trackedTopLevel },
  );
  assert.deepEqual(
    issues.map((issue) => [issue.path, issue.kind]),
    [
      ['tmp-not-a-root/', 'outside-manifest-root'],
      ['notes.txt', 'outside-manifest-root'],
    ],
  );
});

test('.plans holds Markdown only and .artifacts children follow the manifest', () => {
  const root = fixtureTree([
    ['.plans/alpha-plan.md', '# Alpha\n\n- Plan ID: alpha-plan\n- Status: active\n\n## Work\n'],
    ['.plans/supporting/beta.md', '# Beta\n\n- Plan ID: beta-plan\n- Status: proposed\n'],
    ['.plans/run.sh', 'echo\n'],
    ['.plans/supporting/notes.log', 'x\n'],
    ['.plans/.DS_Store', 'x'],
    // Names on the top-level guard exclusion list are not exempt below a manifest root.
    ['.plans/build/run.sh', 'x\n'],
    ['.plans/.env', 'x\n'],
    ['.artifacts/README.md', 'x\n'],
    ['.artifacts/.gitignore', '*\n'],
    ['.artifacts/.DS_Store', 'x'],
    ['.artifacts/build/a.json', '{}\n'],
    ['.artifacts/plans/alpha-plan/beta-plan/p1/log.txt', 'x\n'],
    ['.artifacts/plans/beta-plan/beta-plan/x.json', '{}\n'],
    ['.artifacts/plans/not-a-plan-id/x/y.txt', 'x\n'],
    ['.artifacts/plans/dist/x.txt', 'x\n'],
    ['.artifacts/tools/infra/a.json', '{}\n'],
    ['.artifacts/scratch/a.txt', 'x\n'],
  ]);
  try {
    assert.deepEqual(
      layoutCheck
        .findWorkspaceStructureIssues(root)
        .map((issue) => [issue.path, issue.kind])
        .sort(),
      [
        ['.artifacts/.DS_Store', 'artifacts-unknown-child'],
        ['.artifacts/build', 'artifacts-unknown-child'],
        ['.artifacts/plans/dist', 'undeclared-plan-id'],
        ['.artifacts/plans/not-a-plan-id', 'undeclared-plan-id'],
        ['.artifacts/scratch', 'artifacts-unknown-child'],
        ['.plans/.DS_Store', 'plans-non-markdown'],
        ['.plans/.env', 'plans-non-markdown'],
        ['.plans/build/run.sh', 'plans-non-markdown'],
        ['.plans/run.sh', 'plans-non-markdown'],
        ['.plans/supporting/notes.log', 'plans-non-markdown'],
      ],
    );
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test('manifest roots and the tracked .gitignore files agree on what is ignored', () => {
  assert.deepEqual(layoutCheck.findGitignoreIssues(repoRoot), []);
  const { root } = fixtureRepository([]);
  try {
    for (const path of ['.artifacts/.gitignore', 'omx_wiki/.gitignore']) {
      mkdirSync(dirname(resolve(root, path)), { recursive: true });
      writeFileSync(resolve(root, path), readFileSync(resolve(repoRoot, path)));
    }
    assert.deepEqual(layoutCheck.findGitignoreIssues(root), []);
    const ignore = readFileSync(resolve(repoRoot, '.gitignore'), 'utf8');
    writeFileSync(resolve(root, '.gitignore'), ignore.replace(/^\.local-docs\/\n/mu, ''));
    assert.deepEqual(
      layoutCheck.findGitignoreIssues(root).map((issue) => [issue.path, issue.kind]),
      [['.local-docs', 'gitignore-mismatch']],
    );
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
