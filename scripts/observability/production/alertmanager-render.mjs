// 운영 Alertmanager 설정(alertmanager.production.yml + templates/slack.tmpl)이 Slack에 보내는 실제 payload 시험(production-api-
// baseline D-AB16, issue #240). 실제 Alertmanager가 webhook URL 파일이 가리키는 capture server로 보낸 body를 judge가 대조한다.
// fixture label·annotation 이름은 DB의 secret·content·identifier 열 이름이고(packages/database/prisma/role-grants/column-classes.csv),
// 그 값과 닫힌 label에 넣은 허용 밖 값이 payload 어디에도(fallback·title·text·footer) 없어야 한다. critical firing에만
// `<!channel>`이 붙는다. 판정(judge)은 container 없이 돌고(alertmanager-render.test.mjs), 실행은
// scripts/infra/check/validate-runtime-configs.mjs가 부른다.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const FIXTURE_LABEL =
  'dormduri.local.created-by=scripts/observability/production/alertmanager-render.mjs';
const FORBIDDEN_CLASSES = new Set(['secret', 'content', 'identifier']);
// template이 출력하는 annotation. rule 파일이 고정 문구만 두는 두 값이라(API 경보 contract test가 고정) fixture도 고정 문구다.
const PRINTED_ANNOTATIONS = new Set(['summary', 'runbook']);

export function forbiddenColumnNames(csvText) {
  const names = new Set();
  for (const line of csvText.trim().split('\n').slice(1)) {
    const [, column, columnClass] = line.split(',');
    if (FORBIDDEN_CLASSES.has(columnClass) && /^[A-Za-z_][A-Za-z0-9_]*$/u.test(column))
      names.add(column);
  }
  return [...names].sort();
}

// critical: 열 이름을 label·annotation 이름으로 단 alert. 허용 label은 닫힌 값이다.
// warning: 허용 label 자리에 허용 밖 값을 넣은 alert. 모두 `redacted`·`unknown`·기본 runbook으로 바뀌어야 한다.
export function buildFixtures(columns) {
  const sentinel = (index) => `dormduri-fixture-sentinel-${String(index).padStart(3, '0')}`;
  const extraLabels = Object.fromEntries(columns.map((name, index) => [name, sentinel(index)]));
  const extraAnnotations = Object.fromEntries(
    columns
      .filter((name) => !PRINTED_ANNOTATIONS.has(name))
      .map((name, index) => [name, sentinel(columns.length + index)]),
  );
  const leaked = [
    'owner@example.com',
    '203.0.113.9',
    'Bearer fixture-token-value',
    'https://evil.example/?token=fixture',
    'redact-me-alertname',
  ];
  const critical = {
    labels: {
      ...extraLabels,
      alertname: 'DormduriFixtureCritical',
      severity: 'critical',
      service: 'api',
      env: 'production',
    },
    annotations: {
      ...extraAnnotations,
      summary: 'fixture critical summary',
      runbook: 'infra/runbooks/operations/observability/production-stack.md#경보-대응',
    },
  };
  const warning = {
    labels: {
      alertname: leaked[4],
      severity: 'warning',
      service: leaked[0],
      env: leaked[1],
    },
    // runbook: 저장소 경로 뒤 anchor 자리에 URL·token을 넣는다. 경로 형식 밖이라 기본 runbook으로 바뀌어야 한다.
    annotations: {
      summary: 'fixture warning summary',
      runbook: `infra/observability/README.md#${leaked[3]}`,
      description: leaked[2],
    },
  };
  const sentinels = [...Object.values(extraLabels), ...Object.values(extraAnnotations), ...leaked];
  return { alerts: [critical, warning], sentinels };
}

const textOf = (payload) =>
  JSON.stringify(payload) + (payload.attachments ?? []).map((item) => item.text ?? '').join('\n');

// payloads: capture server가 받은 Slack body 목록. 문제 목록(빈 목록 = 통과)을 돌려준다.
export function judgeSlackPayloads(payloads, sentinels) {
  const problems = [];
  const byTitle = (pattern) =>
    payloads.filter((payload) => pattern.test(payload.attachments?.[0]?.title ?? ''));
  const critical = byTitle(/^\[FIRING\] critical api\/DormduriFixtureCritical$/u);
  const warning = byTitle(/^\[FIRING\] warning redacted\/redacted$/u);
  if (critical.length !== 1) problems.push(`expected one critical payload, got ${critical.length}`);
  if (warning.length !== 1)
    problems.push(`expected one redacted warning payload, got ${warning.length}`);
  if (payloads.length !== 2) problems.push(`expected two payloads, got ${payloads.length}`);
  for (const payload of payloads) {
    if (payload.channel !== '#dormduri-alerts') problems.push('payload channel differs');
    const text = textOf(payload);
    for (const value of sentinels) {
      if (text.includes(value)) problems.push(`payload holds ${value}`);
    }
    const fallback = payload.attachments?.[0]?.fallback ?? '';
    if (fallback !== payload.attachments?.[0]?.title)
      problems.push(`fallback is not the title: ${fallback}`);
  }
  if (critical[0]) {
    const text = critical[0].attachments[0].text;
    if (!text.startsWith('<!channel> ')) problems.push('critical payload lacks <!channel>');
    if (!text.includes('• *summary*: fixture critical summary'))
      problems.push('critical summary is missing');
    if (
      !text.includes(
        '• *runbook*: infra/runbooks/operations/observability/production-stack.md#경보-대응',
      )
    )
      problems.push('critical runbook is missing');
    if (!text.includes('• *env*: production')) problems.push('critical env is missing');
  }
  if (warning[0]) {
    const text = warning[0].attachments[0].text;
    if (text.includes('<!channel>')) problems.push('warning payload mentions the channel');
    if (!text.includes('• *env*: unknown')) problems.push('an unknown env is not replaced');
    if (!text.includes('• *runbook*: infra/observability/README.md'))
      problems.push('an unknown runbook is not replaced');
    if (!text.includes('alertname=redacted, service=redacted, severity=warning'))
      problems.push('closed labels are not redacted');
  }
  return problems;
}

// capture server: 받은 body를 한 줄 JSON으로 stdout에 쓴다(docker logs로 읽는다).
const CAPTURE = `require('node:http').createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    process.stdout.write('CAPTURED ' + JSON.stringify({ path: req.url, body }) + '\\n');
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
  });
}).listen(8080);`;

function docker(args, options = {}) {
  const result = spawnSync('docker', args, { encoding: 'utf8', ...options });
  if (result.status !== 0 && !options.allowFailure)
    throw new Error(`docker ${args.slice(0, 2).join(' ')} failed: ${result.stderr.trim()}`);
  return result;
}
const sleep = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds));

// configDirectory: 관측 설정 image에서 꺼낸 alertmanager 디렉터리(host가 /etc/alertmanager로 mount하는 그 내용).
export async function runAlertmanagerRenderCheck({
  repoRoot,
  configDirectory,
  alertmanagerImage,
  nodeImage,
}) {
  const columns = forbiddenColumnNames(
    readFileSync(
      resolve(repoRoot, 'packages/database/prisma/role-grants/column-classes.csv'),
      'utf8',
    ),
  );
  const { alerts, sentinels } = buildFixtures(columns);
  const run = `${process.pid}-${Date.now()}`;
  const network = `dormduri-am-check-${run}`;
  const capture = `dormduri-am-check-capture-${run}`;
  const alertmanager = `dormduri-am-check-am-${run}`;
  const secrets = mkdtempSync(join(tmpdir(), 'dormduri-am-check-'));
  writeFileSync(join(secrets, 'slack-webhook-url'), 'http://capture:8080/services/fixture\n');
  try {
    docker(['network', 'create', '--label', FIXTURE_LABEL, network]);
    docker([
      'run',
      '-d',
      '--name',
      capture,
      '--network',
      network,
      '--network-alias',
      'capture',
      '--label',
      FIXTURE_LABEL,
      '--entrypoint',
      'node',
      nodeImage,
      '-e',
      CAPTURE,
    ]);
    docker([
      'run',
      '-d',
      '--name',
      alertmanager,
      '--network',
      network,
      '--label',
      FIXTURE_LABEL,
      '-p',
      '127.0.0.1::9093',
      '-v',
      `${configDirectory}:/etc/alertmanager:ro`,
      '-v',
      `${join(secrets, 'slack-webhook-url')}:/run/secrets/dormduri-observability/slack-webhook-url:ro`,
      alertmanagerImage,
      '--config.file=/etc/alertmanager/alertmanager.production.yml',
      '--storage.path=/tmp/alertmanager',
      '--cluster.listen-address=',
    ]);
    const port = docker(['port', alertmanager, '9093/tcp'])
      .stdout.trim()
      .split('\n')[0]
      .split(':')
      .pop();
    const base = `http://127.0.0.1:${port}`;
    const startsAt = new Date().toISOString();
    let posted = false;
    for (let attempt = 0; attempt < 60 && !posted; attempt += 1) {
      try {
        const response = await fetch(`${base}/api/v2/alerts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alerts.map((alert) => ({ ...alert, startsAt }))),
        });
        posted = response.ok;
      } catch {
        // Alertmanager가 아직 듣지 않는다.
      }
      if (!posted) await sleep(1_000);
    }
    if (!posted)
      return { problems: ['Alertmanager did not accept the fixture alerts'], payloads: 0 };
    let payloads = [];
    for (let attempt = 0; attempt < 90; attempt += 1) {
      payloads = docker(['logs', capture])
        .stdout.split('\n')
        .filter((line) => line.startsWith('CAPTURED '))
        .map((line) => JSON.parse(JSON.parse(line.slice('CAPTURED '.length)).body));
      if (payloads.length >= alerts.length) break;
      await sleep(1_000);
    }
    await sleep(2_000);
    payloads = docker(['logs', capture])
      .stdout.split('\n')
      .filter((line) => line.startsWith('CAPTURED '))
      .map((line) => JSON.parse(JSON.parse(line.slice('CAPTURED '.length)).body));
    return { problems: judgeSlackPayloads(payloads, sentinels), payloads: payloads.length };
  } finally {
    docker(['rm', '-f', alertmanager, capture], { allowFailure: true });
    docker(['network', 'rm', network], { allowFailure: true });
    rmSync(secrets, { recursive: true, force: true });
  }
}
