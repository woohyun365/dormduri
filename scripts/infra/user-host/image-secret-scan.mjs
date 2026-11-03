#!/usr/bin/env node
// CD가 push하기 전에 build한 image의 filesystem에 secret 비슷한 값이 없는지 본다. 입력은 BuildKit이 쓴 OCI layout
// 디렉터리(`--output type=oci,dest=<dir>,tar=false`)이고, attestation manifest가 아닌 image manifest의 layer를 모두
// 푼다. 걸린 값은 출력하지 않고 종류·image 안 경로·줄 번호만 적는다.
// pattern 목록은 저장소 tracked-scope guard(scripts/git/tracked-scope.mjs)의 종류를 모두 담고 Slack webhook·Sentry auth
// token을 더한다. 그 module은 목록을 export하지 않아 여기에 따로 두며, 두 목록을 한 원본으로 합치는 일은 그 module owner의
// 후속이다. image에서는 build 입력에 섞이면 안 되는 local env 파일 이름도 본다.
import { createReadStream, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGunzip } from 'node:zlib';

export const IMAGE_SECRET_PATTERNS = Object.freeze([
  ['private key', /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/u],
  ['AWS access key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/u],
  ['GitHub token', /\b(?:gh[opsur]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})/u],
  ['Slack token', /\bxox[abposr]-[A-Za-z0-9-]{10,}/u],
  [
    'Slack webhook',
    /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]{8,}/u,
  ],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}/u],
  ['API secret key', /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{32,}/u],
  ['Sentry auth token', /\bsntry[su]_[A-Za-z0-9+/=_-]{20,}/u],
  ['credential in a URL', /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@/iu],
]);
// 알려진 오탐. 종류와 image 안 경로를 함께 좁힌다(경로만으로 넓게 빼지 않는다).
export const ALLOWED_FINDINGS = Object.freeze([
  {
    kind: 'private key',
    path: /^usr\/local\/lib\/node_modules\/npm\//u,
    reason: 'Node base image의 npm 문서·설정 정의가 `key` 설정 예시로 PEM header를 적는다',
  },
  {
    kind: 'credential in a URL',
    path: /^usr\/local\/lib\/node_modules\/npm\/node_modules\/hosted-git-info\/lib\/parse-url\.js$/u,
    reason:
      'Node base image의 npm hosted-git-info가 주석에 `proto://user:pass@host` 형식의 URL 예시를 적는다',
  },
]);
const allowed = (finding) =>
  ALLOWED_FINDINGS.some((rule) => rule.kind === finding.kind && rule.path.test(finding.path));
// local env 파일. 예시 파일(`.env.example` 등)은 값이 없는 template이라 뺀다.
const ENV_FILE = /(?:^|\/)\.env(?:\.(?!example$|sample$|template$)[A-Za-z0-9_-]+)?$/u;
// 이보다 큰 파일과 NUL byte가 있는 파일은 text가 아니라 보지 않는다(image의 binary·대형 asset).
const MAX_TEXT_BYTES = 8 * 1024 * 1024;
const ATTESTATION = 'attestation-manifest';

function readBlob(layout, digest) {
  return readFileSync(resolve(layout, 'blobs', ...digest.split(':')));
}

// OCI layout → 검사할 image manifest(attestation manifest 제외)의 layer digest 목록.
export function imageLayers(layout) {
  const root = JSON.parse(readFileSync(resolve(layout, 'index.json'), 'utf8'));
  const layers = [];
  const visit = (descriptor) => {
    const document = JSON.parse(readBlob(layout, descriptor.digest).toString('utf8'));
    if (Array.isArray(document.manifests)) {
      for (const child of document.manifests) {
        if (child.annotations?.['vnd.docker.reference.type'] === ATTESTATION) continue;
        visit(child);
      }
      return;
    }
    for (const layer of document.layers ?? []) layers.push(layer);
  };
  for (const descriptor of root.manifests ?? []) visit(descriptor);
  if (!layers.length) throw new Error(`${layout}: no image layers`);
  return layers;
}

export function textFindings(path, buffer) {
  const findings = [];
  if (ENV_FILE.test(path)) findings.push({ kind: 'local env file', path, line: 0 });
  if (buffer.length > MAX_TEXT_BYTES || buffer.includes(0)) return findings;
  const lines = buffer.toString('utf8').split('\n');
  lines.forEach((text, index) => {
    for (const [kind, pattern] of IMAGE_SECRET_PATTERNS) {
      if (pattern.test(text)) findings.push({ kind, path, line: index + 1 });
    }
  });
  return findings;
}

const field = (header, start, length) =>
  header
    .subarray(start, start + length)
    .toString('utf8')
    .replace(/\0.*$/su, '');
const octal = (header, start, length) =>
  Number.parseInt(field(header, start, length).trim() || '0', 8);

// gzip 또는 무압축 tar stream을 읽어 일반 파일마다 onFile(path, buffer)를 부른다. GNU long name(L)과 PAX(x) header를
// 따라 긴 경로를 복원한다. 큰 파일은 내용 없이 경로만 넘긴다.
export function walkTar(stream, onFile) {
  return new Promise((resolvePromise, reject) => {
    let pending = Buffer.alloc(0);
    let entry = null; // { path, size, remaining, chunks, type, keep }
    let longName = null;
    let paxPath = null;
    const finishEntry = () => {
      const content = entry.keep ? Buffer.concat(entry.chunks) : Buffer.alloc(0);
      if (entry.type === 'L') longName = content.toString('utf8').replace(/\0.*$/su, '');
      else if (entry.type === 'x') {
        const match = /(?:^|\n)\d+ path=([^\n]*)\n/u.exec(content.toString('utf8'));
        paxPath = match ? match[1] : null;
      } else if (entry.type === '0' || entry.type === '\0' || entry.type === '') {
        onFile(entry.path, entry.keep ? content : Buffer.alloc(MAX_TEXT_BYTES + 1));
      }
      entry = null;
    };
    stream.on('data', (chunk) => {
      pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;
      for (;;) {
        if (entry) {
          if (entry.remaining > 0) {
            const take = Math.min(entry.remaining, pending.length);
            if (take === 0) return;
            if (entry.keep) entry.chunks.push(pending.subarray(0, take));
            entry.remaining -= take;
            pending = pending.subarray(take);
            if (entry.remaining > 0) return;
          }
          const padding = (512 - (entry.size % 512)) % 512;
          if (pending.length < padding) return;
          pending = pending.subarray(padding);
          finishEntry();
          continue;
        }
        if (pending.length < 512) return;
        const header = pending.subarray(0, 512);
        pending = pending.subarray(512);
        if (header.every((byte) => byte === 0)) continue;
        const type = field(header, 156, 1);
        const prefix = field(header, 345, 155);
        const name = field(header, 0, 100);
        const headerPath = prefix ? `${prefix}/${name}` : name;
        const size = octal(header, 124, 12);
        const path = (paxPath ?? longName ?? headerPath).replace(/^\.\//u, '');
        if (type !== 'L' && type !== 'x') {
          longName = null;
          paxPath = null;
        }
        const metadata = type === 'L' || type === 'x';
        entry = {
          path,
          size,
          remaining: size,
          chunks: [],
          type,
          keep: metadata || size <= MAX_TEXT_BYTES,
        };
      }
    });
    stream.on('end', () => resolvePromise());
    stream.on('error', reject);
  });
}

export async function scanLayout(layout) {
  const findings = [];
  let files = 0;
  for (const layer of imageLayers(layout)) {
    const raw = createReadStream(resolve(layout, 'blobs', ...layer.digest.split(':')));
    const stream = /gzip/u.test(layer.mediaType ?? '') ? raw.pipe(createGunzip()) : raw;
    await walkTar(stream, (path, buffer) => {
      files += 1;
      findings.push(
        ...textFindings(path, buffer)
          .filter((finding) => !allowed(finding))
          .map((finding) => ({ ...finding, layer: layer.digest })),
      );
    });
  }
  return { layout, files, findings };
}

const isDirectExecution = () =>
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution()) {
  const layouts = process.argv.slice(2);
  if (!layouts.length) {
    console.error('usage: image-secret-scan.mjs <oci layout dir>...');
    process.exit(2);
  }
  let failed = false;
  for (const layout of layouts) {
    const result = await scanLayout(layout);
    console.log(
      `image secret scan: ${result.files} files, ${result.findings.length} findings (${layout})`,
    );
    for (const finding of result.findings) {
      failed = true;
      console.error(`  ${finding.kind}: ${finding.path}${finding.line ? `:${finding.line}` : ''}`);
    }
  }
  process.exit(failed ? 1 : 0);
}
