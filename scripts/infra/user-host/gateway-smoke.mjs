// User host 관측 수신 gateway(infra/observability/gateway/nginx.conf, API 묶음 `obs-gateway`)를 실제 nginx로 띄워 경계를 본다
// (backoffice-foundation D-BF15). 일회용 network 둘(관측 network와 같은 10.217.12.0/28, 백오피스 host 경로를 흉내 내는 peer
// network)에 header를 돌려주는 stub(loki·prometheus·api)과 hardening한 gateway를 올리고, 고정 주소 probe가 요청한다. include는
// secret 설치기(secret_bundle.py observability)가 쓴 것을 그대로 쓴다. 기준:
// - 9480: 허용 /32에서 맞는 Bearer token일 때만 Loki push·remote write가 upstream에 닿고 Authorization은 넘기지 않는다. 다른 주소는
//   403, token이 틀리면 401, 다른 경로 404, POST 밖 method는 거부, 4 MiB를 넘는 본문 413. key가 없는 include는 모두 403.
// - 9482: 관측 network에서 온 API scrape만 api에 닿고 Authorization을 그대로 넘긴다. 다른 network에서 오면 403.
// - 접속 log에 주소가 없다.
// 이름에 PID·시각을 붙이고 끝나면 이 실행이 만든 container·network만 지운다.
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadImageInventory, resolveImageReference } from '../artifacts/image-inventory.mjs';

const defaultRepoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
export const LABEL = 'dormduri.local.created-by=scripts/infra/user-host/gateway-smoke.mjs';
export const OBSERVABILITY_SUBNET = '10.217.12.0/28';
const PEER_SUBNET = '10.217.30.0/28';
const ADDRESSES = Object.freeze({
  gatewayObs: '10.217.12.2',
  stubObs: '10.217.12.3',
  probeObs: '10.217.12.4',
  gatewayPeer: '10.217.30.2',
  stubPeer: '10.217.30.3',
  backoffice: '10.217.30.5',
  other: '10.217.30.6',
});
const TOKEN = 'gatewaysmoketoken_0123456789abcdefghijklmnop';

// probe 줄: from(보내는 쪽), port, method, path, header, 본문 크기, 기대 status, upstream(stub이 받은 것).
export const GATEWAY_CASES = Object.freeze([
  {
    name: 'loki-push',
    from: 'backoffice',
    port: 9480,
    method: 'POST',
    path: '/loki/api/v1/push',
    auth: `Bearer ${TOKEN}`,
    status: 200,
    upstream: { port: 3100, authorization: null },
  },
  {
    name: 'remote-write',
    from: 'backoffice',
    port: 9480,
    method: 'POST',
    path: '/api/v1/write',
    auth: `Bearer ${TOKEN}`,
    status: 200,
    upstream: { port: 9090, authorization: null },
  },
  {
    name: 'other-sender',
    from: 'other',
    port: 9480,
    method: 'POST',
    path: '/api/v1/write',
    auth: `Bearer ${TOKEN}`,
    status: 403,
  },
  {
    name: 'wrong-token',
    from: 'backoffice',
    port: 9480,
    method: 'POST',
    path: '/api/v1/write',
    auth: 'Bearer wrong',
    status: 401,
  },
  {
    name: 'token-other-case',
    from: 'backoffice',
    port: 9480,
    method: 'POST',
    path: '/api/v1/write',
    auth: `Bearer ${TOKEN.toUpperCase()}`,
    status: 401,
  },
  {
    name: 'no-token',
    from: 'backoffice',
    port: 9480,
    method: 'POST',
    path: '/api/v1/write',
    status: 401,
  },
  {
    name: 'query-path',
    from: 'backoffice',
    port: 9480,
    method: 'GET',
    path: '/api/v1/query?query=up',
    auth: `Bearer ${TOKEN}`,
    status: 404,
  },
  {
    name: 'get-push',
    from: 'backoffice',
    port: 9480,
    method: 'GET',
    path: '/loki/api/v1/push',
    auth: `Bearer ${TOKEN}`,
    status: 403,
  },
  {
    name: 'large-body',
    from: 'backoffice',
    port: 9480,
    method: 'POST',
    path: '/loki/api/v1/push',
    auth: `Bearer ${TOKEN}`,
    size: 5 * 1024 * 1024,
    status: 413,
  },
  {
    name: 'api-scrape',
    from: 'probeObs',
    port: 9482,
    method: 'GET',
    path: '/internal/metrics',
    auth: 'Bearer scrape-token',
    status: 200,
    upstream: { port: 4000, authorization: 'Bearer scrape-token' },
  },
  {
    name: 'api-scrape-from-peer',
    from: 'other',
    port: 9482,
    method: 'GET',
    path: '/internal/metrics',
    auth: 'Bearer scrape-token',
    status: 403,
  },
  {
    name: 'api-other-path',
    from: 'probeObs',
    port: 9482,
    method: 'GET',
    path: '/health/ready',
    status: 404,
  },
]);
// key가 없는 include(secret 설치기의 거부 판)에서는 허용 주소·맞는 token도 403이다.
export const DENY_ALL_CASES = Object.freeze([
  {
    name: 'deny-all-push',
    from: 'backoffice',
    port: 9480,
    method: 'POST',
    path: '/loki/api/v1/push',
    auth: `Bearer ${TOKEN}`,
    status: 403,
  },
]);

export function judgeGatewayRows(rows, cases, accessLog = '') {
  const problems = [];
  const byName = new Map(rows.map((row) => [row.name, row]));
  for (const expected of cases) {
    const row = byName.get(expected.name);
    if (!row) {
      problems.push(`${expected.name}: no result`);
      continue;
    }
    if (row.status !== expected.status)
      problems.push(`${expected.name}: status ${row.status} != ${expected.status}`);
    if (expected.upstream) {
      if (!row.upstream) problems.push(`${expected.name}: did not reach the upstream`);
      else {
        if (row.upstream.port !== expected.upstream.port)
          problems.push(`${expected.name}: reached port ${row.upstream.port}`);
        if ((row.upstream.authorization ?? null) !== expected.upstream.authorization)
          problems.push(
            `${expected.name}: upstream Authorization ${JSON.stringify(row.upstream.authorization)}`,
          );
        if (row.upstream.path !== expected.path)
          problems.push(`${expected.name}: upstream path ${row.upstream.path}`);
      }
    } else if (row.upstream) problems.push(`${expected.name}: reached the upstream`);
  }
  if (/\b10\.217\.\d+\.\d+\b/u.test(accessLog)) problems.push('access log: keeps a client address');
  return problems;
}

const STUB = `
const http = require('node:http');
for (const port of [3100, 9090, 4000]) {
  http.createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ port, path: req.url, authorization: req.headers.authorization ?? null }));
    });
  }).listen(port, '0.0.0.0');
}
`;
const PROBE = `
const http = require('node:http');
const cases = JSON.parse(process.env.CASES);
const one = (c) => new Promise((done) => {
  const body = c.size ? Buffer.alloc(c.size, 120) : c.method === 'POST' ? Buffer.from('{}') : null;
  const req = http.request({ host: process.env.GATEWAY, port: c.port, method: c.method, path: c.path,
    headers: { ...(c.auth ? { authorization: c.auth } : {}), ...(body ? { 'content-length': body.length } : {}) } }, (res) => {
    let text = '';
    res.on('data', (chunk) => (text += chunk));
    res.on('end', () => {
      let upstream = null;
      try { const parsed = JSON.parse(text); if (parsed && parsed.port) upstream = parsed; } catch {}
      done({ name: c.name, status: res.statusCode, upstream });
    });
  });
  req.on('error', (error) => done({ name: c.name, status: 0, error: String(error.code || error) }));
  if (body) req.write(body);
  req.end();
});
(async () => { const rows = []; for (const c of cases) rows.push(await one(c)); process.stdout.write(JSON.stringify(rows)); })();
`;

function docker(args, options = {}) {
  const result = spawnSync('docker', args, { encoding: 'utf8', ...options });
  if (result.status !== 0 && !options.allowFailure)
    throw new Error(
      `docker ${args.slice(0, 2).join(' ')} failed: ${result.stderr || result.stdout}`,
    );
  return result;
}

// secret 설치기로 include를 만든다(값은 이 smoke의 고정 fixture).
function renderAccess(repoRoot, directory, bundle) {
  const result = spawnSync(
    'python3',
    [
      '-I',
      resolve(repoRoot, 'infra/deploy/user/api/ssm/secret_bundle.py'),
      'observability',
      resolve(repoRoot, 'infra/deploy/api/secret-mount.contract.json'),
      directory,
    ],
    { input: JSON.stringify(bundle), encoding: 'utf8' },
  );
  if (result.status !== 0)
    throw new Error(`secret_bundle.py observability failed: ${result.stderr}`);
  // host에서는 root가 101 소유 0400으로 쓴다. 여기서는 실행 user 소유라 container의 101이 읽게 fixture만 0444로 연다.
  const path = join(directory, 'gateway-access.conf');
  chmodSync(path, 0o444);
  chmodSync(directory, 0o755);
  return path;
}

export function runGatewaySmoke({ repoRoot = defaultRepoRoot } = {}) {
  const inventory = loadImageInventory(repoRoot);
  const image = (name) =>
    resolveImageReference(
      repoRoot,
      inventory.images.find((entry) => entry.name === name),
    );
  const nginxImage = image('user-host-obs-gateway');
  const nodeImage = image('web-build-node');
  const suffix = `${process.pid}-${Date.now()}`;
  const names = {
    obs: `dormduri-gateway-smoke-obs-${suffix}`,
    peer: `dormduri-gateway-smoke-peer-${suffix}`,
    stub: `dormduri-gateway-smoke-stub-${suffix}`,
    gateway: `dormduri-gateway-smoke-gateway-${suffix}`,
  };
  const workDirectory = mkdtempSync(join(tmpdir(), 'dormduri-gateway-smoke-'));
  const hardening = [
    '--read-only',
    '--tmpfs',
    '/tmp:size=16m,mode=1777',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges:true',
  ];
  const base = {
    GRAFANA_ADMIN_PASSWORD: 'fixture',
    SLACK_ALERT_WEBHOOK_URL: 'https://hooks.slack.invalid/x',
  };
  const probe = (cases, from) =>
    docker(
      [
        'run',
        '--rm',
        '--label',
        LABEL,
        '--network',
        from === 'probeObs' ? names.obs : names.peer,
        '--ip',
        ADDRESSES[from],
        '--env',
        `CASES=${JSON.stringify(cases)}`,
        '--env',
        `GATEWAY=${from === 'probeObs' ? ADDRESSES.gatewayObs : ADDRESSES.gatewayPeer}`,
        '--entrypoint',
        'node',
        nodeImage,
        '-e',
        PROBE,
      ],
      { allowFailure: true },
    );
  const runCases = (cases) => {
    const rows = [];
    for (const from of [...new Set(cases.map((entry) => entry.from))]) {
      const result = probe(
        cases.filter((entry) => entry.from === from),
        from,
      );
      if (result.status === 0) rows.push(...JSON.parse(result.stdout));
    }
    return rows;
  };
  const startGateway = (access) => {
    docker([
      'create',
      '--label',
      LABEL,
      '--name',
      names.gateway,
      '--network',
      names.obs,
      '--ip',
      ADDRESSES.gatewayObs,
      ...hardening,
      '--user',
      '101:101',
      '--entrypoint',
      'nginx',
      '-v',
      `${resolve(repoRoot, 'infra/observability/gateway')}:/etc/dormduri-gateway:ro`,
      '-v',
      `${access}:/run/secrets/dormduri-observability/gateway-access.conf:ro`,
      nginxImage,
      '-c',
      '/etc/dormduri-gateway/nginx.conf',
      '-g',
      'daemon off;',
    ]);
    docker(['network', 'connect', '--ip', ADDRESSES.gatewayPeer, names.peer, names.gateway]);
    docker(['start', names.gateway]);
  };
  try {
    docker([
      'network',
      'create',
      '--internal',
      '--label',
      LABEL,
      '--subnet',
      OBSERVABILITY_SUBNET,
      names.obs,
    ]);
    docker([
      'network',
      'create',
      '--internal',
      '--label',
      LABEL,
      '--subnet',
      PEER_SUBNET,
      names.peer,
    ]);
    docker([
      'create',
      '--label',
      LABEL,
      '--name',
      names.stub,
      '--network',
      names.obs,
      '--ip',
      ADDRESSES.stubObs,
      '--network-alias',
      'loki',
      '--network-alias',
      'prometheus',
      ...hardening,
      '--entrypoint',
      'node',
      nodeImage,
      '-e',
      STUB,
    ]);
    docker([
      'network',
      'connect',
      '--ip',
      ADDRESSES.stubPeer,
      '--alias',
      'api',
      names.peer,
      names.stub,
    ]);
    docker(['start', names.stub]);
    const allowed = renderAccess(repoRoot, mkdtempSync(join(workDirectory, 'allowed-')), {
      ...base,
      BACKOFFICE_HOST_PRIVATE_IP: ADDRESSES.backoffice,
      BACKOFFICE_INGEST_TOKEN: TOKEN,
    });
    startGateway(allowed);
    docker(['exec', names.gateway, 'nginx', '-t', '-c', '/etc/dormduri-gateway/nginx.conf'], {
      stdio: 'ignore',
    });
    let rows = [];
    for (let attempt = 0; attempt < 20; attempt += 1) {
      rows = runCases(GATEWAY_CASES);
      if (rows.find((row) => row.name === 'loki-push')?.status === 200) break;
      spawnSync('sleep', ['0.5']);
    }
    const accessLog = docker(['logs', names.gateway]).stdout;
    const problems = judgeGatewayRows(rows, GATEWAY_CASES, accessLog);
    docker(['container', 'rm', '-f', names.gateway], { allowFailure: true });
    const denied = renderAccess(repoRoot, mkdtempSync(join(workDirectory, 'denied-')), base);
    startGateway(denied);
    let deniedRows = [];
    for (let attempt = 0; attempt < 20; attempt += 1) {
      deniedRows = runCases(DENY_ALL_CASES);
      if (deniedRows.length && deniedRows[0].status !== 0) break;
      spawnSync('sleep', ['0.5']);
    }
    problems.push(...judgeGatewayRows(deniedRows, DENY_ALL_CASES));
    return {
      image: nginxImage,
      rows: [...rows, ...deniedRows],
      problems,
      include: readFileSync(denied, 'utf8'),
    };
  } finally {
    docker(['container', 'rm', '-f', names.gateway, names.stub], { allowFailure: true });
    docker(['network', 'rm', names.obs, names.peer], { allowFailure: true });
    rmSync(workDirectory, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { rows, problems } = runGatewaySmoke();
  if (process.argv.includes('--output')) for (const row of rows) console.log(JSON.stringify(row));
  for (const problem of problems) console.error(problem);
  console.log(`obs-gateway: ${rows.length} requests, ${problems.length} problems.`);
  process.exitCode = problems.length ? 1 : 0;
}
