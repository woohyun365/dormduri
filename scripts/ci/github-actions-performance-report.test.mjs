import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { buildPerformanceReport } from './github-actions-performance-report.mjs';

const policyUrl = new URL('./fixtures/github-actions-performance-policy.json', import.meta.url);
const policy = JSON.parse(await readFile(policyUrl, 'utf8'));

test('keeps the effective Pro shared-storage boundary separate from provider reference drift', () => {
  assert.equal(policy.repositoryResources.effectiveSharedStorageBytes, 2 * 1024 ** 3);
  assert.equal(policy.repositoryResources.officialProArtifactStorageReferenceBytes, 1024 ** 3);
  assert.equal(
    policy.repositoryResources.officialProPackagesSharedStorageReferenceBytes,
    2 * 1024 ** 3,
  );
  assert.equal(
    policy.repositoryResources.effectiveSharedStorageInterpretation,
    '2GB-shared-packages-actions-artifacts',
  );
  assert.equal(policy.repositoryResources.allowanceDriftRequiresOwnerReview, false);
});

function sample(id, surface, value, overrides = {}) {
  return {
    attempt: 1,
    change: { surface },
    conclusion: 'success',
    dependencyFingerprint: {
      devHeadSha: 'db9638295f8191eced847950fb704c19ae780ba8',
      fileSha256: { 'pnpm-lock.yaml': 'fixture-lock' },
    },
    estimatedGrossUsd: value * 0.006,
    event: 'pull_request',
    id,
    jobs: [
      {
        name: 'Web validation',
        steps: [{ durationSeconds: value, name: 'Web unit tests' }],
      },
    ],
    outcome: {
      cancelledJobCount: 0,
      failedJobCount: 0,
      retryCount: 0,
      wastedComputeSeconds: 0,
    },
    rawComputeSeconds: value * 2,
    roundedBilledMinutes: value,
    tests: { testCases: 3401, testFiles: 690 },
    workflowWallSeconds: value,
    ...overrides,
  };
}

test('publishes provisional p50 at five natural samples and p95 at ten', () => {
  const runs = Array.from({ length: 10 }, (_, index) => sample(index + 1, 'full', index + 1));
  const report = buildPerformanceReport({
    datasets: [{ collectedAt: '2026-08-26T00:00:00Z', runs, schemaVersion: 2 }],
    policy,
    resourceInventory: {
      artifacts: { activeCount: 98, activeSizeBytes: 7752603 },
      cache: { activeCount: 29, activeSizeBytes: 7475286431 },
      packages: { state: 'unverified', reason: 'missing read:packages scope' },
    },
  });

  assert.equal(report.cohorts.full.confidence, 'decision-quality');
  assert.equal(report.cohorts.full.sampleCount, 10);
  assert.equal(report.cohorts.full.metrics.workflowWallSeconds.p50, 5.5);
  assert.equal(report.cohorts.full.metrics.workflowWallSeconds.p95, 10);
  assert.equal(report.cohorts.full.metrics.roundedBilledMinutes.p50, 5.5);
  assert.equal(report.cohorts.full.metrics.estimatedGrossUsd.p95, 0.06);
  assert.equal(report.cohorts.full.budget.wallStatus, 'within');
  assert.equal(report.cohorts.full.budget.roundedBilledMinutesStatus, 'within');
  assert.equal(report.eventCohorts['full:pull_request'].sampleCount, 10);
  assert.equal(report.stages['Web unit tests'].durationSeconds.p50, 5.5);
  assert.ok(Math.abs(report.resources.cache.usageRatio - 0.6961903004907071) < 1e-12);
  assert.equal(report.resources.cache.warning, false);
  assert.equal(report.resources.packages.state, 'unverified');
});

test('does not invent percentiles when a natural cohort is too small', () => {
  const report = buildPerformanceReport({
    datasets: [
      {
        collectedAt: '2026-08-26T00:00:00Z',
        runs: [sample(1, 'web-only', 100)],
        schemaVersion: 2,
      },
    ],
    policy,
  });

  assert.equal(report.cohorts['web-only'].confidence, 'insufficient');
  assert.equal(report.cohorts['web-only'].metrics.workflowWallSeconds.p50, null);
  assert.equal(report.cohorts['web-only'].metrics.workflowWallSeconds.p95, null);
  assert.deepEqual(report.gaps, [
    'web-only: 1 natural sample(s); 5 required for provisional p50 and 10 for p95',
  ]);
});

test('keeps retired push evidence separate from the primary pull-request cohort', () => {
  const report = buildPerformanceReport({
    datasets: [
      {
        collectedAt: '2026-08-26T00:00:00Z',
        runs: [sample(1, 'full', 100), sample(2, 'full', 200, { event: 'push' })],
        schemaVersion: 2,
      },
    ],
    policy,
  });

  assert.equal(report.cohorts.full.sampleCount, 1);
  assert.equal(report.eventCohorts['full:pull_request'].sampleCount, 1);
  assert.equal(report.eventCohorts['full:push'].sampleCount, 1);
});

test('deduplicates run ids and rejects mixed dependency fingerprints', () => {
  const duplicate = sample(1, 'full', 100);
  const report = buildPerformanceReport({
    datasets: [
      { collectedAt: '2026-08-26T00:00:00Z', runs: [duplicate], schemaVersion: 2 },
      { collectedAt: '2026-08-26T00:01:00Z', runs: [duplicate], schemaVersion: 2 },
    ],
    policy,
  });
  assert.equal(report.cohorts.full.sampleCount, 1);

  assert.throws(
    () =>
      buildPerformanceReport({
        datasets: [
          {
            collectedAt: '2026-08-26T00:00:00Z',
            runs: [
              duplicate,
              sample(2, 'full', 100, {
                dependencyFingerprint: {
                  devHeadSha: 'different',
                  fileSha256: { 'pnpm-lock.yaml': 'different' },
                },
              }),
            ],
            schemaVersion: 2,
          },
        ],
        policy,
      }),
    /dependency fingerprint/u,
  );

  assert.throws(
    () =>
      buildPerformanceReport({
        datasets: [
          {
            collectedAt: '2026-08-26T00:00:00Z',
            runs: [
              sample(3, 'full', 100, {
                dependencyCompatibility: {
                  changedInputs: ['pnpm-lock.yaml'],
                  state: 'changed-inputs',
                },
              }),
            ],
            schemaVersion: 2,
          },
        ],
        policy,
      }),
    /dependency inputs changed/u,
  );
});
