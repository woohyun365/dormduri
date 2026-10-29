import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

import { main } from '../../../agents/common/review-adjudication.mjs';

const tool = resolve(import.meta.dirname, '../../../agents/common/review-adjudication.mjs');
const temporary = [];
test.after(() => temporary.forEach((path) => rmSync(path, { recursive: true, force: true })));

const finding = (severity, extra = {}) => ({
  severity,
  location: 'a.mjs:1',
  impact: 'i',
  reproduction: 'r',
  evidence: 'e',
  ...extra,
});

// Round 1 had two reviewers: task-a reported two findings (ids task-a#0 and task-a#1), task-b one finding that carries
// its own id. Round 2 had one reviewer with one finding.
const RESULTS = {
  'review/r1-a-result.json': { verdict: 'FAIL', findings: [finding('medium'), finding('low')] },
  'review/r1-b-result.json': { verdict: 'FAIL', findings: [finding('medium', { id: 'b-dup' })] },
  'review/r2-result.json': { verdict: 'FAIL', findings: [finding('medium')] },
  'review/r1-c-result.json': { verdict: 'FAIL', findings: [finding('low', { id: 'b-dup' })] },
  'review/r1-u-result.json': {
    verdict: 'PASS',
    findings: [],
    unjudgedBehaviors: [
      { behavior: 'retry after a network error', reason: 'no requirement covers it' },
      { behavior: 'empty list order', reason: 'no decision record covers it' },
    ],
  },
};

const ROUND1 = {
  schema: 'review-adjudication/v1',
  subject: 'feature-x',
  round: 1,
  reviews: [
    { taskId: 'task-a', resultPath: 'review/r1-a-result.json' },
    { taskId: 'task-b', resultPath: 'review/r1-b-result.json' },
  ],
  findings: [
    { id: 'task-a#0', severity: 'medium', disposition: 'fixed', fixRef: 'abc1234' },
    { id: 'task-a#1', severity: 'low', disposition: 'rejected', reason: 'not reproduced' },
    { id: 'b-dup', severity: 'medium', disposition: 'fixed', duplicateOf: 'task-a#0' },
  ],
};

const ROUND2 = {
  schema: 'review-adjudication/v1',
  subject: 'feature-x',
  round: 2,
  reviews: [{ taskId: 'task-c', resultPath: 'review/r2-result.json' }],
  findings: [{ id: 'task-c#0', severity: 'medium', disposition: 'fixed', origin: 'fix-induced' }],
};

function fixture(records) {
  const root = mkdtempSync(resolve(tmpdir(), 'review-adjudication-'));
  temporary.push(root);
  mkdirSync(resolve(root, 'review'));
  for (const [path, value] of Object.entries(RESULTS))
    writeFileSync(resolve(root, path), JSON.stringify(value));
  for (const [path, value] of Object.entries(records))
    writeFileSync(resolve(root, path), typeof value === 'string' ? value : JSON.stringify(value));
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

function check(record) {
  const root = fixture({ 'review/x-adjudication.json': record });
  const { code, out } = run(['--json', '--root', root, 'review/x-adjudication.json'], root);
  return { code, kinds: json(out).violations.map(({ kind, id }) => (id ? `${kind}:${id}` : kind)) };
}

test('a multi-reviewer round 1 record and a round 2 record with origins pass', () => {
  const root = fixture({
    'review/r1-adjudication.json': ROUND1,
    'review/r2-adjudication.json': ROUND2,
  });
  const { code, out } = run(
    ['--json', '--root', root, 'review/r1-adjudication.json', 'review/r2-adjudication.json'],
    root,
  );
  assert.equal(code, 0);
  assert.deepEqual(json(out).summary, { files: 2, findings: 4, violations: 0 });
});

test('missing, repeated and unknown finding ids are violations', () => {
  const [a0, a1, b] = ROUND1.findings;
  assert.deepEqual(check({ ...ROUND1, findings: [a0, b] }), {
    code: 1,
    kinds: ['missing-finding:task-a#1'],
  });
  assert.deepEqual(check({ ...ROUND1, findings: [a0, a1, a1, b] }), {
    code: 1,
    kinds: ['duplicate-finding:task-a#1'],
  });
  assert.deepEqual(
    check({ ...ROUND1, findings: [...ROUND1.findings, { ...a0, id: 'task-a#2' }] }),
    { code: 1, kinds: ['unknown-finding:task-a#2'] },
  );
});

// One disposition must not cover two findings that happen to carry the same id.
test('a finding id that two results share is a violation', () => {
  assert.deepEqual(
    check({
      ...ROUND1,
      reviews: [...ROUND1.reviews, { taskId: 'task-c', resultPath: 'review/r1-c-result.json' }],
    }),
    { code: 1, kinds: ['duplicate-result-id:b-dup'] },
  );
});

test('dispositions, reasons, duplicates and origins follow the record rules', () => {
  const [a0, a1, b] = ROUND1.findings;
  for (const [findings, kinds] of [
    [[a0, { ...a1, reason: undefined }, b], ['missing-reason:task-a#1']],
    [[a0, { ...a1, disposition: 'deferred', reason: ' ' }, b], ['missing-reason:task-a#1']],
    [
      [{ ...a0, disposition: 'ignored' }, a1, b],
      ['invalid-field:task-a#0', 'invalid-duplicate:b-dup'],
    ],
    [[{ ...a0, severity: 'blocker' }, a1, b], ['invalid-field:task-a#0']],
    [[a0, a1, { ...b, duplicateOf: 'task-a#9' }], ['invalid-duplicate:b-dup']],
    [[a0, a1, { ...b, duplicateOf: 'b-dup' }], ['invalid-duplicate:b-dup']],
    [
      [a0, { ...a1, disposition: 'fixed', reason: undefined, duplicateOf: 'b-dup' }, b],
      ['invalid-duplicate:task-a#1'],
    ],
    [[a0, a1, { ...b, disposition: 'deferred', reason: 'later' }], ['invalid-duplicate:b-dup']],
    [[{ ...a0, orgin: 'fix-induced' }, a1, b], ['unknown-key:task-a#0']],
  ])
    assert.deepEqual(check({ ...ROUND1, findings }), { code: 1, kinds }, JSON.stringify(findings));
  const [c0] = ROUND2.findings;
  assert.deepEqual(check({ ...ROUND2, findings: [{ ...c0, origin: undefined }] }), {
    code: 1,
    kinds: ['missing-origin:task-c#0'],
  });
  assert.deepEqual(check({ ...ROUND2, findings: [{ ...c0, origin: 'new' }] }), {
    code: 1,
    kinds: ['invalid-field:task-c#0'],
  });
});

test('record fields and result files are checked', () => {
  for (const [record, kinds] of [
    [{ ...ROUND1, schema: 'review-adjudication/v2' }, ['invalid-field']],
    [{ ...ROUND1, subject: '' }, ['invalid-field']],
    [{ ...ROUND1, round: 0 }, ['invalid-field']],
    [{ ...ROUND1, reviews: [], findings: [] }, ['invalid-field']],
    [
      {
        ...ROUND1,
        reviews: [ROUND1.reviews[0], ROUND1.reviews[0]],
        findings: ROUND1.findings.slice(0, 2),
      },
      ['invalid-field'],
    ],
    [
      {
        ...ROUND1,
        reviews: [{ taskId: 'task-z', resultPath: 'review/absent.json' }],
        findings: [],
      },
      ['result-unreadable'],
    ],
    [{ ...ROUND1, notes: 'x' }, ['unknown-key']],
  ])
    assert.deepEqual(check(record).kinds, kinds, JSON.stringify(record));
});

test('input errors exit 2 instead of passing', () => {
  const root = fixture({ 'review/bad-adjudication.json': '{', 'review/list.json': '[]' });
  for (const argv of [
    ['--root', root],
    ['--root', root, 'review/absent-adjudication.json'],
    ['--root', root, 'review/bad-adjudication.json'],
    ['--root', root, 'review/list.json'],
    ['--root', root, '--bogus', 'review/r1-a-result.json'],
  ]) {
    const { code, err } = run(argv, root);
    assert.equal(code, 2, argv.join(' '));
    assert.ok(err.length > 0, argv.join(' '));
  }
});

test('the command line exits 1 on an invalid record and 0 on a valid one', () => {
  const root = fixture({
    'review/r1-adjudication.json': ROUND1,
    'review/x-adjudication.json': { ...ROUND1, findings: [] },
  });
  for (const [path, status] of [
    ['review/r1-adjudication.json', 0],
    ['review/x-adjudication.json', 1],
  ]) {
    const result = spawnSync(process.execPath, [tool, '--root', root, path], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(result.status, status, result.stderr);
  }
});

// A result's unjudged behavior lines are adjudicated one by one: `<taskId>#u<index>` takes out-of-scope, raised or
// follow-up with a reason, and a line left without a disposition is a violation.
const UNJUDGED = {
  schema: 'review-adjudication/v1',
  subject: 'feature-y',
  round: 1,
  reviews: [{ taskId: 'task-u', resultPath: 'review/r1-u-result.json' }],
  findings: [],
  unjudged: [
    { id: 'task-u#u0', disposition: 'out-of-scope', reason: 'the acceptance names no retry' },
    { id: 'task-u#u1', disposition: 'follow-up', reason: 'issue for the list order' },
  ],
};

test('every unjudged behavior line of a reviewed result needs one disposition with a reason', () => {
  assert.deepEqual(check(UNJUDGED), { code: 0, kinds: [] });
  assert.deepEqual(
    check({
      ...UNJUDGED,
      unjudged: [{ ...UNJUDGED.unjudged[0], disposition: 'raised' }, UNJUDGED.unjudged[1]],
    }),
    {
      code: 0,
      kinds: [],
    },
  );
  const [u0, u1] = UNJUDGED.unjudged;
  const withoutKey = { ...UNJUDGED };
  delete withoutKey.unjudged;
  for (const [record, kinds] of [
    [{ ...UNJUDGED, unjudged: [u0] }, ['missing-unjudged:task-u#u1']],
    [withoutKey, ['missing-unjudged:task-u#u0', 'missing-unjudged:task-u#u1']],
    [
      { ...UNJUDGED, unjudged: [u0, u1, { ...u1, id: 'task-u#u2' }] },
      ['unknown-unjudged:task-u#u2'],
    ],
    [{ ...UNJUDGED, unjudged: [u0, u1, u1] }, ['duplicate-unjudged:task-u#u1']],
    [{ ...UNJUDGED, unjudged: [{ ...u0, disposition: 'fixed' }, u1] }, ['invalid-field:task-u#u0']],
    [{ ...UNJUDGED, unjudged: [{ ...u0, reason: ' ' }, u1] }, ['missing-reason:task-u#u0']],
    [{ ...UNJUDGED, unjudged: [{ ...u0, severity: 'low' }, u1] }, ['unknown-key:task-u#u0']],
    [
      { ...UNJUDGED, unjudged: {} },
      ['invalid-field', 'missing-unjudged:task-u#u0', 'missing-unjudged:task-u#u1'],
    ],
  ])
    assert.deepEqual(check(record), { code: 1, kinds }, JSON.stringify(record));
  // A result without unjudged lines needs no key, and an empty list is allowed.
  assert.deepEqual(check({ ...ROUND2, unjudged: [] }), { code: 0, kinds: [] });
});
