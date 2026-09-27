import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { assessPlanReadiness } from '../agents/common/plan-readiness-policy.mjs';

const repoRoot = resolve(import.meta.dirname, '../..');

function readFixture(name) {
  return JSON.parse(
    readFileSync(resolve(repoRoot, `scripts/agents/fixtures/plan-readiness/${name}.json`), 'utf8'),
  );
}

test('rejects an implementation-ready claim with ignored targets and unresolved local evidence', () => {
  const report = assessPlanReadiness(readFixture('false-ready'));

  assert.equal(report.ready, false);
  assert.equal(report.status, 'implementation-ready');
  assert.deepEqual(report.blockingFindings.map(({ code }) => code).sort(), [
    'achieved-acceptance-without-evidence',
    'blocking-open-question',
    'concurrency-contract-conflict',
    'enforcement-strength-conflict',
    'ignored-target-path',
    'incomplete-phase-contract',
    'local-runtime-gap',
    'working-tree-unverified',
  ]);
  assert.equal(report.confidence, 'high');
});

test('accepts a locally verified plan with trackable targets and complete phase ownership', () => {
  const report = assessPlanReadiness(readFixture('implementation-ready'));

  assert.equal(report.ready, true);
  assert.equal(report.status, 'implementation-ready');
  assert.deepEqual(report.blockingFindings, []);
  assert.deepEqual(report.warnings, []);
  assert.equal(report.confidence, 'high');
  assert.equal(Object.isFrozen(report), true);
  assert.equal(Object.isFrozen(report.facts), true);
});

test('does not require local runtime evidence when the plan declares no local dependency', () => {
  const input = structuredClone(readFixture('implementation-ready'));
  input.baseline.localRuntime = { state: 'unverified', requiredEvidence: [] };
  input.configuration = null;
  input.enforcementClaims = [];
  input.targetPaths = [
    {
      path: 'docs/development/example.md',
      intendedState: 'tracked',
      trackingState: 'tracked',
      trackingEvidence: 'git ls-files --error-unmatch docs/development/example.md',
    },
  ];

  const report = assessPlanReadiness(input);

  assert.equal(report.ready, true);
  assert.deepEqual(report.blockingFindings, []);
  assert.deepEqual(report.warnings, []);
});

test('rejects local-only leakage and premature acceptance in a proposed plan', () => {
  const input = structuredClone(readFixture('implementation-ready'));
  input.status = 'proposed';
  input.targetPaths = [
    {
      path: '.omx/state/session.json',
      intendedState: 'local-only',
      trackingState: 'tracked',
      trackingEvidence: 'git ls-files --error-unmatch .omx/state/session.json',
    },
  ];
  input.acceptance = [
    {
      id: 'future-implementation-complete',
      status: 'passed',
      evidence: ['planning review only'],
    },
  ];

  const report = assessPlanReadiness(input);

  assert.equal(report.ready, false);
  assert.deepEqual(report.blockingFindings.map(({ code }) => code).sort(), [
    'local-only-target-tracked',
    'premature-acceptance-state',
  ]);
});

test('accepts an ignored tracked target when a complete tracking migration owns the boundary', () => {
  const input = structuredClone(readFixture('implementation-ready'));
  const verification = 'git check-ignore -v .codex/config.toml';
  input.targetPaths = [
    {
      path: '.codex/config.toml',
      intendedState: 'tracked',
      trackingState: 'ignored',
      trackingEvidence: '.gitignore:47:.codex/',
      trackingMigration: {
        phaseId: 'phase-0',
        policyPath: '.gitignore',
        verification,
      },
    },
  ];
  input.phases[0].ownedPaths.push('.gitignore');
  input.phases[0].tests.push(verification);

  const report = assessPlanReadiness(input);

  assert.equal(report.ready, true);
  assert.deepEqual(report.blockingFindings, []);
  assert.deepEqual(
    report.warnings.map(({ code }) => code),
    ['tracking-migration-required'],
  );
});

test('fails closed on an unsupported readiness schema', () => {
  assert.throws(
    () => assessPlanReadiness({ ...readFixture('implementation-ready'), schemaVersion: 2 }),
    /schemaVersion/u,
  );
});

test('readiness policy is pure advisory and owns no execution or workspace mutation', () => {
  const source = readFileSync(
    resolve(repoRoot, 'scripts/agents/common/plan-readiness-policy.mjs'),
    'utf8',
  );

  for (const forbidden of [
    /node:child_process/u,
    /\bexec(?:File|Sync)?\s*\(/u,
    /\bspawn(?:Sync)?\s*\(/u,
    /\bfetch\s*\(/u,
    /\bset(?:Timeout|Interval)\s*\(/u,
    /\bwriteFile(?:Sync)?\s*\(/u,
    /\.omx\/(?:state|notepad|project-memory)/u,
  ]) {
    assert.doesNotMatch(source, forbidden);
  }
});
