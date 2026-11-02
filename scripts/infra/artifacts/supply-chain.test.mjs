import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import {
  extractImageReferences,
  findUnlistedImages,
  listImageSurfaces,
  loadImageInventory,
  resolveImageReference,
} from './image-inventory.mjs';

const repoRoot = resolve(import.meta.dirname, '../../..');
const readRepoFile = (path) => readFileSync(resolve(repoRoot, path), 'utf8');
const digest = (character) => `sha256:${character.repeat(64)}`;

test('external images are listed by owner file and pinned there by exact tag and immutable digest', () => {
  const inventory = loadImageInventory(repoRoot);

  assert.equal(inventory.version, 2);
  assert.ok(inventory.images.length >= 9);
  for (const image of inventory.images) {
    assert.deepEqual(
      Object.keys(image).sort(),
      ['name', 'ownerPath', 'repository', 'updateOwner'],
      image.name,
    );
    assert.equal(image.updateOwner, 'renovate', image.name);
    assert.match(resolveImageReference(repoRoot, image), /:[^@\s]+@sha256:[a-f0-9]{64}$/u);
  }

  const surfaces = listImageSurfaces(repoRoot).map((path) => ({
    path,
    source: readRepoFile(path),
  }));
  assert.deepEqual(findUnlistedImages(inventory, surfaces), []);
  for (const image of inventory.images) {
    assert.ok(
      surfaces.some(({ path }) => path === image.ownerPath),
      `${image.name} owner is not a Renovate surface`,
    );
  }
});

test('image pin checks reject unlisted, digest-less and inconsistent references', () => {
  const nginx = `nginx:1.31.7-alpine@${digest('a')}`;
  const inventory = {
    images: [
      {
        name: 'api-ingress',
        ownerPath: 'compose.yml',
        repository: 'nginx',
        updateOwner: 'renovate',
      },
    ],
  };

  assert.deepEqual(
    findUnlistedImages(inventory, [{ path: 'compose.yml', source: `    image: ${nginx}\n` }]),
    [],
  );
  assert.deepEqual(
    findUnlistedImages(inventory, [
      { path: 'compose.yml', source: '    image: nginx:1.31.7-alpine\n' },
    ]),
    ['compose.yml: nginx:1.31.7-alpine is not <tag>@sha256:<digest>'],
  );
  assert.deepEqual(
    findUnlistedImages(inventory, [
      { path: 'compose.yml', source: `    image: ${nginx}\n    image: redis:8.2@${digest('b')}\n` },
    ]),
    ['compose.yml: redis is not in the inventory'],
  );
  assert.deepEqual(
    findUnlistedImages(inventory, [
      { path: 'infra/other/compose.yml', source: `    image: ${nginx}\n` },
    ]),
    ['infra/other/compose.yml: nginx is not in the inventory'],
  );

  assert.deepEqual(
    extractImageReferences(
      'infra/deploy/api/Dockerfile',
      [
        `# syntax=docker/dockerfile:1.7@${digest('c')}`,
        `ARG NODE_IMAGE=node:24.19.0-bookworm-slim@${digest('d')}`,
        'FROM ${NODE_IMAGE} AS base',
        'FROM base AS build',
      ].join('\n'),
    ),
    [`docker/dockerfile:1.7@${digest('c')}`, `node:24.19.0-bookworm-slim@${digest('d')}`],
  );
  assert.deepEqual(
    extractImageReferences(
      'compose.web.fixture.yml',
      [
        `    image: \${WEB_UPSTREAM_IMAGE:-node:24.19.0-alpine@${digest('e')}}`,
        '    image: dormduri-web:${WEB_IMAGE_TAG:-local-rehearsal}',
        '    image: ${INGRESS_FIXTURE_IMAGE:?build the fixture first}',
      ].join('\n'),
    ),
    [`node:24.19.0-alpine@${digest('e')}`],
  );

  const directory = mkdtempSync(join(tmpdir(), 'image-inventory-'));
  try {
    const image = { name: 'postgres-ci', ownerPath: 'ci.yml', repository: 'postgres' };
    writeFileSync(
      join(directory, 'ci.yml'),
      `    image: postgres:18.6-alpine@${digest('f')}\n    image: postgres:18.7-alpine@${digest('f')}\n`,
    );
    assert.throws(() => resolveImageReference(directory, image), /2 distinct postgres references/u);
    writeFileSync(join(directory, 'ci.yml'), '    image: postgres:18.6-alpine\n');
    assert.throws(() => resolveImageReference(directory, image), /without <tag>@sha256:<digest>/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('production and observability runtime candidates have a documented hardening matrix', () => {
  const matrixPath = resolve(repoRoot, 'infra/runtime-hardening.json');
  assert.equal(existsSync(matrixPath), true);
  const matrix = JSON.parse(readFileSync(matrixPath, 'utf8'));
  const services = new Map(matrix.services.map((service) => [service.name, service]));

  for (const name of ['api', 'nginx', 'prometheus', 'loki', 'alloy', 'alertmanager', 'grafana']) {
    const service = services.get(name);
    assert.ok(service, name);
    assert.equal(typeof service.nonRootOrDropPrivileges, 'string');
    assert.equal(typeof service.readOnlyRootFilesystem, 'boolean');
    assert.ok(Array.isArray(service.writablePaths));
  }

  for (const path of ['infra/deploy/compose.api.yml', 'infra/observability/compose.base.yml']) {
    const compose = readRepoFile(path);
    assert.match(compose, /no-new-privileges:true/u);
    assert.match(compose, /cap_drop:\s*\n\s*- ALL/u);
    assert.match(compose, /pids_limit:/u);
    assert.match(compose, /stop_grace_period:/u);
  }
});

test('GitHub Actions and image update ownership are explicit', () => {
  const workflowPaths = listImageSurfaces(repoRoot).filter((path) =>
    path.startsWith('.github/workflows/'),
  );
  assert.ok(workflowPaths.includes('.github/workflows/ci.yml'));

  for (const path of workflowPaths) {
    const uses = [
      ...readRepoFile(path).matchAll(/^\s*(?:-\s+)?uses:\s*([^\s#]+)(?:\s+#\s+(.+))?$/gmu),
    ];
    assert.ok(uses.length > 0, path);
    for (const [, reference, versionComment] of uses) {
      if (reference.startsWith('./')) continue;
      assert.match(reference, /@[a-f0-9]{40}$/u, path);
      assert.ok(versionComment?.trim().startsWith('v'), `${path} ${reference}`);
    }
  }

  const renovate = JSON.parse(readRepoFile('renovate.json'));
  for (const manager of ['github-actions', 'dockerfile', 'docker-compose']) {
    assert.ok(renovate.enabledManagers.includes(manager), manager);
  }
  assert.equal(existsSync(resolve(repoRoot, '.github/dependabot.yml')), false);
  assert.equal(existsSync(resolve(repoRoot, '.github/dependabot.yaml')), false);
});

test('active local, CI and rehearsal surfaces share one PostgreSQL tag and digest', () => {
  const inventory = loadImageInventory(repoRoot);
  const postgresImages = inventory.images.filter(({ name }) => name.startsWith('postgres-'));
  const references = new Set(postgresImages.map((image) => resolveImageReference(repoRoot, image)));

  assert.equal(postgresImages.length, 3);
  assert.ok(postgresImages.every(({ repository }) => repository === 'postgres'));
  assert.equal(references.size, 1);

  const [postgresReference] = references;
  const [, major] = /^postgres:(\d+)\./u.exec(postgresReference);
  const fullStack = readRepoFile('scripts/infra/rehearsal/full-stack/index.mjs');
  assert.match(fullStack, /resolveImageReference\(/u);
  assert.doesNotMatch(fullStack, /postgres:\d/u);
  assert.match(
    readRepoFile('infra/db/restore-drill-smoke.sh'),
    new RegExp(`EXPECTED_POSTGRES_MAJOR:-${major}\\b`, 'u'),
  );
});

test('local artifact contract has a schema, builder and verifier', () => {
  for (const path of [
    '.artifacts/.gitignore',
    '.artifacts/README.md',
    'infra/artifacts/artifact-manifest.schema.json',
    'infra/artifacts/README.md',
    'scripts/infra/artifacts/build.mjs',
    'scripts/infra/artifacts/verify-manifest.mjs',
  ]) {
    assert.equal(existsSync(resolve(repoRoot, path)), true, path);
  }

  const builder = readRepoFile('scripts/infra/artifacts/build.mjs');
  const artifactPaths = readRepoFile('scripts/artifacts/paths.mjs');
  assert.match(builder, /--provenance=mode=max/u);
  assert.match(builder, /--sbom=true/u);
  assert.match(builder, /--output[\s\S]*type=oci/u);
  assert.match(builder, /extractAttestations/u);
  assert.match(builder, /workingTreeDirty/u);
  assert.match(builder, /resolveArtifactPath\(repoRoot, \['build'\]\)/u);
  assert.doesNotMatch(builder, /\.omx\//u);
  assert.doesNotMatch(builder, /SENTRY_AUTH_TOKEN=|DATABASE_URL=/u);

  const verifier = readRepoFile('scripts/infra/artifacts/verify-manifest.mjs');
  assert.match(
    verifier,
    /resolveArtifactPath\(repoRoot, \['build', 'artifact-manifest\.json'\]\)/u,
  );
  assert.doesNotMatch(verifier, /\.omx\//u);
  assert.match(artifactPaths, /DEFAULT_ARTIFACTS_DIRECTORY = '\.artifacts\/tools'/u);
});
