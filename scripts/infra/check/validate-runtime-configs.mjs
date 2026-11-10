#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveArtifactPath } from '../../artifacts/paths.mjs';
import { loadImageInventory, resolveImageReference } from '../artifacts/image-inventory.mjs';
import { renderMarkdownTable, runIngressSmoke } from '../user-host/ingress-smoke.mjs';
import { runAllDocumentChecks } from '../user-host/ssm-document-runtime.mjs';

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
  await validateUserHostIngress();
  validateUserHostDocument();
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

// Web 단계 ingress image: nginx -t와 경로별 정적 화면 선택(세 503이 같은 status라 응답의 <title>·header로 본다).
async function validateUserHostIngress() {
  const result = await runIngressSmoke({ repoRoot });
  const smokePath = resolveArtifactPath(repoRoot, ['infra', 'user-host-ingress-smoke.json']);
  mkdirSync(dirname(smokePath), { recursive: true });
  writeFileSync(smokePath, `${JSON.stringify(result, null, 2)}\n`);
  writeFileSync(smokePath.replace(/\.json$/u, '.md'), renderMarkdownTable(result));
  const failed = result.rows.filter((row) => !row.pass);
  if (failed.length) {
    for (const row of failed) {
      console.error(
        `${row.mode} ${row.method} ${row.host ?? ''}${row.path}: ${(row.problems ?? []).join('; ')}`,
      );
    }
    fail('user-host-ingress runtime configuration validation failed');
  }
  checks.push({
    name: 'user-host-ingress',
    image: result.nginxBase,
    requests: result.rows.length,
    rows: result.rows.map(
      ({ mode, scheme, host, method, path, status, title, retryAfter, xRobotsTag }) => ({
        mode,
        scheme,
        host,
        method,
        path,
        status,
        title,
        retryAfter,
        xRobotsTag,
      }),
    ),
  });
}

// User host SSM document 둘(web 묶음·API 묶음): 허용 밖 입력 거부와 host lock(겹친 실행은 75)이 Docker·AWS에 닿기 전에
// 끝나는지, 그리고 가짜 docker·aws(·curl) 위에서 배포·자동 복귀·점검 mode·rollback 대조·옛 기록 채택(web)과 migrate
// 순서·rollout 전 실패·secret 설치 검사(API)가 exit code와 host 상태로 맞는지. harness image는 web-build-node + python3다.
function validateUserHostDocument() {
  const image = requiredImage('web-build-node');
  const results = runAllDocumentChecks({ repoRoot, baseImage: image });
  const problems = results.flatMap(({ name, problems: found }) =>
    found.map((problem) => `${name}: ${problem}`),
  );
  if (problems.length) {
    console.error(problems.join('\n'));
    fail('user-host-document runtime validation failed');
  }
  for (const { name } of results) checks.push({ name, image });
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
