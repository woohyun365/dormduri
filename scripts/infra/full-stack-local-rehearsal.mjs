#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createReadStream, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { resolveArtifactPath } from '../artifacts/paths.mjs';
import {
  buildComposeArgs,
  cleanupUnusedNetworks,
  ensureProfileNetworks,
  getComposeProfile,
  loadComposeInventory,
} from './compose-profile.mjs';

const repoRoot = resolve(import.meta.dirname, '../..');
const inventory = loadComposeInventory(repoRoot);
const keepRunning = process.env.FULL_STACK_REHEARSAL_KEEP === '1';
const allowUnconstrained = process.env.FULL_STACK_REHEARSAL_ALLOW_UNCONSTRAINED === '1';
const skipBuild = process.env.FULL_STACK_REHEARSAL_SKIP_BUILD === '1';
const databaseMode = process.env.FULL_STACK_REHEARSAL_DB_MODE ?? 'local';
const productEnvelopeMiB = 4096;
const localDatabaseAllowanceMiB = 512;
const expectedProductContainerLimitMiB = 2976;
const timestamp = new Date().toISOString().replace(/[:.]/gu, '-');
const runId = process.env.FULL_STACK_REHEARSAL_RUN_ID ?? timestamp;
const apiProject = `knu-full-stack-api-${runId}`.toLowerCase();
const webProject = `knu-full-stack-web-${runId}`.toLowerCase();
const observabilityNetwork = `knu-full-stack-observability-${runId}`.toLowerCase();
const apiNetwork = `knu-full-stack-api-network-${runId}`.toLowerCase();
const temporaryDirectory = mkdtempSync(resolve(tmpdir(), 'knu-roommate-full-stack-'));
const runtimeEnvPath = resolve(temporaryDirectory, 'api.runtime.env');
const metricsTokenPath = resolve(temporaryDirectory, 'metrics-token');
const evidenceDirectory = resolveArtifactPath(repoRoot, ['infra', 'full-stack-rehearsal']);
const evidenceJsonPath = resolve(evidenceDirectory, `${runId}.json`);
const evidenceMarkdownPath = resolve(evidenceDirectory, `${runId}.md`);
const postgresImage =
  'postgres:18.3-alpine@sha256:54451ecb8ab38c24c3ec123f2fd501303a3a1856a5c66e98cecf2460d5e1e9d7';

const secrets = {
  migrationPassword: randomSecret(),
  runtimePassword: randomSecret(),
  retentionPassword: randomSecret(),
  disclosurePassword: randomSecret(),
  logHash: randomSecret(),
  metricsToken: randomSecret(),
  verificationHmac: randomSecret(),
  authPersistenceHmac: randomSecret(),
  authMailEnvelope: randomBase64Secret(),
  retentionIdentity: randomBase64Secret(),
  retentionVault: randomBase64Secret(),
  roommateCursor: randomSecret(),
  profileEntry: randomSecret(),
  chatCursor: randomSecret(),
  grafanaPassword: randomSecret(),
};
const secretValues = Object.values(secrets);

const evidence = {
  schemaVersion: 1,
  runId,
  startedAt: new Date().toISOString(),
  completedAt: null,
  status: 'running',
  databaseMode,
  envelope: null,
  ports: {},
  scenarios: [],
  latencyMilliseconds: {},
  recoveryMilliseconds: {},
  resourceHighWater: [],
  cleanup: {
    attempted: false,
    firstPass: false,
    secondPass: false,
    resourcesRemaining: null,
  },
  blocker: null,
};

let commandEnvironment;
let apiComposeArguments;
let webComposeArguments;
let createdNetworks = [];

function randomSecret() {
  return randomBytes(32).toString('hex');
}

function randomBase64Secret() {
  return randomBytes(32).toString('base64');
}

function recordScenario(name, status, detail) {
  evidence.scenarios.push({ name, status, detail });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: options.env ?? commandEnvironment ?? process.env,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`${options.label ?? command} exited with ${result.status ?? 'unknown'}`);
  }
  return options.capture ? result.stdout.trim() : '';
}

function runDocker(args, options = {}) {
  return run('docker', args, options);
}

function apiCompose(...args) {
  return runDocker([...apiComposeArguments, ...args], { label: `API Compose ${args[0]}` });
}

function apiComposeOutput(...args) {
  return runDocker([...apiComposeArguments, ...args], {
    capture: true,
    label: `API Compose ${args[0]}`,
  });
}

function webCompose(...args) {
  return runDocker([...webComposeArguments, ...args], { label: `Web Compose ${args[0]}` });
}

function webComposeOutput(...args) {
  return runDocker([...webComposeArguments, ...args], {
    capture: true,
    label: `Web Compose ${args[0]}`,
  });
}

async function freePort() {
  return new Promise((resolvePromise, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close((error) => {
        if (error) reject(error);
        else if (port === null) reject(new Error('Failed to allocate a loopback port.'));
        else resolvePromise(port);
      });
    });
  });
}

async function allocatePorts() {
  const names = [
    'api',
    'web',
    'postgres',
    'grafana',
    'loki',
    'prometheus',
    'alloy',
    'alertmanager',
  ];
  const values = await Promise.all(names.map(() => freePort()));
  evidence.ports = Object.fromEntries(names.map((name, index) => [name, values[index]]));
}

function validateDockerEnvelope() {
  const context = runDocker(['context', 'show'], { capture: true, label: 'Docker context' });
  const [cpuText, memoryText] = runDocker(['info', '--format', '{{.NCPU}} {{.MemTotal}}'], {
    capture: true,
    label: 'Docker engine capacity',
  }).split(/\s+/u);
  const cpus = Number(cpuText);
  const memoryBytes = Number(memoryText);
  const databaseAllowanceMiB = databaseMode === 'local' ? localDatabaseAllowanceMiB : 0;
  const engineTargetMiB = productEnvelopeMiB + databaseAllowanceMiB;
  const targetBytes = engineTargetMiB * 1024 * 1024;
  const toleranceBytes = 256 * 1024 * 1024;
  const constrained = cpus === 2 && Math.abs(memoryBytes - targetBytes) <= toleranceBytes;

  if (!allowUnconstrained) {
    assert(context === 'orbstack', `OrbStack context required; received ${context || 'unknown'}.`);
    assert(
      constrained,
      `Docker Engine must be 2 CPU and ${engineTargetMiB}MiB ±256MiB; received ${cpus} CPU and ${Math.round(memoryBytes / 1024 / 1024)}MiB.`,
    );
  }

  evidence.envelope = {
    context,
    cpus,
    memoryMiB: Math.round(memoryBytes / 1024 / 1024),
    constrained,
    productEnvelopeMiB,
    databaseAllowanceMiB,
    engineTargetMiB,
    productContainerLimitMiB: null,
    databaseContainerLimitMiB: null,
    engineHeadroomMiB: null,
  };
  recordScenario(
    'engine-resource-envelope',
    'pass',
    `${cpus} CPU / ${evidence.envelope.memoryMiB}MiB; product ${productEnvelopeMiB}MiB + DB allowance ${databaseAllowanceMiB}MiB`,
  );
}

function databaseUrls() {
  if (databaseMode === 'external') return externalDatabaseUrls();
  assert(databaseMode === 'local', `Unsupported database mode: ${databaseMode}`);
  const database = 'knu_roommate_rehearsal';
  const host = `127.0.0.1:${evidence.ports.postgres}`;
  const container = 'postgres:5432';
  return {
    host: {
      migration: databaseUrl('rehearsal_migration', secrets.migrationPassword, host, database),
      runtime: databaseUrl('rehearsal_runtime', secrets.runtimePassword, host, database),
      retention: databaseUrl('rehearsal_retention', secrets.retentionPassword, host, database),
      disclosure: databaseUrl('rehearsal_disclosure', secrets.disclosurePassword, host, database),
    },
    container: {
      migration: databaseUrl('rehearsal_migration', secrets.migrationPassword, container, database),
      runtime: databaseUrl('rehearsal_runtime', secrets.runtimePassword, container, database),
      retention: databaseUrl('rehearsal_retention', secrets.retentionPassword, container, database),
      disclosure: databaseUrl(
        'rehearsal_disclosure',
        secrets.disclosurePassword,
        container,
        database,
      ),
    },
  };
}

function databaseUrl(user, password, host, database) {
  return `postgresql://${user}:${password}@${host}/${database}?schema=public`;
}

function psqlDatabaseUrl(url) {
  const parsed = new URL(url);
  parsed.searchParams.delete('schema');
  return parsed.toString();
}

function externalDatabaseUrls() {
  assert(
    process.env.FULL_STACK_REHEARSAL_EXTERNAL_DB_CLASSIFICATION === 'disposable-test',
    'External database requires disposable-test classification.',
  );
  assert(
    process.env.FULL_STACK_REHEARSAL_EXTERNAL_DB_APPROVAL === 'I_ACKNOWLEDGE_DESTRUCTIVE_TEST_DB',
    'External database requires explicit destructive-test approval.',
  );
  const keys = {
    migration: 'FULL_STACK_REHEARSAL_EXTERNAL_MIGRATION_DATABASE_URL',
    runtime: 'FULL_STACK_REHEARSAL_EXTERNAL_RUNTIME_DATABASE_URL',
    retention: 'FULL_STACK_REHEARSAL_EXTERNAL_RETENTION_DATABASE_URL',
    disclosure: 'FULL_STACK_REHEARSAL_EXTERNAL_DISCLOSURE_DATABASE_URL',
  };
  const values = Object.fromEntries(
    Object.entries(keys).map(([name, key]) => {
      const value = process.env[key]?.trim();
      assert(value, `Missing external database input: ${key}`);
      assert(!/prod(?:uction)?/iu.test(value), `${key} looks like a production database.`);
      return [name, value];
    }),
  );
  return { host: values, container: values };
}

function writeRuntimeInputs(urls) {
  const lines = [
    'NODE_ENV=production',
    'PORT=4000',
    'TZ=Asia/Seoul',
    `DATABASE_URL=${urls.container.runtime}`,
    `DIRECT_URL=${urls.container.migration}`,
    `MIGRATION_DATABASE_URL=${urls.container.migration}`,
    `RETENTION_WORKER_DATABASE_URL=${urls.container.retention}`,
    `RETENTION_DISCLOSURE_DATABASE_URL=${urls.container.disclosure}`,
    'DATABASE_POOL_MAX=5',
    'DATABASE_POOL_MIN=0',
    'DATABASE_ADAPTER_CONNECT_TIMEOUT_MS=5000',
    'DATABASE_ADAPTER_IDLE_TIMEOUT_MS=300000',
    `LOG_HASH_SECRET=${secrets.logHash}`,
    `RETENTION_IDENTITY_ENCRYPTION_KEY_BASE64=${secrets.retentionIdentity}`,
    'RETENTION_IDENTITY_KEY_VERSION=v1',
    `RETENTION_VAULT_CHAT_BODY_ENCRYPTION_KEY_BASE64=${secrets.retentionVault}`,
    'RETENTION_VAULT_CHAT_BODY_KEY_VERSION=v1',
    'METRICS_ENABLED=true',
    `METRICS_BEARER_TOKEN=${secrets.metricsToken}`,
    `VERIFICATION_CODE_HMAC_SECRET=${secrets.verificationHmac}`,
    `AUTH_PERSISTENCE_HMAC_SECRET=${secrets.authPersistenceHmac}`,
    'AUTH_PERSISTENCE_HMAC_KEY_VERSION=v1',
    `AUTH_MAIL_ENVELOPE_ENCRYPTION_KEY_BASE64=${secrets.authMailEnvelope}`,
    'AUTH_MAIL_ENVELOPE_KEY_VERSION=v1',
    'AUTH_MAIL_DISPATCHER_ENABLED=false',
    'AUTH_PASSWORD_HASH_CONCURRENCY=2',
    'AUTH_PASSWORD_HASH_QUEUE_LIMIT=16',
    'AUTH_PASSWORD_HASH_WAIT_TIMEOUT_MS=2000',
    'EMAIL_PROVIDER=ses',
    'SES_REGION=ap-northeast-2',
    'SES_FROM_EMAIL=no-reply@rehearsal.invalid',
    `ROOMMATE_SEARCH_CURSOR_HMAC_SECRET=${secrets.roommateCursor}`,
    `PROFILE_DETAIL_ENTRY_TOKEN_HMAC_SECRET=${secrets.profileEntry}`,
    `CHAT_THREAD_LIST_CURSOR_HMAC_SECRET=${secrets.chatCursor}`,
    'HTTP_TRUST_PROXY_HOPS=1',
    'HTTP_CORS_ALLOWED_ORIGINS=http://127.0.0.1',
    'HTTP_COOKIE_SECURE=false',
    'HTTP_COOKIE_SAME_SITE=lax',
    'CHAT_REALTIME_ALLOWED_ORIGINS=http://127.0.0.1',
    'CHAT_REALTIME_TRUST_PROXY=true',
    'LIFECYCLE_SWEEP_ENABLED=false',
    'LOG_LEVEL=info',
    'LOG_PRETTY=false',
    'OBSERVABILITY_SERVICE_NAME=api',
    '',
  ];
  writeFileSync(runtimeEnvPath, lines.join('\n'), { mode: 0o600 });
  writeFileSync(metricsTokenPath, `${secrets.metricsToken}\n`, { mode: 0o600 });
}

function configureCompose() {
  commandEnvironment = {
    ...process.env,
    API_IMAGE_TAG: `full-stack-${runId}`,
    API_RUNTIME_ENV_FILE: runtimeEnvPath,
    NGINX_HTTP_BIND: '127.0.0.1',
    NGINX_HTTP_PORT: String(evidence.ports.api),
    OBSERVABILITY_NETWORK: observabilityNetwork,
    REHEARSAL_API_NETWORK: apiNetwork,
    REHEARSAL_POSTGRES_DB: 'knu_roommate_rehearsal',
    REHEARSAL_POSTGRES_PORT: String(evidence.ports.postgres),
    REHEARSAL_DB_MIGRATION_USER: 'rehearsal_migration',
    REHEARSAL_DB_MIGRATION_PASSWORD: secrets.migrationPassword,
    REHEARSAL_DB_RUNTIME_USER: 'rehearsal_runtime',
    REHEARSAL_DB_RUNTIME_PASSWORD: secrets.runtimePassword,
    REHEARSAL_DB_RETENTION_USER: 'rehearsal_retention',
    REHEARSAL_DB_RETENTION_PASSWORD: secrets.retentionPassword,
    REHEARSAL_DB_DISCLOSURE_USER: 'rehearsal_disclosure',
    REHEARSAL_DB_DISCLOSURE_PASSWORD: secrets.disclosurePassword,
    OBSERVABILITY_ENV: 'local',
    API_METRICS_TARGET: 'api:4000',
    API_METRICS_SCHEME: 'http',
    API_METRICS_BEARER_TOKEN_FILE: metricsTokenPath,
    GRAFANA_ADMIN_USER: 'rehearsal-admin',
    GRAFANA_ADMIN_PASSWORD: secrets.grafanaPassword,
    GRAFANA_PORT: String(evidence.ports.grafana),
    LOKI_PORT: String(evidence.ports.loki),
    PROMETHEUS_PORT: String(evidence.ports.prometheus),
    ALLOY_PORT: String(evidence.ports.alloy),
    ALERTMANAGER_PORT: String(evidence.ports.alertmanager),
    SLACK_ALERTMANAGER_ENABLED: 'false',
    WEB_REHEARSAL_PORT: String(evidence.ports.web),
    WEB_REHEARSAL_RELEASE: `full-stack-${runId}`,
    WEB_IMAGE_TAG: `full-stack-${runId}`,
    WEB_REHEARSAL_API_URL: 'http://nginx',
  };

  const apiProfile = databaseMode === 'local' ? 'full-stack-api-rehearsal' : 'api-rehearsal';
  apiComposeArguments = buildComposeArgs(inventory, apiProfile, [], {
    repoRoot,
    projectName: apiProject,
    envFile: false,
  });
  webComposeArguments = buildComposeArgs(inventory, 'full-stack-web-rehearsal', [], {
    repoRoot,
    projectName: webProject,
    envFile: false,
  });
  createdNetworks = ensureProfileNetworks(getComposeProfile(inventory, apiProfile), {
    repoRoot,
    env: commandEnvironment,
  });
}

function serviceMemoryLimitMiB(config, serviceName) {
  const raw = config.services?.[serviceName]?.deploy?.resources?.limits?.memory;
  assert(raw !== undefined, `${serviceName} memory limit is missing.`);
  return Number(raw) / 1024 / 1024;
}

function verifyResourceBudget() {
  const apiConfig = JSON.parse(apiComposeOutput('config', '--format', 'json'));
  const webConfig = JSON.parse(webComposeOutput('config', '--format', 'json'));
  const productLimitMiB =
    serviceMemoryLimitMiB(apiConfig, 'api') +
    serviceMemoryLimitMiB(apiConfig, 'nginx') +
    ['web', 'prometheus', 'loki', 'alloy', 'alertmanager', 'grafana'].reduce(
      (sum, service) => sum + serviceMemoryLimitMiB(webConfig, service),
      0,
    );
  const databaseLimitMiB =
    databaseMode === 'local' ? serviceMemoryLimitMiB(apiConfig, 'postgres') : 0;

  assert(
    productLimitMiB === expectedProductContainerLimitMiB,
    `Product container limit must total ${expectedProductContainerLimitMiB}MiB; received ${productLimitMiB}MiB.`,
  );
  assert(
    productLimitMiB <= productEnvelopeMiB,
    `Product container limits exceed the ${productEnvelopeMiB}MiB envelope.`,
  );
  assert(
    databaseLimitMiB === (databaseMode === 'local' ? localDatabaseAllowanceMiB : 0),
    `Database allowance mismatch: ${databaseLimitMiB}MiB.`,
  );
  assert(!webConfig.services?.['web-upstream'], 'Full-stack profile includes the Web fixture.');

  evidence.envelope.productContainerLimitMiB = productLimitMiB;
  evidence.envelope.databaseContainerLimitMiB = databaseLimitMiB;
  evidence.envelope.engineHeadroomMiB =
    evidence.envelope.memoryMiB - productLimitMiB - databaseLimitMiB;
  recordScenario(
    'product-resource-budget',
    'pass',
    `${productLimitMiB}MiB product limits; ${databaseLimitMiB}MiB RDS-like local allowance; ${evidence.envelope.engineHeadroomMiB}MiB engine headroom`,
  );
  recordScenario('full-stack-fixture-exclusion', 'pass', 'web-upstream is not composed');
}

async function waitForHttp(url, label, expectedStatuses = [200], timeoutMs = 180_000, init) {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = 'unreachable';
  while (Date.now() < deadline) {
    try {
      const startedAt = performance.now();
      const response = await fetch(url, init);
      const latency = Math.round(performance.now() - startedAt);
      lastStatus = String(response.status);
      if (expectedStatuses.includes(response.status)) return { response, latency };
    } catch {
      lastStatus = 'unreachable';
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_000));
  }
  throw new Error(`${label} timed out with ${lastStatus}.`);
}

async function waitForPrometheusTarget() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const url = new URL(`http://127.0.0.1:${evidence.ports.prometheus}/api/v1/query`);
    url.searchParams.set('query', 'up{job="api"}');
    const response = await fetch(url);
    if (response.ok) {
      const payload = await response.json();
      const values = payload?.data?.result;
      if (Array.isArray(values) && values.some((entry) => entry.value?.[1] === '1')) return;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_500));
  }
  throw new Error('Prometheus API target did not become up.');
}

async function waitForApiLogs() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const end = BigInt(Date.now()) * 1_000_000n;
    const start = end - 10n * 60n * 1_000_000_000n;
    const url = new URL(`http://127.0.0.1:${evidence.ports.loki}/loki/api/v1/query_range`);
    url.searchParams.set('query', '{service="api"}');
    url.searchParams.set('start', String(start));
    url.searchParams.set('end', String(end));
    url.searchParams.set('limit', '20');
    const response = await fetch(url);
    if (response.ok) {
      const payload = await response.json();
      if (Array.isArray(payload?.data?.result) && payload.data.result.length > 0) return;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_500));
  }
  throw new Error('API container logs did not arrive in Loki.');
}

function runDatabaseGates(urls) {
  if (databaseMode === 'local') {
    apiCompose('up', '-d', '--wait', '--wait-timeout', '120', 'postgres');
    recordScenario('disposable-postgresql-18', 'pass', 'fresh local volume and PostgreSQL 18');
  }

  run('pnpm', ['api:db:deploy:migrate'], {
    env: { ...commandEnvironment, MIGRATION_DATABASE_URL: urls.host.migration },
    label: 'Prisma migrate deploy',
  });
  recordScenario('fresh-migration-deploy', 'pass', 'migration baseline applied');

  runDatabaseOperatorScript('infra/db/apply-role-grants.sh', {
    MIGRATION_DATABASE_URL: psqlDatabaseUrl(urls.container.migration),
  });
  recordScenario('database-role-grants', 'pass', 'application role baseline applied');

  runDatabaseOperatorScript('infra/db/smoke-role-grants.sh', {
    MIGRATION_DATABASE_URL: psqlDatabaseUrl(urls.container.migration),
    DATABASE_URL: psqlDatabaseUrl(urls.container.runtime),
    RETENTION_WORKER_DATABASE_URL: psqlDatabaseUrl(urls.container.retention),
    RETENTION_DISCLOSURE_DATABASE_URL: psqlDatabaseUrl(urls.container.disclosure),
  });
  recordScenario('database-credential-boundary', 'pass', 'runtime and retention grants verified');
}

function runDatabaseOperatorScript(script, environment) {
  const operatorEnvPath = resolve(
    temporaryDirectory,
    `${script.replaceAll('/', '-')}-${randomBytes(4).toString('hex')}.env`,
  );
  writeFileSync(
    operatorEnvPath,
    `${Object.entries(environment)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')}\n`,
    { mode: 0o600 },
  );
  const args = [
    'run',
    '--rm',
    ...(databaseMode === 'local' ? ['--network', apiNetwork] : []),
    '--volume',
    `${repoRoot}:/workspace:ro`,
    '--workdir',
    '/workspace',
    '--env-file',
    operatorEnvPath,
    postgresImage,
    'sh',
    script,
  ];
  try {
    runDocker(args, { label: script });
  } finally {
    rmSync(operatorEnvPath, { force: true });
  }
}

async function runProductAndObservabilitySmokes() {
  apiCompose('up', '-d', ...(skipBuild ? ['--no-build'] : ['--build']), 'api', 'nginx');
  webCompose('up', '-d', ...(skipBuild ? ['--no-build'] : ['--build']));

  const apiHealth = await waitForHttp(
    `http://127.0.0.1:${evidence.ports.api}/health`,
    'API health',
  );
  const apiReadiness = await waitForHttp(
    `http://127.0.0.1:${evidence.ports.api}/health/ready`,
    'API readiness',
  );
  const web = await waitForHttp(`http://127.0.0.1:${evidence.ports.web}/`, 'Web');
  await waitForHttp(`http://127.0.0.1:${evidence.ports.loki}/ready`, 'Loki');
  await waitForHttp(`http://127.0.0.1:${evidence.ports.prometheus}/-/ready`, 'Prometheus');
  await waitForHttp(`http://127.0.0.1:${evidence.ports.alloy}/-/ready`, 'Alloy');
  await waitForHttp(`http://127.0.0.1:${evidence.ports.grafana}/api/health`, 'Grafana');
  evidence.latencyMilliseconds.apiHealth = apiHealth.latency;
  evidence.latencyMilliseconds.apiReadiness = apiReadiness.latency;
  evidence.latencyMilliseconds.web = web.latency;
  recordScenario('api-nginx-readiness', 'pass', 'health and readiness returned 200');
  recordScenario('web-runtime-readiness', 'pass', 'Web root returned 200');

  const sessionResolution = await waitForHttp(
    `http://127.0.0.1:${evidence.ports.web}/api/auth/session/resolve`,
    'Web to API session resolution',
    [200],
    30_000,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' },
  );
  evidence.latencyMilliseconds.webApiBridge = sessionResolution.latency;
  recordScenario('web-api-bridge', 'pass', 'BFF reached the API through nginx');

  const anonymousMetrics = await fetch(`http://127.0.0.1:${evidence.ports.api}/internal/metrics`);
  assert(anonymousMetrics.status === 401, `Anonymous metrics returned ${anonymousMetrics.status}.`);
  const authorizedMetrics = await fetch(`http://127.0.0.1:${evidence.ports.api}/internal/metrics`, {
    headers: { Authorization: `Bearer ${secrets.metricsToken}` },
  });
  assert(authorizedMetrics.ok, `Authorized metrics returned ${authorizedMetrics.status}.`);
  recordScenario(
    'metrics-access-guard',
    'pass',
    'anonymous rejected and collector credential accepted',
  );

  await waitForPrometheusTarget();
  recordScenario('prometheus-api-target', 'pass', 'up{job="api"}=1');
  await waitForApiLogs();
  recordScenario('api-log-loki-ingest', 'pass', 'API stdout discovered by Alloy');
}

async function verifyObservabilityFailOpen() {
  const apiUrl = `http://127.0.0.1:${evidence.ports.api}/health`;
  const webUrl = `http://127.0.0.1:${evidence.ports.web}/`;
  const components = [
    { service: 'alloy', ready: `http://127.0.0.1:${evidence.ports.alloy}/-/ready` },
    { service: 'loki', ready: `http://127.0.0.1:${evidence.ports.loki}/ready` },
    {
      service: 'prometheus',
      ready: `http://127.0.0.1:${evidence.ports.prometheus}/-/ready`,
    },
    { service: 'grafana', ready: `http://127.0.0.1:${evidence.ports.grafana}/api/health` },
  ];

  for (const component of components) {
    webCompose('stop', component.service);
    await waitForHttp(apiUrl, `API during ${component.service} outage`, [200], 15_000);
    await waitForHttp(webUrl, `Web during ${component.service} outage`, [200], 15_000);
    const recoveryStartedAt = Date.now();
    webCompose('start', component.service);
    await waitForHttp(component.ready, `${component.service} recovery`, [200], 180_000);
    evidence.recoveryMilliseconds[component.service] = Date.now() - recoveryStartedAt;
    recordScenario(
      `observability-${component.service}-fail-open`,
      'pass',
      `recovered in ${evidence.recoveryMilliseconds[component.service]}ms`,
    );
  }
}

function verifyStressIsolation() {
  const rendered = apiComposeOutput('config');
  assert(!rendered.includes('AUTH_THROTTLE_LIMIT: 5000'), 'Stress throttle leaked into rehearsal.');
  assert(!rendered.includes('AUTH_LOGIN_BURST_LIMIT: 5000'), 'Stress login throttle leaked.');
  const apiProfile = getComposeProfile(inventory, 'full-stack-api-rehearsal');
  assert(
    apiProfile.files.every((path) => !path.includes('compose.stress.yml')),
    'Stress overlay is part of the full-stack profile.',
  );
  recordScenario('stress-policy-isolation', 'pass', 'stress overlay and high throttle are absent');
}

function verifyPrivatePorts() {
  const containerIds = allContainerIds();
  const inspections = JSON.parse(runDocker(['inspect', ...containerIds], { capture: true }));
  const exposed = [];
  for (const inspection of inspections) {
    for (const bindings of Object.values(inspection.NetworkSettings?.Ports ?? {})) {
      if (!Array.isArray(bindings)) continue;
      for (const binding of bindings) {
        exposed.push({
          container: inspection.Name.replace(/^\//u, ''),
          hostIp: binding.HostIp,
          hostPort: binding.HostPort,
        });
        assert(
          ['127.0.0.1', '::1'].includes(binding.HostIp),
          `${inspection.Name} publishes a non-loopback port.`,
        );
      }
    }
  }
  recordScenario('private-loopback-ports', 'pass', `${exposed.length} bindings are loopback-only`);
}

async function verifyRuntimeImagesDoNotContainGeneratedSecrets() {
  const containers = [
    apiComposeOutput('ps', '-q', 'api'),
    webComposeOutput('ps', '-q', 'web'),
  ].filter(Boolean);
  for (const container of containers) {
    const exportPath = resolve(temporaryDirectory, `${container}.tar`);
    runDocker(['export', '--output', exportPath, container], { label: 'Container export' });
    const leaked = await findSecretInFile(exportPath, secretValues);
    assert(!leaked, 'Generated runtime secret was found in a container filesystem.');
    rmSync(exportPath, { force: true });
  }
  recordScenario(
    'runtime-artifact-secret-scan',
    'pass',
    'generated secrets absent from API/Web filesystems',
  );
}

async function findSecretInFile(path, candidates) {
  const needles = candidates.map((value) => Buffer.from(value));
  const carryLength = Math.max(...needles.map((value) => value.length)) - 1;
  let carry = Buffer.alloc(0);
  for await (const chunk of createReadStream(path)) {
    const buffer = Buffer.concat([carry, chunk]);
    if (needles.some((needle) => buffer.indexOf(needle) !== -1)) return true;
    carry = buffer.subarray(Math.max(0, buffer.length - carryLength));
  }
  return false;
}

async function collectResourceHighWater() {
  const containerIds = allContainerIds();
  const samples = [];
  for (let index = 0; index < 3; index += 1) {
    const output = runDocker(['stats', '--no-stream', '--format', '{{json .}}', ...containerIds], {
      capture: true,
      label: 'Docker resource sample',
    });
    samples.push(
      ...output
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line)),
    );
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_000));
  }
  const highWater = new Map();
  for (const sample of samples) {
    const name = sample.Name;
    const current = highWater.get(name);
    const memoryPercent = Number.parseFloat(String(sample.MemPerc).replace('%', '')) || 0;
    const cpuPercent = Number.parseFloat(String(sample.CPUPerc).replace('%', '')) || 0;
    if (!current || memoryPercent > current.memoryPercent || cpuPercent > current.cpuPercent) {
      highWater.set(name, {
        name,
        cpuPercent,
        memoryPercent,
        memoryUsage: sample.MemUsage,
        pids: Number(sample.PIDs),
      });
    }
  }
  evidence.resourceHighWater = [...highWater.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  recordScenario('bounded-resource-snapshot', 'pass', `${highWater.size} containers sampled`);
}

function allContainerIds() {
  const ids = `${apiComposeOutput('ps', '-q')}\n${webComposeOutput('ps', '-q')}`
    .split(/\s+/u)
    .filter(Boolean);
  assert(ids.length > 0, 'No rehearsal containers are running.');
  return [...new Set(ids)];
}

function cleanup() {
  evidence.cleanup.attempted = true;
  if (keepRunning) return;
  if (!apiComposeArguments || !webComposeArguments) {
    evidence.cleanup.firstPass = true;
    evidence.cleanup.secondPass = true;
    evidence.cleanup.resourcesRemaining = 0;
    return;
  }
  const cleanupPass = () => {
    safeComposeDown(webComposeArguments, 'Web cleanup');
    safeComposeDown(apiComposeArguments, 'API cleanup');
    cleanupUnusedNetworks(createdNetworks, { repoRoot, env: commandEnvironment });
  };
  cleanupPass();
  evidence.cleanup.firstPass = noProjectResourcesRemain();
  cleanupPass();
  evidence.cleanup.secondPass = noProjectResourcesRemain();
  evidence.cleanup.resourcesRemaining = evidence.cleanup.secondPass ? 0 : countProjectResources();
  if (evidence.cleanup.firstPass && evidence.cleanup.secondPass) {
    recordScenario('cleanup-idempotency', 'pass', 'two cleanup passes left no project resources');
  } else {
    recordScenario('cleanup-idempotency', 'fail', 'project resources remain after cleanup');
  }
}

function safeComposeDown(arguments_, label) {
  const result = spawnSync('docker', [...arguments_, 'down', '--volumes', '--remove-orphans'], {
    cwd: repoRoot,
    env: commandEnvironment,
    stdio: 'ignore',
  });
  if (result.status !== 0) process.stderr.write(`${label} returned ${result.status}.\n`);
}

function countProjectResources() {
  const projects = [apiProject, webProject];
  const containers = projects.flatMap((project) =>
    runDocker(['ps', '-aq', '--filter', `label=com.docker.compose.project=${project}`], {
      capture: true,
      label: 'Cleanup container inspection',
    })
      .split(/\s+/u)
      .filter(Boolean),
  );
  const volumes = projects.flatMap((project) =>
    runDocker(['volume', 'ls', '-q', '--filter', `label=com.docker.compose.project=${project}`], {
      capture: true,
      label: 'Cleanup volume inspection',
    })
      .split(/\s+/u)
      .filter(Boolean),
  );
  return containers.length + volumes.length;
}

function noProjectResourcesRemain() {
  return countProjectResources() === 0;
}

function sanitizeFailure(error) {
  let message = error instanceof Error ? error.message : String(error);
  for (const secret of secretValues) message = message.replaceAll(secret, '[redacted]');
  return message.replace(/postgres(?:ql)?:\/\/[^\s]+/giu, '[redacted-database-url]');
}

function writeEvidence() {
  mkdirSync(evidenceDirectory, { recursive: true });
  evidence.completedAt = new Date().toISOString();
  const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
  for (const secret of secretValues) {
    assert(!serialized.includes(secret), 'Secret value reached rehearsal evidence.');
  }
  assert(!/postgres(?:ql)?:\/\//iu.test(serialized), 'Database URL reached rehearsal evidence.');
  writeFileSync(evidenceJsonPath, serialized);
  writeFileSync(evidenceMarkdownPath, renderMarkdownEvidence(evidence));
}

function renderMarkdownEvidence(result) {
  const scenarioRows = result.scenarios
    .map((scenario) => `| ${scenario.name} | ${scenario.status} | ${scenario.detail} |`)
    .join('\n');
  const resourceRows = result.resourceHighWater
    .map(
      (resource) =>
        `| ${resource.name} | ${resource.cpuPercent}% | ${resource.memoryUsage} | ${resource.memoryPercent}% | ${resource.pids} |`,
    )
    .join('\n');
  return `# Full-stack local infrastructure rehearsal\n\n- Run: \`${result.runId}\`\n- Status: \`${result.status}\`\n- Started: ${result.startedAt}\n- Completed: ${result.completedAt}\n- Docker engine: ${result.envelope?.cpus ?? '?'} CPU / ${result.envelope?.memoryMiB ?? '?'}MiB\n- Product envelope: ${result.envelope?.productEnvelopeMiB ?? '?'}MiB\n- Product container limits: ${result.envelope?.productContainerLimitMiB ?? '?'}MiB\n- Local PostgreSQL allowance: ${result.envelope?.databaseAllowanceMiB ?? '?'}MiB\n- Engine headroom after limits: ${result.envelope?.engineHeadroomMiB ?? '?'}MiB\n- Database mode: \`${result.databaseMode}\`\n- Blocker: ${result.blocker ?? 'none'}\n\n## Scenario results\n\n| Scenario | Status | Detail |\n| --- | --- | --- |\n${scenarioRows}\n\n## Resource high-water samples\n\n| Container | CPU | Memory | Memory % | PIDs |\n| --- | ---: | --- | ---: | ---: |\n${resourceRows || '| none | | | | |'}\n\n## Cleanup\n\n- First pass: ${result.cleanup.firstPass}\n- Second pass: ${result.cleanup.secondPass}\n- Remaining resources: ${result.cleanup.resourcesRemaining}\n\nThis local result does not replace production target evidence.\n`;
}

async function main() {
  try {
    await allocatePorts();
    validateDockerEnvelope();
    const urls = databaseUrls();
    writeRuntimeInputs(urls);
    configureCompose();

    apiCompose('config', '-q');
    webCompose('config', '-q');
    recordScenario(
      'full-stack-compose-render',
      'pass',
      'API/DB and Web/observability profiles render',
    );
    verifyResourceBudget();
    verifyStressIsolation();
    runDatabaseGates(urls);
    await runProductAndObservabilitySmokes();
    verifyPrivatePorts();
    await verifyRuntimeImagesDoNotContainGeneratedSecrets();
    await collectResourceHighWater();
    await verifyObservabilityFailOpen();
    evidence.status = 'pass';
  } catch (error) {
    evidence.status = 'fail';
    evidence.blocker = sanitizeFailure(error);
    recordScenario('rehearsal-blocker', 'fail', evidence.blocker);
  } finally {
    cleanup();
    rmSync(temporaryDirectory, { recursive: true, force: true });
    writeEvidence();
  }

  process.stdout.write(`Full-stack rehearsal evidence: ${evidenceJsonPath}\n`);
  if (evidence.status !== 'pass' || (!keepRunning && !evidence.cleanup.secondPass)) process.exit(1);
}

await main();
