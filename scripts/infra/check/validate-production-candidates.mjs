#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  findUnlistedImages,
  IMAGE_INVENTORY_PATH,
  listImageSurfaces,
  loadImageInventory,
  resolveImageReference,
} from '../artifacts/image-inventory.mjs';
import { inspectRepository } from './inspect.mjs';

const repoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const report = inspectRepository(repoRoot);
const failures = report.findings.map(
  (finding) => `${finding.path}:${finding.line} [${finding.ruleId}] ${finding.category}`,
);

for (const drift of [
  'runtimeRequiredMissingFromExample',
  'migrationRequiredMissingFromExample',
  'runtimeExampleOutsideManifest',
  'migrationExampleOutsideManifest',
]) {
  if (report.envDrift[drift].length) {
    failures.push(`env-drift:${drift}: ${report.envDrift[drift].join(', ')}`);
  }
}

const inventoryPath = resolve(repoRoot, IMAGE_INVENTORY_PATH);
if (!existsSync(inventoryPath)) {
  failures.push(`image-inventory: ${IMAGE_INVENTORY_PATH} is missing`);
} else {
  const inventory = loadImageInventory(repoRoot);
  for (const image of inventory.images ?? []) {
    if (!existsSync(resolve(repoRoot, image.ownerPath))) {
      failures.push(`image-inventory:${image.name}: owner file is missing`);
      continue;
    }
    try {
      resolveImageReference(repoRoot, image);
    } catch (error) {
      failures.push(`image-inventory:${error.message}`);
    }
  }
  const surfaces = listImageSurfaces(repoRoot).map((path) => ({
    path,
    source: readFileSync(resolve(repoRoot, path), 'utf8'),
  }));
  for (const problem of findUnlistedImages(inventory, surfaces)) {
    failures.push(`image-inventory:${problem}`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Production candidate infrastructure validation passed.');
