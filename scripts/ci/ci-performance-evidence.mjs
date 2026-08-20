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
