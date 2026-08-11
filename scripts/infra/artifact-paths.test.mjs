import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  DEFAULT_ARTIFACTS_DIRECTORY,
  resolveArtifactPath,
  resolveArtifactsDirectory,
} from '../artifacts/paths.mjs';

const repoRoot = '/workspace/knu-roommate';

test('repository tools default to an understandable local artifact directory', () => {
  assert.equal(DEFAULT_ARTIFACTS_DIRECTORY, 'artifacts/local');
  assert.equal(resolveArtifactsDirectory(repoRoot, {}), resolve(repoRoot, 'artifacts/local'));
  assert.equal(
    resolveArtifactPath(repoRoot, ['infra', 'runtime-configs.json'], {}),
    resolve(repoRoot, 'artifacts/local/infra/runtime-configs.json'),
  );
});

test('CI can redirect generated evidence outside the checkout', () => {
  const environment = { KNU_ARTIFACTS_DIR: '/runner/temp/knu-roommate-artifacts' };
  assert.equal(
    resolveArtifactPath(repoRoot, ['infra', 'inspection.json'], environment),
    '/runner/temp/knu-roommate-artifacts/infra/inspection.json',
  );
});
