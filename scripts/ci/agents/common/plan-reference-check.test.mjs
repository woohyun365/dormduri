import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

import { main } from '../../../agents/common/plan-reference-check.mjs';

const tool = resolve(import.meta.dirname, '../../../agents/common/plan-reference-check.mjs');
// `.plans/x-plan.md` uses every reference form and resolves. `.plans/y-plan.md` holds one defect kind per line, an
// ignored target and the known limit. `.plans/other-plan.md` and `docs/guide.md` are reference targets.
const fixtures = resolve(import.meta.dirname, 'fixtures/plan-reference');
const temporary = [];
test.after(() => temporary.forEach((path) => rmSync(path, { recursive: true, force: true })));

// A repository copy where `local/` is ignored, so a missing ignored target is reported as unavailable.
function fixture() {
  const root = mkdtempSync(resolve(tmpdir(), 'plan-reference-'));
  temporary.push(root);
  cpSync(fixtures, root, { recursive: true });
  writeFileSync(resolve(root, '.gitignore'), 'local/\n');
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['add', '-A'], { cwd: root });
  return root;
}

function run(argv, cwd) {
  const out = [];
  const err = [];
  const code = main(argv, { cwd, log: (line) => out.push(line), error: (line) => err.push(line) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

function json(text) {
  assert.match(text, /^\{/u, 'JSON output');
  return JSON.parse(text);
}

test('same-document, linked, path, plan ID and non-plan references resolve', () => {
  const root = fixture();
  const { code, out } = run(['--json', '.plans/x-plan.md'], root);
  assert.equal(code, 0);
  const { summary, violations } = json(out);
  assert.deepEqual(violations, []);
  assert.deepEqual(summary, {
    files: 1,
    references: 22,
    crossDocument: 8,
    links: 4,
    violations: 0,
    targetUnavailable: 0,
  });
});

test('unresolved references, duplicate definitions and broken links are violations', () => {
  const root = fixture();
  const { code, out } = run(['--json', '.plans/y-plan.md'], root);
  assert.equal(code, 1);
  const result = json(out);
  assert.deepEqual(
    result.violations.map(({ line, kind, ref }) => [line, kind, ref]),
    [
      [7, 'unresolved', '§9'],
      [8, 'unresolved', '§1.2'],
      [9, 'unresolved', 'OQ-Y9'],
      [9, 'unresolved', 'Phase P9'],
      [10, 'unresolved', '§8'],
      [11, 'unresolved', 'OQ-O9'],
      [12, 'unresolved', '§7'],
      [13, 'unresolved-target', '§1'],
      [13, 'broken-link', '.plans/gone-plan.md'],
      [13, 'broken-link', '.plans/other-plan.md#nope'],
      [13, 'broken-link', '.plans/bad%zz.md'],
      [14, 'unresolved-target', '§1'],
      [27, 'duplicate-definition', 'OQ-Y1'],
      [29, 'duplicate-definition', '§2'],
      [31, 'broken-link', '#nope'],
      [32, 'unresolved-target', '§1'],
      [33, 'unresolved-target', '§5'],
      [33, 'broken-link', 'docs/Guide.md'],
      [37, 'unresolved', 'Phase V9'],
    ],
  );
  // Line 15 points at an ignored file that is absent here; line 16 is the known limit (a section number written for
  // another document matches this document's own §3) and cannot be told apart, so it resolves.
  assert.equal(result.summary.targetUnavailable, 2);
  assert.ok(!result.violations.some(({ line }) => line === 15 || line === 16));
});

// Plans live in an ignored directory. A relative link there to a missing file cannot be told apart from another
// developer's local file, so it is unavailable, and so is a missing root path inside the ignored directory. A backtick
// path found neither from the root nor from the plan is judged at the root, so a mistyped path outside the ignored
// directory is not hidden by it.
test('inside an ignored plan, a missing backtick path is unresolved and a missing relative link is unavailable', () => {
  const root = fixture();
  mkdirSync(resolve(root, '.plans/local'));
  writeFileSync(
    resolve(root, '.plans/local/z-plan.md'),
    '# Z plan\n\n## 1. Goal\n\n- Path `core.md` §1 and link [gone](gone.md) §1.\n- Root path `.plans/local/gone.md` §1.\n',
  );
  const { code, out } = run(['--json', '.plans/local/z-plan.md'], root);
  assert.equal(code, 1);
  const result = json(out);
  assert.deepEqual(
    result.violations.map(({ line, kind, ref }) => [line, kind, ref]),
    [[5, 'unresolved-target', '§1']],
  );
  // A root path inside the ignored plan directory has the same limit as a relative link.
  assert.equal(result.summary.targetUnavailable, 3);
});

test('report-only counts violations but exits 0', () => {
  const root = fixture();
  const { code, out } = run(['--json', '--report-only', '.plans/y-plan.md'], root);
  assert.equal(code, 0);
  assert.equal(json(out).summary.violations, 19);
});

test('input errors exit 2 instead of passing', () => {
  const root = fixture();
  writeFileSync(resolve(root, 'notes.txt'), 'x §1\n');
  writeFileSync(resolve(root, 'empty.md'), '');
  for (const argv of [
    [],
    ['.plans/absent-plan.md'],
    ['notes.txt'],
    ['empty.md'],
    ['--bogus', '.plans/x-plan.md'],
    ['--root', resolve(root, 'absent'), '.plans/x-plan.md'],
  ]) {
    const { code, err } = run(argv, root);
    assert.equal(code, 2, argv.join(' '));
    assert.ok(err.length > 0, argv.join(' '));
  }
});

test('the command line exits 1 on violations and 0 on a resolved plan', () => {
  const root = fixture();
  for (const [plan, status] of [
    ['.plans/x-plan.md', 0],
    ['.plans/y-plan.md', 1],
  ]) {
    const result = spawnSync(process.execPath, [tool, plan], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, status, result.stderr);
  }
});
