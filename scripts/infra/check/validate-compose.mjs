#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildComposeArgs, loadComposeInventory } from '../compose/profile.mjs';
import { buildIngressComposeArgs, writeIngressConfig } from '../ingress/render.mjs';

const repoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const inventory = loadComposeInventory(repoRoot);
const failures = [];
const ingress = writeIngressConfig(
  {
    mode: 'fixture-http',
    apiAuthority: 'api.s1.test',
    webAuthority: 'web.s1.test',
    publicAddress: '172.30.247.2',
    privateAddress: '172.30.249.2',
    apiSourceAddress: '172.30.248.2',
    observerAddress: '172.30.250.2',
    apiAddress: '172.30.248.3',
    apiPort: 4000,
    webAddress: '172.30.249.3',
    webPort: 3000,
    webPeers: ['172.30.249.3'],
    nginxPeers: ['172.30.248.2'],
    collectorPeers: ['172.30.250.3'],
    networks: {
      public: '172.30.247.0/28',
      api: '172.30.248.0/28',
      web: '172.30.249.0/28',
      observer: '172.30.250.0/28',
    },
  },
  { repoRoot, outputName: 'compose-validation' },
);

for (const profileName of Object.keys(inventory.profiles)) {
  const profile = inventory.profiles[profileName];
  const result = spawnSync(
    'docker',
    profileName === 'ingress-trust'
      ? buildIngressComposeArgs(ingress.composeOverridePath, ['config', '--quiet'], { repoRoot })
      : buildComposeArgs(inventory, profileName, ['config', '--quiet'], {
          repoRoot,
          envFile: profile.validationEnvFile,
        }),
    {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        ...(profileName === 'ingress-trust' ? ingress.composeEnvironment : {}),
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

const ingressEnvironment = {
  ...process.env,
  ...ingress.composeEnvironment,
  API_IMAGE_TAG: 'validation-commit',
  API_RUNTIME_ENV_FILE: '../rehearsal/fixtures/empty.runtime-env',
};
const ingressConfig = spawnSync(
  'docker',
  buildIngressComposeArgs(ingress.composeOverridePath, ['config', '--format', 'json'], {
    repoRoot,
  }),
  {
    cwd: repoRoot,
    encoding: 'utf8',
    env: ingressEnvironment,
  },
);
if (ingressConfig.status === 0) {
  const config = JSON.parse(ingressConfig.stdout);
  for (const [service, network] of [
    ['api', 'ingress-api'],
    ['web', 'ingress-web'],
  ]) {
    if (
      Object.keys(config.services[service].networks).join(',') !== network ||
      config.services[service].ports?.length
    ) {
      failures.push(`ingress-trust: ${service} has an unintended network or published port`);
    }
  }
  const expectedNetworks = ['ingress-api', 'ingress-observer', 'ingress-public', 'ingress-web'];
  if (JSON.stringify(Object.keys(config.networks).sort()) !== JSON.stringify(expectedNetworks)) {
    failures.push('ingress-trust: unexpected network inventory');
  }
  for (const network of Object.values(config.networks)) {
    if (
      network.external ||
      network.internal ||
      network.ipam?.config?.length !== 1 ||
      !network.ipam.config[0].subnet
    ) {
      failures.push('ingress-trust: missing explicit IPAM or unintended external/internal network');
    }
  }
  if (
    JSON.stringify(Object.keys(config.services.nginx.networks).sort()) !==
      JSON.stringify(expectedNetworks) ||
    config.services.nginx.ports.length !== 1
  ) {
    failures.push(
      'ingress-trust: nginx must own exactly the four networks and one public published listener',
    );
  }
  if (
    config.services.api.environment.HTTP_TRUST_PROXY_CIDRS !== '172.30.248.2/32' ||
    config.services.web.environment.API_URL !== 'http://172.30.249.2:8081'
  ) {
    failures.push('ingress-trust: forwarded peer or private BFF URL differs from rendered input');
  }
} else failures.push(`ingress-trust render: ${ingressConfig.stderr}`);
const missingNetworkOverlay = spawnSync(
  'docker',
  buildComposeArgs(inventory, 'ingress-trust', ['config', '--quiet'], { repoRoot }),
  {
    cwd: repoRoot,
    encoding: 'utf8',
    env: ingressEnvironment,
  },
);
if (missingNetworkOverlay.status === 0)
  failures.push('ingress-trust: missing generated network overlay did not fail closed');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Validated ${Object.keys(inventory.profiles).length} Compose profiles.`);
