#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { resolveArtifactPath } from '../artifacts/paths.mjs';
import { buildComposeArgs, loadComposeInventory } from '../infra/compose-profile.mjs';
import { validateProductionObservabilityEnvironmentFile } from './production-environment.mjs';

const repoRoot = resolve(import.meta.dirname, '../..');
const temporaryDirectory = mkdtempSync('/tmp/knu-observability-production-');
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
      'OBSERVABILITY_NETWORK=knu-roommate-observability',
      'API_METRICS_TARGET=api:4000',
      'API_METRICS_SCHEME=http',
      `API_METRICS_BEARER_TOKEN_FILE=${tokenPath}`,
      'GRAFANA_ADMIN_USER=knu-operator',
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
  assertDeepEqual(operations.alloyDockerSocket.serviceAllowlist, ['api', 'nginx', 'web']);
  assertDeepEqual(
    [...operations.volumes.map((volume) => volume.name)].sort(),
    Object.keys(config.volumes).sort(),
  );
  assert(operations.hostAlerts.owner === 'host-or-provider-monitoring', 'missing host alert owner');
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
