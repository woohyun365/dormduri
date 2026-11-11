#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { resolveArtifactPath } from '../../artifacts/paths.mjs';
import { buildComposeArgs, loadComposeInventory } from '../../infra/compose/profile.mjs';
import {
  OBSERVABILITY_SECRET_TARGET,
  OBSERVABILITY_SERVICES,
  USER_HOST_RENDER_ENVIRONMENT,
} from '../../infra/user-host/compose-contract.mjs';
import { validateProductionObservabilityEnvironmentFile } from './environment.mjs';

const repoRoot = resolve(import.meta.dirname, '../../..');
const temporaryDirectory = mkdtempSync('/tmp/dormduri-observability-production-');
const outputArg = process.argv.find((argument) => argument.startsWith('--output='));
const outputPath = outputArg
  ? resolve(repoRoot, outputArg.slice('--output='.length))
  : resolveArtifactPath(repoRoot, ['infra', 'observability-production.json']);

try {
  assertLocalExampleIsRejected();
  const tokenPath = resolve(temporaryDirectory, 'metrics-token');
  const envPath = resolve(temporaryDirectory, 'observability.env');
  writeFileSync(tokenPath, 'ci-validation-token-material-32-characters-minimum');
  writeFileSync(
    envPath,
    [
      'OBSERVABILITY_ENV=production',
      'OBSERVABILITY_NETWORK=dormduri-observability',
      'API_METRICS_TARGET=api:4000',
      'API_METRICS_SCHEME=http',
      `API_METRICS_BEARER_TOKEN_FILE=${tokenPath}`,
      'GRAFANA_ADMIN_USER=dormduri-operator',
      'GRAFANA_ADMIN_PASSWORD=ci-validation-operator-secret',
      'PROMETHEUS_RETENTION=15d',
      'ALERTMANAGER_RETENTION=120h',
      'SLACK_ALERTMANAGER_ENABLED=false',
    ].join('\n'),
  );

  const environmentSummary = validateProductionObservabilityEnvironmentFile(envPath, {
    processEnvironment: {},
  });
  const inventory = loadComposeInventory(repoRoot);
  const rendered = spawnSync(
    'docker',
    buildComposeArgs(inventory, 'observability-production', ['config', '--format', 'json'], {
      repoRoot,
      envFile: envPath,
    }),
    { cwd: repoRoot, encoding: 'utf8' },
  );
  if (rendered.status !== 0) fail(rendered.stderr || rendered.stdout);
  const config = JSON.parse(rendered.stdout);
  const operations = JSON.parse(
    readFileSync(resolve(repoRoot, 'infra/observability/production-operations.json'), 'utf8'),
  );
  validateRenderedConfig(config, operations);
  assert(
    readFileSync(resolve(repoRoot, 'infra/observability/loki/loki.yml'), 'utf8').includes(
      `retention_period: ${operations.retention.loki}`,
    ),
    'Loki retention drifted from the production operations contract',
  );
  // 운영 관측 stack은 user host API 묶음 조각의 관측 다섯이다(production-api-baseline D-AB14).
  const bundle = renderUserHostBundle(inventory);
  const userHostStack = validateUserHostStack(bundle, operations);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(
    outputPath,
    `${JSON.stringify(
      {
        version: 1,
        validatedAt: new Date().toISOString(),
        profile: 'observability-production',
        services: Object.keys(config.services).sort(),
        environment: environmentSummary,
        publicPortsAllowed: operations.topology.publicPortsAllowed,
        resourceBudgets: Object.fromEntries(
          Object.entries(config.services).map(([name, service]) => [
            name,
            service.deploy.resources.limits,
          ]),
        ),
        volumeClassifications: operations.volumes,
        alloySocketRiskAcceptedForInitialHost: operations.alloyDockerSocket.allowedOnInitialHost,
        userHostBundle: userHostStack,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Production observability validation passed. Evidence: ${outputPath}`);
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

function assertLocalExampleIsRejected() {
  const envPath = resolve(repoRoot, 'infra/observability/.env.observability.example');
  try {
    validateProductionObservabilityEnvironmentFile(envPath, { processEnvironment: {} });
  } catch {
    return;
  }
  fail('local observability example was accepted as a production environment');
}

function validateRenderedConfig(config, operations) {
  const expectedServices = ['alertmanager', 'alloy', 'grafana', 'loki', 'prometheus'];
  assertDeepEqual(Object.keys(config.services).sort(), expectedServices);
  for (const [name, service] of Object.entries(config.services)) {
    assert(/:[^@\s]+@sha256:[a-f0-9]{64}$/u.test(service.image), `${name}: mutable image`);
    assert(service.deploy?.resources?.limits?.cpus, `${name}: missing CPU limit`);
    assert(service.deploy?.resources?.limits?.memory, `${name}: missing memory limit`);
    assert(service.logging?.driver === 'json-file', `${name}: unexpected log driver`);
    assert(service.logging?.options?.['max-size'] === '10m', `${name}: unbounded stdout log size`);
    assert(service.logging?.options?.['max-file'] === '3', `${name}: unbounded stdout log files`);
    for (const port of service.ports ?? []) {
      assert(port.host_ip === '127.0.0.1', `${name}: non-loopback published port`);
    }
  }

  for (const name of ['alertmanager', 'grafana', 'prometheus']) {
    assert(config.services[name].healthcheck, `${name}: missing container healthcheck`);
  }
  const socketMount = config.services.alloy.volumes.find(
    (volume) => volume.source === '/var/run/docker.sock',
  );
  assert(socketMount?.read_only === true, 'Alloy Docker socket mount must be read-only');
  assert(
    operations.alloyDockerSocket.readOnlyMountIsNotAuthorizationBoundary === true,
    'Alloy socket risk must not be represented as solved by :ro',
  );
  assertDeepEqual(operations.alloyDockerSocket.serviceAllowlist, ['api', 'ingress', 'web']);
  assertDeepEqual(
    [...operations.volumes.map((volume) => volume.name)].sort(),
    Object.keys(config.volumes).sort(),
  );
  assert(operations.hostAlerts.owner === 'prometheus-host-alerts', 'missing host alert owner');
}

function renderUserHostBundle(inventory) {
  const rendered = spawnSync(
    'docker',
    buildComposeArgs(inventory, 'user-host-bundle', ['config', '--format', 'json'], { repoRoot }),
    { cwd: repoRoot, encoding: 'utf8', env: { ...process.env, ...USER_HOST_RENDER_ENVIRONMENT } },
  );
  if (rendered.status !== 0) fail(rendered.stderr || rendered.stdout);
  return JSON.parse(rendered.stdout);
}

// user host 관측 다섯과 운영 계약(production-operations.json)·설정 image 파일의 대조. 구조 규칙(mount·user·network)은
// scripts/infra/user-host/compose-contract.mjs가 소유하고, 여기서는 보존·접근·경보 기준과 secret 경로가 맞는지 본다.
function validateUserHostStack(config, operations) {
  const readInfra = (path) => readFileSync(resolve(repoRoot, 'infra/observability', path), 'utf8');
  const names = Object.keys(OBSERVABILITY_SERVICES);
  const services = Object.fromEntries(names.map((name) => [name, config.services?.[name]]));
  for (const [name, service] of Object.entries(services)) {
    assert(service, `user host bundle: missing ${name}`);
    assert(/:[^@\s]+@sha256:[a-f0-9]{64}$/u.test(service.image), `${name}: mutable image`);
    for (const port of service.ports ?? []) {
      assert(port.host_ip === '127.0.0.1', `${name}: non-loopback published port`);
    }
    assert(service.logging?.options?.['max-size'] === '10m', `${name}: unbounded stdout log size`);
  }
  const { prometheus, alertmanager, grafana, alloy } = services;
  assert(
    prometheus.command.includes(`--storage.tsdb.retention.time=${operations.retention.prometheus}`),
    'Prometheus retention drifted from the production operations contract',
  );
  assert(
    alertmanager.command.includes(`--data.retention=${operations.retention.alertmanager}`),
    'Alertmanager retention drifted from the production operations contract',
  );
  assert(
    !prometheus.command.some((arg) => arg.includes('enable-lifecycle')),
    'Prometheus lifecycle API is on',
  );
  assertDeepEqual(
    Object.keys(config.volumes ?? {}).sort(),
    operations.volumes.map((volume) => volume.name).sort(),
  );
  assert(
    alloy.environment?.OBSERVABILITY_COMPOSE_PROJECT === operations.topology.composeProject,
    'Alloy collects beyond the user host compose project',
  );
  assert(grafana.environment?.GF_AUTH_ANONYMOUS_ENABLED === 'false', 'Grafana anonymous access');
  assert(grafana.environment?.GF_USERS_ALLOW_SIGN_UP === 'false', 'Grafana sign-up');
  assert(
    grafana.environment?.GF_SECURITY_ADMIN_PASSWORD__FILE ===
      `${OBSERVABILITY_SECRET_TARGET}/grafana-admin-password`,
    'Grafana admin password is not the mounted secret file',
  );
  assert(!('GF_SECURITY_ADMIN_PASSWORD' in (grafana.environment ?? {})), 'Grafana password in env');
  // 설정 image의 secret 경로가 조각의 mount target과 같다.
  assert(
    readInfra('prometheus/prometheus.production.yml').includes(
      `credentials_file: ${OBSERVABILITY_SECRET_TARGET}/api-metrics-bearer-token`,
    ),
    'Prometheus scrape token path differs from its secret mount',
  );
  const alertmanagerConfig = readInfra('alertmanager/alertmanager.production.yml');
  assert(
    alertmanagerConfig.includes(`api_url_file: ${OBSERVABILITY_SECRET_TARGET}/slack-webhook-url`),
    'Alertmanager webhook path differs from its secret mount',
  );
  assert(!/api_url:\s/u.test(alertmanagerConfig), 'Alertmanager config holds a webhook URL');
  // host 경보 기준이 운영 계약과 같다(warning은 critical 구간을 뺀다).
  const host = readInfra('prometheus/rules/host-alerts.yml');
  const { hostAlerts } = operations;
  for (const [metric, warning, critical] of [
    [
      'node_filesystem_avail_bytes',
      hostAlerts.diskUsedWarningPercent,
      hostAlerts.diskUsedCriticalPercent,
    ],
    [
      'node_filesystem_files_free',
      hostAlerts.inodeUsedWarningPercent,
      hostAlerts.inodeUsedCriticalPercent,
    ],
  ]) {
    const rules = host.split('- alert: ').filter((rule) => rule.includes(metric));
    assert(
      rules.some((rule) => rule.includes(`>= ${warning}\n          < ${critical}`)),
      `${metric} warning band`,
    );
    assert(
      rules.some((rule) => /severity: critical/u.test(rule) && rule.includes(`>= ${critical}\n`)),
      `${metric} critical`,
    );
  }
  assert(
    host.includes(`< ${(hostAlerts.memoryAvailableCriticalPercent / 100).toFixed(2)}`),
    'memory alert threshold drifted',
  );
  return {
    services: names,
    publishedPorts: Object.fromEntries(
      Object.entries(services).map(([name, service]) => [
        name,
        (service.ports ?? []).map((port) => `${port.host_ip}:${port.published}:${port.target}`),
      ]),
    ),
    resourceBudgets: Object.fromEntries(
      Object.entries(services).map(([name, service]) => [name, service.deploy.resources.limits]),
    ),
  };
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function assertDeepEqual(actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function fail(message) {
  throw new Error(String(message).trim());
}
