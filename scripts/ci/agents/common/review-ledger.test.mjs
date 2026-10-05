import assert from 'node:assert/strict';
import test from 'node:test';

import { buildLedger } from '../../../agents/common/review-ledger.mjs';

const row = (fields) => ({
  host: 'test-host',
  taskId: 't',
  issuedAt: '2026-10-01T00:00:00.000Z',
  subjectKey: 'subject-a',
  round: null,
  status: 'parsed',
  verdict: 'FAIL',
  findings: [],
  adjudication: { status: 'missing', dispositions: [], origins: [] },
  ...fields,
});

const finding = (id, severity, criteriaItem = null) => ({ id, severity, criteriaItem });

const ROWS = [
  row({
    taskId: 't1',
    round: 1,
    findings: [
      finding('t1#0', 'medium', 'documents.md D2'),
      finding('t1#1', 'low'),
      finding('t1#2', 'low'),
    ],
    adjudication: {
      status: 'recorded',
      dispositions: ['fixed', 'rejected', 'deferred'],
      origins: [],
    },
  }),
  row({
    taskId: 't2',
    round: 2,
    findings: [finding('t2#0', 'medium')],
    adjudication: { status: 'recorded', dispositions: ['fixed'], origins: ['fix-induced'] },
  }),
  row({ taskId: 't3', round: 3, verdict: 'PASS', subjectKey: 'subject-a' }),
  row({
    taskId: 't4',
    subjectKey: 'subject-b',
    verdict: 'PASS',
    findings: [finding('t4#0', 'low')],
  }),
  row({ taskId: 't5', subjectKey: 'subject-b', status: 'completion-missing', verdict: null }),
  row({ taskId: 't6', subjectKey: 'subject-b', status: 'parse-failed', verdict: null }),
  row({
    taskId: 't7',
    subjectKey: 'subject-c',
    verdict: 'FAIL',
    findings: [finding('t7#0', 'high'), finding('t7#1', 'medium')],
    adjudication: { status: 'invalid', dispositions: [], origins: [] },
  }),
];

test('the ledger counts statuses, verdicts, severities, rounds, dispositions and origins from parsed rows', () => {
  const ledger = buildLedger(ROWS);
  assert.deepEqual(ledger.rejected, []);
  assert.deepEqual(ledger.summary, {
    count: 7,
    subjects: 3,
    statuses: { parsed: 5, 'completion-missing': 1, 'parse-failed': 1 },
    verdicts: { FAIL: 3, PASS: 2 },
    severity: { medium: 3, low: 3, high: 1 },
    criteriaItems: { 'documents.md D2': 1 },
    zeroFindingRuns: 1,
    findingsMedian: 1,
    findingsMean: 1.4,
    rounds: { 1: 1, 2: 1, 3: 1, unknown: 4 },
    adjudication: { recorded: 2, invalid: 1, missing: 4 },
    dispositions: { fixed: 2, rejected: 1, deferred: 1 },
    origins: { 'fix-induced': 1 },
  });
  assert.equal(ledger.rows.length, 7);
});

// Historical results may carry severities outside today's enum (for example `info`); the ledger counts them as
// recorded instead of dropping the row.
test('a severity outside the current enum is counted as recorded', () => {
  const ledger = buildLedger([row({ taskId: 'old', findings: [finding('old#0', 'info')] })]);
  assert.deepEqual(ledger.rejected, []);
  assert.deepEqual(ledger.summary.severity, { info: 1 });
});

test('malformed rows are rejected with a reason and left out of every count', () => {
  const ledger = buildLedger([
    ROWS[0],
    row({ taskId: '' }),
    row({ taskId: 'bad-status', status: 'done' }),
    row({ taskId: 'bad-severity', findings: [finding('x#0', '')] }),
    row({ taskId: 'bad-round', round: 0 }),
    row({ taskId: 'bad-adjudication', adjudication: { status: 'recorded' } }),
    row({ taskId: 'parsed-without-verdict', verdict: null }),
    'not a row',
  ]);
  assert.deepEqual(
    ledger.rejected.map(({ index }) => index),
    [1, 2, 3, 4, 5, 6, 7],
  );
  assert.ok(ledger.rejected.every(({ reason }) => typeof reason === 'string' && reason.length > 0));
  assert.equal(ledger.summary.count, 1);
  assert.equal(ledger.rows.length, 1);
});

test('the median of an even number of runs is the upper middle value', () => {
  const rows = [0, 3, 1, 2].map((size, index) =>
    row({
      taskId: `m${index}`,
      findings: Array.from({ length: size }, (_, item) => finding(`m${index}#${item}`, 'low')),
    }),
  );
  assert.equal(buildLedger(rows).summary.findingsMedian, 2);
});

test('an empty ledger has zero counts instead of failing', () => {
  const { summary } = buildLedger([]);
  assert.equal(summary.count, 0);
  assert.equal(summary.findingsMedian, null);
  assert.equal(summary.findingsMean, null);
});
