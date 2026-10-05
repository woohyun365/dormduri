import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  parseCiPerformanceEvidence,
  summarizeCiPerformanceEvidence,
} from './ci-performance-evidence.mjs';

const fixturePath = resolve(
  process.cwd(),
  'scripts/ci/performance/fixtures/ci-performance-baseline.json',
);

function readBaseline() {
  return JSON.parse(readFileSync(fixturePath, 'utf8'));
}

test('parses the full integration baseline into comparable wall, compute, cache, and test evidence', () => {
  const evidence = parseCiPerformanceEvidence(readBaseline());
  const summary = summarizeCiPerformanceEvidence(evidence);

  assert.equal(summary.workflowRunId, 32154640034);
  assert.equal(summary.wallSeconds, 629);
  assert.equal(summary.computeSeconds, 1489);
  assert.equal(summary.testFileCount, 690);
  assert.equal(summary.testCaseCount, 3401);
  assert.deepEqual(summary.dependencyBaseline, {
    acceptanceRunCount: 5,
    devHeadSha: 'db9638295f8191eced847950fb704c19ae780ba8',
    dismissedResiduals: 4,
    openAlerts: 0,
    state: 'frozen',
  });
  assert.deepEqual(summary.cache, {
    next: 'fallback-hit',
    pnpm: 'miss',
  });
  assert.equal(summary.jobs.api.wallSeconds, 625);
  assert.equal(summary.jobs.web.wallSeconds, 623);
});

test('rejects timing evidence without workflow wall duration', () => {
  const input = readBaseline();
  delete input.workflow.wallSeconds;

  assert.throws(() => parseCiPerformanceEvidence(input), /workflow\.wallSeconds/u);
});

test('rejects timing evidence without per-job compute duration', () => {
  const input = readBaseline();
  delete input.jobs[0].computeSeconds;

  assert.throws(() => parseCiPerformanceEvidence(input), /jobs\[0\]\.computeSeconds/u);
});

test('rejects timing evidence without selected test counts', () => {
  const input = readBaseline();
  delete input.testInventory.testCaseCount;

  assert.throws(() => parseCiPerformanceEvidence(input), /testInventory\.testCaseCount/u);
});

test('rejects a baseline whose suite counts do not reconcile', () => {
  const input = readBaseline();
  input.testInventory.suites[0].testCases += 1;

  assert.throws(() => parseCiPerformanceEvidence(input), /suite test case total/u);
});

test('rejects a frozen dependency baseline without reproducible file digests', () => {
  const input = readBaseline();
  delete input.dependencyBaseline.fileSha256['pnpm-lock.yaml'];

  assert.throws(() => parseCiPerformanceEvidence(input), /lowercase SHA-256 digest/u);
});

test('preserves the original workflow hashes as comparison evidence while workflows evolve', () => {
  const input = readBaseline();
  delete input.dependencyBaseline.workflowBaselineSha256['.github/workflows/ci.yml'];

  assert.throws(() => parseCiPerformanceEvidence(input), /lowercase SHA-256 digest/u);
});

test('historical dependency inputs remain immutable instead of following the current tree', () => {
  const baseline = readBaseline().dependencyBaseline;

  assert.deepEqual(baseline.fileSha256, {
    'pnpm-lock.yaml': 'b2be74bc26e19b38b2bbfbb36f9faa768948d6e9f8f1988e495b156eaed32462',
    'pnpm-workspace.yaml': '638f823ec4a12faaa6219c725ee069e414d898f1e7adad03d3ad44a021acd4ae',
    'infra/image-inventory.json':
      '2faf8ded674d60a693e19b08820feacd3506c9e6c9e822fb8efa58038e00c85a',
  });
});

test('prints a stable read-only summary for later baseline comparisons', () => {
  const result = spawnSync(
    process.execPath,
    [resolve(process.cwd(), 'scripts/ci/performance/ci-performance-evidence.mjs'), fixturePath],
    { encoding: 'utf8' },
  );

  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), {
    cache: { next: 'fallback-hit', pnpm: 'miss' },
    computeSeconds: 1489,
    dependencyBaseline: {
      acceptanceRunCount: 5,
      devHeadSha: 'db9638295f8191eced847950fb704c19ae780ba8',
      dismissedResiduals: 4,
      openAlerts: 0,
      state: 'frozen',
    },
    jobs: {
      api: { computeSeconds: 625, selected: true, wallSeconds: 625 },
      classify: { computeSeconds: 10, selected: true, wallSeconds: 10 },
      'ci-summary': { computeSeconds: 4, selected: true, wallSeconds: 4 },
      'infra-runtime': { computeSeconds: 92, selected: true, wallSeconds: 92 },
      'infra-static': { computeSeconds: 57, selected: true, wallSeconds: 57 },
      'repo-policy': { computeSeconds: 10, selected: true, wallSeconds: 10 },
      shared: { computeSeconds: 68, selected: true, wallSeconds: 68 },
      web: { computeSeconds: 623, selected: true, wallSeconds: 623 },
    },
    testCaseCount: 3401,
    testFileCount: 690,
    wallSeconds: 629,
    workflowRunId: 32154640034,
  });
});
