const CACHE_STATES = new Set(['exact-hit', 'fallback-hit', 'miss', 'not-applicable', 'unknown']);

function assertRecord(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object`);
  }
}

function assertString(value, path) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${path} must be a non-empty string`);
  }
}

function assertNonNegativeNumber(value, path) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`${path} must be a finite non-negative number`);
  }
}

function assertNonNegativeInteger(value, path) {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`${path} must be a non-negative integer`);
  }
}

function assertSha256(value, path) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) {
    throw new TypeError(`${path} must be a lowercase SHA-256 digest`);
  }
}

function assertCache(cache, name) {
  assertRecord(cache, `cache.${name}`);
  if (!CACHE_STATES.has(cache.state)) {
    throw new TypeError(`cache.${name}.state must be a supported cache state`);
  }
}

export function parseCiPerformanceEvidence(input) {
  assertRecord(input, 'evidence');
  if (input.schemaVersion !== 1) {
    throw new TypeError('schemaVersion must equal 1');
  }

  assertString(input.capturedAt, 'capturedAt');
  assertRecord(input.source, 'source');
  assertNonNegativeInteger(input.source.workflowRunId, 'source.workflowRunId');
  assertString(input.source.headSha, 'source.headSha');
  assertString(input.source.url, 'source.url');

  assertRecord(input.dependencyBaseline, 'dependencyBaseline');
  if (input.dependencyBaseline.state !== 'frozen') {
    throw new TypeError('dependencyBaseline.state must equal frozen');
  }
  assertString(input.dependencyBaseline.capturedAt, 'dependencyBaseline.capturedAt');
  if (!/^[a-f0-9]{40}$/u.test(input.dependencyBaseline.devHeadSha)) {
    throw new TypeError('dependencyBaseline.devHeadSha must be a full commit SHA');
  }
  assertRecord(input.dependencyBaseline.fileSha256, 'dependencyBaseline.fileSha256');
  for (const path of ['pnpm-lock.yaml', 'pnpm-workspace.yaml', 'infra/image-inventory.json']) {
    assertSha256(
      input.dependencyBaseline.fileSha256[path],
      `dependencyBaseline.fileSha256.${path}`,
    );
  }
  assertRecord(
    input.dependencyBaseline.workflowBaselineSha256,
    'dependencyBaseline.workflowBaselineSha256',
  );
  for (const path of [
    '.github/workflows/ci.yml',
    '.github/workflows/api-ci.yml',
    '.github/workflows/web-ci.yml',
    '.github/workflows/infra-ci.yml',
  ]) {
    assertSha256(
      input.dependencyBaseline.workflowBaselineSha256[path],
      `dependencyBaseline.workflowBaselineSha256.${path}`,
    );
  }
  assertRecord(input.dependencyBaseline.versions, 'dependencyBaseline.versions');
  for (const name of ['node', 'pnpm', 'pnpmAction', 'postgresql', 'alertmanager', 'grafana']) {
    assertString(input.dependencyBaseline.versions[name], `dependencyBaseline.versions.${name}`);
  }
  if (
    !Array.isArray(input.dependencyBaseline.acceptanceRuns) ||
    input.dependencyBaseline.acceptanceRuns.length === 0
  ) {
    throw new TypeError('dependencyBaseline.acceptanceRuns must contain at least one run');
  }
  input.dependencyBaseline.acceptanceRuns.forEach((run, index) => {
    assertRecord(run, `dependencyBaseline.acceptanceRuns[${index}]`);
    assertString(run.scope, `dependencyBaseline.acceptanceRuns[${index}].scope`);
    assertNonNegativeInteger(run.prNumber, `dependencyBaseline.acceptanceRuns[${index}].prNumber`);
    assertNonNegativeInteger(
      run.workflowRunId,
      `dependencyBaseline.acceptanceRuns[${index}].workflowRunId`,
    );
  });
  assertRecord(input.dependencyBaseline.security, 'dependencyBaseline.security');
  assertNonNegativeInteger(
    input.dependencyBaseline.security.openAlerts,
    'dependencyBaseline.security.openAlerts',
  );
  assertNonNegativeInteger(
    input.dependencyBaseline.security.dismissedResiduals,
    'dependencyBaseline.security.dismissedResiduals',
  );
  assertRecord(input.dependencyBaseline.queue, 'dependencyBaseline.queue');
  assertNonNegativeInteger(
    input.dependencyBaseline.queue.openPullRequests,
    'dependencyBaseline.queue.openPullRequests',
  );
  assertNonNegativeInteger(
    input.dependencyBaseline.queue.dashboardApprovals,
    'dependencyBaseline.queue.dashboardApprovals',
  );
  assertString(
    input.dependencyBaseline.queue.automatedPullRequests,
    'dependencyBaseline.queue.automatedPullRequests',
  );
  assertRecord(input.dependencyBaseline.cache, 'dependencyBaseline.cache');
  assertNonNegativeInteger(
    input.dependencyBaseline.cache.activeCount,
    'dependencyBaseline.cache.activeCount',
  );
  assertNonNegativeInteger(
    input.dependencyBaseline.cache.activeSizeBytes,
    'dependencyBaseline.cache.activeSizeBytes',
  );
  if (
    !Array.isArray(input.dependencyBaseline.knownGaps) ||
    input.dependencyBaseline.knownGaps.length === 0
  ) {
    throw new TypeError('dependencyBaseline.knownGaps must contain at least one gap');
  }
  input.dependencyBaseline.knownGaps.forEach((gap, index) =>
    assertString(gap, `dependencyBaseline.knownGaps[${index}]`),
  );

  assertRecord(input.workflow, 'workflow');
  assertNonNegativeNumber(input.workflow.wallSeconds, 'workflow.wallSeconds');

  if (!Array.isArray(input.jobs) || input.jobs.length === 0) {
    throw new TypeError('jobs must contain at least one job');
  }

  const lanes = new Set();
  input.jobs.forEach((job, jobIndex) => {
    assertRecord(job, `jobs[${jobIndex}]`);
    assertString(job.lane, `jobs[${jobIndex}].lane`);
    if (lanes.has(job.lane)) throw new TypeError(`jobs[${jobIndex}].lane must be unique`);
    lanes.add(job.lane);
    if (typeof job.selected !== 'boolean') {
      throw new TypeError(`jobs[${jobIndex}].selected must be a boolean`);
    }
    assertNonNegativeNumber(job.wallSeconds, `jobs[${jobIndex}].wallSeconds`);
    assertNonNegativeNumber(job.computeSeconds, `jobs[${jobIndex}].computeSeconds`);
    if (!Array.isArray(job.stages)) {
      throw new TypeError(`jobs[${jobIndex}].stages must be an array`);
    }
    job.stages.forEach((stage, stageIndex) => {
      assertRecord(stage, `jobs[${jobIndex}].stages[${stageIndex}]`);
      assertString(stage.name, `jobs[${jobIndex}].stages[${stageIndex}].name`);
      assertNonNegativeNumber(stage.seconds, `jobs[${jobIndex}].stages[${stageIndex}].seconds`);
      if (!['success', 'skipped'].includes(stage.result)) {
        throw new TypeError(
          `jobs[${jobIndex}].stages[${stageIndex}].result must be success or skipped`,
        );
      }
    });
  });

  assertRecord(input.cache, 'cache');
  assertCache(input.cache.pnpm, 'pnpm');
  assertCache(input.cache.next, 'next');

  assertRecord(input.testInventory, 'testInventory');
  assertNonNegativeInteger(input.testInventory.testFileCount, 'testInventory.testFileCount');
  assertNonNegativeInteger(input.testInventory.testCaseCount, 'testInventory.testCaseCount');
  if (!Array.isArray(input.testInventory.suites) || input.testInventory.suites.length === 0) {
    throw new TypeError('testInventory.suites must contain at least one suite');
  }

  let suiteFileTotal = 0;
  let suiteCaseTotal = 0;
  input.testInventory.suites.forEach((suite, suiteIndex) => {
    assertRecord(suite, `testInventory.suites[${suiteIndex}]`);
    assertString(suite.name, `testInventory.suites[${suiteIndex}].name`);
    assertNonNegativeInteger(suite.testFiles, `testInventory.suites[${suiteIndex}].testFiles`);
    assertNonNegativeInteger(suite.testCases, `testInventory.suites[${suiteIndex}].testCases`);
    assertNonNegativeNumber(suite.seconds, `testInventory.suites[${suiteIndex}].seconds`);
    suiteFileTotal += suite.testFiles;
    suiteCaseTotal += suite.testCases;
  });

  if (suiteFileTotal !== input.testInventory.testFileCount) {
    throw new TypeError('suite test file total must equal testInventory.testFileCount');
  }
  if (suiteCaseTotal !== input.testInventory.testCaseCount) {
    throw new TypeError('suite test case total must equal testInventory.testCaseCount');
  }

  return structuredClone(input);
}

export function summarizeCiPerformanceEvidence(evidence) {
  const parsed = parseCiPerformanceEvidence(evidence);
  const computeSeconds = parsed.jobs.reduce((total, job) => total + job.computeSeconds, 0);
  const jobs = Object.fromEntries(
    parsed.jobs.map((job) => [
      job.lane,
      {
        computeSeconds: job.computeSeconds,
        selected: job.selected,
        wallSeconds: job.wallSeconds,
      },
    ]),
  );

  return {
    cache: {
      next: parsed.cache.next.state,
      pnpm: parsed.cache.pnpm.state,
    },
    computeSeconds,
    dependencyBaseline: {
      acceptanceRunCount: parsed.dependencyBaseline.acceptanceRuns.length,
      devHeadSha: parsed.dependencyBaseline.devHeadSha,
      dismissedResiduals: parsed.dependencyBaseline.security.dismissedResiduals,
      openAlerts: parsed.dependencyBaseline.security.openAlerts,
      state: parsed.dependencyBaseline.state,
    },
    jobs,
    testCaseCount: parsed.testInventory.testCaseCount,
    testFileCount: parsed.testInventory.testFileCount,
    wallSeconds: parsed.workflow.wallSeconds,
    workflowRunId: parsed.source.workflowRunId,
  };
}

function main(argv) {
  const [evidencePath] = argv;
  if (!evidencePath) {
    throw new Error('usage: ci-performance-evidence.mjs <evidence.json>');
  }
  const input = JSON.parse(readFileSync(resolve(evidencePath), 'utf8'));
  const summary = summarizeCiPerformanceEvidence(input);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
