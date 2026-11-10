#!/usr/bin/env node
// User host ingress image smoke(경로 표: infra/deploy/README.md 'User host 묶음'). ingress image를 build해 로컬 Docker에서 띄우고,
// 경로·method·mode(정상·Web 무응답·점검)별로 status·<title>·header를 단언한다. 세 503 화면은 status가 같아
// `nginx -t`만으로는 어느 화면이 나가는지 알 수 없으므로 실제 응답을 본다. 결과 표는 evidence로도 쓴다.
// smoke network는 운영 Web transit과 같은 고정 subnet·주소(compose-contract WEB_TRANSIT)라 private listener의 listen·allow
// 주소를 그대로 시험한다. 같은 subnet을 쓰는 다른 local network(user host rehearsal)가 떠 있으면 network 생성이 실패한다.
// private listener(stub Web에서만 확인): Web 주소만 받고, 같은 network의 다른 주소와 API network의 peer는 403,
// API가 없으면 JSON 503, API stub이 있으면 forwarding header를 지우고 보내며 `/internal/`(대소문자 무관)은 닫는다. 끝에 접속
// log 행에 원 client 주소·query string·referer가 없는지, error log(stderr)에 요청 문맥 줄이 없는지 본다.
//
// Web은 기본으로 stub(모든 경로 200, `X-Powered-By`를 붙임)이고, `--web-image=<로컬 image>`를 주면 그 Web image를
// 운영 compose(infra/deploy/user/compose.yml)를 render한 Web environment 그대로 띄운다. node 내장 module만 쓴다(runtime gate에는 package 설치가 없다).
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import tls from 'node:tls';
import { fileURLToPath } from 'node:url';

import { resolveArtifactPath } from '../../artifacts/paths.mjs';
import { loadImageInventory, resolveImageReference } from '../artifacts/image-inventory.mjs';
import { buildComposeArgs, loadComposeInventory } from '../compose/profile.mjs';
import { USER_HOST_RENDER_ENVIRONMENT, WEB_TRANSIT } from './compose-contract.mjs';

const defaultRepoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
export const CANONICAL_HOST = 'dormduri.com';
// 화면 제목의 원본은 정적 화면 파일의 <title>이다. smoke와 배포 document의 내부 smoke(ssm-document.test가 대조)가 이것을 쓴다.
export const PAGE_FILES = Object.freeze({
  comingSoon: 'coming-soon.html',
  maintenance: 'maintenance.html',
  unavailable: 'unavailable.html',
  notFound: 'not-found.html',
});
export function readPageTitles(repoRoot = defaultRepoRoot) {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(PAGE_FILES).map(([key, file]) => {
        const html = readFileSync(
          resolve(repoRoot, 'infra/deploy/user/ingress/html', file),
          'utf8',
        );
        const titles = [...html.matchAll(/<title>([^<]*)<\/title>/gu)];
        if (titles.length !== 1) throw new Error(`${file} must have exactly one <title>`);
        return [key, titles[0][1]];
      }),
    ),
  );
}
export const PAGE_TITLES = readPageTitles();
const STUB_TITLE = 'stub web';
const LABEL = 'dormduri.local.created-by=user-host-ingress-smoke';

const page = (title, status, retryAfter) => ({ status, title, retryAfter, staticPage: true });
// BFF `/api/**`: 공개 API 주소가 없으므로 Web·API에 보내지 않고 JSON '준비 중' 503으로 끝낸다.
const jsonComingSoon = () => ({
  status: 503,
  json: '{"status":"coming-soon"}',
  retryAfter: '3600',
});
// 접속 log 판정에 쓰는 referer. log 행에 나오면 안 된다.
export const LOG_PROBE_REFERER = 'https://referer.invalid/from?token=probe';
// sameAs: Web이 그 경로와 같은 page를 내야 한다(stub Web은 받은 URI를 X-Stub-Uri로 돌려준다).
const web = (sameAs) => ({ status: 200, web: true, ...(sameAs ? { sameAs } : {}) });

// 경로별 기대값. mode: serving(Web 응답), web-down(Web 무응답), maintenance(점검 flag).
export const INGRESS_SMOKE_CASES = Object.freeze([
  ...['/', '/terms'].map((path) => ({ mode: 'serving', path, expect: web() })),
  { mode: 'serving', path: '/privacy', headers: { Referer: LOG_PROBE_REFERER }, expect: web() },
  ...[
    '/_next/static/chunks/app.js',
    '/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fa.png&w=640&q=75',
    '/robots.txt',
    '/sitemap.xml',
    '/icon.png',
  ].map((path) => ({ mode: 'serving', path, expect: web(), stubOnly: true })),
  // nginx는 부호화된 slash·dot segment를 풀어 `/`로 판정한다. Web도 `/`를 받아 Landing을 내야 한다.
  ...['/notices/..%2F', '/notices/%2e%2e/', '/signup/..%2F'].map((path) => ({
    mode: 'serving',
    path,
    expect: web('/'),
  })),
  // decode 뒤 제어·공백 문자나 `%`·`?`가 남는 경로는 Web 요청 줄을 바꿀 수 있으므로 nginx가 400으로 끝낸다.
  ...[
    '/_next/static/x%20HTTP/1.1%0d%0aX-Injected:%20yes%0d%0aX:%20y',
    '/_next/static/%252e%252e/%252e%252e/x',
    '/_next/static/a%3Fb',
  ].map((path) => ({ mode: 'serving', path, expect: { status: 400, notWeb: true } })),
  ...['/login', '/signup', '/password-reset', '/main', '/main/chat', '/notices/1', '/support'].map(
    (path) => ({ mode: 'serving', path, expect: page(PAGE_TITLES.comingSoon, 503, '3600') }),
  ),
  ...['/api', '/api/legal/documents/active-bundle', '/api/auth/session?x=1'].map((path) => ({
    mode: 'serving',
    path,
    expect: jsonComingSoon(),
  })),
  { mode: 'serving', method: 'POST', path: '/api/auth/login', expect: jsonComingSoon() },
  { mode: 'serving', path: '/apix', expect: page(PAGE_TITLES.notFound, 404, null) },
  {
    mode: 'serving',
    method: 'PUT',
    path: '/signup',
    expect: page(PAGE_TITLES.comingSoon, 503, '3600'),
  },
  ...['/abc', '/loginx', '/privacy/x', '/__pages/coming-soon.html'].map((path) => ({
    mode: 'serving',
    path,
    expect: page(PAGE_TITLES.notFound, 404, null),
  })),
  { mode: 'serving', method: 'POST', path: '/abc', expect: page(PAGE_TITLES.notFound, 404, null) },
  {
    mode: 'serving',
    host: `www.${CANONICAL_HOST}`,
    path: '/terms?x=1',
    expect: { status: 301, location: `https://${CANONICAL_HOST}/terms?x=1` },
  },
  {
    mode: 'serving',
    scheme: 'http',
    path: '/privacy?x=1',
    expect: { status: 301, location: `https://${CANONICAL_HOST}/privacy?x=1` },
  },
  {
    mode: 'serving',
    scheme: 'http',
    path: '/.well-known/acme-challenge/smoke-token',
    expect: { status: 200, body: 'smoke-acme' },
  },
  { mode: 'serving', scheme: 'http', host: 'unknown.invalid', path: '/', expect: { closed: true } },
  { mode: 'serving', scheme: 'tls', host: 'unknown.invalid', path: '/', expect: { closed: true } },
  ...['/', '/privacy'].map((path) => ({
    mode: 'web-down',
    path,
    expect: page(PAGE_TITLES.unavailable, 503, '60'),
  })),
  { mode: 'web-down', method: 'POST', path: '/', expect: page(PAGE_TITLES.unavailable, 503, '60') },
  // Web 무응답은 nginx가 upstream 오류 줄을 쓰려는 자리다. query·referer를 붙여 error log 판정(checkErrorLog)의 입력으로 쓴다.
  {
    mode: 'web-down',
    path: '/privacy?probe=1',
    headers: { Referer: LOG_PROBE_REFERER },
    expect: page(PAGE_TITLES.unavailable, 503, '60'),
  },
  { mode: 'web-down', path: '/signup', expect: page(PAGE_TITLES.comingSoon, 503, '3600') },
  { mode: 'web-down', method: 'POST', path: '/api/auth/login', expect: jsonComingSoon() },
  { mode: 'web-down', path: '/abc', expect: page(PAGE_TITLES.notFound, 404, null) },
  ...['/', '/privacy', '/signup', '/abc', '/_next/static/chunks/app.js'].map((path) => ({
    mode: 'maintenance',
    path,
    expect: page(PAGE_TITLES.maintenance, 503, '3600'),
  })),
  {
    mode: 'maintenance',
    method: 'POST',
    path: '/api/auth/login',
    expect: page(PAGE_TITLES.maintenance, 503, '3600'),
  },
  {
    mode: 'maintenance',
    scheme: 'http',
    path: '/.well-known/acme-challenge/smoke-token',
    expect: { status: 200, body: 'smoke-acme' },
  },
]);

export function checkResponse(testCase, response) {
  const expect = testCase.expect;
  const problems = [];
  if (expect.closed) {
    if (!response.closed) problems.push(`expected a closed connection, got ${response.status}`);
    return problems;
  }
  if (response.closed) return [`connection closed: ${response.error}`];
  if (response.status !== expect.status)
    problems.push(`status ${response.status} != ${expect.status}`);
  const headers = response.headers;
  if (headers['x-robots-tag'] !== 'noindex') problems.push('missing X-Robots-Tag: noindex');
  if (headers['x-powered-by'] !== undefined) problems.push('X-Powered-By reached the client');
  if (
    testCase.scheme !== 'http' &&
    !/^max-age=\d+$/u.test(headers['strict-transport-security'] ?? '')
  ) {
    problems.push('missing Strict-Transport-Security');
  }
  if (expect.location && headers.location !== expect.location) {
    problems.push(`location ${headers.location} != ${expect.location}`);
  }
  if (expect.body !== undefined && response.body.trim() !== expect.body)
    problems.push('unexpected body');
  if (expect.json !== undefined) {
    if (response.body !== expect.json) problems.push(`body ${response.body} != ${expect.json}`);
    if (!/^application\/json\b/iu.test(headers['content-type'] ?? ''))
      problems.push(`content-type ${headers['content-type']}`);
    if ((headers['retry-after'] ?? null) !== expect.retryAfter)
      problems.push(`Retry-After ${headers['retry-after']} != ${expect.retryAfter}`);
    if (headers['cache-control'] !== 'no-store') problems.push('JSON coming-soon is cacheable');
    if (headers['x-content-type-options'] !== 'nosniff') problems.push('missing nosniff');
    if (headers['x-stub-uri'] !== undefined) problems.push('request reached Web');
  }
  if (expect.web && response.title === null) problems.push('Web response has no <title>');
  if (expect.web && Object.values(PAGE_TITLES).includes(response.title)) {
    problems.push('allowed path returned a static page');
  }
  if (expect.notWeb && headers['x-stub-uri'] !== undefined) problems.push('request reached Web');
  if (
    expect.sameAs &&
    headers['x-stub-uri'] !== undefined &&
    headers['x-stub-uri'] !== expect.sameAs
  ) {
    problems.push(`Web received ${headers['x-stub-uri']} instead of ${expect.sameAs}`);
  }
  if (expect.staticPage) {
    if (response.title !== expect.title)
      problems.push(`title ${response.title} != ${expect.title}`);
    if ((headers['retry-after'] ?? null) !== expect.retryAfter) {
      problems.push(`Retry-After ${headers['retry-after']} != ${expect.retryAfter}`);
    }
    if (headers['cache-control'] !== 'no-store') problems.push('static page is cacheable');
    if (!/^default-src 'none';/u.test(headers['content-security-policy'] ?? '')) {
      problems.push('static page has no restrictive CSP');
    }
    if (!/^text\/html; charset=utf-8$/iu.test(headers['content-type'] ?? '')) {
      problems.push(`content-type ${headers['content-type']}`);
    }
  }
  return problems;
}

function docker(args, { allowFailure = false, input } = {}) {
  const result = spawnSync('docker', args, { encoding: 'utf8', input });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(
      `docker ${args.slice(0, 2).join(' ')} failed: ${(result.stderr || result.stdout).trim()}`,
    );
  }
  return result;
}

function writeSelfSignedCertificate(directory) {
  const result = spawnSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-days',
      '2',
      '-subj',
      `/CN=${CANONICAL_HOST}`,
      '-addext',
      `subjectAltName=DNS:${CANONICAL_HOST},DNS:www.${CANONICAL_HOST}`,
      '-keyout',
      join(directory, 'privkey.pem'),
      '-out',
      join(directory, 'fullchain.pem'),
    ],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) throw new Error(`openssl failed: ${result.stderr}`);
}

function prepareHostDirectories() {
  const root = mkdtempSync(join(tmpdir(), 'dormduri-ingress-smoke-'));
  const directories = {
    root,
    tls: join(root, 'tls'),
    acme: join(root, 'acme'),
    mode: join(root, 'mode'),
    stub: join(root, 'stub'),
  };
  for (const directory of Object.values(directories)) mkdirSync(directory, { recursive: true });
  mkdirSync(join(directories.acme, '.well-known/acme-challenge'), { recursive: true });
  writeFileSync(join(directories.acme, '.well-known/acme-challenge/smoke-token'), 'smoke-acme\n');
  writeSelfSignedCertificate(directories.tls);
  // stub Web: 모든 경로 200, 받은 URI를 X-Stub-Uri로 돌려주고 X-Powered-By를 붙인다. node라 private listener probe도 이
  // container 안 fetch로 한다(운영 Web container와 같은 자리).
  writeFileSync(
    join(directories.stub, 'web.mjs'),
    `import http from 'node:http';\nhttp.createServer((req, res) => {\n  res.setHeader('X-Powered-By', 'stub-web');\n  res.setHeader('X-Stub-Uri', req.url);\n  res.setHeader('Content-Type', 'text/html');\n  res.end('<!doctype html><title>${STUB_TITLE}</title>');\n}).listen(3000);\n`,
  );
  // API stub: 받은 URI와 forwarding header를 돌려준다(빈 header는 nginx가 내보내지 않는다).
  writeFileSync(
    join(directories.stub, 'api.conf'),
    `server {\n  listen 4000;\n  location / {\n    add_header X-Stub-Uri $request_uri always;\n    add_header X-Stub-Forwarded-For "$http_x_forwarded_for" always;\n    add_header X-Stub-Real-Ip "$http_x_real_ip" always;\n    default_type application/json;\n    return 200 '{"stub":"api"}';\n  }\n}\n`,
  );
  // The ingress runs as uid 101 inside the container, so the bind-mounted test files must be world-readable.
  for (const directory of [
    root,
    ...Object.values(directories),
    join(directories.acme, '.well-known'),
    join(directories.acme, '.well-known/acme-challenge'),
  ]) {
    chmodSync(directory, 0o755);
  }
  for (const file of [
    'tls/privkey.pem',
    'tls/fullchain.pem',
    'acme/.well-known/acme-challenge/smoke-token',
    'stub/web.mjs',
    'stub/api.conf',
  ]) {
    chmodSync(join(root, file), 0o644);
  }
  return directories;
}

// local smoke는 loopback으로 연결하고 인증서를 검증하지 않는다(시험 인증서). CD 외부 smoke는 address를 그 host 이름으로,
// ports를 80·443으로 주고 verify로 인증서를 검증한다.
export function request({
  scheme = 'https',
  host = CANONICAL_HOST,
  path,
  method = 'GET',
  ports,
  address = '127.0.0.1',
  verify = false,
  headers: extraHeaders = {},
}) {
  return new Promise((resolveResponse) => {
    if (scheme === 'tls') {
      const socket = tls.connect({
        host: address,
        port: ports.https,
        servername: host,
        rejectUnauthorized: verify,
      });
      socket.setTimeout(5000);
      socket.once('secureConnect', () => {
        socket.destroy();
        resolveResponse({ closed: false, status: 'handshake' });
      });
      socket.once('error', (error) =>
        resolveResponse({ closed: true, error: error.code ?? error.message }),
      );
      socket.once('timeout', () => {
        socket.destroy();
        resolveResponse({ closed: true, error: 'timeout' });
      });
      return;
    }
    const client = scheme === 'http' ? http : https;
    const req = client.request(
      {
        host: address,
        port: scheme === 'http' ? ports.http : ports.https,
        method,
        path,
        servername: host,
        rejectUnauthorized: verify,
        headers: {
          Host: host,
          ...extraHeaders,
          ...(method === 'GET'
            ? {}
            : { 'Content-Type': 'application/json', 'Content-Length': '2' }),
        },
        timeout: 15000,
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () =>
          resolveResponse({
            closed: false,
            status: res.statusCode,
            headers: res.headers,
            body,
            title: /<title>([^<]*)<\/title>/u.exec(body)?.[1] ?? null,
          }),
        );
      },
    );
    req.on('error', (error) =>
      resolveResponse({ closed: true, error: error.code ?? error.message }),
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    if (method !== 'GET') req.write('{}');
    req.end();
  });
}

async function waitForIngress(ports) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const response = await request({ path: '/abc', ports });
    if (!response.closed) return;
    await new Promise((done) => setTimeout(done, 500));
  }
  throw new Error('ingress did not accept HTTPS requests within 30 seconds');
}

function publishedPort(container, port) {
  const output = docker(['port', container, `${port}/tcp`])
    .stdout.trim()
    .split('\n')[0];
  return Number(output.slice(output.lastIndexOf(':') + 1));
}

// container 안 node fetch로 private listener에 요청한다(배포 document의 host 안 smoke와 같은 방식). 연결이 안 되면 status null.
const PROBE_SCRIPT = `
const [target, path, extra] = process.argv.slice(1);
fetch("http://" + target + ":8081" + path, { headers: JSON.parse(extra), signal: AbortSignal.timeout(10000) })
  .then(async (response) => console.log(JSON.stringify({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() })))
  .catch((error) => console.log(JSON.stringify({ status: null, headers: {}, body: "", error: String(error.cause?.code ?? error.message) })));
`;
function probePrivate(container, target, path, extraHeaders = {}) {
  const raw = docker(
    ['exec', container, 'node', '-e', PROBE_SCRIPT, target, path, JSON.stringify(extraHeaders)],
    { allowFailure: true },
  ).stdout.trim();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { status: null, headers: {}, body: '', error: raw };
  }
  const headers = parsed.headers;
  return {
    raw,
    status: parsed.status,
    contentType: headers['content-type'] ?? null,
    stubUri: headers['x-stub-uri'] ?? null,
    forwarded: [headers['x-stub-forwarded-for'], headers['x-stub-real-ip']].filter(Boolean),
    body: parsed.body.trim(),
  };
}

function privateRow(path, response, problems) {
  return {
    mode: 'serving',
    scheme: 'private',
    method: 'GET',
    path,
    status: response.status ?? 'closed',
    pass: problems.length === 0,
    problems,
  };
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

// ingress resolver는 결과를 10초 cache한다(valid=10s). API container를 띄우거나 내린 직후의 창은 재시도로 기다린다.
async function probeUntil(container, target, path, accept, extraHeaders = {}) {
  let response;
  for (let attempt = 0; attempt < 25; attempt += 1) {
    response = probePrivate(container, target, path, extraHeaders);
    if (accept(response)) return response;
    await sleep(1000);
  }
  return response;
}

const unavailable = (response) =>
  response.status === 503 &&
  response.contentType === 'application/json' &&
  response.body === '{"status":"unavailable"}';

async function privateListenerChecks({ names, directories, nginxImage }) {
  const rows = [];
  const legal = '/api/legal/documents/active-bundle';
  // API가 없을 때: Web 주소에서 JSON 503, health 204, API 운영 경로는 JSON 404.
  const absent = probePrivate(names.web, 'ingress', legal);
  rows.push(
    privateRow(`web→:8081${legal} (API none)`, absent, unavailable(absent) ? [] : [absent.raw]),
  );
  const health = probePrivate(names.web, 'ingress', '/__ingress/health');
  rows.push(
    privateRow('web→:8081/__ingress/health', health, health.status === 204 ? [] : [health.raw]),
  );
  const internalClosed = (response) =>
    response.status === 404 &&
    response.body === '{"status":"not-found"}' &&
    response.stubUri === null;
  for (const path of ['/internal/metrics', '/INTERNAL/metrics']) {
    const internal = probePrivate(names.web, 'ingress', path);
    rows.push(
      privateRow(`web→:8081${path}`, internal, internalClosed(internal) ? [] : [internal.raw]),
    );
  }
  // 같은 Web network의 다른 주소와 API network의 peer: 403(본문을 API로 보내지 않는다).
  const otherPeer = probePrivate(names.webPeer, WEB_TRANSIT.ingress, legal);
  rows.push(
    privateRow(
      `web-transit peer→:8081${legal}`,
      otherPeer,
      otherPeer.status === 403 ? [] : [otherPeer.raw],
    ),
  );
  const apiPeer = probePrivate(names.apiPeer, 'ingress', legal);
  rows.push(
    privateRow(
      `api-transit peer→:8081${legal}`,
      apiPeer,
      apiPeer.status === 403 ? [] : [apiPeer.raw],
    ),
  );
  // API stub이 뜨면 그리로 보낸다. 앞 hop의 client 주소 header는 지우고, `/internal/`은 여전히 ingress가 닫는다.
  docker([
    'run',
    '-d',
    '--label',
    LABEL,
    '--name',
    names.api,
    '--network',
    names.apiNetwork,
    '--network-alias',
    'api',
    '-v',
    `${directories.stub}/api.conf:/etc/nginx/conf.d/default.conf:ro`,
    nginxImage,
  ]);
  const spoofed = { 'X-Forwarded-For': '203.0.113.9', 'X-Real-IP': '203.0.113.9' };
  const present = await probeUntil(
    names.web,
    'ingress',
    legal,
    (response) => response.status === 200,
    spoofed,
  );
  const presentProblems = [];
  if (present.status !== 200 || present.stubUri !== legal || present.body !== '{"stub":"api"}')
    presentProblems.push(present.raw);
  if (present.forwarded.length)
    presentProblems.push(`forwarding headers reached API: ${present.forwarded}`);
  rows.push(privateRow(`web→:8081${legal} (API stub)`, present, presentProblems));
  for (const path of ['/internal/metrics', '/Internal/Metrics']) {
    const internalWithApi = probePrivate(names.web, 'ingress', path);
    rows.push(
      privateRow(
        `web→:8081${path} (API stub)`,
        internalWithApi,
        internalClosed(internalWithApi) ? [] : [internalWithApi.raw],
      ),
    );
  }
  // API를 내리면(API maintenance) 다시 JSON 503이다.
  docker(['rm', '-f', names.api], { allowFailure: true });
  const stopped = await probeUntil(names.web, 'ingress', legal, unavailable);
  rows.push(
    privateRow(
      `web→:8081${legal} (API stopped)`,
      stopped,
      unavailable(stopped) ? [] : [stopped.raw],
    ),
  );
  return rows;
}

// 접속 log 행(OO-R1): client 주소는 IPv4 /24·IPv6 /48로 가린 값, 요청 경로에 query string 없음, referer 없음.
export function checkAccessLog(text) {
  const rows = text
    .split('\n')
    .map((line) => /^(\S+) - \[[^\]]+\] "(\S+) (\S+) (\S+)" (\d{3}) /u.exec(line))
    .filter(Boolean);
  const problems = [];
  if (rows.length < 20) problems.push(`only ${rows.length} access rows`);
  for (const [line, client, , path] of rows) {
    if (!/^(?:\d{1,3}\.\d{1,3}\.\d{1,3}\.0\/24|[0-9a-f:]*::\/48|-)$/u.test(client))
      problems.push(`client is not masked: ${line}`);
    if (path.includes('?')) problems.push(`query string kept: ${line}`);
  }
  if (text.includes('referer.invalid')) problems.push('referer kept in the access log');
  if (!rows.some(([, , , path]) => path === '/_next/image'))
    problems.push('the request with a query string has no row');
  for (const address of [WEB_TRANSIT.web, '203.0.113.9'])
    if (text.includes(address)) problems.push(`full address ${address} in the log`);
  return { rows: rows.length, problems };
}

// error log(stderr, OO-R1): nginx는 error 줄에 원본 client 주소·query가 붙은 요청 줄·referrer를 붙이므로 alert 미만 줄과 요청
// 문맥(`client:`·`request:`·`referrer:`)이 없어야 한다. 문제 줄의 IPv4 숫자는 가려 적는다.
export function checkErrorLog(text) {
  const lines = text.split('\n').filter(Boolean);
  const problems = [];
  const masked = (line) => line.replace(/\d{1,3}(?:\.\d{1,3}){3}/gu, '<IPv4>');
  for (const line of lines) {
    if (/\[(?:debug|info|notice|warn|error|crit)\]/u.test(line))
      problems.push(`error log line below alert: ${masked(line)}`);
    if (/(?:^|[ ,])(?:client|request|referrer): /u.test(line))
      problems.push(`request context in the error log: ${masked(line)}`);
  }
  if (text.includes('referer.invalid')) problems.push('referer in the error log');
  return { lines: lines.length, problems };
}

// 운영 compose의 Web environment(registry digest 자리는 같은 형식의 placeholder).
export function userHostWebEnvironment(repoRoot = defaultRepoRoot) {
  const result = spawnSync(
    'docker',
    buildComposeArgs(loadComposeInventory(repoRoot), 'user-host', ['config', '--format', 'json'], {
      repoRoot,
    }),
    { cwd: repoRoot, encoding: 'utf8', env: { ...process.env, ...USER_HOST_RENDER_ENVIRONMENT } },
  );
  if (result.status !== 0) throw new Error(`user-host compose render failed: ${result.stderr}`);
  return JSON.parse(result.stdout).services.web.environment;
}

export async function runIngressSmoke({
  repoRoot = defaultRepoRoot,
  webImage,
  keepImage = false,
} = {}) {
  const inventory = loadImageInventory(repoRoot);
  const nginxImage = resolveImageReference(
    repoRoot,
    inventory.images.find((image) => image.name === 'user-host-ingress'),
  );
  // stub Web·probe peer의 node image(Web build image와 같은 pin).
  const nodeImage = resolveImageReference(
    repoRoot,
    inventory.images.find((image) => image.name === 'web-build-node'),
  );
  const suffix = `${process.pid}-${Date.now()}`;
  const names = {
    image: `dormduri-ingress:smoke-${suffix}`,
    network: `dormduri-ingress-smoke-${suffix}`,
    apiNetwork: `dormduri-ingress-smoke-api-${suffix}`,
    web: `dormduri-ingress-smoke-web-${suffix}`,
    ingress: `dormduri-ingress-smoke-ingress-${suffix}`,
    webPeer: `dormduri-ingress-smoke-web-peer-${suffix}`,
    apiPeer: `dormduri-ingress-smoke-api-peer-${suffix}`,
    api: `dormduri-ingress-smoke-api-${suffix}`,
  };
  const directories = prepareHostDirectories();
  const rows = [];
  try {
    docker([
      'build',
      '--quiet',
      '--label',
      LABEL,
      '-t',
      names.image,
      resolve(repoRoot, 'infra/deploy/user/ingress'),
    ]);
    const mounts = [
      '-v',
      `${directories.tls}:/etc/dormduri-tls:ro`,
      '-v',
      `${directories.acme}:/var/www/acme:ro`,
      '-v',
      `${directories.mode}:/run/dormduri-mode:ro`,
    ];
    const hardening = [
      '--read-only',
      '--tmpfs',
      '/tmp:size=16m,mode=1777',
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges:true',
    ];
    docker(['run', '--rm', ...hardening, ...mounts, names.image, 'nginx', '-t']);
    docker([
      'network',
      'create',
      '--label',
      LABEL,
      '--subnet',
      WEB_TRANSIT.subnet,
      '--ip-range',
      WEB_TRANSIT.ipRange,
      '--gateway',
      WEB_TRANSIT.gateway,
      names.network,
    ]);
    docker(['network', 'create', '--label', LABEL, names.apiNetwork]);
    const webArgs = webImage
      ? [
          ...Object.entries(userHostWebEnvironment(repoRoot)).flatMap(([key, value]) => [
            '-e',
            `${key}=${value}`,
          ]),
          webImage,
        ]
      : [
          '-v',
          `${directories.stub}/web.mjs:/stub/web.mjs:ro`,
          '--entrypoint',
          'node',
          nodeImage,
          '/stub/web.mjs',
        ];
    docker([
      'run',
      '-d',
      '--label',
      LABEL,
      '--name',
      names.web,
      '--network',
      names.network,
      '--ip',
      WEB_TRANSIT.web,
      '--network-alias',
      'web',
      ...webArgs,
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
      '--ip',
      WEB_TRANSIT.ingress,
      '--network-alias',
      'ingress',
      ...hardening,
      ...mounts,
      '-p',
      '127.0.0.1::8080',
      '-p',
      '127.0.0.1::8443',
      names.image,
    ]);
    docker(['network', 'connect', '--alias', 'ingress', names.apiNetwork, names.ingress]);
    for (const [name, network] of [
      [names.webPeer, names.network],
      [names.apiPeer, names.apiNetwork],
    ]) {
      docker([
        'run',
        '-d',
        '--label',
        LABEL,
        '--name',
        name,
        '--network',
        network,
        '--entrypoint',
        'sleep',
        nodeImage,
        '600',
      ]);
    }
    const ports = {
      http: publishedPort(names.ingress, 8080),
      https: publishedPort(names.ingress, 8443),
    };
    await waitForIngress(ports);
    if (webImage) await waitForWeb(ports);

    for (const mode of ['serving', 'web-down', 'maintenance']) {
      if (mode === 'web-down') docker(['stop', '--timeout', '5', names.web]);
      if (mode === 'maintenance') {
        writeFileSync(join(directories.mode, 'maintenance'), '');
        chmodSync(join(directories.mode, 'maintenance'), 0o644);
      }
      if (mode === 'serving' && !webImage)
        rows.push(...(await privateListenerChecks({ names, directories, nginxImage })));
      for (const testCase of INGRESS_SMOKE_CASES.filter((item) => item.mode === mode)) {
        if (testCase.stubOnly && webImage) continue;
        const response = await request({ ...testCase, ports });
        const problems = checkResponse(testCase, response);
        rows.push({
          mode,
          scheme: testCase.scheme ?? 'https',
          host: testCase.host ?? CANONICAL_HOST,
          method: testCase.method ?? 'GET',
          path: testCase.path,
          status: response.closed ? 'closed' : response.status,
          title: response.title ?? null,
          retryAfter: response.headers?.['retry-after'] ?? null,
          xRobotsTag: response.headers?.['x-robots-tag'] ?? null,
          cacheControl: response.headers?.['cache-control'] ?? null,
          location: response.headers?.location ?? null,
          ...(testCase.expect.sameAs ? { sameAs: testCase.expect.sameAs } : {}),
          pass: problems.length === 0,
          problems,
        });
      }
      for (const row of rows.filter((item) => item.mode === mode && item.sameAs)) {
        const reference = rows.find((item) => item.mode === mode && item.path === row.sameAs);
        if (reference && reference.title !== row.title) {
          row.pass = false;
          row.problems.push(`title ${row.title} != ${row.sameAs} title ${reference.title}`);
        }
      }
    }
    const ingressLog = docker(['logs', names.ingress]);
    const log = checkAccessLog(ingressLog.stdout);
    rows.push({
      mode: 'all',
      scheme: 'log',
      method: '—',
      path: 'access log rows',
      status: log.rows,
      pass: log.problems.length === 0,
      problems: log.problems,
    });
    const errorLog = checkErrorLog(ingressLog.stderr);
    rows.push({
      mode: 'all',
      scheme: 'log',
      method: '—',
      path: 'error log lines',
      status: errorLog.lines,
      pass: errorLog.problems.length === 0,
      problems: errorLog.problems,
    });
  } finally {
    docker(['rm', '-f', names.ingress, names.web, names.webPeer, names.apiPeer, names.api], {
      allowFailure: true,
    });
    docker(['network', 'rm', names.network, names.apiNetwork], { allowFailure: true });
    if (!keepImage) docker(['image', 'rm', '-f', names.image], { allowFailure: true });
    rmSync(directories.root, { recursive: true, force: true });
  }
  return { webUpstream: webImage ? 'web-image' : 'stub', nginxBase: nginxImage, rows };
}

async function waitForWeb(ports) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const response = await request({ path: '/', ports });
    if (!response.closed && response.status === 200) return;
    await new Promise((done) => setTimeout(done, 1000));
  }
  throw new Error('Web did not answer / through the ingress within 120 seconds');
}

export function renderMarkdownTable(result) {
  const cell = (value) =>
    value === null || value === undefined ? '—' : String(value).replaceAll('|', '\\|');
  const lines = [
    `Web upstream: ${result.webUpstream}. nginx base: ${result.nginxBase}.`,
    '',
    '| mode | scheme | host | method | path | status | <title> | Retry-After | X-Robots-Tag | Cache-Control | Location | 판정 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const row of result.rows) {
    lines.push(
      `| ${[row.mode, row.scheme, row.host ?? '—', row.method, row.path, row.status, row.title, row.retryAfter, row.xRobotsTag, row.cacheControl, row.location].map(cell).join(' | ')} | ${row.pass ? 'PASS' : `FAIL ${cell((row.problems ?? []).join('; '))}`} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}

function isDirectExecution() {
  return process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isDirectExecution()) {
  const option = (name) =>
    process.argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
  const result = await runIngressSmoke({ webImage: option('web-image') });
  const outputPath = option('output')
    ? resolve(defaultRepoRoot, option('output'))
    : resolveArtifactPath(defaultRepoRoot, ['infra', 'user-host-ingress-smoke.json']);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  writeFileSync(outputPath.replace(/\.json$/u, '.md'), renderMarkdownTable(result));
  const failed = result.rows.filter((row) => !row.pass);
  console.log(
    `Web stage ingress smoke: ${result.rows.length - failed.length}/${result.rows.length} passed. Evidence: ${outputPath}`,
  );
  if (failed.length) {
    for (const row of failed)
      console.error(
        `${row.mode} ${row.method} ${row.host ?? ''}${row.path}: ${(row.problems ?? []).join('; ')}`,
      );
    process.exit(1);
  }
}
