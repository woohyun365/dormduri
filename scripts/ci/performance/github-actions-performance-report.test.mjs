import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { buildPerformanceReport } from './github-actions-performance-report.mjs';

const policyUrl = new URL('./fixtures/github-actions-performance-policy.json', import.meta.url);
const policy = JSON.parse(await readFile(policyUrl, 'utf8'));

test('keeps the effective Pro shared-storage boundary separate from provider reference drift', () => {
  const resources = policy.repositoryResources;
  const references = [
    resources.officialProArtifactStorageReferenceBytes,
    resources.officialProPackagesSharedStorageReferenceBytes,
  ];

  for (const bytes of [resources.effectiveSharedStorageBytes, ...references]) {
    assert.ok(Number.isSafeInteger(bytes) && bytes > 0, `${bytes} must be a positive byte count`);
  }
  assert.ok(resources.effectiveSharedStorageBytes >= Math.max(...references));
  assert.match(resources.effectiveSharedStorageInterpretation, /\S/u);
  assert.equal(typeof resources.allowanceDriftRequiresOwnerReview, 'boolean');
});

function sample(id, surface, value, overrides = {}) {
  const sourceSha = String(id).padStart(40, '0');
  return {
    attempt: 1,
    change: { surface },
    conclusion: 'success',
    dependencyFingerprint: {
      fileSha256: {
        'pnpm-lock.yaml': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        'pnpm-workspace.yaml': 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        'infra/image-inventory.json':
          'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      },
      sourceSha,
    },
    estimatedGrossUsd: value * 0.006,
    event: 'pull_request',
    id,
    identity: { headSha: sourceSha },
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
    datasets: [{ collectedAt: '2026-08-26T00:00:00Z', runs, schemaVersion: 4 }],
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
        schemaVersion: 4,
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
        schemaVersion: 4,
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
      { collectedAt: '2026-08-26T00:00:00Z', runs: [duplicate], schemaVersion: 4 },
      { collectedAt: '2026-08-26T00:01:00Z', runs: [duplicate], schemaVersion: 4 },
    ],
    policy,
  });
  assert.equal(report.cohorts.full.sampleCount, 1);
  assert.deepEqual(report.dependencyFingerprint, {
    fileSha256: duplicate.dependencyFingerprint.fileSha256,
  });

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
                  fileSha256: {
                    'pnpm-lock.yaml':
                      'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
                    'pnpm-workspace.yaml':
                      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
                    'infra/image-inventory.json':
                      'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
                  },
                  sourceSha: '0000000000000000000000000000000000000002',
                },
              }),
            ],
            schemaVersion: 4,
          },
        ],
        policy,
      }),
    /mixed dependency fingerprint/u,
  );
});

test('rejects a run whose fingerprint is missing a dependency input hash', () => {
  const run = sample(4, 'full', 100);
  delete run.dependencyFingerprint.fileSha256['pnpm-workspace.yaml'];

  assert.throws(
    () =>
      buildPerformanceReport({
        datasets: [{ collectedAt: '2026-08-26T00:00:00Z', runs: [run], schemaVersion: 4 }],
        policy,
      }),
    /dependency fingerprint is missing pnpm-workspace\.yaml/u,
  );
});

test('rejects evidence when the fingerprint was not read from the run head', () => {
  assert.throws(
    () =>
      buildPerformanceReport({
        datasets: [
          {
            collectedAt: '2026-08-28T00:00:00Z',
            runs: [
              sample(9, 'infra-only', 100, {
                dependencyFingerprint: {
                  fileSha256: {
                    'pnpm-lock.yaml':
                      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                    'pnpm-workspace.yaml':
                      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
                    'infra/image-inventory.json':
                      'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
                  },
                  sourceSha: 'ffffffffffffffffffffffffffffffffffffffff',
                },
              }),
            ],
            schemaVersion: 4,
          },
        ],
        policy,
      }),
    /run-head fingerprint/u,
  );
});

test('reads only run-head fingerprint datasets', () => {
  const run = sample(10, 'infra-only', 100);
  for (const schemaVersion of [2, 3, 5, undefined]) {
    assert.throws(
      () =>
        buildPerformanceReport({
          datasets: [
            { collectedAt: '2026-08-28T00:00:00Z', runs: [run], schemaVersion: 4 },
            { collectedAt: '2026-08-26T00:00:00Z', runs: [run], schemaVersion },
          ],
          policy,
        }),
      new RegExp(
        `unsupported performance dataset schema: ${schemaVersion}; this report reads schema 4`,
        'u',
      ),
    );
  }
});
