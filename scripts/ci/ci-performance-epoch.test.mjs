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
const closedEpochFixture = JSON.parse(
  readFileSync(
    resolve('scripts/ci/fixtures/ci-performance-epoch-native-ci-2026-08-28.json'),
    'utf8',
  ),
);
const closedLintToolchainEpochFixture = JSON.parse(
  readFileSync(
    resolve('scripts/ci/fixtures/ci-performance-epoch-lint-toolchain-2026-09-01.json'),
    'utf8',
  ),
);

test('active measurement epoch matches the current dependency inputs', () => {
  const epoch = parseMeasurementEpoch(epochFixture);
  const fingerprint = buildDependencyFingerprint({
    epoch,
    readText: (path) => readFileSync(resolve(path), 'utf8'),
    sourceSha: epoch.baseSha,
  });

  assert.deepEqual(fingerprint, {
    epochId: 'lint-tooling-supported-line-2026-09-01',
    fileSha256: epoch.fileSha256,
    sourceSha: '6198f4a61efbf7276327382411ad926efbe540e4',
  });
  assert.deepEqual(compareDependencyFingerprint(epoch, fingerprint), {
    changedInputs: [],
    comparisonBaseSha: epoch.baseSha,
    comparisonEpochId: epoch.id,
    state: 'compatible-active-epoch',
  });
});

test('preserves the previous measurement epoch as closed immutable evidence', () => {
  const closedEpoch = parseMeasurementEpoch(closedEpochFixture);

  assert.equal(closedEpoch.id, 'native-ci-2026-08-28');
  assert.equal(closedEpoch.state, 'closed');
  assert.equal(closedEpoch.baseSha, 'a15a98cd4b0f4ca23a147d65dce155061cd30193');
  assert.deepEqual(closedEpoch.fileSha256, {
    'pnpm-lock.yaml': '014b8d2bb140cf6e885d1f2812d5af467dc8d49ca17dbb5c9e234d6734944a43',
    'pnpm-workspace.yaml': '638f823ec4a12faaa6219c725ee069e414d898f1e7adad03d3ad44a021acd4ae',
    'infra/image-inventory.json':
      '5e31ed06d327b1f0c92f33f500d4cd4f67e736977e1007c8842062ca6d3a2bba',
  });
});

test('closes the lint-toolchain epoch before collecting the supported-line cohort', () => {
  const closedEpoch = parseMeasurementEpoch(closedLintToolchainEpochFixture);

  assert.equal(closedEpoch.id, 'lint-toolchain-2026-09-01');
  assert.equal(closedEpoch.state, 'closed');
  assert.equal(closedEpoch.baseSha, '1d22ec3539b5685cae2b728a1e26f68768f60d07');
  assert.deepEqual(closedEpoch.fileSha256, {
    'pnpm-lock.yaml': 'de4b77b83210ef7736921aae7412b1ac830ed072e895db1512f54d3bdf9c955b',
    'pnpm-workspace.yaml': 'f52362968468aec1d6ac6e9e131e5e904e1db734fcaeef37b644df2ee25be258',
    'infra/image-inventory.json':
      '5e31ed06d327b1f0c92f33f500d4cd4f67e736977e1007c8842062ca6d3a2bba',
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
