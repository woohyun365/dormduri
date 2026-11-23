// 백오피스 admin ingress image(infra/deploy/backoffice/ingress)를 실제로 띄워 경계를 본다(backoffice-foundation D-BF2·D-BF4).
// 일회용 internal network에 header를 그대로 돌려주는 stub `backoffice-web`과 hardening한 ingress를 올리고, 같은 network의 probe
// container가 Host·Origin·method·본문 크기를 바꿔 요청한다. 기준:
// - Host가 정확히 `localhost:4300`일 때만 Web에 닿고(그 밖은 대소문자·끝 점·port 없음까지 421), Web은 Host를 port까지 그대로 받는다.
// - Origin·Sec-Fetch-Site·Cookie는 받은 그대로 넘기고, client가 보낸 forwarding header(X-Forwarded-*·Forwarded·X-Real-IP)는 비운다.
// - GET·HEAD·POST 밖은 405, 64 KB를 넘는 본문은 413, upstream의 X-Powered-By는 숨기고 Server header에 판 번호가 없다.
// - 접속 log에 query string과 client 주소가 없다.
// 이름에 PID·시각을 붙이고 끝나면 이 실행이 만든 container·network·image만 지운다.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadImageInventory, resolveImageReference } from '../artifacts/image-inventory.mjs';

const defaultRepoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
export const LABEL = 'dormduri.local.created-by=scripts/infra/backoffice-host/ingress-smoke.mjs';
const FIXED_ORIGIN = 'http://localhost:4300';
const SECRET_QUERY = 'smoketoken=do-not-log-0123';

// probe가 보낼 요청과 기대값. `upstream`은 stub Web이 받은 header(소문자 이름, 없으면 null)다.
export const INGRESS_CASES = Object.freeze([
  {
    name: 'fixed-host',
    host: 'localhost:4300',
    path: '/login',
    status: 200,
    upstream: { host: 'localhost:4300' },
  },
  { name: 'loopback-address-host', host: '127.0.0.1:4300', path: '/login', status: 421 },
  { name: 'host-without-port', host: 'localhost', path: '/login', status: 421 },
  { name: 'uppercase-host', host: 'LOCALHOST:4300', path: '/login', status: 421 },
  { name: 'trailing-dot-host', host: 'localhost.:4300', path: '/login', status: 421 },
  { name: 'other-port-host', host: 'localhost:3000', path: '/login', status: 421 },
  { name: 'other-name-host', host: 'backoffice.example:4300', path: '/login', status: 421 },
  {
    name: 'state-change-pass-through',
    host: 'localhost:4300',
    method: 'POST',
    path: '/api/auth/logout',
    headers: {
      origin: FIXED_ORIGIN,
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'cors',
      cookie: 'dormduri_bo_session=fixture',
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.7',
      'x-forwarded-host': 'evil.example',
      'x-forwarded-proto': 'https',
      'x-real-ip': '203.0.113.7',
      forwarded: 'for=203.0.113.7;host=evil.example',
      'x-request-id': 'smoke-request-0001',
    },
    body: '{}',
    status: 200,
    upstream: {
      host: 'localhost:4300',
      origin: FIXED_ORIGIN,
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'cors',
      cookie: 'dormduri_bo_session=fixture',
      'x-forwarded-for': null,
      'x-forwarded-host': null,
      'x-forwarded-proto': null,
      'x-real-ip': null,
      forwarded: null,
      'x-request-id': 'smoke-request-0001',
    },
  },
  {
    name: 'foreign-origin-reaches-bff-unchanged',
    host: 'localhost:4300',
    method: 'POST',
    path: '/api/auth/logout',
    headers: { origin: 'http://localhost:3000', 'sec-fetch-site': 'same-site' },
    body: '{}',
    status: 200,
    upstream: { origin: 'http://localhost:3000', 'sec-fetch-site': 'same-site' },
  },
  {
    name: 'put',
    host: 'localhost:4300',
    method: 'PUT',
    path: '/api/auth/logout',
    body: '{}',
    status: 405,
  },
  {
    name: 'delete',
    host: 'localhost:4300',
    method: 'DELETE',
    path: '/api/auth/logout',
    status: 405,
  },
  {
    name: 'large-body',
    host: 'localhost:4300',
    method: 'POST',
    path: '/api/auth/login/password',
    body: 'x'.repeat(70 * 1024),
    status: 413,
  },
  { name: 'query-not-logged', host: 'localhost:4300', path: `/login?${SECRET_QUERY}`, status: 200 },
]);

// probe 결과(행 목록)와 ingress log로 어긋난 점을 모은다.
export function judgeIngressRows(rows, accessLog) {
  const problems = [];
  const byName = new Map(rows.map((row) => [row.name, row]));
  for (const expected of INGRESS_CASES) {
    const row = byName.get(expected.name);
    if (!row) {
      problems.push(`${expected.name}: no result`);
      continue;
    }
    if (row.status !== expected.status)
      problems.push(`${expected.name}: status ${row.status} != ${expected.status}`);
    if (expected.status === 200 && !row.upstream)
      problems.push(`${expected.name}: did not reach backoffice-web`);
    if (expected.status !== 200 && row.upstream)
      problems.push(`${expected.name}: reached backoffice-web`);
    for (const [header, value] of Object.entries(expected.upstream ?? {})) {
      const actual = row.upstream?.[header] ?? null;
      if (actual !== value)
        problems.push(
          `${expected.name}: upstream ${header} ${JSON.stringify(actual)} != ${JSON.stringify(value)}`,
        );
    }
    if (row.poweredBy) problems.push(`${expected.name}: X-Powered-By reaches the browser`);
    if (row.server && row.server !== 'nginx')
      problems.push(`${expected.name}: Server header shows a version`);
  }
  if (accessLog.includes(SECRET_QUERY)) problems.push('access log: keeps the query string');
  if (/\b(?:\d{1,3}\.){3}\d{1,3}\b/u.test(accessLog))
    problems.push('access log: keeps a client address');
  if (!/"GET \/login HTTP\/1\.1" 200 /u.test(accessLog))
    problems.push('access log: no request line');
  return problems;
}

// stub Web: 받은 header를 JSON으로 돌려주고 X-Powered-By를 붙인다.
const STUB_WEB = `
require('node:http').createServer((req, res) => {
  req.resume();
  req.on('end', () => {
    res.writeHead(200, { 'content-type': 'application/json', 'x-powered-by': 'Next.js' });
    res.end(JSON.stringify(req.headers));
  });
}).listen(3000, '0.0.0.0');
`;

// probe: node:http로 Host를 직접 정해 요청한다(fetch는 Host를 바꿀 수 없다).
const PROBE = `
const http = require('node:http');
const cases = JSON.parse(process.env.CASES);
const one = (c) => new Promise((done) => {
  const req = http.request({ host: 'ingress', port: 8080, method: c.method || 'GET', path: c.path,
    setHost: false, headers: { host: c.host, ...(c.headers || {}), ...(c.body ? { 'content-length': Buffer.byteLength(c.body) } : {}) } },
    (res) => {
      let text = '';
      res.on('data', (chunk) => (text += chunk));
      res.on('end', () => {
        let upstream = null;
        try { const parsed = JSON.parse(text); if (parsed && typeof parsed === 'object' && parsed.host !== undefined) upstream = parsed; } catch {}
        done({ name: c.name, status: res.statusCode, upstream, poweredBy: res.headers['x-powered-by'] || null, server: res.headers.server || null });
      });
    });
  req.on('error', (error) => done({ name: c.name, status: 0, error: String(error.code || error) }));
  if (c.body) req.write(c.body);
  req.end();
});
(async () => {
  const rows = [];
  for (const c of cases) rows.push(await one(c));
  process.stdout.write(JSON.stringify(rows));
})();
`;

function docker(args, options = {}) {
  const result = spawnSync('docker', args, { encoding: 'utf8', ...options });
  if (result.status !== 0 && !options.allowFailure)
    throw new Error(
      `docker ${args.slice(0, 2).join(' ')} failed: ${result.stderr || result.stdout}`,
    );
  return result;
}

export function runBackofficeIngressSmoke({ repoRoot = defaultRepoRoot } = {}) {
  const inventory = loadImageInventory(repoRoot);
  const nodeImage = resolveImageReference(
    repoRoot,
    inventory.images.find((image) => image.name === 'web-build-node'),
  );
  const suffix = `${process.pid}-${Date.now()}`;
  const names = {
    image: `dormduri-backoffice-ingress:smoke-${suffix}`,
    network: `dormduri-backoffice-ingress-smoke-${suffix}`,
    web: `dormduri-backoffice-ingress-smoke-web-${suffix}`,
    ingress: `dormduri-backoffice-ingress-smoke-ingress-${suffix}`,
  };
  try {
    docker([
      'build',
      '--quiet',
      '--label',
      LABEL,
      '-t',
      names.image,
      resolve(repoRoot, 'infra/deploy/backoffice/ingress'),
    ]);
    const hardening = [
      '--read-only',
      '--tmpfs',
      '/tmp:size=16m,mode=1777',
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges:true',
    ];
    docker(['run', '--rm', '--label', LABEL, ...hardening, names.image, 'nginx', '-t']);
    docker(['network', 'create', '--internal', '--label', LABEL, names.network]);
    docker([
      'run',
      '-d',
      '--label',
      LABEL,
      '--name',
      names.web,
      '--network',
      names.network,
      '--network-alias',
      'backoffice-web',
      ...hardening,
      '--entrypoint',
      'node',
      nodeImage,
      '-e',
      STUB_WEB,
    ]);
    docker([
      'run',
      '-d',
      '--label',
      LABEL,
      '--name',
      names.ingress,
      '--network',
      names.network,
      '--network-alias',
      'ingress',
      ...hardening,
      names.image,
    ]);
    // ingress와 stub이 듣기 시작할 때까지 기다린다(probe가 한 번 더 확인한다).
    let rows = [];
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const probe = docker(
        [
          'run',
          '--rm',
          '--label',
          LABEL,
          '--network',
          names.network,
          '--env',
          `CASES=${JSON.stringify(INGRESS_CASES)}`,
          '--entrypoint',
          'node',
          nodeImage,
          '-e',
          PROBE,
        ],
        { allowFailure: true },
      );
      rows = probe.status === 0 ? JSON.parse(probe.stdout) : [];
      if (rows.length && rows[0].status === 200) break;
      spawnSync('sleep', ['0.5']);
    }
    const accessLog = docker(['logs', names.ingress]).stdout;
    return { image: names.image, rows, problems: judgeIngressRows(rows, accessLog) };
  } finally {
    docker(['container', 'rm', '-f', names.web, names.ingress], { allowFailure: true });
    docker(['network', 'rm', names.network], { allowFailure: true });
    docker(['image', 'rm', '-f', names.image], { allowFailure: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { rows, problems } = runBackofficeIngressSmoke();
  if (process.argv.includes('--output')) for (const row of rows) console.log(JSON.stringify(row));
  for (const problem of problems) console.error(problem);
  console.log(`backoffice-ingress: ${rows.length} requests, ${problems.length} problems.`);
  process.exitCode = problems.length ? 1 : 0;
}
