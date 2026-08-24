import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  applyRenovateProviderOwnerDecision,
  evaluateRenovateProviderManifest,
  parseRenovateProviderBaseline,
  parseRenovateProviderOwnerDecision,
} from './renovate-provider-preflight.mjs';

const baseline = parseRenovateProviderBaseline(
  JSON.parse(
    readFileSync(
      resolve(process.cwd(), 'scripts/dependencies/fixtures/renovate-provider-app-baseline.json'),
      'utf8',
    ),
  ),
);
const readinessDocument = readFileSync(
  resolve(process.cwd(), 'docs/development/github/renovate-provider-readiness.md'),
  'utf8',
);
const operationsDocument = readFileSync(
  resolve(process.cwd(), 'docs/development/github/dependency-updates.md'),
  'utf8',
);
const timeoutDocument = readFileSync(
  resolve(
    process.cwd(),
    'docs/development/troubleshooting/tooling/pnpm-dependency-update-job-timeout.md',
  ),
  'utf8',
);
const ownerDecision = parseRenovateProviderOwnerDecision(
  JSON.parse(
    readFileSync(
      resolve(process.cwd(), 'scripts/dependencies/fixtures/renovate-provider-owner-decision.json'),
      'utf8',
    ),
  ),
);

function githubManifestFromBaseline() {
  return {
    name: baseline.app.name,
    slug: baseline.app.slug,
    owner: { login: baseline.app.owner },
    html_url: baseline.app.htmlUrl,
    external_url: baseline.app.externalUrl,
    permissions: structuredClone(baseline.app.permissions),
    events: structuredClone(baseline.app.events),
  };
}

test('keeps the live app manifest bounded while owner approval remains pending', () => {
  const result = evaluateRenovateProviderManifest(githubManifestFromBaseline(), baseline);

  assert.equal(result.technicalStatus, 'ready-for-owner-review');
  assert.equal(result.ownerDecision, 'pending');
  assert.equal(result.goEligible, false);
  assert.equal(result.installationScope, 'selected-repository-only');
  assert.deepEqual(result.permissionDrift, { added: [], changed: [], removed: [] });
  assert.deepEqual(result.eventDrift, { added: [], removed: [] });
  assert.deepEqual(result.pendingOwnerEvidence, baseline.requiredOwnerEvidence);
  assert.deepEqual(result.writePermissions, [
    'checks',
    'contents',
    'issues',
    'pull_requests',
    'statuses',
    'workflows',
  ]);
});

test('promotes the bounded owner decision to GO without claiming installation evidence', () => {
  const evaluation = evaluateRenovateProviderManifest(githubManifestFromBaseline(), baseline);
  const result = applyRenovateProviderOwnerDecision(evaluation, ownerDecision);

  assert.equal(result.ownerDecision, 'go');
  assert.equal(result.goEligible, true);
  assert.deepEqual(result.pendingOwnerEvidence, []);
  assert.equal(result.repositoryInstalled, false);
  assert.deepEqual(result.revalidationRequired, ownerDecision.revalidationRequired);
});

test('fails closed when a new app permission appears', () => {
  const manifest = githubManifestFromBaseline();
  manifest.permissions.secrets = 'read';

  assert.throws(() => evaluateRenovateProviderManifest(manifest, baseline), /permission drift/u);
});

test('fails closed when an expected permission or event disappears', () => {
  const manifest = githubManifestFromBaseline();
  delete manifest.permissions.workflows;
  manifest.events = manifest.events.filter((eventName) => eventName !== 'push');

  assert.throws(
    () => evaluateRenovateProviderManifest(manifest, baseline),
    /permission drift|event drift/u,
  );
});

test('rejects an app identity mismatch', () => {
  const manifest = githubManifestFromBaseline();
  manifest.owner.login = 'unknown-owner';

  assert.throws(() => evaluateRenovateProviderManifest(manifest, baseline), /identity mismatch/u);
});

test('rejects baseline evidence without every owner decision gate', () => {
  const input = structuredClone(baseline);
  input.requiredOwnerEvidence = input.requiredOwnerEvidence.slice(1);

  assert.throws(() => parseRenovateProviderBaseline(input), /requiredOwnerEvidence/u);
});

test('rejects an owner decision that broadens repository scope or enables scripts', () => {
  const broadScope = structuredClone(ownerDecision);
  broadScope.installationScope = 'all-repositories';
  assert.throws(() => parseRenovateProviderOwnerDecision(broadScope), /installationScope/u);

  const scriptsEnabled = structuredClone(ownerDecision);
  scriptsEnabled.accepted.scriptsAndPlugins = true;
  assert.throws(() => parseRenovateProviderOwnerDecision(scriptsEnabled), /scriptsAndPlugins/u);
});

test('keeps the installed provider selected-repository-only, approval-gated, and reversible', () => {
  for (const phrase of [
    'selected-repository 설치·active extraction·controlled PR 검증 완료',
    'woohyun365/knu_roommate` 하나',
    'Automated PRs',
    'Require config file',
    'Dependency Dashboard',
    'PR #354',
    'Terms of Service',
    'Privacy Policy',
    'source를 임시 clone',
    'Suspend',
    'Uninstall',
    'NO-GO conditions',
  ]) {
    assert.match(readinessDocument, new RegExp(phrase, 'u'));
  }
  assert.doesNotMatch(readinessDocument, /Phase [0-9]/u);
});

test('keeps dependency update operations bounded and timeout recovery owner-aware', () => {
  for (const phrase of [
    'Dependency Dashboard #353',
    'Create all pending approval PRs at once',
    'Automated PRs',
    'provider queue',
    'Dependabot npm',
    'GitHub Actions',
    'Docker Compose',
  ]) {
    assert.match(`${operationsDocument}\n${timeoutDocument}`, new RegExp(phrase, 'u'));
  }
  assert.doesNotMatch(operationsDocument, /Phase [0-9]/u);
  assert.doesNotMatch(timeoutDocument, /Phase [0-9]/u);
});

test('keeps the preflight read-only and free of installation mutations', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'scripts/dependencies/renovate-provider-preflight.mjs'),
    'utf8',
  );

  assert.match(source, /gh', \['api', '\/apps\/renovate'\]/u);
  assert.doesNotMatch(source, /--method|\/installations|\/suspended/u);
});
