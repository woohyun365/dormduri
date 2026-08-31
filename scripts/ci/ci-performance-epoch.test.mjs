import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  buildDependencyFingerprint,
  compareDependencyFingerprint,
  parseMeasurementEpoch,
} from './ci-performance-epoch.mjs';

const epochFixture = JSON.parse(
  readFileSync(resolve('scripts/ci/fixtures/ci-performance-active-epoch.json'), 'utf8'),
);

test('active measurement epoch matches the current dependency inputs', () => {
  const epoch = parseMeasurementEpoch(epochFixture);
  const fingerprint = buildDependencyFingerprint({
    epoch,
    readText: (path) => readFileSync(resolve(path), 'utf8'),
    sourceSha: epoch.baseSha,
  });

  assert.deepEqual(fingerprint, {
    epochId: 'native-ci-2026-08-28',
    fileSha256: epoch.fileSha256,
    sourceSha: 'a15a98cd4b0f4ca23a147d65dce155061cd30193',
  });
  assert.deepEqual(compareDependencyFingerprint(epoch, fingerprint), {
    changedInputs: [],
    comparisonBaseSha: epoch.baseSha,
    comparisonEpochId: epoch.id,
    state: 'compatible-active-epoch',
  });
});

test('run-head fingerprint drift is preserved instead of using current checkout hashes', () => {
  const epoch = parseMeasurementEpoch(epochFixture);
  const fingerprint = buildDependencyFingerprint({
    epoch,
    readText: (path) =>
      path === 'infra/image-inventory.json'
        ? `${readFileSync(resolve(path), 'utf8')}\ntransition-run`
        : readFileSync(resolve(path), 'utf8'),
    sourceSha: '1111111111111111111111111111111111111111',
  });
  const comparison = compareDependencyFingerprint(epoch, fingerprint);

  assert.equal(fingerprint.sourceSha, '1111111111111111111111111111111111111111');
  assert.notEqual(
    fingerprint.fileSha256['infra/image-inventory.json'],
    epoch.fileSha256['infra/image-inventory.json'],
  );
  assert.deepEqual(comparison.changedInputs, ['infra/image-inventory.json']);
  assert.equal(comparison.state, 'changed-inputs');
});

test('measurement epoch rejects malformed or incomplete dependency ownership', () => {
  assert.throws(
    () => parseMeasurementEpoch({ ...epochFixture, schemaVersion: 2 }),
    /schemaVersion/u,
  );
  const incomplete = structuredClone(epochFixture);
  delete incomplete.epoch.fileSha256['pnpm-lock.yaml'];
  assert.throws(() => parseMeasurementEpoch(incomplete), /pnpm-lock\.yaml/u);
  assert.throws(
    () =>
      buildDependencyFingerprint({
        epoch: parseMeasurementEpoch(epochFixture),
        readText: () => '',
        sourceSha: 'not-a-sha',
      }),
    /sourceSha/u,
  );
});
