import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

import { main } from '../../../agents/common/red-reason-check.mjs';

const tool = resolve(import.meta.dirname, '../../../agents/common/red-reason-check.mjs');
// Node 24 spec reporter output. `assertion.log`: two assertion failures. `mixed-enoent.log`: one assertion failure
// and one ENOENT. `import-error.log`: one assertion failure and a test file whose import is missing.
// `all-pass.log`: no failure. `tap.log`: the TAP reporter.
// Node 26 spec reporter output of a module-level throw: `module-throw.log` in the default test isolation (the error is
// printed above the block, which only says 'test failed'), `module-throw-isolation-none.log` with
// `--test-isolation=none` (the error is in the block). Vitest 5.1.1 default reporter output: `vitest-assertion.log`
// (two assertion failures, one in a describe group) and `vitest-import.log` (a suite whose import is missing, no test
// ran).
const fixtures = resolve(import.meta.dirname, 'fixtures/verification-records/red');
const temporary = [];
test.after(() => temporary.forEach((path) => rmSync(path, { recursive: true, force: true })));

function run(argv) {
  const out = [];
  const err = [];
  const code = main(argv, {
    cwd: fixtures,
    log: (line) => out.push(line),
    error: (line) => err.push(line),
  });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

function json(text) {
  assert.match(text, /^\{/u, 'JSON output');
  return JSON.parse(text);
}

const reasons = (out) =>
  json(out).violations.map((v) => `${v.kind}:${v.test ?? v.signature ?? ''}`);

test('every failing test carrying an expected assertion reason passes', () => {
  const { code, out } = run([
    '--json',
    '--log',
    'assertion.log',
    '--expect',
    '^\\s*AssertionError',
  ]);
  assert.equal(code, 0);
  assert.deepEqual(json(out).summary, { fail: 2, failures: 2, violations: 0 });
});

test('an ENOENT failure next to an assertion failure is a violation', () => {
  const { code, out } = run(['--json', '--log', 'mixed-enoent.log', '--expect', 'AssertionError']);
  assert.equal(code, 1);
  assert.deepEqual(reasons(out), [
    'unexpected-reason:reads the fixture',
    'unexpected-signature:ENOENT',
    'unexpected-signature:ENOENT',
  ]);
});

test('an import error outside the failing test blocks is a violation', () => {
  const { code, out } = run(['--json', '--log', 'import-error.log', '--expect', 'AssertionError']);
  assert.equal(code, 1);
  assert.deepEqual(reasons(out), [
    'unexpected-signature:ERR_MODULE_NOT_FOUND',
    'unexpected-signature:ERR_MODULE_NOT_FOUND',
    'unexpected-signature:ERR_MODULE_NOT_FOUND',
    'unexpected-reason:imports.test.mjs',
  ]);
});

test('a reason named by another expect pattern is expected', () => {
  const { code, out } = run([
    '--json',
    '--log',
    'mixed-enoent.log',
    '--expect',
    'AssertionError',
    '--expect',
    'ENOENT',
  ]);
  assert.equal(code, 0);
  assert.deepEqual(json(out).summary, { fail: 2, failures: 2, violations: 0 });
});

test('a log without failures is a violation', () => {
  const { code, out } = run(['--json', '--log', 'all-pass.log', '--expect', 'AssertionError']);
  assert.equal(code, 1);
  assert.deepEqual(reasons(out), ['no-failure:']);
});

function logFile(name, lines) {
  const directory = mkdtempSync(resolve(tmpdir(), 'red-reason-check-'));
  temporary.push(directory);
  const path = resolve(directory, name);
  writeFileSync(path, `${lines.join('\n')}\n`);
  return path;
}

test('a signature word in a test title is not a failure reason', () => {
  const log = logFile('title.log', [
    '✖ reports ENOENT as a violation (1ms)',
    'ℹ fail 1',
    '',
    '✖ failing tests:',
    '',
    'test at title.test.mjs:3:1',
    '✖ reports ENOENT as a violation (1ms)',
    '  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:',
  ]);
  const { code, out } = run(['--json', '--log', log, '--expect', 'AssertionError']);
  assert.equal(code, 0);
  assert.deepEqual(json(out).summary, { fail: 1, failures: 1, violations: 0 });
});

test('a failure count without blocks or blocks without a count are violations', () => {
  const countOnly = run([
    '--json',
    '--log',
    logFile('count.log', ['ℹ tests 1', 'ℹ fail 1']),
    '--expect',
    'AssertionError',
  ]);
  assert.equal(countOnly.code, 1);
  assert.deepEqual(reasons(countOnly.out), ['no-failure-blocks:']);
  const blocksOnly = run([
    '--json',
    '--log',
    logFile('blocks.log', ['✖ reports the missing citation (1ms)', '✔ passes (1ms)']),
    '--expect',
    'AssertionError',
  ]);
  assert.equal(blocksOnly.code, 1);
  assert.deepEqual(reasons(blocksOnly.out), [
    'missing-summary:',
    'unexpected-reason:reports the missing citation',
  ]);
});

test('input errors and unsupported formats exit 2 instead of passing', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'red-reason-check-'));
  temporary.push(directory);
  const empty = resolve(directory, 'empty.log');
  writeFileSync(empty, '');
  for (const argv of [
    ['--log', 'assertion.log'],
    ['--log', 'assertion.log', '--expect', '('],
    ['--log', 'import-error.log', '--expect', ''],
    ['--log', 'import-error.log', '--expect', 'AssertionError', '--expect', '.*'],
    ['--log', 'absent.log', '--expect', 'AssertionError'],
    ['--log', empty, '--expect', 'AssertionError'],
    ['--log', 'tap.log', '--expect', 'AssertionError'],
    ['--expect', 'AssertionError'],
    ['--log', 'assertion.log', '--expect', 'AssertionError', '--bogus'],
  ]) {
    const { code, err } = run(argv);
    assert.equal(code, 2, argv.join(' '));
    assert.ok(err.length > 0, argv.join(' '));
  }
});

test('the command line exits 1 on an unexpected reason and 0 on assertion failures', () => {
  for (const [log, status] of [
    ['assertion.log', 0],
    ['mixed-enoent.log', 1],
  ]) {
    const result = spawnSync(process.execPath, [tool, '--log', log, '--expect', 'AssertionError'], {
      cwd: fixtures,
      encoding: 'utf8',
    });
    assert.equal(result.status, status, result.stderr);
  }
});

// P6 ③ RED 3: a Vitest RED log is judged as a node --test log is: the failure count of the `Tests` summary, an expected
// reason in every `FAIL` block of the failure sections, and no unexpected signature outside those reasons.
test('a Vitest RED log is judged as a node --test log is (P6 ③ RED 3)', () => {
  const expected = run(['--json', '--log', 'vitest-assertion.log', '--expect', '^AssertionError']);
  assert.equal(expected.code, 0, expected.out || expected.err);
  assert.deepEqual(json(expected.out).summary, { fail: 2, failures: 2, violations: 0 });
  assert.equal(json(expected.out).format, 'vitest');
  const other = run(['--json', '--log', 'vitest-assertion.log', '--expect', 'ENOENT']);
  assert.equal(other.code, 1, other.err);
  assert.deepEqual(reasons(other.out), [
    'unexpected-reason:sample.test.js > reports the missing citation',
    'unexpected-reason:sample.test.js > group > rejects the unknown value',
  ]);
});

test('a Vitest suite that fails to import and runs no test is not a RED (P6 ③ RED 3)', () => {
  const { code, out, err } = run([
    '--json',
    '--log',
    'vitest-import.log',
    '--expect',
    'AssertionError',
  ]);
  assert.equal(code, 1, err);
  assert.deepEqual(reasons(out), [
    'unexpected-reason:imports.test.js [ imports.test.js ]',
    'unexpected-signature:Cannot find module or package',
    'no-failure:',
  ]);
});

test('Vitest failures sharing one error, colored output and a missing summary (P6 ③ RED 3)', () => {
  const grouped = run([
    '--json',
    '--log',
    logFile('grouped.log', [
      ' FAIL  a.test.js > first',
      ' FAIL  a.test.js > second',
      'AssertionError: expected 1 to be 2 // Object.is equality',
      '',
      '⎯⎯⎯⎯⎯⎯⎯[1/1]⎯',
      '',
      ' Test Files  1 failed (1)',
      '      Tests  2 failed (2)',
    ]),
    '--expect',
    '^AssertionError',
  ]);
  assert.equal(grouped.code, 0, grouped.out || grouped.err);
  assert.deepEqual(json(grouped.out).summary, { fail: 2, failures: 2, violations: 0 });
  // A terminal that keeps colors writes ANSI escapes around the badges and markers.
  const colored = readFileSync(resolve(fixtures, 'vitest-assertion.log'), 'utf8')
    .split('\n')
    .map((line) => (line ? `\u001b[31m${line}\u001b[39m` : line));
  const ansi = run([
    '--json',
    '--log',
    logFile('colored.log', colored),
    '--expect',
    '^AssertionError',
  ]);
  assert.equal(ansi.code, 0, ansi.out || ansi.err);
  assert.deepEqual(json(ansi.out).summary, { fail: 2, failures: 2, violations: 0 });
  const unsummarized = run([
    '--json',
    '--log',
    logFile('unsummarized.log', [' FAIL  a.test.js > first', 'AssertionError: expected 1 to be 2']),
    '--expect',
    '^AssertionError',
  ]);
  assert.equal(unsummarized.code, 1, unsummarized.err);
  assert.deepEqual(reasons(unsummarized.out), ['missing-summary:']);
});

// A module-level throw in the default test isolation prints its error outside the failure blocks: the block either
// is missing (`ℹ fail` only) or only says 'test failed'. The message points at `--test-isolation=none`, which puts the
// error in the block.
test('a node --test failure without its reason in a block points at --test-isolation=none (P6 ③ RED 3)', () => {
  const countOnly = run([
    '--json',
    '--log',
    logFile('count-only.log', ['ℹ tests 1', 'ℹ fail 1']),
    '--expect',
    'AssertionError',
  ]);
  assert.equal(countOnly.code, 1);
  const [blocks] = json(countOnly.out).violations;
  assert.equal(blocks.kind, 'no-failure-blocks');
  assert.match(blocks.detail, /--test-isolation=none/u);
  const placeholder = run(['--json', '--log', 'module-throw.log', '--expect', 'SyntaxError']);
  assert.equal(placeholder.code, 1);
  assert.deepEqual(reasons(placeholder.out), ['unexpected-reason:throws.test.mjs']);
  assert.match(json(placeholder.out).violations[0].detail, /--test-isolation=none/u);
  const isolated = run([
    '--json',
    '--log',
    'module-throw-isolation-none.log',
    '--expect',
    'SyntaxError',
  ]);
  assert.equal(isolated.code, 0, isolated.out);
  assert.deepEqual(json(isolated.out).summary, { fail: 1, failures: 1, violations: 0 });
});
