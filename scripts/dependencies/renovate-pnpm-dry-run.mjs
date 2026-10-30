#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { resolveArtifactPath } from '../artifacts/paths.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, '../..');
const fixturePath = resolve(scriptDirectory, 'fixtures/renovate-pnpm-dry-run.json');
const repositoryConfigPath = resolve(repoRoot, 'renovate.json');
const rootManifestPath = resolve(repoRoot, 'package.json');
const maxCapturedOutputBytes = 5 * 1024 * 1024;

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${fieldName} must be a non-empty string`);
  }
}

export function parseDryRunFixture(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Renovate dry-run fixture must be an object');
  }
  if (input.schemaVersion !== 1) throw new TypeError('schemaVersion must equal 1');
  assertNonEmptyString(input.renovateVersion, 'renovateVersion');
  if (input.packageManager !== undefined) {
    throw new TypeError('packageManager comes from the root package.json, not the fixture');
  }
  if (
    !Number.isInteger(input.expectedExtraction?.fileCount) ||
    !Number.isInteger(input.expectedExtraction?.depCount)
  ) {
    throw new TypeError('expectedExtraction must contain integer file and dependency counts');
  }
  if (!Number.isInteger(input.timeoutSeconds) || input.timeoutSeconds < 1) {
    throw new TypeError('timeoutSeconds must be a positive integer');
  }
  if (!Array.isArray(input.updates) || input.updates.length !== 3) {
    throw new TypeError('updates must contain the catalog, API, and Web cases');
  }
  if (
    !Array.isArray(input.pendingApprovalUpdates) ||
    !input.pendingApprovalUpdates.some(({ updateType }) => updateType === 'major')
  ) {
    throw new TypeError('pendingApprovalUpdates must include the dashboard-gated major case');
  }
  if (
    !Array.isArray(input.approvalPackageManagers) ||
    !input.approvalPackageManagers.includes('pnpm')
  ) {
    throw new TypeError('approvalPackageManagers must include pnpm');
  }
  if (!Array.isArray(input.allowedChangedFiles) || input.allowedChangedFiles.length !== 4) {
    throw new TypeError('allowedChangedFiles must contain three sources and one lockfile');
  }

  for (const [index, update] of [...input.updates, ...input.pendingApprovalUpdates].entries()) {
    for (const fieldName of ['kind', 'packageName', 'from', 'updateType', 'file']) {
      assertNonEmptyString(update[fieldName], `update[${index}].${fieldName}`);
    }
  }
  for (const [index, update] of input.updates.entries()) {
    assertNonEmptyString(update.to, `updates[${index}].to`);
  }
  // A pending approval line takes whatever version upstream publishes next, so the fixture names no target.
  if (input.pendingApprovalUpdates.some((update) => update.to !== undefined)) {
    throw new TypeError('pendingApprovalUpdates must not pin a target version');
  }

  const kinds = uniqueSorted(input.updates.map(({ kind }) => kind));
  if (JSON.stringify(kinds) !== JSON.stringify(['catalog', 'inline-api', 'inline-web'])) {
    throw new TypeError('updates must cover catalog, inline-api, and inline-web exactly');
  }

  return structuredClone(input);
}

function exactVersionRule(update) {
  return {
    description: `Fixture-only cap for ${update.packageName}.`,
    matchManagers: ['npm'],
    matchPackageNames: [update.packageName],
    allowedVersions: update.to,
  };
}

export function buildFixtureFiles({ fixture, packageManager, repositoryConfig }) {
  parseDryRunFixture(fixture);
  assertNonEmptyString(packageManager, 'packageManager');
  if (
    !repositoryConfig ||
    typeof repositoryConfig !== 'object' ||
    Array.isArray(repositoryConfig)
  ) {
    throw new TypeError('repositoryConfig must be an object');
  }
  if (repositoryConfig.enabled !== true) {
    throw new Error('repository Renovate config must remain active after provider cutover');
  }

  const localConfig = structuredClone(repositoryConfig);
  localConfig.minimumReleaseAge = null;
  localConfig.packageRules.push(...fixture.updates.map(exactVersionRule));

  const catalogUpdate = fixture.updates.find(({ kind }) => kind === 'catalog');
  const pendingCatalog = fixture.pendingApprovalUpdates.find(({ kind }) => kind === 'catalog');
  const apiUpdate = fixture.updates.find(({ kind }) => kind === 'inline-api');
  const webUpdate = fixture.updates.find(({ kind }) => kind === 'inline-web');

  return {
    'apps/api/package.json': json({
      name: 'fixture-api',
      private: true,
      dependencies: { [apiUpdate.packageName]: apiUpdate.from },
      devDependencies: {
        [catalogUpdate.packageName]: 'catalog:',
        [pendingCatalog.packageName]: 'catalog:',
      },
    }),
    'apps/web/package.json': json({
      name: 'fixture-web',
      private: true,
      dependencies: { [webUpdate.packageName]: webUpdate.from },
      devDependencies: { [catalogUpdate.packageName]: 'catalog:' },
    }),
    'package.json': json({
      name: 'knu-renovate-pnpm-fixture',
      private: true,
      packageManager,
    }),
    'pnpm-workspace.yaml': [
      'packages:',
      '  - apps/*',
      '',
      'catalog:',
      `  ${catalogUpdate.packageName}: ${catalogUpdate.from}`,
      `  ${pendingCatalog.packageName}: ${pendingCatalog.from}`,
      '',
    ].join('\n'),
    'renovate.json': json(localConfig),
  };
}

export function createSanitizedDryRunEnvironment({ baseEnvironment, homeDirectory }) {
  assertNonEmptyString(homeDirectory, 'homeDirectory');
  const environment = {
    HOME: homeDirectory,
    LOG_FORMAT: 'json',
    LOG_LEVEL: 'debug',
    NPM_CONFIG_USERCONFIG: join(homeDirectory, '.npmrc'),
    PATH: baseEnvironment.PATH,
    XDG_CONFIG_HOME: join(homeDirectory, '.config'),
  };
  if (baseEnvironment.CI) environment.CI = baseEnvironment.CI;
  return environment;
}

function parseJsonLogLines(input) {
  return input
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line));
}

function ownerGroupFromBranch(branchName) {
  return branchName?.startsWith('renovate/') ? branchName.slice('renovate/'.length) : null;
}

// Non-major branches that open only after a person approves them on the Dependency Dashboard. The policy keeps every
// major dashboard-gated, and Renovate names a group's major branch renovate/major-<groupSlug>, so a group that takes
// only majors (eslint-major) adds no branch here.
export function dashboardApprovalBranches(repositoryConfig) {
  return repositoryConfig.packageRules
    .filter((rule) => rule.groupSlug && rule.dependencyDashboardApproval === true)
    .filter(
      ({ matchUpdateTypes }) =>
        !matchUpdateTypes || matchUpdateTypes.some((updateType) => updateType !== 'major'),
    )
    .map((rule) => `renovate/${rule.groupSlug}`)
    .sort();
}

// Lookup mode stops before Renovate processes branches, so the log does not show the approval state. A candidate is
// pending approval when it is a major or sits on an approval group branch. The harness clears minimumReleaseAge, so
// every enabled branch logs a branch record; a candidate without one was filtered out by a disabled rule.
export function parseRenovateLookupLog(input, { approvalBranches = [] } = {}) {
  assertNonEmptyString(input, 'Renovate lookup log');
  const records = parseJsonLogLines(input);
  const started = records.find(({ msg }) => msg === 'Renovate started');
  const extraction = records.find(({ msg }) => msg === 'Dependency extraction complete');
  const packageFiles = records.find(({ msg }) => msg === 'packageFiles with updates');
  const finished = records.find(({ msg }) => msg === 'Repository finished');
  const branches = new Set(
    records.filter(({ branch }) => typeof branch === 'string').map(({ branch }) => branch),
  );
  const approval = new Set(approvalBranches);

  if (!started?.renovateVersion || !extraction?.stats?.total || !packageFiles?.config?.npm) {
    throw new Error('Renovate lookup log is missing required extraction evidence');
  }
  if (!Number.isFinite(finished?.durationMs)) {
    throw new Error('Renovate lookup log is missing terminal duration evidence');
  }

  const candidates = packageFiles.config.npm.flatMap(({ deps = [], packageFile }) =>
    deps.flatMap((dependency) =>
      (dependency.updates ?? []).map((update) => ({
        branchName: update.branchName,
        currentValue: dependency.currentValue,
        newVersion: update.newVersion,
        ownerGroup: ownerGroupFromBranch(update.branchName),
        packageFile,
        packageName: dependency.depName,
        updateType: update.updateType,
      })),
    ),
  );
  const sortByPackageName = (left, right) => left.packageName.localeCompare(right.packageName);
  const visible = candidates.filter(({ branchName }) => branches.has(branchName));
  const isPendingApproval = ({ branchName, updateType }) =>
    updateType === 'major' || approval.has(branchName);

  return {
    durationMs: finished.durationMs,
    extraction: {
      depCount: extraction.stats.total.depCount,
      fileCount: extraction.stats.total.fileCount,
    },
    hiddenUpdates: candidates
      .filter(({ branchName }) => !branches.has(branchName))
      .sort(sortByPackageName),
    outputBytes: Buffer.byteLength(input),
    pendingApprovalUpdates: visible.filter(isPendingApproval).sort(sortByPackageName),
    proposedUpdates: visible
      .filter((candidate) => !isPendingApproval(candidate))
      .sort(sortByPackageName),
    renovateVersion: started.renovateVersion,
  };
}

function replaceCatalogVersion(input, update) {
  const expected = `  ${update.packageName}: ${update.from}`;
  const replacement = `  ${update.packageName}: ${update.to}`;
  if (!input.includes(expected)) throw new Error(`catalog source missing ${expected}`);
  return input.replace(expected, replacement);
}

function replaceManifestVersion(input, update) {
  const manifest = JSON.parse(input);
  const dependencySections = ['dependencies', 'devDependencies', 'optionalDependencies'];
  const sectionName = dependencySections.find((section) => manifest[section]?.[update.packageName]);
  if (!sectionName || manifest[sectionName][update.packageName] !== update.from) {
    throw new Error(`${update.file} does not own ${update.packageName}@${update.from}`);
  }
  manifest[sectionName][update.packageName] = update.to;
  return json(manifest);
}

export function applyFixtureTargets(inputFiles, fixture) {
  parseDryRunFixture(fixture);
  const outputFiles = structuredClone(inputFiles);

  for (const update of fixture.updates) {
    const input = outputFiles[update.file];
    if (typeof input !== 'string') throw new Error(`fixture source missing: ${update.file}`);
    outputFiles[update.file] =
      update.kind === 'catalog'
        ? replaceCatalogVersion(input, update)
        : replaceManifestVersion(input, update);
  }

  return outputFiles;
}

export function summarizeChangedFiles(beforeFiles, afterFiles, allowedChangedFiles) {
  const changedFiles = uniqueSorted(
    [...new Set([...Object.keys(beforeFiles), ...Object.keys(afterFiles)])].filter(
      (fileName) => beforeFiles[fileName] !== afterFiles[fileName],
    ),
  );
  const allowed = new Set(allowedChangedFiles);
  const unexpected = changedFiles.find((fileName) => !allowed.has(fileName));
  if (unexpected) throw new Error(`unexpected changed file: ${unexpected}`);
  return changedFiles;
}

function writeFiles(rootDirectory, files) {
  for (const [fileName, content] of Object.entries(files)) {
    const outputPath = resolve(rootDirectory, fileName);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, content);
  }
}

function readFixtureFiles(rootDirectory, fileNames) {
  return Object.fromEntries(
    fileNames.map((fileName) => [fileName, readFileSync(resolve(rootDirectory, fileName), 'utf8')]),
  );
}

function sha256(input) {
  return createHash('sha256').update(input).digest('hex');
}

function runCommand(command, args, { cwd, environment, timeoutSeconds }) {
  return new Promise((resolvePromise, rejectPromise) => {
    const startedAt = Date.now();
    const output = [];
    const child = spawn(command, args, {
      cwd,
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      rejectPromise(new Error(`${command} exceeded ${timeoutSeconds} seconds`));
    }, timeoutSeconds * 1000);

    let outputBytes = 0;
    const capture = (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > maxCapturedOutputBytes) {
        child.kill('SIGTERM');
        rejectPromise(new Error(`${command} exceeded the bounded output limit`));
        return;
      }
      output.push(chunk);
    };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
    child.on('error', (error) => {
      clearTimeout(timeout);
      rejectPromise(error);
    });
    child.on('close', (exitCode, signal) => {
      clearTimeout(timeout);
      const text = Buffer.concat(output).toString('utf8');
      if (exitCode !== 0) {
        rejectPromise(
          new Error(
            `${command} failed with exit code ${exitCode ?? 'null'} and signal ${signal ?? 'none'}\n${text}`,
          ),
        );
        return;
      }
      resolvePromise({ durationMs: Date.now() - startedAt, output: text });
    });
  });
}

// The dry-run fails when a candidate has no branch (a disabled rule hid it from the Dashboard) or when an approval
// package manager lands on an automatic branch.
export function assertLookupMatchesFixture(evidence, fixture) {
  if (evidence.renovateVersion !== fixture.renovateVersion) {
    throw new Error(
      `Renovate version mismatch: expected ${fixture.renovateVersion}, received ${evidence.renovateVersion}`,
    );
  }
  if (
    evidence.extraction.fileCount !== fixture.expectedExtraction.fileCount ||
    evidence.extraction.depCount !== fixture.expectedExtraction.depCount
  ) {
    throw new Error(`Renovate extraction drifted: ${JSON.stringify(evidence.extraction)}`);
  }
  if (evidence.hiddenUpdates.length !== 0) {
    throw new Error(
      `Renovate filtered out updates that must stay on the Dashboard: ${JSON.stringify(evidence.hiddenUpdates.map(({ packageName }) => packageName))}`,
    );
  }
  const automaticPackageManager = evidence.proposedUpdates.find(({ packageName }) =>
    fixture.approvalPackageManagers.includes(packageName),
  );
  if (automaticPackageManager) {
    throw new Error(
      `${automaticPackageManager.packageName} must wait for dashboard approval, not ${automaticPackageManager.branchName}`,
    );
  }

  const expectedProposed = fixture.updates
    .map(({ file, ownerGroup, packageName, to, updateType }) => ({
      newVersion: to,
      ownerGroup,
      packageFile: file,
      packageName,
      updateType,
    }))
    .sort((left, right) => left.packageName.localeCompare(right.packageName));
  const actualProposed = evidence.proposedUpdates.map(
    ({ newVersion, ownerGroup, packageFile, packageName, updateType }) => ({
      newVersion,
      ownerGroup,
      packageFile,
      packageName,
      updateType,
    }),
  );
  if (JSON.stringify(actualProposed) !== JSON.stringify(expectedProposed)) {
    throw new Error(
      `Renovate proposed updates differ from fixture: ${JSON.stringify(actualProposed)}`,
    );
  }

  // An approval package manager shows up only when upstream has a newer release, so its line may or may not appear.
  const pendingOf = (updates) =>
    updates
      .filter(({ packageName }) => !fixture.approvalPackageManagers.includes(packageName))
      .map(({ packageName, updateType }) => ({ packageName, updateType }))
      .sort((left, right) => left.packageName.localeCompare(right.packageName));
  const expectedPending = pendingOf(fixture.pendingApprovalUpdates);
  const actualPending = pendingOf(evidence.pendingApprovalUpdates);
  if (JSON.stringify(actualPending) !== JSON.stringify(expectedPending)) {
    throw new Error(`pending approval update mismatch: ${JSON.stringify(actualPending)}`);
  }
}

export async function runRenovatePnpmDryRun({ environment = process.env } = {}) {
  const fixture = parseDryRunFixture(JSON.parse(readFileSync(fixturePath, 'utf8')));
  const repositoryConfig = JSON.parse(readFileSync(repositoryConfigPath, 'utf8'));
  const { packageManager } = JSON.parse(readFileSync(rootManifestPath, 'utf8'));
  const fixtureDirectory = mkdtempSync(join(tmpdir(), 'knu-renovate-pnpm-'));
  const homeDirectory = mkdtempSync(join(tmpdir(), 'knu-renovate-home-'));
  const sanitizedEnvironment = createSanitizedDryRunEnvironment({
    baseEnvironment: environment,
    homeDirectory,
  });
  const materializedFiles = buildFixtureFiles({ fixture, packageManager, repositoryConfig });
  const artifactDirectory = resolveArtifactPath(repoRoot, ['dependency-automation']);
  const artifactLogPath = resolve(artifactDirectory, 'renovate-pnpm-local-lookup.ndjson');
  const artifactSummaryPath = resolve(artifactDirectory, 'renovate-pnpm-dry-run.json');
  const startedAt = Date.now();
  const deadline = startedAt + fixture.timeoutSeconds * 1000;
  const remainingTimeoutSeconds = () => {
    const remaining = Math.ceil((deadline - Date.now()) / 1000);
    if (remaining < 1) throw new Error('Renovate pnpm dry-run exceeded its total time budget');
    return remaining;
  };

  mkdirSync(homeDirectory, { recursive: true });
  mkdirSync(sanitizedEnvironment.XDG_CONFIG_HOME, { recursive: true });
  writeFileSync(
    sanitizedEnvironment.NPM_CONFIG_USERCONFIG,
    'registry=https://registry.npmjs.org/\n',
  );
  writeFiles(fixtureDirectory, materializedFiles);

  try {
    const installArgs = ['install', '--lockfile-only', '--ignore-scripts'];
    const initialInstall = await runCommand('pnpm', installArgs, {
      cwd: fixtureDirectory,
      environment: sanitizedEnvironment,
      timeoutSeconds: remainingTimeoutSeconds(),
    });
    const managedFiles = [...Object.keys(materializedFiles), 'pnpm-lock.yaml'];
    const beforeLookup = readFixtureFiles(fixtureDirectory, managedFiles);
    const lookup = await runCommand(
      'npx',
      [
        '--yes',
        '--package',
        `renovate@${fixture.renovateVersion}`,
        '--',
        'renovate',
        '--platform=local',
        '--dry-run=lookup',
        '--require-config=required',
      ],
      {
        cwd: fixtureDirectory,
        environment: sanitizedEnvironment,
        timeoutSeconds: remainingTimeoutSeconds(),
      },
    );
    const lookupEvidence = parseRenovateLookupLog(lookup.output, {
      approvalBranches: dashboardApprovalBranches(repositoryConfig),
    });
    assertLookupMatchesFixture(lookupEvidence, fixture);
    const afterLookup = readFixtureFiles(fixtureDirectory, managedFiles);
    if (summarizeChangedFiles(beforeLookup, afterLookup, []).length !== 0) {
      throw new Error('Renovate local lookup mutated the disposable repository');
    }

    const targetedFiles = applyFixtureTargets(beforeLookup, fixture);
    writeFiles(fixtureDirectory, targetedFiles);
    const targetInstall = await runCommand('pnpm', installArgs, {
      cwd: fixtureDirectory,
      environment: sanitizedEnvironment,
      timeoutSeconds: remainingTimeoutSeconds(),
    });
    const afterTargetInstall = readFixtureFiles(fixtureDirectory, managedFiles);
    const changedFiles = summarizeChangedFiles(
      beforeLookup,
      afterTargetInstall,
      fixture.allowedChangedFiles,
    );
    if (JSON.stringify(changedFiles) !== JSON.stringify([...fixture.allowedChangedFiles].sort())) {
      throw new Error(
        `fixture did not change the full expected file set: ${JSON.stringify(changedFiles)}`,
      );
    }

    const firstLockfileHash = sha256(afterTargetInstall['pnpm-lock.yaml']);
    const idempotencyInstall = await runCommand('pnpm', installArgs, {
      cwd: fixtureDirectory,
      environment: sanitizedEnvironment,
      timeoutSeconds: remainingTimeoutSeconds(),
    });
    const stableLockfile = readFileSync(resolve(fixtureDirectory, 'pnpm-lock.yaml'), 'utf8');
    const secondLockfileHash = sha256(stableLockfile);
    if (firstLockfileHash !== secondLockfileHash) {
      throw new Error('pnpm lockfile regeneration is not idempotent');
    }

    const summary = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      fixture: relative(repoRoot, fixturePath),
      platform: 'local',
      dryRun: 'lookup',
      providerMutation: false,
      credentialEnvironmentKeys: [],
      lookup: lookupEvidence,
      packageManagerMutation: {
        changedFiles,
        idempotentLockfile: true,
        lockfileSha256: firstLockfileHash,
      },
      approvalPackageManagers: fixture.approvalPackageManagers,
      runtime: {
        initialInstallMs: initialInstall.durationMs,
        lookupProcessMs: lookup.durationMs,
        targetInstallMs: targetInstall.durationMs,
        idempotencyInstallMs: idempotencyInstall.durationMs,
        totalMs: Date.now() - startedAt,
        timeoutMs: fixture.timeoutSeconds * 1000,
      },
    };

    mkdirSync(artifactDirectory, { recursive: true });
    writeFileSync(artifactLogPath, lookup.output);
    writeFileSync(artifactSummaryPath, json(summary));
    return {
      artifactLogPath,
      artifactSummaryPath,
      summary,
    };
  } finally {
    if (environment.KNU_KEEP_RENOVATE_DRY_RUN_FIXTURE !== '1') {
      rmSync(fixtureDirectory, { recursive: true, force: true });
      rmSync(homeDirectory, { recursive: true, force: true });
    }
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  runRenovatePnpmDryRun()
    .then(({ artifactSummaryPath, summary }) => {
      process.stdout.write(`${JSON.stringify({ artifactSummaryPath, summary }, null, 2)}\n`);
    })
    .catch((error) => {
      process.stderr.write(`${error.stack ?? error.message}\n`);
      process.exitCode = 1;
    });
}
