#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const readRepoFile = (path) => readFileSync(resolve(repoRoot, path), 'utf8');
const manifest = JSON.parse(readRepoFile('infra/deploy/api/env.manifest.json'));
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

const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
const entryByKey = new Map(entries.map((entry) => [entry.key, entry]));
const runtimeKeys = new Set(
  entries.filter((entry) => entry.scope === 'runtime').map((entry) => entry.key),
);
const migrationKeys = new Set(
  entries.filter((entry) => entry.scope === 'migration').map((entry) => entry.key),
);
const runtimeExampleKeys = parseEnvKeys('infra/deploy/.env.api.example');
const migrationExampleKeys = parseEnvKeys('infra/deploy/.env.api.migration.example');
const startupRequired = new Set(manifest.projections?.containerStartupRequired ?? []);
const migrationRequired = new Set(manifest.projections?.migrationRequired ?? []);

if (manifest.version !== 1) failures.push('manifest version must be 1');
if (entryByKey.size !== entries.length) failures.push('manifest contains duplicate env keys');
reportMissing('runtime example missing startup keys', missing(startupRequired, runtimeExampleKeys));
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
