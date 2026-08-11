#!/usr/bin/env sh
set -eu

manifest_path="${API_ENV_MANIFEST_PATH:-./env.manifest.json}"
required_env=$(node - "$manifest_path" <<'NODE'
const { readFileSync } = require('node:fs');

const manifestPath = process.argv[2];
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const required = manifest?.projections?.containerStartupRequired;
if (!Array.isArray(required) || required.some((key) => typeof key !== 'string')) {
  console.error('invalid API deployment env manifest');
  process.exit(65);
}
process.stdout.write(required.join(' '));
NODE
)

for name in $required_env; do
  if ! value="$(printenv "$name")" || [ -z "$value" ]; then
    echo "missing required env: $name" >&2
    exit 64
  fi
done

exec "$@"
