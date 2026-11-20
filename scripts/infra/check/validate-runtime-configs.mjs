#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveArtifactPath } from '../../artifacts/paths.mjs';
import { loadImageInventory, resolveImageReference } from '../artifacts/image-inventory.mjs';
import { renderMarkdownTable, runIngressSmoke } from '../user-host/ingress-smoke.mjs';
import { runAllDocumentChecks } from '../user-host/ssm-document-runtime.mjs';
import { runAlertmanagerRenderCheck } from '../../observability/production/alertmanager-render.mjs';
import { runAlloyPipelineCheck } from '../../observability/production/alloy-pipeline.mjs';

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
const temporaryDirectory = mkdtempSync('/tmp/dormduri-runtime-configs-');
const checks = [];

try {
  validateNginx();
  await validateUserHostIngress();
  validateUserHostDocument();
  validatePrometheus();
  validateLoki();
  validateAlloy();
  validateAlertmanager();
  // 운영 관측 설정은 host와 같이 관측 설정 image에서 꺼낸 파일로 시험한다(production-api-baseline D-AB14~D-AB16).
  const observabilityConfig = extractObservabilityConfig();
  validateProductionObservability(observabilityConfig);
  await validateObservabilityRuntime(observabilityConfig);

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

// 운영 rule의 promtool 시험(infra/observability/prometheus/tests). rule_files는 test 파일 기준 상대 경로다.
function validatePrometheusRuleTests() {
  const tests = readdirSync(resolve(repoRoot, 'infra/observability/prometheus/tests'))
    .filter((name) => name.endsWith('.test.yml'))
    .sort();
  if (!tests.length) fail('no Prometheus rule tests');
  runDocker('prometheus-rule-tests', [
    '--volume',
    `${resolve(repoRoot, 'infra/observability/prometheus')}:/etc/prometheus-src:ro`,
    '--workdir',
    '/etc/prometheus-src/tests',
    '--entrypoint',
    '/bin/promtool',
    requiredImage('prometheus'),
    'test',
    'rules',
    ...tests,
  ]);
}

// 관측 설정 image(infra/observability/Dockerfile)를 build해 document와 같이 `docker create`·`docker cp`로 꺼낸다. 꺼낸 tree는
// 일반 파일과 디렉터리뿐이고 Dockerfile COPY 원본과 같은 파일 목록이어야 한다.
function extractObservabilityConfig() {
  const source = resolve(repoRoot, 'infra/observability');
  const build = spawnSync(
    'docker',
    ['build', '--quiet', '--file', join(source, 'Dockerfile'), source],
    { cwd: repoRoot, encoding: 'utf8' },
  );
  if (build.status !== 0) {
    process.stderr.write(build.stderr ?? '');
    fail('observability config image build failed');
  }
  const image = build.stdout.trim();
  const created = spawnSync('docker', ['create', image, '/none'], { encoding: 'utf8' });
  if (created.status !== 0) fail('observability config image create failed');
  const container = created.stdout.trim();
  const directory = resolve(temporaryDirectory, 'observability-config');
  mkdirSync(directory);
  const copied = spawnSync(
    'docker',
    ['cp', `${container}:/dormduri-observability/.`, `${directory}/`],
    {
      encoding: 'utf8',
    },
  );
  spawnSync('docker', ['rm', '-f', container], { encoding: 'utf8' });
  spawnSync('docker', ['image', 'rm', image], { encoding: 'utf8' });
  if (copied.status !== 0) fail('observability config copy failed');
  const extracted = walk(directory);
  const expected = [
    'alloy/config.alloy',
    'alloy/pipeline.alloy',
    'loki/loki.yml',
    'prometheus/prometheus.production.yml',
    'alertmanager/alertmanager.production.yml',
    ...[
      'loki/rules',
      'prometheus/rules',
      'alertmanager/templates',
      'grafana/provisioning',
      'grafana/dashboards',
    ].flatMap((path) => walk(join(source, path)).map((file) => `${path}/${file}`)),
  ].sort();
  if (JSON.stringify(extracted) !== JSON.stringify(expected)) {
    console.error(`extracted: ${extracted.join(', ')}\nexpected: ${expected.join(', ')}`);
    fail('observability config image files differ from the Dockerfile COPY sources');
  }
  checks.push({ name: 'observability-config-image', files: extracted.length });
  return directory;
}

function walk(root) {
  const files = [];
  const visit = (path) => {
    for (const name of readdirSync(path)) {
      const child = join(path, name);
      const stat = lstatSync(child);
      if (stat.isDirectory()) visit(child);
      else if (stat.isFile()) files.push(relative(root, child));
      else fail(`observability config holds a non-regular file: ${relative(root, child)}`);
    }
  };
  visit(root);
  return files.sort();
}

// user host 관측 조각과 같은 경로로 mount해 운영 설정 다섯을 검사한다.
function validateProductionObservability(config) {
  const secrets = resolve(temporaryDirectory, 'observability-secrets');
  mkdirSync(secrets);
  writeFileSync(join(secrets, 'api-metrics-bearer-token'), 'ci-fixture-token');
  writeFileSync(
    join(secrets, 'slack-webhook-url'),
    'https://hooks.slack.com/services/fixture/fixture/fixture',
  );
  const secret = (name) => [
    '--volume',
    `${join(secrets, name)}:/run/secrets/dormduri-observability/${name}:ro`,
  ];
  runDocker('prometheus-production', [
    '--volume',
    `${join(config, 'prometheus')}:/etc/prometheus:ro`,
    ...secret('api-metrics-bearer-token'),
    '--entrypoint',
    '/bin/promtool',
    requiredImage('prometheus'),
    'check',
    'config',
    '/etc/prometheus/prometheus.production.yml',
  ]);
  validatePrometheusRuleTests();
  runDocker('loki-production', [
    '--volume',
    `${join(config, 'loki/loki.yml')}:/etc/loki/loki.yml:ro`,
    '--entrypoint',
    '/usr/bin/loki',
    requiredImage('loki'),
    '-verify-config',
    '-config.file=/etc/loki/loki.yml',
  ]);
  runDocker('alloy-production', [
    '--env',
    'OBSERVABILITY_ENV=production',
    '--env',
    'OBSERVABILITY_COMPOSE_PROJECT=dormduri-web',
    '--volume',
    `${join(config, 'alloy')}:/etc/alloy:ro`,
    '--entrypoint',
    '/bin/alloy',
    requiredImage('alloy'),
    'validate',
    '/etc/alloy/config.alloy',
  ]);
  runDocker('alertmanager-production', [
    '--volume',
    `${join(config, 'alertmanager')}:/etc/alertmanager:ro`,
    ...secret('slack-webhook-url'),
    '--entrypoint',
    '/bin/amtool',
    requiredImage('alertmanager'),
    'check-config',
    '/etc/alertmanager/alertmanager.production.yml',
  ]);
}

// 실제 Alloy·Loki로 log 가림, 실제 Alertmanager로 Slack payload를 확인한다.
async function validateObservabilityRuntime(config) {
  const alloy = await runAlloyPipelineCheck({
    alloyDirectory: join(config, 'alloy'),
    lokiConfig: join(config, 'loki/loki.yml'),
    alloyImage: requiredImage('alloy'),
    lokiImage: requiredImage('loki'),
  });
  if (alloy.problems.length) {
    console.error(alloy.problems.join('\n'));
    fail('Alloy log pipeline fixture check failed');
  }
  checks.push({
    name: 'alloy-log-pipeline',
    images: [requiredImage('alloy'), requiredImage('loki')],
    stored: alloy.stored,
  });
  const alertmanager = await runAlertmanagerRenderCheck({
    repoRoot,
    configDirectory: join(config, 'alertmanager'),
    alertmanagerImage: requiredImage('alertmanager'),
    nodeImage: requiredImage('web-build-node'),
  });
  if (alertmanager.problems.length) {
    console.error(alertmanager.problems.join('\n'));
    fail('Alertmanager Slack payload check failed');
  }
  checks.push({
    name: 'alertmanager-slack-payload',
    image: requiredImage('alertmanager'),
    payloads: alertmanager.payloads,
  });
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
    `${resolve(repoRoot, 'infra/observability/alloy')}:/etc/alloy:ro`,
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
