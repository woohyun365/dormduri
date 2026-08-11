#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const infraRoot = resolve(repoRoot, 'infra');
const shellScripts = collectShellScripts(infraRoot).sort();

for (const script of shellScripts) {
  run('sh', ['-n', script]);
}

const sentinel = 'infra-ci-secret-sentinel';
const migrationUrl = `postgresql://infra_ci:${sentinel}@db.invalid:5432/knu_roommate`;
const dryRuns = [
  {
    path: 'infra/db/migrate-deploy.sh',
    env: { MIGRATION_DATABASE_URL: migrationUrl },
  },
  {
    path: 'infra/db/apply-role-grants.sh',
    env: { MIGRATION_DATABASE_URL: migrationUrl },
  },
  { path: 'infra/db/smoke-role-grants.sh', env: {} },
  { path: 'infra/db/restore-drill-smoke.sh', env: {} },
];

for (const dryRun of dryRuns) {
  const result = run('sh', [resolve(repoRoot, dryRun.path), '--dry-run'], dryRun.env, true);
  const output = `${result.stdout}${result.stderr}`;
  if (output.includes(sentinel) || output.includes(migrationUrl)) {
    fail(`${dryRun.path}: dry-run output exposed credential material`);
  }
}

console.log(
  `Validated ${shellScripts.length} infrastructure shell scripts and ${dryRuns.length} DB dry-runs.`,
);

function collectShellScripts(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectShellScripts(path);
    return entry.isFile() && entry.name.endsWith('.sh') ? [path] : [];
  });
}

function run(command, args, env = {}, capture = false) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
  });
  if (result.status !== 0) {
    fail(`${command} ${args.join(' ')} exited with ${result.status}`);
  }
  return result;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
