// Alloy log 처리 module(infra/observability/alloy/pipeline.alloy)의 fixture 시험(production-api-baseline D-AB15, OO-R1). 실제 Alloy가
// 운영 module을 import한 시험 설정으로 fixture 행을 받아 실제 Loki에 쓰고, Loki에 남은 행을 기대값과 대조한다. 판정(judge)은
// container 없이 돌고(alloy-pipeline.test.mjs), 실행(runAlloyPipelineCheck)은 scripts/infra/check/validate-runtime-configs.mjs가
// 부른다. Alloy가 host 지표 component 경로(Prometheus job host)를 내는지도 같은 container에서 본다.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const FIXTURE_LABEL =
  'dormduri.local.created-by=scripts/observability/production/alloy-pipeline.mjs';
const UUID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
const CUID = 'ckq8z1x2y0000abcdefghijkl';
const TOKEN = 'abcdefghijklmnopqrstuvwxyz0123';
// ingress가 만드는 request id(32 hex). 형식이 맞아 그대로 남는다.
const REQUEST_ID = '0f9e8d7c6b5a43218fedcba987654321';

// service, 입력 행, Loki에 남아야 하는 행. 입력의 원본 IP·query string·referer·경로 속 식별자는 sensitive에 적는다.
export const FIXTURES = Object.freeze([
  {
    service: 'ingress',
    input: `203.0.113.0/24 - [11/Nov/2026:10:00:00 +0900] "GET /notices/42 HTTP/1.1" 200 512 "fixture-agent-01 Chrome/130.0.0.0" "${REQUEST_ID}"`,
    expected: `203.0.113.0/24 - [11/Nov/2026:10:00:00 +0900] "GET /notices/:id HTTP/1.1" 200 512 "fixture-agent-01 Chrome/130.0.0.0" "${REQUEST_ID}"`,
  },
  {
    service: 'ingress',
    input: `198.51.100.23 - - [11/Nov/2026:10:00:01 +0900] "GET /api/users/${UUID}/threads/${CUID}?token=s3cr3t&email=a%40b.com HTTP/1.1" 404 10 "https://ref.example/page?q=referer-secret" "fixture-agent-02" "kim chulsoo@example.com"`,
    expected: `198.51.100.0/24 - [11/Nov/2026:10:00:01 +0900] "GET /api/users/:id/threads/:id HTTP/1.1" 404 10 "fixture-agent-02" "-"`,
  },
  {
    service: 'ingress',
    input: `2001:db8:1234:5678::1 - - [11/Nov/2026:10:00:02 +0900] "POST /reset/${TOKEN} HTTP/2.0" 400 0 "-" "fixture-agent-03" ""`,
    expected: `2001:db8:1234::/48 - [11/Nov/2026:10:00:02 +0900] "POST /reset/:id HTTP/2.0" 400 0 "fixture-agent-03" "-"`,
  },
  {
    service: 'ingress',
    input: `2001:db8::7 - - [11/Nov/2026:10:00:03 +0900] "GET /a/owner@example.com/b HTTP/1.1" 200 1 "-" "fixture-agent-04" "short"`,
    expected: `2001:db8::/48 - [11/Nov/2026:10:00:03 +0900] "GET /a/:id/b HTTP/1.1" 200 1 "fixture-agent-04" "-"`,
  },
  {
    service: 'ingress',
    input: `::ffff:192.0.2.77 - - [11/Nov/2026:10:00:04 +0900] "GET /privacy HTTP/1.1" 200 9 "-" "fixture-agent-05" "req.fixture-05"`,
    expected: `192.0.2.0/24 - [11/Nov/2026:10:00:04 +0900] "GET /privacy HTTP/1.1" 200 9 "fixture-agent-05" "req.fixture-05"`,
  },
  {
    service: 'ingress',
    input:
      '2026/11/11 10:00:05 [alert] 1#1: *7 fixture-alert-06 worker exited, client: 192.0.2.9, server: _, request: "GET /x?y=1 HTTP/1.1", host: "dormduri.com", referrer: "https://a.example/?z"',
    expected: '2026/11/11 10:00:05 [alert] 1#1: *7 fixture-alert-06 worker exited',
  },
  {
    service: 'ingress',
    input:
      '192.0.2.10 - - [11/Nov/2026:10:00:06 +0900] "fixture-junk-07 \\x16\\x03" 400 157 "https://b.example/?q=1" "-" "-"',
    expected:
      '192.0.2.0/24 - - [11/Nov/2026:10:00:06 +0900] "fixture-junk-07 \\x16\\x03" 400 157 "-" "-" "-"',
  },
  {
    service: 'api',
    input:
      '{"level":"info","case":"fixture-08","ip":"192.0.2.44","xff":"192.0.2.45,192.0.2.46","v6":"2001:db8:aaaa:bbbb::9","m":"::ffff:192.0.2.47","t":"2026-11-11T01:00:00.000Z","ua":"Chrome/130.0.0.0"}',
    expected:
      '{"level":"info","case":"fixture-08","ip":"192.0.2.0/24","xff":"192.0.2.0/24,192.0.2.0/24","v6":"2001:db8:aaaa::/48","m":"192.0.2.0/24","t":"2026-11-11T01:00:00.000Z","ua":"Chrome/130.0.0.0"}',
  },
  {
    service: 'web',
    input: '{"level":"warn","case":"fixture-09","peer":"::1","addr":"fe80::1"}',
    expected: '{"level":"warn","case":"fixture-09","peer":"::/48","addr":"fe80::/48"}',
  },
]);

// 입력에는 있고 Loki에는 없어야 하는 값(양성 대조: 입력에 실제로 있는지 judge가 먼저 본다).
export const SENSITIVE = Object.freeze([
  '198.51.100.23',
  '2001:db8:1234:5678::1',
  '2001:db8::7',
  '192.0.2.77',
  '192.0.2.9',
  '192.0.2.10',
  '192.0.2.44',
  '192.0.2.46',
  '2001:db8:aaaa:bbbb::9',
  'fe80::1',
  UUID,
  CUID,
  TOKEN,
  '/notices/42',
  'token=s3cr3t',
  'email=a%40b.com',
  'referer-secret',
  'https://ref.example/page',
  'owner@example.com',
  'kim chulsoo@example.com',
  'client: 192.0.2.9',
  'https://a.example/',
  'https://b.example/',
  'y=1',
]);
const ALLOWED_LABELS = ['container', 'env', 'level', 'service'];
// Loki가 스스로 붙이는 값(service label에서 온 service_name, 행에서 읽은 detected_level). Alloy가 보내지 않는다.
const LOKI_DERIVED = {
  service_name: (labels) => labels.service_name === labels.service,
  detected_level: (labels) =>
    /^(trace|debug|info|warn|error|critical|fatal|unknown)$/u.test(labels.detected_level),
};

// entries: Loki query 결과의 [{ labels, line }]. 문제 목록(빈 목록 = 통과)을 돌려준다.
export function judgeAlloyPipeline(entries, fixtures = FIXTURES, sensitive = SENSITIVE) {
  const problems = [];
  const inputs = fixtures.map((fixture) => fixture.input).join('\n');
  for (const value of sensitive) {
    if (!inputs.includes(value)) problems.push(`fixture input lacks the sensitive value ${value}`);
  }
  const lines = entries.map((entry) => entry.line);
  for (const fixture of fixtures) {
    const matched = entries.filter((entry) => entry.line === fixture.expected);
    if (matched.length !== 1)
      problems.push(`expected one stored line: ${fixture.expected} (got ${matched.length})`);
    else if (matched[0].labels.service !== fixture.service)
      problems.push(`${fixture.expected}: stored with service ${matched[0].labels.service}`);
  }
  if (entries.length !== fixtures.length)
    problems.push(`Loki holds ${entries.length} fixture lines, expected ${fixtures.length}`);
  for (const value of sensitive) {
    if (lines.some((line) => line.includes(value))) problems.push(`Loki holds ${value}`);
  }
  for (const entry of entries) {
    const extra = Object.keys(entry.labels).filter(
      (name) => !ALLOWED_LABELS.includes(name) && !LOKI_DERIVED[name]?.(entry.labels),
    );
    if (extra.length) problems.push(`labels beyond the allowlist: ${extra.join(', ')}`);
  }
  return problems;
}

const TEST_CONFIG = `import.file "dormduri" {
  filename = "/etc/alloy/pipeline.alloy"
}

loki.source.api "fixture" {
  http {
    listen_address = "0.0.0.0"
    listen_port    = 3500
  }
  forward_to = [dormduri.log_pipeline.fixture.receiver]
}

dormduri.log_pipeline "fixture" {
  forward_to = [loki.write.fixture.receiver]
}

loki.write "fixture" {
  endpoint {
    url = "http://loki:3100/loki/api/v1/push"
  }
}

prometheus.exporter.unix "host" {
  set_collectors = ["filesystem", "meminfo"]
}
`;

function docker(args, options = {}) {
  const result = spawnSync('docker', args, { encoding: 'utf8', ...options });
  if (result.status !== 0 && !options.allowFailure)
    throw new Error(`docker ${args.slice(0, 2).join(' ')} failed: ${result.stderr.trim()}`);
  return result;
}

const sleep = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds));
const hostPort = (name, port) =>
  docker(['port', name, `${port}/tcp`])
    .stdout.trim()
    .split('\n')[0]
    .split(':')
    .pop();

async function retry(label, attempt, limitMilliseconds = 90_000) {
  const deadline = Date.now() + limitMilliseconds;
  let last;
  while (Date.now() < deadline) {
    try {
      const value = await attempt();
      if (value) return value;
    } catch (error) {
      last = error;
    }
    await sleep(1_000);
  }
  throw new Error(`${label} did not finish${last ? `: ${last.message}` : ''}`);
}

// alloyDirectory·lokiConfig: 관측 설정 image에서 꺼낸 alloy 디렉터리와 loki.yml(host가 mount하는 그 내용).
export async function runAlloyPipelineCheck({ alloyDirectory, lokiConfig, alloyImage, lokiImage }) {
  const run = `${process.pid}-${Date.now()}`;
  const network = `dormduri-alloy-check-${run}`;
  const loki = `dormduri-alloy-check-loki-${run}`;
  const alloy = `dormduri-alloy-check-alloy-${run}`;
  const directory = mkdtempSync(join(tmpdir(), 'dormduri-alloy-check-'));
  writeFileSync(join(directory, 'test.alloy'), TEST_CONFIG);
  try {
    docker(['network', 'create', '--label', FIXTURE_LABEL, network]);
    docker([
      'run',
      '-d',
      '--name',
      loki,
      '--network',
      network,
      '--network-alias',
      'loki',
      '--label',
      FIXTURE_LABEL,
      '-p',
      '127.0.0.1::3100',
      '-v',
      `${lokiConfig}:/etc/loki/loki.yml:ro`,
      lokiImage,
      '-config.file=/etc/loki/loki.yml',
    ]);
    docker([
      'run',
      '-d',
      '--name',
      alloy,
      '--network',
      network,
      '--label',
      FIXTURE_LABEL,
      '-p',
      '127.0.0.1::3500',
      '-p',
      '127.0.0.1::12345',
      '-v',
      `${alloyDirectory}:/etc/alloy:ro`,
      '-v',
      `${directory}:/etc/alloy-test:ro`,
      alloyImage,
      'run',
      '--server.http.listen-addr=0.0.0.0:12345',
      '--storage.path=/tmp/alloy',
      '/etc/alloy-test/test.alloy',
    ]);
    const lokiUrl = `http://127.0.0.1:${hostPort(loki, 3100)}`;
    const pushUrl = `http://127.0.0.1:${hostPort(alloy, 3500)}/loki/api/v1/push`;
    const alloyUrl = `http://127.0.0.1:${hostPort(alloy, 12345)}`;
    await retry('Loki readiness', async () => (await fetch(`${lokiUrl}/ready`)).ok);
    const start = BigInt(Date.now()) * 1_000_000n;
    const streams = FIXTURES.map((fixture, index) => ({
      stream: { service: fixture.service, env: 'fixture' },
      values: [[String(start + BigInt(index)), fixture.input]],
    }));
    await retry('fixture push', async () => {
      const response = await fetch(pushUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streams }),
      });
      return response.status === 204;
    });
    const entries = await retry('fixture lines in Loki', async () => {
      const url = new URL(`${lokiUrl}/loki/api/v1/query_range`);
      url.searchParams.set('query', '{env="fixture"}');
      url.searchParams.set('start', String(start - 60_000_000_000n));
      url.searchParams.set('end', String(start + 60_000_000_000n));
      url.searchParams.set('limit', '100');
      const payload = await (await fetch(url)).json();
      const found = (payload?.data?.result ?? []).flatMap((stream) =>
        stream.values.map(([, line]) => ({ labels: stream.stream, line })),
      );
      return found.length >= FIXTURES.length ? found : null;
    });
    const problems = judgeAlloyPipeline(entries);
    const metrics = await (
      await fetch(`${alloyUrl}/api/v0/component/prometheus.exporter.unix.host/metrics`)
    ).text();
    for (const name of ['node_filesystem_avail_bytes', 'node_memory_MemAvailable_bytes']) {
      if (!metrics.includes(`${name}{`) && !metrics.includes(`${name} `))
        problems.push(`the host metrics path lacks ${name}`);
    }
    return { problems, stored: entries.length };
  } finally {
    docker(['rm', '-f', alloy, loki], { allowFailure: true });
    docker(['network', 'rm', network], { allowFailure: true });
    rmSync(directory, { recursive: true, force: true });
  }
}
