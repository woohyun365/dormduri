import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { AREA_CHECK_ID, parseExemptionTable } from './area-criteria-check.mjs';
import {
  areaRepository,
  BASE_EXEMPTIONS,
  BINDING_FILE,
  criteriaPath,
  REVISIONS,
} from './fixtures/area/catalog-repo.mjs';
import { prBody } from './fixtures/policy-repo.mjs';
import { LifecycleInputError } from './policy-first-check.mjs';
import { buildLifecycleContext, evaluateLifecycle, LIFECYCLE_CHECKS } from './run.mjs';

const MOBILE = 'apps/mobile/src/App.tsx';
const NEXT_CONFIG = 'apps/web/next.config.ts';
const E2E = 'apps/web/e2e/smoke.spec.ts';
const VITEST_CONFIG = 'apps/web/vitest.config.ts';
const FE_PAGE = 'apps/web/src/app/page.tsx';
const BFF_ROUTE = 'apps/web/src/app/api/chat/route.ts';
const DEPLOY = 'infra/deploy/api/Dockerfile';

const AREA_CHECKS = LIFECYCLE_CHECKS.filter((check) => check.name === 'area-criteria');

function evaluate({
  body = prBody(),
  changedPaths,
  author = 'woohyun365',
  baseRef = 'dev',
  ...repository
}) {
  const context = buildLifecycleContext({
    body,
    author,
    baseRef,
    revisions: REVISIONS,
    changedPaths,
    reader: areaRepository(repository),
  });
  return evaluateLifecycle(context, AREA_CHECKS);
}

const graded = (grade) =>
  prBody({
    lifecycle: [
      ['변경 등급', grade],
      ['등급 근거', '영역 검사 fixture'],
    ],
  });

const areaFindings = (result, level) =>
  result.findings.filter(
    (finding) => finding.check === AREA_CHECK_ID && (!level || finding.level === level),
  );

function assertFinding(result, level, reason) {
  assert.ok(
    areaFindings(result, level).some((finding) => reason.test(finding.reason)),
    `expected ${AREA_CHECK_ID} ${level} ${reason}; got ${JSON.stringify(result.findings)}`,
  );
}

test('the area criteria check is registered under the W-AREA id', () => {
  assert.equal(AREA_CHECK_ID, 'W-AREA');
  assert.equal(AREA_CHECKS.length, 1);
});

test('a feature path matched only by a key without a pack section fails and names the key', () => {
  const result = evaluate({ changedPaths: [MOBILE] });

  assertFinding(
    result,
    'fail',
    /^영역 기준 없는 제품 경로: apps\/mobile\/src\/App\.tsx\(맞은 키 repo-structure\.mobile-app에 pack 절 없음\)$/u,
  );
  assert.equal(result.failed, true);
});

test('a product path matched only by the layerless swe key fails without an area key', () => {
  const result = evaluate({ changedPaths: [NEXT_CONFIG] });

  assertFinding(
    result,
    'fail',
    /^영역 기준 없는 제품 경로: apps\/web\/next\.config\.ts\(영역 키 없음\)$/u,
  );
  assert.equal(result.failed, true);
});

test('a path in the base exemption table warns with the row reason', () => {
  const result = evaluate({ changedPaths: [E2E] });

  assertFinding(
    result,
    'warn',
    /^제외 경로: apps\/web\/e2e\/smoke\.spec\.ts — 검증 코드\. 현재 기준 없음$/u,
  );
  assert.deepEqual(areaFindings(result, 'fail'), []);
  assert.equal(result.failed, false);
});

test('a base without the exemption section judges with an empty table', () => {
  const result = evaluate({
    changedPaths: [E2E],
    baseExemptions: null,
    headExemptions: BASE_EXEMPTIONS,
  });

  assertFinding(result, 'fail', /^영역 기준 없는 제품 경로: apps\/web\/e2e\/smoke\.spec\.ts\(/u);
  assert.equal(result.failed, true);
});

test('trivial, bugfix and hotfix only warn on paths without an area; policy-change fails', () => {
  for (const grade of ['trivial', 'bugfix', 'hotfix']) {
    const result = evaluate({ body: graded(grade), changedPaths: [MOBILE, NEXT_CONFIG] });

    assertFinding(
      result,
      'warn',
      new RegExp(`apps/mobile/src/App\\.tsx.* — ${grade}는 경고$`, 'u'),
    );
    assertFinding(
      result,
      'warn',
      new RegExp(`apps/web/next\\.config\\.ts.* — ${grade}는 경고$`, 'u'),
    );
    assert.deepEqual(areaFindings(result, 'fail'), [], grade);
    assert.equal(result.failed, false, grade);
  }

  const policyChange = evaluate({ body: graded('policy-change'), changedPaths: [MOBILE] });
  assertFinding(policyChange, 'fail', /apps\/mobile\/src\/App\.tsx/u);
  assert.equal(policyChange.failed, true);
});

test('an exemption added only at head does not exempt the same pull request; an override line lowers it', () => {
  const headExemptions = [
    ...BASE_EXEMPTIONS,
    ['`apps/web/vitest.config.ts`', 'test 설정. 현재 기준 없음'],
  ];
  const result = evaluate({ changedPaths: [VITEST_CONFIG, BINDING_FILE], headExemptions });

  assertFinding(
    result,
    'fail',
    /^영역 기준 없는 제품 경로: apps\/web\/vitest\.config\.ts\(영역 키 없음\) — head 제외 표에만 있는 행은 이 PR에 적용하지 않음$/u,
  );
  assert.equal(result.failed, true);

  const overridden = evaluate({
    body: prBody({
      lifecycle: [
        ['변경 등급', 'feature'],
        ['등급 근거', '새 test 설정'],
        ['override', 'W-AREA — 제외 행을 같은 PR에서 더함 — 다음 영역 키 PR'],
      ],
    }),
    changedPaths: [VITEST_CONFIG, BINDING_FILE],
    headExemptions,
  });
  assertFinding(
    overridden,
    'warn',
    /apps\/web\/vitest\.config\.ts.* — override: 제외 행을 같은 PR에서 더함 — 재검토: 다음 영역 키 PR$/u,
  );
  assert.equal(overridden.failed, false);
});

test('a bot author or a main base lowers the fail to a warning', () => {
  for (const options of [
    { author: 'renovate[bot]' },
    { author: 'dependabot[bot]' },
    { baseRef: 'main' },
  ]) {
    const result = evaluate({ changedPaths: [MOBILE], ...options });

    assertFinding(result, 'warn', /apps\/mobile\/src\/App\.tsx.*\(경고로 낮춤: /u);
    assert.equal(result.failed, false, JSON.stringify(options));
  }
});

test('a BFF route takes the more specific BFF area and a cross-cutting key alone is an area', () => {
  const result = evaluate({ changedPaths: [BFF_ROUTE, DEPLOY] });

  assert.deepEqual(areaFindings(result), [
    { check: 'W-AREA', level: 'pass', reason: '제품 경로 2개, 영역 bff, security-privacy' },
  ]);

  const frontend = evaluate({ changedPaths: [FE_PAGE] });
  assert.deepEqual(areaFindings(frontend), [
    { check: 'W-AREA', level: 'pass', reason: '제품 경로 1개, 영역 fe' },
  ]);
});

test('a diff without product paths passes without reading the catalog', () => {
  const result = evaluate({
    changedPaths: ['scripts/ci/lanes/classify-changes.mjs', 'docs/policies/README.md'],
    head: { [criteriaPath('web-bff-routes')]: null },
    headExemptions: [['', '이유 없는 glob']],
  });

  assert.deepEqual(areaFindings(result), [
    { check: 'W-AREA', level: 'pass', reason: '제품 경로 없음' },
  ]);
});

test('a broken catalog or a malformed exemption table fails the job closed when product paths changed', () => {
  const closed = (options, reason) =>
    assert.throws(
      () => evaluate({ changedPaths: [FE_PAGE], ...options }),
      (error) => error instanceof LifecycleInputError && reason.test(error.message),
    );

  closed(
    { head: { [criteriaPath('web-bff-routes')]: null } },
    /리뷰 기준 catalog 오류: criteria-document-missing: .*web-bff-routes\.md/u,
  );
  closed(
    { baseExemptions: [['`apps/web/e2e/**`', '']] },
    /^base docs\/development\/agent-workflows\/domain\/knu-binding\.md 영역 검사 표 형식 오류: 이유 없는 행/u,
  );
  closed(
    { baseExemptions: [['e2e 전체', '검증 코드']] },
    /^base .* 영역 검사 표 형식 오류: glob 없는 행/u,
  );
  closed(
    { headExemptions: [...BASE_EXEMPTIONS, ['`apps/web/vitest.config.ts`', '']] },
    /^head .* 영역 검사 표 형식 오류: 이유 없는 행/u,
  );
});

test('exemption globs that match no tracked file or also cover a path with an area only warn', () => {
  const result = evaluate({
    changedPaths: [FE_PAGE],
    headExemptions: [
      ...BASE_EXEMPTIONS,
      ['`apps/web/missing/**`', '없는 경로'],
      ['`apps/web/src/app/page.tsx`', '영역 키에도 맞는 경로'],
    ],
  });

  assertFinding(result, 'pass', /^제품 경로 1개, 영역 fe$/u);
  assertFinding(result, 'warn', /^추적 파일에 맞지 않는 제외 glob: apps\/web\/missing\/\*\*$/u);
  assertFinding(
    result,
    'warn',
    /^영역 있는 경로를 덮는 제외 glob: apps\/web\/src\/app\/page\.tsx\(1개, 예: apps\/web\/src\/app\/page\.tsx 영역 fe\)$/u,
  );
  assert.equal(result.failed, false);
});

test('the repository exemption table has a glob and a reason in every row', () => {
  const binding = readFileSync(
    fileURLToPath(new URL(`../../../${BINDING_FILE}`, import.meta.url)),
    'utf8',
  );
  const table = parseExemptionTable(binding, BINDING_FILE);

  assert.notEqual(table, null, `${BINDING_FILE}에 '## 영역 검사' 절 없음`);
  assert.ok(table.length > 0, `${BINDING_FILE} 영역 검사 표에 행 없음`);
  for (const row of table) {
    assert.ok(row.include.length > 0, JSON.stringify(row));
    assert.match(row.reason, /\S/u, JSON.stringify(row));
  }
});
