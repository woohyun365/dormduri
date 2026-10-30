#!/usr/bin/env node
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const scenario = process.argv[2];
const validScenarios = new Set([
  'smoke',
  'baseline-250',
  'peak-500',
  'spike-500',
  'soak-250',
  'score-cohort-946',
  'auth-login-capacity',
  'auth-password-burst',
  'auth-recovery-abuse',
]);

if (!scenario || !validScenarios.has(scenario)) {
  console.error(
    `Usage: node test/stress/http/k6/run-k6-scenario.mjs <${[...validScenarios].join('|')}>`,
  );
  process.exit(2);
}

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const scriptPath = resolve(apiRoot, `test/stress/http/k6/${scenario}.k6.js`);
const summaryPath = resolve(
  apiRoot,
  process.env.STRESS_K6_SUMMARY_PATH || `test/stress/reports/.tmp-${scenario}-summary.json`,
);
const parserPath = resolve(apiRoot, 'test/stress/evidence/parsers/parse-k6-summary.ts');
const k6Env = normalizeK6Environment(process.env);

if (!existsSync(scriptPath)) {
  console.error(`k6 scenario script does not exist: ${scriptPath}`);
  process.exit(2);
}

const k6Version = spawnSync('k6', ['version'], { encoding: 'utf8' });
if (k6Version.error?.code === 'ENOENT') {
  console.error(
    'k6 CLI is required for HTTP stress runs. Install k6 from https://grafana.com/docs/k6/latest/set-up/install-k6/',
  );
  process.exit(127);
}

mkdirSync(dirname(summaryPath), { recursive: true });

const k6Run = spawnSync('k6', ['run', '--summary-export', summaryPath, scriptPath], {
  stdio: 'inherit',
  env: k6Env,
});
const k6ExitCode = typeof k6Run.status === 'number' ? k6Run.status : 1;

if (!existsSync(summaryPath)) {
  process.exit(k6ExitCode);
}

const tsLoader = './test/support/ts-esm-loader.mjs';
const parserRun = spawnSync(
  process.execPath,
  [
    '--no-deprecation',
    '--import',
    tsLoader,
    parserPath,
    summaryPath,
    '--scenario',
    scenario,
    '--k6-exit-code',
    String(k6ExitCode),
  ],
  {
    cwd: apiRoot,
    stdio: 'inherit',
    env: k6Env,
  },
);

if (typeof parserRun.status === 'number') {
  process.exit(parserRun.status);
}

console.error(`Failed to parse k6 summary via ${pathToFileURL(parserPath).href}`);
process.exit(1);

function normalizeK6Environment(env) {
  if (!env.STRESS_ACTOR_TOKENS_PATH || env.STRESS_ACTOR_TOKENS_PATH.startsWith('/')) {
    return env;
  }

  return {
    ...env,
    STRESS_ACTOR_TOKENS_PATH: resolve(apiRoot, env.STRESS_ACTOR_TOKENS_PATH),
  };
}
