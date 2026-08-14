#!/usr/bin/env sh
set -eu

manifest_path="${API_ENV_MANIFEST_PATH:-./env.manifest.json}"
required_env=$(node - "$manifest_path" <<'NODE'
const { accessSync, constants, lstatSync, readFileSync } = require('node:fs');
const { isAbsolute, join } = require('node:path');

const manifestPath = process.argv[2];
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const required = manifest?.projections?.containerStartupRequired;
const entries = manifest?.entries;
if (
  !Array.isArray(required) ||
  required.some((key) => typeof key !== 'string') ||
  !Array.isArray(entries)
) {
  console.error('invalid API deployment env manifest');
  process.exit(65);
}

const secretSource = (process.env.SECRET_SOURCE || 'env').trim();
if (
  secretSource !== 'env' &&
  secretSource !== 'mounted-files' &&
  secretSource !== 'aws-secrets-manager'
) {
  console.error('invalid API secret source');
  process.exit(65);
}

const secretKeys = new Set(
  entries
    .filter((entry) => entry?.secret === true && required.includes(entry.key))
    .map((entry) => entry.key),
);
let startupRequired = required;
if (secretSource === 'aws-secrets-manager') {
  startupRequired = required.filter((key) => !secretKeys.has(key)).concat('SECRET_NAME_PREFIX');
}
if (secretSource === 'mounted-files') {
  startupRequired = required.filter((key) => !secretKeys.has(key)).concat('SECRET_MOUNT_DIRECTORY');
  const mountDirectory = (process.env.SECRET_MOUNT_DIRECTORY || '').trim();
  if (!isAbsolute(mountDirectory)) {
    console.error('invalid API secret mount');
    process.exit(65);
  }
  try {
    for (const key of secretKeys) {
      const metadata = lstatSync(join(mountDirectory, key));
      if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error('unsafe file');
      accessSync(join(mountDirectory, key), constants.R_OK);
    }
  } catch {
    console.error('invalid API secret mount');
    process.exit(66);
  }
}

process.stdout.write([...new Set(startupRequired)].join(' '));
NODE
)

for name in $required_env; do
  if ! value="$(printenv "$name")" || [ -z "$value" ]; then
    echo "missing required env: $name" >&2
    exit 64
  fi
done

exec "$@"
