#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveArtifactPath } from '../../artifacts/paths.mjs';
import { loadImageInventory, resolveImageReference } from '../artifacts/image-inventory.mjs';
import { buildComposeArgs, loadComposeInventory } from '../compose/profile.mjs';
import {
  apiEnvironmentFromExamples,
  checkUserHostBundleCompose,
  checkUserHostCompose,
  fragmentTextProblems,
  rehearsalDifferenceProblems,
  transitSubnetProblems,
  USER_HOST_RENDER_ENVIRONMENT,
} from '../user-host/compose-contract.mjs';

const repoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const inventory = loadComposeInventory(repoRoot);
const failures = [];
// The Web stage host compose takes registry digest references that the deploy document sets; validation uses
// well-formed placeholders and a local test directory for the rehearsal overlay.
const userHostEnvironment = {
  ...USER_HOST_RENDER_ENVIRONMENT,
  USER_HOST_REHEARSAL_ROOT: resolveArtifactPath(repoRoot, [
    'infra',
    'user-host-rehearsal-validation',
  ]),
};
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
        ...(profileName.startsWith('user-host') ? userHostEnvironment : {}),
        API_IMAGE_TAG: process.env.API_IMAGE_TAG ?? 'validation-commit',
        API_RUNTIME_ENV_FILE: '../rehearsal/fixtures/empty.runtime-env',
        REHEARSAL_API_NETWORK: 'dormduri-validation-api',
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
        REHEARSAL_API_NETWORK: 'dormduri-validation-api',
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

// The bundle render enables the migrate profile so the one-off service is checked too.
function renderUserHost(profileName, profiles = []) {
  const result = spawnSync(
    'docker',
    buildComposeArgs(
      inventory,
      profileName,
      [...profiles.flatMap((name) => ['--profile', name]), 'config', '--format', 'json'],
      { repoRoot },
    ),
    { cwd: repoRoot, encoding: 'utf8', env: { ...process.env, ...userHostEnvironment } },
  );
  if (result.status === 0) return JSON.parse(result.stdout);
  failures.push(`${profileName} render: ${result.stderr}`);
  return null;
}
const userHost = renderUserHost('user-host');
const userHostBundle = renderUserHost('user-host-bundle', ['migrate']);
const userHostRehearsal = renderUserHost('user-host-rehearsal');
if (userHost) {
  for (const problem of checkUserHostCompose(userHost)) failures.push(`user-host: ${problem}`);
}
if (userHostBundle) {
  // 관측 image는 local 관측 compose(infra/observability/compose.base.yml)와 같은 pin이다(image inventory owner).
  const images = loadImageInventory(repoRoot).images;
  const pins = Object.fromEntries(
    ['prometheus', 'loki', 'alloy', 'alertmanager', 'grafana'].map((name) => [
      name,
      resolveImageReference(
        repoRoot,
        images.find((image) => image.name === name),
      ),
    ]),
  );
  for (const problem of checkUserHostBundleCompose(
    userHostBundle,
    apiEnvironmentFromExamples(repoRoot),
    pins,
  )) {
    failures.push(`user-host-bundle: ${problem}`);
  }
}
for (const problem of transitSubnetProblems(
  readFileSync(resolve(repoRoot, 'infra/deploy/user/ssm/lib.sh'), 'utf8'),
)) {
  failures.push(`user-host transit: ${problem}`);
}
for (const problem of fragmentTextProblems({
  web: readFileSync(resolve(repoRoot, 'infra/deploy/user/compose.yml'), 'utf8'),
  api: readFileSync(resolve(repoRoot, 'infra/deploy/user/api/compose.yml'), 'utf8'),
})) {
  failures.push(`user-host fragments: ${problem}`);
}
if (userHost && userHostRehearsal) {
  for (const problem of rehearsalDifferenceProblems(userHost, userHostRehearsal)) {
    failures.push(`user-host-rehearsal: ${problem}`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Validated ${Object.keys(inventory.profiles).length} Compose profiles.`);
