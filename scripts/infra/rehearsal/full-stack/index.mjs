#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createReadStream, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { resolveArtifactPath } from '../../../artifacts/paths.mjs';
import {
  buildComposeArgs,
  cleanupUnusedNetworks,
  ensureProfileNetworks,
  getComposeProfile,
  loadComposeInventory,
} from '../../compose/profile.mjs';
import { cleanupRehearsal } from './cleanup.mjs';
import { runDatabaseGates } from './database-gates.mjs';
import { sanitizeFailure, writeRehearsalEvidence } from './evidence.mjs';
import {
  verifyObservabilityFailOpen,
  waitForApiLogs,
  waitForPrometheusTarget,
} from './observability-gates.mjs';
import { verifyResourceBudget } from './resource-budget.mjs';
import {
  allocateLoopbackPorts,
  createRuntimeSecrets,
  resolveDatabaseUrls,
  writeApiRuntimeInputs,
} from './runtime-inputs.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../..');
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
  'postgres:18.6-alpine@sha256:d3e1620b530c944afa6e887d22eb899824da68e19c52024bf98f5220c88a65b2';

const secrets = createRuntimeSecrets();
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

  await waitForPrometheusTarget({ port: evidence.ports.prometheus });
  recordScenario('prometheus-api-target', 'pass', 'up{job="api"}=1');
  await waitForApiLogs({ port: evidence.ports.loki });
  recordScenario('api-log-loki-ingest', 'pass', 'API stdout discovered by Alloy');
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

async function main() {
  try {
    evidence.ports = await allocateLoopbackPorts([
      'api',
      'web',
      'postgres',
      'grafana',
      'loki',
      'prometheus',
      'alloy',
      'alertmanager',
    ]);
    validateDockerEnvelope();
    const urls = resolveDatabaseUrls({
      databaseMode,
      ports: evidence.ports,
      secrets,
      environment: process.env,
      assert,
    });
    writeApiRuntimeInputs({ runtimeEnvPath, metricsTokenPath, urls, secrets });
    configureCompose();

    apiCompose('config', '-q');
    webCompose('config', '-q');
    recordScenario(
      'full-stack-compose-render',
      'pass',
      'API/DB and Web/observability profiles render',
    );
    const resourceBudget = verifyResourceBudget({
      apiConfig: JSON.parse(apiComposeOutput('config', '--format', 'json')),
      webConfig: JSON.parse(webComposeOutput('config', '--format', 'json')),
      databaseMode,
      productEnvelopeMiB,
      localDatabaseAllowanceMiB,
      expectedProductContainerLimitMiB,
      engineMemoryMiB: evidence.envelope.memoryMiB,
      assert,
      recordScenario,
    });
    evidence.envelope.productContainerLimitMiB = resourceBudget.productLimitMiB;
    evidence.envelope.databaseContainerLimitMiB = resourceBudget.databaseLimitMiB;
    evidence.envelope.engineHeadroomMiB = resourceBudget.engineHeadroomMiB;
    verifyStressIsolation();
    runDatabaseGates({
      databaseMode,
      urls,
      commandEnvironment,
      apiCompose,
      run,
      runOperatorScript: runDatabaseOperatorScript,
      recordScenario,
    });
    await runProductAndObservabilitySmokes();
    verifyPrivatePorts();
    await verifyRuntimeImagesDoNotContainGeneratedSecrets();
    await collectResourceHighWater();
    await verifyObservabilityFailOpen({
      ports: evidence.ports,
      webCompose,
      waitForHttp,
      recoveryMilliseconds: evidence.recoveryMilliseconds,
      recordScenario,
    });
    evidence.status = 'pass';
  } catch (error) {
    evidence.status = 'fail';
    evidence.blocker = sanitizeFailure(error, secretValues);
    recordScenario('rehearsal-blocker', 'fail', evidence.blocker);
  } finally {
    cleanupRehearsal({
      evidence,
      keepRunning,
      apiComposeArguments,
      webComposeArguments,
      safeComposeDown,
      cleanupNetworks: () =>
        cleanupUnusedNetworks(createdNetworks, { repoRoot, env: commandEnvironment }),
      noProjectResourcesRemain,
      countProjectResources,
      recordScenario,
    });
    rmSync(temporaryDirectory, { recursive: true, force: true });
    writeRehearsalEvidence({
      evidence,
      evidenceDirectory,
      evidenceJsonPath,
      evidenceMarkdownPath,
      secretValues,
      assert,
    });
  }

  process.stdout.write(`Full-stack rehearsal evidence: ${evidenceJsonPath}\n`);
  if (evidence.status !== 'pass' || (!keepRunning && !evidence.cleanup.secondPass)) process.exit(1);
}

await main();
