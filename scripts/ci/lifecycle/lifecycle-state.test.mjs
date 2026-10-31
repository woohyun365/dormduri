// Lifecycle state calculator (lifecycle-state.mjs) against the state machine fixtures: layer states and failed guards,
// result classification, upstream recheck, overrides, the implementation boundary, reverse targets, the same-fix stop,
// the blocked report, the irreversible decision rule against assessPlanReadiness, every judgement input and the CLI.
// The last test pins the grade values the calculator reads, the guide's grade and check tables and the document header
// edge cases.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, relative, resolve, sep } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { assessPlanReadiness } from '../../agents/common/plan-readiness-policy.mjs';
import { loadWorkspaceLayout } from '../../artifacts/workspace-layout.mjs';
import { checkDocumentHeader } from './document-header.mjs';
import { headerStatus, LifecycleInputError } from './policy-first-check.mjs';
import { LIFECYCLE_CHECKS } from './run.mjs';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const FIXTURES = fileURLToPath(new URL('./fixtures/state/', import.meta.url));
const CLI = fileURLToPath(new URL('./lifecycle-state.mjs', import.meta.url));
const KNU_REPO = resolve(FIXTURES, 'knu-repo');
const GUIDE = 'docs/development/agent-workflows/lifecycle-state-machine.md';
const READINESS_POLICY = 'scripts/agents/common/plan-readiness-policy.mjs';
// Imported inside each test, so a missing calculator fails each fixture on its own.
const stateModule = () => import('./lifecycle-state.mjs');
const definition = JSON.parse(
  readFileSync(resolve(repoRoot, 'scripts/ci/lifecycle/lifecycle-definition.json'), 'utf8'),
);
const allPass = () => JSON.parse(readFileSync(resolve(FIXTURES, 'feature-all-pass.json'), 'utf8'));
const ids = (entries) => entries.map((entry) => entry.id);
const byId = (entries, id) => entries.filter((entry) => entry.id === id);
const finding = (check, level, reason) => ({ check, level, reason });
const runCli = (args) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });

async function calculator() {
  const module = await stateModule();
  return { ...module, compute: (input) => module.computeLifecycleState(input, definition) };
}

// Repository reads over the KNU-shaped fixture tree, the shape collectProjectInputs takes.
const fixtureReader = (root) => ({
  readFile(path) {
    try {
      return readFileSync(resolve(root, path), 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  },
  listFiles(directory) {
    const base = resolve(root, directory);
    try {
      return readdirSync(base, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) =>
          [directory, relative(base, join(entry.parentPath, entry.name)).split(sep).join('/')].join(
            '/',
          ),
        )
        .sort();
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  },
});

// The fixture reader with some files replaced, added or (with null) removed (repository path → text).
const overlayReader = (base, files) => ({
  readFile: (path) => (path in files ? files[path] : base.readFile(path)),
  listFiles: (directory) =>
    [
      ...new Set([
        ...base.listFiles(directory),
        ...Object.keys(files).filter((path) => path.startsWith(`${directory}/`)),
      ]),
    ]
      .filter((path) => files[path] !== null)
      .sort(),
});
const MAP_PATH = 'docs/product/artifact-map.json';
const knuMap = () => JSON.parse(readFileSync(resolve(KNU_REPO, MAP_PATH), 'utf8'));
// A tracking record item as the calculator input takes it.
const recordItem = (id, mapping, status, sources = []) => ({
  id,
  path: MAP_PATH,
  record: {
    mapping,
    sources,
    confirmedBy:
      status === 'owner-confirmed'
        ? { status, date: '2026-10-01', basis: '#10' }
        : { status, date: null, basis: null },
  },
});

test('fixture 1 추상 fresh 요청은 discovery·planned이고 만든 블록의 검증 오류가 없다', async () => {
  const { compute, buildBlockedReport, validateBlockedReport, renderBlockedMarkdown } =
    await calculator();
  const result = compute({
    schema: 'lifecycle-state-input/v1',
    grade: 'feature',
    artifacts: { config: { id: 'config', path: '.htc/config.json' } },
  });
  assert.equal(result.schema, 'lifecycle-state/v1');
  assert.equal(result.project.state, 'discovery');
  assert.equal(result.project.failed[0].id, 'P-DIRECTION');
  assert.equal(result.work.state, 'planned');
  assert.equal(result.work.failed[0].id, 'W-SCOPE');

  const fields = {
    request: '팀 일정 관리 앱을 만들어 줘',
    state: { project: result.project.state, work: result.work.state },
    failedGuards: [...result.project.failed, ...result.work.failed],
    questions: [
      {
        id: 'q1',
        guard: 'P-DIRECTION',
        decisionRef: null,
        text: '이 앱은 누가 가장 먼저 쓰나요?',
        options: [
          { id: 'a', summary: '작은 팀 하나', tradeoff: '빨리 시작하지만 권한 모델이 단순하다' },
        ],
        default: { option: 'a', why: '첫 사용자를 좁히면 PRD 개요를 바로 확인할 수 있다' },
        reversible: 'easy',
        expertCheck: false,
      },
    ],
    resume: ['PRD 개요 owner-confirmed'],
    inspected: ['.htc/config.json'],
  };
  const block = buildBlockedReport(fields);
  assert.equal(block.schema, 'lifecycle-blocked/v1');
  assert.deepEqual(validateBlockedReport(block), []);
  assert.deepEqual(validateBlockedReport({ ...block, grade: 'feature' }), [
    { field: 'grade', code: 'unknown-field' },
  ]);
  const { failedGuards, ...withoutGuards } = block;
  assert.ok(failedGuards.length);
  assert.deepEqual(validateBlockedReport(withoutGuards), [
    { field: 'failedGuards', code: 'missing-field' },
  ]);
  assert.deepEqual(
    validateBlockedReport({ ...block, failedGuards: [{ id: 'P-DIRECTION', reason: '없음' }] }),
    [{ field: 'failedGuards[0].needs', code: 'missing-field' }],
  );
  assert.deepEqual(
    validateBlockedReport({
      ...block,
      questions: [{ ...block.questions[0], options: [{ ...block.questions[0].options[0], x: 1 }] }],
    }),
    [{ field: 'questions[0].options[0].x', code: 'unknown-field' }],
  );
  assert.throws(() => buildBlockedReport({ ...fields, grade: 'feature' }), LifecycleInputError);
  const markdown = renderBlockedMarkdown(block);
  for (const text of ['P-DIRECTION', 'W-SCOPE', '이 앱은 누가 가장 먼저 쓰나요?', '`discovery`'])
    assert.ok(markdown.includes(text), text);
});

test('fixture 2 정책 없는 도메인 변경은 policy-ready에서 W-POLICY 실패다', async () => {
  const { compute } = await calculator();
  const input = allPass();
  input.plan.domains = ['matching', 'payments'];
  const result = compute(input);
  assert.equal(result.project.state, 'architected');
  assert.equal(result.work.state, 'policy-ready');
  assert.deepEqual(ids(result.work.failed), ['W-POLICY']);
  assert.match(result.work.failed[0].reason, /payments/u);
});

test('fixture 3 오탈자는 trivial skip 넷으로 evidenced이고 L1이 draft면 implementing의 P-ARCH다', async () => {
  const { compute } = await calculator();
  const input = { ...allPass(), grade: 'trivial', plan: null, changedPaths: ['docs/guide.md'] };
  const result = compute(input);
  assert.equal(result.work.state, 'evidenced');
  assert.deepEqual(result.work.skipped, ['W-SCOPE', 'W-POLICY', 'W-READY', 'W-PATHS']);
  assert.deepEqual(result.work.failed, []);

  input.artifacts.l1.header.status = 'draft';
  const draft = compute(input);
  assert.equal(draft.work.state, 'implementing');
  assert.equal(draft.work.failed[0].id, 'P-ARCH');
  assert.equal(draft.project.failed[0].id, 'P-ARCH');
});

test('fixture 4 정책 변경이 필요한 bugfix는 feature로 올린다', async () => {
  const { compute } = await calculator();
  const raised = compute({ ...allPass(), grade: 'bugfix', bugfixBasis: 'missing' });
  assert.equal(raised.grade.declared, 'bugfix');
  assert.equal(raised.grade.effective, 'feature');
  assert.match(raised.grade.raised, /feature/u);
  assert.deepEqual(raised.work.skipped, []);

  const kept = compute({ ...allPass(), grade: 'bugfix', bugfixBasis: 'found' });
  assert.deepEqual(kept.grade, { declared: 'bugfix', effective: 'bugfix', raised: null });
});

test('fixture 5 확인 거절은 검토 대상 상태의 처음으로 돌아간다', async () => {
  const { reverseTarget } = await calculator();
  assert.equal(reverseTarget('R-REJECT', { reviewedState: 'discovery' }, definition), 'discovery');
  assert.equal(
    reverseTarget('R-REJECT', { reviewedState: 'policy-ready' }, definition),
    'policy-ready',
  );
  assert.throws(
    () => reverseTarget('R-REJECT', { reviewedState: 'exploring' }, definition),
    LifecycleInputError,
  );
  assert.deepEqual(reverseTarget('R-AMBIG', {}, definition), ['planned', 'policy-ready']);
});

test('fixture 6 W-DESIGN은 시각 품질 claim이 있을 때만 계산한다', async () => {
  const { compute } = await calculator();
  const input = allPass();
  input.plan.designConfirmation = null;
  const unconfirmed = compute(input);
  assert.equal(unconfirmed.work.state, 'policy-ready');
  assert.deepEqual(ids(unconfirmed.work.failed), ['W-DESIGN']);

  input.plan.visualClaim = false;
  const noClaim = compute(input);
  assert.equal(noClaim.work.state, 'evidenced');
  for (const list of [noClaim.work.failed, noClaim.work.warnings, noClaim.work.skipped])
    assert.ok(!ids(list).includes('W-DESIGN') && !list.includes('W-DESIGN'));
});

test('fixture 7 구현 불가 경계: 결정 목록 밖·easy·범위 안만 블록이 아니다', async () => {
  const { evaluateBoundary } = await calculator();
  assert.deepEqual(
    evaluateBoundary({ packDecisionId: null, reversibility: 'easy', inScope: true }),
    {
      blocked: false,
      reverse: null,
      reasons: [],
    },
  );
  assert.deepEqual(
    evaluateBoundary({
      packDecisionId: 'fe.render.server-client-default',
      reversibility: 'easy',
      inScope: true,
    }),
    { blocked: true, reverse: 'R-AMBIG', reasons: ['packDecisionId'] },
  );
  assert.deepEqual(
    evaluateBoundary({ packDecisionId: null, reversibility: 'costly', inScope: false }).reasons,
    ['reversibility', 'inScope'],
  );
  assert.throws(
    () => evaluateBoundary({ packDecisionId: null, reversibility: 'cheap', inScope: true }),
    LifecycleInputError,
  );
});

test('fixture 8 같은 결함 수정 3회 실패는 등급별 R-SIGNAL target에서 구조 문제를 묻는다', async () => {
  const { sameFixStop } = await calculator();
  const stop = (grade, failedFixes) => sameFixStop({ grade, failedFixes }, definition);
  assert.deepEqual(stop('bugfix', 3), {
    reverse: 'R-SIGNAL',
    target: 'baseline-check',
    ask: 'structure',
  });
  assert.equal(stop('bugfix', 2), null);
  assert.equal(stop('feature', 3).target, 'ready');
  assert.equal(stop('policy-change', 3).target, 'ready');
  assert.equal(stop('trivial', 3).target, 'implementing');
  assert.equal(stop('hotfix', 4).target, 'baseline-check');
  assert.throws(() => stop('typo', 3), LifecycleInputError);
});

test('fixture 9 W-REVIEW 경고·PASS 없음, 바뀐 경로 없음, W-AREA 실패', async () => {
  const { compute } = await calculator();
  const warned = allPass();
  warned.review.findings.push(finding('W-REVIEW', 'warn', 'PASS head ≠ PR head'));
  const passed = compute(warned);
  assert.equal(passed.work.state, 'evidenced');
  assert.ok(!ids(passed.work.failed).includes('W-REVIEW'));
  assert.deepEqual(ids(passed.work.warnings), ['W-REVIEW']);

  warned.review.pass = false;
  const noPass = compute(warned);
  assert.equal(noPass.work.state, 'reviewing');
  assert.equal(noPass.work.failed[0].id, 'W-REVIEW');
  for (const result of [passed, noPass]) assert.ok(!ids(result.work.failed).includes('W-PATHS'));

  const empty = { ...allPass(), changedPaths: [] };
  const unchanged = compute(empty);
  assert.equal(unchanged.work.state, 'implementing');
  assert.deepEqual(unchanged.work.failed[0], {
    id: 'W-PATHS',
    reason: '바뀐 경로 없음',
    needs: unchanged.work.failed[0].needs,
  });

  const area = allPass();
  area.areaFindings = [finding('W-AREA', 'fail', '영역 기준 없는 제품 경로: apps/api/src/x.ts')];
  const areaResult = compute(area);
  assert.deepEqual(ids(areaResult.work.checkFailures), ['W-AREA']);
  assert.equal(areaResult.work.state, compute(allPass()).work.state);
});

test('fixture 10 P-ARCH는 경로 표·L2 기록을 보고 미분류 제품 경로는 W-SCOPE 경고다', async () => {
  const { compute } = await calculator();
  const noTable = allPass();
  noTable.artifacts.pathDomains = null;
  const tableless = compute(noTable);
  assert.equal(tableless.project.state, 'architected');
  assert.deepEqual(ids(tableless.project.failed), ['P-ARCH']);
  assert.match(tableless.project.failed[0].needs, /^경로 표/u);

  const noL2 = allPass();
  noL2.artifacts.l2 = [];
  const withoutL2 = compute(noL2);
  assert.deepEqual(ids(withoutL2.project.failed), ['P-ARCH']);
  assert.match(withoutL2.project.failed[0].needs, /^L2 기록/u);

  const unclassified = allPass();
  unclassified.changedPaths.push('apps/api/src/billing/invoice.ts');
  unclassified.plan.paths.push('apps/api/src/billing/**');
  const result = compute(unclassified);
  assert.equal(result.work.state, 'evidenced');
  assert.deepEqual(byId(result.work.warnings, 'W-SCOPE'), [
    {
      id: 'W-SCOPE',
      reason: '미분류 제품 경로: apps/api/src/billing/invoice.ts',
      needs: '경로 표 행 추가(L-CONFIRM Owner 확인)',
    },
  ]);
});

test('fixture 11 KNU 대응 기록은 architected이고 PRD 개요는 legacy다', async () => {
  const { collectProjectInputs, compute } = await calculator();
  const artifacts = collectProjectInputs({
    ...fixtureReader(KNU_REPO),
    layout: loadWorkspaceLayout(),
  });
  assert.deepEqual(artifacts.config, { id: 'config', path: 'docs/product' });
  assert.equal(artifacts.prdOverview.record.mapping, 'legacy');
  assert.deepEqual(ids(artifacts.crossCutting), ['policy:legal-basis', 'policy:data-retention']);
  assert.deepEqual(ids(artifacts.policyDomains), [
    'policy:legal-basis',
    'policy:data-retention',
    'policy:service-boundary',
    'policy:matching-lifecycle',
  ]);
  assert.equal(artifacts.l1.record.mapping, 'composite');
  assert.deepEqual(ids(artifacts.l2), [
    'l2:docs/architecture/decisions/fe.md',
    'l2:docs/architecture/backend/session-transport-decision.md',
    'l2:docs/architecture/backend/schema-decision.md',
  ]);
  assert.equal(artifacts.l2[1].header.status, 'Accepted / current');

  const result = compute({ schema: 'lifecycle-state-input/v1', artifacts });
  assert.equal(result.project.state, 'architected');
  assert.deepEqual(result.project.failed, []);
  assert.deepEqual(result.project.legacy, ['prd-overview']);
  assert.deepEqual(result.project.recheck, []);

  const cli = runCli(['--repo', KNU_REPO]);
  assert.equal(cli.status, 0, cli.stderr);
  assert.deepEqual(JSON.parse(cli.stdout).project, result.project);

  const collect = (files) =>
    collectProjectInputs({
      ...overlayReader(fixtureReader(KNU_REPO), files),
      layout: loadWorkspaceLayout(),
    });
  // A tracking record that is not Owner-confirmed confirms nothing.
  const draftMap = knuMap();
  draftMap.confirmedBy = { status: 'draft', date: null, basis: null };
  const draft = compute({
    schema: 'lifecycle-state-input/v1',
    artifacts: collect({ [MAP_PATH]: JSON.stringify(draftMap) }),
  });
  assert.equal(draft.project.state, 'discovery');
  assert.equal(draft.project.failed[0].id, 'P-DIRECTION');
  assert.deepEqual(draft.project.legacy, []);

  // Key lines without a status line are no header (as headerStatus reads them): the record decides, and such a
  // decision document is no L2 record.
  const ownerOnly = '# 법적 근거\n\n**Owner**: legal\n\n본문\n';
  assert.equal(headerStatus(ownerOnly), null);
  const keysOnly = collect({
    'docs/policies/legal-basis.md': ownerOnly,
    'docs/architecture/decisions/be.md': '# BE 결정\n\n**Owner**: be\n\n본문\n',
  });
  assert.ok('record' in byId(keysOnly.policyDomains, 'policy:legal-basis')[0]);
  assert.ok(!ids(keysOnly.l2).includes('l2:docs/architecture/decisions/be.md'));
  assert.equal(
    compute({ schema: 'lifecycle-state-input/v1', artifacts: keysOnly }).project.state,
    'architected',
  );

  // Record sources outside the repository are an input error, never read.
  for (const source of ['../outside.md', '/etc/hosts']) {
    const outside = knuMap();
    outside.artifacts.push({ artifact: `l2:${source}`, mapping: 'doc', sources: [source] });
    assert.throws(() => collect({ [MAP_PATH]: JSON.stringify(outside) }), LifecycleInputError);
  }
});

test('대응 기록 항목은 기록의 Owner 확인으로만 충족이고 not-applicable도 같다', async () => {
  const { compute } = await calculator();
  const legacy = (status) => {
    const input = allPass();
    input.artifacts.prdOverview = recordItem('prd-overview', 'legacy', status);
    return compute(input);
  };
  const unconfirmed = legacy('draft');
  assert.equal(unconfirmed.project.state, 'discovery');
  assert.deepEqual(ids(unconfirmed.project.failed), ['P-DIRECTION']);
  assert.deepEqual(unconfirmed.project.legacy, []);
  const confirmed = legacy('owner-confirmed');
  assert.equal(confirmed.project.state, 'architected');
  assert.deepEqual(confirmed.project.failed, []);
  assert.deepEqual(confirmed.project.legacy, ['prd-overview']);

  const notApplicable = (status) => {
    const input = allPass();
    input.artifacts.policyDomains[1] = recordItem('policy:matching', 'not-applicable', status);
    return compute(input);
  };
  const open = notApplicable('draft');
  assert.equal(open.work.state, 'policy-ready');
  assert.deepEqual(ids(open.work.failed), ['W-POLICY']);
  assert.equal(notApplicable('owner-confirmed').work.state, 'evidenced');
});

// The decision record states as plan-readiness-policy.mjs declares them.
function readinessDecisionStates() {
  const source = readFileSync(resolve(repoRoot, READINESS_POLICY), 'utf8');
  const list = /const DECISION_STATES = new Set\(\[([^\]]*)\]\)/u.exec(source)?.[1] ?? '';
  return [...list.matchAll(/'([^']+)'/gu)].map((match) => match[1]);
}

const readinessInput = (decisions) => ({
  schemaVersion: 1,
  planId: 'lifecycle-fixture',
  status: 'implementation-ready',
  evidenceSurface: 'tracked-only',
  baseline: {
    branch: 'feat/fixture',
    head: 'a'.repeat(40),
    workingTree: { state: 'inspected', protectedPaths: [] },
    localRuntime: { state: 'verified', requiredEvidence: [] },
  },
  decisions,
});

test('fixture 12 W-READY 비가역 확인은 assessPlanReadiness와 24경우 같다', async () => {
  const { compute, DECISION_STATES } = await calculator();
  const input = allPass();
  input.plan.decisions = [{ id: 'be.matching.store', irreversible: true, status: 'unknown' }];
  const unconfirmed = compute(input);
  assert.equal(unconfirmed.work.state, 'ready');
  assert.equal(unconfirmed.work.failed[0].id, 'W-READY');
  assert.equal(unconfirmed.work.failed[0].reason, 'irreversible-decision-unconfirmed');

  const states = readinessDecisionStates();
  assert.equal(states.length, 6);
  assert.deepEqual(DECISION_STATES, states);
  const cases = [];
  for (const status of states)
    for (const irreversible of [true, false])
      for (const ownerConfirmation of [null, { date: '2026-10-06', source: '#15' }]) {
        const decision = { id: 'be.matching.store', irreversible, status, ownerConfirmation };
        const caseInput = allPass();
        caseInput.plan.decisions = [decision];
        const calculated = compute(caseInput).work.failed.some(
          (entry) => entry.id === 'W-READY' && entry.reason === 'irreversible-decision-unconfirmed',
        );
        const assessed = assessPlanReadiness(readinessInput([decision])).blockingFindings.some(
          (entry) => entry.code === 'irreversible-decision-unconfirmed',
        );
        assert.equal(calculated, assessed, JSON.stringify(decision));
        cases.push(calculated);
      }
  assert.equal(cases.length, 24);
  assert.ok(cases.includes(true) && cases.includes(false));
});

test('fixture 13 R-UPSTREAM은 확인일 비교로 W-READY·W-POLICY를 실패시킨다', async () => {
  const { compute, upstreamRecheck } = await calculator();
  const stalePlan = allPass();
  stalePlan.plan.readinessPass.date = '2026-10-01';
  stalePlan.artifacts.l1.header.confirmedOn = '2026-10-10';
  const ready = compute(stalePlan);
  assert.equal(ready.work.state, 'ready');
  assert.deepEqual(ready.work.failed[0], {
    id: 'W-READY',
    reason: 'R-UPSTREAM',
    needs: ready.work.failed[0].needs,
  });
  assert.ok(upstreamRecheck(stalePlan).plan.stale);

  const stalePolicy = allPass();
  stalePolicy.artifacts.prdOverview.header.confirmedOn = '2026-10-05';
  const policy = compute(stalePolicy);
  assert.equal(policy.work.state, 'policy-ready');
  assert.equal(policy.work.failed[0].id, 'W-POLICY');
  assert.equal(policy.work.failed[0].reason, 'R-UPSTREAM');
  assert.deepEqual(byId(policy.project.recheck, 'policy:matching'), [
    { id: 'policy:matching', upstream: ['prd-overview'] },
  ]);

  // A record item is found by its sources: L1 kept in the tracking record and confirmed after the L2 decision that
  // links it.
  const recordL1 = allPass();
  recordL1.artifacts.l1 = recordItem('l1', 'composite', 'owner-confirmed', [
    'docs/architecture/README.md',
  ]);
  recordL1.artifacts.l1.record.confirmedBy.date = '2026-10-20';
  assert.deepEqual(
    byId(compute(recordL1).project.recheck, 'l2:docs/architecture/decisions/be.md'),
    [{ id: 'l2:docs/architecture/decisions/be.md', upstream: ['l1'] }],
  );

  // bugfix·hotfix·trivial do not compare dates; the project recheck list stays.
  const bugfix = compute({ ...stalePolicy, grade: 'bugfix', bugfixBasis: 'found' });
  assert.equal(bugfix.work.state, 'evidenced');
  assert.deepEqual(bugfix.project.recheck, policy.project.recheck);
});

test('fixture 14 override는 실패를 override 표시 경고로 옮기고 L-CONFIRM은 예외다', async () => {
  const { compute, NON_OVERRIDABLE } = await calculator();
  assert.deepEqual(
    NON_OVERRIDABLE,
    LIFECYCLE_CHECKS.flatMap((check) => check.nonOverridable ?? []),
  );
  const override = (check) => ({
    check,
    reason: 'Owner 지시로 진행',
    revisit: '다음 같은 도메인 PR',
  });

  const design = allPass();
  design.plan.designConfirmation = null;
  design.overrides = [override('W-DESIGN')];
  const designResult = compute(design);
  assert.equal(designResult.work.state, 'evidenced');
  assert.deepEqual(byId(designResult.work.warnings, 'W-DESIGN'), [
    {
      id: 'W-DESIGN',
      reason: '시각 방향 확정 기록 없음',
      override: { reason: 'Owner 지시로 진행', revisit: '다음 같은 도메인 PR' },
    },
  ]);

  const irreversible = allPass();
  irreversible.policyFindings.push(finding('W-IRREV', 'fail', '비가역 경로 변경'));
  irreversible.overrides = [override('W-IRREV')];
  const irreversibleResult = compute(irreversible);
  assert.deepEqual(irreversibleResult.work.checkFailures, []);
  assert.ok(byId(irreversibleResult.work.warnings, 'W-IRREV')[0].override);

  const paths = allPass();
  paths.changedPaths.push('docs/notes.md');
  paths.overrides = [override('W-PATHS')];
  const pathsResult = compute(paths);
  assert.equal(pathsResult.work.state, 'evidenced');
  assert.match(byId(pathsResult.work.warnings, 'W-PATHS')[0].reason, /docs\/notes\.md/u);
  assert.ok(byId(pathsResult.work.warnings, 'W-PATHS')[0].override);

  const confirm = allPass();
  confirm.policyFindings.push(finding('L-CONFIRM', 'fail', 'Owner 확인 줄 없음'));
  confirm.overrides = [override('L-CONFIRM')];
  const confirmResult = compute(confirm);
  assert.deepEqual(ids(confirmResult.work.checkFailures), ['L-CONFIRM']);
  const confirmWarnings = byId(confirmResult.work.warnings, 'L-CONFIRM');
  assert.equal(confirmWarnings.length, 1);
  assert.match(confirmWarnings[0].reason, /override 대상이 아님/u);
  assert.equal(confirmWarnings[0].override, undefined);

  const unused = allPass();
  unused.overrides = [override('W-MERGE')];
  assert.deepEqual(compute(unused), compute(allPass()));
});

test('fixture 15 결과·입력 오류', async () => {
  const { compute } = await calculator();
  const bugfix = { ...allPass(), grade: 'bugfix', bugfixBasis: 'found' };
  const withFinding = {
    ...bugfix,
    policyFindings: [...bugfix.policyFindings, finding('W-IRREV', 'fail', '비가역 경로 변경')],
  };
  const result = compute(withFinding);
  assert.deepEqual(ids(result.work.checkFailures), ['W-IRREV']);
  assert.equal(result.work.state, compute(bugfix).work.state);

  assert.throws(() => compute({ ...allPass(), grade: 'typo' }), LifecycleInputError);
  assert.throws(
    () => compute({ ...allPass(), schema: 'lifecycle-state-input/v2' }),
    LifecycleInputError,
  );
  const { artifacts, ...withoutArtifacts } = allPass();
  assert.ok(artifacts);
  assert.throws(() => compute(withoutArtifacts), LifecycleInputError);
  assert.throws(
    () => compute({ ...allPass(), overrides: [{ check: 'W-DESIGN', reason: '이유' }] }),
    LifecycleInputError,
  );
  const { grade, ...withoutGrade } = allPass();
  assert.equal(grade, 'feature');
  assert.equal(compute(withoutGrade).grade.effective, 'feature');

  // Parenthesised output labels are not checks and are not read; any other id outside `checks` is an input error.
  const labelled = allPass();
  labelled.policyFindings.push(
    finding('(경로)', 'warn', '미분류 제품 경로: apps/x.ts'),
    finding('(형식)', 'fail', '절 형식'),
  );
  assert.deepEqual(compute(labelled), compute(allPass()));
  const typo = allPass();
  typo.policyFindings.push(finding('W-SCOPES', 'fail', '오타'));
  assert.throws(() => compute(typo), LifecycleInputError);

  for (const args of [
    ['--repo', KNU_REPO, '--input', resolve(FIXTURES, 'no-such-input.json')],
    ['--repo', resolve(FIXTURES, 'no-such-repo')],
  ]) {
    const missing = runCli(args);
    assert.equal(missing.status, 2, args.join(' '));
    assert.equal(missing.stdout, '');
    assert.equal(missing.stderr.trim().split('\n').length, 1);
    assert.match(missing.stderr, /no-such-(input\.json|repo)/u);
  }
});

// Input coverage: every guard and registered check row with the one input value that fails it, from the all-pass
// feature input, and where the id then appears. P-GRADE has no failing value.
const GUARD_ROWS = [
  ['P-INIT', (input) => (input.artifacts.config = null), 'project.failed'],
  ['P-GRADE', null, null],
  [
    'P-DIRECTION',
    (input) => (input.artifacts.prdOverview.header.status = 'draft'),
    'project.failed',
  ],
  ['P-POLICY-SET', (input) => (input.artifacts.crossCutting = null), 'project.failed'],
  [
    'P-POLICY-BASE',
    (input) => (input.artifacts.crossCutting[0].header.status = 'draft'),
    'project.failed',
  ],
  ['P-ARCH', (input) => (input.artifacts.l1.header.status = 'draft'), 'project.failed'],
  ['W-SCOPE', (input) => delete input.plan.paths, 'work.failed'],
  [
    'W-POLICY',
    (input) => (input.artifacts.policyDomains[1].header.status = 'draft'),
    'work.failed',
  ],
  ['W-DESIGN', (input) => (input.plan.designConfirmation = null), 'work.failed'],
  ['W-READY', (input) => (input.plan.implementationReady = false), 'work.failed'],
  ['W-PATHS', (input) => input.changedPaths.push('docs/notes.md'), 'work.failed'],
  ['W-REVIEW', (input) => (input.review.pass = false), 'work.failed'],
  ['W-MERGE', (input) => (input.merged = false), 'work.failed'],
  ['W-EVID', (input) => (input.evidenced = false), 'work.failed'],
];
// Further failing values of guards with more than one judgement input, with the reason they give.
const MORE_GUARD_ROWS = [
  [
    'P-POLICY-SET',
    (input) => (input.artifacts.policyDomains = null),
    'project.failed',
    '정책 도메인 목록 없음',
  ],
  [
    'W-READY',
    (input) => (input.plan.readinessPass = null),
    'work.failed',
    'readiness PASS 날짜 없음',
  ],
  ['W-REVIEW', (input) => (input.review.settled = false), 'work.failed', '리뷰 정산 없음'],
];
const CHECK_ROWS = [
  ['W-SCOPE', 'policyFindings', 'fail', 'work.failed', 'W-SCOPE'],
  ['W-POLICY', 'policyFindings', 'fail', 'work.failed', 'W-POLICY'],
  ['W-CITE', 'policyFindings', 'fail', 'work.failed', 'W-READY'],
  ['W-REVIEW', 'review.findings', 'warn', 'work.warnings', 'W-REVIEW'],
  ['W-IRREV', 'policyFindings', 'fail', 'work.checkFailures', 'W-IRREV'],
  ['L-CONFIRM', 'policyFindings', 'fail', 'work.checkFailures', 'L-CONFIRM'],
  ['W-AREA', 'areaFindings', 'fail', 'work.checkFailures', 'W-AREA'],
  ['W-CAUSE', 'review.findings', 'warn', 'work.warnings', 'W-CAUSE'],
];

test('fixture 16 판정 입력 전수: 한 입력만 실패 값이면 그 id가 표의 기대 위치에 있다', async () => {
  const { compute } = await calculator();
  assert.deepEqual(
    GUARD_ROWS.map(([id]) => id),
    definition.guards.map((guard) => guard.id),
  );
  // Check rows keep the input coverage record's order; the ids are the definition's.
  assert.deepEqual(
    CHECK_ROWS.map(([id]) => id).sort(),
    definition.checks.map((check) => check.id).sort(),
  );

  const passing = compute(allPass());
  assert.equal(passing.project.state, 'architected');
  assert.equal(passing.work.state, 'evidenced');
  for (const list of ['project.failed', 'work.failed', 'work.warnings', 'work.checkFailures'])
    assert.deepEqual(
      list.split('.').reduce((value, key) => value[key], passing),
      [],
      list,
    );
  assert.deepEqual(passing.work.skipped, []);

  const at = (result, where) => where.split('.').reduce((value, key) => value[key], result);
  for (const [id, mutate, where] of GUARD_ROWS) {
    if (!mutate) continue;
    const input = allPass();
    mutate(input);
    assert.equal(at(compute(input), where)[0]?.id, id, `guard ${id}`);
  }
  for (const [id, mutate, where, reason] of MORE_GUARD_ROWS) {
    const input = allPass();
    mutate(input);
    const [first] = at(compute(input), where);
    assert.deepEqual([first?.id, first?.reason], [id, reason], `guard ${id}`);
  }
  for (const [id, source, level, where, expected] of CHECK_ROWS) {
    const input = allPass();
    const list = source === 'review.findings' ? input.review.findings : input[source];
    list.push(finding(id, level, `${id} 실패 값`));
    const entries = at(compute(input), where);
    const found =
      where === 'work.failed' ? entries[0]?.id === expected : ids(entries).includes(expected);
    assert.ok(found, `check ${id} → ${where} ${expected}`);
  }
});

test('bugfix·hotfix는 프로젝트 층 첫 실패를 work.failed에 두고 W-SCOPE·W-PATHS를 경고로 계산한다', async () => {
  const { compute } = await calculator();
  for (const grade of ['bugfix', 'hotfix']) {
    const shortPath = () => ({
      ...allPass(),
      grade,
      bugfixBasis: 'found',
      plan: { domains: ['matching'], layers: ['be'], paths: ['apps/api/src/matching/**'] },
    });
    const clean = compute(shortPath());
    assert.equal(clean.work.state, 'evidenced', grade);
    assert.deepEqual(clean.work.failed, [], grade);
    assert.deepEqual(clean.work.skipped, ['W-READY'], grade);

    const draftL1 = shortPath();
    draftL1.artifacts.l1.header.status = 'draft';
    const gated = compute(draftL1);
    assert.equal(gated.work.state, 'policy-ready', grade);
    assert.deepEqual(ids(gated.work.failed), ['P-ARCH'], grade);

    const undeclared = shortPath();
    delete undeclared.plan.paths;
    undeclared.policyFindings.push(finding('W-SCOPE', 'fail', '판정 도메인이 선언에 없음'));
    const warned = compute(undeclared);
    assert.equal(warned.work.state, 'evidenced', grade);
    assert.deepEqual(warned.work.failed, [], grade);
    assert.ok(ids(warned.work.warnings).includes('W-SCOPE'), grade);
    assert.ok(ids(warned.work.warnings).includes('W-PATHS'), grade);

    const outside = shortPath();
    outside.changedPaths.push('docs/notes.md');
    const outsideResult = compute(outside);
    assert.equal(outsideResult.work.state, 'evidenced', grade);
    assert.deepEqual(ids(outsideResult.work.warnings), ['W-PATHS'], grade);
  }

  const feature = allPass();
  delete feature.plan.paths;
  assert.equal(compute(feature).work.failed[0].id, 'W-SCOPE');
});

// Rows of the first table under a `## ` heading of the guide, each cell as its backticked values.
function guideTable(text, heading) {
  const lines = text.split('\n');
  const start = lines.indexOf(`## ${heading}`);
  assert.ok(start >= 0, `${GUIDE}: ## ${heading} 절 없음`);
  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
  return lines
    .slice(start + 1, end < 0 ? undefined : end)
    .filter((line) => line.startsWith('|'))
    .slice(2)
    .map((row) =>
      row
        .split('|')
        .slice(1, -1)
        .map((cell) => [...cell.matchAll(/`([^`]+)`/gu)].map((match) => match[1])),
    );
}

const BUGFIX_PATH = {
  path: ['policy-ready', 'implementing', 'reviewing', 'merged', 'evidenced'],
  steps: ['baseline-check', 'reproduce', 'cause-hypothesis', 'confirm', 'red'],
  skip: ['W-READY'],
  warnOnly: ['W-SCOPE', 'W-PATHS'],
};
const FEATURE_PATH = {
  path: ['planned', 'policy-ready', 'ready', 'implementing', 'reviewing', 'merged', 'evidenced'],
  steps: [],
  skip: [],
  warnOnly: [],
};
// Grade values the calculator reads: path, procedure steps, skip and warnOnly of each change grade.
const GRADES = {
  trivial: {
    path: ['implementing', 'reviewing', 'merged', 'evidenced'],
    steps: [],
    skip: ['W-SCOPE', 'W-POLICY', 'W-READY', 'W-PATHS'],
    warnOnly: [],
  },
  bugfix: BUGFIX_PATH,
  hotfix: BUGFIX_PATH,
  feature: FEATURE_PATH,
  'policy-change': FEATURE_PATH,
};

test('등급 값과 문서 등급·등록 검사 표가 정의와 같고 header 확인 근거·확인일 형식·상태 줄을 검사한다', () => {
  assert.deepEqual(definition.grades, GRADES);
  const guide = readFileSync(resolve(repoRoot, GUIDE), 'utf8');
  const grades = {};
  for (const [names, path, steps, skip, warnOnly] of guideTable(guide, '변경 등급'))
    for (const name of names) grades[name] = { path, steps, skip, warnOnly };
  assert.deepEqual(grades, definition.grades);
  assert.deepEqual(
    guideTable(guide, '등록 검사').map(([[id], [module], guard]) => ({
      id,
      module,
      guard: guard[0] ?? null,
    })),
    definition.checks.map((check) => ({
      id: check.id,
      module: basename(check.module),
      guard: check.guard,
    })),
  );

  const document = (...keys) => ['# 제목', '', ...keys, '', '본문'].join('\n');
  const basis = '**근거**: [PRD 개요](../product/overview.md)';
  const noReference = checkDocumentHeader(
    document('**상태**: owner-confirmed', '**확인일**: 2026-10-28', basis),
  );
  assert.deepEqual(
    noReference.map((entry) => entry.code),
    ['header-confirmed-fields-missing'],
  );
  assert.match(noReference[0].message, /확인 근거/u);
  for (const date of ['2026-10-3', '2026/10/28', '28 Oct 2026']) {
    const findings = checkDocumentHeader(
      document('**상태**: owner-confirmed', `**확인일**: ${date}`, '**확인 근거**: #1', basis),
    );
    assert.deepEqual(
      findings.map((entry) => entry.code),
      ['header-confirmed-fields-missing'],
      date,
    );
    assert.match(findings[0].message, /확인일\(YYYY-MM-DD\)/u, date);
  }
  const statusless = checkDocumentHeader(
    document('**확인일**: 2026-10-28', '**확인 근거**: #1', basis),
  );
  assert.deepEqual(
    statusless.map((entry) => entry.code),
    ['header-status-invalid'],
  );
  assert.match(statusless[0].message, /상태 줄 없음/u);
});

test('층마다 첫 실패 상태에서 멈추고 같은 상태를 나가는 guard는 함께 계산한다', async () => {
  const { compute } = await calculator();
  const fresh = compute({
    schema: 'lifecycle-state-input/v1',
    artifacts: { config: { id: 'config', path: '.htc/config.json' } },
  });
  assert.deepEqual(ids(fresh.project.failed), ['P-DIRECTION']);
  assert.deepEqual([...new Set(ids(fresh.work.failed))], ['W-SCOPE']);

  const both = allPass();
  both.plan.domains.push('payments');
  both.plan.designConfirmation = null;
  const policyReady = compute(both);
  assert.equal(policyReady.work.state, 'policy-ready');
  assert.deepEqual(ids(policyReady.work.failed), ['W-POLICY', 'W-DESIGN']);

  const draftOverview = allPass();
  draftOverview.artifacts.prdOverview.header.status = 'draft';
  const planned = compute(draftOverview);
  assert.equal(planned.work.state, 'planned');
  assert.deepEqual(
    planned.work.failed.map((entry) => [entry.id, entry.reason]),
    [['W-SCOPE', '프로젝트 층이 architected가 아님: P-DIRECTION 실패']],
  );
});

test('작업 층 시작 확인은 bugfix·hotfix가 프로젝트 층 전체, trivial이 L1만 보고 path 밖 guard는 계산하지 않는다', async () => {
  const { compute } = await calculator();
  for (const grade of ['bugfix', 'hotfix']) {
    const input = { ...allPass(), grade, bugfixBasis: 'found' };
    input.artifacts.prdOverview.header.status = 'draft';
    const result = compute(input);
    assert.equal(result.work.state, 'policy-ready', grade);
    assert.deepEqual(ids(result.work.failed), ['P-DIRECTION'], grade);
  }
  const trivial = (change) => {
    const input = { ...allPass(), grade: 'trivial', plan: null, changedPaths: ['docs/guide.md'] };
    change(input);
    return compute(input);
  };
  const tableless = trivial((input) => {
    input.artifacts.pathDomains = null;
  });
  assert.deepEqual(ids(tableless.project.failed), ['P-ARCH']);
  assert.equal(tableless.work.state, 'evidenced');
  assert.deepEqual(tableless.work.failed, []);
  const design = trivial((input) => {
    input.plan = { visualClaim: true };
  });
  assert.equal(design.work.state, 'evidenced');
  assert.deepEqual(design.work.failed, []);
});

test('W-SCOPE는 선언 field 셋을 보고 W-POLICY는 경로 표가 판정한 도메인도 본다', async () => {
  const { compute } = await calculator();
  for (const [field, change] of [
    ['domains', (plan) => delete plan.domains],
    ['layers', (plan) => delete plan.layers],
    ['paths', (plan) => (plan.paths = [])],
  ]) {
    const input = allPass();
    change(input.plan);
    const result = compute(input);
    assert.equal(result.work.state, 'planned', field);
    assert.deepEqual(
      result.work.failed.map((entry) => [entry.id, entry.reason]),
      [['W-SCOPE', `plan 선언 없음: ${field}`]],
      field,
    );
  }
  const judged = {
    ...allPass(),
    grade: 'bugfix',
    bugfixBasis: 'found',
    plan: null,
    changedPaths: ['apps/api/src/payments/charge.ts'],
  };
  judged.artifacts.pathDomains.table.entries.push({
    globs: ['apps/api/src/payments/**'],
    domains: ['payments'],
  });
  const result = compute(judged);
  assert.equal(result.work.state, 'policy-ready');
  assert.deepEqual(
    result.work.failed.map((entry) => [entry.id, entry.reason]),
    [['W-POLICY', '정책 문서 없음: payments']],
  );
});

test('R-UPSTREAM은 Owner 확인된 더 늦은 날짜만 세고 같은 날은 재확인이 아니다', async () => {
  const { compute, upstreamRecheck } = await calculator();
  const sameDay = allPass();
  sameDay.artifacts.prdOverview.header.confirmedOn = '2026-10-03';
  assert.deepEqual(byId(compute(sameDay).project.recheck, 'policy:matching'), []);

  const stale = (date) => {
    const input = allPass();
    input.plan.readinessPass.date = date;
    return upstreamRecheck(input).plan.stale;
  };
  assert.equal(stale('2026-10-04'), false);
  assert.equal(stale('2026-10-03'), true);

  const draftOverview = allPass();
  draftOverview.artifacts.prdOverview.header.status = 'draft';
  draftOverview.artifacts.prdOverview.header.confirmedOn = '2026-10-09';
  assert.deepEqual(compute(draftOverview).project.recheck, []);
  const draftL1 = allPass();
  draftL1.artifacts.l1 = recordItem('l1', 'composite', 'draft', ['docs/architecture/README.md']);
  draftL1.artifacts.l1.record.confirmedBy.date = '2026-10-20';
  assert.deepEqual(compute(draftL1).project.recheck, []);

  const stalePolicy = allPass();
  stalePolicy.artifacts.prdOverview.header.confirmedOn = '2026-10-05';
  assert.deepEqual(upstreamRecheck(stalePolicy).plan.reasons, [
    '선언 도메인 정책 재확인 필요: policy:matching',
  ]);

  const anchored = allPass();
  anchored.artifacts.l1.header.confirmedOn = '2026-10-10';
  anchored.artifacts.l2[0].header.basis = ['../README.md#결정-목록'];
  assert.deepEqual(
    byId(compute(anchored).project.recheck, 'l2:docs/architecture/decisions/be.md'),
    [{ id: 'l2:docs/architecture/decisions/be.md', upstream: ['l1'] }],
  );
});

test('override 줄은 check id가 같은 실패에만 적용한다', async () => {
  const { compute } = await calculator();
  const input = allPass();
  input.plan.designConfirmation = null;
  input.overrides = [{ check: 'W-MERGE', reason: 'Owner 지시', revisit: '다음 PR' }];
  const result = compute(input);
  assert.equal(result.work.state, 'policy-ready');
  assert.deepEqual(ids(result.work.failed), ['W-DESIGN']);
  assert.deepEqual(result.work.warnings, []);
});

// Malformed inputs, one change each from the all-pass input; every one is an input error.
const INVALID_INPUTS = [
  ['plan이 객체가 아님', (input) => (input.plan = 5)],
  ['모르는 최상위 field', (input) => (input.extra = 1)],
  ['산출물 id가 문자열 아님', (input) => (input.artifacts.prdOverview.id = 5)],
  [
    'header와 record 둘 다',
    (input) =>
      (input.artifacts.l1.record = {
        mapping: 'doc',
        confirmedBy: { status: 'owner-confirmed', date: '2026-10-01' },
      }),
  ],
  ['header 근거 없음', (input) => delete input.artifacts.l1.header.basis],
  [
    'record mapping 값',
    (input) =>
      (input.artifacts.l1 = {
        id: 'l1',
        path: MAP_PATH,
        record: { mapping: 'other', confirmedBy: { status: 'draft', date: null } },
      }),
  ],
  [
    'record 확인일 field 없음',
    (input) =>
      (input.artifacts.l1 = {
        id: 'l1',
        path: MAP_PATH,
        record: { mapping: 'doc', confirmedBy: { status: 'draft' } },
      }),
  ],
  [
    'record 확인 없음',
    (input) => (input.artifacts.l1 = { id: 'l1', path: MAP_PATH, record: { mapping: 'doc' } }),
  ],
  ['경로 표 schema', (input) => (input.artifacts.pathDomains.table.schema = 'path-domains/v0')],
  ['산출물 목록이 배열 아님', (input) => (input.artifacts.l2 = {})],
  ['바뀐 경로가 배열 아님', (input) => (input.changedPaths = 'apps/api/src/matching/service.ts')],
  ['finding 목록이 배열 아님', (input) => (input.policyFindings = {})],
  ['finding level 값', (input) => (input.policyFindings[0].level = 'error')],
  ['plan domains가 배열 아님', (input) => (input.plan.domains = 'matching')],
  ['readiness PASS 날짜 형식', (input) => (input.plan.readinessPass.date = '2026/10/06')],
  ['plan boolean', (input) => (input.plan.implementationReady = 'yes')],
  ['결정 목록이 배열 아님', (input) => (input.plan.decisions = {})],
  ['Owner 확인 날짜 형식', (input) => (input.plan.decisions[0].ownerConfirmation.date = '10-06')],
  ['시각 방향 확정 field', (input) => (input.plan.designConfirmation = { source: '#16' })],
  ['override 목록이 배열 아님', (input) => (input.overrides = {})],
  ['merged boolean', (input) => (input.merged = 'yes')],
  ['bugfixBasis 값', (input) => (input.bugfixBasis = 'maybe')],
  ['리뷰 정산 boolean', (input) => (input.review.settled = 'yes')],
];

test('입력 형식 오류는 LifecycleInputError이고 merged·evidenced가 없으면 미완료다', async () => {
  const { compute } = await calculator();
  for (const [name, change] of INVALID_INPUTS) {
    const input = allPass();
    change(input);
    assert.throws(() => compute(input), LifecycleInputError, name);
  }
  const header = allPass();
  header.artifacts.prdOverview.header = null;
  assert.equal(compute(header).project.state, 'discovery');
  for (const [field, id] of [
    ['merged', 'W-MERGE'],
    ['evidenced', 'W-EVID'],
  ]) {
    const input = allPass();
    delete input[field];
    assert.equal(compute(input).work.failed[0]?.id, id, field);
  }
});

test('정의·경계·역전이·같은 결함 멈춤의 잘못된 입력은 오류다', async () => {
  const { computeLifecycleState, evaluateBoundary, reverseTarget, sameFixStop } =
    await stateModule();
  const otherSchema = { ...definition, schema: 'lifecycle-definition/v0' };
  assert.throws(() => computeLifecycleState(allPass(), otherSchema), TypeError);
  for (const boundary of [{ packDecisionId: '' }, { packDecisionId: 5 }, { inScope: 'yes' }])
    assert.throws(
      () =>
        evaluateBoundary({
          packDecisionId: null,
          reversibility: 'easy',
          inScope: true,
          ...boundary,
        }),
      LifecycleInputError,
      JSON.stringify(boundary),
    );
  assert.throws(() => reverseTarget('R-NOPE', {}, definition), LifecycleInputError);
  assert.throws(
    () => reverseTarget('R-SIGNAL', { grade: 'typo' }, definition),
    LifecycleInputError,
  );
  for (const failedFixes of [-1, 1.5, '3'])
    assert.throws(
      () => sameFixStop({ grade: 'bugfix', failedFixes }, definition),
      LifecycleInputError,
      String(failedFixes),
    );
  assert.throws(
    () => sameFixStop({ grade: 'typo', failedFixes: 1 }, definition),
    LifecycleInputError,
  );
  assert.equal(sameFixStop({ grade: 'bugfix', failedFixes: 0 }, definition), null);
});

test('구현 불가 블록 검증은 schema·배열 field를 보고 Markdown은 빈 값과 목록 밖 결정을 적는다', async () => {
  const { buildBlockedReport, validateBlockedReport, renderBlockedMarkdown } = await stateModule();
  const block = buildBlockedReport({
    request: '팀 일정 관리 앱을 만들어 줘',
    state: { project: 'discovery', work: 'planned' },
    failedGuards: [
      { id: 'P-DIRECTION', reason: 'PRD 개요 없음', needs: 'PRD 개요(owner-confirmed)' },
    ],
    questions: [
      {
        id: 'q1',
        guard: null,
        decisionRef: null,
        text: '첫 사용자는 누구인가요?',
        options: [{ id: 'a', summary: '작은 팀', tradeoff: '권한이 단순하다' }],
        default: { option: 'a', why: '빨리 확인할 수 있다' },
        reversible: 'easy',
        expertCheck: true,
      },
    ],
    resume: [],
    inspected: [],
  });
  assert.deepEqual(validateBlockedReport({ ...block, schema: 'lifecycle-blocked/v2' }), [
    { field: 'schema', code: 'missing-field' },
  ]);
  assert.deepEqual(validateBlockedReport({ ...block, questions: {} }), [
    { field: 'questions', code: 'missing-field' },
  ]);
  const markdown = renderBlockedMarkdown(block);
  for (const text of [
    '(guard 없음, 결정 목록 밖, 되돌림 `easy`, 전문가 확인 필요)',
    '- 재개 조건: 없음',
    '- 판정 근거(읽은 파일): 없음',
  ])
    assert.ok(markdown.includes(text), text);
  const listed = renderBlockedMarkdown({
    ...block,
    questions: [
      {
        ...block.questions[0],
        guard: 'P-DIRECTION',
        decisionRef: 'fe.render.server-client-default',
        expertCheck: false,
      },
    ],
  });
  assert.ok(
    listed.includes('(guard `P-DIRECTION`, 결정 `fe.render.server-client-default`, 되돌림 `easy`)'),
  );
  assert.ok(
    renderBlockedMarkdown({ ...block, questions: [] }).endsWith('#### 다음 질문\n\n없음\n'),
  );
});

test('collectProjectInputs: config root, 대응 기록 없는 저장소, 정책 문서 위치, L2 중복, 대응 기록 정책 이름', async () => {
  const { collectProjectInputs } = await calculator();
  const layout = loadWorkspaceLayout();
  const collect = (files, withLayout = layout) =>
    collectProjectInputs({
      ...overlayReader(fixtureReader(KNU_REPO), files),
      layout: withLayout,
    });
  const configLayout = {
    ...layout,
    roots: [...layout.roots, { id: 'config', path: '.htc/config.json' }],
  };
  assert.equal(collect({}, configLayout).config, null);
  assert.deepEqual(collect({ '.htc/config.json': '{}' }, configLayout).config, {
    id: 'config',
    path: '.htc/config.json',
  });

  const mapless = collect({ [MAP_PATH]: null, 'docs/policies/sub/nested.md': '# 하위 문서\n' });
  assert.deepEqual(ids(mapless.policyDomains), ['policy:data-retention', 'policy:legal-basis']);
  assert.ok(mapless.policyDomains.every((artifact) => artifact.header === null));
  assert.equal(mapless.crossCutting, null);
  assert.deepEqual(
    byId(
      collect({ 'docs/policies/extra-rule.md': '# 추가 규칙\n\n본문\n' }).policyDomains,
      'policy:extra-rule',
    ),
    [{ id: 'policy:extra-rule', path: 'docs/policies/extra-rule.md', header: null }],
  );

  const aliased = knuMap();
  aliased.artifacts.push({
    artifact: 'l2:fe',
    mapping: 'doc',
    sources: ['docs/architecture/decisions/fe.md'],
  });
  const l2 = ids(collect({ [MAP_PATH]: JSON.stringify(aliased) }).l2);
  assert.deepEqual(
    l2.filter((id) => id === 'l2:fe' || id.endsWith('/fe.md')),
    ['l2:docs/architecture/decisions/fe.md'],
  );

  for (const name of ['../outside', 'sub/rule']) {
    const unsafe = knuMap();
    unsafe.artifacts.push({ artifact: `policy:${name}`, mapping: 'doc' });
    assert.throws(() => collect({ [MAP_PATH]: JSON.stringify(unsafe) }), LifecycleInputError, name);
  }
});

test('CLI: --repo 없음, --input의 산출물 유지, 결정 디렉터리 없음·중첩, 읽기 오류', async () => {
  const { compute } = await calculator();
  const none = runCli([]);
  assert.equal(none.status, 2);
  assert.match(none.stderr, /--repo 없음/u);
  const given = runCli(['--repo', KNU_REPO, '--input', resolve(FIXTURES, 'feature-all-pass.json')]);
  assert.equal(given.status, 0, given.stderr);
  assert.deepEqual(JSON.parse(given.stdout), compute(allPass()));

  const tree = mkdtempSync(join(tmpdir(), 'lifecycle-state-'));
  const locked = [];
  try {
    cpSync(KNU_REPO, tree, { recursive: true });
    rmSync(join(tree, 'docs/architecture/decisions'), { recursive: true });
    const map = knuMap();
    map.artifacts = map.artifacts.filter((entry) => !entry.artifact.startsWith('l2:'));
    writeFileSync(join(tree, MAP_PATH), JSON.stringify(map));
    const noDecisions = runCli(['--repo', tree]);
    assert.equal(noDecisions.status, 0, noDecisions.stderr);
    assert.deepEqual(ids(JSON.parse(noDecisions.stdout).project.failed), ['P-ARCH']);

    mkdirSync(join(tree, 'docs/architecture/decisions/be'), { recursive: true });
    writeFileSync(
      join(tree, 'docs/architecture/decisions/be/queue.md'),
      '# 큐\n\n**상태**: draft\n',
    );
    const nested = runCli(['--repo', tree]);
    assert.equal(nested.status, 0, nested.stderr);
    assert.deepEqual(JSON.parse(nested.stdout).project.failed, []);

    // Read errors other than a missing file are input errors (not checkable as root, who reads mode 000 files).
    if (process.getuid?.() !== 0)
      for (const [path, pattern] of [
        [MAP_PATH, /artifact-map\.json를 읽지 못함/u],
        ['docs/architecture/decisions', /decisions 목록을 읽지 못함/u],
      ]) {
        chmodSync(join(tree, path), 0o000);
        locked.push(path);
        const denied = runCli(['--repo', tree]);
        chmodSync(join(tree, path), path.endsWith('.json') ? 0o644 : 0o755);
        locked.pop();
        assert.equal(denied.status, 2, path);
        assert.match(denied.stderr, pattern);
      }
  } finally {
    for (const path of locked) chmodSync(join(tree, path), 0o755);
    rmSync(tree, { recursive: true, force: true });
  }
});
