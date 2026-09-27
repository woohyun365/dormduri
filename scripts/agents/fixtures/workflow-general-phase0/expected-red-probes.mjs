// Explicit invocation only: node --test <this file>. Not part of normal green CI discovery.
// Assertions describe intended fixes; current failures are defects, not accepted golden behavior.
import assert from 'node:assert/strict';
import test from 'node:test';

import { disposablePreflight } from './disposable-preflight.mjs';

const planBody = '# Fixture\n- Plan ID: fixture-task\n- Status: in-progress\n';

test('F01 expected-red: first unstaged porcelain path is not staged or truncated', (t) => {
  const f = disposablePreflight(t);
  f.put('tracked.txt', 'changed\n');
  const raw = f.git(['status', '--short', '--untracked-files=all']);
  assert.equal(raw, ' M tracked.txt\n', 'reproducer must have one real unstaged file');
  const summary = f.summary();
  t.diagnostic(JSON.stringify({ rawGitStatus: raw, preflightRepository: summary.repository }));
  assert.deepEqual(
    { staged: summary.repository.stagedPaths, unstaged: summary.repository.unstagedPaths },
    { staged: [], unstaged: ['tracked.txt'] },
    'F01: preflight must preserve the first porcelain column and full path',
  );
});

test('PLANS discovery expected-red: actual preflight discovers new root and excludes README', (t) => {
  const f = disposablePreflight(t);
  f.put('.plans/fixture-task-plan.md', planBody);
  f.put('.plans/README.md', '# Storage guidance, not an active plan\n');
  const summary = f.summary();
  t.diagnostic(JSON.stringify({ actualActivePlans: summary.activePlans }));
  assert.deepEqual(
    summary.activePlans,
    [{ path: '.plans/fixture-task-plan.md', status: 'in-progress' }],
    'PLANS discovery: the new authoring root must be read by the actual entry',
  );
});

test('PLANS safe-path expected-red: explicit safe new-root selection reaches resume diagnostics', (t) => {
  const f = disposablePreflight(t);
  f.put('.omx/plans/fixture-task-plan.md', planBody);
  f.put('.plans/fixture-task-plan.md', planBody);
  const legacy = f.summary(['--resume', '--plan', '.omx/plans/fixture-task-plan.md', '--json']);
  assert.equal(legacy.resume.diagnostics.taskId, 'fixture-task', 'legacy control must start');
  const result = f.run(['--resume', '--plan', '.plans/fixture-task-plan.md', '--json']);
  t.diagnostic(
    JSON.stringify({ exit: result.status, stdout: result.stdout, stderr: result.stderr }),
  );
  // A nonzero CLI exit is asserted here only after the real source's legacy startup control passed.
  assert.equal(
    result.status,
    0,
    'PLANS safe-path: a regular in-repository .plans file must be admitted',
  );
  assert.equal(JSON.parse(result.stdout).resume.diagnostics.taskId, 'fixture-task');
});
