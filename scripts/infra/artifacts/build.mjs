#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveArtifactPath } from '../../artifacts/paths.mjs';
import { assertBuilderGcPolicy, expectedGcLimits } from './builder-gc.mjs';

const repoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const args = new Set(process.argv.slice(2));
const allowDirty = args.has('--allow-dirty');
const outputArg = process.argv.find((value) => value.startsWith('--output='));
const outputDir = outputArg
  ? resolve(repoRoot, outputArg.slice('--output='.length))
  : resolveArtifactPath(repoRoot, ['build']);
const builderName = 'dormduri-artifacts';
const buildkitdConfig = 'scripts/infra/artifacts/buildkitd.toml';

const release = capture('git', ['rev-parse', 'HEAD']);
const workingTreeDirty =
  capture('git', ['status', '--porcelain', '--untracked-files=no']).length > 0;
if (workingTreeDirty && !allowDirty) {
  fail('Working tree is dirty. Commit changes or use --allow-dirty for a local rehearsal.');
}

mkdirSync(outputDir, { recursive: true });
ensureBuilder();
const images = [
  { name: 'api', dockerfile: 'infra/deploy/api/Dockerfile' },
  { name: 'web', dockerfile: 'infra/deploy/web/Dockerfile' },
];
const manifestImages = [];

for (const image of images) {
  const tag = `dormduri-${image.name}:${release}`;
  const metadataPath = resolve(outputDir, `${image.name}.build-metadata.json`);
  const layoutPath = resolve(outputDir, `${image.name}.oci`);
  rmSync(layoutPath, { recursive: true, force: true });
  run('docker', [
    'buildx',
    'build',
    '--builder',
    builderName,
    '--output',
    `type=oci,dest=${layoutPath},tar=false`,
    '--provenance=mode=max',
    '--sbom=true',
    '--metadata-file',
    metadataPath,
    '--file',
    image.dockerfile,
    '--tag',
    tag,
    '.',
  ]);

  const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
  const digest = metadata['containerimage.digest'];
  if (!/^sha256:[a-f0-9]{64}$/u.test(digest ?? '')) {
    fail(`${image.name}: BuildKit did not return an immutable OCI digest.`);
  }
  const evidence = extractAttestations(layoutPath, image.name);
  const runtimeUser = extractRuntimeUser(layoutPath, image.name);
  const sbomPath = resolve(outputDir, `${image.name}.sbom.spdx.json`);
  const provenancePath = resolve(outputDir, `${image.name}.provenance.slsa.json`);
  writeFileSync(sbomPath, `${JSON.stringify(evidence.sbom, null, 2)}\n`);
  writeFileSync(provenancePath, `${JSON.stringify(evidence.provenance, null, 2)}\n`);

  manifestImages.push({
    name: image.name,
    tag,
    digest,
    dockerfile: image.dockerfile,
    runtimeUser,
    sbom: relativeEvidencePath(sbomPath),
    provenance: relativeEvidencePath(provenancePath),
  });
}

function extractRuntimeUser(layoutPath, imageName) {
  const readBlob = (digest) =>
    JSON.parse(
      readFileSync(resolve(layoutPath, 'blobs/sha256', digest.replace('sha256:', '')), 'utf8'),
    );
  const root = JSON.parse(readFileSync(resolve(layoutPath, 'index.json'), 'utf8'));
  const imageIndex = readBlob(root.manifests[0].digest);
  const imageDescriptor = imageIndex.manifests.find(
    (manifest) => manifest.annotations?.['vnd.docker.reference.type'] !== 'attestation-manifest',
  );
  if (!imageDescriptor) fail(`${imageName}: OCI image manifest is missing.`);
  const imageManifest = readBlob(imageDescriptor.digest);
  const imageConfig = readBlob(imageManifest.config.digest);
  const runtimeUser = imageConfig.config?.User;
  if (!runtimeUser || runtimeUser === '0' || runtimeUser === 'root') {
    fail(`${imageName}: runtime image must declare a non-root user.`);
  }
  return runtimeUser;
}

const manifestPath = resolve(outputDir, 'artifact-manifest.json');
writeFileSync(
  manifestPath,
  `${JSON.stringify(
    {
      version: 1,
      release,
      builtAt: new Date().toISOString(),
      workingTreeDirty,
      builder: capture('docker', ['buildx', 'version']),
      images: manifestImages,
    },
    null,
    2,
  )}\n`,
);
run(process.execPath, [
  resolve(repoRoot, 'scripts/infra/artifacts/verify-manifest.mjs'),
  manifestPath,
]);
console.log(`Local artifact evidence: ${manifestPath}`);

function extractAttestations(layoutPath, imageName) {
  const readBlob = (digest) =>
    JSON.parse(
      readFileSync(resolve(layoutPath, 'blobs/sha256', digest.replace('sha256:', '')), 'utf8'),
    );
  const root = JSON.parse(readFileSync(resolve(layoutPath, 'index.json'), 'utf8'));
  const imageIndex = readBlob(root.manifests[0].digest);
  const attestationDescriptor = imageIndex.manifests.find(
    (manifest) => manifest.annotations?.['vnd.docker.reference.type'] === 'attestation-manifest',
  );
  if (!attestationDescriptor) fail(`${imageName}: OCI attestation manifest is missing.`);
  const attestation = readBlob(attestationDescriptor.digest);
  const evidence = {};
  for (const layer of attestation.layers) {
    const predicateType = layer.annotations?.['in-toto.io/predicate-type'];
    const statement = readBlob(layer.digest);
    if (predicateType === 'https://spdx.dev/Document') evidence.sbom = statement;
    if (predicateType === 'https://slsa.dev/provenance/v1') evidence.provenance = statement;
  }
  if (!evidence.sbom || !evidence.provenance) {
    fail(`${imageName}: BuildKit SBOM or provenance attestation is missing.`);
  }
  return evidence;
}

function ensureBuilder() {
  if (!commandSucceeds('docker', ['buildx', 'inspect', builderName])) {
    run('docker', [
      'buildx',
      'create',
      '--name',
      builderName,
      '--driver',
      'docker-container',
      '--buildkitd-config',
      buildkitdConfig,
    ]);
  }
  run('docker', ['buildx', 'inspect', builderName, '--bootstrap']);
  try {
    assertBuilderGcPolicy(
      capture('docker', ['buildx', 'inspect', builderName]),
      expectedGcLimits(readFileSync(resolve(repoRoot, buildkitdConfig), 'utf8')),
    );
  } catch (error) {
    fail(
      `${error.message}\nThe builder was created without ${buildkitdConfig}, or its BuildKit version ignores those fields. Remove it with \`docker buildx rm ${builderName}\` and run this command again to recreate it.`,
    );
  }
}

function commandSucceeds(command, commandArgs) {
  return spawnSync(command, commandArgs, { cwd: repoRoot, stdio: 'ignore' }).status === 0;
}

function relativeEvidencePath(path) {
  return path.slice(repoRoot.length + 1);
}

function capture(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { cwd: repoRoot, encoding: 'utf8' });
  if (result.status !== 0) fail(`${command} failed: ${(result.stderr || result.stdout).trim()}`);
  return result.stdout.trim();
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { cwd: repoRoot, stdio: 'inherit' });
  if (result.status !== 0) fail(`${command} exited with ${result.status}`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
