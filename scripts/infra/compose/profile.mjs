#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateProductionObservabilityEnvironmentFile } from '../../observability/production/environment.mjs';

const defaultRepoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));

export function loadComposeInventory(repoRoot = defaultRepoRoot) {
  return JSON.parse(readFileSync(resolve(repoRoot, 'infra/compose-profiles.json'), 'utf8'));
}

export function getComposeProfile(inventory, profileName) {
  const profile = inventory.profiles?.[profileName];
  if (!profile) {
    throw new Error(
      `Unknown compose profile: ${profileName}. Available: ${Object.keys(inventory.profiles ?? {}).join(', ')}`,
    );
  }
  return profile;
}

export function buildComposeArgs(
  inventory,
  profileName,
  composeArgs = ['config'],
  { repoRoot = defaultRepoRoot, envFile, projectName, extraFiles = [] } = {},
) {
  const profile = getComposeProfile(inventory, profileName);
  const selectedEnvFile = envFile === false ? undefined : (envFile ?? profile.envFile);
  return [
    'compose',
    '-p',
    projectName ?? profile.project,
    ...(selectedEnvFile
      ? ['--env-file', relative(repoRoot, resolve(repoRoot, selectedEnvFile))]
      : []),
    // extraFiles: a runner's own overlay (for example local resource labels) after the profile files.
    ...[...profile.files, ...extraFiles].flatMap((file) => [
      '-f',
      relative(repoRoot, resolve(repoRoot, file)),
    ]),
    ...composeArgs,
  ];
}

export function runComposeProfile({
  profileName,
  composeArgs,
  repoRoot = defaultRepoRoot,
  envFile,
  env = process.env,
}) {
  const inventory = loadComposeInventory(repoRoot);
  const profile = getComposeProfile(inventory, profileName);
  const operation = composeArgs[0] ?? 'config';
  const managedNetworks = resolveManagedNetworks(profile, env);

  if (
    profile.preflight === 'observability-production' &&
    ['config', 'create', 'restart', 'start', 'up'].includes(operation)
  ) {
    validateProductionObservabilityEnvironmentFile(resolve(repoRoot, envFile ?? profile.envFile), {
      processEnvironment: env,
    });
  }

  if (operation === 'up') {
    ensureProfileNetworks(profile, { repoRoot, env });
  }

  const result = spawnSync(
    'docker',
    buildComposeArgs(inventory, profileName, composeArgs, { repoRoot, envFile }),
    { cwd: repoRoot, env, stdio: 'inherit' },
  );

  if (operation === 'down' && result.status === 0) {
    cleanupUnusedNetworks(managedNetworks, { repoRoot, env });
  }

  return result.status ?? 1;
}

export function resolveManagedNetworks(profile, env = process.env) {
  return (profile.managedNetworks ?? []).map((network) => env[network.env] || network.default);
}

export function parseComposeProfileCliArgs(argv) {
  const normalized = argv[0] === '--' ? argv.slice(1) : argv;
  const [profileName, ...composeArgs] = normalized;
  return { profileName, composeArgs };
}

export function ensureProfileNetworks(
  profile,
  { repoRoot = defaultRepoRoot, env = process.env } = {},
) {
  return resolveManagedNetworks(profile, env).filter((network) =>
    ensureNetwork(network, { repoRoot, env }),
  );
}

export function cleanupUnusedNetworks(
  networks,
  { repoRoot = defaultRepoRoot, env = process.env } = {},
) {
  for (const network of networks) removeUnusedNetwork(network, { repoRoot, env });
}

function ensureNetwork(network, { repoRoot, env }) {
  const inspected = spawnSync('docker', ['network', 'inspect', network], {
    cwd: repoRoot,
    env,
    stdio: 'ignore',
  });
  if (inspected.status === 0) return false;
  const created = spawnSync('docker', ['network', 'create', network], {
    cwd: repoRoot,
    env,
    stdio: 'inherit',
  });
  if (created.status !== 0) throw new Error(`Failed to create Docker network: ${network}`);
  return true;
}

function removeUnusedNetwork(network, { repoRoot, env }) {
  const inspected = spawnSync(
    'docker',
    ['network', 'inspect', '--format', '{{len .Containers}}', network],
    { cwd: repoRoot, env, encoding: 'utf8' },
  );
  if (inspected.status !== 0 || inspected.stdout.trim() !== '0') return;
  spawnSync('docker', ['network', 'rm', network], { cwd: repoRoot, env, stdio: 'inherit' });
}

function isDirectExecution() {
  return process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isDirectExecution()) {
  const { profileName, composeArgs } = parseComposeProfileCliArgs(process.argv.slice(2));
  if (!profileName) {
    console.error('Usage: node scripts/infra/compose/profile.mjs <profile> <compose arguments...>');
    process.exit(64);
  }
  process.exit(
    runComposeProfile({ profileName, composeArgs: composeArgs.length ? composeArgs : ['config'] }),
  );
}
