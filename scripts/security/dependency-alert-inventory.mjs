#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { resolveArtifactPath } from '../artifacts/paths.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, '../..');
const classificationPath = resolve(
  scriptDirectory,
  'fixtures/dependency-alert-classification.json',
);

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${fieldName} must be a non-empty string`);
  }
}

export function parseDependencyAlertClassification(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('classification must be an object');
  }
  if (input.schemaVersion !== 1) throw new TypeError('schemaVersion must equal 1');
  assertNonEmptyString(input.reviewedAt, 'reviewedAt');
  assertNonEmptyString(input.defaultBranch, 'defaultBranch');
  if (!Array.isArray(input.packages) || input.packages.length === 0) {
    throw new TypeError('packages must be a non-empty array');
  }
  const names = new Set();
  for (const [index, item] of input.packages.entries()) {
    for (const fieldName of ['name', 'owner', 'parent', 'classification', 'action']) {
      assertNonEmptyString(item?.[fieldName], `packages[${index}].${fieldName}`);
    }
    if (names.has(item.name)) throw new TypeError(`duplicate package classification: ${item.name}`);
    names.add(item.name);
  }
  return structuredClone(input);
}

function normalizeAlert(alert) {
  const dependency = alert?.dependency;
  const advisory = alert?.security_advisory;
  const vulnerability = alert?.security_vulnerability;
  const packageName = dependency?.package?.name;
  assertNonEmptyString(packageName, 'alert.dependency.package.name');
  assertNonEmptyString(advisory?.ghsa_id, 'alert.security_advisory.ghsa_id');
  assertNonEmptyString(advisory?.severity, 'alert.security_advisory.severity');
  assertNonEmptyString(vulnerability?.vulnerable_version_range, 'vulnerable_version_range');
  return {
    createdAt: alert.created_at,
    dependencyScope: dependency.scope ?? 'unknown',
    dismissedAt: alert.dismissed_at,
    fixedAt: alert.fixed_at,
    ghsaId: advisory.ghsa_id,
    number: alert.number,
    package: packageName,
    patchedVersion: vulnerability.first_patched_version?.identifier ?? null,
    relationship: dependency.relationship ?? 'unknown',
    severity: advisory.severity,
    state: alert.state,
    vulnerableVersionRange: vulnerability.vulnerable_version_range,
  };
}

function countBy(values, key) {
  const counts = new Map();
  for (const value of values) {
    const name = key(value) ?? 'unknown';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return Object.fromEntries([...counts].sort(([left], [right]) => left.localeCompare(right)));
}

export function buildDependencyAlertInventory(alertsInput, classificationInput) {
  if (!Array.isArray(alertsInput)) throw new TypeError('alerts must be an array');
  const classification = parseDependencyAlertClassification(classificationInput);
  const rules = new Map(classification.packages.map((item) => [item.name, item]));
  const alerts = alertsInput.map(normalizeAlert).map((alert) => {
    const rule = rules.get(alert.package);
    if (!rule) throw new Error(`missing package classification: ${alert.package}`);
    return { ...alert, ...structuredClone(rule) };
  });
  const observedPackages = new Set(alerts.map(({ package: packageName }) => packageName));
  const staleClassifications = classification.packages
    .map(({ name }) => name)
    .filter((name) => !observedPackages.has(name));
  const unownedHigh = alerts.filter(
    ({ severity, owner, classification: reachability }) =>
      severity === 'high' && (!owner || reachability === 'unknown'),
  );
  if (unownedHigh.length > 0) {
    throw new Error(`unowned high alerts: ${unownedHigh.map(({ number }) => number).join(', ')}`);
  }
  return {
    schemaVersion: 1,
    defaultBranch: classification.defaultBranch,
    reviewedAt: classification.reviewedAt,
    summary: {
      total: alerts.length,
      byAction: countBy(alerts, ({ action }) => action),
      byClassification: countBy(alerts, ({ classification: reachability }) => reachability),
      byRelationship: countBy(alerts, ({ relationship }) => relationship),
      byScope: countBy(alerts, ({ dependencyScope }) => dependencyScope),
      bySeverity: countBy(alerts, ({ severity }) => severity),
      packageCount: observedPackages.size,
    },
    staleClassifications,
    alerts,
  };
}

function readGitHubAlerts() {
  const result = spawnSync(
    'gh',
    [
      'api',
      '--paginate',
      '--slurp',
      'repos/woohyun365/knu_roommate/dependabot/alerts?state=open&per_page=100',
    ],
    { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  if (result.status !== 0) throw new Error(`gh Dependabot alerts query failed\n${result.stderr}`);
  return JSON.parse(result.stdout).flat();
}

export function runDependencyAlertInventory() {
  const classification = parseDependencyAlertClassification(
    JSON.parse(readFileSync(classificationPath, 'utf8')),
  );
  const inventory = buildDependencyAlertInventory(readGitHubAlerts(), classification);
  const outputPath = resolveArtifactPath(repoRoot, ['security', 'dependabot-alert-inventory.json']);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(inventory, null, 2)}\n`);
  return { inventory, outputPath };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  try {
    const result = runDependencyAlertInventory();
    process.stdout.write(
      `${JSON.stringify({ outputPath: result.outputPath, summary: result.inventory.summary }, null, 2)}\n`,
    );
  } catch (error) {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  }
}
