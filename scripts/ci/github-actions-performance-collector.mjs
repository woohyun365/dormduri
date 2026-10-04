#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { resolveArtifactPath } from '../artifacts/paths.mjs';
import {
  buildDependencyFingerprint,
  compareDependencyFingerprint,
  parseMeasurementEpoch,
} from './ci-performance-epoch.mjs';
import { classifyChanges } from './classify-changes.mjs';

const repoRoot = resolve(import.meta.dirname, '../..');
const ansiPattern = /\u001b\[[0-9;]*m/gu;

function secondsBetween(start, end) {
  const startMs = Date.parse(start ?? '');
  const endMs = Date.parse(end ?? '');
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return 0;
  return Math.round((endMs - startMs) / 1_000);
}

function unique(values) {
  return [...new Set(values)];
}

function roundCurrency(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function jobLane(job) {
  if (job.name === 'Classify changed surfaces') return 'classify';
  if (job.name === 'Repository policy gate') return 'repoPolicy';
  if (job.name === 'Agent workflow gate') return 'agentWorkflow';
  if (job.name === 'Shared contract gate') return 'shared';
  if (job.name.startsWith('API validation')) return 'api';
  if (job.name.startsWith('Web validation')) return 'web';
  if (job.name.startsWith('Infrastructure validation')) return 'infra';
  if (job.name === 'CI summary') return 'summary';
  return null;
}

export function classifyPerformanceSurface(classification) {
  const selectedProducts = ['api', 'web', 'infra'].filter((lane) => classification[lane]);
  if (classification.shared || selectedProducts.length > 1) return 'full';
  if (selectedProducts.length === 0) return 'docs-config-tooling-only';
  return `${selectedProducts[0]}-only`;
}

function expectedObservedLanes(classification) {
  return ['repoPolicy', 'agentWorkflow', 'shared', 'api', 'web', 'infra'].filter(
    (lane) => classification[lane],
  );
}

function sameValues(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

export function parseRunLog(log) {
  const source = String(log ?? '').replace(ansiPattern, '');
  const cacheKeys = unique(
    [...source.matchAll(/Cache hit for:\s*([^\r\n]+)/gu)].map((match) => match[1].trim()),
  );
  const cacheSizes = [...source.matchAll(/Cache Size:\s*~[^(\r\n]+\(([0-9]+) B\)/gu)].map((match) =>
    Number(match[1]),
  );
  const vitestFiles = [...source.matchAll(/Test Files\s+([0-9]+) passed/gu)].map((match) =>
    Number(match[1]),
  );
  const vitestCases = [...source.matchAll(/Tests\s+([0-9]+) passed/gu)].map((match) =>
    Number(match[1]),
  );
  const browserCases = [...source.matchAll(/\b([0-9]+) passed \([0-9.]+s\)\s*$/gmu)].map((match) =>
    Number(match[1]),
  );
  const nextHit = [...source.matchAll(/next_build_cache_hit:\s*(true|false)/gu)].at(-1)?.[1];

  return {
    cache: {
      hitKeys: cacheKeys,
      hitSizesBytes: cacheSizes,
      missCount: (source.match(/Cache not found for input keys:/gu) ?? []).length,
      nextBuildHit: nextHit === undefined ? null : nextHit === 'true',
    },
    tests: {
      browserCases: browserCases.reduce((total, count) => total + count, 0),
      testCases:
        vitestCases.reduce((total, count) => total + count, 0) +
        browserCases.reduce((total, count) => total + count, 0),
      testFiles: vitestFiles.reduce((total, count) => total + count, 0),
      vitestCaseObservations: vitestCases,
      vitestFileObservations: vitestFiles,
    },
  };
}

export function buildRunEvidence({
  run,
  jobs,
  artifacts,
  changedPaths = [],
  log,
  measurementEpoch = null,
  pricing = null,
  pullRequest = null,
  runHeadFingerprint = null,
}) {
  const completedJobs = jobs.filter(
    (job) => job.started_at && job.completed_at && job.conclusion !== 'skipped',
  );
  const jobEvidence = jobs.map((job) => {
    const wallSeconds = secondsBetween(job.started_at, job.completed_at);
    const roundedJobMinutes = wallSeconds === 0 ? 0 : Math.ceil(wallSeconds / 60);
    const runnerLabels = Array.isArray(job.labels) ? job.labels : [];
    const runnerSku =
      runnerLabels.find((label) => /^(?:ubuntu|windows|macos)-/u.test(label)) ?? null;
    const billingMultiplier = runnerSku?.startsWith('ubuntu-') ? 1 : null;
    const runnerRateUsdPerMinute =
      wallSeconds === 0 ? 0 : (pricing?.runnerRatesUsdPerMinute?.[runnerSku] ?? null);
    const estimatedGrossUsd =
      runnerRateUsdPerMinute === null
        ? null
        : roundCurrency(roundedJobMinutes * runnerRateUsdPerMinute);
    return {
      billingMultiplier,
      completedAt: job.completed_at ?? null,
      conclusion: job.conclusion ?? null,
      id: job.id,
      estimatedGrossUsd,
      name: job.name,
      queueSeconds: secondsBetween(run.run_started_at ?? run.created_at, job.started_at),
      roundedBilledMinutes:
        wallSeconds === 0
          ? 0
          : billingMultiplier === null
            ? null
            : roundedJobMinutes * billingMultiplier,
      roundedJobMinutes,
      runnerRateUsdPerMinute,
      runnerLabels,
      runnerSku,
      startedAt: job.started_at ?? null,
      steps: (job.steps ?? []).map((step) => ({
        completedAt: step.completed_at ?? null,
        conclusion: step.conclusion ?? null,
        durationSeconds: secondsBetween(step.started_at, step.completed_at),
        name: step.name,
        number: step.number,
        startedAt: step.started_at ?? null,
      })),
      wallSeconds,
    };
  });
  const parsedLog = parseRunLog(log);
  const classification = classifyChanges(changedPaths);
  const observedSelectedLanes = unique(
    jobs
      .filter((job) => job.conclusion !== 'skipped')
      .map(jobLane)
      .filter(Boolean),
  );
  const observedComparableLanes = observedSelectedLanes.filter(
    (lane) => lane !== 'classify' && lane !== 'summary',
  );
  const observedClassification = {
    agentWorkflow: observedComparableLanes.includes('agentWorkflow'),
    api: observedComparableLanes.includes('api'),
    infra: observedComparableLanes.includes('infra'),
    repoPolicy: observedComparableLanes.includes('repoPolicy'),
    shared: observedComparableLanes.includes('shared'),
    storybook: false,
    web: observedComparableLanes.includes('web'),
  };
  const failedJobs = completedJobs.filter((job) => job.conclusion === 'failure');
  const cancelledJobs = completedJobs.filter((job) => job.conclusion === 'cancelled');
  const wastedJobs = completedJobs.filter((job) =>
    ['action_required', 'cancelled', 'failure', 'stale', 'timed_out'].includes(job.conclusion),
  );
  const dependencyComparison =
    measurementEpoch && runHeadFingerprint
      ? compareDependencyFingerprint(measurementEpoch, runHeadFingerprint)
      : {
          changedInputs: [],
          comparisonBaseSha: null,
          comparisonEpochId: null,
          state: 'unavailable',
        };
  const changedDependencyInputs = dependencyComparison.changedInputs.filter(
    (path) => path !== 'measurement-epoch',
  );
  const webSourceChanged = changedPaths.some((path) => path.startsWith('apps/web/'));
  const cacheEvidence = {
    ...parsedLog.cache,
    nextBuildInterpretation:
      parsedLog.cache.nextBuildHit === null
        ? 'not-observed'
        : parsedLog.cache.nextBuildHit
          ? 'hit-observed'
          : webSourceChanged
            ? 'expected-source-key-change'
            : 'investigate-eviction-or-configuration',
    pnpmInterpretation:
      parsedLog.cache.missCount === 0
        ? parsedLog.cache.hitKeys.length > 0
          ? 'hit-observed'
          : 'not-observed'
        : changedDependencyInputs.length > 0
          ? 'expected-dependency-key-change'
          : 'investigate-eviction-or-configuration',
  };
  const estimatedGrossUsd = jobEvidence.every((job) => job.estimatedGrossUsd !== null)
    ? roundCurrency(jobEvidence.reduce((total, job) => total + job.estimatedGrossUsd, 0))
    : null;

  return {
    artifacts: {
      count: artifacts.length,
      items: artifacts.map((artifact) => ({
        createdAt: artifact.created_at ?? null,
        expired: artifact.expired === true,
        expiresAt: artifact.expires_at ?? null,
        id: artifact.id,
        name: artifact.name,
        sizeBytes: artifact.size_in_bytes,
      })),
      totalSizeBytes: artifacts.reduce((total, artifact) => total + artifact.size_in_bytes, 0),
    },
    attempt: run.run_attempt,
    cache: cacheEvidence,
    change: {
      changedPaths,
      classification,
      expectedSurface: classifyPerformanceSurface(classification),
      observedSurface: classifyPerformanceSurface(observedClassification),
      observedSelectedLanes,
      selectionMatchesObservedJobs: sameValues(
        expectedObservedLanes(classification),
        observedComparableLanes,
      ),
      surface: classifyPerformanceSurface(observedClassification),
    },
    conclusion: run.conclusion,
    createdAt: run.created_at,
    dependencyCompatibility: dependencyComparison,
    dependencyFingerprint: runHeadFingerprint,
    estimatedGrossUsd,
    event: run.event,
    id: run.id,
    identity: {
      baseBranch: run.event === 'pull_request' ? (pullRequest?.base?.ref ?? null) : null,
      baseSha: run.event === 'pull_request' ? (pullRequest?.base?.sha ?? null) : null,
      headBranch: run.head_branch ?? null,
      headSha: run.head_sha,
      pullRequestNumber: pullRequest?.number ?? null,
      sourcePullRequestHeadBranch: pullRequest?.head?.ref ?? null,
      sourcePullRequestHeadSha: pullRequest?.head?.sha ?? null,
    },
    jobs: jobEvidence,
    measurementEpoch: measurementEpoch
      ? {
          baseSha: measurementEpoch.baseSha,
          capturedAt: measurementEpoch.capturedAt,
          id: measurementEpoch.id,
          state: measurementEpoch.state,
        }
      : null,
    outcome: {
      cancelledJobCount: cancelledJobs.length,
      failedJobCount: failedJobs.length,
      retryCount: Math.max(0, (run.run_attempt ?? 1) - 1),
      wastedComputeSeconds: wastedJobs.reduce(
        (total, job) => total + secondsBetween(job.started_at, job.completed_at),
        0,
      ),
    },
    pricing: pricing
      ? {
          currency: 'USD',
          reviewedAt: pricing.reviewedAt,
          sourceUrl: pricing.sourceUrl,
        }
      : null,
    rawComputeSeconds: completedJobs.reduce(
      (total, job) => total + secondsBetween(job.started_at, job.completed_at),
      0,
    ),
    roundedBilledMinutes: jobEvidence.every((job) => job.roundedBilledMinutes !== null)
      ? jobEvidence.reduce((total, job) => total + job.roundedBilledMinutes, 0)
      : null,
    roundedJobMinutes: jobEvidence.reduce((total, job) => total + job.roundedJobMinutes, 0),
    startedAt: run.run_started_at ?? run.created_at,
    tests: parsedLog.tests,
    updatedAt: run.updated_at,
    url: run.html_url,
    workflowQueueSeconds: secondsBetween(run.created_at, run.run_started_at ?? run.created_at),
    workflowWallSeconds: secondsBetween(run.created_at, run.updated_at),
  };
}

function ghJson(args) {
  return JSON.parse(
    execFileSync('gh', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  );
}

function ghText(args) {
  return execFileSync('gh', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function ghLines(args) {
  const output = ghText(args).trim();
  return output ? output.split('\n').filter(Boolean) : [];
}

function collectRunContext(repository, run) {
  const pulls = ghJson(['api', `repos/${repository}/commits/${run.head_sha}/pulls`]);
  const pullRequest = pulls.find((pull) => pull.head?.sha === run.head_sha) ?? pulls[0] ?? null;
  if (pullRequest) {
    return {
      changedPaths: ghLines([
        'api',
        '--paginate',
        `repos/${repository}/pulls/${pullRequest.number}/files?per_page=100`,
        '--jq',
        '.[].filename',
      ]),
      pullRequest,
    };
  }

  return {
    changedPaths: ghLines([
      'api',
      '--paginate',
      `repos/${repository}/commits/${run.head_sha}?per_page=100`,
      '--jq',
      '.files[].filename',
    ]),
    pullRequest: null,
  };
}

export function collectGithubActionsRun(repository, runId, { measurementEpoch, pricing } = {}) {
  const run = ghJson(['api', `repos/${repository}/actions/runs/${runId}`]);
  if (run.status !== 'completed' || !run.conclusion) {
    throw new Error(`run ${runId} is not completed`);
  }
  const jobs = ghJson([
    'api',
    `repos/${repository}/actions/runs/${runId}/jobs?filter=all&per_page=100`,
  ]).jobs;
  const artifacts = ghJson([
    'api',
    `repos/${repository}/actions/runs/${runId}/artifacts?per_page=100`,
  ]).artifacts;
  const log = ghText(['run', 'view', String(runId), '--repo', repository, '--log']);
  const context = collectRunContext(repository, run);
  const runHeadFingerprint = buildDependencyFingerprint({
    epoch: measurementEpoch,
    readText: (path) =>
      ghText([
        'api',
        '-H',
        'Accept: application/vnd.github.raw+json',
        `repos/${repository}/contents/${path}?ref=${run.head_sha}`,
      ]),
    sourceSha: run.head_sha,
  });
  return buildRunEvidence({
    artifacts,
    changedPaths: context.changedPaths,
    jobs,
    log,
    measurementEpoch,
    pricing,
    pullRequest: context.pullRequest,
    run,
    runHeadFingerprint,
  });
}

export function parseArgs(argv) {
  const options = { output: null, repository: null, runIds: [] };
  for (const argument of argv) {
    if (argument === '--') continue;
    if (argument.startsWith('--repo=')) options.repository = argument.slice('--repo='.length);
    else if (argument.startsWith('--run-id=')) {
      options.runIds.push(Number(argument.slice('--run-id='.length)));
    } else if (argument.startsWith('--output='))
      options.output = argument.slice('--output='.length);
    else throw new Error(`unknown argument: ${argument}`);
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(options.repository ?? '')) {
    throw new Error('--repo must be owner/name');
  }
  if (
    options.runIds.length === 0 ||
    options.runIds.some((runId) => !Number.isSafeInteger(runId) || runId <= 0)
  ) {
    throw new Error('at least one positive integer --run-id is required');
  }
  return options;
}

export function resolveCollectorOutputPath(output, now = new Date()) {
  if (!output) {
    return resolveArtifactPath(repoRoot, [
      'ci-performance',
      `github-actions-${now.toISOString().replace(/[:.]/gu, '-')}.json`,
    ]);
  }
  const outputPath = resolve(repoRoot, output);
  const repositoryRelative = relative(repoRoot, outputPath);
  if (repositoryRelative.startsWith('..') || repositoryRelative === '') {
    throw new Error('--output must resolve to a file inside the repository');
  }
  return outputPath;
}

function main(argv) {
  const options = parseArgs(argv);
  const outputPath = resolveCollectorOutputPath(options.output);
  const measurementEpoch = parseMeasurementEpoch(
    JSON.parse(
      readFileSync(
        resolve(repoRoot, 'scripts/ci/fixtures/ci-performance-active-epoch.json'),
        'utf8',
      ),
    ),
  );
  const policy = JSON.parse(
    readFileSync(
      resolve(repoRoot, 'scripts/ci/fixtures/github-actions-performance-policy.json'),
      'utf8',
    ),
  );
  const evidence = {
    collectedAt: new Date().toISOString(),
    repository: options.repository,
    runs: options.runIds.map((runId) =>
      collectGithubActionsRun(options.repository, runId, {
        measurementEpoch,
        pricing: { ...policy.pricing, reviewedAt: policy.reviewedAt },
      }),
    ),
    schemaVersion: 3,
  };
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  process.stdout.write(`${outputPath}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
