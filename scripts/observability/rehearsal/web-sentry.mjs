import { execFileSync, spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '../../..');
const webPort = Number(process.env.WEB_SENTRY_REHEARSAL_PORT ?? 3400);
const allowUnconstrained = process.env.WEB_SENTRY_REHEARSAL_ALLOW_UNCONSTRAINED === '1';
const secretSentinel = 'sentry-ci-secret-must-not-ship';
const commonEnv = {
  ...process.env,
  NEXT_PUBLIC_APP_URL: 'https://web.local.invalid',
  NEXT_PUBLIC_API_URL: '/api',
  API_URL: 'http://127.0.0.1:9',
  NEXT_PUBLIC_WEB_OBSERVABILITY_ENVIRONMENT: 'local',
  NEXT_PUBLIC_WEB_RELEASE: 'local-sentry-rehearsal',
  NEXT_PUBLIC_SENTRY_ENABLED: '0',
  NEXT_PUBLIC_SENTRY_RUNTIME_ERRORS_ENABLED: '1',
  NEXT_PUBLIC_SENTRY_PERFORMANCE_ENABLED: '1',
  NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: '0.1',
  NEXT_PUBLIC_SENTRY_PRIVACY_APPROVED: '0',
  NEXT_PUBLIC_SENTRY_RELEASE_EVIDENCE_APPROVED: '0',
  NEXT_PUBLIC_SENTRY_LOCAL_RECORDING: '0',
  SENTRY_SOURCE_MAP_UPLOAD_ENABLED: '0',
  SENTRY_RELEASE_EVIDENCE_APPROVED: '0',
  SENTRY_AUTH_TOKEN: secretSentinel,
  SENTRY_ARTIFACT_SECRET_SENTINEL: secretSentinel,
  STORYBOOK_DISABLE_TELEMETRY: '1',
};

function run(command, arguments_, options = {}) {
  return execFileSync(command, arguments_, {
    cwd: repoRoot,
    env: commonEnv,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function dockerEnvelope() {
  try {
    const context = run('docker', ['context', 'show'], { capture: true }).trim();
    const [cpuText, memoryText] = run('docker', ['info', '--format', '{{.NCPU}} {{.MemTotal}}'], {
      capture: true,
    })
      .trim()
      .split(/\s+/u);
    const cpus = Number(cpuText);
    const memoryBytes = Number(memoryText);
    const targetBytes = 4 * 1024 * 1024 * 1024;
    const constrained = cpus === 2 && Math.abs(memoryBytes - targetBytes) <= 256 * 1024 * 1024;
    if (!allowUnconstrained) {
      assert(context === 'orbstack', `OrbStack context required, current context: ${context}`);
      assert(
        constrained,
        `Docker Engine must be 2 CPU / 4096MiB ±256MiB, got ${cpus} CPU / ${Math.round(memoryBytes / 1024 / 1024)}MiB`,
      );
    }
    return { available: true, context, cpus, memoryBytes, constrained };
  } catch (error) {
    if (!allowUnconstrained) throw error;
    return { available: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

async function waitForHttp(url, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.status;
    } catch {
      // Standalone server may still be starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error(`Standalone Web readiness timed out: ${url}`);
}

async function main() {
  const startedAt = Date.now();
  const evidence = {
    startedAt: new Date(startedAt).toISOString(),
    docker: dockerEnvelope(),
    checks: {
      focusedTests: false,
      typecheck: false,
      productionBuild: false,
      noPublicSourceMap: false,
      storybookBuild: false,
      standaloneSmoke: false,
      privacyAndDedupe: false,
      providerFailureFailOpen: false,
    },
  };

  run('pnpm', [
    '--dir',
    'apps/web',
    'exec',
    'vitest',
    'run',
    'src/config/env.schema.test.ts',
    'src/observability/sentry/__tests__',
    'src/observability/operational/__tests__',
    'src/observability/web-vitals/__tests__',
    'src/app/__tests__/error-boundaries.test.tsx',
  ]);
  evidence.checks.focusedTests = true;
  evidence.checks.privacyAndDedupe = true;
  evidence.checks.providerFailureFailOpen = true;

  run('pnpm', ['--dir', 'apps/web', 'ci:typecheck:product']);
  run('pnpm', ['--dir', 'apps/web', 'ci:typecheck:test']);
  evidence.checks.typecheck = true;

  run('pnpm', ['--dir', 'apps/web', 'ci:build']);
  evidence.checks.productionBuild = true;
  run('node', ['scripts/observability/sentry/check-build.mjs']);
  evidence.checks.noPublicSourceMap = true;

  run('pnpm', ['--dir', 'apps/web', 'ci:storybook:build']);
  evidence.checks.storybookBuild = true;

  run('pnpm', ['--dir', 'apps/web', 'ci:standalone:prepare']);
  const server = spawn('node', ['apps/web/.next/standalone/apps/web/server.js'], {
    cwd: repoRoot,
    env: { ...commonEnv, NODE_ENV: 'production', HOSTNAME: '127.0.0.1', PORT: String(webPort) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverOutput = '';
  server.stdout.on('data', (chunk) => {
    serverOutput += String(chunk);
  });
  server.stderr.on('data', (chunk) => {
    serverOutput += String(chunk);
  });

  try {
    await waitForHttp(`http://127.0.0.1:${webPort}/`);
    evidence.checks.standaloneSmoke = true;
  } finally {
    server.kill('SIGTERM');
    await new Promise((resolvePromise) => {
      const timeout = setTimeout(resolvePromise, 5_000);
      server.once('exit', () => {
        clearTimeout(timeout);
        resolvePromise();
      });
    });
  }

  assert(
    !serverOutput.includes(secretSentinel),
    'Standalone output leaked the Sentry secret sentinel.',
  );
  evidence.completedAt = new Date().toISOString();
  evidence.elapsedSeconds = Number(((Date.now() - startedAt) / 1_000).toFixed(2));
  evidence.processResourceUsage = process.resourceUsage();

  const evidencePath = process.env.WEB_SENTRY_REHEARSAL_EVIDENCE_PATH;
  if (evidencePath) {
    writeFileSync(resolve(repoRoot, evidencePath), `${JSON.stringify(evidence, null, 2)}\n`);
  }
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
}

await main();
