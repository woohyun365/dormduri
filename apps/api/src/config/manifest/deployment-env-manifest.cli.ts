import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  createApiDeploymentEnvManifest,
  serializeApiDeploymentEnvManifest,
} from './deployment-env-manifest.js';

const repoRoot = resolve(import.meta.dirname, '../../../../..');
const outputPath = resolve(repoRoot, 'infra/deploy/api/env.manifest.json');
const expected = serializeApiDeploymentEnvManifest(createApiDeploymentEnvManifest());
const checkOnly = process.argv.includes('--check');

if (checkOnly) {
  const actual = existsSync(outputPath) ? readFileSync(outputPath, 'utf8') : null;
  if (actual !== expected) {
    console.error('API deployment env manifest is stale. Run pnpm infra:env:generate.');
    process.exit(1);
  }
  console.log('API deployment env manifest is fresh.');
} else {
  writeFileSync(outputPath, expected);
  console.log('Generated infra/deploy/api/env.manifest.json.');
}
