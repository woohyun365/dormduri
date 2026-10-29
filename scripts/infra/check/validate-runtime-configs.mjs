#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveArtifactPath } from '../../artifacts/paths.mjs';
import { loadImageInventory, resolveImageReference } from '../artifacts/image-inventory.mjs';

const repoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const outputArg = process.argv.find((argument) => argument.startsWith('--output='));
const outputPath = outputArg
  ? resolve(repoRoot, outputArg.slice('--output='.length))
  : resolveArtifactPath(repoRoot, ['infra', 'runtime-configs.json']);
const images = new Map(
  loadImageInventory(repoRoot).images.map((image) => [
    image.name,
    resolveImageReference(repoRoot, image),
  ]),
);
const temporaryDirectory = mkdtempSync('/tmp/knu-runtime-configs-');
const checks = [];

try {
  validateNginx();
  validatePrometheus();
  validateLoki();
  validateAlloy();
  validateAlertmanager();

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(
    outputPath,
    `${JSON.stringify(
      {
        version: 1,
        validatedAt: new Date().toISOString(),
        checks,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Validated ${checks.length} runtime configurations. Evidence: ${outputPath}`);
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

function validateNginx() {
  runDocker('nginx', [
    '--add-host',
    'api:127.0.0.1',
    '--volume',
    `${resolve(repoRoot, 'infra/deploy/nginx/nginx.conf')}:/etc/nginx/nginx.conf:ro`,
    '--volume',
    `${resolve(repoRoot, 'infra/deploy/nginx/conf.d')}:/etc/nginx/conf.d:ro`,
    '--volume',
    `${resolve(repoRoot, 'infra/deploy/nginx/snippets')}:/etc/nginx/snippets:ro`,
    '--entrypoint',
    'nginx',
    requiredImage('api-ingress'),
    '-t',
  ]);
}

function validatePrometheus() {
  const renderedConfig = readFileSync(
    resolve(repoRoot, 'infra/observability/prometheus/prometheus.yml'),
    'utf8',
  )
    .replaceAll('__API_METRICS_SCHEME__', 'http')
    .replaceAll('__API_METRICS_TARGET__', 'api.invalid:4000')
    .replaceAll('__OBSERVABILITY_ENV__', 'ci');
  const configPath = resolve(temporaryDirectory, 'prometheus.yml');
  const tokenPath = resolve(temporaryDirectory, 'metrics-token');
  writeFileSync(configPath, renderedConfig);
  writeFileSync(tokenPath, 'ci-fixture-token');
  runDocker('prometheus', [
    '--volume',
    `${configPath}:/etc/prometheus/prometheus.yml:ro`,
    '--volume',
    `${resolve(repoRoot, 'infra/observability/prometheus/rules')}:/etc/prometheus/rules:ro`,
    '--volume',
    `${tokenPath}:/etc/prometheus/secrets/api-metrics-bearer-token:ro`,
    '--entrypoint',
    '/bin/promtool',
    requiredImage('prometheus'),
    'check',
    'config',
    '/etc/prometheus/prometheus.yml',
  ]);
}

function validateLoki() {
  runDocker('loki', [
    '--volume',
    `${resolve(repoRoot, 'infra/observability/loki/loki.yml')}:/etc/loki/loki.yml:ro`,
    '--volume',
    `${resolve(repoRoot, 'infra/observability/loki/rules')}:/loki/rules/fake:ro`,
    '--entrypoint',
    '/usr/bin/loki',
    requiredImage('loki'),
    '-verify-config',
    '-config.file=/etc/loki/loki.yml',
  ]);
}

function validateAlloy() {
  runDocker('alloy', [
    '--env',
    'OBSERVABILITY_ENV=ci',
    '--volume',
    `${resolve(repoRoot, 'infra/observability/alloy/config.alloy')}:/etc/alloy/config.alloy:ro`,
    '--entrypoint',
    '/bin/alloy',
    requiredImage('alloy'),
    'validate',
    '/etc/alloy/config.alloy',
  ]);
}

function validateAlertmanager() {
  for (const [name, templateName, webhook] of [
    ['alertmanager-noop', 'alertmanager.noop.yml.template', ''],
    [
      'alertmanager-slack',
      'alertmanager.yml.template',
      'https://hooks.slack.com/services/fixture/fixture/fixture',
    ],
  ]) {
    const rendered = readFileSync(
      resolve(repoRoot, `infra/observability/alertmanager/${templateName}`),
      'utf8',
    )
      .replaceAll('__SLACK_ALERT_WEBHOOK_URL__', webhook)
      .replaceAll('__SLACK_ALERT_CHANNEL__', '#ci-alerts')
      .replaceAll('__OBSERVABILITY_ENV__', 'ci');
    const configPath = resolve(temporaryDirectory, `${name}.yml`);
    writeFileSync(configPath, rendered);
    runDocker(name, [
      '--volume',
      `${configPath}:/etc/alertmanager/alertmanager.yml:ro`,
      '--volume',
      `${resolve(repoRoot, 'infra/observability/alertmanager/templates')}:/etc/alertmanager/templates:ro`,
      '--entrypoint',
      '/bin/amtool',
      requiredImage('alertmanager'),
      'check-config',
      '/etc/alertmanager/alertmanager.yml',
    ]);
  }
}

function requiredImage(name) {
  const image = images.get(name);
  if (!image) fail(`Missing image inventory entry: ${name}`);
  return image;
}

function runDocker(name, args) {
  const result = spawnSync('docker', ['run', '--rm', ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    fail(`${name} runtime configuration validation failed`);
  }
  checks.push({ name, image: args.find((argument) => argument.includes('@sha256:')) });
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
