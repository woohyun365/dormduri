#!/usr/bin/env sh
set -eu
umask 077

contract_path="${API_SECRET_MOUNT_CONTRACT:-$(dirname "$0")/../api/secret-mount.contract.json}"
source_directory="${1:?source fixture directory is required}"
output_directory="${2:?candidate output directory is required}"

if [ -e "$output_directory" ]; then
  echo 'candidate output already exists' >&2
  exit 65
fi

temporary_directory="${output_directory}.tmp.$$"
trap 'rm -rf "$temporary_directory"' EXIT HUP INT TERM
mkdir -p "$temporary_directory"

node - "$contract_path" "$source_directory" "$temporary_directory" <<'NODE'
const { copyFileSync, lstatSync, mkdirSync, readFileSync } = require('node:fs');
const { join, resolve } = require('node:path');

const [contractPath, sourceDirectory, outputDirectory] = process.argv.slice(2);
const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
if (!Array.isArray(contract.requiredFiles) || !Number.isInteger(contract.maximumFileBytes)) {
  throw new Error('invalid secret mount contract');
}

mkdirSync(outputDirectory, { recursive: true, mode: 0o700 });
for (const name of contract.requiredFiles) {
  if (!/^[A-Z][A-Z0-9_]*$/u.test(name)) throw new Error('invalid secret file name');
  const sourcePath = resolve(sourceDirectory, name);
  if (!sourcePath.startsWith(`${resolve(sourceDirectory)}/`)) throw new Error('invalid source path');
  const metadata = lstatSync(sourcePath);
  if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error('unsafe secret source file');
  if (metadata.size < 1 || metadata.size > contract.maximumFileBytes) {
    throw new Error('invalid secret source file size');
  }
  const destinationPath = join(outputDirectory, name);
  copyFileSync(sourcePath, destinationPath);
  require('node:fs').chmodSync(destinationPath, 0o400);
}
NODE

mv "$temporary_directory" "$output_directory"
trap - EXIT HUP INT TERM
printf '%s\n' 'secret candidate materialized'
