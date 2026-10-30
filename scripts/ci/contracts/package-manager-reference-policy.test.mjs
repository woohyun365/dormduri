import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const manifest = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
const expectedVersion = manifest.packageManager?.match(/^pnpm@(\d+\.\d+\.\d+)$/u)?.[1];

// The restore drill installs the root packageManager itself, so it carries no version to compare.
const workflowPaths = [
  '.github/workflows/api-ci.yml',
  '.github/workflows/ci.yml',
  '.github/workflows/infra-ci.yml',
  '.github/workflows/web-ci.yml',
];

test('CI pnpm setup references match the exact root pnpm version', () => {
  assert.ok(expectedVersion, 'root packageManager must pin an exact pnpm version');
  for (const path of workflowPaths) {
    const source = readFileSync(resolve(path), 'utf8');
    const versions = [
      ...source.matchAll(/version:\s*(\d+\.\d+\.\d+)/gu),
    ].map((match) => match[1]);
    assert.ok(versions.length > 0, `${path} must contain an active pnpm setup reference`);
    assert.deepEqual([...new Set(versions)], [expectedVersion], `${path} pnpm version drifted`);
  }

  const renovateFixture = JSON.parse(
    readFileSync(resolve('scripts/dependencies/fixtures/renovate-pnpm-dry-run.json'), 'utf8'),
  );
  assert.equal(renovateFixture.packageManager, manifest.packageManager);
});

test('the restore drill and Docker images install pnpm from the root packageManager', () => {
  const installCommand = `npm install --global "$(node -p "require('./package.json').packageManager")"`;
  for (const path of [
    '.github/workflows/api-restore-drill-manual.yml',
    'infra/deploy/api/Dockerfile',
    'infra/deploy/web/Dockerfile',
    'scripts/infra/rehearsal/ingress-trust/Dockerfile',
  ]) {
    const source = readFileSync(resolve(path), 'utf8');
    assert.ok(source.includes(installCommand), `${path} must install the root packageManager`);
    assert.doesNotMatch(source, /pnpm@\d|corepack/iu, `${path} must not pin pnpm separately`);
  }
});
