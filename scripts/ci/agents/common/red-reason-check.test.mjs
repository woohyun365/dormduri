import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

import { main } from '../../../agents/common/red-reason-check.mjs';

const tool = resolve(import.meta.dirname, '../../../agents/common/red-reason-check.mjs');
// Node 24 spec reporter output. `assertion.log`: two assertion failures. `mixed-enoent.log`: one assertion failure
// and one ENOENT. `import-error.log`: one assertion failure and a test file whose import is missing.
// `all-pass.log`: no failure. `tap.log`: the TAP reporter.
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
