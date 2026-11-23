#!/usr/bin/env node
// 백오피스 host SSM Command document 둘(schema 2.2, backoffice-foundation D-BF13·D-BF16)을 만든다.
// - `dormduri-backoffice-deploy`: infra/deploy/backoffice/ssm/deploy.sh + lib.sh + infra/deploy/backoffice/compose.yml +
//   infra/deploy/backoffice/alloy/config.alloy + secret 묶음 script(infra/deploy/user/api/ssm/secret_bundle.py의 install·verify) +
//   infra/deploy/backoffice-api/secret-mount.contract.json
// - `dormduri-backoffice-bootstrap-owner`: infra/deploy/backoffice/ssm/bootstrap-owner.sh + lib.sh
// 결과 JSON은 tracked 파일이고 그 바이트의 sha256이 AWS document Hash와 같다. backoffice-cd는 배포 전에 deploy document의 Hash를
// 대조한다. document 생성·갱신은 Owner가 한다. 64 KB 한도와 주석 줄 빼기·marker 규칙은 user host 생성기
// (scripts/infra/user-host/ssm-document.mjs)와 같은 함수를 쓴다.
//
//   node scripts/infra/backoffice-host/ssm-document.mjs          # 파일 둘을 다시 쓴다
//   node scripts/infra/backoffice-host/ssm-document.mjs --check  # 파일이 원본과 같은지만 본다
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ACTIONS,
  DIGEST_PATTERN,
  DOCUMENT_SIZE_LIMIT,
  embed,
  finish,
  sha256,
  stripCommentLines,
} from '../user-host/ssm-document.mjs';

const defaultRepoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
export const DEPLOY_DOCUMENT_NAME = 'dormduri-backoffice-deploy';
export const DEPLOY_DOCUMENT_PATH = 'infra/deploy/backoffice/ssm/dormduri-backoffice-deploy.json';
export const BOOTSTRAP_DOCUMENT_NAME = 'dormduri-backoffice-bootstrap-owner';
export const BOOTSTRAP_DOCUMENT_PATH =
  'infra/deploy/backoffice/ssm/dormduri-backoffice-bootstrap-owner.json';
export const DEPLOY_SCRIPT_PATH = 'infra/deploy/backoffice/ssm/deploy.sh';
export const BOOTSTRAP_SCRIPT_PATH = 'infra/deploy/backoffice/ssm/bootstrap-owner.sh';
export const LIB_PATH = 'infra/deploy/backoffice/ssm/lib.sh';
export const COMPOSE_PATH = 'infra/deploy/backoffice/compose.yml';
export const ALLOY_CONFIG_PATH = 'infra/deploy/backoffice/alloy/config.alloy';
export const SECRET_BUNDLE_PATH = 'infra/deploy/user/api/ssm/secret_bundle.py';
export const SECRET_CONTRACT_PATH = 'infra/deploy/backoffice-api/secret-mount.contract.json';
// bootstrap 입력. SSM allowedPattern(Java 정규식)이 먼저 거르고 script와 앱(zod)이 다시 본다. 이름은 제어 문자 없이 60자까지다.
export const EMAIL_PATTERN = '^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,253}\\.[A-Za-z]{2,63}$';
export const DISPLAY_NAME_PATTERN = '^[^\\x00-\\x1f\\x7f]{1,60}$';
export { DOCUMENT_SIZE_LIMIT };

function documentJson({ description, parameters, body, timeoutSeconds = '900' }) {
  const document = {
    schemaVersion: '2.2',
    description,
    parameters,
    mainSteps: [
      {
        action: 'aws:runShellScript',
        name: 'run',
        precondition: { StringEquals: ['platformType', 'Linux'] },
        inputs: { timeoutSeconds, runCommand: body.split('\n') },
      },
    ],
  };
  const json = `${JSON.stringify(document, null, 2)}\n`;
  if (Buffer.byteLength(json) > DOCUMENT_SIZE_LIMIT)
    throw new Error(`document is larger than ${DOCUMENT_SIZE_LIMIT} bytes`);
  return json;
}

const digestParameter = (description) => ({
  type: 'String',
  description,
  interpolationType: 'ENV_VAR',
  allowedPattern: DIGEST_PATTERN,
});

export function buildDeployDocument({ script, lib, compose, alloy, secretBundle, contract }) {
  let body = embed(stripCommentLines(script), '#__BACKOFFICE_HOST_LIB__', stripCommentLines(lib));
  body = embed(body, '#__COMPOSE_YML__', stripCommentLines(compose), 'COMPOSE');
  body = embed(body, '#__ALLOY_CONFIG__', alloy, 'ALLOY');
  body = embed(body, '#__SECRET_BUNDLE_PY__', stripCommentLines(secretBundle), 'PY');
  body = embed(body, '#__SECRET_CONTRACT_JSON__', contract, 'JSON');
  return documentJson({
    description:
      'dormduri backoffice bundle deploy: deploy, rollback or maintenance with the backoffice image digests. No free-form commands.',
    parameters: {
      action: {
        type: 'String',
        description: 'deploy | rollback | maintenance',
        interpolationType: 'ENV_VAR',
        allowedValues: [...ACTIONS],
      },
      backofficeApiDigest: digestParameter('dormduri/backoffice-api image digest (sha256:...)'),
      backofficeWebDigest: digestParameter('dormduri/backoffice-web image digest (sha256:...)'),
      backofficeIngressDigest: digestParameter(
        'dormduri/backoffice-ingress image digest (sha256:...)',
      ),
    },
    body: finish(body, { script, lib, compose, alloy, secretBundle, contract }),
  });
}

export function buildBootstrapDocument({ script, lib }) {
  const body = embed(stripCommentLines(script), '#__BACKOFFICE_HOST_LIB__', stripCommentLines(lib));
  return documentJson({
    description:
      'dormduri backoffice first owner: issue a 15-minute one-time registration code when no active account exists. No free-form commands.',
    parameters: {
      email: {
        type: 'String',
        description: 'email of the first owner account',
        interpolationType: 'ENV_VAR',
        allowedPattern: EMAIL_PATTERN,
      },
      displayName: {
        type: 'String',
        description: 'display name of the first owner account (no control characters, 60 or fewer)',
        interpolationType: 'ENV_VAR',
        allowedPattern: DISPLAY_NAME_PATTERN,
      },
    },
    body: finishBootstrap(body, { script, lib }),
    timeoutSeconds: '300',
  });
}

// bootstrap 본문에는 documentSource marker가 없다(기록을 쓰지 않는다). SSM 파라미터 문법만 막는다.
function finishBootstrap(body) {
  const text = body.replace(/\n+$/u, '');
  if (text.includes('{{') || text.includes('}}'))
    throw new Error('document body contains SSM parameter syntax');
  return text;
}

const read = (repoRoot, path) => readFileSync(resolve(repoRoot, path), 'utf8');

export function readDeploySources(repoRoot = defaultRepoRoot) {
  return {
    script: read(repoRoot, DEPLOY_SCRIPT_PATH),
    lib: read(repoRoot, LIB_PATH),
    compose: read(repoRoot, COMPOSE_PATH),
    alloy: read(repoRoot, ALLOY_CONFIG_PATH),
    secretBundle: read(repoRoot, SECRET_BUNDLE_PATH),
    contract: read(repoRoot, SECRET_CONTRACT_PATH),
  };
}

export function readBootstrapSources(repoRoot = defaultRepoRoot) {
  return { script: read(repoRoot, BOOTSTRAP_SCRIPT_PATH), lib: read(repoRoot, LIB_PATH) };
}

export function expectedDocuments(repoRoot = defaultRepoRoot) {
  return [
    { path: DEPLOY_DOCUMENT_PATH, text: buildDeployDocument(readDeploySources(repoRoot)) },
    {
      path: BOOTSTRAP_DOCUMENT_PATH,
      text: buildBootstrapDocument(readBootstrapSources(repoRoot)),
    },
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
        console.error(`${path} is stale. Run: node scripts/infra/backoffice-host/ssm-document.mjs`);
        stale = true;
      } else console.log(`${path} is current (sha256 ${sha256(actual)}).`);
    } else {
      writeFileSync(target, text);
      console.log(`Wrote ${path} (sha256 ${sha256(text)}).`);
    }
  }
  if (stale) process.exit(1);
}
