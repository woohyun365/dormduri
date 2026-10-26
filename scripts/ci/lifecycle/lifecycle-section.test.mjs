import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  LIFECYCLE_GRADES,
  parseLifecycleSection,
  POLICY_GRADES,
  referencedIssues,
} from './lifecycle-section.mjs';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

const body = (lines) =>
  [
    '## Summary',
    '',
    '- Outcome: x',
    '',
    ...lines,
    '',
    '## Changes',
    '',
    '- 변경 등급: hotfix',
    '',
  ].join('\n');

test('grades keep the contract values and feature-class grades', () => {
  assert.deepEqual(LIFECYCLE_GRADES, ['trivial', 'bugfix', 'hotfix', 'feature', 'policy-change']);
  assert.deepEqual(POLICY_GRADES, ['feature', 'policy-change']);
});

test('a body without the section counts as feature with a format warning', () => {
  const section = parseLifecycleSection('## Summary\n\n- 변경 등급: bugfix\n');

  assert.equal(section.present, false);
  assert.equal(section.grade.declared, null);
  assert.equal(section.grade.effective, 'feature');
  assert.deepEqual(section.warnings, ['Lifecycle 절 없음: feature로 계산']);
});

test('the section ends at the next level-two heading and ignores HTML comments', () => {
  const section = parseLifecycleSection(
    body([
      '## Lifecycle',
      '',
      '<!-- - 변경 등급: trivial -->',
      '- 변경 등급: bugfix <!-- trivial·bugfix·hotfix·feature·policy-change -->',
      '- 등급 근거: <!-- 한 줄 -->',
      '<!--',
      '- 정책 도메인: chat-lifecycle',
      '-->',
      '- 정책 도메인: matching-lifecycle, matching-algorithm',
    ]),
  );

  assert.equal(section.present, true);
  assert.deepEqual(section.grade, { declared: 'bugfix', effective: 'bugfix' });
  assert.equal(section.gradeBasis, null);
  assert.deepEqual(section.domains, ['matching-lifecycle', 'matching-algorithm']);
  assert.deepEqual(section.warnings, ['등급 근거 없음']);
});

test('an unknown or empty grade counts as feature', () => {
  for (const [line, warning] of [
    ['- 변경 등급: chore', "모르는 변경 등급 'chore': feature로 계산"],
    ['- 변경 등급:', '변경 등급 없음: feature로 계산'],
  ]) {
    const section = parseLifecycleSection(body(['## Lifecycle', '', line, '- 등급 근거: x']));
    assert.equal(section.grade.effective, 'feature', line);
    assert.deepEqual(section.warnings, [warning], line);
  }
});

test('repeatable fields accumulate and malformed lines become format warnings', () => {
  const section = parseLifecycleSection(
    body([
      '## Lifecycle',
      '',
      '- 변경 등급: feature',
      '- 등급 근거: 동작 변경',
      '- 정책 도메인: 없음',
      '- 인용 규칙: [chat-lifecycle.md CH-R1](docs/policies/chat-lifecycle.md), [chat-lifecycle.md CH-R2](docs/policies/other.md), CH-R3',
      '- 정책 영향 없음: season-lifecycle — 시즌 기간과 무관',
      '- 정책 영향 없음: profile-model',
      '- Owner 확인: docs/policies/path-domains.json 2026-10-17',
      '- Owner 확인: docs/product/artifact-map.json 10월 17일',
      '- override: W-IRREV — 오탈자 — 다음 migration',
      '- override: W-SCOPE 이유 없음',
    ]),
  );

  assert.deepEqual(section.domains, []);
  assert.deepEqual(section.citations, [{ document: 'chat-lifecycle', id: 'CH-R1' }]);
  assert.deepEqual(section.noImpact, [{ domain: 'season-lifecycle', reason: '시즌 기간과 무관' }]);
  assert.deepEqual(section.ownerConfirmations, [
    { path: 'docs/policies/path-domains.json', date: '2026-10-17' },
  ]);
  assert.deepEqual(section.overrides, [
    { check: 'W-IRREV', reason: '오탈자', revisit: '다음 migration' },
  ]);
  assert.deepEqual(section.warnings, [
    '형식이 틀린 인용(인용으로 세지 않음): [chat-lifecycle.md CH-R2](docs/policies/other.md)',
    '형식이 틀린 인용(인용으로 세지 않음): CH-R3',
    '형식이 틀린 정책 영향 없음 줄: profile-model',
    '형식이 틀린 Owner 확인 줄: docs/product/artifact-map.json 10월 17일',
    '형식이 틀린 override 줄: W-SCOPE 이유 없음',
  ]);
});

test('review PASS, cause PR and rescore lines parse per line and leave format judgments to their checks', () => {
  const sha = (character) => character.repeat(40);
  const digest = '1'.repeat(64);
  const pass = `c542b64e-32855c6a base=${sha('a')} head=${sha('c')} diff=none untracked=${digest}`;
  const adapter = `review-oss4pr2-1 base=${sha('a')} head=${sha('c')} diff=sha256:${digest} untracked=none`;
  const section = parseLifecycleSection(
    body([
      '## Lifecycle',
      '',
      '- 변경 등급: bugfix',
      '- 등급 근거: x',
      `- 리뷰 PASS: ${pass}`,
      `- 리뷰 PASS: ${adapter}`,
      '- 원인 PR: #645',
      '- 원인 PR: 모름 — 재현 기록 없음',
      '- 원인 PR: PR 645',
      '- 재채점: 통과 2026-10-25 ho-001',
      '- 재채점: 해당 없음 — Codex 진입점은 측정 범위 밖(P3 한계)',
      '- 재채점: 통과',
    ]),
  );

  assert.deepEqual(section.reviewPasses, [
    {
      value: pass,
      snapshot: {
        reviewId: 'c542b64e-32855c6a',
        base: sha('a'),
        head: sha('c'),
        diff: 'none',
        untracked: digest,
      },
    },
    { value: adapter, snapshot: null },
  ]);
  assert.deepEqual(section.causes, [
    { value: '#645', cause: { pr: 645 } },
    { value: '모름 — 재현 기록 없음', cause: { unknown: '재현 기록 없음' } },
    { value: 'PR 645', cause: null },
  ]);
  assert.deepEqual(section.rescores, [
    {
      value: '통과 2026-10-25 ho-001',
      rescore: { result: '통과', date: '2026-10-25', usageId: 'ho-001' },
    },
    {
      value: '해당 없음 — Codex 진입점은 측정 범위 밖(P3 한계)',
      rescore: { notApplicable: 'Codex 진입점은 측정 범위 밖(P3 한계)' },
    },
    { value: '통과', rescore: null },
  ]);
  assert.deepEqual(section.warnings, []);

  const absent = parseLifecycleSection('## Summary\n');
  assert.deepEqual([absent.reviewPasses, absent.causes, absent.rescores], [[], [], []]);
});

test('issue references come from the body outside HTML comments', () => {
  assert.deepEqual(
    referencedIssues('- Development PR: Refs #634\n<!-- Closes #1 -->\n관련 #600, PR #12a, a#9\n'),
    [600, 634],
  );
});

test('the pull request template section parses with every field name the parser reads', () => {
  const template = readFileSync(resolve(repoRoot, '.github/PULL_REQUEST_TEMPLATE.md'), 'utf8');
  const section = parseLifecycleSection(template);

  assert.equal(section.present, true);
  assert.deepEqual(section.fieldNames, [
    '변경 등급',
    '등급 근거',
    '정책 도메인',
    '인용 규칙',
    '정책 영향 없음',
    'Owner 확인',
    'override',
    '리뷰 PASS',
    '원인 PR',
    '재채점',
  ]);
  assert.equal(section.grade.effective, 'feature');
});
