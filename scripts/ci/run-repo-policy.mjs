#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { discoverScriptTests } from './repo-policy-test-files.mjs';

const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const testFiles = discoverScriptTests(repoRoot);
const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  cwd: repoRoot,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
