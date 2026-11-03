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

test('binary and oversized content is not read as text, but a local env file name still counts', () => {
  assert.deepEqual(textFindings('bin/tool', Buffer.from(`\0${fakeKey}`)), []);
  assert.deepEqual(textFindings('app/.env.production', Buffer.alloc(9 * 1024 * 1024)), [
    { kind: 'local env file', path: 'app/.env.production', line: 0 },
  ]);
});
