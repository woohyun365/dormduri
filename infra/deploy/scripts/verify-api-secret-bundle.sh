#!/usr/bin/env sh
set -eu

contract_path="${API_SECRET_MOUNT_CONTRACT:-$(dirname "$0")/../api/secret-mount.contract.json}"
bundle_directory="${1:?bundle directory is required}"

node - "$contract_path" "$bundle_directory" <<'NODE'
const { lstatSync, readFileSync, readdirSync } = require('node:fs');
const { resolve } = require('node:path');

const [contractPath, bundleDirectory] = process.argv.slice(2);
const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
const expected = [...contract.requiredFiles].sort();
const actual = readdirSync(bundleDirectory).sort();
if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('secret bundle inventory mismatch');

for (const name of expected) {
  const path = resolve(bundleDirectory, name);
  const metadata = lstatSync(path);
  if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error('unsafe secret bundle file');
  if (metadata.size < 1 || metadata.size > contract.maximumFileBytes) {
    throw new Error('invalid secret bundle file size');
  }
  const mode = (metadata.mode & 0o777).toString(8).padStart(4, '0');
  if (!contract.allowedFileModes.includes(mode)) throw new Error('invalid secret bundle file mode');
  if (readFileSync(path, 'utf8').trim().length === 0) throw new Error('blank secret bundle file');
}
NODE

printf '%s\n' 'secret bundle verified'
