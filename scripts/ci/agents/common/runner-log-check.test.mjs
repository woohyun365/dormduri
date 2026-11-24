import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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

// P6 ③: one log, one record per summary, so each record's message is judged against the same result lines.
function stepsRoot(lines, summaries) {
  const root = fixture({
    runner: 'parent',
    records: summaries.map((observedResult) =>
      record({ outputPaths: ['logs/steps.log'], observedResult }),
    ),
  });
  writeFileSync(resolve(root, 'logs/steps.log'), `${[HEADER, ...lines].join('\n')}\n`);
  return root;
}
const checkJson = (root) =>
  run(['--json', '--evidence', 'evidence.json', '--header', HEADER], root);

// The log a runner left: a labeled count, a PR number, a label made of hex letters, a word after a dot, a digest line
// and a plain result word.
const SHAPE_LINES = [
  '$ node --test a.test.mjs',
  'ℹ pass 41',
  'merged PR #961 into dev',
  'bad=0 ok=3',
  'x.concat(y) returned',
  `basis sha256:${'a'.repeat(64)} install 42`,
  'Result: PASS',
  'exit=0',
];

test('a rejected fragment names its reason and the fragment shape the log line holds (P6 ③ RED 1)', () => {
  const { code, out } = checkJson(
    stepsRoot(SHAPE_LINES, [
      'count only `41`',
      'number only `#961`',
      'hex letters as a label `bad=0`',
      'word after a dot `concat`',
      'cut count `ℹ pass 4`',
      'digest line only `install 42`',
      'emphasis `**PASS**`',
      'unpaired `ℹ pass 41',
    ]),
  );
  assert.equal(code, 1);
  const { violations } = json(out);
  assert.deepEqual(
    violations.map(({ record: index, kind, suggestion }) => [index, kind, suggestion]),
    [
      [0, 'invalid-fragment', 'pass 41'],
      [1, 'invalid-fragment', 'PR #961'],
      [2, 'invalid-fragment', 'bad=0 ok=3'],
      [3, 'summary-mismatch', 'x.concat(y)'],
      [4, 'summary-mismatch', 'ℹ pass 41'],
      [5, 'summary-mismatch', undefined],
      [6, 'summary-mismatch', 'PASS'],
      [7, 'invalid-fragment', undefined],
    ],
  );
  const detail = (index) => violations.find(({ record: at }) => at === index).detail;
  assert.match(detail(0), /label/u, 'an unlabeled fragment needs the label printed with it');
  assert.match(detail(3), /token/u, 'a fragment must start and end at a token boundary');
  assert.match(detail(4), /token/u);
  assert.match(detail(5), /digest/u, 'a digest line is not a result line');
  assert.match(detail(6), /emphasis/u, 'Markdown emphasis is not in the log');
  assert.match(detail(7), /backtick/u, 'an odd backtick count cannot be split');
  // The text output carries the suggested fragment too.
  const text = run(
    ['--evidence', 'evidence.json', '--header', HEADER],
    stepsRoot(SHAPE_LINES, ['count only `41`']),
  );
  assert.equal(text.code, 1);
  assert.ok(text.out.includes('`pass 41`'), text.out);
});

// P6 ③ operator mutation sweep: cases the RED 1 test left unguarded (sweep/survivors.md).
test('fragment messages keep every fragment, the pair rule, the first line and the text columns', () => {
  const lines = [...SHAPE_LINES, '73 / 88 done'];
  const { violations } = json(
    checkJson(
      stepsRoot(lines, [
        'label after it `88`',
        'no labeled pair `73`',
        'spaced `73 /`',
        'empty then unlabeled `` and `41`',
        'three backticks `a` b `c',
      ]),
    ).out,
  );
  assert.deepEqual(
    violations.map(({ record: index, kind, fragment, suggestion }) => [
      index,
      kind,
      fragment,
      suggestion,
    ]),
    [
      [0, 'invalid-fragment', '88', '88 done'],
      [1, 'invalid-fragment', '73', undefined],
      [2, 'invalid-fragment', '73 /', undefined],
      [3, 'invalid-fragment', '', undefined],
      [3, 'invalid-fragment', '41', 'pass 41'],
      [4, 'invalid-fragment', undefined, undefined],
    ],
  );
  assert.match(violations[5].detail, /backtick count 3 is odd/u);
  // The first line of a log is the header slot, never a result line, even when it is not the header.
  const root = fixture({
    runner: 'parent',
    records: [record({ outputPaths: ['logs/noheader.log'], observedResult: '`Result: PASS`' })],
  });
  writeFileSync(resolve(root, 'logs/noheader.log'), 'Result: PASS\nexit=0\n');
  assert.deepEqual(kinds(checkJson(root).out), [
    [0, 'header-mismatch'],
    [0, 'summary-mismatch'],
  ]);
  // The text output names the rejected fragment in its own column.
  const text = run(
    ['--evidence', 'evidence.json', '--header', HEADER],
    stepsRoot(SHAPE_LINES, ['count only `41`']),
  );
  assert.ok(text.out.includes('\tinvalid-fragment\t`41`\t'), text.out);
});

test('a positional evidence argument is refused with the option usage (P6 ③ RED 1)', () => {
  const { code, err } = run(['evidence.json'], fixture({ runner: 'parent', records: [record()] }));
  assert.equal(code, 2);
  assert.ok(err.includes('--evidence <JSON> --header "<logHeader>"'), err);
});

// P6 ③ RED 2: a zero-hit search exit (`rg exit=1`) claims an absence; the same record needs the positive control that
// shows the search can hit (`control rg exit=0`). Without one the check warns and keeps its exit.
const ABSENCE_LINES = [
  '$ rg -n old-term docs',
  'rg exit=1',
  '$ git grep -n old-term -- docs',
  'git grep exit=1',
  '$ rg -n old-term docs # the revision before the change',
  'control rg exit=0',
  'exit=0',
];

test('a zero-hit search fragment without a positive control is a warning that keeps the exit (P6 ③ RED 2)', () => {
  const root = stepsRoot(ABSENCE_LINES, [
    'absent `rg exit=1`',
    'absent `rg exit=1`, found before the change `control rg exit=0`',
    'absent `git grep exit=1`',
    'no search fragment `exit=0`',
  ]);
  const { code, out } = checkJson(root);
  assert.equal(code, 0, out);
  const result = json(out);
  assert.deepEqual(result.violations, []);
  assert.ok(Array.isArray(result.warnings), 'the JSON output lists warnings');
  assert.deepEqual(
    result.warnings.map(({ record: index, kind, fragment }) => [index, kind, fragment]),
    [
      [0, 'absence-without-control', 'rg exit=1'],
      [2, 'absence-without-control', 'git grep exit=1'],
    ],
  );
  assert.match(result.warnings[0].detail, /control rg exit=0/u, 'the warning names the control');
  const text = run(['--evidence', 'evidence.json', '--header', HEADER], root);
  assert.equal(text.code, 0);
  assert.ok(text.out.includes('absence-without-control'), text.out);
  // A violation in the same record still decides the exit.
  const failing = checkJson(stepsRoot(ABSENCE_LINES, ['absent `rg exit=1` and `rg exit=2`']));
  assert.equal(failing.code, 1);
  assert.deepEqual(
    json(failing.out).violations.map(({ kind }) => kind),
    ['summary-mismatch'],
  );
  assert.equal(json(failing.out).warnings?.length, 1);
});

// P6 ③ review round 1 (m1-F3·m2-F4, m2-F3): a suggestion copies the token the fragment is a token of, not the first
// token holding it as a substring, and a backtick of the log line is not part of a suggestion.
test('a suggestion copies the token that holds the fragment as a token and leaves out backticks', () => {
  const lines = [
    'id 141 count 41',
    'mutations=118 killed=117 timeout=1 survived=0',
    'called `y.join(z)` ok',
    'merged `PR #962` ok',
    'skipped=2 total',
  ];
  const { violations } = json(
    checkJson(
      stepsRoot(lines, [
        'count `41`',
        'timeouts `1`',
        'word after a dot `join`',
        'number only `#962`',
        'first token `2`',
      ]),
    ).out,
  );
  assert.deepEqual(
    violations.map(({ record: index, kind, suggestion }) => [index, kind, suggestion]),
    [
      [0, 'invalid-fragment', 'count 41'],
      [1, 'invalid-fragment', 'timeout=1'],
      [2, 'summary-mismatch', 'y.join(z)'],
      [3, 'invalid-fragment', 'PR #962'],
      [4, 'invalid-fragment', 'skipped=2'],
    ],
  );
  // Each suggestion passes as the fragment of the same log.
  const { code } = checkJson(
    stepsRoot(
      lines,
      violations.map(({ suggestion }) => `\`${suggestion}\``),
    ),
  );
  assert.equal(code, 0);
});

// OSS-RL P5 RED 3·8: a carried record (`carriedFrom`, the review id of the round that made its log) is taken only with a
// carry basis that names that round (C1), when the producing round's runner file holds the same record and its outputs
// are unchanged (C2), its log starts with that round's header (C3), the round diff since that round is changed `.md`
// files only (C4) and no tracked `scripts/` file names a changed document by path or file name (C5).
const PRODUCED = 'aaaaaaaa-11111111';
const OTHER_ROUND = 'cccccccc-33333333';
const DIGEST_BEFORE = `sha256:${'1'.repeat(64)}`;
const HEADER_BEFORE = `KNU review snapshot ${DIGEST_BEFORE}`;
const HEADER_OTHER = `KNU review snapshot sha256:${'3'.repeat(64)}`;
const OUTPUT_DIGEST = `sha256:${'9'.repeat(64)}`;
const CARRY_LOG = [
  '$ node --test scripts/ci/sample.test.mjs',
  '✔ alpha works (1.25ms)',
  '✔ beta works (3ms)',
  'ℹ tests 2',
  'ℹ suites 0',
  'ℹ pass 2',
  'ℹ fail 0',
  'ℹ duration_ms 12.5',
  '    at file:///tmp/clone-1/scripts/ci/sample.test.mjs:4:1',
  'exit=0',
];
const carried = (fields = {}) =>
  record({
    command: 'node --test scripts/ci/sample.test.mjs',
    observedResult: 'suite passes `ℹ pass 2`',
    outputPaths: ['logs/carried.log'],
    carriedFrom: PRODUCED,
    ...fields,
  });
const producedRound = (patch = {}) => ({
  header: HEADER_BEFORE,
  commands: ['node --test scripts/ci/sample.test.mjs'],
  commandsActuallyRun: [
    {
      runner: 'parent',
      exit: 0,
      observedResult: 'suite passes `ℹ pass 2`',
      environment: 'node v24',
      outputPaths: ['logs/carried.log'],
    },
  ],
  outputDigests: { 'logs/carried.log': { produced: OUTPUT_DIGEST, current: OUTPUT_DIGEST } },
  roundDiff: [{ path: 'docs/note.md', created: false, deleted: false }],
  ...patch,
});
// A repository with the carried log (made in round PRODUCED), tracked scripts and a carry basis.
function carryRoot(
  records,
  { basis = { [PRODUCED]: producedRound() }, scripts = {}, logHeader = HEADER_BEFORE } = {},
) {
  const root = fixture({ runner: 'parent', records });
  writeFileSync(resolve(root, 'logs/carried.log'), `${[logHeader, ...CARRY_LOG].join('\n')}\n`);
  mkdirSync(resolve(root, 'scripts'));
  mkdirSync(resolve(root, 'docs'));
  writeFileSync(resolve(root, 'docs/note.md'), '# note\n');
  writeFileSync(resolve(root, 'scripts/plain.mjs'), 'export const unrelated = true;\n');
  for (const [path, text] of Object.entries(scripts)) writeFileSync(resolve(root, path), text);
  execFileSync('git', ['add', '.'], { cwd: root });
  if (basis !== null)
    writeFileSync(
      resolve(root, 'basis.json'),
      JSON.stringify({ schema: 'claude-review-carry-basis/v1', rounds: basis }),
    );
  return root;
}
const carryCheck = (root, extra = ['--carry-basis', 'basis.json']) =>
  run(['--json', '--evidence', 'evidence.json', '--header', HEADER, ...extra], root);
const carryKinds = (out) => json(out).violations.map(({ kind }) => kind);

test('a carried record that meets C1 to C5 has no violation and an uncarried record keeps its rules (OSS-RL P5 RED 3)', () => {
  const root = carryRoot([carried(), record()]);
  const { code, out } = carryCheck(root);
  assert.equal(code, 0, out);
  assert.deepEqual(json(out).violations, []);
  // The carried record still needs this round's digest; its log keeps the producing round's header.
  const wrongDigest = carryCheck(carryRoot([carried({ sourceDigest: DIGEST_BEFORE })]));
  assert.deepEqual(carryKinds(wrongDigest.out), ['digest-mismatch']);
});

test('C1: a carried record without a basis or whose round the basis lacks is carry-basis-missing (OSS-RL P5 RED 3·8)', () => {
  // RED 8: the Codex path runs the check without --carry-basis.
  const without = carryCheck(carryRoot([carried()], { basis: null }), []);
  assert.equal(without.code, 1, without.out);
  assert.deepEqual(carryKinds(without.out), ['carry-basis-missing']);
  const other = carryCheck(carryRoot([carried()], { basis: { [OTHER_ROUND]: producedRound() } }));
  assert.equal(other.code, 1, other.out);
  assert.deepEqual(carryKinds(other.out), ['carry-basis-missing']);
});

test('C2: a carried record that differs from the producing round runner file or whose output changed is carried-record-mismatch (OSS-RL P5 RED 3)', () => {
  const run1 = producedRound().commandsActuallyRun[0];
  for (const [label, records, round] of [
    ['no runner file record of that name', [carried({ label: 'renamed' })], producedRound()],
    ['exit', [carried({ exit: 1 })], producedRound()],
    ['observedResult', [carried({ observedResult: 'suite passes `ℹ tests 2`' })], producedRound()],
    ['environment', [carried({ environment: 'node v26' })], producedRound()],
    [
      'outputPaths',
      [carried()],
      producedRound({ commandsActuallyRun: [{ ...run1, outputPaths: ['logs/other.log'] }] }),
    ],
    ['purpose and expectedExit', [carried({ purpose: 'red', expectedExit: 1 })], producedRound()],
    [
      'expectedExit',
      [carried({ purpose: 'red', expectedExit: 1, exit: 0 })],
      producedRound({
        commandsActuallyRun: [{ ...run1, purpose: 'red', expectedExit: 2 }],
      }),
    ],
    [
      'a log line changed after the producing round',
      [carried()],
      producedRound({
        outputDigests: {
          'logs/carried.log': { produced: OUTPUT_DIGEST, current: `sha256:${'8'.repeat(64)}` },
        },
      }),
    ],
    [
      'an output the producing round did not bind',
      [carried()],
      producedRound({ outputDigests: {} }),
    ],
  ]) {
    const { code, out } = carryCheck(carryRoot(records, { basis: { [PRODUCED]: round } }));
    assert.equal(code, 1, `${label}: ${out}`);
    assert.ok(carryKinds(out).includes('carried-record-mismatch'), `${label}: ${out}`);
  }
});

test('C3: a carried log whose first line is not the producing round header is carried-header-mismatch (OSS-RL P5 RED 3)', () => {
  // The log was made in another round.
  const other = carryCheck(carryRoot([carried()], { logHeader: HEADER_OTHER }));
  assert.equal(other.code, 1, other.out);
  assert.deepEqual(carryKinds(other.out), ['carried-header-mismatch']);
  // carriedFrom names a round that did not make the log.
  const notProducer = carryCheck(
    carryRoot([carried({ carriedFrom: OTHER_ROUND })], {
      basis: {
        [OTHER_ROUND]: producedRound({ header: HEADER_OTHER }),
      },
    }),
  );
  assert.equal(notProducer.code, 1, notProducer.out);
  assert.deepEqual(carryKinds(notProducer.out), ['carried-header-mismatch']);
});

test('C4: a round diff with a non-.md path, a new .md or a removed .md is carry-round-diff-not-docs (OSS-RL P5 RED 3)', () => {
  for (const [label, roundDiff] of [
    ['a .json path', [{ path: 'scripts/fixture.json', created: false, deleted: false }]],
    ['a new .md', [{ path: 'docs/new.md', created: true, deleted: false }]],
    ['a removed .md', [{ path: 'docs/gone.md', created: false, deleted: true }]],
  ]) {
    const { code, out } = carryCheck(
      carryRoot([carried()], { basis: { [PRODUCED]: producedRound({ roundDiff }) } }),
    );
    assert.equal(code, 1, `${label}: ${out}`);
    assert.deepEqual(carryKinds(out), ['carry-round-diff-not-docs'], label);
  }
});

test('C5: a tracked scripts file naming a changed document by path or file name is carry-doc-referenced (OSS-RL P5 RED 3)', () => {
  for (const [label, scripts] of [
    ['path', { 'scripts/reads-path.mjs': "readFileSync('docs/note.md');\n" }],
    ['file name', { 'scripts/reads-name.mjs': "const name = 'note.md';\n" }],
  ]) {
    const { code, out } = carryCheck(carryRoot([carried()], { scripts }));
    assert.equal(code, 1, `${label}: ${out}`);
    const [violation] = json(out).violations;
    assert.equal(violation.kind, 'carry-doc-referenced', label);
    assert.match(violation.detail, /docs\/note\.md/u, label);
  }
});

// OSS-RL P5 RED 5 (the comparison unit): the confirm run of each carried record must exist under the same record name,
// pass this round's runner record check, keep the exit, hold every carried fragment and the same test result lines
// (name lines with durations masked and the summary counts); lines outside that unit are not compared.
const CARRY_RECORD = {
  schema: 'claude-review-carry/v1',
  reviewId: 'bbbbbbbb-22222222',
  header: HEADER,
  confirmPath: 'confirm/evidence.json',
  records: [
    {
      recordName: 'node --test scripts/ci/sample.test.mjs',
      carriedFrom: PRODUCED,
      exit: 0,
      observedResult: 'suite passes `ℹ pass 2`',
      outputPaths: ['logs/carried.log'],
    },
  ],
};
function confirmRoot({ lines = CARRY_LOG, header = HEADER, confirm = {}, carry = {} } = {}) {
  const root = carryRoot([carried()]);
  mkdirSync(resolve(root, 'confirm'));
  writeFileSync(resolve(root, 'logs/confirm.log'), `${[header, ...lines].join('\n')}\n`);
  writeFileSync(
    resolve(root, 'carry.json'),
    JSON.stringify({ ...CARRY_RECORD, records: [{ ...CARRY_RECORD.records[0], ...carry }] }),
  );
  writeFileSync(
    resolve(root, 'confirm/evidence.json'),
    JSON.stringify({
      runner: 'parent',
      records: [
        record({
          command: 'node --test scripts/ci/sample.test.mjs',
          observedResult: 'suite passes `ℹ pass 2`',
          outputPaths: ['logs/confirm.log'],
          ...confirm,
        }),
      ],
    }),
  );
  return root;
}
const confirmCheck = (root) =>
  run(
    [
      '--json',
      '--confirm',
      'carry.json',
      '--evidence',
      'confirm/evidence.json',
      '--header',
      HEADER,
    ],
    root,
  );
const reasonsOf = (out) => json(out).reasons;
const replaced = (from, to) => CARRY_LOG.map((line) => (line === from ? to : line));

test('the confirm comparison has no reason when only times, stack lines or nothing differ (OSS-RL P5 RED 5)', () => {
  for (const [label, lines] of [
    ['all the same', CARRY_LOG],
    [
      'times only',
      replaced('✔ alpha works (1.25ms)', '✔ alpha works (9.5ms)').map((line) =>
        line === 'ℹ duration_ms 12.5' ? 'ℹ duration_ms 40.1' : line,
      ),
    ],
    [
      'stack trace clone path only',
      replaced(
        '    at file:///tmp/clone-1/scripts/ci/sample.test.mjs:4:1',
        '    at file:///tmp/clone-2/scripts/ci/sample.test.mjs:4:1',
      ),
    ],
  ]) {
    const { code, out } = confirmCheck(confirmRoot({ lines }));
    assert.equal(code, 0, `${label}: ${out}`);
    assert.deepEqual(reasonsOf(out), [], label);
  }
});

test('the confirm comparison names the carried record that is missing or differs (OSS-RL P5 RED 5)', () => {
  const name = 'node --test scripts/ci/sample.test.mjs';
  for (const [label, options, reason] of [
    [
      'no confirm record of that name',
      { confirm: { label: 'other run' } },
      `carry-confirm-missing: ${name}`,
    ],
    [
      'exit differs',
      { confirm: { exit: 1 }, lines: replaced('exit=0', 'exit=1') },
      `carry-confirm-mismatch: ${name}`,
    ],
    [
      'a carried fragment is not in the confirm log',
      {
        lines: replaced('ℹ pass 2', 'ℹ pass 1'),
        confirm: { observedResult: 'suite passes `ℹ pass 1`' },
      },
      `carry-confirm-mismatch: ${name}`,
    ],
    [
      // Only the fragment differs: the test result lines and the exit are the same.
      'a carried fragment on a line outside the test result lines is not in the confirm log',
      {
        lines: replaced(
          '$ node --test scripts/ci/sample.test.mjs',
          '$ node --test scripts/ci/other.test.mjs',
        ),
        carry: { observedResult: 'suite runs `--test scripts/ci/sample.test.mjs`' },
      },
      `carry-confirm-mismatch: ${name}`,
    ],
    [
      'a test turns from pass to fail',
      { lines: replaced('✔ beta works (3ms)', '✖ beta works (3ms)') },
      `carry-confirm-mismatch: ${name}`,
    ],
    [
      'a test name changes',
      { lines: replaced('✔ beta works (3ms)', '✔ beta renamed (3ms)') },
      `carry-confirm-mismatch: ${name}`,
    ],
    [
      'a summary count differs',
      { lines: replaced('ℹ suites 0', 'ℹ suites 1') },
      `carry-confirm-mismatch: ${name}`,
    ],
    [
      'the confirm log does not start with this round header',
      { header: HEADER_BEFORE },
      `carry-confirm-mismatch: ${name}`,
    ],
  ]) {
    const { code, out } = confirmCheck(confirmRoot(options));
    assert.equal(code, 1, `${label}: ${out}`);
    assert.ok(reasonsOf(out)?.includes(reason), `${label}: ${out}`);
  }
});
