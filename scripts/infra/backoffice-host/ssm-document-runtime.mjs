// 백오피스 SSM document 둘의 본문을 일회용 container(`--network none`)에서 실제로 돌려 본다(user host의
// scripts/infra/user-host/ssm-document-runtime.mjs와 같은 방식, 같은 harness image). document JSON의 runCommand를 그대로 script로
// 쓰고, harness 본문·가짜 명령은 document-harness/ 아래 파일이다. 입력·상태 거부(Docker 하한 포함), rollout 전 실패, 배포·자동
// 되돌림(host 안 smoke 실패·publish 위반·다른 Host 받음·metric 실패)·rollback·maintenance, Alloy fail-open, 첫 owner 등록 code를
// exit code·RESULT 줄·host 상태 파일로 판정하고, 가짜 secret 값과 등록 code가 허용된 곳 밖에 나오지 않는지 본다.
import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildHarnessImage,
  judgeCases,
  removeHarnessImage,
} from '../user-host/ssm-document-runtime.mjs';
import {
  BOOTSTRAP_DOCUMENT_PATH,
  DEPLOY_DOCUMENT_PATH,
  SECRET_CONTRACT_PATH,
} from './ssm-document.mjs';

const HARNESS_DIRECTORY = fileURLToPath(new URL('./document-harness', import.meta.url));
export const HARNESS_LABEL =
  'dormduri.local.created-by=scripts/infra/backoffice-host/ssm-document-runtime.mjs';

const fields = (exit, result, extra = {}) => ({ exit, result, ...extra });
const unchanged = (current, previous, running) => ({ current, previous, running, up: 'no' });
// 판정 기준. key는 harness 줄의 key와 같고, `result`는 마지막 RESULT 줄의 앞부분이다(시각은 뗀다).
export const BACKOFFICE_DOCUMENT_CASES = Object.freeze([
  { name: 'action', ...fields(2, 'RESULT=rejected reason=action', { pulled: 'no' }) },
  { name: 'digest', ...fields(2, 'RESULT=rejected reason=digest', { pulled: 'no' }) },
  { name: 'locked', ...fields(75, 'RESULT=locked action=deploy', { pulled: 'no' }) },
  // loopback publish 보호의 하한(Docker Engine 28.0.0)과 보호를 끄는 설정은 image를 받기 전에 멈춘다.
  {
    name: 'engine-27',
    ...fields(2, 'RESULT=failed action=deploy reason=docker-engine-below-28', { pulled: 'no' }),
  },
  {
    name: 'firewall-nftables',
    ...fields(2, 'RESULT=failed action=deploy reason=docker-firewall-backend', { pulled: 'no' }),
  },
  {
    name: 'daemon-direct-routing',
    ...fields(2, 'RESULT=failed action=deploy reason=docker-daemon-config', { pulled: 'no' }),
  },
  {
    name: 'insecure-raw-env',
    ...fields(2, 'RESULT=failed action=deploy reason=docker-daemon-config', { pulled: 'no' }),
  },
  // dockerd 명령줄 flag와 `--config-file`이 고른 설정 파일도 본다.
  {
    name: 'daemon-flag-direct-routing',
    ...fields(2, 'RESULT=failed action=deploy reason=docker-daemon-config', { pulled: 'no' }),
  },
  {
    name: 'daemon-config-file',
    ...fields(2, 'RESULT=failed action=deploy reason=docker-daemon-config', { pulled: 'no' }),
  },
  {
    name: 'bootstrap-no-current',
    ...fields(2, 'RESULT=failed action=bootstrap-owner reason=no-current'),
  },
  // rollout 전 실패는 묶음을 올리지 않고 이번 secret release를 남기지 않는다.
  {
    name: 'secret-fetch',
    ...fields(1, 'RESULT=failed action=deploy reason=secret-fetch', {
      ...unchanged('none', 'none', 'none'),
      secretreleases: '0',
    }),
  },
  {
    name: 'secret-keys',
    ...fields(1, 'RESULT=failed action=deploy reason=secret-invalid', {
      ...unchanged('none', 'none', 'none'),
      secretreleases: '0',
    }),
  },
  // 첫 배포가 뜨지 않으면 되돌릴 묶음이 없어 세 service를 내린 채 둔다.
  {
    name: 'first-deploy-failure',
    ...fields(1, 'RESULT=failed action=deploy reason=entered-maintenance', {
      current: 'none',
      running: 'none',
      secretreleases: '0',
      releases: '0',
    }),
  },
  {
    name: 'first-deploy',
    ...fields(0, 'RESULT=succeeded action=deploy', {
      current: '1',
      previous: 'none',
      running: '1',
      obs: 'ok',
      perms: 'yes',
      releases: '1',
      secretreleases: '1',
    }),
  },
  {
    name: 'second-deploy',
    ...fields(0, 'RESULT=succeeded action=deploy', {
      current: '2',
      previous: '1',
      running: '2',
      perms: 'yes',
      releases: '2',
      secretreleases: '2',
    }),
  },
  // rollout 뒤 host 안 smoke가 실패하면 직전 묶음을 다시 띄우고 기록은 그대로 둔다.
  ...[
    'smoke-failure-rolls-back',
    'publish-violation-rolls-back',
    'foreign-host-rolls-back',
    'metrics-failure-rolls-back',
  ].map((name) => ({
    name,
    ...fields(1, 'RESULT=failed action=deploy reason=rolled-back-to-current', {
      current: '2',
      previous: '1',
      running: '2',
      releases: '2',
      secretreleases: '2',
    }),
  })),
  // Alloy가 뜨지 않아도 묶음 결과는 그대로다(fail-open).
  {
    name: 'observability-fail-open',
    ...fields(0, 'RESULT=succeeded action=deploy', {
      current: '4',
      previous: '2',
      running: '4',
      obs: 'none',
    }),
  },
  {
    name: 'rollback-mismatch',
    ...fields(2, 'RESULT=failed action=rollback reason=previous-mismatch', {
      ...unchanged('4', '2', '4'),
      pulled: 'no',
    }),
  },
  {
    name: 'rollback',
    ...fields(0, 'RESULT=succeeded action=rollback', {
      current: '2',
      previous: 'none',
      running: '2',
      perms: 'yes',
    }),
  },
  {
    name: 'rollback-without-previous',
    ...fields(2, 'RESULT=failed action=rollback reason=no-previous', unchanged('2', 'none', '2')),
  },
  { name: 'bootstrap-input', ...fields(2, 'RESULT=rejected reason=input') },
  { name: 'bootstrap-input-long', ...fields(2, 'RESULT=rejected reason=input') },
  {
    name: 'bootstrap-issued',
    ...fields(0, 'RESULT=succeeded action=bootstrap-owner', { running: '2' }),
  },
  {
    name: 'bootstrap-refused',
    ...fields(2, 'RESULT=failed action=bootstrap-owner reason=refused-active-account'),
  },
  {
    name: 'maintenance',
    ...fields(0, 'RESULT=succeeded action=maintenance', { current: '2', running: 'none' }),
  },
  { name: 'leak', exit: 0, secret: 'no', code: 'no', result: 'none' },
]);

export const judgeBackofficeDocumentOutput = (output) =>
  judgeCases(output, BACKOFFICE_DOCUMENT_CASES);

export function runBackofficeDocumentChecks({ repoRoot, image }) {
  const bodyOf = (path) =>
    `${JSON.parse(readFileSync(resolve(repoRoot, path), 'utf8')).mainSteps[0].inputs.runCommand.join('\n')}\n`;
  const directory = mkdtempSync(join(tmpdir(), 'dormduri-backoffice-harness-'));
  try {
    cpSync(HARNESS_DIRECTORY, directory, { recursive: true });
    writeFileSync(join(directory, 'deploy.sh'), bodyOf(DEPLOY_DOCUMENT_PATH));
    writeFileSync(join(directory, 'bootstrap.sh'), bodyOf(BOOTSTRAP_DOCUMENT_PATH));
    writeFileSync(
      join(directory, 'contract.json'),
      readFileSync(resolve(repoRoot, SECRET_CONTRACT_PATH)),
    );
    chmodSync(directory, 0o755);
    const result = spawnSync(
      'docker',
      [
        'run',
        '--rm',
        '--network',
        'none',
        '--label',
        HARNESS_LABEL,
        '-v',
        `${directory}:/work:ro`,
        '--entrypoint',
        'bash',
        image,
        '/work/backoffice.sh',
      ],
      { encoding: 'utf8' },
    );
    if (result.status !== 0)
      throw new Error(`backoffice document harness failed: ${result.stderr}`);
    return { output: result.stdout, problems: judgeBackofficeDocumentOutput(result.stdout) };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

// harness image를 만들고 검사를 돌린 뒤 지운다.
export function runAllBackofficeDocumentChecks({ repoRoot, baseImage }) {
  const image = buildHarnessImage(baseImage);
  try {
    return [{ name: 'backoffice-documents', ...runBackofficeDocumentChecks({ repoRoot, image }) }];
  } finally {
    removeHarnessImage(image);
  }
}

// CLI: 검사를 실행하고 어긋난 점이 있으면 exit 1. `--output`이면 harness 줄도 낸다.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { loadImageInventory, resolveImageReference } =
    await import('../artifacts/image-inventory.mjs');
  const repoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
  const inventory = loadImageInventory(repoRoot);
  const baseImage = resolveImageReference(
    repoRoot,
    inventory.images.find((entry) => entry.name === 'web-build-node'),
  );
  let total = 0;
  for (const { name, output, problems } of runAllBackofficeDocumentChecks({
    repoRoot,
    baseImage,
  })) {
    if (process.argv.includes('--output')) console.log(output.trimEnd());
    for (const problem of problems) console.error(`${name}: ${problem}`);
    console.log(`${name}: ${problems.length} problems.`);
    total += problems.length;
  }
  process.exitCode = total ? 1 : 0;
}
