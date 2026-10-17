import assert from 'node:assert/strict';
import test from 'node:test';

import {
  artifactMap,
  cite,
  json,
  pathDomains,
  prBody,
  REVISIONS,
  repository,
} from './fixtures/policy-repo.mjs';
import { POLICY_FIRST_CHECK_IDS } from './policy-first-check.mjs';
import { buildLifecycleContext, evaluateLifecycle } from './run.mjs';

const MATCHES = 'apps/api/src/matches/matches.service.ts';
const MIGRATION = 'apps/api/prisma/migrations/20261017000000_fix/migration.sql';
const PATH_TABLE = 'docs/policies/path-domains.json';
const CONFIRMED = { status: 'owner-confirmed', date: '2026-10-17', basis: '#634' };

function evaluate({ body, changedPaths, head, mergeBase, author = 'woohyun365', baseRef = 'dev' }) {
  const reader = repository({ head, mergeBase });
  const context = buildLifecycleContext({
    body,
    author,
    baseRef,
    revisions: REVISIONS,
    changedPaths,
    reader,
  });
  return evaluateLifecycle(context);
}

const findings = (result, check, level) =>
  result.findings.filter((finding) => finding.check === check && finding.level === level);

function assertFinding(result, check, level, reason) {
  const matched = findings(result, check, level).filter((finding) => reason.test(finding.reason));
  assert.ok(
    matched.length > 0,
    `expected ${check} ${level} ${reason}; got ${JSON.stringify(result.findings)}`,
  );
}

function assertNoFail(result) {
  assert.deepEqual(
    result.findings.filter((finding) => finding.level === 'fail'),
    [],
    'expected no fail',
  );
  assert.equal(result.failed, false);
}

const declaredBugfix = (extra = []) => [
  ['변경 등급', 'bugfix'],
  ['등급 근거', '배포된 동작의 결함 수정'],
  ['정책 도메인', 'production-runtime-safety'],
  ['인용 규칙', cite('production-runtime-safety', 'PRS-R1')],
  ...extra,
];

test('the policy-first module names the five check ids', () => {
  assert.deepEqual(POLICY_FIRST_CHECK_IDS, [
    'W-SCOPE',
    'W-POLICY',
    'W-CITE',
    'W-IRREV',
    'L-CONFIRM',
  ]);
});

test('RED 1: a product diff without a Lifecycle section counts as feature and fails scope and citation', () => {
  const result = evaluate({ body: prBody(), changedPaths: [MATCHES] });

  assertFinding(
    result,
    'W-SCOPE',
    'fail',
    /판정 도메인이 선언에 없음: matching-algorithm, matching-lifecycle/u,
  );
  assertFinding(result, 'W-CITE', 'fail', /인용도 정책 영향 없음 줄도 없음: matching-algorithm/u);
  assertFinding(result, 'W-CITE', 'fail', /인용도 정책 영향 없음 줄도 없음: matching-lifecycle/u);
  assertFinding(result, '(형식)', 'warn', /Lifecycle 절 없음: feature로 계산/u);
  assert.equal(result.failed, true);
});

test('RED 1: the same diff with only a bugfix grade line warns and exits cleanly', () => {
  const result = evaluate({
    body: prBody({ lifecycle: [['변경 등급', 'bugfix']] }),
    changedPaths: [MATCHES],
  });

  assertFinding(result, 'W-SCOPE', 'warn', /판정 도메인이 선언에 없음/u);
  assertFinding(result, 'W-CITE', 'warn', /인용도 정책 영향 없음 줄도 없음/u);
  assertFinding(result, '(형식)', 'warn', /등급 근거 없음/u);
  assertNoFail(result);
});

test('RED 2: a fully grounded bugfix that changes a migration fails the irreversible path check', () => {
  const result = evaluate({
    body: prBody({ lifecycle: declaredBugfix() }),
    changedPaths: [MIGRATION],
  });

  assertFinding(result, 'W-IRREV', 'fail', new RegExp(`비가역 경로 변경: ${MIGRATION}`, 'u'));
  assert.deepEqual(
    result.findings.filter((finding) => finding.level === 'fail').map((finding) => finding.check),
    ['W-IRREV'],
  );
  assert.equal(result.failed, true);
});

test('RED 2: a trivial grade does not escape the irreversible path check', () => {
  const lifecycle = declaredBugfix().map(([name, value]) => [
    name,
    name === '변경 등급' ? 'trivial' : value,
  ]);
  const result = evaluate({
    body: prBody({ lifecycle }),
    changedPaths: ['infra/deploy/api/Dockerfile'],
  });

  assertFinding(result, 'W-IRREV', 'fail', /비가역 경로 변경: infra\/deploy\/api\/Dockerfile/u);
  assert.equal(result.failed, true);
});

test('RED 3: an override line turns the irreversible path fail into a warning', () => {
  const lifecycle = declaredBugfix([
    ['override', 'W-IRREV — migration 오탈자 수정 — 다음 migration PR'],
  ]);
  const result = evaluate({ body: prBody({ lifecycle }), changedPaths: [MIGRATION] });

  assertFinding(result, 'W-IRREV', 'warn', /비가역 경로 변경: .*override: migration 오탈자 수정/u);
  assertNoFail(result);
});

test('RED 4: an expression-only feature passes with a no-impact line per judged domain', () => {
  const lifecycle = [
    ['변경 등급', 'feature'],
    ['등급 근거', '표현만 바꾼다'],
    ['정책 도메인', 'matching-lifecycle, matching-algorithm'],
    ['인용 규칙', '없음'],
    ['정책 영향 없음', 'matching-lifecycle — 문구만 바꾼다'],
    ['정책 영향 없음', 'matching-algorithm — 점수 계산을 바꾸지 않는다'],
  ];
  const result = evaluate({ body: prBody({ lifecycle }), changedPaths: [MATCHES] });

  assertNoFail(result);
  for (const check of POLICY_FIRST_CHECK_IDS)
    assert.ok(findings(result, check, 'pass').length > 0, check);
});

test('RED 4: a citation of a missing id or a foreign prefix fails the citation check', () => {
  const base = [
    ['변경 등급', 'feature'],
    ['등급 근거', '동작을 바꾼다'],
    ['정책 도메인', 'matching-lifecycle, matching-algorithm'],
    ['정책 영향 없음', 'matching-lifecycle — 표현만'],
    ['정책 영향 없음', 'matching-algorithm — 표현만'],
  ];
  const missing = evaluate({
    body: prBody({ lifecycle: [...base, ['인용 규칙', cite('matching-lifecycle', 'ML-R9')]] }),
    changedPaths: [MATCHES],
  });
  assertFinding(
    missing,
    'W-CITE',
    'fail',
    /인용한 id가 문서에 없음: matching-lifecycle\.md ML-R9/u,
  );

  const foreign = evaluate({
    body: prBody({ lifecycle: [...base, ['인용 규칙', cite('matching-lifecycle', 'MA-R1')]] }),
    changedPaths: [MATCHES],
  });
  assertFinding(
    foreign,
    'W-CITE',
    'fail',
    /접두어가 정책 README 표와 다름: matching-lifecycle\.md MA-R1/u,
  );
});

test('RED 5: an extra declared domain with a no-impact line only warns about scope', () => {
  const lifecycle = [
    ['변경 등급', 'feature'],
    ['등급 근거', '동작을 바꾼다'],
    ['정책 도메인', 'matching-lifecycle, matching-algorithm, season-lifecycle'],
    ['인용 규칙', `${cite('matching-lifecycle', 'ML-R1')}, ${cite('matching-algorithm', 'MA-R1')}`],
    ['정책 영향 없음', 'season-lifecycle — 시즌 기간과 무관하다'],
  ];
  const result = evaluate({ body: prBody({ lifecycle }), changedPaths: [MATCHES] });

  assertFinding(result, 'W-SCOPE', 'warn', /선언이 판정보다 많음: season-lifecycle/u);
  assertNoFail(result);

  const withoutLine = evaluate({
    body: prBody({ lifecycle: lifecycle.filter(([name]) => name !== '정책 영향 없음') }),
    changedPaths: [MATCHES],
  });
  assertFinding(withoutLine, 'W-SCOPE', 'warn', /선언이 판정보다 많음: season-lifecycle/u);
  assertFinding(
    withoutLine,
    'W-CITE',
    'fail',
    /인용도 정책 영향 없음 줄도 없음: season-lifecycle/u,
  );
});

test('RED 5: a judged domain missing from the declaration fails the scope check', () => {
  const lifecycle = [
    ['변경 등급', 'feature'],
    ['등급 근거', '동작을 바꾼다'],
    ['정책 도메인', 'matching-lifecycle'],
    ['인용 규칙', `${cite('matching-lifecycle', 'ML-R1')}, ${cite('matching-algorithm', 'MA-R1')}`],
  ];
  const result = evaluate({ body: prBody({ lifecycle }), changedPaths: [MATCHES] });

  assertFinding(result, 'W-SCOPE', 'fail', /판정 도메인이 선언에 없음: matching-algorithm$/u);
});

const tableChange = ({
  confirmedBy = CONFIRMED,
  ownerLine = `${PATH_TABLE} 2026-10-17`,
  extra = [],
} = {}) => ({
  body: prBody({
    lifecycle: [
      ['변경 등급', 'bugfix'],
      ['등급 근거', '경로 표 행 추가'],
      ['정책 도메인', '없음'],
      ['인용 규칙', '없음'],
      ...(ownerLine ? [['Owner 확인', ownerLine]] : []),
      ...extra,
    ],
  }),
  changedPaths: [PATH_TABLE],
  head: { [PATH_TABLE]: json(pathDomains({ confirmedBy })) },
});

test('RED 6: a confirmed path table change passes the Owner confirmation check', () => {
  const result = evaluate(tableChange());

  assertFinding(result, 'L-CONFIRM', 'pass', /docs\/policies\/path-domains\.json/u);
  assertNoFail(result);
});

test('RED 6: each missing or stale Owner confirmation of a path table change fails', () => {
  assertFinding(
    evaluate(tableChange({ ownerLine: null })),
    'L-CONFIRM',
    'fail',
    /Owner 확인 줄 없음: docs\/policies\/path-domains\.json/u,
  );
  assertFinding(
    evaluate(tableChange({ ownerLine: `${PATH_TABLE} 2026-10-16` })),
    'L-CONFIRM',
    'fail',
    /Owner 확인 줄 날짜와 confirmedBy\.date가 다름: docs\/policies\/path-domains\.json/u,
  );
  assertFinding(
    evaluate(tableChange({ confirmedBy: { ...CONFIRMED, basis: '#999' } })),
    'L-CONFIRM',
    'fail',
    /confirmedBy\.basis가 본문이 참조하는 issue가 아님: docs\/policies\/path-domains\.json #999/u,
  );
  assertFinding(
    evaluate(tableChange({ confirmedBy: { ...CONFIRMED, status: 'draft' } })),
    'L-CONFIRM',
    'fail',
    /confirmedBy가 owner-confirmed가 아님: docs\/policies\/path-domains\.json/u,
  );
  const reused = { status: 'owner-confirmed', date: '2026-10-01', basis: '#634' };
  assertFinding(
    evaluate({
      ...tableChange({ confirmedBy: reused, ownerLine: `${PATH_TABLE} 2026-10-01` }),
      mergeBase: { [PATH_TABLE]: json(pathDomains({ confirmedBy: reused })) },
    }),
    'L-CONFIRM',
    'fail',
    /이 PR이 confirmedBy를 바꾸지 않음: docs\/policies\/path-domains\.json/u,
  );
});

test('RED 6: an override line does not lower an Owner confirmation fail', () => {
  const result = evaluate(
    tableChange({ ownerLine: null, extra: [['override', 'L-CONFIRM — 급함 — 다음 PR']] }),
  );

  assertFinding(result, 'L-CONFIRM', 'fail', /Owner 확인 줄 없음/u);
  assertFinding(result, '(형식)', 'warn', /override 대상이 아닌 검사: L-CONFIRM/u);
  assert.equal(result.failed, true);
});

test('RED 6: a policy document change needs an Owner line for feature and warns for trivial', () => {
  const policy = 'docs/policies/chat-lifecycle.md';
  const change = (grade) => ({
    body: prBody({
      lifecycle: [
        ['변경 등급', grade],
        ['등급 근거', '정책 문장'],
        ['정책 도메인', '없음'],
        ['인용 규칙', '없음'],
      ],
    }),
    changedPaths: [policy],
    head: { [policy]: '# 채팅 상태\n\n- **CH-R1** 바뀐 문장.\n' },
  });

  const feature = evaluate(change('policy-change'));
  assertFinding(
    feature,
    'L-CONFIRM',
    'fail',
    /정책 문서 Owner 확인 줄 없음: docs\/policies\/chat-lifecycle\.md/u,
  );

  const trivial = evaluate(change('trivial'));
  assertFinding(
    trivial,
    'L-CONFIRM',
    'warn',
    /정책 문서를 바꿈\(등급 상향 후보\): docs\/policies\/chat-lifecycle\.md/u,
  );
  assertNoFail(trivial);
});

test('RED 7: a draft tracking record leaves the judged domains without an owner-confirmed basis', () => {
  const lifecycle = [
    ['변경 등급', 'feature'],
    ['등급 근거', '동작을 바꾼다'],
    ['정책 도메인', 'matching-lifecycle, matching-algorithm'],
    ['인용 규칙', `${cite('matching-lifecycle', 'ML-R1')}, ${cite('matching-algorithm', 'MA-R1')}`],
  ];
  const draft = { status: 'draft', date: null, basis: null };
  const result = evaluate({
    body: prBody({ lifecycle }),
    changedPaths: [MATCHES],
    head: { 'docs/product/artifact-map.json': json(artifactMap({ confirmedBy: draft })) },
    mergeBase: { 'docs/product/artifact-map.json': json(artifactMap({ confirmedBy: draft })) },
  });

  assertFinding(result, 'W-POLICY', 'fail', /owner-confirmed 근거 없음: matching-algorithm/u);
  assertFinding(result, 'W-POLICY', 'fail', /owner-confirmed 근거 없음: matching-lifecycle/u);
});

test('RED 8: a bot author or a main base lowers every fail to a warning', () => {
  for (const options of [
    { author: 'dependabot[bot]' },
    { author: 'renovate[bot]' },
    { baseRef: 'main' },
  ]) {
    const result = evaluate({ body: prBody(), changedPaths: [MATCHES, MIGRATION], ...options });

    assertFinding(result, 'W-SCOPE', 'warn', /판정 도메인이 선언에 없음.*경고로 낮춤/u);
    assertNoFail(result);
    assert.match(result.downgrade, /경고로 낮춤/u, JSON.stringify(options));
  }
});

test('RED 8: an unclassified product path only warns', () => {
  const result = evaluate({
    body: prBody({
      lifecycle: [
        ['변경 등급', 'feature'],
        ['등급 근거', '공통 화면'],
        ['정책 도메인', '없음'],
      ],
    }),
    changedPaths: ['apps/web/src/main/components/SharedSheet.tsx'],
  });

  assertFinding(
    result,
    '(경로)',
    'warn',
    /미분류 제품 경로: apps\/web\/src\/main\/components\/SharedSheet\.tsx/u,
  );
  assertNoFail(result);
});

test('paths outside the product roots, policy documents and both JSON files leave only format warnings', () => {
  const result = evaluate({
    body: prBody(),
    changedPaths: ['scripts/ci/lanes/classify-changes.mjs'],
  });

  assertNoFail(result);
  assert.deepEqual(
    [
      ...new Set(
        result.findings
          .filter((finding) => finding.level === 'warn')
          .map((finding) => finding.check),
      ),
    ],
    ['(형식)'],
  );
});

test('a glob that matches no tracked file at head warns as stale', () => {
  const table = pathDomains();
  table.noDomain.push({ globs: ['apps/web/next-env.d.ts'], reason: 'build 설정' });
  const result = evaluate({
    body: prBody(),
    changedPaths: ['scripts/ci/lanes/classify-changes.mjs'],
    head: { [PATH_TABLE]: json(table) },
  });

  assertFinding(
    result,
    '(경로)',
    'warn',
    /추적 파일에 맞지 않는 glob: apps\/web\/next-env\.d\.ts/u,
  );
});
