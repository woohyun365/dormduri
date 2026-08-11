#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { inspectRepository } from './inspect-configs.mjs';

const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
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

const inventoryPath = resolve(repoRoot, 'infra/image-inventory.json');
if (!existsSync(inventoryPath)) {
  failures.push('image-inventory: infra/image-inventory.json is missing');
} else {
  const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));
  for (const image of inventory.images ?? []) {
    if (!/:[^@\s]+@sha256:[a-f0-9]{64}$/u.test(image.reference)) {
      failures.push(`image-inventory:${image.name}: reference is not immutable`);
      continue;
    }
    const ownerPath = resolve(repoRoot, image.ownerPath);
    if (!existsSync(ownerPath) || !readFileSync(ownerPath, 'utf8').includes(image.reference)) {
      failures.push(`image-inventory:${image.name}: owner projection is stale`);
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Production candidate infrastructure validation passed.');
