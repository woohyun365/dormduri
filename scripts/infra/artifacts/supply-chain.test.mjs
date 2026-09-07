import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '../../..');
const readRepoFile = (path) => readFileSync(resolve(repoRoot, path), 'utf8');

test('external runtime images use approved exact tags and immutable digests', () => {
  const inventoryPath = resolve(repoRoot, 'infra/image-inventory.json');
  assert.equal(existsSync(inventoryPath), true);
  const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));

  assert.equal(inventory.version, 1);
  assert.ok(inventory.images.length >= 9);
  for (const image of inventory.images) {
    assert.match(image.reference, /:[^@\s]+@sha256:[a-f0-9]{64}$/u);
    assert.equal(readRepoFile(image.ownerPath).includes(image.reference), true, image.name);
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
  const workflowSources = [
    '.github/workflows/ci.yml',
    '.github/workflows/api-ci.yml',
    '.github/workflows/web-ci.yml',
    '.github/workflows/infra-ci.yml',
    '.github/workflows/api-restore-drill-manual.yml',
  ].map(readRepoFile);

  for (const source of workflowSources) {
    const uses = [...source.matchAll(/^\s*uses:\s*([^\s#]+)(?:\s+#\s+(.+))?$/gmu)];
    for (const [, reference, versionComment] of uses) {
      if (reference.startsWith('./')) continue;
      assert.match(reference, /@[a-f0-9]{40}$/u);
      assert.ok(versionComment?.trim().startsWith('v'));
    }
  }

  const dependabot = readRepoFile('.github/dependabot.yml');
  for (const ecosystem of ['github-actions', 'docker', 'docker-compose']) {
    assert.ok(dependabot.includes(`package-ecosystem: '${ecosystem}'`));
  }
  assert.match(dependabot, /interval:\s*'weekly'/u);
});

test('active local, CI and rehearsal surfaces share one PostgreSQL patch and digest', () => {
  const inventory = JSON.parse(readRepoFile('infra/image-inventory.json'));
  const postgresImages = inventory.images.filter(({ name }) => name.startsWith('postgres-'));
  const references = new Set(postgresImages.map(({ reference }) => reference));

  assert.equal(inventory.applicationVersions.postgresql, '18.6');
  assert.equal(inventory.applicationVersions.prisma, '7.10.0');
  assert.equal(inventory.applicationVersions.prismaAdapterPg, '7.10.0');
  assert.equal(inventory.applicationVersions.pg, '8.23.0');
  assert.equal(postgresImages.length, 3);
  assert.deepEqual(
    [...references],
    [
      'postgres:18.6-alpine@sha256:d3e1620b530c944afa6e887d22eb899824da68e19c52024bf98f5220c88a65b2',
    ],
  );

  const [postgresReference] = references;
  for (const image of postgresImages) {
    assert.ok(readRepoFile(image.ownerPath).includes(postgresReference), image.name);
  }
  assert.ok(
    readRepoFile('scripts/infra/rehearsal/full-stack/index.mjs').includes(postgresReference),
  );
  assert.match(readRepoFile('infra/db/restore-drill-smoke.sh'), /EXPECTED_POSTGRES_MAJOR:-18/u);
});

test('local artifact contract has a schema, builder and verifier', () => {
  for (const path of [
    'artifacts/.gitignore',
    'artifacts/README.md',
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
  assert.match(artifactPaths, /DEFAULT_ARTIFACTS_DIRECTORY = 'artifacts\/local'/u);
});
