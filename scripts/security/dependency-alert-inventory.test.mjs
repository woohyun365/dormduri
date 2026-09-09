import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  buildDependencyAlertInventory,
  parseDependencyAlertClassification,
} from './dependency-alert-inventory.mjs';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

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

test('retained security overrides and resolved lock entries keep the known vulnerable versions out', () => {
  const workspace = readFileSync(resolve(process.cwd(), 'pnpm-workspace.yaml'), 'utf8');
  const lockfile = readFileSync(resolve(process.cwd(), 'pnpm-lock.yaml'), 'utf8');

  for (const contract of [
    "'engine.io>ws': 8.21.3",
    "'@nestjs/platform-express>multer': 2.3.0",
    'postcss: 8.5.28',
    "'prisma>mysql2': 3.24.3",
    "'socket.io-adapter>ws': 8.21.3",
  ]) {
    assert.match(workspace, new RegExp(escapeRegExp(contract), 'u'));
  }

  for (const removedSelector of [
    "'@babel/core':",
    "'brace-expansion@<2.0.0':",
    "'brace-expansion@>=5.0.0 <6.0.0':",
    "'express>body-parser':",
    'fast-uri:',
    'flatted:',
    'form-data:',
    'js-yaml:',
    'lodash:',
    "'nanoid@<4.0.0':",
    "'picomatch@<3.0.0':",
    "'socket.io>socket.io-parser':",
    'qs:',
    'yaml:',
  ]) {
    assert.doesNotMatch(workspace, new RegExp(escapeRegExp(removedSelector), 'u'));
  }

  assert.match(lockfile, /'@nestjs\/platform-express@11\.2\.3/u);
  assert.match(lockfile, /\n      multer: 2\.3\.0\n/u);

  for (const vulnerable of [
    '@humanfs/node@0.16.7',
    'body-parser@2.2.2',
    'brace-expansion@1.1.12',
    'brace-expansion@5.0.6',
    'fast-uri@3.1.2',
    'flatted@3.3.3',
    'form-data@4.0.5',
    'hono@4.12.18',
    'js-yaml@4.1.1',
    'js-yaml@4.3.1',
    'lodash@4.17.23',
    'multer@2.1.1',
    'multer@2.2.0',
    'mysql2@3.15.3',
    'nanoid@3.3.12',
    'next@16.3.0',
    'picomatch@2.3.1',
    'postcss@8.5.15',
    'qs@6.14.1',
    'qs@6.15.2',
    'socket.io-parser@4.2.6',
    'sharp@0.35.3',
    'valibot@1.2.0',
    'ws@8.20.1',
    'yaml@2.8.2',
    'baseline-browser-mapping@2.10.37',
  ]) {
    assert.doesNotMatch(lockfile, new RegExp(escapeRegExp(vulnerable), 'u'));
  }

  for (const safeResolution of [
    '@humanfs/node@0.16.8',
    'baseline-browser-mapping@2.11.18',
    'js-yaml@4.3.2',
    'multer@2.3.0',
    'mysql2@3.24.3',
    'next@16.3.4',
    'qs@6.16.0',
    'sharp@0.35.4',
  ]) {
    assert.match(lockfile, new RegExp(escapeRegExp(safeResolution), 'u'));
  }
});

test('residual no-fix and retained-override exceptions stay evidence-backed', () => {
  for (const packageName of [
    '@humanfs/node',
    'baseline-browser-mapping',
    'js-yaml',
    'multer',
    'mysql2',
    'next',
    'postcss',
    'qs',
    'sharp',
    'ws',
  ]) {
    const item = classification.packages.find(({ name }) => name === packageName);
    assert.ok(item, `missing classification: ${packageName}`);
    assert.equal(typeof item.mitigation, 'string');
    assert.equal(typeof item.revisit, 'string');
  }
});
