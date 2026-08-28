#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { resolveArtifactPath } from '../artifacts/paths.mjs';
import { dependencyInputPaths } from './ci-performance-epoch.mjs';

const repoRoot = resolve(import.meta.dirname, '../..');
const expectedSurfaces = ['full', 'api-only', 'web-only', 'infra-only', 'docs-config-tooling-only'];

function round(value, places = 6) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function median(sorted) {
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

function nearestRank(sorted, percentile) {
  if (sorted.length === 0) return null;
  return sorted[Math.max(0, Math.ceil(percentile * sorted.length) - 1)];
}

function summarizeMetric(values, sampleCount) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  return {
    max: sorted.at(-1) ?? null,
    min: sorted[0] ?? null,
    p50: sampleCount >= 5 ? median(sorted) : null,
    p95: sampleCount >= 10 ? nearestRank(sorted, 0.95) : null,
  };
}

function stableFingerprint(fingerprint) {
  if (!fingerprint) throw new Error('dependency fingerprint is required');
  if (fingerprint.epochId) {
    return JSON.stringify({
      epochId: fingerprint.epochId,
      fileSha256: Object.fromEntries(Object.entries(fingerprint.fileSha256 ?? {}).sort()),
    });
  }
  return JSON.stringify({
    devHeadSha: fingerprint.devHeadSha,
    fileSha256: Object.fromEntries(Object.entries(fingerprint.fileSha256 ?? {}).sort()),
  });
}

function validateActiveEpochRun(run) {
  const fingerprint = run.dependencyFingerprint;
  const epoch = run.measurementEpoch;
  if (!fingerprint?.epochId || !fingerprint?.sourceSha || !epoch?.id) {
    throw new Error(`run ${run.id} is missing active measurement epoch evidence`);
  }
  for (const path of dependencyInputPaths) {
    if (!/^[a-f0-9]{64}$/u.test(fingerprint.fileSha256?.[path] ?? '')) {
      throw new Error(`run ${run.id} active fingerprint is missing ${path}`);
    }
  }
  if (fingerprint.sourceSha !== run.identity?.headSha) {
    throw new Error(`run ${run.id} run-head fingerprint does not match the workflow head SHA`);
  }
  if (
    fingerprint.epochId !== epoch.id ||
    run.dependencyCompatibility?.comparisonEpochId !== epoch.id
  ) {
    throw new Error(`run ${run.id} measurement epoch identity is inconsistent`);
  }
  if (!['compatible-active-epoch', 'changed-inputs'].includes(run.dependencyCompatibility?.state)) {
    throw new Error(`run ${run.id} active measurement compatibility is unavailable`);
  }
}

function confidenceFor(sampleCount) {
  if (sampleCount >= 10) return 'decision-quality';
  if (sampleCount >= 5) return 'provisional';
  return 'insufficient';
}

function budgetStatus(cohort, policy) {
  const budget = policy.advisoryBudgets?.[cohort.surface] ?? null;
  if (!budget) return null;
  const wallP95 = cohort.metrics.workflowWallSeconds.p95;
  const billedP95 = cohort.metrics.roundedBilledMinutes.p95;
  return {
    mode: 'advisory',
    roundedBilledMinutesP95: budget.roundedBilledMinutesP95,
    roundedBilledMinutesStatus:
      billedP95 === null || budget.roundedBilledMinutesP95 === null
        ? 'insufficient-evidence'
        : billedP95 <= budget.roundedBilledMinutesP95
          ? 'within'
          : 'exceeded',
    wallP95Seconds: budget.wallP95Seconds,
    wallStatus:
      wallP95 === null
        ? 'insufficient-evidence'
        : wallP95 <= budget.wallP95Seconds
          ? 'within'
          : 'exceeded',
  };
}

function summarizeResources(resourceInventory, policy) {
  const resources = policy.repositoryResources ?? {};
  const cache = resourceInventory?.cache ?? null;
  const artifacts = resourceInventory?.artifacts ?? null;
  return {
    artifacts: artifacts
      ? {
          ...artifacts,
          effectiveSharedStorageBytes: resources.effectiveSharedStorageBytes ?? null,
          retentionDays: resources.artifactRetentionDays ?? null,
          usageRatio:
            resources.effectiveSharedStorageBytes > 0
              ? artifacts.activeSizeBytes / resources.effectiveSharedStorageBytes
              : null,
        }
      : null,
    cache: cache
      ? {
          ...cache,
          limitBytes: resources.cacheLimitBytes ?? null,
          retentionDays: resources.cacheRetentionDays ?? null,
          usageRatio:
            resources.cacheLimitBytes > 0
              ? cache.activeSizeBytes / resources.cacheLimitBytes
              : null,
          warning:
            resources.cacheLimitBytes > 0
              ? cache.activeSizeBytes / resources.cacheLimitBytes >=
                (resources.cacheWarningRatio ?? 1)
              : null,
        }
      : null,
    packages: resourceInventory?.packages ?? null,
    policy: {
      allowanceDriftRequiresOwnerReview: resources.allowanceDriftRequiresOwnerReview ?? false,
      officialProArtifactStorageReferenceBytes:
        resources.officialProArtifactStorageReferenceBytes ?? null,
      reviewedAt: policy.reviewedAt,
      sharedStorageOwnerEvidence: resources.sharedStorageOwnerEvidence ?? null,
    },
  };
}

function summarizeCohort(surface, cohortRuns, policy) {
  const sampleCount = cohortRuns.length;
  const cohort = {
    confidence: confidenceFor(sampleCount),
    eventTypes: [...new Set(cohortRuns.map((run) => run.event))].sort(),
    metrics: {
      estimatedGrossUsd: summarizeMetric(
        cohortRuns.map((run) => run.estimatedGrossUsd),
        sampleCount,
      ),
      rawComputeSeconds: summarizeMetric(
        cohortRuns.map((run) => run.rawComputeSeconds),
        sampleCount,
      ),
      roundedBilledMinutes: summarizeMetric(
        cohortRuns.map((run) => run.roundedBilledMinutes),
        sampleCount,
      ),
      workflowWallSeconds: summarizeMetric(
        cohortRuns.map((run) => run.workflowWallSeconds),
        sampleCount,
      ),
    },
    runIds: cohortRuns.map((run) => run.id).sort((left, right) => left - right),
    sampleCount,
    surface,
    testInventory: {
      caseCounts: [...new Set(cohortRuns.map((run) => run.tests?.testCases))].sort(),
      fileCounts: [...new Set(cohortRuns.map((run) => run.tests?.testFiles))].sort(),
    },
  };
  cohort.budget = budgetStatus(cohort, policy);
  return cohort;
}

export function buildPerformanceReport({ datasets, policy, resourceInventory = null }) {
  const byId = new Map();
  const schemaVersions = new Set();
  for (const dataset of datasets) {
    if (![2, 3].includes(dataset.schemaVersion)) {
      throw new Error(`unsupported performance dataset schema: ${dataset.schemaVersion}`);
    }
    schemaVersions.add(dataset.schemaVersion);
    for (const run of dataset.runs ?? []) byId.set(run.id, run);
  }
  if (schemaVersions.size > 1) {
    throw new Error('historical and active-epoch dataset schemas cannot be mixed');
  }

  const runs = [...byId.values()];
  if (schemaVersions.has(3)) runs.forEach(validateActiveEpochRun);
  const incompatible = runs.filter(
    (run) => run.dependencyCompatibility?.state === 'changed-inputs',
  );
  if (incompatible.length > 0) {
    throw new Error(`dependency inputs changed in run(s): ${incompatible.map((run) => run.id)}`);
  }
  const fingerprints = new Set(runs.map((run) => stableFingerprint(run.dependencyFingerprint)));
  if (fingerprints.size > 1)
    throw new Error('mixed dependency fingerprint datasets are not comparable');

  const successfulRuns = runs.filter((run) => run.conclusion === 'success' && run.attempt === 1);
  const primaryRuns = successfulRuns.filter((run) => run.event === 'pull_request');
  const cohorts = {};
  const gaps = [];
  for (const surface of expectedSurfaces) {
    const cohortRuns = primaryRuns.filter((run) => run.change?.surface === surface);
    if (cohortRuns.length === 0) continue;
    const sampleCount = cohortRuns.length;
    const cohort = summarizeCohort(surface, cohortRuns, policy);
    cohorts[surface] = cohort;
    if (sampleCount < 10) {
      gaps.push(
        `${surface}: ${sampleCount} natural sample(s); 5 required for provisional p50 and 10 for p95`,
      );
    }
  }

  const eventCohorts = {};
  for (const surface of expectedSurfaces) {
    for (const event of [...new Set(successfulRuns.map((run) => run.event))].sort()) {
      const cohortRuns = successfulRuns.filter(
        (run) => run.change?.surface === surface && run.event === event,
      );
      if (cohortRuns.length === 0) continue;
      eventCohorts[`${surface}:${event}`] = summarizeCohort(surface, cohortRuns, policy);
    }
  }

  const stageValues = new Map();
  for (const run of primaryRuns) {
    for (const job of run.jobs ?? []) {
      for (const step of job.steps ?? []) {
        if (!stageValues.has(step.name)) stageValues.set(step.name, []);
        stageValues.get(step.name).push(step.durationSeconds);
      }
    }
  }
  const stages = Object.fromEntries(
    [...stageValues.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, values]) => [
        name,
        { durationSeconds: summarizeMetric(values, values.length), sampleCount: values.length },
      ]),
  );

  return {
    cohorts,
    dependencyFingerprint: runs[0]?.dependencyFingerprint ?? null,
    measurementEpoch: runs[0]?.measurementEpoch ?? null,
    eventCohorts,
    gaps,
    generatedAt: new Date().toISOString(),
    missingCohorts: expectedSurfaces.filter((surface) => !cohorts[surface]),
    operations: {
      cancelledJobs: runs.reduce((total, run) => total + (run.outcome?.cancelledJobCount ?? 0), 0),
      failedJobs: runs.reduce((total, run) => total + (run.outcome?.failedJobCount ?? 0), 0),
      retries: runs.reduce((total, run) => total + (run.outcome?.retryCount ?? 0), 0),
      wastedComputeSeconds: runs.reduce(
        (total, run) => total + (run.outcome?.wastedComputeSeconds ?? 0),
        0,
      ),
    },
    policyReviewedAt: policy.reviewedAt,
    resources: summarizeResources(resourceInventory, policy),
    runCount: runs.length,
    schemaVersion: 1,
    stages,
    successfulFirstAttemptRunCount: successfulRuns.length,
    successfulPullRequestRunCount: primaryRuns.length,
  };
}

function parseArgs(argv) {
  const options = { inputs: [], output: null, resourceInventory: null };
  for (const argument of argv) {
    if (argument === '--') continue;
    if (argument.startsWith('--input=')) options.inputs.push(argument.slice('--input='.length));
    else if (argument.startsWith('--resource-inventory=')) {
      options.resourceInventory = argument.slice('--resource-inventory='.length);
    } else if (argument.startsWith('--output='))
      options.output = argument.slice('--output='.length);
    else throw new Error(`unknown argument: ${argument}`);
  }
  if (options.inputs.length === 0) throw new Error('at least one --input is required');
  return options;
}

function repositoryOutputPath(output) {
  const outputPath = output
    ? resolve(repoRoot, output)
    : resolveArtifactPath(repoRoot, ['ci-performance', 'cohort-report.json']);
  const repositoryRelative = relative(repoRoot, outputPath);
  if (repositoryRelative.startsWith('..') || repositoryRelative === '') {
    throw new Error('--output must resolve to a file inside the repository');
  }
  return outputPath;
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(repoRoot, path), 'utf8'));
}

function main(argv) {
  const options = parseArgs(argv);
  const policy = readJson('scripts/ci/fixtures/github-actions-performance-policy.json');
  const report = buildPerformanceReport({
    datasets: options.inputs.map(readJson),
    policy,
    resourceInventory: options.resourceInventory ? readJson(options.resourceInventory) : null,
  });
  const outputPath = repositoryOutputPath(options.output);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
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
