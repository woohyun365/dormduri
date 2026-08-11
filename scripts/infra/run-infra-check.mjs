#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const selectedMode = process.argv[2];
if (selectedMode && !['--static', '--runtime'].includes(selectedMode)) {
  fail(`Unsupported infrastructure check mode: ${selectedMode}`);
}

if (selectedMode !== '--runtime') {
  const testFiles = ['infra', 'observability'].flatMap((directory) =>
    readdirSync(resolve(repoRoot, `scripts/${directory}`))
      .filter((fileName) => fileName.endsWith('.test.mjs'))
      .sort()
      .map((fileName) => `scripts/${directory}/${fileName}`),
  );
  run(process.execPath, ['--test', ...testFiles]);
  run(process.execPath, ['scripts/infra/validate-configs.mjs']);
  run('pnpm', ['infra:env:check']);
  run(process.execPath, ['scripts/infra/validate-shell-and-db-scripts.mjs']);
  run(process.execPath, ['scripts/infra/validate-production-candidates.mjs']);
  run(process.execPath, ['scripts/observability/validate-production-stack.mjs']);
}

if (selectedMode !== '--static') {
  run(process.execPath, ['scripts/infra/validate-runtime-configs.mjs']);
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: 'inherit' });
  if (result.status !== 0) fail(`${command} ${args.join(' ')} exited with ${result.status}`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
