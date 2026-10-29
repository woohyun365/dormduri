#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const repoRoot = resolve(import.meta.dirname, '../..');
const fixturePath = resolve(import.meta.dirname, 'fixtures/dependency-health-contract.json');

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${fieldName} must be a non-empty string`);
  }
}

function assertStringArray(value, fieldName) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty array`);
  }
  value.forEach((item, index) => assertNonEmptyString(item, `${fieldName}[${index}]`));
}

const RELEASE_VERSION = /^\d+\.\d+\.\d+$/u;

function assertMinimumVersions(value, fieldName) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length === 0
  ) {
    throw new TypeError(`${fieldName} must be a non-empty object`);
  }
  for (const [name, version] of Object.entries(value)) {
    assertNonEmptyString(name, `${fieldName} key`);
    if (!RELEASE_VERSION.test(version)) {
      throw new TypeError(`${fieldName}.${name} must be an x.y.z version`);
    }
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

// Numeric x.y.z order; a prerelease of the same release sorts before the release.
export function compareVersions(left, right) {
  const parse = (version) => {
    const [release, prerelease] = version.split('-', 2);
    return { parts: release.split('.').map(Number), prerelease };
  };
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < 3; index += 1) {
    const difference = (a.parts[index] ?? 0) - (b.parts[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  if (a.prerelease === b.prerelease) return 0;
  if (a.prerelease === undefined) return 1;
  if (b.prerelease === undefined) return -1;
  return a.prerelease < b.prerelease ? -1 : 1;
}

// Every resolved version of a package in pnpm-lock.yaml `packages:` and `snapshots:` keys.
export function lockResolutionVersions(lockfile, packageName) {
  const key = new RegExp(`^ {2}'?${escapeRegExp(packageName)}@(\\d[^:('\\s]*)`, 'gmu');
  return [...new Set([...lockfile.matchAll(key)].map(([, version]) => version))].sort(
    compareVersions,
  );
}

// Values of the top-level `overrides:` map in pnpm-workspace.yaml, keyed by unquoted selector.
export function workspaceOverrides(workspace) {
  const overrides = new Map();
  const section = /^overrides:\n((?:(?: {2}.*|\s*#.*|)\n)*)/mu.exec(workspace)?.[1] ?? '';
  for (const [, , selector, version] of section.matchAll(
    /^ {2}(['"]?)(.+?)\1:\s*['"]?([^'"\s#]+)/gmu,
  )) {
    overrides.set(selector, version);
  }
  return overrides;
}

// Bots raise pinned overrides and lock resolutions, so the remediated version is a floor rather than an exact value.
export function findMinimumVersionViolations({
  workspace = '',
  lockfile = '',
  minimumWorkspaceOverrides = {},
  minimumLockResolutions = {},
}) {
  const overrides = workspaceOverrides(workspace);
  const findings = [];
  for (const [selector, minimum] of Object.entries(minimumWorkspaceOverrides)) {
    const version = overrides.get(selector);
    if (version === undefined) findings.push(`missing workspace override: ${selector}`);
    else if (!RELEASE_VERSION.test(version) || compareVersions(version, minimum) < 0) {
      findings.push(`workspace override below ${minimum}: ${selector}@${version}`);
    }
  }
  for (const [packageName, minimum] of Object.entries(minimumLockResolutions)) {
    const versions = lockResolutionVersions(lockfile, packageName);
    if (versions.length === 0) findings.push(`missing lock resolution: ${packageName}`);
    for (const version of versions.filter((item) => compareVersions(item, minimum) < 0)) {
      findings.push(`lock resolution below ${minimum}: ${packageName}@${version}`);
    }
  }
  return findings;
}

export function parseDependencyHealthContract(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('dependency health contract must be an object');
  }
  if (input.schemaVersion !== 2) throw new TypeError('schemaVersion must equal 2');
  assertNonEmptyString(input.reviewedAt, 'reviewedAt');
  assertNonEmptyString(input.reviewAfter, 'reviewAfter');
  if (!Number.isFinite(Date.parse(input.reviewedAt))) {
    throw new TypeError('reviewedAt must be an ISO date');
  }
  if (!Number.isFinite(Date.parse(input.reviewAfter))) {
    throw new TypeError('reviewAfter must be an ISO date');
  }
  assertStringArray(input.requiredWorkspaceEntries, 'requiredWorkspaceEntries');
  assertMinimumVersions(input.minimumWorkspaceOverrides, 'minimumWorkspaceOverrides');
  assertMinimumVersions(input.minimumLockResolutions, 'minimumLockResolutions');
  assertStringArray(input.forbiddenLockResolutions, 'forbiddenLockResolutions');
  if (!Array.isArray(input.peerExceptions) || input.peerExceptions.length === 0) {
    throw new TypeError('peerExceptions must be a non-empty array');
  }
  const selectors = new Set();
  input.peerExceptions.forEach((item, index) => {
    for (const field of ['selector', 'allowedVersion', 'owner', 'reason', 'evidence', 'revisit']) {
      assertNonEmptyString(item?.[field], `peerExceptions[${index}].${field}`);
    }
    if (selectors.has(item.selector)) {
      throw new TypeError(`duplicate peer exception: ${item.selector}`);
    }
    selectors.add(item.selector);
  });
  return structuredClone(input);
}

function hasLockResolution(lockfile, resolution) {
  return lockfile.includes(`\n  ${resolution}:\n`);
}

export function evaluateDependencyHealth({ contract, workspace, lockfile }) {
  const normalized = parseDependencyHealthContract(contract);
  if (typeof workspace !== 'string') throw new TypeError('workspace must be a string');
  if (typeof lockfile !== 'string') throw new TypeError('lockfile must be a string');

  const missingWorkspaceEntries = normalized.requiredWorkspaceEntries.filter(
    (entry) => !workspace.includes(entry),
  );
  const minimumVersionFindings = findMinimumVersionViolations({
    workspace,
    lockfile,
    minimumWorkspaceOverrides: normalized.minimumWorkspaceOverrides,
    minimumLockResolutions: normalized.minimumLockResolutions,
  });
  const forbiddenLockResolutions = normalized.forbiddenLockResolutions.filter((resolution) =>
    hasLockResolution(lockfile, resolution),
  );
  const findings = [
    ...missingWorkspaceEntries.map((entry) => `missing workspace entry: ${entry}`),
    ...minimumVersionFindings,
    ...forbiddenLockResolutions.map((resolution) => `forbidden lock resolution: ${resolution}`),
  ];
  return {
    reviewedAt: normalized.reviewedAt,
    reviewAfter: normalized.reviewAfter,
    peerExceptions: normalized.peerExceptions,
    missingWorkspaceEntries,
    minimumVersionFindings,
    forbiddenLockResolutions,
    findings,
    healthy: findings.length === 0,
  };
}

export function assertDependencyHealth(input) {
  const result = evaluateDependencyHealth(input);
  if (!result.healthy) {
    throw new Error(`dependency health contract failed\n${result.findings.join('\n')}`);
  }
  return result;
}

export function classifyPnpmEvidence({ stderr = '', storeStatus = '', frozenInstallPassed }) {
  const combined = `${stderr}\n${storeStatus}`;
  if (/ERR_SQLITE_ERROR|unable to open database file/iu.test(combined)) {
    return {
      classification: 'filesystem-or-index-access-failure',
      destructiveRepairAllowed: false,
      nextAction: 'repeat the graph command on the trusted host and compare an isolated store',
    };
  }
  if (/ERR_PNPM_MODIFIED_DEPENDENCY/iu.test(combined) && /esbuild@/iu.test(combined)) {
    return {
      classification: frozenInstallPassed
        ? 'known-esbuild-postinstall-status-anomaly'
        : 'unverified-package-materialization',
      destructiveRepairAllowed: false,
      nextAction: frozenInstallPassed
        ? 'run the esbuild native binary and preserve the diagnostic result'
        : 'stop mutation and reproduce with a disposable isolated store',
    };
  }
  if (/ERR_PNPM_MODIFIED_DEPENDENCY|integrity|corrupt/iu.test(combined)) {
    return {
      classification: 'possible-package-materialization-failure',
      destructiveRepairAllowed: false,
      nextAction: 'stop mutation and reproduce with a disposable isolated store',
    };
  }
  return {
    classification: 'no-known-store-or-index-failure',
    destructiveRepairAllowed: false,
    nextAction: 'continue with the owning behavior checks',
  };
}

export function runDependencyHealthContract() {
  const contract = JSON.parse(readFileSync(fixturePath, 'utf8'));
  return assertDependencyHealth({
    contract,
    workspace: readFileSync(resolve(repoRoot, 'pnpm-workspace.yaml'), 'utf8'),
    lockfile: readFileSync(resolve(repoRoot, 'pnpm-lock.yaml'), 'utf8'),
  });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  try {
    process.stdout.write(`${JSON.stringify(runDependencyHealthContract(), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  }
}
