#!/usr/bin/env node
// user host 배포 SSM Command document 둘(schema 2.2)을 만든다(D-AB11).
// - `dormduri-web-deploy`: infra/deploy/user/ssm/deploy.sh + lib.sh + infra/deploy/user/compose.yml(web 묶음 조각)
// - `dormduri-api-deploy`: infra/deploy/user/api/ssm/deploy-api.sh + 같은 lib.sh + infra/deploy/user/api/compose.yml(API 묶음
//   조각) + secret_bundle.py + infra/deploy/api/secret-mount.contract.json
// 결과 JSON은 tracked 파일이고 그 바이트의 sha256이 AWS document Hash와 같다. CD는 배포 전에 AWS document Hash와 이 파일의
// sha256을 대조한다. document 생성·갱신은 Owner가 한다(CD role에는 갱신 권한이 없다). 본문의 `documentSource`는 원본 파일들의
// sha256이라 host release 기록이 어느 원본으로 띄웠는지 남긴다. Systems Manager document 크기 한도는 64 KB다(AWS General
// Reference, Systems Manager quotas "Document size"). 본문에는 원본의 주석 줄을 담지 않는다(stripCommentLines, 한도 안에 두려고).
// 설명은 저장소 원본이 소유한다.
//
//   node scripts/infra/user-host/ssm-document.mjs          # 파일 둘을 다시 쓴다
//   node scripts/infra/user-host/ssm-document.mjs --check  # 파일이 원본과 같은지만 본다
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRepoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
export const DOCUMENT_NAME = 'dormduri-web-deploy';
export const DOCUMENT_PATH = 'infra/deploy/user/ssm/dormduri-web-deploy.json';
export const SCRIPT_PATH = 'infra/deploy/user/ssm/deploy.sh';
export const LIB_PATH = 'infra/deploy/user/ssm/lib.sh';
export const COMPOSE_PATH = 'infra/deploy/user/compose.yml';
export const API_DOCUMENT_NAME = 'dormduri-api-deploy';
export const API_DOCUMENT_PATH = 'infra/deploy/user/api/ssm/dormduri-api-deploy.json';
export const API_SCRIPT_PATH = 'infra/deploy/user/api/ssm/deploy-api.sh';
export const API_COMPOSE_PATH = 'infra/deploy/user/api/compose.yml';
export const SECRET_BUNDLE_PATH = 'infra/deploy/user/api/ssm/secret_bundle.py';
export const SECRET_CONTRACT_PATH = 'infra/deploy/api/secret-mount.contract.json';
export const DIGEST_PATTERN = '^sha256:[a-f0-9]{64}$';
export const ACTIONS = Object.freeze(['deploy', 'rollback', 'maintenance']);
export const DOCUMENT_SIZE_LIMIT = 64 * 1024;
const SOURCE_MARKER = '__DOCUMENT_SOURCE_SHA256__';

export function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

// 본문에 담는 원본에서 주석만 있는 줄을 뺀다(shell·Python·YAML의 `#` 줄). shebang(`#!`)과 생성기 marker(`#__NAME__`)는 남긴다.
// 원본에는 heredoc·여러 줄 문자열 안에 `#`로 시작하는 내용 줄이 없다(ssm-document.test.mjs가 원본별로 고정한다).
export function stripCommentLines(text) {
  return text
    .split('\n')
    .filter((line) => !/^\s*#(?!!|__[A-Z_]+__$)/u.test(line))
    .join('\n');
}

// 한 줄 marker를 heredoc 본문으로 바꾼다. 본문에 heredoc 종료 줄이 있으면 뜻이 바뀌므로 거부한다.
function embed(body, marker, content, terminator) {
  if (body.split(marker).length !== 2) throw new Error(`${marker} marker must appear exactly once`);
  const text = content.replace(/\n+$/u, '');
  if (terminator && text.split('\n').some((line) => line.trim() === terminator)) {
    throw new Error(`${marker} content contains the heredoc terminator line ${terminator}`);
  }
  return body.replace(marker, () => text);
}

function finish(body, sources) {
  if (body.split(SOURCE_MARKER).length !== 2)
    throw new Error('document source marker must appear exactly once');
  const source = sha256(JSON.stringify(sources));
  const text = body.replace(SOURCE_MARKER, source).replace(/\n+$/u, '');
  if (text.includes('{{') || text.includes('}}'))
    throw new Error('document body contains SSM parameter syntax');
  return text;
}

function documentJson({ description, digests, body }) {
  const digest = {
    type: 'String',
    interpolationType: 'ENV_VAR',
    allowedPattern: DIGEST_PATTERN,
  };
  const document = {
    schemaVersion: '2.2',
    description,
    parameters: {
      action: {
        type: 'String',
        description: 'deploy | rollback | maintenance',
        interpolationType: 'ENV_VAR',
        allowedValues: [...ACTIONS],
      },
      ...Object.fromEntries(
        Object.entries(digests).map(([name, text]) => [name, { ...digest, description: text }]),
      ),
    },
    mainSteps: [
      {
        action: 'aws:runShellScript',
        name: 'deploy',
        precondition: { StringEquals: ['platformType', 'Linux'] },
        inputs: { timeoutSeconds: '900', runCommand: body.split('\n') },
      },
    ],
  };
  const json = `${JSON.stringify(document, null, 2)}\n`;
  if (Buffer.byteLength(json) > DOCUMENT_SIZE_LIMIT)
    throw new Error(`document is larger than ${DOCUMENT_SIZE_LIMIT} bytes`);
  return json;
}

export function buildDocument({ script, lib, compose }) {
  let body = embed(stripCommentLines(script), '#__USER_HOST_LIB__', stripCommentLines(lib));
  body = embed(body, '#__COMPOSE_YML__', stripCommentLines(compose), 'COMPOSE');
  return documentJson({
    description:
      'dormduri Web bundle deploy: deploy, rollback or maintenance with a digest pair. No free-form commands.',
    digests: {
      webDigest: 'dormduri/web image digest (sha256:...)',
      ingressDigest: 'dormduri/ingress image digest (sha256:...)',
    },
    body: finish(body, { script, lib, compose }),
  });
}

export function buildApiDocument({ script, lib, compose, secretBundle, contract }) {
  let body = embed(stripCommentLines(script), '#__USER_HOST_LIB__', stripCommentLines(lib));
  body = embed(body, '#__COMPOSE_YML__', stripCommentLines(compose), 'COMPOSE');
  body = embed(body, '#__SECRET_BUNDLE_PY__', stripCommentLines(secretBundle), 'PY');
  body = embed(body, '#__SECRET_CONTRACT_JSON__', contract, 'JSON');
  return documentJson({
    description:
      'dormduri API bundle deploy: deploy, rollback or maintenance with the API image digests. No free-form commands.',
    digests: {
      apiDigest: 'dormduri/api image digest (sha256:...)',
      apiMigrateDigest: 'dormduri/api-migrate image digest (sha256:...)',
      observabilityConfigDigest: 'dormduri/observability-config image digest (sha256:...)',
    },
    body: finish(body, { script, lib, compose, secretBundle, contract }),
  });
}

const read = (repoRoot, path) => readFileSync(resolve(repoRoot, path), 'utf8');

export function readSources(repoRoot = defaultRepoRoot) {
  return {
    script: read(repoRoot, SCRIPT_PATH),
    lib: read(repoRoot, LIB_PATH),
    compose: read(repoRoot, COMPOSE_PATH),
  };
}

export function readApiSources(repoRoot = defaultRepoRoot) {
  return {
    script: read(repoRoot, API_SCRIPT_PATH),
    lib: read(repoRoot, LIB_PATH),
    compose: read(repoRoot, API_COMPOSE_PATH),
    secretBundle: read(repoRoot, SECRET_BUNDLE_PATH),
    contract: read(repoRoot, SECRET_CONTRACT_PATH),
  };
}

export function expectedDocuments(repoRoot = defaultRepoRoot) {
  return [
    { path: DOCUMENT_PATH, text: buildDocument(readSources(repoRoot)) },
    { path: API_DOCUMENT_PATH, text: buildApiDocument(readApiSources(repoRoot)) },
  ];
}

function isDirectExecution() {
  return process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isDirectExecution()) {
  let stale = false;
  for (const { path, text } of expectedDocuments()) {
    const target = resolve(defaultRepoRoot, path);
    if (process.argv.includes('--check')) {
      let actual = '';
      try {
        actual = readFileSync(target, 'utf8');
      } catch {
        // 없는 파일은 아래에서 stale로 센다.
      }
      if (actual !== text) {
        console.error(`${path} is stale. Run: node scripts/infra/user-host/ssm-document.mjs`);
        stale = true;
      } else console.log(`${path} is current (sha256 ${sha256(actual)}).`);
    } else {
      writeFileSync(target, text);
      console.log(`Wrote ${path} (sha256 ${sha256(text)}).`);
    }
  }
  if (stale) process.exit(1);
}
