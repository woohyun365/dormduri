#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { resolveArtifactPath } from '../artifacts/paths.mjs';

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

export function buildRunEvidence({ run, jobs, artifacts, log }) {
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
    return {
      billingMultiplier,
      completedAt: job.completed_at ?? null,
      conclusion: job.conclusion ?? null,
      id: job.id,
      name: job.name,
      queueSeconds: secondsBetween(run.run_started_at ?? run.created_at, job.started_at),
      roundedBilledMinutes:
        wallSeconds === 0
          ? 0
          : billingMultiplier === null
            ? null
            : roundedJobMinutes * billingMultiplier,
      roundedJobMinutes,
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

  return {
    artifacts: {
      count: artifacts.length,
      items: artifacts.map((artifact) => ({
        expired: artifact.expired === true,
        id: artifact.id,
        name: artifact.name,
        sizeBytes: artifact.size_in_bytes,
      })),
      totalSizeBytes: artifacts.reduce((total, artifact) => total + artifact.size_in_bytes, 0),
    },
    attempt: run.run_attempt,
    cache: parsedLog.cache,
    conclusion: run.conclusion,
    createdAt: run.created_at,
    event: run.event,
    headSha: run.head_sha,
    id: run.id,
    jobs: jobEvidence,
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

export function collectGithubActionsRun(repository, runId) {
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
  return buildRunEvidence({ artifacts, jobs, log, run });
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
  const evidence = {
    collectedAt: new Date().toISOString(),
    repository: options.repository,
    runs: options.runIds.map((runId) => collectGithubActionsRun(options.repository, runId)),
    schemaVersion: 1,
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
