import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  assertDependencyHealth,
  classifyPnpmEvidence,
  parseDependencyHealthContract,
} from './dependency-health-contract.mjs';

const contract = parseDependencyHealthContract(
  JSON.parse(
    readFileSync(resolve('scripts/dependencies/fixtures/dependency-health-contract.json'), 'utf8'),
  ),
);

test('current dependency graph satisfies the frozen dependency-health contract', () => {
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

test('fails closed when a remediated vulnerable resolution returns', () => {
  assert.throws(
    () =>
      assertDependencyHealth({
        contract,
        workspace: contract.requiredWorkspaceEntries.join('\n'),
        lockfile: `${contract.requiredLockResolutions.map((item) => `\n  ${item}:\n`).join('')}\n  image-size@2.0.2:\n`,
      }),
    /forbidden lock resolution: image-size@2\.0\.2/u,
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
