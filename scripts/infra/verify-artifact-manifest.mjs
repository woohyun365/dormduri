#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveArtifactPath } from '../artifacts/paths.mjs';

const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const defaultPath = resolveArtifactPath(repoRoot, ['build', 'artifact-manifest.json']);
const manifestPath = resolve(process.argv[2] ?? defaultPath);
if (!existsSync(manifestPath)) fail(`Artifact manifest not found: ${manifestPath}`);

const source = readFileSync(manifestPath, 'utf8');
const forbidden = [
  /postgres(?:ql)?:\/\/[^\s"']+:[^\s"']+@/iu,
  /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/iu,
  /(?:token|password|secret)\s*[=:]\s*["'][^"']+["']/iu,
];
for (const pattern of forbidden) {
  if (pattern.test(source))
    fail(`Artifact manifest contains forbidden secret-like material: ${pattern}`);
}

const manifest = JSON.parse(source);
if (manifest.version !== 1) fail('Unsupported artifact manifest version.');
if (!/^[a-f0-9]{40}$/u.test(manifest.release)) fail('release must be a full Git commit SHA.');
if (typeof manifest.workingTreeDirty !== 'boolean') fail('workingTreeDirty must be explicit.');
if (!Number.isFinite(Date.parse(manifest.builtAt))) fail('builtAt must be an ISO timestamp.');
if (!Array.isArray(manifest.images) || manifest.images.length !== 2)
  fail('api and web images are required.');

const names = new Set();
for (const image of manifest.images) {
  names.add(image.name);
  if (!/^sha256:[a-f0-9]{64}$/u.test(image.digest)) fail(`${image.name}: invalid digest`);
  if (!image.tag.endsWith(`:${manifest.release}`)) fail(`${image.name}: tag must use release SHA`);
  if (!image.runtimeUser || ['0', 'root'].includes(image.runtimeUser)) {
    fail(`${image.name}: runtimeUser must be explicitly non-root`);
  }
  for (const evidence of [image.sbom, image.provenance]) {
    if (isAbsolute(evidence) || evidence.includes('..'))
      fail(`${image.name}: unsafe evidence path`);
    const evidencePath = resolve(repoRoot, evidence);
    if (!existsSync(evidencePath)) fail(`${image.name}: evidence not found: ${evidence}`);
    const evidenceSource = readFileSync(evidencePath, 'utf8');
    for (const pattern of forbidden) {
      if (pattern.test(evidenceSource))
        fail(`${image.name}: evidence contains secret-like material`);
    }
  }
}
if (!names.has('api') || !names.has('web')) fail('api and web images are required.');
console.log(`Verified local artifact manifest: ${manifestPath}`);

function fail(message) {
  console.error(message);
  process.exit(1);
}
