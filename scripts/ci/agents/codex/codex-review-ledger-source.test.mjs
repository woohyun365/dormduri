import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

import { codexReviewRegistry } from './fixtures/review-ledger-registry.mjs';

const tool = resolve(import.meta.dirname, '../../../agents/codex/review-ledger-source.mjs');
// Loaded inside each test so a missing module fails that test with its own reason.
const codexReader = () => import('../../../agents/codex/review-ledger-source.mjs');
const temporary = [];
test.after(() => temporary.forEach((path) => rmSync(path, { recursive: true, force: true })));

const fixture = () => codexReviewRegistry(temporary);

function run(main, argv, cwd) {
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

const byTask = (rows) => Object.fromEntries(rows.map((row) => [row.taskId, row]));

test('Codex review registrations and their dispositions become host codex rows (P6 ② RED 5)', async () => {
  const { main } = await codexReader();
  const root = fixture();
  const { code, out } = run(main, ['--json', '--root', root, '--adjudications', 'evidence'], root);
  assert.equal(code, 0, out);
  const { rows, summary, adjudicationViolations } = JSON.parse(out);
  assert.deepEqual(adjudicationViolations, []);
  const tasks = byTask(rows);
  assert.deepEqual(Object.keys(tasks).sort(), [
    'broken',
    'review_tok1_1',
    'review_tok1_2',
    'review_tok1_3',
  ]);
  assert.match(tasks.review_tok1_1.snapshot, /^sha256:[a-f0-9]{64}$/u);
  assert.deepEqual(tasks.review_tok1_1, {
    host: 'codex',
    taskId: 'review_tok1_1',
    issuedAt: null,
    subjectKey: 'codex-feature',
    round: 1,
    status: 'parsed',
    verdict: 'FAIL',
    findings: [
      {
        id: 'review_tok1_1#0',
        severity: 'medium',
        criteriaItem: 'documents.md D2',
        location: 'a.mjs:1',
      },
    ],
    adjudication: { status: 'recorded', dispositions: ['fixed'], origins: [] },
    subjectSize: { paths: 2, documents: 1 },
    snapshot: tasks.review_tok1_1.snapshot,
  });
  assert.deepEqual(
    [
      tasks.review_tok1_2.status,
      tasks.review_tok1_2.verdict,
      tasks.review_tok1_2.round,
      tasks.review_tok1_2.subjectKey,
      tasks.review_tok1_2.adjudication.status,
      tasks.review_tok1_2.subjectSize,
    ],
    ['parsed', 'PASS', 2, 'codex-feature', 'recorded', null],
  );
  assert.notEqual(tasks.review_tok1_2.snapshot, tasks.review_tok1_1.snapshot);
  // Without an acceptance the reviewer's result never reached the Parent; without a disposition record the reader
  // falls back to the dispatch token as the subject.
  assert.deepEqual(
    [tasks.review_tok1_3.status, tasks.review_tok1_3.verdict, tasks.review_tok1_3.subjectKey],
    ['completion-missing', null, 'dispatch:tok1'],
  );
  assert.equal(tasks.broken.status, 'task-unreadable');
  assert.deepEqual(summary.hosts, { codex: 4 });
  assert.deepEqual(summary.statuses, {
    parsed: 2,
    'completion-missing': 1,
    'task-unreadable': 1,
  });
});

test('an accepted review whose result no record names is parse-failed', async () => {
  const { main } = await codexReader();
  const root = fixture();
  const { code, out } = run(main, ['--json', '--root', root], root);
  assert.equal(code, 0, out);
  const tasks = byTask(JSON.parse(out).rows);
  assert.deepEqual(
    [tasks.review_tok1_1.status, tasks.review_tok1_1.subjectKey, tasks.review_tok1_1.verdict],
    ['parse-failed', 'dispatch:tok1', null],
  );
});

test('a legacy-only record exits 0 and a current violation exits 1 for Codex as for Claude', async () => {
  const { main } = await codexReader();
  const root = fixture();
  writeFileSync(
    resolve(root, 'evidence/r1-adjudication.json'),
    JSON.stringify({
      schema: 'review-adjudication/v1',
      subject: 'codex-feature',
      round: 1,
      reviews: [{ taskId: 'review_tok1_1', resultPath: 'evidence/r1-result.json' }],
      findings: [{ id: 'review_tok1_1#0', severity: 'medium', disposition: 'fixed' }],
    }),
  );
  let { code, out } = run(main, ['--json', '--root', root, '--adjudications', 'evidence'], root);
  assert.equal(code, 0, out);
  assert.deepEqual(JSON.parse(out).legacyAdjudications, {
    records: 1,
    reasons: { 'missing-fix-ref': 1 },
  });
  // A finding left without a disposition breaks a current rule.
  writeFileSync(
    resolve(root, 'evidence/r1-adjudication.json'),
    JSON.stringify({
      schema: 'review-adjudication/v1',
      subject: 'codex-feature',
      round: 1,
      reviews: [{ taskId: 'review_tok1_1', resultPath: 'evidence/r1-result.json' }],
      findings: [],
    }),
  );
  ({ code, out } = run(main, ['--json', '--root', root, '--adjudications', 'evidence'], root));
  assert.equal(code, 1);
  assert.deepEqual(
    JSON.parse(out).adjudicationViolations.map(({ kind, id }) => `${kind}:${id}`),
    ['missing-finding:review_tok1_1#0'],
  );
});

test('until leaves out every Codex row, since a registration has no issue time, and counts them', async () => {
  const { main } = await codexReader();
  const root = fixture();
  const { code, out } = run(
    main,
    ['--json', '--root', root, '--until', '2026-12-01T00:00:00.000Z'],
    root,
  );
  assert.equal(code, 0, out);
  const parsed = JSON.parse(out);
  assert.deepEqual(parsed.rows, []);
  assert.equal(parsed.excludedWithoutIssuedAt, 4);
});

test('input errors exit 2 and the command line prints the summary', async () => {
  const { main } = await codexReader();
  const root = fixture();
  const empty = mkdtempSync(resolve(tmpdir(), 'codex-review-ledger-empty-'));
  temporary.push(empty);
  for (const [argv, cwd] of [
    [['--root', root, '--until', 'yesterday'], root],
    [['--root', root, '--adjudications', 'absent'], root],
    [['--root', root, '--bogus'], root],
    [['--root', empty], empty],
  ]) {
    const { code, err } = run(main, argv, cwd);
    assert.equal(code, 2, argv.join(' '));
    assert.ok(err.length > 0, argv.join(' '));
  }
  const cli = spawnSync(process.execPath, [tool, '--root', root, '--adjudications', 'evidence'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, KNU_ARTIFACTS_DIR: '' },
  });
  assert.equal(cli.status, 0, cli.stderr);
  assert.match(cli.stdout, /^count 4$/mu);
  assert.match(cli.stdout, /^hosts \{"codex":4\}$/mu);
});
