import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { findMinimumVersionViolations } from '../dependencies/dependency-health-contract.mjs';
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

test('names every unclassified package in one failure, not only the first (#711)', () => {
  assert.throws(
    () =>
      buildDependencyAlertInventory(
        [
          alert({ number: 4, packageName: 'zz-unclassified', severity: 'low' }),
          alert({ number: 5, packageName: 'ws' }),
          alert({ number: 6, packageName: 'aa-unclassified', severity: 'medium' }),
          alert({ number: 7, packageName: 'aa-unclassified', severity: 'critical' }),
        ],
        classification,
      ),
    (error) => {
      assert.equal(
        error.message,
        'missing package classification: aa-unclassified (2 alerts, max critical), zz-unclassified (1 alerts, max low)',
      );
      return true;
    },
  );
});

test('critical alerts need an owner and known reachability like high alerts', () => {
  const input = structuredClone(classification);
  input.packages.push({
    name: 'unknown-reachability',
    owner: 'web-runtime',
    parent: 'apps/web',
    classification: 'unknown',
    action: 'runtime-remediation',
  });
  assert.throws(
    () =>
      buildDependencyAlertInventory(
        [alert({ number: 8, packageName: 'unknown-reachability', severity: 'critical' })],
        input,
      ),
    /unowned high or critical alerts: 8/u,
  );
});

test('alerts without a patched release need mitigation and revisit whatever the action', () => {
  const unpatched = alert({ number: 10, packageName: 'hono' });
  unpatched.security_vulnerability.first_patched_version = null;
  assert.throws(
    () => buildDependencyAlertInventory([unpatched], classification),
    /unpatched alerts without mitigation and revisit: 10/u,
  );

  const input = structuredClone(classification);
  Object.assign(
    input.packages.find(({ name }) => name === 'hono'),
    { mitigation: 'Not reachable from request input.', revisit: 'Review by 2026-11-29.' },
  );
  assert.doesNotThrow(() => buildDependencyAlertInventory([unpatched], input));
});

test('reports classifications without an open alert as stale instead of failing', () => {
  const result = buildDependencyAlertInventory(
    [alert({ number: 9, packageName: 'ws' })],
    classification,
  );

  assert.ok(result.staleClassifications.includes('hono'));
  assert.ok(!result.staleClassifications.includes('ws'));
  assert.equal(result.staleClassifications.length, classification.packages.length - 1);
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

  // Renovate raises these overrides and resolutions, so the remediated version is a floor (dependency-health contract).
  assert.deepEqual(
    findMinimumVersionViolations({
      workspace,
      lockfile,
      minimumWorkspaceOverrides: {
        postcss: '8.5.28',
      },
      minimumLockResolutions: {
        '@nestjs/platform-express': '11.2.3',
        '@humanfs/node': '0.16.8',
        '@vitest/mocker': '5.0.3',
        'baseline-browser-mapping': '2.11.18',
        'body-parser': '2.4.0',
        'engine.io': '6.6.10',
        'fast-uri': '3.1.9',
        'js-yaml': '4.3.2',
        multer: '2.5.0',
        mysql2: '3.24.3',
        next: '16.4.1',
        piscina: '4.9.4',
        'proxy-addr': '2.0.8',
        qs: '6.16.1',
        sharp: '0.35.5',
        'source-map-js': '1.2.2',
        undici: '8.12.2',
        ws: '8.21.3',
      },
    }),
    [],
  );

  for (const removedSelector of [
    "'@babel/core':",
    "'@nestjs/platform-express>multer':",
    "'@prisma/config>deepmerge-ts':",
    "'brace-expansion@<2.0.0':",
    "'brace-expansion@>=5.0.0 <6.0.0':",
    "'engine.io>ws':",
    "'express>body-parser':",
    'fast-uri:',
    'flatted:',
    'form-data:',
    'js-yaml:',
    'lodash:',
    "'nanoid@<4.0.0':",
    "'picomatch@<3.0.0':",
    "'prisma>mysql2':",
    "'socket.io>socket.io-parser':",
    "'socket.io-adapter>ws':",
    'qs:',
    'yaml:',
  ]) {
    assert.doesNotMatch(workspace, new RegExp(escapeRegExp(removedSelector), 'u'));
  }

  for (const vulnerable of [
    '@humanfs/node@0.16.7',
    'body-parser@2.2.2',
    'body-parser@2.3.0',
    'engine.io@6.6.8',
    'brace-expansion@1.1.12',
    'brace-expansion@1.1.18',
    'brace-expansion@1.1.19',
    'brace-expansion@1.1.20',
    'brace-expansion@2.1.4',
    'brace-expansion@2.1.5',
    'brace-expansion@2.1.6',
    'brace-expansion@5.0.6',
    'brace-expansion@5.0.9',
    'brace-expansion@5.0.10',
    'brace-expansion@5.0.11',
    'fast-uri@3.1.2',
    'fast-uri@3.1.6',
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
    'piscina@4.9.3',
    'postcss@8.5.15',
    'proxy-addr@2.0.7',
    'qs@6.14.1',
    'qs@6.15.2',
    'qs@6.16.0',
    'socket.io-parser@4.2.6',
    'sharp@0.35.3',
    'sharp@0.35.4',
    'source-map-js@1.2.1',
    'undici@8.10.0',
    'valibot@1.2.0',
    'ws@8.20.1',
    'yaml@2.8.2',
    'baseline-browser-mapping@2.10.37',
    '@vitest/mocker@5.0.0',
  ]) {
    assert.doesNotMatch(lockfile, new RegExp(escapeRegExp(vulnerable), 'u'));
  }
});

test('residual no-fix and retained-override exceptions stay evidence-backed', () => {
  for (const packageName of [
    '@humanfs/node',
    'baseline-browser-mapping',
    'deepmerge',
    'js-yaml',
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
