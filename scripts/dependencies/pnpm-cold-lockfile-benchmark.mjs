#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { resolveArtifactPath } from '../artifacts/paths.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, '../..');
const fixturePath = resolve(scriptDirectory, 'fixtures/pnpm-cold-lockfile-benchmark.json');
const maxBuffer = 20 * 1024 * 1024;

function assertNonEmptyString(value, path) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${path} must be a non-empty string`);
  }
}

function assertSemver(value, path) {
  assertNonEmptyString(value, path);
  if (!/^\d+\.\d+\.\d+$/u.test(value)) {
    throw new TypeError(`${path} must be an exact semantic version`);
  }
}

export function parseBenchmarkFixture(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('pnpm benchmark fixture must be an object');
  }
  if (input.schemaVersion !== 1) throw new TypeError('schemaVersion must equal 1');
  if (!Array.isArray(input.versions) || input.versions.length < 2) {
    throw new TypeError('versions must contain at least two exact versions');
  }
  input.versions.forEach((version, index) => assertSemver(version, `versions[${index}]`));
  if (new Set(input.versions).size !== input.versions.length) {
    throw new TypeError('versions must not contain duplicates');
  }
  if (!Number.isInteger(input.trialCount) || input.trialCount < 1 || input.trialCount > 3) {
    throw new TypeError('trialCount must be an integer between 1 and 3');
  }
  if (!Array.isArray(input.command) || input.command.length < 1) {
    throw new TypeError('command must contain pnpm arguments');
  }
  input.command.forEach((argument, index) => assertNonEmptyString(argument, `command[${index}]`));
  if (!Array.isArray(input.mutations) || input.mutations.length < 1) {
    throw new TypeError('mutations must contain at least one disposable workload change');
  }
  for (const [index, mutation] of input.mutations.entries()) {
    assertNonEmptyString(mutation.file, `mutations[${index}].file`);
    assertNonEmptyString(mutation.from, `mutations[${index}].from`);
    assertNonEmptyString(mutation.to, `mutations[${index}].to`);
    if (mutation.file.startsWith('/') || mutation.file.split('/').includes('..')) {
      throw new TypeError(`mutations[${index}].file must stay inside the disposable workspace`);
    }
    if (mutation.from === mutation.to) {
      throw new TypeError(`mutations[${index}] must change its target`);
    }
  }
  return structuredClone(input);
}

export function applyExactMutations({ workspace, mutations }) {
  const changedFiles = new Set();
  for (const mutation of mutations) {
    const path = resolve(workspace, mutation.file);
    const before = readFileSync(path, 'utf8');
    const occurrences = before.split(mutation.from).length - 1;
    if (occurrences !== 1) {
      throw new Error(
        `${mutation.file} must contain exactly one benchmark target ${JSON.stringify(mutation.from)}; found ${occurrences}`,
      );
    }
    writeFileSync(path, before.replace(mutation.from, mutation.to));
    changedFiles.add(mutation.file);
  }
  return [...changedFiles].sort();
}

export function parseTimeMetrics(input, platform = process.platform) {
  assertNonEmptyString(input, 'time output');
  if (platform === 'darwin') {
    const match = input.match(/^\s*(\d+)\s+maximum resident set size\s*$/mu);
    if (!match) throw new Error('macOS time output is missing maximum resident set size');
    return { peakRssBytes: Number(match[1]), source: '/usr/bin/time -l' };
  }
  const match = input.match(/^\s*Maximum resident set size \(kbytes\):\s*(\d+)\s*$/mu);
  if (!match) throw new Error('GNU time output is missing maximum resident set size');
  return { peakRssBytes: Number(match[1]) * 1024, source: '/usr/bin/time -v' };
}

export function summarizeVersionTrials(trials) {
  if (!Array.isArray(trials) || trials.length < 1) throw new TypeError('trials are required');
  const successful = trials.filter(({ exitCode }) => exitCode === 0);
  const sortedRss = successful.map(({ peakRssBytes }) => peakRssBytes).sort((a, b) => a - b);
  const sortedElapsed = successful.map(({ elapsedMs }) => elapsedMs).sort((a, b) => a - b);
  const median = (values) => values[Math.floor(values.length / 2)] ?? null;
  return {
    successfulTrials: successful.length,
    totalTrials: trials.length,
    medianElapsedMs: median(sortedElapsed),
    medianPeakRssBytes: median(sortedRss),
    maxPeakRssBytes: sortedRss.at(-1) ?? null,
  };
}

export function selectCandidate({ baselineVersion, fixFloorVersion, latestVersion, summaries }) {
  const baseline = summaries[baselineVersion];
  const fixFloor = summaries[fixFloorVersion];
  const latest = summaries[latestVersion];
  if (![baseline, fixFloor, latest].every((summary) => summary?.successfulTrials > 0)) {
    return { decision: 'no-go', reason: 'one-or-more-candidates-failed' };
  }
  const regressionLimit = Math.ceil(fixFloor.medianPeakRssBytes * 1.1);
  if (latest.medianPeakRssBytes > regressionLimit) {
    return {
      decision: 'no-go',
      reason: 'latest-regresses-more-than-ten-percent-from-fix-floor',
      regressionLimit,
    };
  }
  return {
    decision: 'promote',
    selectedVersion: latestVersion,
    reason:
      latest.medianPeakRssBytes < baseline.medianPeakRssBytes
        ? 'latest-passes-and-reduces-local-cold-peak-rss'
        : 'latest-passes-without-material-regression-from-fix-floor',
    regressionLimit,
  };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer,
    ...options,
  });
  if (result.error) throw result.error;
  return result;
}

function copyTrackedWorkspace(source, destination) {
  const listed = run('git', ['ls-files', '-z'], { cwd: source });
  if (listed.status !== 0) throw new Error(`git ls-files failed: ${listed.stderr.trim()}`);
  const paths = listed.stdout.split('\0').filter(Boolean);
  for (const trackedPath of paths) {
    const from = resolve(source, trackedPath);
    if (!existsSync(from)) continue;
    const to = resolve(destination, trackedPath);
    mkdirSync(dirname(to), { recursive: true });
    const stat = lstatSync(from);
    if (stat.isSymbolicLink()) symlinkSync(readlinkSync(from), to);
    else copyFileSync(from, to);
  }
  return paths.length;
}

function createIsolatedEnvironment(root) {
  const home = join(root, 'home');
  const corepackHome = join(root, 'corepack');
  const temp = join(root, 'tmp');
  for (const path of [home, corepackHome, temp]) mkdirSync(path, { recursive: true });
  return {
    COREPACK_HOME: corepackHome,
    HOME: home,
    LANG: process.env.LANG || 'C.UTF-8',
    LC_ALL: process.env.LC_ALL || process.env.LANG || 'C.UTF-8',
    PATH: process.env.PATH,
    TMPDIR: temp,
    XDG_CACHE_HOME: join(home, '.cache'),
    XDG_CONFIG_HOME: join(home, '.config'),
    npm_config_registry: 'https://registry.npmjs.org/',
    npm_config_userconfig: join(home, '.npmrc'),
  };
}

function writeIsolatedPnpmConfig(workspace, root) {
  writeFileSync(
    resolve(workspace, '.npmrc'),
    [
      `store-dir=${join(root, 'pnpm-store')}`,
      `cache-dir=${join(root, 'pnpm-cache')}`,
      `state-dir=${join(root, 'pnpm-state')}`,
      'registry=https://registry.npmjs.org/',
      '',
    ].join('\n'),
  );
}

function setWorkspacePackageManager(workspace, version) {
  const path = resolve(workspace, 'package.json');
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  manifest.packageManager = `pnpm@${version}`;
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
}

function tail(input, lines = 40) {
  return input.split(/\r?\n/u).slice(-lines).join('\n');
}

function runTrial({ fixture, version, trial }) {
  const root = mkdtempSync(join(tmpdir(), `knu-pnpm-${version}-`));
  const workspace = join(root, 'workspace');
  mkdirSync(workspace, { recursive: true });
  const environment = createIsolatedEnvironment(root);
  const keepWorkspace = process.env.KNU_KEEP_BENCHMARK_WORKSPACES === '1';
  try {
    const trackedFileCount = copyTrackedWorkspace(repoRoot, workspace);
    const changedFiles = applyExactMutations({ workspace, mutations: fixture.mutations });
    setWorkspacePackageManager(workspace, version);
    writeIsolatedPnpmConfig(workspace, root);

    const prepared = run('corepack', ['prepare', `pnpm@${version}`, '--activate'], {
      cwd: workspace,
      env: environment,
    });
    if (prepared.status !== 0) {
      throw new Error(`corepack prepare pnpm@${version} failed: ${tail(prepared.stderr)}`);
    }
    const versionCheck = run('corepack', ['pnpm', '--version'], {
      cwd: workspace,
      env: environment,
    });
    if (versionCheck.status !== 0 || versionCheck.stdout.trim() !== version) {
      throw new Error(
        `corepack selected ${versionCheck.stdout.trim() || 'no pnpm version'} instead of ${version}`,
      );
    }

    const timeArgs = process.platform === 'darwin' ? ['-l'] : ['-v'];
    const startedAt = Date.now();
    const result = run('/usr/bin/time', [...timeArgs, 'corepack', 'pnpm', ...fixture.command], {
      cwd: workspace,
      env: environment,
    });
    const elapsedMs = Date.now() - startedAt;
    const metrics = parseTimeMetrics(result.stderr, process.platform);
    const lockfileHash = createHash('sha256')
      .update(readFileSync(resolve(workspace, 'pnpm-lock.yaml')))
      .digest('hex');
    return {
      version,
      trial,
      exitCode: result.status ?? 1,
      elapsedMs,
      ...metrics,
      trackedFileCount,
      changedFiles,
      lockfileHash,
      stderrTail: result.status === 0 ? undefined : tail(result.stderr),
      workspace: keepWorkspace ? workspace : undefined,
    };
  } finally {
    if (!keepWorkspace) rmSync(root, { force: true, recursive: true });
  }
}

export function buildBenchmarkSummary({ fixture, trials, generatedAt, sourceSha }) {
  const summaries = Object.fromEntries(
    fixture.versions.map((version) => [
      version,
      summarizeVersionTrials(trials.filter((trial) => trial.version === version)),
    ]),
  );
  const [baselineVersion, fixFloorVersion, latestVersion] = fixture.versions;
  return {
    schemaVersion: 1,
    generatedAt,
    sourceSha,
    coldRun: true,
    processBoundary:
      'Measured peak RSS covers /usr/bin/time around Corepack and pnpm, not the parent Mend Renovate process tree.',
    fixture,
    trials,
    summaries,
    selection: selectCandidate({ baselineVersion, fixFloorVersion, latestVersion, summaries }),
  };
}

async function main() {
  if (!['darwin', 'linux'].includes(process.platform)) {
    throw new Error('cold lockfile benchmark supports macOS or Linux /usr/bin/time output');
  }
  const fixture = parseBenchmarkFixture(JSON.parse(readFileSync(fixturePath, 'utf8')));
  const source = run('git', ['rev-parse', 'HEAD'], { cwd: repoRoot });
  if (source.status !== 0) throw new Error(`git rev-parse failed: ${source.stderr.trim()}`);
  const trials = [];
  for (const version of fixture.versions) {
    for (let trial = 1; trial <= fixture.trialCount; trial += 1) {
      process.stderr.write(`pnpm ${version} cold trial ${trial}/${fixture.trialCount}\n`);
      trials.push(runTrial({ fixture, version, trial }));
    }
  }
  const summary = buildBenchmarkSummary({
    fixture,
    trials,
    generatedAt: new Date().toISOString(),
    sourceSha: source.stdout.trim(),
  });
  const outputPath = resolveArtifactPath(repoRoot, [
    'dependency-automation',
    'pnpm-cold-lockfile-benchmark.json',
  ]);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(
    `${JSON.stringify({ outputPath: relative(repoRoot, outputPath), ...summary.selection }, null, 2)}\n`,
  );
  if (summary.selection.decision !== 'promote') process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
