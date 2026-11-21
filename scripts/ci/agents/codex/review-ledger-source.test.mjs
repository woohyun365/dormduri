import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

import { readClaudeReviewRows } from '../../../agents/claude/review-ledger-source.mjs';
import { buildLedger } from '../../../agents/common/review-ledger.mjs';

const tool = resolve(import.meta.dirname, '../../../agents/codex/review-ledger-source.mjs');
// Loaded inside each test so a missing module fails that test with its own reason.
const codexReader = () => import('../../../agents/codex/review-ledger-source.mjs');
const temporary = [];
test.after(() => temporary.forEach((path) => rmSync(path, { recursive: true, force: true })));

const DIGEST = `sha256:${'a'.repeat(64)}`;
const SESSION = '01a124c1-ca31-7533-9568-76dd35726310';
const registration = (round, accepted = true) => ({
  schema: 'knu-codex-task-registration/v1',
  sessionId: SESSION,
  taskName: `review_tok1_${round}`,
  kind: 'review',
  reviewId: `review-tok1-${round}`,
  dispatchToken: 'tok1',
  round,
  reviewOf: ['lane-a'],
  spawnArguments: {
    task_name: `review_tok1_${round}`,
    agent_type: 'knu_reviewer',
    model: 'gpt-6-astra',
    reasoning_effort: 'xhigh',
    fork_turns: 'none',
  },
  accepted,
});
const snapshot = (head) => ({
  baseSHA: head,
  headSHA: head,
  dirtyDiffDigest: null,
  untrackedInputDigests: [],
});
const result = (verdict, findings, head) => ({
  schemaVersion: 'cross-model-handoff/v1',
  packetId: 'review-tok1',
  status: 'complete',
  reviewedSnapshot: snapshot(head),
  verdict,
  findings,
  acceptanceCoverage: [],
});
const finding = {
  severity: 'medium',
  location: 'a.mjs:1',
  impact: 'i',
  reproduction: 'r',
  evidence: 'e',
  criteriaItem: 'documents.md D2',
};

// The Codex registry of one Parent session: review rounds 1 and 2 accepted (their results and dispositions are in the
// plan evidence, as the Parent saves them), round 3 registered and never accepted, a lane task that is no review,
// and a registration that cannot be read. Round 1 has a criteria record beside the registrations.
function fixture() {
  const root = mkdtempSync(resolve(tmpdir(), 'codex-review-ledger-'));
  temporary.push(root);
  const write = (path, value) => {
    mkdirSync(dirname(resolve(root, path)), { recursive: true });
    writeFileSync(resolve(root, path), typeof value === 'string' ? value : JSON.stringify(value));
  };
  const registry = `.artifacts/tools/codex-native/${SESSION}`;
  for (const round of [1, 2, 3]) {
    const { accepted, ...record } = registration(round, round < 3);
    write(`${registry}/review_tok1_${round}.json`, record);
    if (accepted)
      write(`${registry}/review_tok1_${round}.accepted.json`, {
        schema: 'knu-codex-task-acceptance/v1',
        sessionId: SESSION,
        taskName: `review_tok1_${round}`,
        kind: 'review',
        agentId: `agent-${round}`,
        stopDigest: DIGEST,
        registrationDigest: DIGEST,
        acceptedAt: `2026-10-10T0${round}:00:00.000Z`,
      });
  }
  write(`${registry}/lane_x.json`, { ...registration(1), kind: 'lane', taskName: 'lane_x' });
  write(`${registry}/broken.json`, '{ "schema": ');
  write(`${registry}/review-tok1-1.criteria.json`, {
    schema: 'review-criteria-selection/v1',
    paths: ['a.mjs', 'docs/b.md'],
    documents: [],
    documentCount: 1,
    itemCount: 0,
  });
  write('evidence/r1-result.json', result('FAIL', [finding], 'a'.repeat(40)));
  write('evidence/r1-adjudication.json', {
    schema: 'review-adjudication/v1',
    subject: 'codex-feature',
    round: 1,
    reviews: [{ taskId: 'review_tok1_1', resultPath: 'evidence/r1-result.json' }],
    findings: [{ id: 'review_tok1_1#0', severity: 'medium', disposition: 'fixed', fixRef: DIGEST }],
  });
  write('evidence/r2-result.json', result('PASS', [], 'b'.repeat(40)));
  write('evidence/r2-adjudication.json', {
    schema: 'review-adjudication/v1',
    subject: 'codex-feature',
    round: 2,
    reviews: [{ taskId: 'review_tok1_2', resultPath: 'evidence/r2-result.json' }],
    findings: [],
  });
  return root;
}

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

test('the common summary counts Claude and Codex rows together (P6 ② RED 5)', async () => {
  const { readCodexReviewRows } = await codexReader();
  const root = fixture();
  const claudeRoot = resolve(import.meta.dirname, '../claude/fixtures/review-ledger');
  const claude = readClaudeReviewRows({
    root: claudeRoot,
    registry: resolve(claudeRoot, '.artifacts/tools/claude-native'),
    adjudicationDirectories: [resolve(claudeRoot, 'evidence')],
  });
  const codex = readCodexReviewRows({
    root,
    registry: resolve(root, '.artifacts/tools/codex-native'),
    adjudicationDirectories: [resolve(root, 'evidence')],
  });
  const ledger = buildLedger([...claude.rows, ...codex.rows]);
  assert.deepEqual(ledger.rejected, []);
  assert.deepEqual(ledger.summary.hosts, { claude: claude.rows.length, codex: 4 });
  assert.equal(ledger.summary.count, claude.rows.length + 4);
  // The Codex subject: round 1 FAIL then round 2 PASS on another snapshot, sized by its round 1 criteria record.
  assert.deepEqual(
    ledger.summary.subjectRows.find(({ subjectKey }) => subjectKey === 'codex-feature'),
    {
      subjectKey: 'codex-feature',
      paths: 2,
      documents: 1,
      runs: 2,
      rounds: 2,
      origins: {},
      trailingNonPass: 0,
      snapshots: 2,
    },
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
