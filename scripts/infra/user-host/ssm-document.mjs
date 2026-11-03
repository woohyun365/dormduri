#!/usr/bin/env node
// SSM Command document `dormduri-web-deploy`(schema 2.2)를 infra/deploy/user/ssm/deploy.sh와 infra/deploy/user/compose.yml로
// 만든다. 결과 JSON은 tracked 파일이고 그 바이트의 sha256이 AWS document Hash와 같다(Phase 1 확인). CD는 배포 전에
// AWS document Hash와 이 파일의 sha256을 대조한다. document 생성·갱신은 Owner가 한다(CD role에는 갱신 권한이 없다).
//
//   node scripts/infra/user-host/ssm-document.mjs          # 파일을 다시 쓴다
//   node scripts/infra/user-host/ssm-document.mjs --check  # 파일이 원본과 같은지만 본다
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRepoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
export const DOCUMENT_NAME = 'dormduri-web-deploy';
export const DOCUMENT_PATH = 'infra/deploy/user/ssm/dormduri-web-deploy.json';
export const SCRIPT_PATH = 'infra/deploy/user/ssm/deploy.sh';
export const COMPOSE_PATH = 'infra/deploy/user/compose.yml';
export const DIGEST_PATTERN = '^sha256:[a-f0-9]{64}$';
export const ACTIONS = Object.freeze(['deploy', 'rollback', 'maintenance']);
const COMPOSE_MARKER = '#__COMPOSE_YML__';

export function buildDocument({ script, compose }) {
  if (script.split(COMPOSE_MARKER).length !== 2)
    throw new Error('compose marker must appear exactly once');
  const composeBody = compose.replace(/\n+$/u, '');
  if (composeBody.split('\n').some((line) => line.trim() === 'COMPOSE')) {
    throw new Error('compose content contains the heredoc terminator line');
  }
  const body = script.replace(COMPOSE_MARKER, composeBody).replace(/\n+$/u, '');
  if (body.includes('{{') || body.includes('}}'))
    throw new Error('document body contains SSM parameter syntax');
  const digest = {
    type: 'String',
    interpolationType: 'ENV_VAR',
    allowedPattern: DIGEST_PATTERN,
  };
  const document = {
    schemaVersion: '2.2',
    description:
      'dormduri Web stage deploy: deploy, rollback or maintenance with a digest pair. No free-form commands.',
    parameters: {
      action: {
        type: 'String',
        description: 'deploy | rollback | maintenance',
        interpolationType: 'ENV_VAR',
        allowedValues: [...ACTIONS],
      },
      webDigest: { ...digest, description: 'dormduri/web image digest (sha256:...)' },
      ingressDigest: { ...digest, description: 'dormduri/ingress image digest (sha256:...)' },
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
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function readSources(repoRoot = defaultRepoRoot) {
  return {
    script: readFileSync(resolve(repoRoot, SCRIPT_PATH), 'utf8'),
    compose: readFileSync(resolve(repoRoot, COMPOSE_PATH), 'utf8'),
  };
}

export function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

function isDirectExecution() {
  return process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isDirectExecution()) {
  const expected = buildDocument(readSources());
  const path = resolve(defaultRepoRoot, DOCUMENT_PATH);
  if (process.argv.includes('--check')) {
    const actual = readFileSync(path, 'utf8');
    if (actual !== expected) {
      console.error(
        `${DOCUMENT_PATH} is stale. Run: node scripts/infra/user-host/ssm-document.mjs`,
      );
      process.exit(1);
    }
    console.log(`${DOCUMENT_PATH} is current (sha256 ${sha256(actual)}).`);
  } else {
    writeFileSync(path, expected);
    console.log(`Wrote ${DOCUMENT_PATH} (sha256 ${sha256(expected)}).`);
  }
}
