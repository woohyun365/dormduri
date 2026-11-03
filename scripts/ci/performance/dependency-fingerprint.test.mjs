import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { buildDependencyFingerprint, dependencyInputPaths } from './dependency-fingerprint.mjs';

// Fixed dependency input text. Bots change the real lockfile, workspace and inventory, so the fingerprint contract is
// checked with inline inputs. The fixed inventory lists no image, so its input text is the file text alone.
const fixedDependencyInputs = {
  ...Object.fromEntries(dependencyInputPaths.map((path) => [path, `fixed ${path} contents\n`])),
  'infra/image-inventory.json': '{"version":2,"images":[]}\n',
};
const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const runHeadSha = '1111111111111111111111111111111111111111';

test('fingerprints every dependency input of the run head by hash', () => {
  const fingerprint = buildDependencyFingerprint({
    readText: (path) => fixedDependencyInputs[path],
    sourceSha: runHeadSha,
  });

  assert.deepEqual(fingerprint, {
    fileSha256: Object.fromEntries(
      dependencyInputPaths.map((path) => [path, sha256(fixedDependencyInputs[path])]),
    ),
    sourceSha: runHeadSha,
  });
});

test('a run head that changes only the lockfile changes only the lockfile hash', () => {
  const before = buildDependencyFingerprint({
    readText: (path) => fixedDependencyInputs[path],
    sourceSha: runHeadSha,
  });
  const after = buildDependencyFingerprint({
    readText: (path) =>
      path === 'pnpm-lock.yaml'
        ? `${fixedDependencyInputs[path]}transition-run`
        : fixedDependencyInputs[path],
    sourceSha: '2222222222222222222222222222222222222222',
  });

  assert.equal(after.sourceSha, '2222222222222222222222222222222222222222');
  assert.deepEqual(
    dependencyInputPaths.filter((path) => after.fileSha256[path] !== before.fileSha256[path]),
    ['pnpm-lock.yaml'],
  );
});

test('an image tag or digest change in its owner file changes the inventory fingerprint', () => {
  const inventory = `${JSON.stringify({
    version: 2,
    images: [
      {
        name: 'postgres',
        ownerPath: 'compose.yml',
        repository: 'postgres',
        updateOwner: 'renovate',
      },
    ],
  })}\n`;
  const fingerprintWith = (image) =>
    buildDependencyFingerprint({
      readText: (path) =>
        ({
          ...fixedDependencyInputs,
          'infra/image-inventory.json': inventory,
          'compose.yml': `services:\n  db:\n    image: ${image}\n`,
        })[path],
      sourceSha: runHeadSha,
    });
  const before = fingerprintWith(`postgres:18.6-alpine@sha256:${'a'.repeat(64)}`);

  for (const image of [
    `postgres:18.6-alpine@sha256:${'b'.repeat(64)}`,
    `postgres:18.7-alpine@sha256:${'a'.repeat(64)}`,
  ]) {
    const after = fingerprintWith(image);
    assert.deepEqual(
      dependencyInputPaths.filter((path) => after.fileSha256[path] !== before.fileSha256[path]),
      ['infra/image-inventory.json'],
    );
  }
  assert.throws(() => fingerprintWith('postgres:18.6-alpine'), /without <tag>@sha256:<digest>/u);
});

test('rejects incomplete run head input instead of fingerprinting a partial cohort', () => {
  assert.throws(
    () =>
      buildDependencyFingerprint({
        readText: (path) => fixedDependencyInputs[path],
        sourceSha: 'not-a-sha',
      }),
    /sourceSha/u,
  );
  assert.throws(
    () =>
      buildDependencyFingerprint({
        readText: (path) => (path === 'pnpm-lock.yaml' ? undefined : fixedDependencyInputs[path]),
        sourceSha: runHeadSha,
      }),
    /readText\(pnpm-lock\.yaml\) must return a string/u,
  );
  assert.throws(
    () => buildDependencyFingerprint({ readText: null, sourceSha: runHeadSha }),
    /readText must be a function/u,
  );
});

test('rejects an image inventory that keeps references outside their owner files', () => {
  const versionOne = `${JSON.stringify({
    version: 1,
    images: [
      {
        name: 'postgres',
        ownerPath: 'compose.yml',
        reference: `postgres:18.6-alpine@sha256:${'a'.repeat(64)}`,
      },
    ],
  })}\n`;

  assert.throws(
    () =>
      buildDependencyFingerprint({
        readText: (path) =>
          ({ ...fixedDependencyInputs, 'infra/image-inventory.json': versionOne })[path],
        sourceSha: runHeadSha,
      }),
    /infra\/image-inventory\.json version 1 is not supported/u,
  );
});
