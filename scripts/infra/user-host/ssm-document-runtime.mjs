// SSM document 본문을 일회용 container(`--network none`)에서 실제로 돌려 본다. document JSON의 runCommand를 그대로
// script로 쓰고, harness 본문·가짜 명령은 document-harness/ 아래 파일이다.
// - guard: Docker·AWS·Secrets Manager에 닿기 전에 끝나는 경로(허용 밖 action, 형식이 틀린 digest, 다른 실행이 잡은 host
//   lock, web document의 TLS 사본 없음, API document의 옛 형식 web 기록·web 점검 mode).
// - deploy path: `aws`·`docker`(web은 `curl`도)를 기록만 하는 가짜 명령으로 바꾸고 배포·자동 복귀·점검 mode·rollback
//   입력 대조·옛 기록 채택(web), migrate 순서·rollout 전 실패·secret 설치 검사(API)를 실행해 exit code, RESULT 줄, host
//   상태 파일을 판정한다. API document의 secret 설치기는 실제 python3로 돈다.
// harness image는 `web-build-node`(Debian)에 Debian python3만 더한 일회용 image다(host Ubuntu처럼 python3가 있다).
// node 내장 module만 쓴다(runtime gate에는 package 설치가 없다).
import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PAGE_TITLES } from './ingress-smoke.mjs';
import { API_DOCUMENT_PATH, DOCUMENT_PATH, SECRET_CONTRACT_PATH } from './ssm-document.mjs';

const HARNESS_DIRECTORY = fileURLToPath(new URL('./document-harness', import.meta.url));
export const HARNESS_LABEL =
  'dormduri.local.created-by=scripts/infra/user-host/ssm-document-runtime.mjs';

// 판정 기준. 각 case의 key는 harness 줄의 같은 key와 같아야 하고, `result`는 마지막 RESULT 줄의 앞부분이다.
export const DOCUMENT_GUARD_CASES = Object.freeze([
  { name: 'action', exit: 2, result: 'RESULT=rejected reason=action' },
  { name: 'digest', exit: 2, result: 'RESULT=rejected reason=digest' },
  { name: 'locked', exit: 75, result: 'RESULT=locked action=deploy' },
  { name: 'tls-missing', exit: 2, result: 'RESULT=failed action=deploy reason=tls-missing' },
  { name: 'release-before-tls', exit: 0, written: 'no', result: 'none' },
]);

const webCase = (name, exit, result, current, previous, flag, extra = {}) => ({
  name,
  exit,
  result,
  current,
  previous,
  flag,
  ...extra,
});
export const DEPLOY_PATH_CASES = Object.freeze([
  webCase('first-deploy', 0, 'RESULT=succeeded action=deploy', '1', 'none', 'no', {
    format: '2',
    cfrag: 'release',
    apifrag: 'no',
    orphans: 'no',
    apisvc: 'no',
  }),
  webCase('second-deploy', 0, 'RESULT=succeeded action=deploy', '2', '1', 'no', {
    cfrag: 'release',
    pfrag: 'release',
  }),
  webCase(
    'start-failure-rolls-back',
    1,
    'RESULT=failed action=deploy reason=rolled-back-to-current',
    '2',
    '1',
    'no',
  ),
  webCase(
    'smoke-failure-rolls-back',
    1,
    'RESULT=failed action=deploy reason=rolled-back-to-current',
    '2',
    '1',
    'no',
  ),
  webCase(
    'rollback-mismatch',
    2,
    'RESULT=failed action=rollback reason=previous-mismatch',
    '2',
    '1',
    'no',
    { composed: 'no' },
  ),
  // 2차 실패: rollback 대상이 뜨지 않으면 current로 돌아가 exit 1, 새 쌍과 current가 모두 실패하면 점검 mode.
  webCase(
    'rollback-start-failure-keeps-current',
    1,
    'RESULT=failed action=rollback reason=rollback-failed-kept-current',
    '2',
    '1',
    'no',
  ),
  webCase(
    'deploy-and-current-failure-enters-maintenance',
    1,
    'RESULT=failed action=deploy reason=entered-maintenance',
    '2',
    '1',
    'yes',
  ),
  webCase('rollback', 0, 'RESULT=succeeded action=rollback', '1', 'none', 'no', {
    cfrag: 'release',
  }),
  webCase(
    'rollback-without-previous',
    2,
    'RESULT=failed action=rollback reason=no-previous',
    '1',
    'none',
    'no',
  ),
  webCase(
    'first-deploy-failure-enters-maintenance',
    1,
    'RESULT=failed action=deploy reason=entered-maintenance',
    'none',
    'none',
    'yes',
  ),
  webCase('maintenance', 0, 'RESULT=succeeded action=maintenance', 'none', 'none', 'yes'),
  webCase(
    'maintenance-ingress-failure',
    1,
    'RESULT=failed action=maintenance reason=maintenance-failed',
    'none',
    'none',
    'yes',
  ),
  // 옛 document 기록: 채택한 기록은 옛 compose 사본을 가리킨다. 새 쌍이 실패하면 그 사본으로 옛 쌍에 돌아가고, 옛 기록으로
  // rollback하면 current도 옛 형식이 된다.
  webCase(
    'legacy-start-failure-rolls-back',
    1,
    'RESULT=failed action=deploy reason=rolled-back-to-current',
    '5',
    '6',
    'no',
    { format: 'legacy', cfrag: 'legacy', pfrag: 'legacy' },
  ),
  webCase('legacy-adopt-deploy', 0, 'RESULT=succeeded action=deploy', '7', '5', 'no', {
    format: '2',
    cfrag: 'release',
    pfrag: 'legacy',
  }),
  webCase('legacy-rollback', 0, 'RESULT=succeeded action=rollback', '5', 'none', 'no', {
    format: 'legacy',
    cfrag: 'legacy',
  }),
  // API 묶음 current가 있으면 그 조각을 함께 넘기고(--remove-orphans는 두 조각일 때만) web·ingress만 다룬다.
  webCase('with-api-current', 0, 'RESULT=succeeded action=deploy', '8', '5', 'no', {
    format: '2',
    apifrag: 'yes',
    orphans: 'yes',
    apisvc: 'no',
    apivar: 'c',
    // API 기록의 관측 설정 digest 경로도 넘긴다(관측 service가 API 조각에 있어 --remove-orphans가 지우지 않는다).
    obsvar: 'e',
  }),
  webCase(
    'legacy-rollback-with-api-current',
    0,
    'RESULT=succeeded action=rollback',
    '5',
    'none',
    'no',
    {
      format: 'legacy',
      cfrag: 'legacy',
      apifrag: 'yes',
      apisvc: 'no',
      apivar: 'c',
      obsvar: 'e',
    },
  ),
  webCase(
    'network-mismatch',
    2,
    'RESULT=failed action=deploy reason=network-mismatch',
    '5',
    'none',
    'no',
    { composed: 'no' },
  ),
  // 모든 실행에서: API 묶음 service 이름·project 전체 down 없음, 모든 compose 호출이 `-p dormduri-web`, SSM 출력에 registry 없음.
  {
    name: 'bundle-isolation',
    exit: 0,
    other: 'no',
    down: 'no',
    project: 'yes',
    registry: 'no',
    missing: 'no',
    result: 'none',
  },
]);

export const API_GUARD_CASES = Object.freeze([
  { name: 'action', exit: 2, aws: 'no', result: 'RESULT=rejected reason=action' },
  { name: 'digest', exit: 2, aws: 'no', result: 'RESULT=rejected reason=digest' },
  { name: 'observability-digest', exit: 2, aws: 'no', result: 'RESULT=rejected reason=digest' },
  { name: 'locked', exit: 75, aws: 'no', result: 'RESULT=locked action=deploy' },
  {
    name: 'web-record-missing',
    exit: 2,
    aws: 'no',
    result: 'RESULT=failed action=deploy reason=web-record-legacy',
  },
  {
    name: 'web-record-legacy',
    exit: 2,
    aws: 'no',
    result: 'RESULT=failed action=deploy reason=web-record-legacy',
  },
  {
    name: 'web-record-legacy-rollback',
    exit: 2,
    aws: 'no',
    result: 'RESULT=failed action=rollback reason=web-record-legacy',
  },
  {
    name: 'web-maintenance',
    exit: 2,
    aws: 'no',
    result: 'RESULT=failed action=deploy reason=web-maintenance',
  },
]);

const ALL_STEPS = 'migrate,grant,smoke,outbox';
// rollout 전 실패: 지금 API(1)는 멈추지 않고, 이번 secret release·migrate 임시 디렉터리·release 디렉터리가 남지 않는다.
const beforeRollout = (name, reason, steps) => ({
  name,
  exit: 1,
  result: `RESULT=failed action=deploy reason=${reason}`,
  current: '1',
  previous: 'none',
  running: '1',
  steps,
  secrets: '1',
  migratedir: '0',
  stopped: 'no',
  apidirs: '1',
  order: 'none',
  obs: 'c',
  obsresult: 'none',
});
// 관측 단계 case: [API current, previous, running], [관측 container 설정, 기록의 설정, 설정 경로 수, RESULT observability].
const obsCase = (
  name,
  exit,
  action,
  [current, previous, running],
  [obs, obsrec, obsdirs, obsresult],
) => ({
  name,
  exit,
  result: `RESULT=succeeded action=${action}`,
  current,
  previous,
  running,
  obs,
  obsrec,
  obsdirs,
  obssecret: 'yes',
  obsresult,
  obsstopped: 'no',
});
export const API_DEPLOY_PATH_CASES = Object.freeze([
  {
    name: 'first-deploy',
    exit: 0,
    result: 'RESULT=succeeded action=deploy',
    current: '1',
    previous: 'none',
    running: '1',
    steps: ALL_STEPS,
    secrets: '1',
    link: 'yes',
    migratedir: '0',
    fetched: 'yes',
    cfrag: '1',
    apidirs: '1',
    order: 'yes',
    obs: 'c',
    obsrec: 'c',
    obsdirs: '1',
    obssecret: 'yes',
    obsresult: 'ok',
  },
  beforeRollout('outbox-rows-stop-before-rollout', 'outbox', ALL_STEPS),
  beforeRollout('migrate-failure-stops-before-rollout', 'migrate', 'migrate'),
  beforeRollout('grant-failure-stops-before-rollout', 'grant', 'migrate,grant'),
  beforeRollout('smoke-failure-stops-before-rollout', 'smoke', 'migrate,grant,smoke'),
  beforeRollout('secret-invalid-stops-before-migrate', 'secret-invalid', 'none'),
  beforeRollout('secret-mode-violation-stops-before-migrate', 'secret-invalid', 'none'),
  beforeRollout('secret-fetch-failure', 'secret-fetch', 'none'),
  beforeRollout('migration-secret-failure', 'migration-secret', 'none'),
  // 지난 실행이 남긴 migrate 임시 디렉터리는 lock 안에서 지운다(beforeRollout의 migratedir 0).
  beforeRollout('leftover-migrate-dir-is-removed', 'secret-fetch', 'none'),
  {
    name: 'second-deploy',
    exit: 0,
    result: 'RESULT=succeeded action=deploy',
    current: '2',
    previous: '1',
    running: '2',
    steps: ALL_STEPS,
    secrets: '2',
    link: 'yes',
    stopped: 'yes',
    cfrag: '2',
    apidirs: '2',
    order: 'yes',
  },
  // 새 API가 readiness·host 안 smoke를 통과하지 못하면 직전 API로 되돌린다(migration은 되돌리지 않는다).
  {
    name: 'start-failure-rolls-back',
    exit: 1,
    result: 'RESULT=failed action=deploy reason=rolled-back-to-current',
    current: '2',
    previous: '1',
    running: '2',
    steps: ALL_STEPS,
    secrets: '2',
    link: 'yes',
    apidirs: '2',
    order: 'yes',
  },
  {
    name: 'smoke-failure-rolls-back',
    exit: 1,
    result: 'RESULT=failed action=deploy reason=rolled-back-to-current',
    current: '2',
    previous: '1',
    running: '2',
    secrets: '2',
    apidirs: '2',
  },
  {
    name: 'rollback-mismatch',
    exit: 2,
    result: 'RESULT=failed action=rollback reason=previous-mismatch',
    current: '2',
    previous: '1',
    running: '2',
    fetched: 'no',
    stopped: 'no',
  },
  {
    name: 'rollback-start-failure-keeps-current',
    exit: 1,
    result: 'RESULT=failed action=rollback reason=rollback-failed-kept-current',
    current: '2',
    previous: '1',
    running: '2',
    steps: 'none',
    secrets: '2',
    order: 'yes',
  },
  // rollback은 migrate를 다시 돌지 않고, secret은 지금 값을 다시 꺼내며, 조각은 previous 기록의 것(첫 배포 release)을 내용
  // 그대로 쓴다(harness가 rollback 전에 그 조각에 옛 document 표지를 더한다, fromprev).
  {
    name: 'rollback',
    exit: 0,
    result: 'RESULT=succeeded action=rollback',
    current: '1',
    previous: 'none',
    running: '1',
    steps: 'none',
    fetched: 'yes',
    link: 'yes',
    secrets: '2',
    cfrag: '1',
    apidirs: '1',
    order: 'yes',
    fromprev: 'yes',
  },
  {
    name: 'rollback-without-previous',
    exit: 2,
    result: 'RESULT=failed action=rollback reason=no-previous',
    current: '1',
    previous: 'none',
    running: '1',
    fetched: 'no',
  },
  {
    name: 'deploy-and-current-failure-stops-api',
    exit: 1,
    result: 'RESULT=failed action=deploy reason=entered-maintenance',
    current: '1',
    previous: 'none',
    running: 'none',
    apidirs: '1',
    order: 'yes',
  },
  {
    name: 'first-deploy-failure-stops-api',
    exit: 1,
    result: 'RESULT=failed action=deploy reason=entered-maintenance',
    current: 'none',
    previous: 'none',
    running: 'none',
    secrets: '0',
    migratedir: '0',
    apidirs: '0',
  },
  {
    name: 'deploy-after-failure',
    exit: 0,
    result: 'RESULT=succeeded action=deploy',
    current: '7',
    running: '7',
    link: 'yes',
  },
  {
    name: 'maintenance',
    exit: 0,
    result: 'RESULT=succeeded action=maintenance',
    current: '7',
    running: 'none',
    fetched: 'no',
    steps: 'none',
  },
  {
    name: 'deploy-after-maintenance',
    exit: 0,
    result: 'RESULT=succeeded action=deploy',
    current: '8',
    previous: '7',
    running: '8',
    order: 'yes',
  },
  // web current가 옛 형식(복사한 조각 기록은 있고 형식 표지는 없음): deploy는 secret·migrate·rollout 없이 멈추고 maintenance는 된다.
  {
    name: 'legacy-web-blocks-deploy',
    exit: 2,
    result: 'RESULT=failed action=deploy reason=web-record-legacy',
    current: '8',
    running: '8',
    fetched: 'no',
    steps: 'none',
    stopped: 'no',
  },
  {
    name: 'legacy-web-blocks-rollback',
    exit: 2,
    result: 'RESULT=failed action=rollback reason=web-record-legacy',
    current: '8',
    running: '8',
    fetched: 'no',
    steps: 'none',
    stopped: 'no',
  },
  {
    name: 'legacy-web-allows-maintenance',
    exit: 0,
    result: 'RESULT=succeeded action=maintenance',
    current: '8',
    running: 'none',
  },
  // 관측 단계(D-AB14, fail-open): 설정 digest를 바꾼 배포는 관측 container를 그 digest 경로로 다시 만들고, rollback은 previous
  // 기록의 digest로 돌린다. 펼침(파일 빠짐·symlink)·관측 secret이 실패하면 API rollout과 기록은 그대로이고(exit 0,
  // observability=failed) 관측 container는 지금 설정으로 남는다. 관측 up은 실제 compose처럼 새 설정으로 다시 만든 뒤 실패할 수
  // 있어 두 설정 경로를 모두 남긴다. network 호출은 document 상한(1~840초) 안의 timeout으로 감싼다.
  {
    ...obsCase('obs-first-deploy', 0, 'deploy', ['1', 'none', '1'], ['c', 'c', '1', 'ok']),
    obslimit: 'ok',
    obsup: 'yes',
  },
  obsCase('obs-config-change', 0, 'deploy', ['2', '1', '2'], ['d', 'd', '2', 'ok']),
  obsCase('obs-rollback-restores-config', 0, 'rollback', ['1', 'none', '1'], ['c', 'c', '1', 'ok']),
  obsCase('obs-third-deploy', 0, 'deploy', ['3', '1', '3'], ['e', 'e', '2', 'ok']),
  {
    name: 'obs-rollback-mismatch',
    exit: 2,
    result: 'RESULT=failed action=rollback reason=previous-mismatch',
    current: '3',
    previous: '1',
    running: '3',
    obs: 'e',
    obsdirs: '2',
    fetched: 'no',
  },
  obsCase('obs-fill-failure-keeps-api', 0, 'deploy', ['4', '3', '4'], ['e', '4', '1', 'failed']),
  obsCase('obs-symlink-config-refused', 0, 'deploy', ['5', '4', '5'], ['e', '5', '1', 'failed']),
  obsCase('obs-secret-failure-keeps-api', 0, 'deploy', ['6', '5', '6'], ['e', '6', '2', 'failed']),
  {
    ...obsCase('obs-up-failure-keeps-api', 0, 'deploy', ['7', '6', '7'], ['7', '7', '3', 'failed']),
    obsup: 'yes',
    obsdir: 'yes',
  },
  {
    name: 'obs-maintenance-keeps-observability',
    exit: 0,
    result: 'RESULT=succeeded action=maintenance',
    current: '7',
    running: 'none',
    obs: '7',
    obsdirs: '3',
    obsstopped: 'no',
  },
  // 관측 설정만 바뀐 배포는 다른 묶음이다(release-record.mjs의 직전 안전 묶음과 같은 판단): 지금 묶음이 previous가 되고 rollback이
  // 그 설정으로 되돌린다.
  obsCase('obs-only-change', 0, 'deploy', ['7', '7', '7'], ['f', 'f', '2', 'ok']),
  obsCase('obs-only-rollback', 0, 'rollback', ['7', 'none', '7'], ['7', '7', '1', 'ok']),
  // 관측 up이 새 설정(9)으로 다시 만든 뒤 시간 상한에 끊겼다: 직전 설정(7)과 새 설정 경로를 모두 남긴다. 이어 설정 펼침이 두 번
  // 실패해 current·previous가 다른 digest가 돼도 관측 container가 쓰는 설정(9) 경로는 남는다.
  {
    ...obsCase(
      'obs-up-timeout-keeps-both-configs',
      0,
      'deploy',
      ['8', '7', '8'],
      ['9', '9', '2', 'failed'],
    ),
    obslimit: 'ok',
    obsup: 'yes',
    obsdir: 'yes',
  },
  {
    ...obsCase(
      'obs-fill-failure-after-recreate',
      0,
      'deploy',
      ['9', '8', '9'],
      ['9', 'a', '2', 'failed'],
    ),
    obsup: 'no',
    obsdir: 'yes',
  },
  {
    ...obsCase(
      'obs-second-fill-failure-keeps-mounted',
      0,
      'deploy',
      ['2', '9', '2'],
      ['9', 'b', '2', 'failed'],
    ),
    obsup: 'no',
    obsdir: 'yes',
  },
  // upstream image 받기가 상한에 끊기면 container를 다시 만들지 않는다. step 시작부터 830초가 지났으면 network 호출 없이 건너뛴다.
  {
    ...obsCase(
      'obs-image-pull-timeout-keeps-containers',
      0,
      'deploy',
      ['3', '2', '3'],
      ['9', 'a', '3', 'failed'],
    ),
    obslimit: 'ok',
    obsup: 'no',
    obsdir: 'yes',
  },
  {
    ...obsCase(
      'obs-step-budget-exhausted',
      0,
      'deploy',
      ['4', '3', '4'],
      ['9', 'b', '3', 'failed'],
    ),
    obslimit: 'none',
    obsup: 'no',
    obsdir: 'yes',
  },
  { name: 'secret-values-stay-off-output', exit: 0, found: 'no', result: 'none' },
  {
    name: 'bundle-isolation',
    exit: 0,
    other: 'no',
    down: 'no',
    project: 'yes',
    registry: 'no',
    missing: 'no',
    result: 'none',
  },
]);

// `case=<이름> <key>=<값> ... out=<RESULT 줄>`. RESULT 줄 앞의 UTC 시각은 뗀다.
export function parseCaseLines(output) {
  const results = new Map();
  for (const line of output.split('\n')) {
    const match = /^case=(\S+) (.*?) ?out=(.*)$/u.exec(line);
    if (!match) continue;
    const fields = Object.fromEntries(
      match[2]
        .split(' ')
        .filter(Boolean)
        .map((pair) => [pair.slice(0, pair.indexOf('=')), pair.slice(pair.indexOf('=') + 1)]),
    );
    results.set(match[1], { ...fields, result: match[3].replace(/^\S+Z /u, '') });
  }
  return results;
}

export function judgeCases(output, cases) {
  const results = parseCaseLines(output);
  const problems = [];
  for (const expected of cases) {
    const actual = results.get(expected.name);
    if (!actual) {
      problems.push(`${expected.name}: no result`);
      continue;
    }
    for (const [key, value] of Object.entries(expected)) {
      if (key === 'name' || key === 'result') continue;
      if (actual[key] !== String(value))
        problems.push(`${expected.name}: ${key} ${actual[key]} != ${value}`);
    }
    if (actual.result !== expected.result && !actual.result.startsWith(`${expected.result} `)) {
      problems.push(
        `${expected.name}: "${actual.result}" does not start with "${expected.result}"`,
      );
    }
  }
  return problems;
}

export const judgeGuardOutput = (output) => judgeCases(output, DOCUMENT_GUARD_CASES);
export const judgeDeployPathOutput = (output) => judgeCases(output, DEPLOY_PATH_CASES);
export const judgeApiGuardOutput = (output) => judgeCases(output, API_GUARD_CASES);
export const judgeApiDeployPathOutput = (output) => judgeCases(output, API_DEPLOY_PATH_CASES);

const shellQuote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`;

// `web-build-node`에 python3만 더한 일회용 harness image. 끝나면 removeHarnessImage로 지운다.
export function buildHarnessImage(baseImage) {
  const tag = `dormduri-ssm-harness:${process.pid}-${Date.now()}`;
  const dockerfile = [
    `FROM ${baseImage}`,
    'RUN apt-get update && apt-get install -y --no-install-recommends python3 && rm -rf /var/lib/apt/lists/*',
    '',
  ].join('\n');
  const result = spawnSync(
    'docker',
    ['build', '--quiet', '--label', HARNESS_LABEL, '-t', tag, '-'],
    { input: dockerfile, encoding: 'utf8' },
  );
  if (result.status !== 0) throw new Error(`document harness image build failed: ${result.stderr}`);
  return tag;
}

export function removeHarnessImage(tag) {
  spawnSync('docker', ['image', 'rm', '-f', tag], { stdio: 'ignore' });
}

function runHarness({ repoRoot, image, documentPath, harness, judge }) {
  const document = JSON.parse(readFileSync(resolve(repoRoot, documentPath), 'utf8'));
  const directory = mkdtempSync(join(tmpdir(), 'dormduri-ssm-harness-'));
  try {
    cpSync(HARNESS_DIRECTORY, directory, { recursive: true });
    writeFileSync(
      join(directory, 'deploy.sh'),
      `${document.mainSteps[0].inputs.runCommand.join('\n')}\n`,
    );
    writeFileSync(
      join(directory, 'contract.json'),
      readFileSync(resolve(repoRoot, SECRET_CONTRACT_PATH)),
    );
    writeFileSync(
      join(directory, 'titles.env'),
      [
        `TITLE_MAINTENANCE=${shellQuote(PAGE_TITLES.maintenance)}`,
        `TITLE_COMING_SOON=${shellQuote(PAGE_TITLES.comingSoon)}`,
        `TITLE_NOT_FOUND=${shellQuote(PAGE_TITLES.notFound)}`,
        '',
      ].join('\n'),
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
        `/work/${harness}`,
      ],
      { encoding: 'utf8' },
    );
    if (result.status !== 0) throw new Error(`document harness failed: ${result.stderr}`);
    return { output: result.stdout, problems: judge(result.stdout) };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const webHarness = (harness, judge) => ({ documentPath: DOCUMENT_PATH, harness, judge });
const apiHarness = (harness, judge) => ({ documentPath: API_DOCUMENT_PATH, harness, judge });

export function runDocumentGuardChecks({ repoRoot, image }) {
  return runHarness({ repoRoot, image, ...webHarness('web-guard.sh', judgeGuardOutput) });
}

export function runDeployPathChecks({ repoRoot, image }) {
  return runHarness({ repoRoot, image, ...webHarness('web-deploy.sh', judgeDeployPathOutput) });
}

export function runApiDocumentGuardChecks({ repoRoot, image }) {
  return runHarness({ repoRoot, image, ...apiHarness('api-guard.sh', judgeApiGuardOutput) });
}

export function runApiDeployPathChecks({ repoRoot, image }) {
  return runHarness({ repoRoot, image, ...apiHarness('api-deploy.sh', judgeApiDeployPathOutput) });
}

// 네 검사를 한 harness image로 돌린다. image는 끝나면 지운다.
export function runAllDocumentChecks({ repoRoot, baseImage }) {
  const image = buildHarnessImage(baseImage);
  try {
    return [
      ['user-host-document-guards', runDocumentGuardChecks],
      ['user-host-document-deploy-paths', runDeployPathChecks],
      ['user-host-api-document-guards', runApiDocumentGuardChecks],
      ['user-host-api-document-deploy-paths', runApiDeployPathChecks],
    ].map(([name, check]) => ({ name, ...check({ repoRoot, image }) }));
  } finally {
    removeHarnessImage(image);
  }
}

// CLI: 네 검사를 실행하고 어긋난 점이 있으면 exit 1(mutation 검사와 수동 확인에 쓴다). `--output`이면 harness 줄도 낸다.
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
  for (const { name, output, problems } of runAllDocumentChecks({ repoRoot, baseImage })) {
    if (process.argv.includes('--output')) console.log(output.trimEnd());
    for (const problem of problems) console.error(`${name}: ${problem}`);
    console.log(`${name}: ${problems.length} problems.`);
    total += problems.length;
  }
  process.exitCode = total ? 1 : 0;
}
