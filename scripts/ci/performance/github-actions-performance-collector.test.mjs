import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildRunEvidence,
  parseArgs,
  parseRunLog,
  resolveCollectorOutputPath,
  runnerClass,
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
  assert.equal(evidence.estimatedGrossUsd, 0.018);
  assert.deepEqual(evidence.identity, {
    baseBranch: 'dev',
    baseSha: '1111111111111111111111111111111111111111',
    headBranch: 'feature/web-example',
    headSha: '0123456789abcdef0123456789abcdef01234567',
    pullRequestNumber: 42,
    sourcePullRequestHeadBranch: 'feature/web-example',
    sourcePullRequestHeadSha: '0123456789abcdef0123456789abcdef01234567',
  });
  assert.deepEqual(evidence.change, {
    changedPaths: ['apps/web/src/example.tsx'],
    classification: {
      agentWorkflow: false,
      api: false,
      infra: false,
      repoPolicy: false,
      shared: false,
      storybook: false,
      web: true,
    },
    expectedSurface: 'web-only',
    observedSurface: 'web-only',
    observedSelectedLanes: ['classify', 'web'],
    selectionMatchesObservedJobs: true,
    surface: 'web-only',
  });
  assert.deepEqual(evidence.outcome, {
    cancelledJobCount: 0,
    failedJobCount: 0,
    retryCount: 0,
    wastedComputeSeconds: 0,
  });
  assert.deepEqual(evidence.dependencyFingerprint, fixture.runHeadFingerprint);
  assert.equal(evidence.jobs[1].queueSeconds, 13);
  assert.equal(evidence.jobs[1].runnerSku, 'ubuntu-24.04');
  assert.equal(evidence.jobs[1].runnerClass, 'linux-2-core');
  assert.equal(evidence.jobs[1].billingMultiplier, 1);
  assert.equal(evidence.jobs[1].steps[0].durationSeconds, 60);
  assert.deepEqual(evidence.cache, {
    hitKeys: ['node-cache-Linux-x64-pnpm-fixture'],
    hitSizesBytes: [325058560],
    missCount: 0,
    nextBuildHit: true,
    nextBuildInterpretation: 'hit-observed',
    pnpmInterpretation: 'hit-observed',
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
    items: [
      {
        createdAt: null,
        expired: false,
        expiresAt: null,
        id: 3001,
        name: 'web-browser-evidence',
        sizeBytes: 1024,
      },
    ],
    totalSizeBytes: 1024,
  });
  assert.equal(JSON.stringify(evidence).includes(fixture.log), false);
});

test('keeps failure, retry, and cancelled compute visible as cost evidence', () => {
  const evidence = buildRunEvidence({
    ...fixture,
    run: { ...fixture.run, conclusion: 'failure', run_attempt: 2 },
    jobs: fixture.jobs.map((job, index) => (index === 1 ? { ...job, conclusion: 'failure' } : job)),
  });

  assert.equal(evidence.outcome.failedJobCount, 1);
  assert.equal(evidence.outcome.retryCount, 1);
  assert.equal(evidence.outcome.wastedComputeSeconds, 105);
});

test('prices the one-core Linux runner independently from standard Linux', () => {
  const evidence = buildRunEvidence({
    ...fixture,
    pricing: {
      ...fixture.pricing,
      runnerRatesUsdPerMinute: {
        ...fixture.pricing.runnerRatesUsdPerMinute,
        'linux-slim': 0.002,
      },
    },
    jobs: fixture.jobs.map((job, index) =>
      index === 0 ? { ...job, labels: ['ubuntu-slim'] } : job,
    ),
  });

  assert.equal(evidence.jobs[0].runnerSku, 'ubuntu-slim');
  assert.equal(evidence.jobs[0].runnerClass, 'linux-slim');
  assert.equal(evidence.jobs[0].runnerRateUsdPerMinute, 0.002);
  assert.equal(evidence.jobs[0].estimatedGrossUsd, 0.002);
});

test('prices a new standard Ubuntu label by runner class without a policy edit', () => {
  const evidence = buildRunEvidence({
    ...fixture,
    jobs: fixture.jobs.map((job) =>
      job.labels.length > 0 ? { ...job, labels: ['ubuntu-26.04'] } : job,
    ),
  });

  assert.equal(evidence.jobs[1].runnerSku, 'ubuntu-26.04');
  assert.equal(evidence.jobs[1].runnerClass, 'linux-2-core');
  assert.equal(evidence.jobs[1].runnerRateUsdPerMinute, 0.006);
  assert.equal(evidence.estimatedGrossUsd, 0.018);
});

test('leaves unknown runner labels unpriced instead of guessing a class', () => {
  assert.equal(runnerClass('ubuntu-latest'), 'linux-2-core');
  for (const label of ['ubuntu-24.04-arm', 'windows-2025', 'macos-15', 'self-hosted', null]) {
    assert.equal(runnerClass(label), null);
  }
  const evidence = buildRunEvidence({
    ...fixture,
    jobs: fixture.jobs.map((job, index) =>
      index === 1 ? { ...job, labels: ['ubuntu-24.04-arm'] } : job,
    ),
  });

  assert.equal(evidence.jobs[1].runnerRateUsdPerMinute, null);
  assert.equal(evidence.estimatedGrossUsd, null);
});

test('records the run-head fingerprint and reads a pnpm cache miss against the PR lockfile change', () => {
  const runHeadFingerprint = {
    ...fixture.runHeadFingerprint,
    fileSha256: {
      ...fixture.runHeadFingerprint.fileSha256,
      'pnpm-lock.yaml': 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    },
  };
  const missWith = (changedPaths) =>
    buildRunEvidence({
      ...fixture,
      changedPaths,
      log: 'Cache not found for input keys:\n',
      runHeadFingerprint,
    });

  const lockfileChange = missWith(['pnpm-lock.yaml', 'apps/web/package.json']);
  assert.deepEqual(lockfileChange.dependencyFingerprint, runHeadFingerprint);
  assert.equal(lockfileChange.cache.pnpmInterpretation, 'expected-dependency-key-change');
  assert.equal(
    missWith(['apps/web/src/example.tsx']).cache.pnpmInterpretation,
    'investigate-eviction-or-configuration',
  );
});

test('separates expected change surface from the jobs the historical workflow actually ran', () => {
  const evidence = buildRunEvidence({ ...fixture, changedPaths: ['docs/README.md'] });

  assert.equal(evidence.change.expectedSurface, 'docs-config-tooling-only');
  assert.equal(evidence.change.observedSurface, 'web-only');
  assert.equal(evidence.change.selectionMatchesObservedJobs, false);
  assert.equal(evidence.change.surface, 'web-only');
});

test('counts the agent workflow gate as the agent lane an agent-only change selects', () => {
  const job = (name, startedAt, completedAt) => ({
    ...fixture.jobs[0],
    name,
    started_at: startedAt,
    completed_at: completedAt,
  });
  const evidence = buildRunEvidence({
    ...fixture,
    changedPaths: ['.claude/skills/knu-review/SKILL.md'],
    jobs: [
      job('Classify changed surfaces', '2026-08-26T00:00:02Z', '2026-08-26T00:00:12Z'),
      job('Repository policy gate', '2026-08-26T00:00:15Z', '2026-08-26T00:01:10Z'),
      job('Agent workflow gate', '2026-08-26T00:00:15Z', '2026-08-26T00:01:45Z'),
      job('CI summary', '2026-08-26T00:01:50Z', '2026-08-26T00:01:54Z'),
    ],
  });

  assert.deepEqual(evidence.change.observedSelectedLanes, [
    'classify',
    'repoPolicy',
    'agentWorkflow',
    'summary',
  ]);
  assert.equal(evidence.change.selectionMatchesObservedJobs, true);
  assert.equal(evidence.change.surface, 'docs-config-tooling-only');
});

test('keeps a push run identity distinct from its associated source pull request', () => {
  const evidence = buildRunEvidence({
    ...fixture,
    run: {
      ...fixture.run,
      event: 'push',
      head_branch: 'dev',
      head_sha: '2222222222222222222222222222222222222222',
    },
  });

  assert.equal(evidence.identity.baseBranch, null);
  assert.equal(evidence.identity.headBranch, 'dev');
  assert.equal(evidence.identity.headSha, '2222222222222222222222222222222222222222');
  assert.equal(evidence.identity.pullRequestNumber, 42);
  assert.equal(
    evidence.identity.sourcePullRequestHeadSha,
    '0123456789abcdef0123456789abcdef01234567',
  );
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
      '--output=.artifacts/tools/ci-performance/example.json',
    ]),
    {
      output: '.artifacts/tools/ci-performance/example.json',
      repository: 'example/repository',
      runIds: [1001],
    },
  );
  assert.throws(() => parseArgs(['--repo=example/repository', '--run-id=0']), /positive integer/u);
  assert.match(
    resolveCollectorOutputPath('.artifacts/tools/ci-performance/example.json'),
    /\.artifacts\/tools\/ci-performance\/example\.json$/u,
  );
  assert.throws(() => resolveCollectorOutputPath('../outside.json'), /inside the repository/u);
});
