import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '../..');
const scriptPath = resolve(repoRoot, 'scripts/agents/session-preflight.mjs');

function run(args) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

test('fresh preflight reports repository evidence without loading local resume state', () => {
  const result = run(['--fresh', '--json']);

  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.readOnly, true);
  assert.equal(summary.mode, 'fresh');
  assert.equal(summary.resume, null);
  assert.ok(summary.repository.branch);
  assert.equal(summary.repository.root, repoRoot);
  assert.match(summary.repository.head, /^[0-9a-f]{40}$/u);
  assert.ok(Array.isArray(summary.repository.stagedPaths));
  assert.ok(Array.isArray(summary.repository.unstagedPaths));
  assert.ok(Array.isArray(summary.repository.untrackedPaths));
  assert.ok(Array.isArray(summary.activePlans));
  assert.ok(Array.isArray(summary.omx.activeModes));
  assert.ok(summary.canonicalVerification.includes('pnpm test:repo-policy'));
});

test('resume preflight exposes only bounded optional pointers and validates the plan path', () => {
  const result = run(['--resume', '--plan', '.omx/plans/clean-clone-resume-plan.md', '--json']);

  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.mode, 'resume');
  assert.equal(summary.resume.plan.path, '.omx/plans/clean-clone-resume-plan.md');
  assert.equal(typeof summary.resume.plan.exists, 'boolean');
  assert.ok(summary.resume.contextSnapshots.length <= 5);
  assert.equal(typeof summary.resume.notepadPriority.available, 'boolean');
  assert.equal(typeof summary.resume.notepadPriority.valid, 'boolean');
  if (summary.resume.notepadPriority.available && summary.resume.notepadPriority.exists) {
    assert.match(summary.resume.notepadPriority.contextPath, /^\.omx\/context\//u);
  } else {
    assert.equal(summary.resume.notepadPriority.contextPath, null);
  }
  assert.equal('notepadContent' in summary.resume, false);
});

test('preflight rejects ambiguous mode and paths outside the local plan owner', () => {
  assert.notEqual(run(['--fresh', '--resume']).status, 0);
  assert.notEqual(run(['--resume', '--plan', '../outside.md']).status, 0);
  assert.notEqual(run(['--resume', '--plan', 'README.md']).status, 0);
});

test('preflight implementation remains read-only', () => {
  const source = readFileSync(scriptPath, 'utf8');
  for (const mutation of [
    'writeFile',
    'appendFile',
    'mkdir',
    'rmSync',
    'unlink',
    'rename',
    'copyFile',
  ]) {
    assert.equal(source.includes(mutation), false, `${mutation} must not be used by preflight`);
  }
});
