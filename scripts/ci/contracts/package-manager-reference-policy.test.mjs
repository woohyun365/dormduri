import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const manifest = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
const expectedVersion = manifest.packageManager?.match(/^pnpm@(\d+\.\d+\.\d+)$/u)?.[1];

const workflowPaths = [
  '.github/workflows/api-ci.yml',
  '.github/workflows/api-restore-drill-manual.yml',
  '.github/workflows/ci.yml',
  '.github/workflows/infra-ci.yml',
  '.github/workflows/web-ci.yml',
];

test('active Corepack and CI references match the exact root pnpm version', () => {
  assert.ok(expectedVersion, 'root packageManager must pin an exact pnpm version');
  for (const path of workflowPaths) {
    const source = readFileSync(resolve(path), 'utf8');
    const versions = [
      ...source.matchAll(/(?:version:\s*|corepack prepare pnpm@)(\d+\.\d+\.\d+)/gu),
    ].map((match) => match[1]);
    assert.ok(versions.length > 0, `${path} must contain an active pnpm setup reference`);
    assert.deepEqual([...new Set(versions)], [expectedVersion], `${path} pnpm version drifted`);
  }

  const renovateFixture = JSON.parse(
    readFileSync(resolve('scripts/dependencies/fixtures/renovate-pnpm-dry-run.json'), 'utf8'),
  );
  assert.equal(renovateFixture.packageManager, manifest.packageManager);

  const activeEpoch = JSON.parse(
    readFileSync(
      resolve('scripts/ci/performance/fixtures/ci-performance-active-epoch.json'),
      'utf8',
    ),
  );
  assert.equal(activeEpoch.epoch.versions.pnpm, expectedVersion);
});
