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

test('security overrides remove the known vulnerable transitive versions', () => {
  const workspace = readFileSync(resolve(process.cwd(), 'pnpm-workspace.yaml'), 'utf8');
  const lockfile = readFileSync(resolve(process.cwd(), 'pnpm-lock.yaml'), 'utf8');

  for (const contract of [
    "'@nestjs/platform-express>multer': 2.2.0",
    "'@babel/core': 7.29.6",
    "'brace-expansion@<2.0.0': 1.1.18",
    "'brace-expansion@>=5.0.0 <6.0.0': 5.0.9",
    "'engine.io>ws': 8.21.3",
    "'express>body-parser': 2.3.0",
    'fast-uri: 3.1.6',
    'flatted: 3.4.2',
    'form-data: 4.0.6',
    'js-yaml: 4.3.1',
    'lodash: 4.18.1',
    "'nanoid@<4.0.0': 3.3.18",
    "'picomatch@<3.0.0': 2.3.2",
    'postcss: 8.5.26',
    "'socket.io-adapter>ws': 8.21.3",
    "'socket.io>socket.io-parser': 4.2.7",
    'qs: 6.15.2',
    'yaml: 2.8.3',
  ]) {
    assert.match(workspace, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }

  for (const vulnerable of [
    'body-parser@2.2.2',
    'brace-expansion@1.1.12',
    'brace-expansion@5.0.6',
    'fast-uri@3.1.2',
    'flatted@3.3.3',
    'form-data@4.0.5',
    'hono@4.12.18',
    'js-yaml@4.1.1',
    'lodash@4.17.23',
    'multer@2.1.1',
    'nanoid@3.3.12',
    'picomatch@2.3.1',
    'postcss@8.5.15',
    'qs@6.14.1',
    'socket.io-parser@4.2.6',
    'valibot@1.2.0',
    'ws@8.20.1',
    'yaml@2.8.2',
  ]) {
    assert.doesNotMatch(lockfile, new RegExp(vulnerable.replace('.', '\\.'), 'u'));
  }
});

test('residual no-fix and compatibility exceptions stay evidence-backed', () => {
  for (const packageName of ['deepmerge-ts', 'esbuild', 'image-size']) {
    const item = classification.packages.find(({ name }) => name === packageName);
    assert.ok(item, `missing classification: ${packageName}`);
    assert.equal(typeof item.mitigation, 'string');
    assert.equal(typeof item.revisit, 'string');
  }
});
