// Lifecycle state definition (lifecycle-definition.json) against the state machine contract values, the code that
// emits the registered check ids and the tables of the tracked guide; plus the document status header check.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { AREA_CHECK_ID } from './area-criteria-check.mjs';
import { LIFECYCLE_GRADES, parseLifecycleSection } from './lifecycle-section.mjs';
import { headerStatus, POLICY_FIRST_CHECK_IDS } from './policy-first-check.mjs';
import { evaluateReviewSnapshot } from './review-snapshot-check.mjs';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const DEFINITION = 'scripts/ci/lifecycle/lifecycle-definition.json';
const GUIDE = 'docs/development/agent-workflows/lifecycle-state-machine.md';
// Read inside each test, so a missing definition, module or guide fails only the tests that need it.
const readDefinition = () => JSON.parse(readFileSync(resolve(repoRoot, DEFINITION), 'utf8'));
const readGuide = () => readFileSync(resolve(repoRoot, GUIDE), 'utf8');
const headerModule = () => import('./document-header.mjs');
const byId = (entries, id) => entries.find((entry) => entry.id === id);

const PROJECT_STATES = [
  'uninitialized',
  'intake',
  'discovery',
  'product-defined',
  'policy-baseline',
  'architected',
];
const WORK_STATES = [
  'planned',
  'policy-ready',
  'ready',
  'implementing',
  'reviewing',
  'merged',
  'evidenced',
];
// The P0 state table guards, one leaving each state in table order.
const P0_GUARDS = [
  'P-INIT',
  'P-GRADE',
  'P-DIRECTION',
  'P-POLICY-SET',
  'P-POLICY-BASE',
  'P-ARCH',
  'W-SCOPE',
  'W-POLICY',
  'W-READY',
  'W-PATHS',
  'W-REVIEW',
  'W-MERGE',
  'W-EVID',
];
const STRENGTHS = [
  'deterministic-static',
  'native-runtime',
  'model-mediated',
  'advisory-policy',
  'human-judgment',
];
// The P0 strength column in the strength vocabulary; a reviewer judgement is model-mediated.
const GUARD_STRENGTHS = {
  'P-INIT': ['deterministic-static'],
  'P-GRADE': ['model-mediated'],
  'P-DIRECTION': ['deterministic-static'],
  'P-POLICY-SET': ['deterministic-static'],
  'P-POLICY-BASE': ['deterministic-static'],
  'P-ARCH': ['deterministic-static'],
  'W-SCOPE': ['deterministic-static'],
  'W-POLICY': ['deterministic-static', 'model-mediated'],
  'W-DESIGN': ['human-judgment'],
  'W-READY': ['model-mediated', 'deterministic-static'],
  'W-PATHS': ['deterministic-static'],
  'W-REVIEW': ['model-mediated', 'deterministic-static'],
  'W-MERGE': ['native-runtime'],
  'W-EVID': [],
};
const REVERSE = ['R-AMBIG', 'R-REVIEW', 'R-UPSTREAM', 'R-REJECT', 'R-SIGNAL'];
// Reverse targets that are not a state or a procedure step: the start of the reviewed state, the changed artifact's state.
const TARGET_SENTINELS = ['reviewed-state-start', 'changed-artifact-state'];
const BUGFIX_STEPS = ['baseline-check', 'reproduce', 'cause-hypothesis', 'confirm', 'red'];
const CHECK_GUARDS = {
  'W-SCOPE': 'W-SCOPE',
  'W-POLICY': 'W-POLICY',
  'W-CITE': 'W-READY',
  'W-IRREV': null,
  'L-CONFIRM': null,
  'W-AREA': null,
  'W-REVIEW': 'W-REVIEW',
  'W-CAUSE': null,
};

// Rows of the first table under a `## ` heading of the guide, each cell as its backticked values.
function guideTable(text, heading) {
  const lines = text.split('\n');
  const start = lines.indexOf(`## ${heading}`);
  assert.ok(start >= 0, `${GUIDE}: ## ${heading} 절 없음`);
  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
  const rows = lines
    .slice(start + 1, end < 0 ? undefined : end)
    .filter((line) => line.startsWith('|'))
    .slice(2);
  return rows.map((row) =>
    row
      .split('|')
      .slice(1, -1)
      .map((cell) => [...cell.matchAll(/`([^`]+)`/gu)].map((match) => match[1])),
  );
}

test('상태는 13개이고 프로젝트 층 6·작업 층 7이다', () => {
  const { states } = readDefinition();
  assert.deepEqual(
    states.map((state) => state.id),
    [...PROJECT_STATES, ...WORK_STATES],
  );
  for (const [layer, ids] of [
    ['project', PROJECT_STATES],
    ['work', WORK_STATES],
  ])
    assert.deepEqual(
      states.filter((state) => state.layer === layer).map((state) => state.id),
      ids,
      layer,
    );
});

test('guard는 P0 13개와 W-DESIGN이고 각 state가 정의에 있다', () => {
  const { states, guards } = readDefinition();
  assert.equal(guards.length, 14);
  const p0 = guards.filter((guard) => guard.id !== 'W-DESIGN');
  assert.deepEqual(
    p0.map((guard) => guard.id),
    P0_GUARDS,
  );
  assert.deepEqual(
    p0.map((guard) => guard.state),
    states.map((state) => state.id),
  );
  assert.equal(byId(guards, 'W-DESIGN').state, 'policy-ready');
});

test('W-DESIGN은 조건부 human-judgment이고 확인 주체가 강도와 다른 field다', () => {
  const { guards } = readDefinition();
  const design = byId(guards, 'W-DESIGN');
  assert.equal(design.condition, 'visual-quality-claim');
  assert.deepEqual(design.strength, ['human-judgment']);
  assert.equal(design.confirmer, 'owner-or-delegate');
  assert.deepEqual(
    guards.filter((guard) => 'condition' in guard).map((guard) => guard.id),
    ['W-DESIGN'],
  );
  const policy = byId(guards, 'W-POLICY');
  assert.equal(policy.confirmer, 'owner');
  assert.ok(!policy.strength.includes('human-judgment'));
});

test('강도 값은 strengths 어휘 안이고 guard별 값이 P0 강도 칸 대응과 같다', () => {
  const { strengths, guards } = readDefinition();
  assert.deepEqual(strengths, STRENGTHS);
  for (const guard of guards)
    for (const strength of guard.strength) assert.ok(strengths.includes(strength), guard.id);
  assert.deepEqual(
    Object.fromEntries(guards.map((guard) => [guard.id, guard.strength])),
    GUARD_STRENGTHS,
  );
  assert.deepEqual(
    guards.filter((guard) => !guard.strength.length).map((guard) => guard.id),
    ['W-EVID'],
  );
});

test('역전이는 5개이고 R-SIGNAL 기준 값은 3이다', () => {
  const { states, reverse, grades } = readDefinition();
  assert.deepEqual(
    reverse.map((entry) => entry.id),
    REVERSE,
  );
  const signal = byId(reverse, 'R-SIGNAL');
  assert.equal(signal.sameFixLimit, 3);
  assert.deepEqual(Object.keys(signal.target), LIFECYCLE_GRADES);
  assert.deepEqual(signal.target, {
    trivial: 'implementing',
    bugfix: 'baseline-check',
    hotfix: 'baseline-check',
    feature: 'ready',
    'policy-change': 'ready',
  });
  assert.equal(byId(reverse, 'R-REJECT').target, 'reviewed-state-start');
  const targets = new Set([
    ...states.map((state) => state.id),
    ...Object.values(grades).flatMap((grade) => grade.steps),
    ...TARGET_SENTINELS,
  ]);
  for (const entry of reverse) {
    for (const field of ['trigger', 'rule', 'detection'])
      assert.ok(entry[field], `${entry.id}.${field}`);
    const values =
      typeof entry.target === 'string'
        ? [entry.target]
        : Array.isArray(entry.target)
          ? entry.target
          : Object.values(entry.target);
    for (const value of values) assert.ok(targets.has(value), `${entry.id}.target ${value}`);
  }
});

test('등급 키는 LIFECYCLE_GRADES와 같다', () => {
  const { states, guards, grades } = readDefinition();
  assert.deepEqual(Object.keys(grades), LIFECYCLE_GRADES);
  const workOrder = states.filter((state) => state.layer === 'work').map((state) => state.id);
  const guardIds = new Set(guards.map((guard) => guard.id));
  for (const [grade, { path, steps, skip, warnOnly }] of Object.entries(grades)) {
    assert.deepEqual(
      path,
      workOrder.filter((id) => path.includes(id)),
      `${grade}.path`,
    );
    assert.equal(path.at(-1), 'evidenced', `${grade}.path`);
    for (const id of [...skip, ...warnOnly]) assert.ok(guardIds.has(id), `${grade}: ${id}`);
    assert.deepEqual(steps, ['bugfix', 'hotfix'].includes(grade) ? BUGFIX_STEPS : [], grade);
  }
});

test('등록 검사 id는 code 출력과 같다', () => {
  const { guards, checks } = readDefinition();
  const section = parseLifecycleSection('## Lifecycle\n\n- 변경 등급: bugfix\n');
  const reviewIds = evaluateReviewSnapshot({
    section,
    grade: section.grade.effective,
    changedPaths: [],
    revisions: { head: '0'.repeat(40) },
  })
    .map((finding) => finding.check)
    .filter((id) => /^[A-Z]-[A-Z]+$/u.test(id));
  const emitted = new Map([
    ...POLICY_FIRST_CHECK_IDS.map((id) => [id, 'scripts/ci/lifecycle/policy-first-check.mjs']),
    [AREA_CHECK_ID, 'scripts/ci/lifecycle/area-criteria-check.mjs'],
    ...reviewIds.map((id) => [id, 'scripts/ci/lifecycle/review-snapshot-check.mjs']),
  ]);
  assert.deepEqual(new Set(checks.map((check) => check.id)), new Set(emitted.keys()));
  assert.equal(checks.length, emitted.size);
  for (const check of checks) assert.equal(check.module, emitted.get(check.id), check.id);
  assert.deepEqual(
    Object.fromEntries(checks.map((check) => [check.id, check.guard])),
    CHECK_GUARDS,
  );
  for (const guard of guards)
    assert.deepEqual(
      guard.checks,
      checks.filter((check) => check.guard === guard.id).map((check) => check.id),
      guard.id,
    );
});

test('문서 표의 상태·guard·역전이 id와 강도·확인 주체가 정의와 같다', () => {
  const { states, guards, reverse } = readDefinition();
  const guide = readGuide();
  assert.deepEqual(
    guideTable(guide, '상태').map(([[id], [layer]]) => ({ id, layer })),
    states.map(({ id, layer }) => ({ id, layer })),
  );
  assert.deepEqual(
    guideTable(guide, 'Guard').map(([[id], [state], , strength, [confirmer]]) => ({
      id,
      state,
      strength,
      confirmer,
    })),
    guards.map(({ id, state, strength, confirmer }) => ({ id, state, strength, confirmer })),
  );
  assert.deepEqual(
    guideTable(guide, '역전이').map(([[id]]) => id),
    reverse.map((entry) => entry.id),
  );
});

test('문서가 정의의 top-level field를 모두 설명한다', () => {
  const definition = readDefinition();
  const guide = readGuide();
  assert.equal(definition.schema, 'lifecycle-definition/v1');
  for (const field of Object.keys(definition)) assert.ok(guide.includes(`\`${field}\``), field);
});

const HEADER = [
  '**상태**: owner-confirmed',
  '**확인일**: 2026-10-28',
  '**확인 근거**: [#1](https://github.com/example/repo/pull/1)',
  '**근거**: [PRD 개요](../product/overview.md), [데이터 보유](../policies/data-retention.md)',
];
const documentText = (...lines) => lines.join('\n');
const withHeader = (header, { gap = true } = {}) =>
  documentText('# 제목', ...(gap ? [''] : []), ...header, '', '본문');
const replaceKey = (key, line) =>
  HEADER.flatMap((entry) => (entry.startsWith(`**${key}**:`) ? (line ? [line] : []) : [entry]));

test('header 검사', async () => {
  const { parseDocumentHeader, checkDocumentHeader } = await headerModule();
  const codes = (text, options) =>
    checkDocumentHeader(text, options).map((finding) => finding.code);

  const full = withHeader(HEADER);
  assert.deepEqual(parseDocumentHeader(full), {
    status: 'owner-confirmed',
    confirmedOn: '2026-10-28',
    confirmationRef: '[#1](https://github.com/example/repo/pull/1)',
    basis: ['../product/overview.md', '../policies/data-retention.md'],
    keys: ['상태', '확인일', '확인 근거', '근거'],
  });
  assert.deepEqual(codes(full), []);

  const tight = withHeader(HEADER, { gap: false });
  assert.deepEqual(codes(tight), []);
  assert.deepEqual(parseDocumentHeader(tight), parseDocumentHeader(full));
  assert.equal(headerStatus(tight), parseDocumentHeader(tight).status);

  assert.deepEqual(codes(withHeader(replaceKey('상태', '**상태**: Accepted / current'))), [
    'header-status-invalid',
  ]);
  assert.deepEqual(codes(withHeader(replaceKey('확인일'))), ['header-confirmed-fields-missing']);
  const noBasis = withHeader(replaceKey('근거'));
  assert.deepEqual(codes(noBasis), ['header-basis-missing']);
  assert.deepEqual(codes(noBasis, { requireBasis: false }), []);

  const bare = documentText('# 제목', '', '본문');
  assert.equal(parseDocumentHeader(bare), null);
  assert.deepEqual(codes(bare), ['header-missing']);
});

test('headerStatus 회귀', () => {
  assert.equal(headerStatus(withHeader(HEADER)), 'owner-confirmed');
  assert.equal(headerStatus(withHeader(HEADER, { gap: false })), 'owner-confirmed');
  assert.equal(
    headerStatus(withHeader(replaceKey('상태', '**상태**: Accepted / current'))),
    'Accepted / current',
  );
  assert.equal(headerStatus(withHeader(['**날짜**: 2026-10-28', '**상태**: draft'])), 'draft');
  assert.equal(headerStatus(withHeader(['**날짜**: 2026-10-28'])), null);
  assert.equal(
    headerStatus(documentText('# 제목', '', '**날짜**: x', '', '**상태**: draft')),
    null,
  );
  assert.equal(headerStatus(documentText('# 제목', '', '본문')), null);
  assert.equal(headerStatus(documentText('**상태**: draft')), null);
});
