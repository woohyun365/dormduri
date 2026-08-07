import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '../..');
const project = process.env.WEB_REHEARSAL_PROJECT ?? 'knu-roommate-web-rehearsal';
const webPort = Number(process.env.WEB_REHEARSAL_PORT ?? 3300);
const grafanaPort = Number(process.env.GRAFANA_PORT ?? 3001);
const lokiPort = Number(process.env.LOKI_PORT ?? 3100);
const keepRunning = process.env.WEB_REHEARSAL_KEEP === '1';
const allowUnconstrained = process.env.WEB_REHEARSAL_ALLOW_UNCONSTRAINED === '1';
const privateEmail = 'rehearsal-private@example.com';
const privateToken = 'local-rehearsal-secret';
const composeFiles = [
  'infra/observability/docker-compose.observability.yml',
  'infra/observability/docker-compose.observability.rehearsal.yml',
  'infra/observability/docker-compose.web-rehearsal.yml',
];
const composeArguments = [
  'compose',
  '-p',
  project,
  ...composeFiles.flatMap((file) => ['-f', file]),
];
const commandEnv = {
  ...process.env,
  OBSERVABILITY_NETWORK: `${project}-network`,
  OBSERVABILITY_ENV: 'local',
  WEB_REHEARSAL_PORT: String(webPort),
  GRAFANA_PORT: String(grafanaPort),
  LOKI_PORT: String(lokiPort),
  SLACK_ALERTMANAGER_ENABLED: 'false',
};

function runDocker(arguments_, options = {}) {
  return execFileSync('docker', arguments_, {
    cwd: repoRoot,
    env: commandEnv,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
  });
}

function compose(...arguments_) {
  return runDocker([...composeArguments, ...arguments_]);
}

function composeOutput(...arguments_) {
  return runDocker([...composeArguments, ...arguments_], { capture: true });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForHttp(url, label, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = 'unreachable';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      lastStatus = String(response.status);
      if (response.ok) return response;
    } catch {
      lastStatus = 'unreachable';
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_000));
  }
  throw new Error(`${label} readiness timed out: ${lastStatus}`);
}

async function requestExpectedStatus(url, expectedStatus) {
  const response = await fetch(url);
  assert(
    response.status === expectedStatus,
    `${url} expected ${expectedStatus}, got ${response.status}`,
  );
}

function collectLokiLines(payload) {
  const streams = payload?.data?.result;
  if (!Array.isArray(streams)) return [];
  return streams.flatMap((stream) =>
    Array.isArray(stream.values) ? stream.values.map((value) => String(value[1] ?? '')) : [],
  );
}

async function waitForBffEvents() {
  const query =
    '{service="web"} | json | eventName="web_bff_request_completed" | operation="bookmark.list"';
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const end = BigInt(Date.now()) * 1_000_000n;
    const start = end - 10n * 60n * 1_000_000_000n;
    const url = new URL(`http://127.0.0.1:${lokiPort}/loki/api/v1/query_range`);
    url.searchParams.set('query', query);
    url.searchParams.set('start', String(start));
    url.searchParams.set('end', String(end));
    url.searchParams.set('limit', '100');
    url.searchParams.set('direction', 'backward');
    const response = await fetch(url);
    if (response.ok) {
      const lines = collectLokiLines(await response.json());
      const events = lines.flatMap((line) => {
        try {
          return [JSON.parse(line)];
        } catch {
          return [];
        }
      });
      const outcomes = new Set(events.map((event) => event.outcome));
      if (['success', 'invalid_response', 'timeout'].every((outcome) => outcomes.has(outcome))) {
        return { lines, events };
      }
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_500));
  }
  throw new Error('Web BFF events did not arrive in Loki within 45 seconds.');
}

function validateDockerEnvelope() {
  const context = runDocker(['context', 'show'], { capture: true }).trim();
  const [cpuText, memoryText] = runDocker(['info', '--format', '{{.NCPU}} {{.MemTotal}}'], {
    capture: true,
  })
    .trim()
    .split(/\s+/u);
  const cpus = Number(cpuText);
  const memoryBytes = Number(memoryText);
  const targetBytes = 4 * 1024 * 1024 * 1024;
  const toleranceBytes = 256 * 1024 * 1024;
  const constrained = cpus === 2 && Math.abs(memoryBytes - targetBytes) <= toleranceBytes;

  if (!allowUnconstrained) {
    assert(context === 'orbstack', `OrbStack context required, current context: ${context}`);
    assert(
      constrained,
      `Docker Engine must be 2 CPU / 4096MiB ±256MiB, got ${cpus} CPU / ${Math.round(memoryBytes / 1024 / 1024)}MiB`,
    );
  }

  return { context, cpus, memoryBytes, constrained };
}

async function main() {
  const startedAt = new Date().toISOString();
  const envelope = validateDockerEnvelope();
  const evidence = {
    startedAt,
    envelope,
    outcomes: [],
    checks: {
      composeConfig: false,
      servicesReady: false,
      privacySanitization: false,
      requestCorrelation: false,
      dashboardProvisioned: false,
      lokiFailOpen: false,
    },
    resources: [],
  };

  try {
    compose('config', '-q');
    evidence.checks.composeConfig = true;
    compose('up', '-d', '--build');
    await waitForHttp(`http://127.0.0.1:${webPort}/`, 'Web');
    await waitForHttp(`http://127.0.0.1:${lokiPort}/ready`, 'Loki');
    await waitForHttp(`http://127.0.0.1:${grafanaPort}/api/health`, 'Grafana');
    evidence.checks.servicesReady = true;

    const baseUrl = `http://127.0.0.1:${webPort}/api/bookmarks`;
    await requestExpectedStatus(
      `${baseUrl}?mode=success&email=${encodeURIComponent(privateEmail)}&token=${privateToken}`,
      200,
    );
    await requestExpectedStatus(`${baseUrl}?mode=invalid`, 502);
    await requestExpectedStatus(`${baseUrl}?mode=timeout`, 504);

    const { lines, events } = await waitForBffEvents();
    const serialized = lines.join('\n');
    assert(!serialized.includes(privateEmail), 'Loki log leaked rehearsal email.');
    assert(!serialized.includes(privateToken), 'Loki log leaked rehearsal token.');
    evidence.checks.privacySanitization = true;
    assert(
      events.every((event) => typeof event.requestId === 'string' && event.requestId.length > 0),
      'Loki event is missing requestId correlation.',
    );
    evidence.checks.requestCorrelation = true;
    evidence.outcomes = [...new Set(events.map((event) => event.outcome))].sort();

    const grafanaAuth = Buffer.from(
      `${process.env.GRAFANA_ADMIN_USER ?? 'admin'}:${process.env.GRAFANA_ADMIN_PASSWORD ?? 'change-me-local-only'}`,
    ).toString('base64');
    const dashboardResponse = await fetch(
      `http://127.0.0.1:${grafanaPort}/api/dashboards/uid/knu-web-bff-reliability`,
      { headers: { Authorization: `Basic ${grafanaAuth}` } },
    );
    assert(dashboardResponse.ok, `Grafana dashboard lookup failed: ${dashboardResponse.status}`);
    evidence.checks.dashboardProvisioned = true;

    compose('stop', 'loki');
    await requestExpectedStatus(`${baseUrl}?mode=success-after-loki-stop`, 200);
    compose('start', 'loki');
    await waitForHttp(`http://127.0.0.1:${lokiPort}/ready`, 'Loki restart');
    evidence.checks.lokiFailOpen = true;

    const resourceLines = runDocker(
      [
        'stats',
        '--no-stream',
        '--format',
        '{{json .}}',
        ...composeOutput('ps', '-q').trim().split(/\s+/u).filter(Boolean),
      ],
      { capture: true },
    )
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    evidence.resources = resourceLines;
    evidence.completedAt = new Date().toISOString();

    const evidencePath = process.env.WEB_REHEARSAL_EVIDENCE_PATH;
    if (evidencePath)
      writeFileSync(resolve(repoRoot, evidencePath), `${JSON.stringify(evidence, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
  } finally {
    if (!keepRunning) compose('down', '--volumes', '--remove-orphans');
  }
}

await main();
