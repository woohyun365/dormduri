#!/usr/bin/env sh
set -eu

manifest_path="${API_ENV_MANIFEST_PATH:-./env.manifest.json}"
required_env=$(node - "$manifest_path" <<'NODE'
const { readFileSync } = require('node:fs');

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
if (secretSource !== 'env' && secretSource !== 'aws-secrets-manager') {
  console.error('invalid API secret source');
  process.exit(65);
}

const secretKeys = new Set(
  entries.filter((entry) => entry?.secret === true).map((entry) => entry.key),
);
const startupRequired =
  secretSource === 'aws-secrets-manager'
    ? required.filter((key) => !secretKeys.has(key)).concat('SECRET_NAME_PREFIX')
    : required;

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
