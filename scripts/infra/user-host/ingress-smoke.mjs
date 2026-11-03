#!/usr/bin/env node
// Web 단계 ingress image smoke(경로 표: infra/deploy/README.md 'User host 묶음'). ingress image를 build해 로컬 Docker에서 띄우고,
// 경로·method·mode(정상·Web 무응답·점검)별로 status·<title>·header를 단언한다. 세 503 화면은 status가 같아
// `nginx -t`만으로는 어느 화면이 나가는지 알 수 없으므로 실제 응답을 본다. 결과 표는 evidence로도 쓴다.
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
import { USER_HOST_RENDER_ENVIRONMENT } from './compose-contract.mjs';

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
// sameAs: Web이 그 경로와 같은 page를 내야 한다(stub Web은 받은 URI를 X-Stub-Uri로 돌려준다).
const web = (sameAs) => ({ status: 200, web: true, ...(sameAs ? { sameAs } : {}) });

// 경로별 기대값. mode: serving(Web 응답), web-down(Web 무응답), maintenance(점검 flag).
export const INGRESS_SMOKE_CASES = Object.freeze([
  ...['/', '/privacy', '/terms'].map((path) => ({ mode: 'serving', path, expect: web() })),
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
  ...[
    '/login',
    '/signup',
    '/password-reset',
    '/main',
    '/main/chat',
    '/notices/1',
    '/support',
    '/api',
  ].map((path) => ({ mode: 'serving', path, expect: page(PAGE_TITLES.comingSoon, 503, '3600') })),
  {
    mode: 'serving',
    method: 'POST',
    path: '/api/auth/login',
    expect: page(PAGE_TITLES.comingSoon, 503, '3600'),
  },
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
  { mode: 'web-down', path: '/signup', expect: page(PAGE_TITLES.comingSoon, 503, '3600') },
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
  writeFileSync(
    join(directories.stub, 'stub.conf'),
    `server {\n  listen 3000;\n  location / {\n    add_header X-Powered-By stub-web;\n    add_header X-Stub-Uri $request_uri;\n    default_type text/html;\n    return 200 '<!doctype html><title>${STUB_TITLE}</title>';\n  }\n}\n`,
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
    'stub/stub.conf',
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

function privateListenerChecks(webContainer, ingressAlias) {
  // The private listener is reachable only from the web network. Probe it from the stub web container with a raw
  // HTTP/1.0 request (busybox wget drops the headers and body of an error status).
  const probe = (path) => {
    const raw = docker(
      [
        'exec',
        webContainer,
        'sh',
        '-c',
        `printf 'GET ${path} HTTP/1.0\\r\\nHost: ${ingressAlias}\\r\\n\\r\\n' | nc -w 5 ${ingressAlias} 8081`,
      ],
      { allowFailure: true },
    ).stdout;
    const [head = '', body = ''] = raw.split('\r\n\r\n');
    return {
      status: Number(/^HTTP\/1\.1 (\d{3})/u.exec(head)?.[1] ?? 0) || null,
      contentType: /^Content-Type: (.+)$/imu.exec(head)?.[1]?.trim() ?? null,
      body: body.trim(),
    };
  };
  const api = probe('/api/legal/documents/privacy');
  const health = probe('/__ingress/health');
  const apiPass =
    api.status === 503 &&
    api.contentType === 'application/json' &&
    api.body === '{"status":"unavailable"}';
  return [
    {
      mode: 'serving',
      scheme: 'private',
      method: 'GET',
      path: ':8081/api/legal/documents/privacy',
      status: api.status,
      pass: apiPass,
      problems: apiPass ? [] : [`${api.status} ${api.contentType} ${api.body}`],
    },
    {
      mode: 'serving',
      scheme: 'private',
      method: 'GET',
      path: ':8081/__ingress/health',
      status: health.status,
      pass: health.status === 204,
      problems: health.status === 204 ? [] : [`${health.status}`],
    },
  ];
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
  const suffix = `${process.pid}-${Date.now()}`;
  const names = {
    image: `dormduri-ingress:smoke-${suffix}`,
    network: `dormduri-ingress-smoke-${suffix}`,
    web: `dormduri-ingress-smoke-web-${suffix}`,
    ingress: `dormduri-ingress-smoke-ingress-${suffix}`,
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
    docker(['network', 'create', '--label', LABEL, names.network]);
    const webArgs = webImage
      ? [
          ...Object.entries(userHostWebEnvironment(repoRoot)).flatMap(([key, value]) => [
            '-e',
            `${key}=${value}`,
          ]),
          webImage,
        ]
      : ['-v', `${directories.stub}/stub.conf:/etc/nginx/conf.d/default.conf:ro`, nginxImage];
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
        rows.push(...privateListenerChecks(names.web, 'ingress'));
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
  } finally {
    docker(['rm', '-f', names.ingress, names.web], { allowFailure: true });
    docker(['network', 'rm', names.network], { allowFailure: true });
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
