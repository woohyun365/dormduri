#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { discoverScriptTests } from '../../ci/lanes/repo-policy-test-files.mjs';

const repoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const selectedMode = process.argv[2];
if (selectedMode && !['--static', '--runtime'].includes(selectedMode)) {
  fail(`Unsupported infrastructure check mode: ${selectedMode}`);
}

if (selectedMode !== '--runtime') {
  const testFiles = discoverScriptTests(repoRoot, ['scripts/infra', 'scripts/observability']);
  run(process.execPath, ['--test', ...testFiles]);
  run(process.execPath, ['scripts/infra/check/validate-compose.mjs']);
  run('pnpm', ['infra:env:check']);
  run(process.execPath, ['scripts/infra/check/validate-shell-db.mjs']);
  run(process.execPath, ['scripts/infra/check/validate-production-candidates.mjs']);
  run(process.execPath, ['scripts/observability/production/validate-stack.mjs']);
}

if (selectedMode !== '--static') {
  run(process.execPath, ['scripts/infra/check/validate-runtime-configs.mjs']);
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: 'inherit' });
  if (result.status !== 0) fail(`${command} ${args.join(' ')} exited with ${result.status}`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
