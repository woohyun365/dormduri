import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { WEB_TRANSIT } from './compose-contract.mjs';
import { checkErrorLog } from './ingress-smoke.mjs';
import { expectedIngressRoutes, readWebRoutes } from './web-routes.mjs';

const repoRoot = process.cwd();
const ingressRoot = resolve(repoRoot, 'infra/deploy/user/ingress');
const read = (path) => readFileSync(resolve(ingressRoot, path), 'utf8');
const conf = read('conf.d/dormduri.conf');
const headers = read('snippets/headers.conf');
const proxyWeb = read('snippets/proxy-web.conf');
const proxyApi = read('snippets/proxy-api.conf');
const staticPage = read('snippets/static-page.conf');
const dockerfile = read('Dockerfile');
const PAGE_FILES = ['coming-soon.html', 'maintenance.html', 'not-found.html', 'unavailable.html'];

// `server { ... }` blocks by brace depth. Comments are removed first so braces in comments do not count.
function serverBlocks(source) {
  const text = source.replace(/#[^\n]*/gu, '');
  const blocks = [];
  const pattern = /(^|\n)\s*server\s*\{/gu;
  let match;
  while ((match = pattern.exec(text))) {
    let depth = 0;
    let index = text.indexOf('{', match.index);
    const start = index;
    for (; index < text.length; index += 1) {
      if (text[index] === '{') depth += 1;
      if (text[index] === '}') depth -= 1;
      if (depth === 0) break;
    }
    blocks.push(text.slice(start + 1, index));
  }
  return blocks;
}

function serverFor(name, { tls }) {
  const matches = serverBlocks(conf).filter(
    (block) =>
      (/server_name\s+([^;]+);/u.exec(block)?.[1].trim().split(/\s+/u) ?? []).includes(name) &&
      /listen 8443 ssl/u.test(block) === tls,
  );
  assert.equal(matches.length, 1, `${name} (tls=${tls}) must have one server block`);
  return matches[0];
}

// location 줄: modifier(=, ^~, ~, 없음), 경로, 본문. 본문은 따옴표 안 중괄호(JSON 응답 본문)를 건너뛰며 끝을 찾는다.
function locations(block) {
  const found = [];
  const pattern = /location\s+(=|\^~|~\*|~)?\s*(\S+)\s*\{/gu;
  let match;
  while ((match = pattern.exec(block))) {
    let index = pattern.lastIndex;
    let quote = null;
    for (; index < block.length; index += 1) {
      const character = block[index];
      if (quote) {
        if (character === quote) quote = null;
      } else if (character === "'" || character === '"') {
        quote = character;
      } else if (character === '}') {
        break;
      }
    }
    found.push({
      modifier: match[1] ?? '',
      path: match[2],
      body: block.slice(pattern.lastIndex, index),
    });
    pattern.lastIndex = index + 1;
  }
  return found;
}

function comingSoonSegments(location) {
  const single = /^\^\/([a-z-]+)\(\?:\/\|\$\)$/u.exec(location.path);
  if (single) return [single[1]];
  const alternatives = /^\^\/\(\?:([a-z|-]+)\)\(\?:\/\|\$\)$/u.exec(location.path);
  assert.ok(alternatives, `unexpected coming-soon pattern: ${location.path}`);
  return alternatives[1].split('|').sort();
}

const apex = serverFor('dormduri.com', { tls: true });
const apexLocations = locations(apex);
const proxied = apexLocations.filter((location) =>
  location.body.includes('include /etc/nginx/snippets/proxy-web.conf;'),
);
const regexLocations = apexLocations.filter((location) => location.modifier === '~');
const comingSoon = regexLocations.filter((location) => location.body.includes('coming-soon.html'));
const jsonComingSoon = regexLocations.filter(
  (location) => !location.body.includes('coming-soon.html'),
);

test('the allow list sends only the opened pages, Next.js assets and the Web metadata files to Web', () => {
  const routes = readWebRoutes(repoRoot);
  assert.deepEqual(
    routes.unknownMetadata,
    [],
    'a new metadata file needs an ingress allow-list decision',
  );
  const expected = expectedIngressRoutes(routes);
  assert.deepEqual(
    proxied
      .filter((location) => location.modifier === '=')
      .map((location) => location.path)
      .sort(),
    expected.exact,
  );
  assert.deepEqual(
    proxied
      .filter((location) => location.modifier === '^~')
      .map((location) => location.path)
      .sort(),
    expected.prefix,
  );
  assert.equal(proxied.length, expected.exact.length + expected.prefix.length);
  // proxy_pass appears only through the shared snippet, so no other location reaches Web.
  assert.doesNotMatch(conf, /proxy_pass/u);
  // Web gets the normalized path nginx matched, so encoded slashes or dot segments cannot reach an unopened page.
  assert.match(proxyWeb, /^proxy_pass \$web_upstream\$uri\$is_args\$args;$/mu);
  // $uri is decoded and copied into the upstream request line unescaped, so control characters, spaces, `%`, `?` and `#`
  // must end at nginx before proxy_pass.
  const guard = /^if \(\$uri ~ "\[\\x01-\\x20\\x7F%\?#\]"\) \{\n {2}return 400;\n\}$/mu.exec(
    proxyWeb,
  );
  assert.ok(guard, 'the decoded-path guard is present');
  assert.ok(guard.index < proxyWeb.indexOf('proxy_pass '), 'the guard runs before proxy_pass');
});

test('every Web route the stage does not open is a coming-soon path, and nothing else is', () => {
  const expected = expectedIngressRoutes(readWebRoutes(repoRoot));
  assert.equal(comingSoon.length, 1);
  assert.deepEqual(comingSoonSegments(comingSoon[0]), expected.comingSoon);
  assert.match(comingSoon[0].body, /error_page 503 \/__pages\/coming-soon\.html;\s*return 503;/u);
  assert.equal(regexLocations.length, 2, 'only the page and BFF coming-soon locations use a regex');
});

// The BFF prefix stays closed on the public host: there is no public API address (D-AB1), and a browser fetch reads JSON.
test('the BFF prefix answers a JSON coming-soon 503 before reading a body and never reaches Web or API', () => {
  const expected = expectedIngressRoutes(readWebRoutes(repoRoot));
  assert.deepEqual(expected.jsonComingSoon, ['api']);
  assert.equal(jsonComingSoon.length, 1);
  assert.deepEqual(comingSoonSegments(jsonComingSoon[0]), expected.jsonComingSoon);
  const { body } = jsonComingSoon[0];
  assert.match(body, /return 503 '\{"status":"coming-soon"\}';/u);
  assert.match(body, /default_type application\/json;/u);
  assert.match(body, /add_header Retry-After "3600" always;/u);
  assert.match(body, /add_header Cache-Control "no-store" always;/u);
  assert.match(body, /include \/etc\/nginx\/snippets\/headers\.conf;/u);
  assert.doesNotMatch(body, /proxy|snippets\/proxy-/u);
});

test('the route reader fails closed on conventions it does not map', () => {
  const root = mkdtempSync(join(tmpdir(), 'dormduri-web-routes-'));
  try {
    const app = join(root, 'apps/web/src/app');
    mkdirSync(join(app, 'login'), { recursive: true });
    writeFileSync(join(app, 'login/page.tsx'), '');
    mkdirSync(join(app, 'components'), { recursive: true });
    writeFileSync(join(app, 'components/x.tsx'), '');
    mkdirSync(join(app, '_private'), { recursive: true });
    writeFileSync(join(app, '_private/page.tsx'), '');
    writeFileSync(join(app, 'robots.ts'), '');
    writeFileSync(join(app, 'opengraph-image.png'), '');
    const publicDirectory = join(root, 'apps/web/public');
    mkdirSync(join(publicDirectory, 'og'), { recursive: true });
    writeFileSync(join(publicDirectory, '.gitkeep'), '');
    writeFileSync(join(publicDirectory, 'og/card.png'), '');
    const routes = readWebRoutes(root);
    assert.deepEqual(
      routes.publicFiles,
      ['/og/card.png'],
      'a public file must be on the allow list',
    );
    assert.ok(expectedIngressRoutes(routes).exact.includes('/og/card.png'));
    assert.deepEqual(
      routes.segments,
      ['login'],
      'a directory without page or route, or a private folder, is not a URL',
    );
    assert.deepEqual(routes.metadata, ['/robots.txt']);
    assert.deepEqual(routes.unknownMetadata, ['opengraph-image.png']);
    mkdirSync(join(app, '(group)'));
    assert.throws(() => readWebRoutes(root), /unsupported app directory convention/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('static pages are chosen by error_page internal URIs so every method gets the same page and status', () => {
  // A named location keeps the client method, and nginx answers POST to a static file with 405 (Owner 2026-11-03 D3).
  for (const source of [conf, proxyWeb, staticPage])
    assert.doesNotMatch(source, /error_page[^;]*@/u);
  assert.match(apex, /error_page 404 \/__pages\/not-found\.html;/u);
  assert.match(apex, /error_page 500 \/__pages\/unavailable\.html;/u);
  assert.match(apex, /error_page 503 \/__pages\/maintenance\.html;/u);
  assert.match(proxyWeb, /^error_page 500 \/__pages\/unavailable\.html;$/mu);
  assert.match(proxyWeb, /^error_page 502 504 =503 \/__pages\/unavailable\.html;$/mu);
  const fallback = apexLocations.find(
    (location) => location.modifier === '' && location.path === '/',
  );
  assert.match(fallback.body, /^\s*return 404;\s*$/u);
});

test('the four page files are served only internally and each is wired to one page location', () => {
  assert.deepEqual(readdirSync(resolve(ingressRoot, 'html')).sort(), PAGE_FILES);
  const pageLocations = apexLocations.filter((location) => location.path.startsWith('/__pages/'));
  assert.deepEqual(
    pageLocations
      .filter((location) => location.modifier === '=')
      .map((location) => location.path)
      .sort(),
    PAGE_FILES.map((file) => `/__pages/${file}`),
  );
  for (const location of pageLocations.filter((item) => item.modifier === '=')) {
    assert.match(location.body, /include \/etc\/nginx\/snippets\/static-page\.conf;/u);
  }
  assert.match(
    pageLocations.find((location) => location.modifier === '^~')?.body ?? '',
    /^\s*internal;\s*$/u,
  );
  assert.match(staticPage, /^internal;$/mu);
  assert.match(staticPage, /^root \/usr\/share\/nginx\/dormduri;$/mu);
  assert.match(dockerfile, /^COPY html\/ \/usr\/share\/nginx\/dormduri\/__pages\/$/mu);
});

test('Retry-After goes with the 503 pages only', () => {
  const body = (file) =>
    apexLocations.find((location) => location.path === `/__pages/${file}`).body;
  assert.match(body('coming-soon.html'), /add_header Retry-After "\d+" always;/u);
  assert.match(body('maintenance.html'), /add_header Retry-After "\d+" always;/u);
  assert.match(
    body('unavailable.html'),
    /add_header Retry-After \$dormduri_unavailable_retry_after always;/u,
  );
  assert.doesNotMatch(body('not-found.html'), /Retry-After/u);
  // The unavailable page also answers nginx's own 500; the map sends Retry-After only with 503.
  assert.match(
    conf,
    /map \$status \$dormduri_unavailable_retry_after \{\s*503 \d+;\s*default '';\s*\}/u,
  );
  assert.match(staticPage, /^add_header Cache-Control "no-store" always;$/mu);
});

test('the static page CSP allows exactly the shared inline style and data: images', () => {
  const styles = PAGE_FILES.map(
    (file) =>
      /<style>([\s\S]*?)<\/style>/u.exec(
        readFileSync(resolve(ingressRoot, 'html', file), 'utf8'),
      )[1],
  );
  assert.equal(new Set(styles).size, 1);
  const hash = createHash('sha256').update(styles[0]).digest('base64');
  const csp = /add_header Content-Security-Policy "([^"]+)" always;/u.exec(staticPage)?.[1];
  assert.equal(
    csp,
    `default-src 'none'; style-src 'sha256-${hash}'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
  );
});

test('every response carries noindex and the TLS servers carry the security headers', () => {
  for (const header of [
    /^add_header Strict-Transport-Security "max-age=604800" always;$/mu,
    /^add_header X-Robots-Tag "noindex" always;$/mu,
    /^add_header X-Content-Type-Options "nosniff" always;$/mu,
    /^add_header X-Frame-Options "DENY" always;$/mu,
    /^add_header Referrer-Policy "strict-origin-when-cross-origin" always;$/mu,
  ]) {
    assert.match(headers, header);
  }
  for (const block of [apex, serverFor('www.dormduri.com', { tls: true })]) {
    assert.match(block, /include \/etc\/nginx\/snippets\/headers\.conf;/u);
    assert.match(block, /include \/etc\/nginx\/snippets\/tls\.conf;/u);
  }
  // Locations with their own add_header do not inherit the server headers, so each of them includes the headers again
  // (static-page.conf includes headers.conf).
  for (const location of apexLocations.filter((item) => /add_header/u.test(item.body))) {
    assert.match(
      location.body,
      /include \/etc\/nginx\/snippets\/(?:static-page|headers)\.conf;/u,
      location.path,
    );
  }
  assert.match(staticPage, /^include \/etc\/nginx\/snippets\/headers\.conf;$/mu);
  assert.match(
    serverFor('dormduri.com', { tls: false }),
    /add_header X-Robots-Tag "noindex" always;/u,
  );
  assert.match(proxyWeb, /^proxy_hide_header X-Powered-By;$/mu);
});

test('maintenance mode answers every outside path and skips the internal page requests it redirects to', () => {
  const head = apex.slice(0, apex.indexOf('location'));
  assert.match(
    head,
    /set \$dormduri_maintenance '';\s*if \(-f \/run\/dormduri-mode\/maintenance\) \{\s*set \$dormduri_maintenance on;\s*\}\s*if \(\$uri ~ \^\/__pages\/\) \{\s*set \$dormduri_maintenance '';\s*\}\s*if \(\$dormduri_maintenance\) \{\s*return 503;\s*\}/u,
  );
});

test('unknown hosts are closed, HTTP only serves ACME and redirects, and the private listener never reaches Web', () => {
  const blocks = serverBlocks(conf);
  assert.ok(
    blocks.some((block) =>
      /listen 8080 default_server;\s*server_name _;\s*return 444;/u.test(block),
    ),
  );
  assert.ok(
    blocks.some((block) =>
      /listen 8443 ssl default_server;\s*server_name _;\s*ssl_reject_handshake on;/u.test(block),
    ),
  );
  const http = serverFor('dormduri.com', { tls: false });
  assert.deepEqual(
    locations(http).map((location) => location.path),
    ['/.well-known/acme-challenge/', '/'],
  );
  assert.match(http, /return 301 https:\/\/dormduri\.com\$request_uri;/u);
  const privateListener = blocks.find((block) => /listen 8081;/u.test(block));
  assert.deepEqual(
    locations(privateListener).map((location) => location.path),
    ['/__ingress/health', '^/internal(?:/|$)', '/', '@api_unavailable'],
  );
  // The private listener sends to API only, never to Web.
  assert.doesNotMatch(privateListener, /proxy-web|web_upstream/u);
  assert.match(
    locations(privateListener).find((location) => location.path === '/').body,
    /^\s*include \/etc\/nginx\/snippets\/proxy-api\.conf;\s*$/u,
  );
  assert.match(privateListener, /return 503 '\{"status":"unavailable"\}';/u);
});

// The private listener accepts the Web container address and loopback (the container healthcheck) only; any other peer, such as
// a container on the API transit, gets 403. It listens on every address so nginx starts even if a network is attached after
// the container starts. API operation paths stay closed.
test('the private listener accepts only the Web container and loopback and sends nothing but API requests to API', () => {
  const privateListener = serverBlocks(conf).find((block) => /listen 8081;/u.test(block));
  assert.deepEqual(
    [...privateListener.matchAll(/^\s*listen ([^;]+);/gmu)].map((match) => match[1]),
    ['8081'],
  );
  assert.deepEqual(
    [...privateListener.matchAll(/^\s*(allow|deny) ([^;]+);/gmu)].map(
      (match) => `${match[1]} ${match[2]}`,
    ),
    [`allow ${WEB_TRANSIT.web}`, 'allow 127.0.0.1', 'deny all'],
  );
  // 대소문자를 구분하지 않는 regex라 `/INTERNAL/metrics`처럼 바꾼 경로도 닫힌다(API router는 대소문자를 구분하지 않는다).
  const internal = locations(privateListener).find(
    (location) => location.path === '^/internal(?:/|$)',
  );
  assert.equal(internal.modifier, '~*');
  assert.match(internal.body, /return 404 '\{"status":"not-found"\}';/u);
  assert.match(proxyApi, /^set \$api_upstream http:\/\/api:4000;$/mu);
  assert.match(proxyApi, /^proxy_pass \$api_upstream;$/mu);
  assert.equal([...proxyApi.matchAll(/^proxy_pass /gmu)].length, 1);
  // Forwarding trust is off (HTTP_TRUST_PROXY_HOPS=0): client address headers from the previous hop are cleared.
  for (const header of [
    'X-Forwarded-For',
    'X-Real-IP',
    'Forwarded',
    'X-Forwarded-Host',
    'X-Forwarded-Proto',
  ])
    assert.match(proxyApi, new RegExp(`^proxy_set_header ${header} "";$`, 'mu'), header);
  assert.match(proxyApi, /^error_page 502 503 504 = @api_unavailable;$/mu);
  assert.match(proxyApi, /^proxy_intercept_errors off;$/mu);
});

test('the ingress image pins its base by digest and runs as the unprivileged nginx user', () => {
  assert.match(dockerfile, /^FROM nginx:[A-Za-z0-9._-]+@sha256:[a-f0-9]{64}$/mu);
  assert.equal([...dockerfile.matchAll(/^FROM /gmu)].length, 1);
  assert.match(dockerfile, /^USER 101:101$/mu);
  assert.match(dockerfile, /^ENTRYPOINT \[\]$/mu);
  assert.match(read('nginx.conf'), /^\s*server_tokens off;$/mu);
});

// Access log rows are operations logs (OO-R1): the client address is masked to IPv4 /24 or IPv6 /48, the request keeps
// method, path without the query string and protocol, and the referer is not kept.
test('the access log keeps a masked client prefix and the path without query string or referer', () => {
  const nginx = read('nginx.conf');
  const format = /log_format main ((?:'[^']*'\s*)+);/u.exec(nginx)?.[1].replace(/'\s*'/gu, '');
  assert.ok(format, 'log_format main is defined');
  assert.equal(
    format,
    `'$dormduri_client_prefix - [$time_local] "$request_method $dormduri_log_path $server_protocol" $status $body_bytes_sent "$http_user_agent" "$http_x_request_id"'`,
  );
  for (const forbidden of [
    '$remote_addr',
    '$request ',
    '$request_uri',
    '$http_referer',
    '$args',
    '$query_string',
  ])
    assert.ok(!format.includes(forbidden), forbidden);
  assert.match(
    nginx,
    /map \$remote_addr \$dormduri_client_prefix \{\n(?:\s+"[^"]+" \$\w+[.:]\S*;\n)+\s+"~\^::" ::\/48;\n\s+default -;\n\s+\}/u,
  );
  assert.match(
    nginx,
    /map \$request_uri \$dormduri_log_path \{\s*~\^\(\?<path>\[\^\?\]\*\) \$path;\s*default -;\s*\}/u,
  );
  assert.equal([...nginx.matchAll(/^\s*access_log /gmu)].length, 1);
  // error log 줄에는 nginx가 원본 client 주소·query가 붙은 요청 줄·referrer를 붙인다. 요청 문맥 오류(warn·error·crit)를 쓰지
  // 않도록 alert 이상만 남긴다(Owner 2026-11-10). 다른 파일은 error_log를 다시 정하지 않는다.
  assert.deepEqual(
    [...nginx.matchAll(/^\s*error_log ([^;]+);/gmu)].map((match) => match[1]),
    ['/dev/stderr alert'],
  );
  for (const source of [conf, proxyWeb, proxyApi, staticPage, headers])
    assert.doesNotMatch(source, /error_log/u);
  assert.match(nginx, /^\s*access_log \/dev\/stdout main;$/mu);
  for (const source of [conf, proxyWeb, proxyApi, staticPage, headers])
    assert.doesNotMatch(source, /access_log (?!off;)/u);
});

// smoke의 error log 판정: nginx가 Web 무응답 때 쓰는 error 줄 모양(요청 문맥 포함)과 alert 미만 줄을 잡는다.
test('the smoke error log check rejects request context and lines below alert', () => {
  assert.deepEqual(checkErrorLog('').problems, []);
  assert.deepEqual(
    checkErrorLog('2026/11/10 15:10:17 [alert] 1#1: unknown process 47 exited on signal 13\n')
      .problems,
    [],
  );
  const upstream =
    '2026/11/10 15:10:44 [error] 7#7: *3 web could not be resolved (3: Host not found), client: 192.0.2.10, ' +
    'server: dormduri.com, request: "GET /privacy?probe=1 HTTP/2.0", host: "dormduri.com", ' +
    'referrer: "https://referer.invalid/from?token=probe"';
  const problems = checkErrorLog(`${upstream}\n`).problems;
  assert.equal(problems.length, 3);
  assert.ok(problems.every((problem) => !problem.includes('192.0.2.10')));
  assert.match(
    checkErrorLog('2026/11/10 [warn] 7#7: an upstream response is buffered\n').problems[0],
    /below alert/u,
  );
});
