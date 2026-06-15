#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(scriptDir, '../../..');
const repoRoot = resolve(apiRoot, '../..');
const deployDir = resolve(repoRoot, 'infra/deploy');
const composeFile = resolve(deployDir, 'docker-compose.api.yml');
const localEnvFile = resolve(deployDir, '.env.api');
const reportsDir = resolve(apiRoot, 'test/stress/reports');
const targetUrl = process.env.STRESS_TARGET_URL || 'http://127.0.0.1:8080';
const dockerProjectName = process.env.STRESS_DOCKER_COMPOSE_PROJECT || 'knu-roommate-api';
const localDatabaseUrl =
  process.env.STRESS_LOCAL_DATABASE_URL ||
  'postgresql://knu_dev:knu_dev_password@localhost:5432/knu_roommate?schema=public';
const containerDatabaseUrl =
  process.env.STRESS_CONTAINER_DATABASE_URL ||
  'postgresql://knu_dev:knu_dev_password@host.docker.internal:5432/knu_roommate?schema=public';
const metricsToken = process.env.STRESS_DOCKER_METRICS_TOKEN || readMetricsToken(localEnvFile);
const timestamp = new Date().toISOString().replace(/[:.]/gu, '-');
const runId = process.env.STRESS_DOCKER_RUN_ID || `docker-smoke-${timestamp}`;
const reportPath = resolve(
  repoRoot,
  process.env.STRESS_DOCKER_REPORT_PATH ||
    `.omx/reports/api-dockerized-stress-result-${timestamp}.md`,
);
const actorTokenPath = resolve(reportsDir, `.tmp-${runId}-actor-tokens.json`);
const k6SmokeSummaryPath = resolve(reportsDir, `.tmp-${runId}-k6-smoke-summary.json`);
const k6BaselineSummaryPath = resolve(reportsDir, `.tmp-${runId}-k6-baseline-summary.json`);
const k6ScoreSummaryPath = resolve(reportsDir, `.tmp-${runId}-k6-score-summary.json`);
const k6WriteSummaryPath = resolve(reportsDir, `.tmp-${runId}-k6-write-summary.json`);
const artillerySummaryPath = resolve(reportsDir, `.tmp-${runId}-artillery-summary.json`);
const artilleryActorCsvPath = resolve(reportsDir, `.tmp-${runId}-artillery-actors.csv`);
const commandResults = [];
let runError = null;
const evidence = {
  health: null,
  readiness: null,
  metricsUnauthorized: null,
  metricsAuthorized: null,
  dockerPs: '',
  dockerStats: '',
  k6Smoke: null,
  k6Baseline: null,
  k6Score: null,
  k6Write: null,
  artillerySmoke: null,
  dockerLogs: '',
};

mkdirSync(reportsDir, { recursive: true });

try {
  const envFileStatus = ensureLocalApiEnvFile();
  commandResults.push({
    name: 'prepare .env.api',
    status: 'pass',
    note: `${envFileStatus} private env file`,
  });

  runRequired('docker compose dev postgres up', [
    'docker',
    'compose',
    '-f',
    'docker-compose.dev.yml',
    'up',
    '-d',
    'postgres',
  ]);
  runRequired('prisma generate', ['pnpm', '--dir', 'apps/api', 'prisma:generate']);
  runRequired('prisma db push', ['pnpm', '--dir', 'apps/api', 'prisma:push'], {
    env: buildHostDbEnv(),
  });
  runRequired(
    'api compose config',
    ['docker', 'compose', '-p', dockerProjectName, '-f', relative(repoRoot, composeFile), 'config'],
    { quiet: true, note: 'compose config validated without printing rendered env' },
  );
  runRequired('api compose build', [
    'docker',
    'compose',
    '-p',
    dockerProjectName,
    '-f',
    relative(repoRoot, composeFile),
    'build',
    'api',
  ]);
  runRequired('api compose up', [
    'docker',
    'compose',
    '-p',
    dockerProjectName,
    '-f',
    relative(repoRoot, composeFile),
    'up',
    '-d',
  ]);

  evidence.health = await waitForHttp(`${targetUrl}/health`, {
    name: 'health',
    expectedStatuses: [200],
  });
  evidence.readiness = await waitForHttp(`${targetUrl}/health/ready`, {
    name: 'readiness',
    expectedStatuses: [200],
  });
  evidence.metricsUnauthorized = await fetchStatus(`${targetUrl}/internal/metrics`);
  commandResults.push({
    name: 'metrics unauthorized check',
    status: evidence.metricsUnauthorized.status === 401 ? 'pass' : 'fail',
    note: `http ${evidence.metricsUnauthorized.status}`,
  });
  evidence.metricsAuthorized = await fetchStatus(`${targetUrl}/internal/metrics`, {
    headers: { Authorization: `Bearer ${metricsToken}` },
  });
  commandResults.push({
    name: 'metrics authorized check',
    status: evidence.metricsAuthorized.status === 200 ? 'pass' : 'fail',
    note: `http ${evidence.metricsAuthorized.status}, bytes ${evidence.metricsAuthorized.bodyLength}`,
  });

  const stressEnv = buildStressEnv();
  runRequired('stress fixture seed', ['pnpm', '--dir', 'apps/api', 'stress:fixture:seed'], {
    env: stressEnv,
  });
  runRequired('stress fixture tokens', ['pnpm', '--dir', 'apps/api', 'stress:fixture:tokens'], {
    env: stressEnv,
  });
  runRequired('k6 smoke', ['pnpm', '--dir', 'apps/api', 'stress:http:smoke'], {
    env: {
      ...stressEnv,
      STRESS_SMOKE_DURATION: process.env.STRESS_SMOKE_DURATION || '10s',
      STRESS_SMOKE_VUS: process.env.STRESS_SMOKE_VUS || '1',
      STRESS_K6_SUMMARY_PATH: k6SmokeSummaryPath,
    },
  });
  evidence.k6Smoke = parseJsonArtifact(k6SmokeSummaryPath);
  runRequired('k6 authenticated baseline', ['pnpm', '--dir', 'apps/api', 'stress:http:baseline'], {
    env: {
      ...stressEnv,
      STRESS_BASELINE_DURATION: process.env.STRESS_BASELINE_DURATION || '10s',
      STRESS_BASELINE_VUS: process.env.STRESS_BASELINE_VUS || '1',
      STRESS_SLEEP_SECONDS: process.env.STRESS_SLEEP_SECONDS || '0.2',
      STRESS_K6_SUMMARY_PATH: k6BaselineSummaryPath,
    },
  });
  evidence.k6Baseline = parseJsonArtifact(k6BaselineSummaryPath);
  runRequired('k6 score cohort', ['pnpm', '--dir', 'apps/api', 'stress:http:score-cohort'], {
    env: {
      ...stressEnv,
      STRESS_SCORE_COHORT_DURATION: process.env.STRESS_SCORE_COHORT_DURATION || '10s',
      STRESS_SCORE_COHORT_VUS: process.env.STRESS_SCORE_COHORT_VUS || '1',
      STRESS_SLEEP_SECONDS: process.env.STRESS_SLEEP_SECONDS || '0.2',
      STRESS_K6_SUMMARY_PATH: k6ScoreSummaryPath,
    },
  });
  evidence.k6Score = parseJsonArtifact(k6ScoreSummaryPath);
  runRequired('k6 bounded write mix', ['pnpm', '--dir', 'apps/api', 'stress:http:baseline'], {
    env: {
      ...stressEnv,
      STRESS_BASELINE_DURATION: process.env.STRESS_WRITE_MIX_DURATION || '10s',
      STRESS_BASELINE_VUS: process.env.STRESS_WRITE_MIX_VUS || '1',
      STRESS_SLEEP_SECONDS: process.env.STRESS_SLEEP_SECONDS || '0.2',
      STRESS_ENABLE_WRITE_MIX: 'true',
      STRESS_K6_SUMMARY_PATH: k6WriteSummaryPath,
    },
  });
  evidence.k6Write = parseJsonArtifact(k6WriteSummaryPath);
  runOptional('artillery realtime smoke', ['pnpm', '--dir', 'apps/api', 'stress:realtime:smoke'], {
    env: {
      ...stressEnv,
      STRESS_ARTILLERY_SUMMARY_PATH: artillerySummaryPath,
      STRESS_ARTILLERY_ACTOR_CSV_PATH: artilleryActorCsvPath,
      STRESS_REALTIME_SOCKET_URL: `${targetUrl.replace(/\/$/u, '')}/chat`,
      STRESS_REALTIME_ORIGIN: new URL(targetUrl).origin,
    },
  });
  evidence.artillerySmoke = existsSync(artillerySummaryPath)
    ? parseJsonArtifact(artillerySummaryPath)
    : null;
} catch (error) {
  runError = error;
  commandResults.push({
    name: 'runner exception',
    status: 'fail',
    note: error instanceof Error ? redact(error.message) : redact(String(error)),
  });
} finally {
  evidence.dockerPs = capture('docker compose ps', [
    'docker',
    'compose',
    '-p',
    dockerProjectName,
    '-f',
    relative(repoRoot, composeFile),
    'ps',
  ]);
  evidence.dockerStats = capture('docker stats snapshot', [
    'docker',
    'stats',
    '--no-stream',
    '--format',
    'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}',
    `${dockerProjectName}-api-1`,
    `${dockerProjectName}-nginx-1`,
  ]);
  evidence.dockerLogs = capture('docker compose logs', [
    'docker',
    'compose',
    '-p',
    dockerProjectName,
    '-f',
    relative(repoRoot, composeFile),
    'logs',
    '--no-color',
    '--tail=160',
    'api',
    'nginx',
  ]);

  try {
    runOptional('stress fixture reset', ['pnpm', '--dir', 'apps/api', 'stress:fixture:reset'], {
      env: buildStressEnv(),
    });
  } catch {
    // runOptional already records failures; keep cleanup best-effort.
  }

  if (process.env.STRESS_DOCKER_KEEP_UP !== 'true') {
    runOptional('api compose down', [
      'docker',
      'compose',
      '-p',
      dockerProjectName,
      '-f',
      relative(repoRoot, composeFile),
      'down',
    ]);
  }

  writeReport();
  cleanupRawArtifacts();
}

const failed = commandResults.filter((result) => result.status === 'fail');
console.log(`Dockerized stress smoke report: ${reportPath}`);
if (runError) {
  console.error(runError instanceof Error ? runError.message : String(runError));
}
process.exit(failed.length === 0 ? 0 : 1);

function ensureLocalApiEnvFile() {
  if (existsSync(localEnvFile)) {
    return ensureExistingApiEnvKeys();
  }

  const token = metricsToken || randomSecret();
  writeFileSync(
    localEnvFile,
    [
      '# Local dockerized stress smoke env. Do not commit.',
      'NODE_ENV=production',
      'PORT=4000',
      `DATABASE_URL=${containerDatabaseUrl}`,
      `DIRECT_URL=${containerDatabaseUrl}`,
      `MIGRATION_DATABASE_URL=${containerDatabaseUrl}`,
      `RETENTION_WORKER_DATABASE_URL=${containerDatabaseUrl}`,
      `RETENTION_DISCLOSURE_DATABASE_URL=${containerDatabaseUrl}`,
      'DATABASE_POOL_MAX=10',
      'DATABASE_POOL_MIN=0',
      'DATABASE_ADAPTER_CONNECT_TIMEOUT_MS=5000',
      'DATABASE_ADAPTER_IDLE_TIMEOUT_MS=300000',
      `LOG_HASH_SECRET=${randomSecret()}`,
      `RETENTION_IDENTITY_ENCRYPTION_KEY_BASE64=${randomBase64Secret()}`,
      `RETENTION_VAULT_CHAT_BODY_ENCRYPTION_KEY_BASE64=${randomBase64Secret()}`,
      'METRICS_ENABLED=true',
      `METRICS_BEARER_TOKEN=${token}`,
      'AUTH_THROTTLE_LIMIT=5000',
      `VERIFICATION_CODE_HMAC_SECRET=${randomSecret()}`,
      `ROOMMATE_SEARCH_CURSOR_HMAC_SECRET=${randomSecret()}`,
      `PROFILE_DETAIL_ENTRY_TOKEN_HMAC_SECRET=${randomSecret()}`,
      `CHAT_THREAD_LIST_CURSOR_HMAC_SECRET=${randomSecret()}`,
      'LOG_LEVEL=info',
      'LOG_PRETTY=false',
      'OBSERVABILITY_SERVICE_NAME=api',
      'CHAT_REALTIME_ALLOWED_ORIGINS=http://127.0.0.1:8080,http://localhost:8080',
      'CHAT_REALTIME_TRUST_PROXY=true',
      'LIFECYCLE_SWEEP_ENABLED=false',
      'API_IMAGE_TAG=phase9-1-local',
      'NGINX_HTTP_BIND=127.0.0.1',
      'NGINX_HTTP_PORT=8080',
      '',
    ].join('\n'),
    { mode: 0o600 },
  );
  return 'created';
}

function ensureExistingApiEnvKeys() {
  const text = readFileSync(localEnvFile, 'utf8');
  const missingLines = [];
  if (!/^RETENTION_IDENTITY_ENCRYPTION_KEY_BASE64=/mu.test(text)) {
    missingLines.push(`RETENTION_IDENTITY_ENCRYPTION_KEY_BASE64=${randomBase64Secret()}`);
  }
  if (!/^RETENTION_VAULT_CHAT_BODY_ENCRYPTION_KEY_BASE64=/mu.test(text)) {
    missingLines.push(`RETENTION_VAULT_CHAT_BODY_ENCRYPTION_KEY_BASE64=${randomBase64Secret()}`);
  }
  if (!/^AUTH_THROTTLE_LIMIT=/mu.test(text)) {
    missingLines.push('AUTH_THROTTLE_LIMIT=5000');
  }

  if (missingLines.length === 0) {
    return 'reused';
  }

  writeFileSync(
    localEnvFile,
    `${text.replace(/\n?$/u, '\n')}\n# Added by dockerized stress smoke runner.\n${missingLines.join('\n')}\n`,
    {
      mode: 0o600,
    },
  );
  return 'updated';
}

function readMetricsToken(envPath) {
  if (!existsSync(envPath)) {
    return randomSecret();
  }

  const envText = readFileSync(envPath, 'utf8');
  const match = envText.match(/^METRICS_BEARER_TOKEN=(.*)$/mu);
  return match?.[1]?.trim() || randomSecret();
}

function randomSecret() {
  return randomBytes(32).toString('hex');
}

function randomBase64Secret() {
  return randomBytes(32).toString('base64');
}

function buildHostDbEnv() {
  return {
    ...process.env,
    NODE_ENV: 'development',
    DATABASE_URL: localDatabaseUrl,
    DIRECT_URL: localDatabaseUrl,
    MIGRATION_DATABASE_URL: localDatabaseUrl,
    RETENTION_WORKER_DATABASE_URL: localDatabaseUrl,
    RETENTION_DISCLOSURE_DATABASE_URL: localDatabaseUrl,
  };
}

function buildStressEnv() {
  return {
    ...buildHostDbEnv(),
    STRESS_TARGET_URL: targetUrl,
    STRESS_ENV: 'local',
    STRESS_ALLOWED_HOSTS: 'localhost,127.0.0.1,host.docker.internal',
    STRESS_FIXTURE_APPLY: 'I_UNDERSTAND_STAGING_FIXTURE',
    STRESS_FIXTURE_PREFIX: process.env.STRESS_FIXTURE_PREFIX || 'docker-stress-smoke',
    STRESS_SEASON_ID: process.env.STRESS_SEASON_ID || 'docker-stress-smoke-season-local',
    STRESS_CAMPUS_CODE: process.env.STRESS_CAMPUS_CODE || 'CHUNCHEON',
    STRESS_LARGEST_COHORT_SIZE: process.env.STRESS_LARGEST_COHORT_SIZE || '4',
    STRESS_COHORT_SIZE: process.env.STRESS_COHORT_SIZE || '12',
    STRESS_DORMITORY_COUNT: process.env.STRESS_DORMITORY_COUNT || '2',
    STRESS_ROOM_TYPE: process.env.STRESS_ROOM_TYPE || '2',
    STRESS_TOKEN_ACTOR_LIMIT: process.env.STRESS_TOKEN_ACTOR_LIMIT || '3',
    STRESS_ACTOR_TOKENS_PATH: actorTokenPath,
  };
}

function runRequired(name, args, options = {}) {
  const result = runCommand(name, args, { ...options, required: true });
  if (result.status === 'fail') {
    throw new Error(`${name} failed`);
  }
  return result;
}

function runOptional(name, args, options = {}) {
  return runCommand(name, args, { ...options, required: false });
}

function runCommand(name, args, options = {}) {
  const [command, ...commandArgs] = args;
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    env: options.env || process.env,
    stdio: options.quiet ? 'pipe' : 'inherit',
    encoding: options.quiet ? 'utf8' : undefined,
  });
  const exitCode = typeof result.status === 'number' ? result.status : 1;
  const status = exitCode === 0 ? 'pass' : 'fail';
  commandResults.push({
    name,
    status,
    exitCode,
    note:
      options.note ||
      (options.required === false && status === 'fail'
        ? 'best-effort command failed'
        : options.quiet
          ? redact(String(result.stdout || result.stderr || '')).slice(0, 200)
          : ''),
  });
  return { status, exitCode };
}

function capture(name, args) {
  const [command, ...commandArgs] = args;
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    env: process.env,
    encoding: 'utf8',
  });
  commandResults.push({
    name,
    status: result.status === 0 ? 'pass' : 'fail',
    exitCode: result.status ?? 1,
    note: '',
  });
  return redact(String(result.stdout || result.stderr || '').trim());
}

async function waitForHttp(url, { name, expectedStatuses, attempts = 60, delayMs = 1000 }) {
  let last = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    last = await fetchStatus(url);
    if (expectedStatuses.includes(last.status)) {
      commandResults.push({ name: `${name} check`, status: 'pass', note: `http ${last.status}` });
      return last;
    }
    await delay(delayMs);
  }

  commandResults.push({
    name: `${name} check`,
    status: 'fail',
    note: `last http ${last?.status ?? 'n/a'}`,
  });
  throw new Error(`${name} check failed for ${url}`);
}

async function fetchStatus(url, init = {}) {
  try {
    const response = await fetch(url, init);
    const text = await response.text();
    return {
      status: response.status,
      bodyLength: text.length,
      bodySample: redact(text.slice(0, 120)),
    };
  } catch (error) {
    return {
      status: 0,
      bodyLength: 0,
      bodySample: redact(error instanceof Error ? error.message : String(error)),
    };
  }
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

function parseJsonArtifact(path) {
  if (!existsSync(path)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return { parseError: true };
  }
}

function writeReport() {
  mkdirSync(dirname(reportPath), { recursive: true });
  const report = [
    '# API dockerized stress smoke result',
    '',
    `- generatedAt: ${new Date().toISOString()}`,
    `- gitCommit: ${captureGit('rev-parse', ['HEAD'])}`,
    `- gitBranch: ${captureGit('branch', ['--show-current'])}`,
    '- targetClass: local docker API/nginx',
    `- targetUrl: ${targetUrl}`,
    '- rawArtifacts: removed from ignored .tmp-* paths after report generation',
    '',
    '## Command results',
    '',
    '| Command | Status | Exit | Note |',
    '| --- | --- | ---: | --- |',
    ...commandResults.map(
      (result) =>
        `| ${escapeCell(result.name)} | ${result.status} | ${result.exitCode ?? ''} | ${escapeCell(result.note || '')} |`,
    ),
    '',
    '## HTTP boundary',
    '',
    `- health: ${formatHttp(evidence.health)}`,
    `- readiness: ${formatHttp(evidence.readiness)}`,
    `- metrics without bearer: ${formatHttp(evidence.metricsUnauthorized)} (expected 401)`,
    `- metrics with bearer: ${formatHttp(evidence.metricsAuthorized)} (expected 200; token omitted)`,
    '',
    '## k6 summaries',
    '',
    '| Scenario | Duration ms | http_req_duration p95 | http_req_duration p99 | http_req_failed rate | checks rate |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    renderK6Row('smoke', evidence.k6Smoke),
    renderK6Row('baseline-250', evidence.k6Baseline),
    renderK6Row('score-cohort-946', evidence.k6Score),
    renderK6Row('bounded-write-mix', evidence.k6Write),
    '',
    '## Artillery summary',
    '',
    renderArtillerySummary(evidence.artillerySmoke),
    '',
    '## Docker readout',
    '',
    '```txt',
    evidence.dockerPs || '(not captured)',
    '',
    evidence.dockerStats || '(not captured)',
    '```',
    '',
    '## Docker logs tail',
    '',
    '```txt',
    evidence.dockerLogs || '(not captured)',
    '```',
    '',
    '## Issue decision notes',
    '',
    '- #204/#205: local L2 smoke에서 Redis 도입 여부를 확정하지 않는다. authenticated read/write가 실행 가능하다는 smoke evidence만 남긴다.',
    '- #247: score-cohort는 local 12명 smoke로 script correctness만 검증했다. 237/946 production-like cohort 수치가 없으므로 cache 도입은 보류/후속 측정이다.',
    '- #250/#254/#255: realtime은 smoke만 실행했다. baseline/peak와 multi-node/limiter/alert threshold는 one-time ticket per VU 전략과 staging evidence가 필요하다.',
    '- #256/#272: local docker DB 수치만으로 RDS IOPS/EXPLAIN 또는 MatchHistory rebuild 정책을 바꾸지 않는다. staging/RDS metric이 필요하다.',
    '- #22/#280: dockerized smoke command, metrics boundary, sanitized report 흐름은 운영 대응 evidence 수집 루프에 연결된다.',
    '',
    '## Safety',
    '',
    '- raw token/ticket/cookie/password/email/DB URL/webhook 값은 이 report에 기록하지 않았다.',
    '- fixture reset은 marker prefix 기반 best-effort cleanup으로 실행했다.',
    '- `.env.api`는 local private file이며 커밋 대상이 아니다.',
    '',
  ].join('\n');

  writeFileSync(reportPath, redact(report), { mode: 0o600 });
}

function captureGit(command, args) {
  const result = spawnSync('git', [command, ...args], { cwd: repoRoot, encoding: 'utf8' });
  return String(result.stdout || '').trim();
}

function formatHttp(result) {
  if (!result) {
    return 'not captured';
  }
  return `http ${result.status}, bytes ${result.bodyLength}`;
}

function renderK6Row(name, summary) {
  const metric =
    summary?.metrics?.http_req_duration?.values ?? summary?.metrics?.http_req_duration ?? {};
  const failed =
    summary?.metrics?.http_req_failed?.values ?? summary?.metrics?.http_req_failed ?? {};
  const checks = summary?.metrics?.checks?.values ?? summary?.metrics?.checks ?? {};
  return [
    name,
    summary?.state?.testRunDurationMs ?? '',
    metric['p(95)'] ?? metric.p95 ?? '',
    metric['p(99)'] ?? metric.p99 ?? '',
    failed.rate ?? failed.value ?? '',
    checks.rate ?? checks.value ?? '',
  ]
    .map((value) => escapeCell(String(value)))
    .join(' | ')
    .replace(/^/u, '| ')
    .replace(/$/u, ' |');
}

function renderArtillerySummary(summary) {
  if (!summary) {
    return '- status: skipped or no artifact';
  }
  const aggregate = summary.aggregate ?? summary;
  const counters = aggregate.counters ?? {};
  const summaries = aggregate.summaries ?? aggregate.histograms ?? {};
  return [
    `- vusers.created: ${counters['vusers.created'] ?? ''}`,
    `- vusers.completed: ${counters['vusers.completed'] ?? ''}`,
    `- vusers.failed: ${counters['vusers.failed'] ?? ''}`,
    `- socketio.response_time.p95: ${summaries['socketio.response_time']?.p95 ?? ''}`,
    `- subscribeAck.p95: ${summaries['stress.realtime.subscribe_ack_ms']?.p95 ?? ''}`,
  ].join('\n');
}

function cleanupRawArtifacts() {
  for (const artifactPath of [
    actorTokenPath,
    k6SmokeSummaryPath,
    k6BaselineSummaryPath,
    k6ScoreSummaryPath,
    k6WriteSummaryPath,
    artillerySummaryPath,
    artilleryActorCsvPath,
  ]) {
    if (existsSync(artifactPath)) {
      rmSync(artifactPath, { force: true });
    }
  }
}

function escapeCell(value) {
  return redact(value).replace(/\|/gu, '\\|').replace(/\n/gu, '<br>');
}

function redact(value) {
  return String(value)
    .replace(/postgresql:\/\/[^\s)]+/giu, 'postgresql://[REDACTED_STRESS_SECRET]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/giu, 'Bearer [REDACTED_STRESS_SECRET]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, '[REDACTED_STRESS_SECRET]')
    .replace(/(TOKEN|SECRET|PASSWORD|DATABASE_URL)=([^\s]+)/giu, '$1=[REDACTED_STRESS_SECRET]');
}
