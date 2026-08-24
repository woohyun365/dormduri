import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  buildDependencyAlertInventory,
  parseDependencyAlertClassification,
} from './dependency-alert-inventory.mjs';

const classification = parseDependencyAlertClassification(
  JSON.parse(
    readFileSync(
      resolve(process.cwd(), 'scripts/security/fixtures/dependency-alert-classification.json'),
      'utf8',
    ),
  ),
);

function alert({ number, packageName, severity = 'high', scope = 'runtime' }) {
  return {
    number,
    state: 'open',
    created_at: '2026-08-21T00:00:00Z',
    dismissed_at: null,
    fixed_at: null,
    dependency: {
      package: { ecosystem: 'npm', name: packageName },
      manifest_path: 'pnpm-lock.yaml',
      relationship: 'transitive',
      scope,
    },
    security_advisory: { ghsa_id: `GHSA-test-${number}`, severity },
    security_vulnerability: {
      vulnerable_version_range: '< 9.9.9',
      first_patched_version: { identifier: '9.9.9' },
    },
  };
}

test('maps every alert to an owner and reachability classification', () => {
  const result = buildDependencyAlertInventory(
    [
      alert({ number: 1, packageName: 'ws' }),
      alert({ number: 2, packageName: 'hono', scope: 'development' }),
    ],
    classification,
  );

  assert.equal(result.summary.total, 2);
  assert.equal(result.summary.packageCount, 2);
  assert.deepEqual(result.summary.bySeverity, { high: 2 });
  assert.equal(result.alerts[0].owner, 'api-realtime-and-storybook');
  assert.equal(result.alerts[1].classification, 'shipped-not-called');
});

test('fails closed when a new vulnerable package has no classification', () => {
  assert.throws(
    () =>
      buildDependencyAlertInventory(
        [alert({ number: 3, packageName: 'unknown-package' })],
        classification,
      ),
    /missing package classification/u,
  );
});

test('rejects duplicate classification owners', () => {
  const input = structuredClone(classification);
  input.packages.push(structuredClone(input.packages[0]));
  assert.throws(() => parseDependencyAlertClassification(input), /duplicate package/u);
});

test('security policy stays private-reporting-first and honest about support', () => {
  const publicPolicy = readFileSync(resolve(process.cwd(), '.github/SECURITY.md'), 'utf8');
  const internalPolicy = readFileSync(
    resolve(process.cwd(), 'docs/policies/dependency-security.md'),
    'utf8',
  );

  assert.match(publicPolicy, /has not published a production release/u);
  assert.match(publicPolicy, /Do not open a public GitHub issue/u);
  assert.match(publicPolicy, /woohyun365@gmail\.com/u);
  assert.match(internalPolicy, /Release NO-GO/u);
  assert.match(internalPolicy, /미분류 high alert/u);
  assert.doesNotMatch(`${publicPolicy}\n${internalPolicy}`, /Phase [0-9]/u);
});
