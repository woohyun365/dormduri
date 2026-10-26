import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { defaultFiles, prBody } from './fixtures/policy-repo.mjs';
import { parseLifecycleSection } from './lifecycle-section.mjs';
import { buildLifecycleContext, evaluateLifecycle, LIFECYCLE_CHECKS } from './run.mjs';

const checkScript = fileURLToPath(new URL('./review-snapshot-check.mjs', import.meta.url));
const resultFixture = (name) =>
  fileURLToPath(new URL(`./fixtures/review-results/${name}`, import.meta.url));

const BASE = 'a'.repeat(40);
const MERGE_BASE = 'b'.repeat(40);
const HEAD = 'c'.repeat(40);
const EARLIER = 'd'.repeat(40);
const MISSING = 'e'.repeat(40);
const DIGEST = '1'.repeat(64);
const short = (sha) => sha.slice(0, 12);

const REVIEW_CHECKS = LIFECYCLE_CHECKS.filter((check) => check.name === 'review-snapshot');
const TRIGGER_PATHS = [
  'docs/development/agent-workflows/review-criteria/**',
  'scripts/agents/claude/native-task-helper.mjs',
  'scripts/agents/common/review-context-inputs.mjs',
  '.claude/agents/knu_reviewer.md',
  '.codex/agents/knu_reviewer.toml',
  '.agents/skills/knu-review/SKILL.md',
  'scripts/agents/claude/model-policy.mjs',
  'scripts/agents/codex/model-profiles.mjs',
];
const NO_TRIGGER = '재채점 trigger 경로 변경 없음';

// In-memory reader over the policy fixture files. commits maps each PASS head the repository has to the paths that differ
// between it and the PR head; diffError makes the comparison throw.
function reader({ commits = {}, diffError = null } = {}) {
  const files = defaultFiles();
  const known = { [BASE]: [], [MERGE_BASE]: [], [HEAD]: [], ...commits };
  return {
    readFile: (revision, path) => files[path] ?? null,
    listFiles: () => Object.keys(files).sort(),
    hasCommit: (revision) => Object.hasOwn(known, revision),
    diffPaths(from, to) {
      if (diffError) throw diffError;
      assert.equal(to, HEAD);
      return known[from];
    },
  };
}

function evaluate({ lifecycle, changedPaths = ['scripts/ci/example.mjs'], ...repository }) {
  const context = buildLifecycleContext({
    body: prBody({ lifecycle }),
    author: 'woohyun365',
    baseRef: 'dev',
    revisions: { base: BASE, mergeBase: MERGE_BASE, head: HEAD },
    changedPaths,
    reader: reader(repository),
  });
  const result = evaluateLifecycle(context, REVIEW_CHECKS);
  assert.equal(result.failed, false, 'the review snapshot checks only warn');
  return result;
}

const rows = (result, check) =>
  result.findings
    .filter((finding) => finding.check === check)
    .map((finding) => [finding.level, finding.reason]);
const passLine = ({
  id = 'c542b64e-32855c6a',
  head = HEAD,
  diff = 'none',
  untracked = 'none',
} = {}) => ['리뷰 PASS', `${id} base=${BASE} head=${head} diff=${diff} untracked=${untracked}`];
const section = (grade, ...lines) => [
  ['변경 등급', grade],
  ['등급 근거', '근거'],
  ['정책 도메인', '없음'],
  ...lines,
];

test('W-REVIEW passes when the last PASS line is the PR head without uncommitted changes', () => {
  const result = evaluate({ lifecycle: section('feature', passLine()) });

  assert.deepEqual(rows(result, 'W-REVIEW'), [
    ['pass', `리뷰 PASS c542b64e-32855c6a: PR head ${short(HEAD)}와 같음, diff·untracked none`],
    ['pass', NO_TRIGGER],
  ]);
});

test('W-REVIEW warns with the files changed after the PASS head, judging only the last PASS line', () => {
  const changedAfter = evaluate({
    lifecycle: section('feature', passLine({ head: MISSING }), passLine({ head: EARLIER })),
    commits: {
      [EARLIER]: ['scripts/ci/lifecycle/run.mjs', 'docs/development/github/collaboration.md'],
    },
  });
  assert.deepEqual(rows(changedAfter, 'W-REVIEW'), [
    [
      'warn',
      `PASS head ${short(EARLIER)} ≠ PR head ${short(HEAD)}, PASS 뒤 바뀐 파일 2개: scripts/ci/lifecycle/run.mjs, docs/development/github/collaboration.md`,
    ],
    ['pass', NO_TRIGGER],
  ]);

  const rebased = evaluate({ lifecycle: section('feature', passLine({ head: MISSING })) });
  assert.deepEqual(rows(rebased, 'W-REVIEW')[0], [
    'warn',
    `PASS head ${short(MISSING)}를 저장소에서 찾지 못함(rebase 등)`,
  ]);

  const broken = evaluate({
    lifecycle: section('feature', passLine({ head: EARLIER })),
    commits: { [EARLIER]: [] },
    diffError: new Error('fatal: bad object'),
  });
  assert.deepEqual(rows(broken, 'W-REVIEW')[0], [
    'warn',
    `PASS head ${short(EARLIER)}와 PR head ${short(HEAD)} 비교 실패: fatal: bad object`,
  ]);
});

test('W-REVIEW warns when the PASS snapshot carries uncommitted or untracked changes', () => {
  for (const [line, shown] of [
    [passLine({ diff: DIGEST }), `diff=${DIGEST} untracked=none`],
    [passLine({ untracked: DIGEST }), `diff=none untracked=${DIGEST}`],
  ]) {
    const result = evaluate({ lifecycle: section('feature', line) });
    assert.deepEqual(rows(result, 'W-REVIEW'), [
      ['warn', `리뷰 PASS c542b64e-32855c6a에 commit 밖 변경이 있음: ${shown}`],
      ['pass', NO_TRIGGER],
    ]);
  }
});

test('W-REVIEW warns when the body has no PASS line', () => {
  for (const lifecycle of [section('feature'), undefined]) {
    const result = evaluate({ lifecycle });
    assert.deepEqual(rows(result, 'W-REVIEW'), [
      ['warn', '리뷰 PASS 줄 없음'],
      ['pass', NO_TRIGGER],
    ]);
  }
});

test('W-REVIEW warns on malformed PASS lines such as a Claude adapter digest and leaves them unmatched', () => {
  const adapter = `c542b64e-32855c6a base=${BASE} head=${HEAD} diff=sha256:${DIGEST} untracked=none`;
  const header = `c542b64e-32855c6a KNU review snapshot sha256:${DIGEST}`;
  const abbreviated = `c542b64e-32855c6a base=${short(BASE)} head=${short(HEAD)} diff=none untracked=none`;
  const result = evaluate({
    lifecycle: section(
      'feature',
      ['리뷰 PASS', adapter],
      ['리뷰 PASS', header],
      ['리뷰 PASS', abbreviated],
    ),
  });
  assert.deepEqual(rows(result, 'W-REVIEW'), [
    ['warn', `형식이 틀린 리뷰 PASS 줄(대조하지 않음): ${adapter}`],
    ['warn', `형식이 틀린 리뷰 PASS 줄(대조하지 않음): ${header}`],
    ['warn', `형식이 틀린 리뷰 PASS 줄(대조하지 않음): ${abbreviated}`],
    ['pass', NO_TRIGGER],
  ]);

  const afterValid = evaluate({
    lifecycle: section('feature', passLine(), ['리뷰 PASS', adapter]),
  });
  assert.deepEqual(rows(afterValid, 'W-REVIEW').slice(0, 2), [
    ['warn', `형식이 틀린 리뷰 PASS 줄(대조하지 않음): ${adapter}`],
    ['pass', `리뷰 PASS c542b64e-32855c6a: PR head ${short(HEAD)}와 같음, diff·untracked none`],
  ]);
});

test('W-REVIEW asks a PR that changes a rescore trigger path for a rescore line', () => {
  for (const path of [
    'docs/development/agent-workflows/review-criteria/swe.md',
    'docs/development/agent-workflows/review-criteria/README.md',
    ...TRIGGER_PATHS.slice(1),
  ]) {
    const result = evaluate({ lifecycle: section('feature', passLine()), changedPaths: [path] });
    assert.deepEqual(
      rows(result, 'W-REVIEW').at(-1),
      ['warn', `재채점 줄 없음: trigger 경로 1개(${path})`],
      path,
    );
  }

  const changedPaths = [
    'scripts/ci/lifecycle/run.mjs',
    'docs/development/agent-workflows/review-criteria/swe.md',
    '.codex/agents/knu_reviewer.toml',
  ];
  const rescore = (value) =>
    rows(
      evaluate({ lifecycle: section('feature', passLine(), ['재채점', value]), changedPaths }),
      'W-REVIEW',
    ).slice(1);
  assert.deepEqual(rescore('해당 없음 — Codex 진입점은 측정 범위 밖(P3 한계)'), [
    ['pass', '재채점 해당 없음 — Codex 진입점은 측정 범위 밖(P3 한계)'],
  ]);
  assert.deepEqual(rescore('통과 2026-10-26 ho-002'), [['pass', '재채점 통과 2026-10-26 ho-002']]);
  assert.deepEqual(rescore('실패 2026-10-26 ho-002'), [
    ['warn', '재채점 실패 2026-10-26 ho-002: merge 전 Owner 판단'],
  ]);
  assert.deepEqual(rescore('통과 ho-002'), [['warn', '형식이 틀린 재채점 줄: 통과 ho-002']]);
  assert.deepEqual(rescore('해당 없음'), [['warn', '형식이 틀린 재채점 줄: 해당 없음']]);
});

test('the rescore trigger paths stay the contract list and leave binding, pack and other skill files out', async () => {
  const { RESCORE_TRIGGER_PATHS } = await import('./review-snapshot-check.mjs');
  assert.deepEqual(RESCORE_TRIGGER_PATHS, TRIGGER_PATHS);

  for (const path of [
    '.claude/skills/knu-review/SKILL.md',
    '.claude/skills/knu-settle/SKILL.md',
    'docs/development/agent-workflows/domain/knu-binding.md',
    'docs/development/agent-workflows/domain/web/pack.md',
    'docs/development/agent-workflows/qa.md',
    'scripts/agents/claude/native-session.mjs',
    'scripts/agents/common/review-criteria-selection.mjs',
  ]) {
    const result = evaluate({ lifecycle: section('feature', passLine()), changedPaths: [path] });
    assert.deepEqual(rows(result, 'W-REVIEW').at(-1), ['pass', NO_TRIGGER], path);
  }
});

test('W-CAUSE asks bugfix and hotfix for a cause PR line and leaves other grades out', () => {
  const cause = (grade, ...values) =>
    rows(
      evaluate({
        lifecycle: section(grade, passLine(), ...values.map((value) => ['원인 PR', value])),
      }),
      'W-CAUSE',
    );

  assert.deepEqual(cause('bugfix'), [['warn', 'bugfix에 원인 PR 줄 없음']]);
  assert.deepEqual(cause('hotfix'), [['warn', 'hotfix에 원인 PR 줄 없음']]);
  assert.deepEqual(cause('bugfix', '#645'), [['pass', '원인 PR #645']]);
  assert.deepEqual(cause('hotfix', '모름 — 재현 기록 없음'), [
    ['pass', '원인 PR 모름 — 재현 기록 없음'],
  ]);
  assert.deepEqual(cause('bugfix', 'PR 645', '모름'), [
    ['warn', '형식이 틀린 원인 PR 줄: PR 645'],
    ['warn', '형식이 틀린 원인 PR 줄: 모름'],
  ]);
  for (const grade of ['feature', 'trivial', 'policy-change'])
    assert.deepEqual(cause(grade, 'PR 645'), [['pass', `원인 PR 판정 밖(${grade})`]], grade);
  assert.deepEqual(
    rows(evaluate({ lifecycle: undefined }), 'W-CAUSE'),
    [['pass', '원인 PR 판정 밖(feature)']],
    'a body without the section counts as feature',
  );
});

test('Claude and Codex PASS results give a PASS line of the same shape', () => {
  const untracked = createHash('sha256')
    .update(
      [
        `scripts/ci/lifecycle/review-snapshot-check.mjs\t${'4'.repeat(64)}\n`,
        `scripts/ci/lifecycle/review-snapshot-check.test.mjs\t${'5'.repeat(64)}\n`,
      ].join(''),
    )
    .digest('hex');
  const snapshot = `base=124795825ffcf59de81ce1a7a60240720e08c793 head=c74d6abfbee3d82ce0e9b9c167f91e832fc1aa0e diff=${'3'.repeat(64)} untracked=${untracked}`;
  const line = (name) =>
    spawnSync(process.execPath, [checkScript, '--result', resultFixture(name)], {
      encoding: 'utf8',
    });

  const claude = line('claude-pass.json');
  const codex = line('codex-pass.json');
  assert.equal(claude.status, 0, claude.stderr);
  assert.equal(codex.status, 0, codex.stderr);
  assert.equal(claude.stdout, `- 리뷰 PASS: c542b64e-32855c6a ${snapshot}\n`);
  assert.equal(codex.stdout, `- 리뷰 PASS: review-oss4pr2-1 ${snapshot}\n`);

  // The gate parser reads both lines as one snapshot under two host review ids.
  const [fromClaude, fromCodex] = parseLifecycleSection(
    `## Lifecycle\n\n${claude.stdout}${codex.stdout}`,
  ).reviewPasses.map((line) => line.snapshot);
  assert.equal(fromClaude.reviewId, 'c542b64e-32855c6a');
  assert.equal(fromCodex.reviewId, 'review-oss4pr2-1');
  assert.deepEqual({ ...fromClaude, reviewId: null }, { ...fromCodex, reviewId: null });
});

test('the PASS line CLI writes none for a clean snapshot and refuses a result that is not a PASS', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'knu-review-pass-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const claude = JSON.parse(readFileSync(resultFixture('claude-pass.json'), 'utf8'));
  const run = (result) => {
    const path = join(root, 'result.json');
    writeFileSync(path, JSON.stringify(result));
    return spawnSync(process.execPath, [checkScript, '--result', path], { encoding: 'utf8' });
  };

  const clean = run({
    ...claude,
    reviewedSnapshot: {
      ...claude.reviewedSnapshot,
      dirtyDiffDigest: null,
      untrackedInputDigests: [],
    },
  });
  assert.equal(clean.status, 0, clean.stderr);
  assert.match(
    clean.stdout,
    /^- 리뷰 PASS: c542b64e-32855c6a base=[0-9a-f]{40} head=[0-9a-f]{40} diff=none untracked=none\n$/u,
  );

  const failed = run({ ...claude, verdict: 'FAIL' });
  assert.equal(failed.status, 2);
  assert.equal(failed.stdout, '');
  assert.match(failed.stderr, /verdict가 PASS가 아님: FAIL/u);

  const adapterHead = run({
    ...claude,
    reviewedSnapshot: { ...claude.reviewedSnapshot, headSHA: `sha256:${DIGEST}` },
  });
  assert.equal(adapterHead.status, 2);
  assert.match(adapterHead.stderr, /reviewedSnapshot\.headSHA/u);
});
