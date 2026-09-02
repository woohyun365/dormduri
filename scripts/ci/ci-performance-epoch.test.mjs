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
const closedSupportedLineEpochFixture = JSON.parse(
  readFileSync(
    resolve('scripts/ci/fixtures/ci-performance-epoch-lint-tooling-supported-line-2026-09-01.json'),
    'utf8',
  ),
);
const closedLintStagedEpochFixture = JSON.parse(
  readFileSync(
    resolve('scripts/ci/fixtures/ci-performance-epoch-lint-staged17-2026-09-01.json'),
    'utf8',
  ),
);
const closedPnpmMemoryFixedEpochFixture = JSON.parse(
  readFileSync(
    resolve('scripts/ci/fixtures/ci-performance-epoch-pnpm11-memory-fixed-2026-09-01.json'),
    'utf8',
  ),
);
const closedTransitiveOverrideEpochFixture = JSON.parse(
  readFileSync(
    resolve(
      'scripts/ci/fixtures/ci-performance-epoch-transitive-override-lifecycle-2026-09-02.json',
    ),
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
    epochId: 'api-runtime-supported-lines-2026-09-02',
    fileSha256: epoch.fileSha256,
    sourceSha: '74d01728f7a36d1429176ee10a430e783f3cbc3b',
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

test('closes the supported-line epoch before collecting the lint-staged 17 cohort', () => {
  const closedEpoch = parseMeasurementEpoch(closedSupportedLineEpochFixture);

  assert.equal(closedEpoch.id, 'lint-tooling-supported-line-2026-09-01');
  assert.equal(closedEpoch.state, 'closed');
  assert.equal(closedEpoch.baseSha, '6198f4a61efbf7276327382411ad926efbe540e4');
  assert.deepEqual(closedEpoch.fileSha256, {
    'pnpm-lock.yaml': 'd7a17a873d5e30474567fb03d4b6cafc8bdbc41417fc84c8236a2aa3b4952551',
    'pnpm-workspace.yaml': 'd34ba2bcf7e67f120e4f10071d1cf44642a11e29f22aec6b0193ca3a8cdf5a89',
    'infra/image-inventory.json':
      '5e31ed06d327b1f0c92f33f500d4cd4f67e736977e1007c8842062ca6d3a2bba',
  });
});

test('closes the lint-staged 17 epoch before collecting the pnpm memory-fixed cohort', () => {
  const closedEpoch = parseMeasurementEpoch(closedLintStagedEpochFixture);

  assert.equal(closedEpoch.id, 'lint-staged17-2026-09-01');
  assert.equal(closedEpoch.state, 'closed');
  assert.equal(closedEpoch.baseSha, 'c26c0721a4ed13e1f3243344e1a3ed8151fcf14e');
  assert.equal(closedEpoch.versions.pnpm, '11.7.0');
  assert.deepEqual(closedEpoch.fileSha256, {
    'pnpm-lock.yaml': '6fef3af100ad7da67e9dc585d88c2c129d231ba31124d4d4014034722437e72f',
    'pnpm-workspace.yaml': 'd34ba2bcf7e67f120e4f10071d1cf44642a11e29f22aec6b0193ca3a8cdf5a89',
    'infra/image-inventory.json':
      '5e31ed06d327b1f0c92f33f500d4cd4f67e736977e1007c8842062ca6d3a2bba',
  });
});

test('closes the pnpm memory-fixed epoch before collecting the override lifecycle cohort', () => {
  const closedEpoch = parseMeasurementEpoch(closedPnpmMemoryFixedEpochFixture);

  assert.equal(closedEpoch.id, 'pnpm11-memory-fixed-2026-09-01');
  assert.equal(closedEpoch.state, 'closed');
  assert.equal(closedEpoch.baseSha, 'ef2968c951bdc7ec0e8d95b9ecb0e22590d2a725');
  assert.equal(closedEpoch.versions.pnpm, '11.24.0');
  assert.deepEqual(closedEpoch.fileSha256, {
    'pnpm-lock.yaml': '6fef3af100ad7da67e9dc585d88c2c129d231ba31124d4d4014034722437e72f',
    'pnpm-workspace.yaml': 'd34ba2bcf7e67f120e4f10071d1cf44642a11e29f22aec6b0193ca3a8cdf5a89',
    'infra/image-inventory.json':
      '5e31ed06d327b1f0c92f33f500d4cd4f67e736977e1007c8842062ca6d3a2bba',
  });
});

test('closes the override lifecycle epoch before collecting the API runtime supported-line cohort', () => {
  const closedEpoch = parseMeasurementEpoch(closedTransitiveOverrideEpochFixture);

  assert.equal(closedEpoch.id, 'transitive-override-lifecycle-2026-09-02');
  assert.equal(closedEpoch.state, 'closed');
  assert.equal(closedEpoch.baseSha, '3c634435359011acc9b4ed4fb490f7fd1cd37092');
  assert.deepEqual(closedEpoch.fileSha256, {
    'pnpm-lock.yaml': 'd2d54b397b310056722d6b0d92b3511b5cdaa82772de33e9b0d6a49a5dd5aefc',
    'pnpm-workspace.yaml': 'c2d3606d407f799de510138c05e37faa372e3a815f5ef0dfc43b96aa8610383e',
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
