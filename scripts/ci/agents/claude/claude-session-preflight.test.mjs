import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  readFileSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { runClaudePreflight } from '../../../agents/claude/session-preflight.mjs';

const cli = new URL('../../../agents/claude/session-preflight.mjs', import.meta.url).pathname;
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'claude-preflight-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  git('init', '-q', '-b', 'fixture');
  writeFileSync(join(root, '.gitignore'), '.plans/\n');
  writeFileSync(join(root, 'source.txt'), 'baseline\n');
  git('add', '.');
  git(
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@example.invalid',
    'commit',
    '-qm',
    'fixture',
  );
  return { root, git };
}
// The worktree status against HEAD whatever the user staged: Git status over a fresh index read
// from the HEAD tree, the view the snapshot digest takes.
function headIndexStatus(root, encoding = 'utf8') {
  const dir = mkdtempSync(join(tmpdir(), 'head-index-'));
  try {
    const env = { ...process.env, GIT_INDEX_FILE: join(dir, 'index') };
    execFileSync('git', ['read-tree', 'HEAD'], { cwd: root, env });
    return execFileSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], {
      cwd: root,
      env,
      encoding,
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const indexDigest = (root) =>
  createHash('sha256')
    .update(readFileSync(join(root, '.git/index')))
    .digest('hex');
test('preflight reads actual raw Git baseline, never model/runtime evidence', (t) => {
  const { root, git } = fixture(t);
  const output = runClaudePreflight({ root, mode: 'fresh' });
  assert.equal(output.host, 'claude-code');
  assert.equal(output.baseline.head, git('rev-parse', 'HEAD').trim());
  assert.equal(output.baseline.branch, 'fixture');
  assert.equal(output.baseline.rawStatus, '');
  assert.equal(output.baseline.clean, true);
  assert.match(output.baseline.diffHash, /^[a-f0-9]{64}$/);
  assert.equal(output.plan, null);
  assert.equal(output.dispatchAuthorized, false);
  assert.equal(output.runtimeQualified, false);
  assert.equal(output.native.status, 'not-ready');
  assert.equal(output.identityEvidence, 'local-git-diagnostic-only');
});
test('raw porcelain preserves spaces, newlines and quotes and reads the worktree against HEAD', (t) => {
  const { root, git } = fixture(t);
  const original = runClaudePreflight({ root }).baseline.diffHash;
  git('mv', 'source.txt', 'new "name\nfile.txt');
  writeFileSync(join(root, 'new "name\nfile.txt'), 'changed\n');
  const output = runClaudePreflight({ root });
  // The staged rename is not part of the view: the status is the one over the HEAD tree.
  assert.equal(output.baseline.rawStatus, headIndexStatus(root));
  assert.notEqual(
    output.baseline.rawStatus,
    git('status', '--porcelain=v1', '-z', '--untracked-files=all'),
  );
  assert.equal(output.baseline.clean, false);
  assert.notEqual(output.baseline.diffHash, original);
  writeFileSync(join(root, 'untracked\n file.txt'), 'untracked content');
  const untracked = runClaudePreflight({ root });
  assert.equal(untracked.baseline.clean, false);
  assert.match(untracked.baseline.diffHash, /^[a-f0-9]{64}$/);
  assert.ok(untracked.snapshot);
  assert.deepEqual(untracked.diagnostics, []);
  // Against HEAD the renamed file is new as well, so both new names carry a content digest.
  assert.equal(untracked.baseline.untrackedInputDigests.length, 2);
  writeFileSync(join(root, 'untracked\n file.txt'), 'different content');
  const changed = runClaudePreflight({ root });
  assert.notEqual(changed.baseline.diffHash, untracked.baseline.diffHash);
  assert.notDeepEqual(
    changed.baseline.untrackedInputDigests,
    untracked.baseline.untrackedInputDigests,
  );
});
test('fresh never scans plans; resume consumes explicit common plan reader and actual snapshot', (t) => {
  const { root } = fixture(t);
  mkdirSync(join(root, '.plans'));
  writeFileSync(join(root, '.plans/broken.md'), '- Plan ID: invalid ID\n');
  assert.deepEqual(runClaudePreflight({ root }).diagnostics, []);
  rmSync(join(root, '.plans/broken.md'));
  writeFileSync(join(root, '.plans/selected.md'), '- Plan ID: selected\n- Status: active\n');
  const checkpointSnapshot = runClaudePreflight({ root }).snapshot;
  const input = {
    root,
    mode: 'resume',
    planPath: '.plans/selected.md',
    continuation: { expectedPlanId: 'selected', checkpointSnapshot },
  };
  assert.equal(runClaudePreflight(input).continuation.decision, 'candidate');
  writeFileSync(join(root, 'source.txt'), 'new source\n');
  assert.ok(runClaudePreflight(input).continuation.reasons.includes('source-changed'));
  writeFileSync(join(root, '.plans/selected.md'), '- Plan ID: selected\n- Status: cancelled\n');
  assert.ok(runClaudePreflight(input).continuation.reasons.includes('active-plan-required'));
  assert.throws(() => runClaudePreflight({ ...input, mode: 'fresh' }), /resume/);
  assert.throws(
    () =>
      runClaudePreflight({
        ...input,
        continuation: { ...input.continuation, currentSnapshot: checkpointSnapshot },
      }),
    /continuation/,
  );
});
test('missing, malformed, duplicate and unsafe selected plans cannot continue', (t) => {
  const { root } = fixture(t);
  mkdirSync(join(root, '.plans'));
  const checkpointSnapshot = runClaudePreflight({ root }).snapshot;
  const input = {
    root,
    mode: 'resume',
    planPath: '.plans/selected.md',
    continuation: { expectedPlanId: 'selected', checkpointSnapshot },
  };
  assert.equal(runClaudePreflight(input).continuation.decision, 'needs-review');
  writeFileSync(join(root, input.planPath), '- Plan ID: selected\n- Status: nonsense\n');
  assert.equal(runClaudePreflight(input).continuation.decision, 'needs-review');
  writeFileSync(join(root, input.planPath), '- Plan ID: selected\n- Status: active\n');
  writeFileSync(join(root, '.plans/duplicate.md'), '- Plan ID: selected\n- Status: active\n');
  assert.equal(runClaudePreflight(input).plan.state, 'ambiguous');
  rmSync(join(root, '.plans/duplicate.md'));
  rmSync(join(root, input.planPath));
  symlinkSync(join(root, 'source.txt'), join(root, input.planPath));
  assert.equal(runClaudePreflight(input).plan.state, 'unsafe');
  assert.equal(runClaudePreflight(input).continuation.decision, 'needs-review');
});
test('failed and bounded Git diagnostics are never represented as a clean checkout', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'claude-no-git-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const missing = runClaudePreflight({ root });
  assert.equal(missing.baseline.clean, null);
  assert.equal(missing.snapshot, null);
  assert.ok(missing.diagnostics.length > 0);
  const repo = fixture(t);
  writeFileSync(join(repo.root, 'source.txt'), 'x'.repeat(2 * 1024 * 1024));
  const large = runClaudePreflight({ root: repo.root });
  assert.equal(large.baseline.clean, null);
  assert.equal(large.snapshot, null);
  assert.ok(large.diagnostics.includes('git-diff-unavailable'));
});
test('actual CLI supports fresh/resume, rejects ambiguity and reports diagnostics nonzero', (t) => {
  const { root } = fixture(t);
  for (const mode of ['fresh', 'resume']) {
    const result = spawnSync(process.execPath, [cli, '--json', '--mode', mode], {
      cwd: root,
      encoding: 'utf8',
      timeout: 10000,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).mode, mode);
  }
  for (const args of [
    ['--mode', 'auto'],
    ['--mode', 'fresh', '--mode', 'resume'],
    ['--plan', '.plans/x.md'],
  ]) {
    assert.equal(
      spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' }).status,
      1,
    );
  }
  const noGit = mkdtempSync(join(tmpdir(), 'claude-cli-no-git-'));
  t.after(() => rmSync(noGit, { recursive: true, force: true }));
  const failed = spawnSync(process.execPath, [cli, '--json'], { cwd: noGit, encoding: 'utf8' });
  assert.equal(failed.status, 1);
  assert.equal(JSON.parse(failed.stdout).baseline.clean, null);
});
test('base64 raw status preserves path bytes and digest uses exact bounded Git bytes', (t) => {
  const { root, git } = fixture(t);
  const filename = join(root, '한글😀-file');
  writeFileSync(filename, 'odd path\n');
  git('add', '.');
  const expected = headIndexStatus(root, 'buffer');
  const output = runClaudePreflight({ root });
  assert.equal(output.baseline.rawStatusBase64, expected.toString('base64'));
  assert.equal(output.baseline.clean, false);
  assert.match(output.baseline.diffHash, /^[a-f0-9]{64}$/);
});
test('preflight CLI consumes bounded explicit checkpoint JSON', (t) => {
  const { root } = fixture(t);
  mkdirSync(join(root, '.plans'));
  writeFileSync(join(root, '.plans/selected.md'), '- Plan ID: selected\n- Status: active\n');
  const continuation = {
    expectedPlanId: 'selected',
    checkpointSnapshot: runClaudePreflight({ root }).snapshot,
  };
  const args = [
    cli,
    '--mode',
    'resume',
    '--plan',
    '.plans/selected.md',
    '--continuation',
    JSON.stringify(continuation),
  ];
  const p = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
  assert.equal(p.status, 0, p.stderr);
  assert.equal(JSON.parse(p.stdout).continuation.decision, 'candidate');
  for (const payload of ['{}', '{', ' '.repeat(4097)]) {
    assert.equal(
      spawnSync(process.execPath, [...args.slice(0, -1), payload], { cwd: root, encoding: 'utf8' })
        .status,
      1,
    );
  }
});
test('Git diagnostics do not invoke configured fsmonitor or external diff processes', (t) => {
  const { root, git } = fixture(t);
  const hook = join(root, '.git/process-probe.sh');
  const marker = join(root, '.git/unexpected-process');
  writeFileSync(hook, `#!/bin/sh\nprintf called >> '${marker}'\nexit 0\n`, { mode: 0o755 });
  git('config', 'core.fsmonitor', hook);
  git('config', 'diff.external', hook);
  writeFileSync(join(root, 'source.txt'), 'changed\n');
  const output = runClaudePreflight({ root });
  assert.equal(output.baseline.clean, false);
  assert.throws(() => readFileSync(marker), { code: 'ENOENT' });
});

test('package-runner separator after default --json reaches actual preflight', (t) => {
  const { root } = fixture(t);
  const result = spawnSync(process.execPath, [cli, '--json', '--', '--mode', 'fresh'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).mode, 'fresh');
  const repeated = spawnSync(process.execPath, [cli, '--json', '--', '--', '--mode', 'fresh'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.equal(repeated.status, 1);
});

// The snapshot binds the worktree and HEAD, never the user's stage: the digest is read through a
// temporary index from the HEAD tree, so staging (git add, git add -N) changes nothing.
test('fingerprint ignores the stage: the same worktree content gives one digest', (t) => {
  const { root, git } = fixture(t);
  mkdirSync(join(root, '.plans'));
  writeFileSync(join(root, '.plans/selected.md'), '- Plan ID: selected\n- Status: active\n');
  const clean = runClaudePreflight({ root });
  writeFileSync(join(root, 'source.txt'), 'staged A\n');
  git('add', 'source.txt');
  writeFileSync(join(root, 'source.txt'), 'baseline\n');
  const first = runClaudePreflight({ root });
  assert.equal(first.baseline.diffHash, clean.baseline.diffHash);
  assert.equal(first.baseline.clean, true);
  writeFileSync(join(root, 'source.txt'), 'staged B\n');
  git('add', 'source.txt');
  writeFileSync(join(root, 'source.txt'), 'baseline\n');
  assert.equal(runClaudePreflight({ root }).baseline.diffHash, clean.baseline.diffHash);
  assert.equal(
    runClaudePreflight({
      root,
      mode: 'resume',
      planPath: '.plans/selected.md',
      continuation: { expectedPlanId: 'selected', checkpointSnapshot: clean.snapshot },
    }).continuation.decision,
    'candidate',
  );
  // A new file gives one digest whether untracked, intent-to-add or staged; its content still counts.
  git('reset', '-q');
  writeFileSync(join(root, 'new.txt'), 'new file\n');
  const untracked = runClaudePreflight({ root }).baseline.diffHash;
  git('add', '-N', 'new.txt');
  assert.equal(runClaudePreflight({ root }).baseline.diffHash, untracked);
  git('add', 'new.txt');
  assert.equal(runClaudePreflight({ root }).baseline.diffHash, untracked);
  writeFileSync(join(root, 'new.txt'), 'other content\n');
  assert.notEqual(runClaudePreflight({ root }).baseline.diffHash, untracked);
  // A tracked edit staged or not is the same edit.
  git('reset', '-q');
  rmSync(join(root, 'new.txt'));
  writeFileSync(join(root, 'source.txt'), 'edited\n');
  const unstaged = runClaudePreflight({ root }).baseline.diffHash;
  git('add', 'source.txt');
  assert.equal(runClaudePreflight({ root }).baseline.diffHash, unstaged);
  assert.notEqual(unstaged, clean.baseline.diffHash);
});

test('preflight leaves the real index bytes unchanged and ignores an ambient GIT_INDEX_FILE', (t) => {
  const { root, git } = fixture(t);
  writeFileSync(join(root, 'source.txt'), 'staged\n');
  git('add', 'source.txt');
  writeFileSync(join(root, 'source.txt'), 'worktree\n');
  writeFileSync(join(root, 'intent.txt'), 'intent\n');
  git('add', '-N', 'intent.txt');
  writeFileSync(join(root, 'untracked.txt'), 'untracked\n');
  const before = indexDigest(root);
  const first = runClaudePreflight({ root });
  assert.deepEqual(first.diagnostics, []);
  assert.equal(indexDigest(root), before);
  // A hook or caller environment that names another index is not inherited.
  const ambient = process.env.GIT_INDEX_FILE;
  process.env.GIT_INDEX_FILE = join(root, '.git/missing-index');
  try {
    assert.equal(runClaudePreflight({ root }).baseline.diffHash, first.baseline.diffHash);
  } finally {
    if (ambient === undefined) delete process.env.GIT_INDEX_FILE;
    else process.env.GIT_INDEX_FILE = ambient;
  }
  assert.equal(indexDigest(root), before);
  assert.ok(!existsSync(join(root, '.git/missing-index')));
});

for (const filters of [['clean'], ['process'], ['clean', 'process']])
  test(`preflight disables ${filters.join('/')} filters before reading worktree state`, (t) => {
    const { root, git } = fixture(t);
    const hook = join(root, '.git/filter-probe.sh');
    const marker = join(root, '.git/filter-called');
    writeFileSync(hook, `#!/bin/sh\nprintf called >> '${marker}'\ncat\n`, { mode: 0o755 });
    writeFileSync(join(root, '.git/info/attributes'), 'source.txt filter=probe\n');
    for (const filter of filters) git('config', `filter.probe.${filter}`, hook);
    git('config', 'filter.probe.required', 'true');
    // Driver names are argv data, not shell syntax; unused drivers must also be neutralized.
    git('config', 'filter.unused;echo ignored.clean', hook);
    writeFileSync(join(root, 'source.txt'), 'changed source\n');
    const before = readFileSync(join(root, '.git/config'));
    const output = runClaudePreflight({ root });
    assert.throws(() => readFileSync(marker), { code: 'ENOENT' });
    assert.equal(output.baseline.clean, false);
    assert.match(output.baseline.diffHash, /^[a-f0-9]{64}$/);
    assert.deepEqual(readFileSync(join(root, '.git/config')), before);
  });

test('unrepresentable or excessive filter config fails before status/diff instead of running drivers', (t) => {
  for (const sections of [
    '[filter "unsafe=name"]\n clean = false\n',
    Array.from({ length: 65 }, (_, i) => `[filter "driver${i}"]\n clean = false\n`).join(''),
  ]) {
    const { root } = fixture(t);
    const path = join(root, '.git/config');
    writeFileSync(path, readFileSync(path, 'utf8') + '\n' + sections);
    const output = runClaudePreflight({ root });
    assert.equal(output.baseline.clean, null);
    assert.equal(output.baseline.rawStatus, null);
    assert.equal(output.snapshot, null);
    assert.ok(output.diagnostics.some((item) => item.startsWith('git-filter-config-')));
  }
});

test('gitlinks stop before worktree traversal into uninspected submodule configuration', (t) => {
  const { root, git } = fixture(t);
  git('update-index', '--add', '--cacheinfo', `160000,${git('rev-parse', 'HEAD').trim()},nested`);
  const result = runClaudePreflight({ root });
  assert.ok(result.diagnostics.includes('submodule-content-not-supported'));
  assert.equal(result.baseline.rawStatus, null);
  assert.equal(result.snapshot, null);
});
