import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { anchors, links } from '../../../agents/common/markdown-links.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../..');
const workflowRoot = 'docs/development/agent-workflows';
const authoringRoot = `${workflowRoot}/plan-authoring`;

function read(path) {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

// A guide rule whose meaning a criteria item holds lives in that item; the section's `구현·리뷰 기준` line must
// keep linking the item's anchor.
function assertSectionCites(path, heading, items) {
  const text = read(path);
  const start = text.indexOf(`\n## ${heading}\n`);
  assert.ok(start >= 0, `${path}: ## ${heading}`);
  const end = text.indexOf('\n## ', start + 1);
  const line = text
    .slice(start, end === -1 ? undefined : end)
    .split('\n')
    .find((x) => x.startsWith('구현·리뷰 기준: '));
  assert.ok(line, `${path} ${heading}: 구현·리뷰 기준 line`);
  const cited = new Set(links(repoRoot, path, line).map((x) => `${x.path}#${x.fragment}`));
  for (const [file, id] of items) {
    const criteria = `${workflowRoot}/review-criteria/${file}`;
    const item = read(criteria).match(new RegExp(`^### ${id}\\. .*$`, 'mu'))?.[0];
    assert.ok(item, `${criteria} ${id}`);
    assert.ok(
      cited.has(`${criteria}#${[...anchors(`${item}\n`)][0]}`),
      `${path} ${heading} must cite ${file} ${id}`,
    );
  }
}

test('plan authoring uses one core, one primary domain, and bounded cross-cutting lenses', () => {
  const index = read(`${authoringRoot}/README.md`);

  for (const path of [
    'core.md',
    'frontend.md',
    'backend.md',
    'infrastructure.md',
    'cross-cutting/security-privacy.md',
    'cross-cutting/operations-release.md',
    'migration-map.md',
  ]) {
    assert.match(index, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }

  assert.match(index, /primary owner guide 하나/u);
  assert.match(index, /cross-cutting guide를 0~2개/u);
  assert.match(index, /계획 작성은 구현 권한이 아닙니다/u);
});

test('core contract preserves evidence, decision, phase, verification, and ownership boundaries', () => {
  const core = read(`${authoringRoot}/core.md`);

  for (const phrase of [
    'Source of truth and freshness',
    'Baseline and ownership',
    'Evidence labels',
    'Decision, OQ, and future evidence',
    'Required plan structure',
    'Phase contract',
    'Branch and PR execution strategy',
    'Verification matrix',
    'AI-readable architecture without AI-specific layers',
    'Checkpoint and final report',
  ]) {
    assert.match(core, new RegExp(phrase, 'u'));
  }

  assert.match(core, /Analyze 요청은 read-only 결과로 끝내며 plan file을 자동 생성하지 않습니다/u);
  assert.match(core, /Plan은 `produce-plan`만 승인/u);
  assert.match(core, /fresh integration branch/u);
  assert.match(core, /github\/branch-and-pr-strategy\.md/u);
});

test('plan authoring separates comprehensive planning from implementation readiness', () => {
  const index = read(`${authoringRoot}/README.md`);
  const core = read(`${authoringRoot}/core.md`);

  for (const phrase of [
    'Implementation readiness promotion',
    'draft',
    'proposed',
    'implementation-ready',
    'blocked',
    'completed',
    'git check-ignore',
    'trackingMigration',
    'tracked-only',
    'local-runtime-gap',
    'deterministic-static',
    'advisory-policy',
    'model-mediated',
    'native-runtime',
    'plan-readiness-policy.mjs',
  ]) {
    assert.match(core, new RegExp(phrase, 'u'));
  }

  assert.match(core, /unchecked.*required/u);
  assert.match(core, /complete Phase contract.*shared owner table/u);
  assert.match(core, /invariant.*once.*link/u);
  assert.match(index, /comprehensive.*implementation-ready/iu);
  assert.match(index, /Implementation readiness review/u);
  assert.match(index, /plan-readiness-policy\.mjs/u);
});

test('root guidance routes to readiness owner without duplicating its detailed matrix', () => {
  const agents = read('AGENTS.md');

  assert.match(agents, /tracked plan-authoring workflow/u);
  for (const ownerOnlyTerm of [
    'deterministic-static',
    'local-runtime-gap',
    'plan-readiness-policy.mjs',
  ]) {
    assert.doesNotMatch(agents, new RegExp(ownerOnlyTerm, 'u'));
  }
});

test('primary domain guides retain their non-overlapping planning concerns', () => {
  const frontend = read(`${authoringRoot}/frontend.md`);
  const backend = read(`${authoringRoot}/backend.md`);
  const infrastructure = read(`${authoringRoot}/infrastructure.md`);

  for (const phrase of [
    'Next.js, React, and BFF boundary',
    'State, form, mutation, and cache',
    'Accessibility and responsive interaction',
    'Performance and browser reliability',
  ]) {
    assert.match(frontend, new RegExp(phrase, 'u'));
  }

  for (const phrase of [
    'Domain owner and invariant',
    'Public contract and error semantics',
    'Transaction, concurrency, and idempotency',
    'Persistence and lifecycle',
    'Background work and integration',
  ]) {
    assert.match(backend, new RegExp(phrase, 'u'));
  }

  for (const phrase of [
    'Current and target topology',
    'Runtime, artifact, and configuration',
    'Stateful data and recovery',
    'CI/CD and automation',
    'Ownership, IaC, integration, and lifecycle',
  ]) {
    assert.match(infrastructure, new RegExp(phrase, 'u'));
  }
});

test('cross-cutting guides and migration map preserve security and release concerns without local plan dependency', () => {
  const security = read(`${authoringRoot}/cross-cutting/security-privacy.md`);
  const operations = read(`${authoringRoot}/cross-cutting/operations-release.md`);
  const migration = read(`${authoringRoot}/migration-map.md`);

  assert.match(security, /Auth, legal, PII, profile\/chat, moderation, abuse/u);
  assert.match(security, /negative tests for unauthorized actor/u);
  assertSectionCites(
    `${authoringRoot}/cross-cutting/operations-release.md`,
    'Account-free implementation and release gate',
    [
      ['web-operations-release-release-gate.md', 'O3'],
      ['web-operations-release-release-gate.md', 'O1'],
    ],
  );
  assert.match(migration, /Frontend feature\/refactor authoring/u);
  assert.match(migration, /Infrastructure feature\/refactor authoring/u);
  assert.match(migration, /Former local handoffs were retired/u);
  assert.match(read(`${authoringRoot}/README.md`), /유일한 durable owner/u);

  for (const document of [security, operations, migration]) {
    assert.doesNotMatch(document, /\.omx\/plans/u);
  }
});

test('developer entry points discover tracked plan-authoring guidance', () => {
  for (const path of [
    `${workflowRoot}/README.md`,
    `${workflowRoot}/getting-started.md`,
    `${workflowRoot}/request-intake/README.md`,
  ]) {
    assert.match(read(path), /plan-authoring\/README\.md/u, path);
  }
});

test('owner shorthand is preserved as intent but translated into observable readiness evidence', () => {
  const core = read(`${authoringRoot}/core.md`);

  for (const boundary of [
    'owner shorthand',
    'intent and provenance',
    'baseline-relative problem',
    'observable quality attribute',
    'prior assistant estimate',
  ]) {
    assert.match(core, new RegExp(boundary, 'iu'));
  }

  assert.match(core, /one primary owner.*one primary completion clock/su);
  assert.match(core, /document length.*file count.*decomposition rule/isu);
});

test('plan graph terminology separates phases, PRs, siblings, and triggered successors', () => {
  const core = read(`${authoringRoot}/core.md`);

  assert.match(core, /Plan graph terminology/u);
  for (const term of [
    'Phase',
    'dependent PR',
    'sibling plan',
    'required successor',
    'conditional successor',
  ]) {
    assert.match(core, new RegExp(term, 'u'));
  }

  assert.match(core, /successor plan.*repository-local/su);
  assert.match(core, /not.*human assignment.*agent handoff.*branch.*commit/su);
  assert.match(core, /conditional successor.*trigger.*NO-GO/su);
  assert.doesNotMatch(core, /Nest|Fastify/u);
});

test('same-session follow-ups are classified before they can expand a plan', () => {
  const core = read(`${authoringRoot}/core.md`);

  assert.match(core, /refine.*replace.*split.*successor/su);
  assert.match(core, /classif.*before.*append/iu);
  assert.match(core, /long conversation.*reasoning effort.*not.*scope/su);
});

test('future options use compact revisit contracts rather than speculative registries', () => {
  const core = read(`${authoringRoot}/core.md`);

  assert.match(core, /compact revisit contract/iu);
  assert.match(core, /current evidence.*trigger.*owner.*required evidence/su);
  assert.match(core, /bounded multi-phase.*not.*split.*detailed.*many files/su);
});

test('backend planning separates HTTP adapter, runtime capability, and activation responsibilities', () => {
  const backend = read(`${authoringRoot}/backend.md`);

  assert.match(backend, /HTTP adapter neutrality/u);
  assertSectionCites(
    `${authoringRoot}/backend.md`,
    'HTTP adapter neutrality and runtime role boundaries',
    [
      ['web-be-application-architecture.md', 'E1'],
      ['web-be-application-architecture.md', 'E4'],
      ['web-operations-release-release-gate.md', 'O3'],
    ],
  );
  assert.match(backend, /conditional adapter experiment.*successor/su);
});
