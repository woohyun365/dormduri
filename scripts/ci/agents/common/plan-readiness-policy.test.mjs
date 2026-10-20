import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { assessPlanReadiness } from '../../../agents/common/plan-readiness-policy.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../..');

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

// Irreversible decisions a plan fixes need an explicit Owner confirmation before promotion (plan-authoring core §7).
const confirmed = { date: '2026-10-17', source: 'AskUserQuestion answer' };
const withDecisions = (decisions) => ({ ...readFixture('implementation-ready'), decisions });

test('blocks an irreversible decision left unknown or provisional', () => {
  for (const status of ['unknown', 'provisional']) {
    const report = assessPlanReadiness(
      withDecisions([
        { id: 'fe.arch.rendering-style', irreversible: true, status, ownerConfirmation: null },
      ]),
    );

    assert.equal(report.ready, false, status);
    assert.deepEqual(
      report.blockingFindings.map(({ code }) => code),
      ['irreversible-decision-unconfirmed'],
      status,
    );
    assert.equal(report.blockingFindings[0].path, 'decisions[0]');
  }
});

test('an irreversible validated decision needs the Owner confirmation record', () => {
  const passed = assessPlanReadiness(
    withDecisions([
      {
        id: 'fe.arch.rendering-style',
        irreversible: true,
        status: 'validated',
        ownerConfirmation: confirmed,
      },
    ]),
  );
  assert.equal(passed.ready, true);
  assert.deepEqual(passed.blockingFindings, []);
  assert.deepEqual(
    passed.facts.find(({ code }) => code === 'irreversible-decision-count'),
    { code: 'irreversible-decision-count', value: 1 },
  );

  for (const ownerConfirmation of [null, undefined]) {
    const report = assessPlanReadiness(
      withDecisions([
        {
          id: 'fe.arch.rendering-style',
          irreversible: true,
          status: 'validated',
          ownerConfirmation,
        },
      ]),
    );
    assert.equal(report.ready, false);
    assert.deepEqual(
      report.blockingFindings.map(({ code }) => code),
      ['irreversible-decision-unconfirmed'],
    );
  }
});

test('known, deferred and superseded irreversible decisions and reversible decisions do not block', () => {
  const report = assessPlanReadiness(
    withDecisions([
      { id: 'be.api.style', irreversible: true, status: 'known', ownerConfirmation: null },
      {
        id: 'db.schema.id-strategy',
        irreversible: true,
        status: 'deferred',
        ownerConfirmation: null,
      },
      { id: 'infra.obs.stack', irreversible: true, status: 'superseded', ownerConfirmation: null },
      {
        id: 'fe.ds.token-layer',
        irreversible: false,
        status: 'provisional',
        ownerConfirmation: null,
      },
      { id: 'fe.a11y.baseline', irreversible: false, status: 'unknown', ownerConfirmation: null },
      {
        id: 'fe.comp.directory-unit',
        irreversible: false,
        status: 'validated',
        ownerConfirmation: null,
      },
    ]),
  );

  assert.equal(report.ready, true);
  assert.deepEqual(report.blockingFindings, []);
  assert.deepEqual(
    report.facts.find(({ code }) => code === 'irreversible-decision-count'),
    { code: 'irreversible-decision-count', value: 3 },
  );
});

test('an input without decisions keeps the previous report', () => {
  const report = assessPlanReadiness(readFixture('implementation-ready'));

  assert.deepEqual(
    report.facts.map(({ code }) => code),
    ['target-path-count', 'phase-count', 'blocking-finding-count'],
  );
});

test('fails closed on an unsupported decision status or confirmation date', () => {
  const decision = {
    id: 'fe.arch.rendering-style',
    irreversible: true,
    status: 'validated',
    ownerConfirmation: confirmed,
  };
  for (const [change, pattern] of [
    [{ status: 'accepted' }, /decisions\[0\]\.status/u],
    [{ irreversible: 'yes' }, /decisions\[0\]\.irreversible/u],
    [{ ownerConfirmation: { date: '2026-10-1', source: 'answer' } }, /ownerConfirmation\.date/u],
    [{ ownerConfirmation: { date: '2026-13-01', source: 'answer' } }, /ownerConfirmation\.date/u],
    [{ ownerConfirmation: { date: '2026-10-17', source: '' } }, /ownerConfirmation\.source/u],
  ])
    assert.throws(
      () => assessPlanReadiness(withDecisions([{ ...decision, ...change }])),
      (error) => error instanceof TypeError && pattern.test(error.message),
      JSON.stringify(change),
    );
  assert.throws(() => assessPlanReadiness(withDecisions({})), /decisions must be an array/u);
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
