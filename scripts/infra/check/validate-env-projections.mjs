#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const readRepoFile = (path) => readFileSync(resolve(repoRoot, path), 'utf8');
const manifest = JSON.parse(readRepoFile('infra/deploy/api/env.manifest.json'));
const secretMountContract = JSON.parse(
  readRepoFile('infra/deploy/api/secret-mount.contract.json'),
);
const failures = [];

function parseEnvKeys(path) {
  return new Set(
    readRepoFile(path)
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => line.match(/^([A-Z][A-Z0-9_]*)=/u)?.[1])
      .filter(Boolean),
  );
}

function missing(left, right) {
  return [...left].filter((key) => !right.has(key)).sort();
}

function reportMissing(label, keys) {
  if (keys.length) failures.push(`${label}: ${keys.join(', ')}`);
}

function reportInventoryDrift(label, expected, actual) {
  reportMissing(`${label} missing`, missing(expected, actual));
  reportMissing(`${label} contains unknown`, missing(actual, expected));
}

const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
const entryByKey = new Map(entries.map((entry) => [entry.key, entry]));
const runtimeKeys = new Set(
  entries.filter((entry) => entry.scope === 'runtime').map((entry) => entry.key),
);
const migrationKeys = new Set(
  entries.filter((entry) => entry.scope === 'migration').map((entry) => entry.key),
);
const runtimeExampleKeys = parseEnvKeys('infra/deploy/.env.api.example');
const lightsailExampleKeys = parseEnvKeys('infra/deploy/.env.api.lightsail.example');
const migrationExampleKeys = parseEnvKeys('infra/deploy/.env.api.migration.example');
const startupRequired = new Set(manifest.projections?.containerStartupRequired ?? []);
const migrationRequired = new Set(manifest.projections?.migrationRequired ?? []);

if (manifest.version !== 1) failures.push('manifest version must be 1');
if (entryByKey.size !== entries.length) failures.push('manifest contains duplicate env keys');
reportMissing('runtime example missing startup keys', missing(startupRequired, runtimeExampleKeys));
const runtimeSecretKeys = new Set(
  entries
    .filter((entry) => entry.scope === 'runtime' && entry.secret === true)
    .map((entry) => entry.key),
);
const requiredRuntimeSecretKeys = new Set(
  entries
    .filter(
      (entry) =>
        entry.scope === 'runtime' &&
        entry.secret === true &&
        entry.requiredInProduction === true,
    )
    .map((entry) => entry.key),
);
const mountedFileEntries = Array.isArray(secretMountContract.requiredFiles)
  ? secretMountContract.requiredFiles
  : [];
const mountedFileKeys = new Set(mountedFileEntries);
if (secretMountContract.version !== 1) {
  failures.push('secret mount contract version must be 1');
}
if (!Array.isArray(secretMountContract.requiredFiles)) {
  failures.push('secret mount contract requiredFiles must be an array');
}
if (mountedFileKeys.size !== mountedFileEntries.length) {
  failures.push('secret mount contract contains duplicate required files');
}
if (JSON.stringify(mountedFileEntries) !== JSON.stringify([...mountedFileEntries].sort())) {
  failures.push('secret mount contract requiredFiles must be sorted');
}
reportInventoryDrift(
  'mounted-file inventory',
  requiredRuntimeSecretKeys,
  mountedFileKeys,
);
const lightsailRequired = new Set(
  [...startupRequired]
    .filter((key) => !runtimeSecretKeys.has(key))
    .concat('SECRET_MOUNT_DIRECTORY'),
);
reportMissing(
  'Lightsail example missing public startup keys',
  missing(lightsailRequired, lightsailExampleKeys),
);
const lightsailSecretKeys = [...lightsailExampleKeys].filter((key) => runtimeSecretKeys.has(key));
if (lightsailSecretKeys.length) {
  failures.push(`Lightsail example contains secret keys: ${lightsailSecretKeys.sort().join(', ')}`);
}
const lightsailExample = readRepoFile('infra/deploy/.env.api.lightsail.example');
if (!/^SECRET_SOURCE=mounted-files$/mu.test(lightsailExample)) {
  failures.push('Lightsail example must select mounted-files');
}
if (/AWS_(?:ACCESS_KEY_ID|SECRET_ACCESS_KEY)=/u.test(lightsailExample)) {
  failures.push('Lightsail example must not contain long-lived AWS access keys');
}
reportMissing(
  'migration example missing deploy keys',
  missing(migrationRequired, migrationExampleKeys),
);
reportMissing(
  'runtime example contains non-runtime keys',
  missing(runtimeExampleKeys, runtimeKeys),
);
reportMissing(
  'migration example contains non-migration keys',
  missing(migrationExampleKeys, migrationKeys),
);

const entrypoint = readRepoFile('infra/deploy/api/entrypoint.sh');
const apiDockerfile = readRepoFile('infra/deploy/api/Dockerfile');
const apiCompose = readRepoFile('infra/deploy/compose.api.yml');
if (!entrypoint.includes('containerStartupRequired') || !entrypoint.includes('env.manifest.json')) {
  failures.push('API entrypoint does not consume the generated runtime projection');
}
if (!apiDockerfile.includes('infra/deploy/api/env.manifest.json')) {
  failures.push('API image does not copy the generated env manifest');
}
if (!apiCompose.includes('API_RUNTIME_ENV_FILE')) {
  failures.push('API compose does not expose an explicit runtime env file projection');
}

const webDockerfile = readRepoFile('infra/deploy/web/Dockerfile');
if (!webDockerfile.includes('type=secret,id=sentry_auth_token')) {
  failures.push('Web build secret is not injected through BuildKit secret mount');
}
if (/^(?:ARG|ENV) SENTRY_AUTH_TOKEN/mu.test(webDockerfile)) {
  failures.push('Web build secret must not be persisted as ARG or ENV');
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(
  `Validated env projections: ${runtimeKeys.size} API runtime, ${migrationKeys.size} migration.`,
);
