import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  evaluateRenovateProviderManifest,
  parseRenovateProviderBaseline,
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

test('keeps the provider handoff pending, selected-repository-only, and reversible', () => {
  for (const phrase of [
    'PENDING / 설치하지 않음',
    'Only select repositories',
    'Terms of Service',
    'Privacy Policy',
    'temporary source clone',
    'Suspend',
    'Uninstall',
    'GO / NO-GO',
  ]) {
    assert.match(readinessDocument, new RegExp(phrase, 'u'));
  }
  assert.doesNotMatch(readinessDocument, /Phase [0-9]/u);
});

test('keeps the preflight read-only and free of installation mutations', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'scripts/dependencies/renovate-provider-preflight.mjs'),
    'utf8',
  );

  assert.match(source, /gh', \['api', '\/apps\/renovate'\]/u);
  assert.doesNotMatch(source, /--method|\/installations|\/suspended/u);
});
