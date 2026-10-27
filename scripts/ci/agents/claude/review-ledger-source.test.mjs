import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

import { main } from '../../../agents/claude/review-ledger-source.mjs';

const tool = resolve(import.meta.dirname, '../../../agents/claude/review-ledger-source.mjs');
// `.artifacts/tools/claude-native/`: t1 parsed FAIL in round 1 with two findings (adjudicated in
// `evidence/r1-adjudication.json`), t2 unparseable completion, t3 no completion, t4 not a reviewer, t6 parsed PASS in
// round 2 of native subject s1. The test adds t5 with an unreadable task.json to a temporary copy.
const fixtures = resolve(import.meta.dirname, 'fixtures/review-ledger');
const temporary = [];
test.after(() => temporary.forEach((path) => rmSync(path, { recursive: true, force: true })));

function fixture() {
  const root = mkdtempSync(resolve(tmpdir(), 'review-ledger-source-'));
  temporary.push(root);
  cpSync(fixtures, root, { recursive: true });
  mkdirSync(resolve(root, '.artifacts/tools/claude-native/t5'), { recursive: true });
  writeFileSync(resolve(root, '.artifacts/tools/claude-native/t5/task.json'), '{ "record": ');
  return root;
}

function run(argv, cwd) {
  const out = [];
  const err = [];
  const code = main(argv, {
    cwd,
    env: {},
    log: (line) => out.push(line),
    error: (line) => err.push(line),
  });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

function json(text) {
  assert.match(text, /^\{/u, 'JSON output');
  return JSON.parse(text);
}

const byTask = (rows) => Object.fromEntries(rows.map((row) => [row.taskId, row]));

test('reviewer records become ledger rows with status, round, subject, findings and adjudication', () => {
  const root = fixture();
  const { code, out } = run(['--json', '--root', root, '--adjudications', 'evidence'], root);
  assert.equal(code, 0);
  const { rows, summary } = json(out);
  const tasks = byTask(rows);
  assert.deepEqual(Object.keys(tasks).sort(), ['t1', 't2', 't3', 't5', 't6']);
  assert.deepEqual(tasks.t1, {
    host: 'claude',
    taskId: 't1',
    issuedAt: '2026-10-01T00:00:00.000Z',
    subjectKey: 'feature-x',
    round: 1,
    status: 'parsed',
    verdict: 'FAIL',
    findings: [
      { id: 't1#0', severity: 'medium', criteriaItem: 'documents.md D2', location: 'a.mjs:1' },
      { id: 't1#1', severity: 'low', criteriaItem: null, location: 'a.mjs:1' },
    ],
    adjudication: { status: 'recorded', dispositions: ['fixed', 'rejected'], origins: [] },
  });
  assert.equal(tasks.t2.status, 'parse-failed');
  assert.equal(tasks.t2.subjectKey, 'basis:abc1234');
  assert.equal(tasks.t3.status, 'completion-missing');
  assert.equal(tasks.t5.status, 'task-unreadable');
  assert.deepEqual(
    [
      tasks.t6.status,
      tasks.t6.verdict,
      tasks.t6.round,
      tasks.t6.subjectKey,
      tasks.t6.adjudication.status,
    ],
    ['parsed', 'PASS', 2, 'task:s1', 'missing'],
  );
  assert.deepEqual(summary.statuses, {
    parsed: 2,
    'parse-failed': 1,
    'completion-missing': 1,
    'task-unreadable': 1,
  });
  assert.deepEqual(summary.adjudication, { recorded: 1, missing: 4 });
});

test('until keeps records issued at or before the cutoff', () => {
  const root = fixture();
  const { code, out } = run(
    ['--json', '--root', root, '--until', '2026-10-02T00:00:00.000Z'],
    root,
  );
  assert.equal(code, 0);
  const result = json(out);
  assert.deepEqual(result.rows.map(({ taskId }) => taskId).sort(), ['t1', 't2']);
  // t5 has no readable issue time, so it cannot be placed before or after the cutoff; it is counted, not dropped.
  assert.equal(result.excludedWithoutIssuedAt, 1);
});

test('an invalid adjudication record marks its rows invalid and exits 1', () => {
  const root = fixture();
  writeFileSync(
    resolve(root, 'evidence/r1-adjudication.json'),
    JSON.stringify({
      schema: 'review-adjudication/v1',
      subject: 'feature-x',
      round: 1,
      reviews: [{ taskId: 't1', resultPath: 'evidence/r1-result.json' }],
      findings: [{ id: 't1#0', severity: 'medium', disposition: 'fixed' }],
    }),
  );
  const { code, out } = run(['--json', '--root', root, '--adjudications', 'evidence'], root);
  assert.equal(code, 1);
  const result = json(out);
  assert.equal(byTask(result.rows).t1.adjudication.status, 'invalid');
  assert.deepEqual(
    result.adjudicationViolations.map(({ kind, id }) => `${kind}:${id}`),
    ['missing-finding:t1#1'],
  );
});

test('an unreadable record and a task adjudicated twice are violations', () => {
  const root = fixture();
  writeFileSync(resolve(root, 'evidence/broken-adjudication.json'), '{');
  cpSync(
    resolve(root, 'evidence/r1-adjudication.json'),
    resolve(root, 'evidence/r1-copy-adjudication.json'),
  );
  const { code, out } = run(['--json', '--root', root, '--adjudications', 'evidence'], root);
  assert.equal(code, 1);
  assert.deepEqual(
    json(out).adjudicationViolations.map(({ file, kind }) => `${kind}:${file}`),
    [
      'record-unreadable:evidence/broken-adjudication.json',
      'duplicate-review:evidence/r1-copy-adjudication.json',
    ],
  );
});

test('input errors exit 2 instead of passing', () => {
  const root = fixture();
  const empty = mkdtempSync(resolve(tmpdir(), 'review-ledger-empty-'));
  temporary.push(empty);
  for (const [argv, cwd] of [
    [['--root', root, '--until', 'yesterday'], root],
    [['--root', root, '--adjudications', 'absent'], root],
    [['--root', root, '--bogus'], root],
    [['--root', empty], empty],
  ]) {
    const { code, err } = run(argv, cwd);
    assert.equal(code, 2, argv.join(' '));
    assert.ok(err.length > 0, argv.join(' '));
  }
});

test('the command line prints the ledger summary', () => {
  const root = fixture();
  const result = spawnSync(
    process.execPath,
    [tool, '--root', root, '--adjudications', 'evidence'],
    {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, KNU_ARTIFACTS_DIR: '' },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /count 5/u);
});
