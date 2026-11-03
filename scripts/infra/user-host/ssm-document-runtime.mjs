// SSM document 본문을 일회용 container(`--network none`)에서 실제로 돌려 본다. document JSON의 runCommand를 그대로
// script로 쓴다.
// - guard: Docker·AWS에 닿기 전에 끝나는 경로(허용 밖 action, 형식이 틀린 digest, 다른 실행이 잡은 host lock, TLS 사본 없음).
// - deploy path: `aws`·`docker`·`curl`·`python3`를 기록만 하는 가짜 명령으로 바꾸고 배포·자동 복귀·첫 배포 점검 mode·
//   rollback 입력 대조·점검 mode를 차례로 실행해 exit code, RESULT 줄, host 상태 파일, 점검 flag를 판정한다.
// node 내장 module만 쓴다(runtime gate에는 package 설치가 없다).
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PAGE_TITLES } from './ingress-smoke.mjs';
import { DOCUMENT_PATH } from './ssm-document.mjs';

const WEB = `sha256:${'a'.repeat(64)}`;
const INGRESS = `sha256:${'b'.repeat(64)}`;
export const DOCUMENT_GUARD_CASES = Object.freeze([
  { name: 'action', args: ['bogus', WEB, INGRESS], exit: 2, out: 'RESULT=rejected reason=action' },
  {
    name: 'digest',
    args: ['deploy', 'sha256:xyz', INGRESS],
    exit: 2,
    out: 'RESULT=rejected reason=digest',
  },
  { name: 'locked', args: ['deploy', WEB, INGRESS], exit: 75, out: 'RESULT=locked action=deploy' },
  {
    name: 'tls-missing',
    args: ['deploy', WEB, INGRESS],
    exit: 2,
    out: 'RESULT=failed action=deploy reason=tls-missing',
  },
]);

const HARNESS = `set -u
run() {
  name=$1; shift
  SSM_action=$1 SSM_webDigest=$2 SSM_ingressDigest=$3 bash /work/deploy.sh >/tmp/out 2>/tmp/err
  code=$?
  printf 'case=%s exit=%s out=%s\\n' "$name" "$code" "$(tail -n 1 /tmp/out)"
}
run action bogus ${WEB} ${INGRESS}
run digest deploy sha256:xyz ${INGRESS}
mkdir -p /opt/dormduri/state
( exec 9>/opt/dormduri/state/lock; flock -n 9; touch /tmp/held; sleep 4 ) &
while [ ! -e /tmp/held ]; do sleep 0.1; done
run locked deploy ${WEB} ${INGRESS}
wait
run tls-missing deploy ${WEB} ${INGRESS}
if [ -e /opt/dormduri/compose/compose.yml ]; then echo compose=written; else echo compose=absent; fi
`;

// 가짜 digest. 첫 글자가 상태 파일 판정의 label이다: 1·2 정상, 3 container 기동 실패, 4 기동 뒤 내부 smoke 실패.
const pair = (label) => `sha256:${label.repeat(64)}`;
export const DEPLOY_PATH_CASES = Object.freeze([
  {
    name: 'first-deploy',
    exit: 0,
    result: 'RESULT=succeeded action=deploy',
    current: '1',
    previous: 'none',
    flag: 'no',
  },
  {
    name: 'second-deploy',
    exit: 0,
    result: 'RESULT=succeeded action=deploy',
    current: '2',
    previous: '1',
    flag: 'no',
  },
  {
    name: 'start-failure-rolls-back',
    exit: 1,
    result: 'RESULT=failed action=deploy reason=rolled-back-to-current',
    current: '2',
    previous: '1',
    flag: 'no',
  },
  {
    name: 'smoke-failure-rolls-back',
    exit: 1,
    result: 'RESULT=failed action=deploy reason=rolled-back-to-current',
    current: '2',
    previous: '1',
    flag: 'no',
  },
  {
    name: 'rollback-mismatch',
    exit: 2,
    result: 'RESULT=failed action=rollback reason=previous-mismatch',
    current: '2',
    previous: '1',
    flag: 'no',
  },
  {
    name: 'rollback',
    exit: 0,
    result: 'RESULT=succeeded action=rollback',
    current: '1',
    previous: 'none',
    flag: 'no',
  },
  {
    name: 'rollback-without-previous',
    exit: 2,
    result: 'RESULT=failed action=rollback reason=no-previous',
    current: '1',
    previous: 'none',
    flag: 'no',
  },
  {
    name: 'first-deploy-failure-enters-maintenance',
    exit: 1,
    result: 'RESULT=failed action=deploy reason=entered-maintenance',
    current: 'none',
    previous: 'none',
    flag: 'yes',
  },
  {
    name: 'maintenance',
    exit: 0,
    result: 'RESULT=succeeded action=maintenance',
    current: 'none',
    previous: 'none',
    flag: 'yes',
  },
]);

const shellQuote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`;

function deployStubs() {
  return {
    aws: `#!/bin/bash
case "$1 $2" in
  "sts get-caller-identity") echo 000000000000 ;;
  "ecr get-login-password") echo stub-password ;;
  *) exit 1 ;;
esac
`,
    // compose up 은 WEB_IMAGE의 digest로 성공·실패를 정하고, 떠 있는 Web digest를 기록한다(curl stub이 읽는다).
    docker: `#!/bin/bash
echo "docker $*" >>/tmp/docker.log
[ "$1" = compose ] || exit 0
case " $* " in
  *" up "*)
    case " $* " in *" --no-deps "*) exit 0 ;; esac
    web=\${WEB_IMAGE##*@}
    if [ -n "\${BAD_UP:-}" ] && [ "\${web}" = "\${BAD_UP}" ]; then exit 1; fi
    printf '%s' "\${web}" >/tmp/running_web
    ;;
esac
exit 0
`,
    // 실제 ingress의 경로별 응답을 흉내 낸다: 점검 flag면 모든 경로 점검 중 503, 아니면 허용 경로 200·준비 중 503·404.
    curl: `#!/bin/bash
out=/dev/null
url=
while [ $# -gt 0 ]; do
  case "$1" in
    -o) out=$2; shift 2 ;;
    -w|--max-time|--resolve) shift 2 ;;
    -*) shift ;;
    *) url=$1; shift ;;
  esac
done
path=/\${url#https://*/}
[ "\${url#https://*/}" = "\${url}" ] && path=/
running=$(cat /tmp/running_web 2>/dev/null)
if [ -f /opt/dormduri/mode/maintenance ]; then code=503; title=${shellQuote(PAGE_TITLES.maintenance)}
elif [ -n "\${BAD_SMOKE:-}" ] && [ "\${running}" = "\${BAD_SMOKE}" ]; then code=500; title=
else
  case "\${path}" in
    /|/privacy|/terms) code=200; title= ;;
    /signup) code=503; title=${shellQuote(PAGE_TITLES.comingSoon)} ;;
    *) code=404; title=${shellQuote(PAGE_TITLES.notFound)} ;;
  esac
fi
printf '<title>%s</title>' "\${title}" >"\${out}"
printf '%s' "\${code}"
`,
    python3: '#!/bin/bash\ncat >/dev/null\n',
  };
}

const DEPLOY_HARNESS = `set -u
install -d /opt/dormduri/tls
printf x >/opt/dormduri/tls/fullchain.pem
printf x >/opt/dormduri/tls/privkey.pem
for stub in aws docker curl python3; do install -m 0755 /work/stubs/$stub /usr/local/bin/$stub; done
state=/opt/dormduri/state
label() { sed -n 's/^web=sha256:\\(.\\).*/\\1/p' "$1" 2>/dev/null; }
run() {
  name=$1; shift
  env "$@" bash /work/deploy.sh >/tmp/out 2>/tmp/err
  code=$?
  current=$(label "$state/current"); previous=$(label "$state/previous")
  if [ -f /opt/dormduri/mode/maintenance ]; then flag=yes; else flag=no; fi
  printf 'case=%s exit=%s current=%s previous=%s flag=%s out=%s\\n' "$name" "$code" "\${current:-none}" "\${previous:-none}" "$flag" "$(grep 'RESULT=' /tmp/out | tail -n 1)"
}
I=${pair('a')}
run first-deploy SSM_action=deploy SSM_webDigest=${pair('1')} SSM_ingressDigest=$I
run second-deploy SSM_action=deploy SSM_webDigest=${pair('2')} SSM_ingressDigest=$I
run start-failure-rolls-back BAD_UP=${pair('3')} SSM_action=deploy SSM_webDigest=${pair('3')} SSM_ingressDigest=$I
run smoke-failure-rolls-back BAD_SMOKE=${pair('4')} SSM_action=deploy SSM_webDigest=${pair('4')} SSM_ingressDigest=$I
run rollback-mismatch SSM_action=rollback SSM_webDigest=${pair('3')} SSM_ingressDigest=$I
run rollback SSM_action=rollback SSM_webDigest=${pair('1')} SSM_ingressDigest=$I
run rollback-without-previous SSM_action=rollback SSM_webDigest=${pair('2')} SSM_ingressDigest=$I
rm -rf "$state" /opt/dormduri/mode /tmp/running_web
run first-deploy-failure-enters-maintenance BAD_UP=${pair('3')} SSM_action=deploy SSM_webDigest=${pair('3')} SSM_ingressDigest=$I
run maintenance SSM_action=maintenance SSM_webDigest=${pair('1')} SSM_ingressDigest=$I
`;

export function judgeDeployPathOutput(output) {
  const results = new Map();
  for (const line of output.split('\n')) {
    const match =
      /^case=(\S+) exit=(\d+) current=(\S+) previous=(\S+) flag=(\S+) out=(?:\S+Z )?(.*)$/u.exec(
        line,
      );
    if (match) {
      const [, name, exit, current, previous, flag, result] = match;
      results.set(name, { exit: Number(exit), current, previous, flag, result });
    }
  }
  const problems = [];
  for (const expected of DEPLOY_PATH_CASES) {
    const actual = results.get(expected.name);
    if (!actual) {
      problems.push(`${expected.name}: no result`);
      continue;
    }
    for (const key of ['exit', 'current', 'previous', 'flag']) {
      if (actual[key] !== expected[key])
        problems.push(`${expected.name}: ${key} ${actual[key]} != ${expected[key]}`);
    }
    if (!actual.result.startsWith(expected.result))
      problems.push(
        `${expected.name}: "${actual.result}" does not start with "${expected.result}"`,
      );
  }
  return problems;
}

export function runDeployPathChecks({ repoRoot, image }) {
  return runHarness({
    repoRoot,
    image,
    harness: DEPLOY_HARNESS,
    stubs: deployStubs(),
    judge: judgeDeployPathOutput,
  });
}

export function parseGuardOutput(output) {
  const results = new Map();
  for (const line of output.split('\n')) {
    const match = /^case=(\S+) exit=(\d+) out=(.*)$/u.exec(line);
    if (match)
      results.set(match[1], { exit: Number(match[2]), out: match[3].replace(/^\S+Z /u, '') });
  }
  return { results, composeWritten: /^compose=written$/mu.test(output) };
}

export function judgeGuardOutput(output) {
  const { results, composeWritten } = parseGuardOutput(output);
  const problems = [];
  for (const expected of DOCUMENT_GUARD_CASES) {
    const actual = results.get(expected.name);
    if (!actual) problems.push(`${expected.name}: no result`);
    else if (actual.exit !== expected.exit || actual.out !== expected.out) {
      problems.push(
        `${expected.name}: exit ${actual.exit} "${actual.out}" != exit ${expected.exit} "${expected.out}"`,
      );
    }
  }
  if (composeWritten)
    problems.push('tls-missing: the host compose was written before the TLS check');
  return problems;
}

export function runDocumentGuardChecks({ repoRoot, image }) {
  return runHarness({ repoRoot, image, harness: HARNESS, stubs: {}, judge: judgeGuardOutput });
}

function runHarness({ repoRoot, image, harness, stubs, judge }) {
  const document = JSON.parse(readFileSync(resolve(repoRoot, DOCUMENT_PATH), 'utf8'));
  const directory = mkdtempSync(join(tmpdir(), 'dormduri-ssm-harness-'));
  try {
    writeFileSync(
      join(directory, 'deploy.sh'),
      `${document.mainSteps[0].inputs.runCommand.join('\n')}\n`,
    );
    writeFileSync(join(directory, 'harness.sh'), harness);
    mkdirSync(join(directory, 'stubs'));
    for (const [name, body] of Object.entries(stubs))
      writeFileSync(join(directory, 'stubs', name), body);
    chmodSync(directory, 0o755);
    const result = spawnSync(
      'docker',
      [
        'run',
        '--rm',
        '--network',
        'none',
        '-v',
        `${directory}:/work:ro`,
        '--entrypoint',
        'bash',
        image,
        '/work/harness.sh',
      ],
      { encoding: 'utf8' },
    );
    if (result.status !== 0) throw new Error(`document harness failed: ${result.stderr}`);
    return { output: result.stdout, problems: judge(result.stdout) };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

// CLI: 두 검사를 실행하고 어긋난 점이 있으면 exit 1(mutation 검사와 수동 확인에 쓴다).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { loadImageInventory, resolveImageReference } =
    await import('../artifacts/image-inventory.mjs');
  const repoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
  const inventory = loadImageInventory(repoRoot);
  const image = resolveImageReference(
    repoRoot,
    inventory.images.find((entry) => entry.name === 'web-build-node'),
  );
  const problems = [
    ...runDocumentGuardChecks({ repoRoot, image }).problems,
    ...runDeployPathChecks({ repoRoot, image }).problems,
  ];
  for (const problem of problems) console.error(problem);
  console.log(`SSM document harness: ${problems.length} problems.`);
  process.exitCode = problems.length ? 1 : 0;
}
