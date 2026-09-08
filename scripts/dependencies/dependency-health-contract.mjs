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

export function parseDependencyHealthContract(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('dependency health contract must be an object');
  }
  if (input.schemaVersion !== 1) throw new TypeError('schemaVersion must equal 1');
  assertNonEmptyString(input.reviewedAt, 'reviewedAt');
  assertNonEmptyString(input.reviewAfter, 'reviewAfter');
  if (!Number.isFinite(Date.parse(input.reviewedAt))) {
    throw new TypeError('reviewedAt must be an ISO date');
  }
  if (!Number.isFinite(Date.parse(input.reviewAfter))) {
    throw new TypeError('reviewAfter must be an ISO date');
  }
  assertStringArray(input.requiredWorkspaceEntries, 'requiredWorkspaceEntries');
  assertStringArray(input.requiredLockResolutions, 'requiredLockResolutions');
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
  const missingLockResolutions = normalized.requiredLockResolutions.filter(
    (resolution) => !hasLockResolution(lockfile, resolution),
  );
  const forbiddenLockResolutions = normalized.forbiddenLockResolutions.filter((resolution) =>
    hasLockResolution(lockfile, resolution),
  );
  const findings = [
    ...missingWorkspaceEntries.map((entry) => `missing workspace entry: ${entry}`),
    ...missingLockResolutions.map((resolution) => `missing lock resolution: ${resolution}`),
    ...forbiddenLockResolutions.map((resolution) => `forbidden lock resolution: ${resolution}`),
  ];
  return {
    reviewedAt: normalized.reviewedAt,
    reviewAfter: normalized.reviewAfter,
    peerExceptions: normalized.peerExceptions,
    missingWorkspaceEntries,
    missingLockResolutions,
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
