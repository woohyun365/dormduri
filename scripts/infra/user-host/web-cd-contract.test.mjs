// web-cd.yml의 결정적 검사(D-WB5·D-WB7). 실제 AWS·GitHub 동작은 Phase 4 첫 실행이 확인하고, 여기서는 workflow 글이
// 신뢰 경계를 지키는지 본다: job별 권한과 environment, 직렬화, attestation 이름·조건·순서, provenance 검증 조건과 순서,
// mask 순서, role secret 위치, artifact upload 없음, node별 SSM 조회 없음, 경로 filter와 두 Dockerfile 입력의 일치.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8');
const workflow = read('.github/workflows/web-cd.yml');
const sender = read('scripts/infra/user-host/ssm-send.sh');

// `jobs:` 아래 두 칸 들여쓴 이름마다 그 job의 글.
function jobs(source) {
  const body = source.slice(source.indexOf('\njobs:\n') + 7);
  const parts = body.split(/^ {2}(?=[a-z][a-z0-9_-]*:$)/mu).filter(Boolean);
  return Object.fromEntries(parts.map((part) => [part.slice(0, part.indexOf(':')), part]));
}
// job 글 → 이름 있는 step 목록(순서 유지).
function steps(job) {
  return job
    .split(/^ {6}- name: /mu)
    .slice(1)
    .map((part) => ({ name: part.slice(0, part.indexOf('\n')), body: part }));
}
function permissions(job) {
  const block = /^ {4}permissions:\n((?: {6}[a-z-]+: [a-z]+\n)+)/mu.exec(job)?.[1] ?? '';
  return Object.fromEntries(
    [...block.matchAll(/^ {6}([a-z-]+): ([a-z]+)$/gmu)].map((m) => [m[1], m[2]]),
  );
}
const index = (list, pattern) => list.findIndex((step) => pattern.test(step.body));

const JOBS = jobs(workflow);

test('only the designated jobs hold write scopes and only deploy references the production environment', () => {
  assert.match(workflow, /^permissions:\n {2}contents: read\n\n/mu);
  assert.deepEqual(Object.keys(JOBS), ['build', 'deploy', 'tag', 'record']);
  assert.deepEqual(permissions(JOBS.build), { contents: 'read', 'id-token': 'write' });
  assert.deepEqual(permissions(JOBS.deploy), {
    contents: 'read',
    'id-token': 'write',
    attestations: 'write',
  });
  assert.deepEqual(permissions(JOBS.tag), { contents: 'read', 'id-token': 'write' });
  assert.deepEqual(permissions(JOBS.record), { contents: 'write' });
  assert.match(JOBS.deploy, /^ {4}environment: production$/mu);
  for (const name of ['build', 'tag', 'record'])
    assert.doesNotMatch(JOBS[name], /environment:/u, name);
});

test('one workflow-level concurrency group serializes every run without cancelling the running one', () => {
  assert.match(
    workflow,
    /^concurrency:\n {2}group: web-cd-production\n {2}cancel-in-progress: false$/mu,
  );
  assert.doesNotMatch(Object.values(JOBS).join('\n'), /concurrency:/u);
});

test('the publish role ARN is a repository secret and the deploy role ARN is read only by the environment job', () => {
  const roles = (job) =>
    [...job.matchAll(/role-to-assume: \$\{\{ secrets\.([A-Z_]+) \}\}/gu)].map((m) => m[1]);
  assert.deepEqual(roles(JOBS.build), ['AWS_PUBLISH_ROLE_ARN']);
  assert.deepEqual(roles(JOBS.tag), ['AWS_PUBLISH_ROLE_ARN']);
  assert.deepEqual(roles(JOBS.deploy), ['AWS_DEPLOY_ROLE_ARN']);
  assert.deepEqual(roles(JOBS.record), []);
  assert.equal(
    (workflow.match(/role-to-assume:/gu) ?? []).length,
    3,
    'no role is assumed elsewhere',
  );
  assert.doesNotMatch(workflow, /arn:aws/u);
});

test('the account ID mask is on and the registry host is masked before the login prints it', () => {
  for (const [name, job] of Object.entries(JOBS)) {
    const list = steps(job);
    for (const step of list.filter(({ body }) => /configure-aws-credentials@/u.test(body))) {
      assert.match(step.body, /mask-aws-account-id: true/u, `${name}: ${step.name}`);
    }
    const login = index(list, /amazon-ecr-login@/u);
    if (login < 0) continue;
    assert.match(list[login].body, /mask-password: 'true'/u, name);
    const mask = list[login - 1];
    assert.equal(mask.name, 'Mask the registry host', `${name}: the mask step precedes the login`);
    assert.match(mask.body, /aws sts get-caller-identity --query Account --output text/u);
    assert.match(
      mask.body,
      /echo "::add-mask::\$account\.dkr\.ecr\.\$AWS_REGION\.amazonaws\.com"/u,
    );
    assert.doesNotMatch(mask.body, /env:/u, `${name}: an env value would print in the step header`);
    list.forEach((step, position) => {
      if (/steps\.ecr\.outputs\.registry/u.test(step.body)) {
        assert.ok(position > login, `${name}: ${step.name} reads the registry after the login`);
      }
    });
  }
});

// configure-aws-credentials는 assume한 role의 unique ID(AROA…)를 끌 수 없게 찍는다. AROA 뒤 16자를 base32로 풀면 앞 48bit의
// 가운데 40bit(첫 bit와 끝 7bit 사이)가 account ID라서, AROA 뒤 9자(45bit)는 첫 bit, account ID와 끝 7bit 중 앞 4bit로
// 정해진다. 9자를 가리면 남는 글자에 account ID bit가 없다.
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32(bytes) {
  let bits = '';
  for (const byte of bytes) bits += byte.toString(2).padStart(8, '0');
  return bits
    .match(/.{5}/gu)
    .map((chunk) => BASE32[Number.parseInt(chunk, 2)])
    .join('');
}
function syntheticRoleId(account, top, seed) {
  const head = (BigInt(top) << 47n) | (BigInt(account) << 7n) | BigInt(seed & 0x7f);
  const bytes = [
    ...Array.from({ length: 6 }, (_, i) => Number((head >> BigInt(40 - 8 * i)) & 0xffn)),
  ];
  for (let i = 0; i < 4; i += 1) bytes.push((seed * 37 + i * 101) & 0xff);
  return `AROA${base32(bytes)}Q`;
}
function accountOf(roleId) {
  let bits = '';
  for (const char of roleId.slice(4, 20)) bits += BASE32.indexOf(char).toString(2).padStart(5, '0');
  const head = BigInt(`0b${bits.slice(0, 48)}`);
  return ((head & 0x7fffffffff80n) >> 7n).toString().padStart(12, '0');
}
const runMask = (script, roleArn) =>
  spawnSync('bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', script], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, ROLE_ARN: roleArn },
  });

test('the account part of every assumed role ID is masked before the action prints it', () => {
  const scripts = [];
  for (const [name, job] of Object.entries(JOBS)) {
    const list = steps(job);
    list.forEach((step, position) => {
      if (!/configure-aws-credentials@/u.test(step.body)) return;
      const secret = /role-to-assume: \$\{\{ secrets\.([A-Z_]+) \}\}/u.exec(step.body)[1];
      const mask = list[position - 1];
      assert.equal(mask?.name, 'Mask the account part of the role ID', `${name}: ${step.name}`);
      assert.ok(
        mask.body.includes(`ROLE_ARN: \${{ secrets.${secret} }}`),
        `${name}: the mask reads the ARN secret of the role it masks`,
      );
      scripts.push(runScript(mask.body));
    });
  }
  assert.equal(scripts.length, 3);
  assert.equal(new Set(scripts).size, 1, 'every job runs the same mask script');

  for (const account of ['123456789012', '012345678901', '999999999999', '000000000001']) {
    const result = runMask(scripts[0], `arn:aws:iam::${account}:role/example`);
    assert.equal(result.status, 0, result.stderr);
    const masks = result.stdout
      .trim()
      .split('\n')
      .map((line) => /^::add-mask::(AROA[A-Z2-7]{9})$/u.exec(line)?.[1]);
    assert.equal(masks.length, 32, result.stdout);
    assert.ok(masks.every(Boolean), result.stdout);
    for (const top of [0, 1]) {
      for (const seed of [0, 1, 8, 77, 120, 255]) {
        const roleId = syntheticRoleId(account, top, seed);
        assert.equal(accountOf(roleId), account, 'the fixture follows the account ID decoding');
        assert.equal(
          masks.filter((mask) => roleId.startsWith(mask)).length,
          1,
          `${account} top ${top} seed ${seed}`,
        );
      }
    }
  }
  // Only the masked 13 characters depend on the account ID: accounts that differ in the lowest bit share the rest.
  const even = syntheticRoleId('123456789012', 1, 77);
  const odd = syntheticRoleId('123456789013', 1, 77);
  assert.notEqual(even.slice(0, 13), odd.slice(0, 13));
  assert.equal(even.slice(13), odd.slice(13));
  for (const roleArn of ['', 'arn:aws:iam::12345678901:role/example', 'not-an-arn']) {
    const result = runMask(scripts[0], roleArn);
    assert.notEqual(result.status, 0, `${JSON.stringify(roleArn)} stops the job`);
    assert.doesNotMatch(result.stdout, /::add-mask::/u);
  }
});

test('no workflow value reaches a step through an unmasked variable', () => {
  assert.doesNotMatch(workflow, /\$\{\{\s*vars\./u, 'a variable value prints in the step header');
  assert.match(
    JOBS.build,
    /NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN: \$\{\{ secrets\.CLOUDFLARE_WEB_ANALYTICS_TOKEN \}\}/u,
  );
});

test('attestations are made only on push, after approval, with literal subject names and the build digests', () => {
  const list = steps(JOBS.deploy);
  const attests = list.filter(({ body }) => /actions\/attest@/u.test(body));
  assert.deepEqual(
    attests.map(({ body }) => [
      /subject-name: (\S+)/u.exec(body)?.[1],
      /subject-digest: (.+)/u.exec(body)?.[1].trim(),
      /if: (.+)/u.exec(body)?.[1].trim(),
    ]),
    [
      [
        'dormduri/web',
        '${{ needs.build.outputs.web_digest }}',
        "${{ github.event_name == 'push' }}",
      ],
      [
        'dormduri/ingress',
        '${{ needs.build.outputs.ingress_digest }}',
        "${{ github.event_name == 'push' }}",
      ],
    ],
  );
  assert.doesNotMatch(
    JOBS.build,
    /actions\/attest@/u,
    'nothing reaches the public log before approval',
  );
  for (const name of ['tag', 'record']) assert.doesNotMatch(JOBS[name], /actions\/attest@/u);
  for (const { body } of attests) assert.match(body, /push-to-registry: false/u);
});

test('every run step uses bash with pipefail so a piped failure stops the step', () => {
  assert.match(workflow, /^defaults:\n {2}run:\n {4}shell: bash$/mu);
  assert.doesNotMatch(workflow, /^ +shell: (?!bash$)/mu);
});

test('only main runs reach the environment job', () => {
  assert.match(JOBS.deploy, /^ {4}if: \$\{\{ [^\n]*github\.ref == 'refs\/heads\/main'/mu);
  assert.match(JOBS.build, /^ {4}if: \$\{\{ github\.event_name == 'push' \}\}$/mu);
  assert.match(workflow, /^ {2}push:\n {4}branches: \[main\]$/mu);
});

test('provenance is verified for both digests before anything is sent to the host', () => {
  const list = steps(JOBS.deploy);
  const verify = index(list, /gh attestation verify/u);
  const send = index(list, /ssm-send\.sh/u);
  const lastAttest = list.map(({ body }) => /actions\/attest@/u.test(body)).lastIndexOf(true);
  assert.ok(verify > lastAttest && verify < send, 'attest → verify → send');
  const body = list[verify].body;
  assert.match(body, /--signer-workflow "\$GITHUB_REPOSITORY\/\.github\/workflows\/web-cd\.yml"/u);
  assert.match(body, /--source-ref refs\/heads\/main/u);
  assert.match(body, /--deny-self-hosted-runners/u);
  assert.match(body, /--source-digest "\$GITHUB_SHA"/u, 'a push run deploys only its own commit');
  assert.match(body, /release-record\.mjs match/u, 'a dispatch pair must match its deploy record');
  for (const [label, pattern] of [
    ['the document hash check', /describe-document/u],
    ['the SBOM check', /release-record\.mjs check-sbom/u],
    ['the deploy record plan', /release-record\.mjs plan/u],
    ['the newer change check', /deploy-inputs-current\.sh/u],
  ]) {
    const position = index(list, pattern);
    assert.ok(position >= 0 && position < send, `${label} runs before sending`);
  }
});

test('a stopped run writes its stop condition and only a scanned stage record becomes a Release', () => {
  const deploy = steps(JOBS.deploy);
  const last = deploy.at(-1);
  assert.match(last.body, /if: \$\{\{ failure\(\) \}\}/u);
  assert.match(last.body, />> "\$GITHUB_STEP_SUMMARY"/u);
  const record = steps(JOBS.record).at(-1).body;
  const order = [
    'release-record.mjs record',
    'public-record-scan.mjs "$RUNNER_TEMP/record.md"',
    'cat "$RUNNER_TEMP/record.md" >> "$GITHUB_STEP_SUMMARY"',
    'gh release create',
  ].map((text) => record.indexOf(text));
  assert.ok(
    order.every((position) => position >= 0),
    JSON.stringify(order),
  );
  assert.deepEqual(
    [...order].sort((left, right) => left - right),
    order,
  );
});

test('the deploy tag goes on the run commit and the stage record names the deployed source', () => {
  // GITHUB_TOKEN has no Workflows permission, so it cannot tag a commit whose workflow files differ
  // from the default branch main (a rollback dispatch hit 403). Push runs tag their source commit anyway.
  const record = steps(JOBS.record).at(-1).body;
  assert.match(
    record,
    /gh release create "\$GIT_TAG" --repo "\$GITHUB_REPOSITORY" --target "\$GITHUB_SHA" \\$/mu,
  );
  assert.doesNotMatch(record, /--target "\$SOURCE"/u);
  assert.match(record, /--source="\$SOURCE"/u);
  assert.match(record, /^ {10}SOURCE: \$\{\{ needs\.deploy\.outputs\.source_commit \}\}$/mu);
});

test('no workflow artifact is uploaded and no per-node SSM invocation is read', () => {
  assert.doesNotMatch(workflow, /upload-artifact/u);
  for (const source of [workflow, sender]) {
    assert.doesNotMatch(source, /list-command-invocations|get-command-invocation/u);
  }
  assert.match(sender, /list-commands --command-id/u);
  assert.match(sender, /echo "::add-mask::\$command_id"/u);
});

test('dispatch inputs reach shell steps only through the environment', () => {
  for (const { name, body } of Object.values(JOBS).flatMap(steps)) {
    const run = /^ {8}run: ([\s\S]*)$/mu.exec(body)?.[1] ?? '';
    assert.doesNotMatch(run, /\$\{\{\s*(?:inputs|github\.event)\./u, name);
  }
});

// Dockerfile의 COPY 원본 → 저장소 경로(build context 기준).
function copySources(dockerfile, context) {
  return [...read(dockerfile).matchAll(/^COPY (?!--from)(.+)$/gmu)].flatMap((match) => {
    const parts = match[1].split(/\s+/u).filter((part) => !part.startsWith('--'));
    return parts.slice(0, -1).map((source) => (context ? `${context}/${source}` : source));
  });
}
const covered = (path, filters) =>
  filters.some((filter) =>
    filter.endsWith('/**') ? `${path}/`.startsWith(filter.slice(0, -2)) : filter === path,
  );

test('the push path filter covers every Dockerfile input and matches the stale-run check', () => {
  const pathBlock = /^ {4}paths:\n((?: {6}- .+\n)+)/mu.exec(workflow)[1];
  const paths = [...pathBlock.matchAll(/^ {6}- (\S+)$/gmu)].map((match) => match[1]);
  for (const source of [
    ...copySources('infra/deploy/web/Dockerfile', ''),
    ...copySources('infra/deploy/user/ingress/Dockerfile', 'infra/deploy/user/ingress'),
  ]) {
    assert.ok(
      covered(source.replace(/\/$/u, ''), paths),
      `${source} is not in the push path filter`,
    );
  }
  for (const required of [
    '.dockerignore',
    'infra/deploy/web/**',
    'infra/deploy/user/**',
    '.github/workflows/web-cd.yml',
  ]) {
    assert.ok(paths.includes(required), required);
  }
  const script = read('scripts/infra/user-host/deploy-inputs-current.sh');
  const stale = /^DEPLOY_INPUT_PATHS=\(\n([\s\S]+?)\n\)$/mu
    .exec(script)[1]
    .split(/\s+/u)
    .filter(Boolean);
  assert.deepEqual(
    stale.sort(),
    paths.map((path) => path.replace(/\/\*\*$/u, '')).sort(),
    'the newer-change check compares the same paths as the trigger',
  );
  assert.match(
    workflow,
    /run: bash scripts\/infra\/user-host\/deploy-inputs-current\.sh "\$GITHUB_SHA" origin\/main/u,
  );
});

// step 글의 `run: |` block을 들여쓰기 없이 꺼낸다.
function runScript(body) {
  const lines = body.slice(body.indexOf('run: |\n') + 'run: |\n'.length).split('\n');
  const indent = /^ */u.exec(lines[0])[0].length;
  return lines
    .filter((line) => line.trim() === '' || line.length - line.trimStart().length >= indent)
    .map((line) => line.slice(indent))
    .join('\n');
}

// recover step의 script를 가짜 ssm-send.sh 위에서 돌린다. codes는 동작별 exit code, 결과는 보낸 동작 순서·exit·요약.
function runRecover(script, { rollbackWeb, codes }) {
  const root = mkdtempSync(join(tmpdir(), 'web-cd-recover-'));
  try {
    mkdirSync(join(root, 'scripts/infra/user-host'), { recursive: true });
    writeFileSync(
      join(root, 'scripts/infra/user-host/ssm-send.sh'),
      `echo "$1 $2 $3 $4" >> "$CALLS"\ncase "$1" in rollback) exit ${codes.rollback ?? 0} ;; maintenance) exit ${codes.maintenance ?? 0} ;; esac\nexit 9\n`,
    );
    const env = {
      PATH: process.env.PATH,
      CALLS: join(root, 'calls'),
      GITHUB_STEP_SUMMARY: join(root, 'summary'),
      ROLLBACK_WEB: rollbackWeb,
      ROLLBACK_INGRESS: rollbackWeb ? 'sha256:previous-ingress' : '',
      WEB: 'sha256:new-web',
      INGRESS: 'sha256:new-ingress',
      HASH: 'document-hash',
    };
    const result = spawnSync('bash', ['-eo', 'pipefail', '-c', script], {
      cwd: root,
      env,
      encoding: 'utf8',
    });
    const readOr = (path) => {
      try {
        return readFileSync(path, 'utf8');
      } catch {
        return '';
      }
    };
    return {
      status: result.status,
      calls: readOr(env.CALLS).trim().split('\n').filter(Boolean),
      summary: readOr(env.GITHUB_STEP_SUMMARY),
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('a failed external smoke of a deploy rolls back or enters maintenance, then fails the job', () => {
  const list = steps(JOBS.deploy);
  const at = (name) => list.findIndex((step) => step.name === name);
  const smoke = list[at('Smoke the public host from outside')];
  const recover = list[at('Roll back after a failed external smoke')];
  const fail = list[at('Fail when the external smoke failed')];
  assert.ok(smoke && recover && fail, 'the smoke, recover and fail steps exist');
  assert.match(smoke.body, /id: smoke\n/u);
  assert.match(
    smoke.body,
    /continue-on-error: true/u,
    'a smoke failure must reach the recover step',
  );
  assert.match(
    recover.body,
    /if: \$\{\{ steps\.smoke\.outcome == 'failure' && steps\.request\.outputs\.action == 'deploy' \}\}/u,
  );
  assert.match(fail.body, /if: \$\{\{ steps\.smoke\.outcome == 'failure' \}\}/u);
  assert.match(fail.body, /exit 1/u);
  assert.ok(
    at('Smoke the public host from outside') < at('Roll back after a failed external smoke'),
  );
  assert.ok(
    at('Roll back after a failed external smoke') < at('Fail when the external smoke failed'),
  );

  const script = runScript(recover.body);
  const rollback = 'rollback sha256:previous-web sha256:previous-ingress document-hash';
  const maintenance = 'maintenance sha256:new-web sha256:new-ingress document-hash';
  const accepted = runRecover(script, { rollbackWeb: 'sha256:previous-web', codes: {} });
  assert.deepEqual(
    [accepted.status, accepted.calls],
    [0, [rollback]],
    'an accepted rollback ends the recovery',
  );
  assert.match(accepted.summary, /recovered: rolled back/u);
  const refused = runRecover(script, {
    rollbackWeb: 'sha256:previous-web',
    codes: { rollback: 1 },
  });
  assert.deepEqual(
    [refused.status, refused.calls],
    [0, [rollback, maintenance]],
    'a refused rollback falls through to maintenance of the failed pair',
  );
  assert.match(refused.summary, /recovered: entered maintenance/u);
  const first = runRecover(script, { rollbackWeb: '', codes: {} });
  assert.deepEqual(
    [first.status, first.calls],
    [0, [maintenance]],
    'no previous pair enters maintenance',
  );
  const stuck = runRecover(script, {
    rollbackWeb: 'sha256:previous-web',
    codes: { rollback: 1, maintenance: 1 },
  });
  assert.notEqual(stuck.status, 0, 'a failed maintenance fails the step');
});

test('tag and record run after a successful deploy even when build was skipped, and record does not wait on tag', () => {
  const condition = (job) => /^ {4}if: (.+)$/mu.exec(job)?.[1];
  assert.equal(
    condition(JOBS.tag),
    "${{ !cancelled() && needs.deploy.result == 'success' && needs.deploy.outputs.action != 'maintenance' }}",
  );
  assert.equal(condition(JOBS.record), "${{ !cancelled() && needs.deploy.result == 'success' }}");
  assert.match(
    JOBS.tag,
    /already tagged \$IMAGE_TAG/u,
    'a re-run tag job skips a tag it already added',
  );
  assert.match(
    JOBS.record,
    /gh release view "\$GIT_TAG"/u,
    'a re-run record job keeps the Release it made',
  );
});

test('the build tools are pinned images from the inventory', async () => {
  const { loadImageInventory, resolveImageReference } =
    await import('../artifacts/image-inventory.mjs');
  const inventory = loadImageInventory(repoRoot);
  for (const [name, variable] of [
    ['web-cd-buildkit', 'BUILDKIT_IMAGE'],
    ['web-cd-sbom-scanner', 'SBOM_SCANNER_IMAGE'],
  ]) {
    const image = inventory.images.find((candidate) => candidate.name === name);
    assert.ok(image, name);
    assert.equal(image.ownerPath, '.github/workflows/web-cd.yml');
    const reference = resolveImageReference(repoRoot, image);
    assert.match(
      workflow,
      new RegExp(`^ {2}${variable}: ${reference.replace(/[.*+?^${}()|[\]\\/]/gu, '\\$&')}$`, 'mu'),
    );
  }
  assert.match(JOBS.build, /--driver-opt "image=\$BUILDKIT_IMAGE"/u);
  assert.equal(
    (JOBS.build.match(/--attest "type=sbom,generator=\$SBOM_SCANNER_IMAGE"/gu) ?? []).length,
    2,
  );
  assert.doesNotMatch(JOBS.build, /--sbom=/u, 'the default SBOM generator is a moving tag');
});
