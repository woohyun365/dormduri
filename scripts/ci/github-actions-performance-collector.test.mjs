import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildRunEvidence,
  parseArgs,
  parseRunLog,
  resolveCollectorOutputPath,
} from './github-actions-performance-collector.mjs';

const fixtureUrl = new URL('./fixtures/github-actions-performance-run.json', import.meta.url);
const fixture = JSON.parse(await readFile(fixtureUrl, 'utf8'));

test('summarizes GitHub run wall, raw compute, billed rounding, queue, cache, tests, and artifacts', () => {
  const evidence = buildRunEvidence(fixture);

  assert.equal(evidence.workflowWallSeconds, 122);
  assert.equal(evidence.workflowQueueSeconds, 2);
  assert.equal(evidence.rawComputeSeconds, 115);
  assert.equal(evidence.roundedBilledMinutes, 3);
  assert.equal(evidence.roundedJobMinutes, 3);
  assert.equal(evidence.jobs[1].queueSeconds, 13);
  assert.equal(evidence.jobs[1].runnerSku, 'ubuntu-24.04');
  assert.equal(evidence.jobs[1].billingMultiplier, 1);
  assert.equal(evidence.jobs[1].steps[0].durationSeconds, 60);
  assert.deepEqual(evidence.cache, {
    hitKeys: ['node-cache-Linux-x64-pnpm-fixture'],
    hitSizesBytes: [325058560],
    missCount: 0,
    nextBuildHit: true,
  });
  assert.deepEqual(evidence.tests, {
    browserCases: 26,
    testCases: 1258,
    testFiles: 221,
    vitestCaseObservations: [1232],
    vitestFileObservations: [221],
  });
  assert.deepEqual(evidence.artifacts, {
    count: 1,
    items: [{ expired: false, id: 3001, name: 'web-browser-evidence', sizeBytes: 1024 }],
    totalSizeBytes: 1024,
  });
  assert.equal(JSON.stringify(evidence).includes(fixture.log), false);
});

test('keeps unavailable log signals explicit instead of inventing cache or test evidence', () => {
  assert.deepEqual(parseRunLog(''), {
    cache: { hitKeys: [], hitSizesBytes: [], missCount: 0, nextBuildHit: null },
    tests: {
      browserCases: 0,
      testCases: 0,
      testFiles: 0,
      vitestCaseObservations: [],
      vitestFileObservations: [],
    },
  });
});

test('accepts the pnpm argument separator without widening CLI inputs', () => {
  assert.deepEqual(
    parseArgs([
      '--',
      '--repo=example/repository',
      '--run-id=1001',
      '--output=artifacts/local/ci-performance/example.json',
    ]),
    {
      output: 'artifacts/local/ci-performance/example.json',
      repository: 'example/repository',
      runIds: [1001],
    },
  );
  assert.throws(() => parseArgs(['--repo=example/repository', '--run-id=0']), /positive integer/u);
  assert.match(
    resolveCollectorOutputPath('artifacts/local/ci-performance/example.json'),
    /artifacts\/local\/ci-performance\/example\.json$/u,
  );
  assert.throws(() => resolveCollectorOutputPath('../outside.json'), /inside the repository/u);
});
