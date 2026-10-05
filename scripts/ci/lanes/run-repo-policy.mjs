#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { selectTestFiles } from './repo-policy-test-files.mjs';

const repoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
let testFiles;
try {
  testFiles = selectTestFiles(repoRoot, process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exit(2);
}
const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  cwd: repoRoot,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
