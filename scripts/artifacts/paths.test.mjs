import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  DEFAULT_ARTIFACTS_DIRECTORY,
  resolveArtifactPath,
  resolveArtifactsDirectory,
} from './paths.mjs';
import { loadWorkspaceLayout } from './workspace-layout.mjs';

const repoRoot = '/workspace/knu-roommate';

test('repository tools default to the tool output area of the local artifact directory', () => {
  assert.equal(DEFAULT_ARTIFACTS_DIRECTORY, '.artifacts/tools');
  assert.equal(resolveArtifactsDirectory(repoRoot, {}), resolve(repoRoot, '.artifacts/tools'));
  assert.equal(
    resolveArtifactPath(repoRoot, ['infra', 'runtime-configs.json'], {}),
    resolve(repoRoot, '.artifacts/tools/infra/runtime-configs.json'),
  );
});

test('CI can redirect generated evidence outside the checkout', () => {
  const environment = { KNU_ARTIFACTS_DIR: '/runner/temp/knu-roommate-artifacts' };
  assert.equal(
    resolveArtifactPath(repoRoot, ['infra', 'inspection.json'], environment),
    '/runner/temp/knu-roommate-artifacts/infra/inspection.json',
  );
});

test('an override inside the checkout must stay under an ignored workspace root', () => {
  for (const directory of [
    '.artifacts/tools/ci-run',
    '.artifacts/plans/x/y/out',
    '.local-docs/out',
  ])
    assert.equal(
      resolveArtifactPath(repoRoot, ['infra', 'a.json'], { KNU_ARTIFACTS_DIR: directory }),
      resolve(repoRoot, directory, 'infra/a.json'),
      directory,
    );
  assert.equal(
    resolveArtifactPath(repoRoot, ['infra'], { KNU_ARTIFACTS_DIR: '../outside' }),
    resolve(repoRoot, '../outside/infra'),
  );
  // A tracked path, the checkout root, a tracked exception inside an ignored root and the root itself.
  for (const directory of [
    'scripts/out',
    'docs',
    '.',
    `${repoRoot}/apps`,
    '.artifacts/README.md',
    '.artifacts',
  ])
    assert.throws(
      () => resolveArtifactPath(repoRoot, ['infra'], { KNU_ARTIFACTS_DIR: directory }),
      /KNU_ARTIFACTS_DIR must point outside the repository or under an ignored workspace root/u,
      directory,
    );
  // Ignored roots that are not override targets: a Markdown-only root and a root whose tracked files only
  // .gitignore lists.
  const excluded = loadWorkspaceLayout().roots.filter(
    (root) =>
      root.tracking === 'ignored' && (root.children === 'markdown-only' || root.trackedFilesOwner),
  );
  assert.deepEqual(excluded.map((root) => root.id).sort(), ['claude-local', 'plans']);
  for (const { path } of excluded)
    assert.throws(
      () => resolveArtifactPath(repoRoot, ['infra'], { KNU_ARTIFACTS_DIR: `${path}/out` }),
      /KNU_ARTIFACTS_DIR must point outside the repository or under an ignored workspace root/u,
      path,
    );
});

test('host runtime kinds keep their checkout location under an override', () => {
  const environment = { KNU_ARTIFACTS_DIR: '/runner/temp/knu-roommate-artifacts' };
  for (const kind of ['claude-native', 'claude-review-packets', 'codex-native'])
    assert.equal(
      resolveArtifactPath(repoRoot, [kind, 'record.json'], environment),
      resolve(repoRoot, '.artifacts/tools', kind, 'record.json'),
      kind,
    );
  assert.equal(
    resolveArtifactPath(repoRoot, ['stress', 'report.json'], environment),
    '/runner/temp/knu-roommate-artifacts/stress/report.json',
  );
});
