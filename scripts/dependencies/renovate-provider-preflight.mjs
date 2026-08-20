#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { resolveArtifactPath } from '../artifacts/paths.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, '../..');
const baselinePath = resolve(scriptDirectory, 'fixtures/renovate-provider-app-baseline.json');
const ownerDecisionPath = resolve(
  scriptDirectory,
  'fixtures/renovate-provider-owner-decision.json',
);
const requiredOwnerEvidence = [
  'selected_repository_installation',
  'terms_and_privacy_acceptance',
  'source_and_metadata_processing_acceptance',
  'retention_and_log_access_acceptance',
  'operator_and_revoke_owner',
];
const requiredRevalidationEvidence = [
  'app_identity',
  'permission_and_event_manifest',
  'selected_repository_installation',
  'terms_and_privacy_revision',
  'dashboard_log_access',
  'suspend_and_uninstall_access',
];

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${fieldName} must be a non-empty string`);
  }
}

function sameMembers(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    [...actual].sort().every((value, index) => value === [...expected].sort()[index])
  );
}

function validatePermissions(permissions, fieldName) {
  if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
    throw new TypeError(`${fieldName} must be an object`);
  }
  for (const [permissionName, level] of Object.entries(permissions)) {
    assertNonEmptyString(permissionName, `${fieldName}.permissionName`);
    if (!['read', 'write'].includes(level)) {
      throw new TypeError(`${fieldName}.${permissionName} must be read or write`);
    }
  }
}

export function parseRenovateProviderBaseline(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Renovate provider baseline must be an object');
  }
  if (input.schemaVersion !== 1) throw new TypeError('schemaVersion must equal 1');
  assertNonEmptyString(input.observedAt, 'observedAt');
  assertNonEmptyString(input.source, 'source');
  if (!input.app || typeof input.app !== 'object' || Array.isArray(input.app)) {
    throw new TypeError('app must be an object');
  }
  for (const fieldName of ['name', 'slug', 'owner', 'htmlUrl', 'externalUrl']) {
    assertNonEmptyString(input.app[fieldName], `app.${fieldName}`);
  }
  validatePermissions(input.app.permissions, 'app.permissions');
  if (!Array.isArray(input.app.events) || input.app.events.length === 0) {
    throw new TypeError('app.events must be a non-empty array');
  }
  if (!sameMembers(input.requiredOwnerEvidence, requiredOwnerEvidence)) {
    throw new TypeError('requiredOwnerEvidence must contain every owner decision gate');
  }
  return structuredClone(input);
}

export function parseRenovateProviderOwnerDecision(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Renovate provider owner decision must be an object');
  }
  if (input.schemaVersion !== 1) throw new TypeError('schemaVersion must equal 1');
  assertNonEmptyString(input.recordedAt, 'recordedAt');
  if (input.decision !== 'go') throw new TypeError('decision must equal go');
  if (input.madeBy !== 'repository-owner') {
    throw new TypeError('madeBy must equal repository-owner');
  }
  if (input.repository !== 'woohyun365/knu_roommate') {
    throw new TypeError('repository must equal woohyun365/knu_roommate');
  }
  if (input.installationScope !== 'selected-repository-only') {
    throw new TypeError('installationScope must equal selected-repository-only');
  }
  const accepted = input.accepted;
  if (!accepted || typeof accepted !== 'object' || Array.isArray(accepted)) {
    throw new TypeError('accepted must be an object');
  }
  if (accepted.currentPermissionManifest !== true) {
    throw new TypeError('currentPermissionManifest must be accepted');
  }
  if (accepted.termsAndPrivacy !== 'accept-current-revision-at-installation') {
    throw new TypeError('termsAndPrivacy must require installation-time revision acceptance');
  }
  if (accepted.sourceAndMetadataProcessing !== true) {
    throw new TypeError('sourceAndMetadataProcessing must be accepted');
  }
  if (
    accepted.retentionAndLogAccess !== 'accept-provider-managed-policy-without-numeric-duration'
  ) {
    throw new TypeError('retentionAndLogAccess must record the flexible provider policy');
  }
  for (const ownerField of ['operator', 'revokeOwner']) {
    assertNonEmptyString(accepted[ownerField], `accepted.${ownerField}`);
  }
  if (accepted.privateRegistryCredentials !== false) {
    throw new TypeError('privateRegistryCredentials must remain disabled');
  }
  if (accepted.scriptsAndPlugins !== false) {
    throw new TypeError('scriptsAndPlugins must remain disabled');
  }
  if (accepted.manualFallback !== true) {
    throw new TypeError('manualFallback must remain accepted');
  }
  if (!sameMembers(input.revalidationRequired, requiredRevalidationEvidence)) {
    throw new TypeError('revalidationRequired must contain every installation evidence gate');
  }
  return structuredClone(input);
}

function normalizeGitHubManifest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('GitHub App manifest must be an object');
  }
  const manifest = {
    events: [...(input.events ?? [])].sort(),
    externalUrl: input.external_url,
    htmlUrl: input.html_url,
    name: input.name,
    owner: input.owner?.login,
    permissions: structuredClone(input.permissions ?? {}),
    slug: input.slug,
  };
  for (const fieldName of ['name', 'slug', 'owner', 'htmlUrl', 'externalUrl']) {
    assertNonEmptyString(manifest[fieldName], `manifest.${fieldName}`);
  }
  validatePermissions(manifest.permissions, 'manifest.permissions');
  return manifest;
}

function diffPermissions(actual, expected) {
  const actualNames = Object.keys(actual);
  const expectedNames = Object.keys(expected);
  return {
    added: actualNames.filter((permissionName) => !(permissionName in expected)).sort(),
    changed: actualNames
      .filter(
        (permissionName) =>
          permissionName in expected && actual[permissionName] !== expected[permissionName],
      )
      .sort(),
    removed: expectedNames.filter((permissionName) => !(permissionName in actual)).sort(),
  };
}

function diffEvents(actual, expected) {
  return {
    added: actual.filter((eventName) => !expected.includes(eventName)).sort(),
    removed: expected.filter((eventName) => !actual.includes(eventName)).sort(),
  };
}

function hasDrift(diff) {
  return Object.values(diff).some((values) => values.length > 0);
}

export function evaluateRenovateProviderManifest(input, baselineInput) {
  const baseline = parseRenovateProviderBaseline(baselineInput);
  const manifest = normalizeGitHubManifest(input);
  const expectedIdentity = baseline.app;

  if (
    manifest.name !== expectedIdentity.name ||
    manifest.slug !== expectedIdentity.slug ||
    manifest.owner !== expectedIdentity.owner ||
    manifest.htmlUrl !== expectedIdentity.htmlUrl
  ) {
    throw new Error('Renovate GitHub App identity mismatch');
  }

  const permissionDrift = diffPermissions(manifest.permissions, baseline.app.permissions);
  if (hasDrift(permissionDrift)) {
    throw new Error(`Renovate GitHub App permission drift: ${JSON.stringify(permissionDrift)}`);
  }
  const eventDrift = diffEvents(manifest.events, baseline.app.events);
  if (hasDrift(eventDrift)) {
    throw new Error(`Renovate GitHub App event drift: ${JSON.stringify(eventDrift)}`);
  }

  return {
    app: manifest,
    eventDrift,
    goEligible: false,
    installationScope: 'selected-repository-only',
    ownerDecision: 'pending',
    pendingOwnerEvidence: baseline.requiredOwnerEvidence,
    permissionDrift,
    technicalStatus: 'ready-for-owner-review',
    writePermissions: Object.entries(manifest.permissions)
      .filter(([, level]) => level === 'write')
      .map(([permissionName]) => permissionName)
      .sort(),
  };
}

export function applyRenovateProviderOwnerDecision(evaluationInput, decisionInput) {
  const decision = parseRenovateProviderOwnerDecision(decisionInput);
  if (
    !evaluationInput ||
    evaluationInput.technicalStatus !== 'ready-for-owner-review' ||
    hasDrift(evaluationInput.permissionDrift ?? {}) ||
    hasDrift(evaluationInput.eventDrift ?? {})
  ) {
    throw new Error('technical provider preflight must pass before applying owner GO');
  }

  return {
    ...structuredClone(evaluationInput),
    decisionRecordedAt: decision.recordedAt,
    goEligible: true,
    ownerDecision: 'go',
    ownerEvidence: structuredClone(decision.accepted),
    pendingOwnerEvidence: [],
    repositoryInstalled: false,
    revalidationRequired: structuredClone(decision.revalidationRequired),
  };
}

export function runRenovateProviderPreflight() {
  const baseline = parseRenovateProviderBaseline(JSON.parse(readFileSync(baselinePath, 'utf8')));
  const ownerDecision = parseRenovateProviderOwnerDecision(
    JSON.parse(readFileSync(ownerDecisionPath, 'utf8')),
  );
  const result = spawnSync('gh', ['api', '/apps/renovate'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error(`gh api /apps/renovate failed\n${result.stderr}`);
  }

  const technicalEvaluation = evaluateRenovateProviderManifest(JSON.parse(result.stdout), baseline);
  const evaluation = applyRenovateProviderOwnerDecision(technicalEvaluation, ownerDecision);
  const evidence = {
    schemaVersion: 1,
    observedAt: new Date().toISOString(),
    source: baseline.source,
    repositoryMutation: false,
    ...evaluation,
  };
  const outputPath = resolveArtifactPath(repoRoot, [
    'dependency-automation',
    'renovate-provider-preflight.json',
  ]);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  return { evidence, outputPath };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  try {
    const result = runRenovateProviderPreflight();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  }
}
