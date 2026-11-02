import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import test from 'node:test';

import { resolveArtifactPath } from '../../artifacts/paths.mjs';

const repoRoot = resolve(import.meta.dirname, '../../..');
// This unit fixture must remain inside the repository because the manifest
// intentionally accepts only repository-relative evidence paths. CI injects a
// runner-owned output root for real evidence, which must not leak into this
// isolated contract test.
const reportRoot = resolveArtifactPath(repoRoot, ['test'], {});
mkdirSync(reportRoot, { recursive: true });

test('accepts a secret-free non-root local artifact manifest', (context) => {
  const fixture = createFixture(context);
  const result = verify(fixture.manifestPath);
  assert.equal(result.status, 0, result.stderr);
});

test('rejects root runtime images', (context) => {
  const fixture = createFixture(context, { runtimeUser: 'root' });
  const result = verify(fixture.manifestPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /runtimeUser must be explicitly non-root/u);
});

test('rejects secret-like material in artifact evidence', (context) => {
  const fixture = createFixture(context, { evidence: 'password="must-not-ship"' });
  const result = verify(fixture.manifestPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /evidence contains secret-like material/u);
});

function createFixture(context, { runtimeUser = 'dormduri', evidence = '{}' } = {}) {
  const directory = mkdtempSync(resolve(reportRoot, 'artifact-verifier-test-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const relativeDirectory = relative(repoRoot, directory);
  const images = ['api', 'web'].map((name) => {
    const sbom = `${relativeDirectory}/${name}.sbom.json`;
    const provenance = `${relativeDirectory}/${name}.provenance.json`;
    writeFileSync(resolve(repoRoot, sbom), evidence);
    writeFileSync(resolve(repoRoot, provenance), '{}');
    return {
      name,
      tag: `dormduri-${name}:${'a'.repeat(40)}`,
      digest: `sha256:${name === 'api' ? 'b' : 'c'}${'0'.repeat(63)}`,
      dockerfile: `infra/deploy/${name}/Dockerfile`,
      runtimeUser,
      sbom,
      provenance,
    };
  });
  const manifestPath = resolve(directory, 'artifact-manifest.json');
  writeFileSync(
    manifestPath,
    `${JSON.stringify({
      version: 1,
      release: 'a'.repeat(40),
      builtAt: '2026-08-10T00:00:00.000Z',
      workingTreeDirty: false,
      builder: 'fixture',
      images,
    })}\n`,
  );
  return { manifestPath };
}

function verify(manifestPath) {
  return spawnSync(
    process.execPath,
    [resolve(import.meta.dirname, 'verify-manifest.mjs'), manifestPath],
    {
      cwd: repoRoot,
      encoding: 'utf8',
    },
  );
}
