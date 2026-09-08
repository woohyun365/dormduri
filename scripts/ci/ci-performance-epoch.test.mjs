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
const closedApiRuntimeSupportedLinesEpochFixture = JSON.parse(
  readFileSync(
    resolve('scripts/ci/fixtures/ci-performance-epoch-api-runtime-supported-lines-2026-09-02.json'),
    'utf8',
  ),
);
const closedApiPersistenceSupportedLinesEpochFixture = JSON.parse(
  readFileSync(
    resolve(
      'scripts/ci/fixtures/ci-performance-epoch-api-persistence-supported-lines-2026-09-02.json',
    ),
    'utf8',
  ),
);
const closedApiObservabilityClientEpochFixture = JSON.parse(
  readFileSync(
    resolve('scripts/ci/fixtures/ci-performance-epoch-api-observability-client-2026-09-03.json'),
    'utf8',
  ),
);
const closedRepositoryPrettierEpochFixture = JSON.parse(
  readFileSync(
    resolve('scripts/ci/fixtures/ci-performance-epoch-repository-prettier-3-9-2026-09-03.json'),
    'utf8',
  ),
);
const closedApiAwsSdkSupportedLinesEpochFixture = JSON.parse(
  readFileSync(
    resolve('scripts/ci/fixtures/ci-performance-epoch-api-aws-sdk-supported-lines-2026-09-04.json'),
    'utf8',
  ),
);
const closedApiSupertestTypesSupportedLineEpochFixture = JSON.parse(
  readFileSync(
    resolve(
      'scripts/ci/fixtures/ci-performance-epoch-api-supertest-types-supported-line-2026-09-05.json',
    ),
    'utf8',
  ),
);
const closedSharedZodSupportedLineEpochFixture = JSON.parse(
  readFileSync(
    resolve('scripts/ci/fixtures/ci-performance-epoch-shared-zod-supported-line-2026-09-06.json'),
    'utf8',
  ),
);
const closedDependencySecurityEpochFixture = JSON.parse(
  readFileSync(
    resolve(
      'scripts/ci/fixtures/ci-performance-epoch-dependency-security-five-alert-2026-09-07.json',
    ),
    'utf8',
  ),
);
const closedExternalRuntimeImageEpochFixture = JSON.parse(
  readFileSync(
    resolve(
      'scripts/ci/fixtures/ci-performance-epoch-external-runtime-image-patch-2026-09-07.json',
    ),
    'utf8',
  ),
);
const closedBackendNestjs11SupportedLineEpochFixture = JSON.parse(
  readFileSync(
    resolve(
      'scripts/ci/fixtures/ci-performance-epoch-backend-nestjs11-supported-line-2026-09-07.json',
    ),
    'utf8',
  ),
);
const closedApiAwsSdkFollowUpEpochFixture = JSON.parse(
  readFileSync(
    resolve('scripts/ci/fixtures/ci-performance-epoch-api-aws-sdk-follow-up-2026-09-07.json'),
    'utf8',
  ),
);
const closedRepositoryLintToolingCurrentLineEpochFixture = JSON.parse(
  readFileSync(
    resolve(
      'scripts/ci/fixtures/ci-performance-epoch-repository-lint-tooling-current-line-2026-09-08.json',
    ),
    'utf8',
  ),
);

test('active measurement epoch matches the current dependency inputs', () => {
  const epoch = parseMeasurementEpoch(epochFixture);
  assert.equal(epoch.versions.typescriptEslint, '8.69.0');
  assert.equal(epoch.versions.globals, '17.12.0');
  assert.equal(epoch.versions.nodeTypes, '24.13.3');
  assert.equal(epoch.versions['aws-sdk'], '3.1126.0');
  assert.equal(epoch.versions.nestjsRuntime, '11.2.3');
  assert.equal(epoch.versions.nestjsCli, '11.0.24');
  assert.equal(epoch.versions.express, '5.2.1');
  assert.equal(epoch.versions.multer, '2.2.0');
  assert.equal(epoch.versions.vitest, '5.0.0');
  assert.equal(epoch.versions.vitestCoverageV8, '5.0.0');
  const fingerprint = buildDependencyFingerprint({
    epoch,
    readText: (path) => readFileSync(resolve(path), 'utf8'),
    sourceSha: epoch.baseSha,
  });

  assert.deepEqual(fingerprint, {
    epochId: 'repository-vitest5-cross-surface-test-infrastructure-2026-09-08',
    fileSha256: epoch.fileSha256,
    sourceSha: '26d75464bd2bd6d0f2ebf4f76d60b4087e87fe43',
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

test('closes the API runtime epoch before collecting the persistence supported-line cohort', () => {
  const closedEpoch = parseMeasurementEpoch(closedApiRuntimeSupportedLinesEpochFixture);

  assert.equal(closedEpoch.id, 'api-runtime-supported-lines-2026-09-02');
  assert.equal(closedEpoch.state, 'closed');
  assert.equal(closedEpoch.baseSha, '74d01728f7a36d1429176ee10a430e783f3cbc3b');
  assert.deepEqual(closedEpoch.fileSha256, {
    'pnpm-lock.yaml': '27acc00270e5c304119585ab353795a2e2b2fc820cdad86ab5ef7131cd9c6401',
    'pnpm-workspace.yaml': 'c2d3606d407f799de510138c05e37faa372e3a815f5ef0dfc43b96aa8610383e',
    'infra/image-inventory.json':
      '5e31ed06d327b1f0c92f33f500d4cd4f67e736977e1007c8842062ca6d3a2bba',
  });
});

test('closes the API persistence epoch before collecting the observability client cohort', () => {
  const closedEpoch = parseMeasurementEpoch(closedApiPersistenceSupportedLinesEpochFixture);

  assert.equal(closedEpoch.id, 'api-persistence-supported-lines-2026-09-02');
  assert.equal(closedEpoch.state, 'closed');
  assert.equal(closedEpoch.baseSha, '94e6608c6072c5e6b8011083e98e12948d1d5961');
  assert.deepEqual(closedEpoch.fileSha256, {
    'pnpm-lock.yaml': '28e82ae4e99e4666636d05044cca2ff168a217866646945f3ac76aa7b888f02e',
    'pnpm-workspace.yaml': 'c2d3606d407f799de510138c05e37faa372e3a815f5ef0dfc43b96aa8610383e',
    'infra/image-inventory.json':
      '5e31ed06d327b1f0c92f33f500d4cd4f67e736977e1007c8842062ca6d3a2bba',
  });
});

test('closes the API observability client epoch before collecting the Prettier 3.9 cohort', () => {
  const closedEpoch = parseMeasurementEpoch(closedApiObservabilityClientEpochFixture);

  assert.equal(closedEpoch.id, 'api-observability-client-2026-09-03');
  assert.equal(closedEpoch.state, 'closed');
  assert.equal(closedEpoch.baseSha, '6f053e45dddea88bff0238666ffd3636519aa38e');
  assert.equal(closedEpoch.versions.prometheusClient, '0.16.1');
  assert.deepEqual(closedEpoch.fileSha256, {
    'pnpm-lock.yaml': 'df2ec044d3f32d49971cff196c9fb6263bdefd3a1d6d4ba487b706c3d98c05df',
    'pnpm-workspace.yaml': 'c2d3606d407f799de510138c05e37faa372e3a815f5ef0dfc43b96aa8610383e',
    'infra/image-inventory.json':
      '5e31ed06d327b1f0c92f33f500d4cd4f67e736977e1007c8842062ca6d3a2bba',
  });
});

test('closes the Prettier 3.9 epoch before collecting the AWS SDK supported-line cohort', () => {
  const closedEpoch = parseMeasurementEpoch(closedRepositoryPrettierEpochFixture);

  assert.equal(closedEpoch.id, 'repository-prettier-3-9-2026-09-03');
  assert.equal(closedEpoch.state, 'closed');
  assert.equal(closedEpoch.baseSha, '0c7028293cc89be1bc34bc2ac5998ef27c702063');
  assert.equal(closedEpoch.versions.prettier, '3.9.6');
  assert.equal(closedEpoch.versions['aws-sdk'], '3.1121.0');
  assert.deepEqual(closedEpoch.fileSha256, {
    'pnpm-lock.yaml': 'fb395870f9a0811eb994b65fd2a32309de088d488d8eeb08d7e17d9faf5a64b7',
    'pnpm-workspace.yaml': '4af09d31854fd55225a31db2e6b23c93d905f05d145fc6c975b75e55017975be',
    'infra/image-inventory.json':
      '5e31ed06d327b1f0c92f33f500d4cd4f67e736977e1007c8842062ca6d3a2bba',
  });
});

test('closes the AWS SDK epoch before collecting the API test-tooling cohort', () => {
  const closedEpoch = parseMeasurementEpoch(closedApiAwsSdkSupportedLinesEpochFixture);

  assert.equal(closedEpoch.id, 'api-aws-sdk-supported-lines-2026-09-04');
  assert.equal(closedEpoch.state, 'closed');
  assert.equal(closedEpoch.baseSha, 'aab051bb561815e875f057f0bf60409ba2f9651a');
  assert.equal(closedEpoch.versions['aws-sdk'], '3.1123.0');
  assert.deepEqual(closedEpoch.fileSha256, {
    'pnpm-lock.yaml': '19bf007ed6ffaa1275fd8c9f54c128d65c2b72a62d52b2fae0448e8ee5ce4eb5',
    'pnpm-workspace.yaml': '4af09d31854fd55225a31db2e6b23c93d905f05d145fc6c975b75e55017975be',
    'infra/image-inventory.json':
      '5e31ed06d327b1f0c92f33f500d4cd4f67e736977e1007c8842062ca6d3a2bba',
  });
});

test('closes the API test-tooling epoch before collecting the Shared Zod cohort', () => {
  const closedEpoch = parseMeasurementEpoch(closedApiSupertestTypesSupportedLineEpochFixture);

  assert.equal(closedEpoch.id, 'api-supertest-types-supported-line-2026-09-05');
  assert.equal(closedEpoch.state, 'closed');
  assert.equal(closedEpoch.baseSha, 'cc756c3c2f2b59876704315ac32b8fcb2a1ec654');
  assert.equal(closedEpoch.versions.supertestTypes, '7.2.1');
  assert.deepEqual(closedEpoch.fileSha256, {
    'pnpm-lock.yaml': 'ab5a483e1d261941ce52f465ba419e942dff5d52ee61f28ad07c90503c20d8af',
    'pnpm-workspace.yaml': '4af09d31854fd55225a31db2e6b23c93d905f05d145fc6c975b75e55017975be',
    'infra/image-inventory.json':
      '5e31ed06d327b1f0c92f33f500d4cd4f67e736977e1007c8842062ca6d3a2bba',
  });
});

test('closes the Shared Zod epoch before collecting the dependency security cohort', () => {
  const closedEpoch = parseMeasurementEpoch(closedSharedZodSupportedLineEpochFixture);

  assert.equal(closedEpoch.id, 'shared-zod-supported-line-2026-09-06');
  assert.equal(closedEpoch.state, 'closed');
  assert.equal(closedEpoch.baseSha, '9b7e5379f082f1f51270fd85ba42c146d9947e18');
  assert.equal(closedEpoch.versions.zod, '4.5.4');
  assert.deepEqual(closedEpoch.fileSha256, {
    'pnpm-lock.yaml': 'e133e8f75b4576bbff5164a256e7c733b1855ad2756b8004880c7425b4309213',
    'pnpm-workspace.yaml': '4af09d31854fd55225a31db2e6b23c93d905f05d145fc6c975b75e55017975be',
    'infra/image-inventory.json':
      '5e31ed06d327b1f0c92f33f500d4cd4f67e736977e1007c8842062ca6d3a2bba',
  });
});

test('closes the dependency security epoch before collecting the external image cohort', () => {
  const closedEpoch = parseMeasurementEpoch(closedDependencySecurityEpochFixture);

  assert.equal(closedEpoch.id, 'dependency-security-five-alert-2026-09-07');
  assert.equal(closedEpoch.state, 'closed');
  assert.equal(closedEpoch.baseSha, '56233cb4693013328f8288db95b43730320b1586');
  assert.equal(closedEpoch.versions.mysql2, '3.23.1');
  assert.deepEqual(closedEpoch.fileSha256, {
    'pnpm-lock.yaml': '06e3d334554d87ed23f9a721a6c78e62e3840f3e5c0e1298ffafd6169871e96b',
    'pnpm-workspace.yaml': '4eb490564dbf4ab95988793b623d86a949067730c3ddd256debf8cdafb3ed889',
    'infra/image-inventory.json':
      '5e31ed06d327b1f0c92f33f500d4cd4f67e736977e1007c8842062ca6d3a2bba',
  });
});

test('closes the external image epoch before collecting the NestJS 11 supported-line cohort', () => {
  const closedEpoch = parseMeasurementEpoch(closedExternalRuntimeImageEpochFixture);

  assert.equal(closedEpoch.id, 'external-runtime-image-patch-2026-09-07');
  assert.equal(closedEpoch.state, 'closed');
  assert.equal(closedEpoch.baseSha, '3c084701447eeb6f626d71b4f7b32fb9961a4cea');
  assert.equal(closedEpoch.versions.nginx, '1.31.5-alpine');
  assert.equal(closedEpoch.versions.grafana, '13.2.1');
  assert.deepEqual(closedEpoch.fileSha256, {
    'pnpm-lock.yaml': '06e3d334554d87ed23f9a721a6c78e62e3840f3e5c0e1298ffafd6169871e96b',
    'pnpm-workspace.yaml': '4eb490564dbf4ab95988793b623d86a949067730c3ddd256debf8cdafb3ed889',
    'infra/image-inventory.json':
      'f684f83d541aa696e1f7c9862f93acba9c95431138a0475139b761bb3bac73f0',
  });
});

test('closes the NestJS 11 epoch before collecting the AWS SDK follow-up cohort', () => {
  const closedEpoch = parseMeasurementEpoch(closedBackendNestjs11SupportedLineEpochFixture);

  assert.equal(closedEpoch.id, 'backend-nestjs11-supported-line-2026-09-07');
  assert.equal(closedEpoch.state, 'closed');
  assert.equal(closedEpoch.baseSha, 'fcd835cec1936d5f0b0502944fb9f90053c07b66');
  assert.equal(closedEpoch.versions['aws-sdk'], '3.1123.0');
  assert.equal(closedEpoch.versions.nestjsRuntime, '11.2.3');
  assert.deepEqual(closedEpoch.fileSha256, {
    'pnpm-lock.yaml': '0c026b1fdb4a51556c8037220b2d0102d6f88fe008b0a9cc8f6659d28dd45b0b',
    'pnpm-workspace.yaml': 'f0ae4f69a844a7e340af66e6c4b6a7add73e89124ef31b6e3fe93d64b1416957',
    'infra/image-inventory.json':
      'f684f83d541aa696e1f7c9862f93acba9c95431138a0475139b761bb3bac73f0',
  });
});

test('closes the AWS SDK follow-up epoch before collecting the lint current-line cohort', () => {
  const closedEpoch = parseMeasurementEpoch(closedApiAwsSdkFollowUpEpochFixture);

  assert.equal(closedEpoch.id, 'api-aws-sdk-follow-up-2026-09-07');
  assert.equal(closedEpoch.state, 'closed');
  assert.equal(closedEpoch.baseSha, '3d8a34d50a6b4a8d5fef560b7167e34529a8ad4d');
  assert.equal(closedEpoch.versions['aws-sdk'], '3.1126.0');
  assert.deepEqual(closedEpoch.fileSha256, {
    'pnpm-lock.yaml': '1fbc772f645414d4ff322c8dac5c5d22683bd6d9020cfb56f88995740b9b3492',
    'pnpm-workspace.yaml': 'f0ae4f69a844a7e340af66e6c4b6a7add73e89124ef31b6e3fe93d64b1416957',
    'infra/image-inventory.json':
      'f684f83d541aa696e1f7c9862f93acba9c95431138a0475139b761bb3bac73f0',
  });
});

test('closes the lint current-line epoch before collecting the Vitest 5 cohort', () => {
  const closedEpoch = parseMeasurementEpoch(closedRepositoryLintToolingCurrentLineEpochFixture);

  assert.equal(closedEpoch.id, 'repository-lint-tooling-current-line-2026-09-08');
  assert.equal(closedEpoch.state, 'closed');
  assert.equal(closedEpoch.baseSha, 'b2fdab39e323da05e1b05cb7139a7f19bc0ae0a7');
  assert.equal(closedEpoch.versions.typescriptEslint, '8.69.0');
  assert.equal(closedEpoch.versions.globals, '17.12.0');
  assert.equal(closedEpoch.versions.nodeTypes, '24.13.3');
  assert.deepEqual(closedEpoch.fileSha256, {
    'pnpm-lock.yaml': '11823d7816f046892ea8533ca2fb5b21429e1db2d373092e12ab70490b52eb48',
    'pnpm-workspace.yaml': '93c922a3e5a0daef8279671b01cfe8854b6db92edc208482c95fc006a253ed62',
    'infra/image-inventory.json':
      'f684f83d541aa696e1f7c9862f93acba9c95431138a0475139b761bb3bac73f0',
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
