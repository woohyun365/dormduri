import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  assertDependencyHealth,
  classifyPnpmEvidence,
  findMinimumVersionViolations,
  parseDependencyHealthContract,
} from './dependency-health-contract.mjs';

const contract = parseDependencyHealthContract(
  JSON.parse(
    readFileSync(resolve('scripts/dependencies/fixtures/dependency-health-contract.json'), 'utf8'),
  ),
);

test('current dependency graph satisfies the dependency-health floors and exclusions', () => {
  assert.doesNotThrow(() =>
    assertDependencyHealth({
      contract,
      workspace: readFileSync(resolve('pnpm-workspace.yaml'), 'utf8'),
      lockfile: readFileSync(resolve('pnpm-lock.yaml'), 'utf8'),
    }),
  );
});

test('peer exceptions stay dated, scoped, and owner-backed', () => {
  assert.ok(Date.parse(contract.reviewAfter) > Date.parse(contract.reviewedAt));
  assert.deepEqual(contract.peerExceptions.map(({ selector }) => selector).sort(), [
    '@swc/cli>chokidar',
    'tsconfck>typescript',
  ]);
  for (const exception of contract.peerExceptions) {
    assert.ok(exception.owner.length > 0);
    assert.ok(exception.evidence.length > 0);
    assert.ok(exception.revisit.length > 0);
  }
});

const workspaceWith = (overrides) =>
  [
    'overrides:',
    ...Object.entries(overrides).map(([selector, version]) => `  '${selector}': ${version}`),
    '',
    'peerDependencyRules:',
    ...contract.requiredWorkspaceEntries.map((entry) => `    ${entry}`),
    '',
  ].join('\n');
const lockfileWith = (resolutions) =>
  `packages:\n${resolutions.map((resolution) => `\n  ${resolution}:\n    resolution: {}\n`).join('')}`;
const currentFloors = Object.entries(contract.minimumLockResolutions).map(
  ([packageName, version]) => `${packageName}@${version}`,
);

test('fails closed when a remediated vulnerable resolution returns', () => {
  assert.throws(
    () =>
      assertDependencyHealth({
        contract,
        workspace: workspaceWith(contract.minimumWorkspaceOverrides),
        lockfile: lockfileWith([...currentFloors, 'image-size@2.0.2']),
      }),
    /forbidden lock resolution: image-size@2\.0\.2/u,
  );
});

test('accepts bot-raised overrides and lock resolutions above the remediated floor', () => {
  assert.doesNotThrow(() =>
    assertDependencyHealth({
      contract,
      workspace: workspaceWith({ ...contract.minimumWorkspaceOverrides, esbuild: '0.28.3' }),
      lockfile: lockfileWith(
        currentFloors.map((resolution) =>
          resolution.startsWith('esbuild@') ? 'esbuild@0.28.3' : resolution,
        ),
      ),
    }),
  );
});

test('fails closed when an override or lock resolution drops below its floor or disappears', () => {
  assert.deepEqual(
    findMinimumVersionViolations({
      workspace: workspaceWith({ esbuild: '0.27.9' }),
      lockfile: lockfileWith(['esbuild@0.28.2', "'esbuild@0.27.3'", 'deepmerge-ts@8.0.2(x@1.0.0)']),
      minimumWorkspaceOverrides: { '@prisma/config>deepmerge-ts': '8.0.2', esbuild: '0.28.2' },
      minimumLockResolutions: {
        'deepmerge-ts': '8.0.2',
        esbuild: '0.28.2',
        'probe-image-size': '7.4.0',
      },
    }),
    [
      'missing workspace override: @prisma/config>deepmerge-ts',
      'workspace override below 0.28.2: esbuild@0.27.9',
      'lock resolution below 0.28.2: esbuild@0.27.3',
      'missing lock resolution: probe-image-size',
    ],
  );
  assert.throws(
    () =>
      parseDependencyHealthContract({
        ...contract,
        minimumLockResolutions: { esbuild: '^0.28.2' },
      }),
    /minimumLockResolutions\.esbuild must be an x\.y\.z version/u,
  );
});

test('classifies restricted SQLite access without authorizing store mutation', () => {
  assert.deepEqual(
    classifyPnpmEvidence({
      stderr: 'ERR_SQLITE_ERROR: unable to open database file',
      frozenInstallPassed: false,
    }),
    {
      classification: 'filesystem-or-index-access-failure',
      destructiveRepairAllowed: false,
      nextAction: 'repeat the graph command on the trusted host and compare an isolated store',
    },
  );
});

test('keeps the esbuild postinstall status anomaly separate from corruption', () => {
  assert.deepEqual(
    classifyPnpmEvidence({
      storeStatus: 'ERR_PNPM_MODIFIED_DEPENDENCY\nThese packages are modified:\nesbuild@0.28.2',
      frozenInstallPassed: true,
    }),
    {
      classification: 'known-esbuild-postinstall-status-anomaly',
      destructiveRepairAllowed: false,
      nextAction: 'run the esbuild native binary and preserve the diagnostic result',
    },
  );
});
