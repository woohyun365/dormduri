import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';

import { ALLOWED_FINDINGS, imageLayers, scanLayout, textFindings } from './image-secret-scan.mjs';

// A minimal ustar archive: each entry is a 512-byte header plus content padded to 512 bytes.
function tarEntry(name, content, type = '0') {
  const body = Buffer.from(content);
  const header = Buffer.alloc(512);
  header.write(name.slice(0, 100), 0, 'utf8');
  header.write('0000644\0', 100);
  header.write('0000000\0', 108);
  header.write('0000000\0', 116);
  header.write(`${body.length.toString(8).padStart(11, '0')}\0`, 124);
  header.write('00000000000\0', 136);
  header.write('        ', 148);
  header.write(type, 156);
  header.write('ustar\0', 257);
  header.write('00', 263);
  let sum = 0;
  for (const byte of header) sum += byte;
  header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148);
  const padding = Buffer.alloc((512 - (body.length % 512)) % 512);
  return Buffer.concat([header, body, padding]);
}
const tar = (...entries) => Buffer.concat([...entries, Buffer.alloc(1024)]);

function writeLayout(layers, { attestationLayer } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'image-secret-scan-'));
  mkdirSync(join(root, 'blobs', 'sha256'), { recursive: true });
  const blob = (buffer) => {
    const digest = `sha256:${createHash('sha256').update(buffer).digest('hex')}`;
    writeFileSync(join(root, 'blobs', 'sha256', digest.slice(7)), buffer);
    return { digest, size: buffer.length };
  };
  const manifest = (layerBuffers) =>
    blob(
      Buffer.from(
        JSON.stringify({
          schemaVersion: 2,
          layers: layerBuffers.map((buffer) => ({
            mediaType: 'application/vnd.oci.image.layer.v1.tar+gzip',
            ...blob(gzipSync(buffer)),
          })),
        }),
      ),
    );
  const index = blob(
    Buffer.from(
      JSON.stringify({
        schemaVersion: 2,
        manifests: [
          { mediaType: 'application/vnd.oci.image.manifest.v1+json', ...manifest(layers) },
          ...(attestationLayer
            ? [
                {
                  mediaType: 'application/vnd.oci.image.manifest.v1+json',
                  annotations: { 'vnd.docker.reference.type': 'attestation-manifest' },
                  ...manifest([attestationLayer]),
                },
              ]
            : []),
        ],
      }),
    ),
  );
  writeFileSync(join(root, 'index.json'), JSON.stringify({ schemaVersion: 2, manifests: [index] }));
  return root;
}

const fakeKey = ['-----BEGIN', 'RSA PRIVATE KEY-----'].join(' ');
const fakeAwsKey = `AKIA${'Q'.repeat(16)}`;

test('every secret kind in a layer file is reported by kind, path and line, never by value', async () => {
  const longPath = `app/${'deep/'.repeat(30)}config.js`;
  const pax = tarEntry(
    '././@PaxHeader',
    `${(`path=${longPath}\n`.length + 4).toString()} path=${longPath}\n`,
    'x',
  );
  const layout = writeLayout([
    tar(
      tarEntry('app/server.js', `const a = 1;\nconst key = "${fakeKey}";\n`),
      pax,
      tarEntry('ignored-short-name', `aws=${fakeAwsKey}\n`),
      tarEntry('app/.env', 'TOKEN=x\n'),
      tarEntry('app/.env.example', 'TOKEN=\n'),
    ),
  ]);
  try {
    const result = await scanLayout(layout);
    const found = result.findings.map(({ kind, path, line }) => `${kind}|${path}|${line}`);
    assert.deepEqual(found.sort(), [
      `AWS access key|${longPath}|1`,
      'local env file|app/.env|0',
      'private key|app/server.js|2',
    ]);
    assert.ok(!JSON.stringify(result).includes(fakeAwsKey), 'the value is never reported');
    assert.equal(result.files, 4);
  } finally {
    rmSync(layout, { recursive: true, force: true });
  }
});

test('attestation manifests are not scanned and a clean image has no findings', async () => {
  const layout = writeLayout([tar(tarEntry('app/index.html', '<title>ok</title>\n'))], {
    attestationLayer: tar(tarEntry('sbom.json', `{"x":"${fakeKey}"}`)),
  });
  try {
    assert.equal(imageLayers(layout).length, 1);
    assert.deepEqual((await scanLayout(layout)).findings, []);
  } finally {
    rmSync(layout, { recursive: true, force: true });
  }
});

test('a credential inside a URL is reported, and the npm URL parser comment is allowed', async () => {
  const urlWithCredential = [
    'https://',
    'deploy',
    ':',
    'not-a-real-password',
    '@registry.example.invalid/',
  ].join('');
  const layout = writeLayout([
    tar(
      tarEntry('app/config.js', `const url = "${urlWithCredential}";\n`),
      tarEntry(
        'usr/local/lib/node_modules/npm/node_modules/hosted-git-info/lib/parse-url.js',
        `// ${urlWithCredential}\n`,
      ),
      tarEntry('usr/local/lib/node_modules/npm/lib/fetch.js', `// ${urlWithCredential}\n`),
    ),
  ]);
  try {
    const result = await scanLayout(layout);
    assert.deepEqual(result.findings.map(({ kind, path }) => `${kind}|${path}`).sort(), [
      'credential in a URL|app/config.js',
      'credential in a URL|usr/local/lib/node_modules/npm/lib/fetch.js',
    ]);
    assert.ok(
      !JSON.stringify(result).includes('not-a-real-password'),
      'the value is never reported',
    );
  } finally {
    rmSync(layout, { recursive: true, force: true });
  }
});

test('the allow list is narrowed by kind and path together', async () => {
  const layout = writeLayout([
    tar(
      tarEntry('usr/local/lib/node_modules/npm/docs/config.md', `${fakeKey}\n`),
      tarEntry('usr/local/lib/node_modules/npm/lib/token.js', `${fakeAwsKey}\n`),
      tarEntry('usr/local/lib/node_modules/other/key.pem', `${fakeKey}\n`),
    ),
  ]);
  try {
    const found = (await scanLayout(layout)).findings.map(({ kind, path }) => `${kind}|${path}`);
    assert.deepEqual(found.sort(), [
      'AWS access key|usr/local/lib/node_modules/npm/lib/token.js',
      'private key|usr/local/lib/node_modules/other/key.pem',
    ]);
    for (const rule of ALLOWED_FINDINGS) assert.ok(rule.reason);
  } finally {
    rmSync(layout, { recursive: true, force: true });
  }
});

// API image(runtime·migrate)의 외부 package 예시, 저장소의 local 개발 DB 기본값, Debian perl 문서는 종류와 그 package·파일
// 경로가 함께 맞을 때만 허용한다. 이름 앞부분만 같은 package, 허용 package의 다른 종류, `/app` 밖, image에서 지운 경로는 남는다.
test('API image allowances hold only the listed package, file and kind together', async () => {
  const url = ['postgresql://', 'user', ':', 'not-a-real-password', '@localhost/db'].join('');
  const content = {
    'credential in a URL': `const url = "${url}";\n`,
    'AWS access key': `${fakeAwsKey}\n`,
    'private key': `${fakeKey}\n`,
  };
  const store = (name, file) =>
    `app/node_modules/.pnpm/${name.replace('/', '+')}@1.0.0/node_modules/${name}/${file}`;
  const allowed = [
    ['credential in a URL', store('fast-uri', 'test/parse.test.js')],
    ['credential in a URL', store('@types/node', 'url.d.ts')],
    [
      'credential in a URL',
      'app/packages/database/node_modules/.pnpm/prisma@7.10.1_x/node_modules/prisma/build/cli.js',
    ],
    ['AWS access key', store('@aws-sdk/nested-clients', 'sts.d.ts')],
    ['private key', store('dotenv', 'README.md')],
    ['credential in a URL', 'app/dist/platform/database/database.config.js'],
    ['credential in a URL', 'app/dist/platform/database/database.config.js.map'],
    ['credential in a URL', 'app/packages/database/prisma.config.ts'],
    ['credential in a URL', 'usr/share/perl/5.40.1/HTTP/Tiny.pm'],
  ];
  const reported = [
    ['credential in a URL', store('fast-uri-fork', 'index.js')],
    ['private key', store('fast-uri', 'test/key.pem')],
    ['credential in a URL', 'node_modules/.pnpm/fast-uri@1.0.0/node_modules/fast-uri/index.js'],
    ['credential in a URL', 'app/dist/platform/database/other.js'],
    ['credential in a URL', 'app/src/platform/database/database.config.ts'],
    ['private key', 'etc/ssl/private/ssl-cert-snakeoil.key'],
    ['credential in a URL', 'root/.npm/_cacache/content-v2/sha512/00/aa/blob'],
  ];
  const entries = [...allowed, ...reported];
  for (const [, path] of entries) assert.ok(path.length <= 100, `ustar name fits: ${path}`);
  const layout = writeLayout([
    tar(...entries.map(([kind, path]) => tarEntry(path, content[kind]))),
  ]);
  try {
    const found = (await scanLayout(layout)).findings.map(({ kind, path }) => `${kind}|${path}`);
    assert.deepEqual(found.sort(), reported.map(([kind, path]) => `${kind}|${path}`).sort());
  } finally {
    rmSync(layout, { recursive: true, force: true });
  }
});

test('binary and oversized content is not read as text, but a local env file name still counts', () => {
  assert.deepEqual(textFindings('bin/tool', Buffer.from(`\0${fakeKey}`)), []);
  assert.deepEqual(textFindings('app/.env.production', Buffer.alloc(9 * 1024 * 1024)), [
    { kind: 'local env file', path: 'app/.env.production', line: 0 },
  ]);
});
