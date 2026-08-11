#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildComposeArgs, loadComposeInventory } from './compose-profile.mjs';

const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const inventory = loadComposeInventory(repoRoot);
const failures = [];

for (const profileName of Object.keys(inventory.profiles)) {
  const profile = inventory.profiles[profileName];
  const result = spawnSync(
    'docker',
    buildComposeArgs(inventory, profileName, ['config', '--quiet'], {
      repoRoot,
      envFile: profile.validationEnvFile,
    }),
    {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        API_IMAGE_TAG: process.env.API_IMAGE_TAG ?? 'validation-commit',
        API_RUNTIME_ENV_FILE: '../rehearsal/fixtures/empty.runtime-env',
        REHEARSAL_API_NETWORK: 'knu-roommate-validation-api',
        REHEARSAL_POSTGRES_PORT: '55432',
        REHEARSAL_DB_MIGRATION_PASSWORD: 'validation-migration-password',
        REHEARSAL_DB_RUNTIME_PASSWORD: 'validation-runtime-password',
        REHEARSAL_DB_RETENTION_PASSWORD: 'validation-retention-password',
        REHEARSAL_DB_DISCLOSURE_PASSWORD: 'validation-disclosure-password',
      },
    },
  );
  if (result.status !== 0) {
    failures.push(`${profileName}: ${(result.stderr || result.stdout).trim()}`);
  }
}

const productionBase = readFileSync(resolve(repoRoot, 'infra/deploy/compose.api.yml'), 'utf8');
if (/\bSTRESS_[A-Z0-9_]+\b|AUTH_THROTTLE_LIMIT/u.test(productionBase)) {
  failures.push('api-base: production candidate contains stress policy');
}

for (const [profileName, expectation] of Object.entries({
  'api-base': { stress: false, resources: false },
  'api-rehearsal': { stress: false, resources: true },
  'api-stress': { stress: true, resources: true },
  'api-stress-standalone': { stress: true, resources: false },
})) {
  const profile = inventory.profiles[profileName];
  const rendered = spawnSync(
    'docker',
    buildComposeArgs(inventory, profileName, ['config', '--format', 'json'], {
      repoRoot,
      envFile: profile.validationEnvFile,
    }),
    {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        API_IMAGE_TAG: process.env.API_IMAGE_TAG ?? 'validation-commit',
        API_RUNTIME_ENV_FILE: '../rehearsal/fixtures/empty.runtime-env',
        REHEARSAL_API_NETWORK: 'knu-roommate-validation-api',
        REHEARSAL_POSTGRES_PORT: '55432',
        REHEARSAL_DB_MIGRATION_PASSWORD: 'validation-migration-password',
        REHEARSAL_DB_RUNTIME_PASSWORD: 'validation-runtime-password',
        REHEARSAL_DB_RETENTION_PASSWORD: 'validation-retention-password',
        REHEARSAL_DB_DISCLOSURE_PASSWORD: 'validation-disclosure-password',
      },
    },
  );
  if (rendered.status !== 0) continue;
  const config = JSON.parse(rendered.stdout);
  const api = config.services?.api ?? {};
  const hasStressPolicy = Object.prototype.hasOwnProperty.call(
    api.environment ?? {},
    'AUTH_THROTTLE_LIMIT',
  );
  const hasResourceBudget = api.deploy?.resources?.limits?.memory === '1476395008';
  if (hasStressPolicy !== expectation.stress) {
    failures.push(`${profileName}: unexpected stress policy projection`);
  }
  if (hasResourceBudget !== expectation.resources) {
    failures.push(`${profileName}: unexpected resource budget projection`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Validated ${Object.keys(inventory.profiles).length} Compose profiles.`);
