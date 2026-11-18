import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

import { main } from '../../../agents/common/runner-log-check.mjs';

const tool = resolve(import.meta.dirname, '../../../agents/common/runner-log-check.mjs');
const fixtures = resolve(import.meta.dirname, 'fixtures/verification-records/runner');
const temporary = [];
test.after(() => temporary.forEach((path) => rmSync(path, { recursive: true, force: true })));

const DIGEST = 'sha256:57e3babd7077b0d3a8e000f8d4b0a91892b0fcaff7e83f0f50ab8d232d896085';
const HEADER = `KNU review snapshot ${DIGEST}`;

// The default root is the git repository of the working directory, so each fixture is a repository.
// `logs/run.log` holds one run: header, a shasum line naming `notes/records 4.md`, a `sha256:` line ending in
// `install 42`, the run's result lines (`ℹ pass 873`, `Install dependencies=28`, `10 failed`) and `exit=0`.
function record(fields = {}) {
  return {
    command: 'node --test scripts/ci/agents/common/citation-check.test.mjs',
    exit: 0,
    environment: 'node v24',
    observedResult: 'all tests pass `ℹ pass 873`',
    outputPaths: ['logs/run.log'],
    sourceDigest: DIGEST,
    ...fields,
  };
}

function fixture(evidence) {
  const root = mkdtempSync(resolve(tmpdir(), 'runner-log-check-'));
  temporary.push(root);
  execFileSync('git', ['init', '-q'], { cwd: root });
  cpSync(fixtures, resolve(root, 'logs'), { recursive: true });
  writeFileSync(
    resolve(root, 'evidence.json'),
    typeof evidence === 'string' ? evidence : JSON.stringify(evidence),
  );
  return root;
}

function run(argv, cwd) {
  const out = [];
  const err = [];
  const code = main(argv, { cwd, log: (line) => out.push(line), error: (line) => err.push(line) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

function check(records, header = HEADER) {
  const root = fixture({ runner: 'parent', records });
  return run(['--json', '--evidence', 'evidence.json', '--header', header], root);
}

function json(text) {
  assert.match(text, /^\{/u, 'JSON output');
  return JSON.parse(text);
}

const kinds = (out) => json(out).violations.map(({ record: index, kind }) => [index, kind]);

test('a record whose outputs, header, exit, digest and summary fragments match passes', () => {
  const { code, out } = check([
    record({ observedResult: 'pass `ℹ pass 873`, install `Install dependencies=28`, `exit=0`' }),
    record({ outputPaths: ['logs/result.json'], observedResult: 'reviewer returned PASS' }),
    record({ sourceDigest: undefined, observedResult: undefined }),
  ]);
  assert.equal(code, 0);
  assert.deepEqual(json(out).summary, {
    records: 3,
    outputs: 3,
    fragments: 3,
    unverifiedSummaries: 2,
    violations: 0,
  });
});

test('record defects are violations: outputs, header, exit and digest', () => {
  const { code, out } = check([
    record({ outputPaths: [] }),
    record({ outputPaths: undefined }),
    record({ outputPaths: ['logs/absent.log'] }),
    record({ exit: 1 }),
    record({ sourceDigest: `sha256:${'0'.repeat(64)}` }),
    record({ outputPaths: ['logs/other-header.log'] }),
    record({ exit: '0' }),
    'not a record',
    record({ observedResult: 42 }),
  ]);
  assert.equal(code, 1);
  assert.deepEqual(kinds(out), [
    [0, 'missing-output'],
    [0, 'summary-mismatch'],
    [1, 'missing-output'],
    [1, 'summary-mismatch'],
    [2, 'output-missing'],
    [2, 'summary-mismatch'],
    [3, 'exit-mismatch'],
    [4, 'digest-mismatch'],
    [5, 'header-mismatch'],
    [6, 'invalid-record'],
    [7, 'invalid-record'],
    [8, 'invalid-record'],
  ]);
});

test('summary fragments must appear as a token on a result line of the record log', () => {
  const { code, out } = check([
    record({ observedResult: 'pass `ℹ pass 87`' }),
    record({ observedResult: 'leading boundary `0 failed`' }),
    record({ observedResult: 'digest line only `records 4`' }),
    record({ observedResult: 'sha256 line only `install 42`' }),
    record({ observedResult: 'header only `KNU review snapshot`' }),
    record({ outputPaths: ['logs/result.json'], observedResult: 'no log `ℹ pass 873`' }),
    record({ observedResult: 'bare numbers `41` and `208`' }),
    record({ observedResult: 'empty `` fragment' }),
    record({ observedResult: 'hex only `57e3babd`' }),
    record({ observedResult: 'unpaired `ℹ pass 873' }),
  ]);
  assert.equal(code, 1);
  assert.deepEqual(kinds(out), [
    [0, 'summary-mismatch'],
    [1, 'summary-mismatch'],
    [2, 'summary-mismatch'],
    [3, 'summary-mismatch'],
    [4, 'summary-mismatch'],
    [5, 'summary-mismatch'],
    [6, 'invalid-fragment'],
    [6, 'invalid-fragment'],
    [7, 'invalid-fragment'],
    [8, 'invalid-fragment'],
    [9, 'invalid-fragment'],
  ]);
});

test('input errors exit 2 instead of passing', () => {
  const valid = { runner: 'parent', records: [record()] };
  for (const [evidence, argv] of [
    [valid, ['--header', HEADER]],
    [valid, ['--evidence', 'evidence.json']],
    [valid, ['--evidence', 'evidence.json', '--header', 'KNU review snapshot']],
    [valid, ['--evidence', 'absent.json', '--header', HEADER]],
    [valid, ['--evidence', 'evidence.json', '--header', HEADER, '--bogus']],
    ['{"records": [', ['--evidence', 'evidence.json', '--header', HEADER]],
    [{ runner: 'parent', records: [] }, ['--evidence', 'evidence.json', '--header', HEADER]],
    [{ runner: 'parent' }, ['--evidence', 'evidence.json', '--header', HEADER]],
  ]) {
    const { code, err } = run(argv, fixture(evidence));
    assert.equal(code, 2, argv.join(' '));
    assert.ok(err.length > 0, argv.join(' '));
  }
});

test('the command line exits 1 on violations and 0 on a matching record', () => {
  for (const [records, status] of [
    [[record()], 0],
    [[record({ exit: 1 })], 1],
  ]) {
    const root = fixture({ runner: 'parent', records });
    const result = spawnSync(
      process.execPath,
      [tool, '--root', root, '--evidence', 'evidence.json', '--header', HEADER],
      { cwd: root, encoding: 'utf8' },
    );
    assert.equal(result.status, status, result.stderr);
  }
});

// A step that runs a command several times ends each run with a whole-line `exit=<n>`. The record's exit is compared
// with the last one, so an earlier failing run would stay hidden behind a final exit=0.
function logCheck(lines, recordFields = {}) {
  const root = fixture({
    runner: 'parent',
    records: [
      record({ outputPaths: ['logs/steps.log'], observedResult: 'steps ran', ...recordFields }),
    ],
  });
  writeFileSync(resolve(root, 'logs/steps.log'), `${[HEADER, ...lines].join('\n')}\n`);
  return run(['--json', '--evidence', 'evidence.json', '--header', HEADER], root);
}

test('an earlier whole-line exit that failed behind a final exit=0 is repeated-step-exit-hidden (RL-P2 RED 7)', () => {
  const hidden = logCheck(['run 1', 'exit=1', 'run 2', 'exit=0']);
  assert.equal(hidden.code, 1, 'a hidden failing step exit is a violation');
  const [violation] = json(hidden.out).violations;
  assert.equal(violation.kind, 'repeated-step-exit-hidden');
  assert.equal(violation.path, 'logs/steps.log');
  // The message points at the rule for writing exit lines.
  assert.match(violation.detail, /rg exit=1/u);
  // Every run passed, or the record itself carries the failure: nothing is hidden.
  assert.equal(logCheck(['run 1', 'exit=0', 'run 2', 'exit=0']).code, 0);
  assert.equal(
    json(logCheck(['run 1', 'exit=1', 'run 2', 'exit=1'], { exit: 1 }).out).violations.length,
    0,
  );
});

test('a search exit written with its command name is not a step exit (RL-P2 RED 7)', () => {
  // A self-consistency check log as the dispatch step asks for: search exits carry the command name, and the one
  // whole-line exit is the end of the bundle.
  const checked = logCheck([
    '$ rg -n old-term docs',
    'rg exit=1',
    '$ node check.mjs',
    'check ok',
    'exit=0',
  ]);
  assert.equal(checked.code, 0, checked.out);
  assert.deepEqual(json(checked.out).violations, []);
  // Indented or prefixed lines are not whole-line exits either.
  assert.equal(logCheck(['  note: exit=1 was expected here', 'exit=0']).code, 0);
});
