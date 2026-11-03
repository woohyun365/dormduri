// SSM document 본문의 입력 거부와 host lock을 일회용 container에서 실제로 돌려 본다. document JSON의 runCommand를 그대로 script로 쓰고, Docker·AWS에 닿기 전에 끝나는 경로만
// 실행한다: 허용 밖 action, 형식이 틀린 digest, 다른 실행이 잡은 host lock, TLS 사본 없음.
// node 내장 module만 쓴다(runtime gate에는 package 설치가 없다).
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

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
  const document = JSON.parse(readFileSync(resolve(repoRoot, DOCUMENT_PATH), 'utf8'));
  const directory = mkdtempSync(join(tmpdir(), 'dormduri-ssm-guard-'));
  try {
    writeFileSync(
      join(directory, 'deploy.sh'),
      `${document.mainSteps[0].inputs.runCommand.join('\n')}\n`,
    );
    writeFileSync(join(directory, 'harness.sh'), HARNESS);
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
    if (result.status !== 0) throw new Error(`document guard harness failed: ${result.stderr}`);
    return { output: result.stdout, problems: judgeGuardOutput(result.stdout) };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
