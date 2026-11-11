// api-cd.yml의 결정적 검사(production-api-baseline D-AB12, web-cd와 같은 신뢰 구조). 실제 AWS·GitHub 동작은 API 단계 배포
// 첫 실행이 확인하고, 여기서는 workflow 글이 신뢰 경계를 지키는지 본다: job별 권한과 environment, web-cd와 같은 직렬화,
// attestation 이름·조건·순서, provenance 검증 조건과 순서, mask 순서, role secret 위치와 IAM trust 대조, artifact upload
// 없음, node별 SSM 조회 없음, 단계 기록 helper의 API stage 호출, 경로 filter와 배포 입력(배포 입력 파일마다 그 입력을
// 배포하는 workflow만 걸림).
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  copySources,
  jobs,
  permissions,
  pushPaths,
  runScript,
  stalePaths,
  stepIndex,
  steps,
  triggers,
} from './cd-workflow-text.mjs';
import { STAGES } from './release-record.mjs';
import {
  API_COMPOSE_PATH,
  API_DOCUMENT_NAME,
  API_DOCUMENT_PATH,
  API_SCRIPT_PATH,
  COMPOSE_PATH,
  DOCUMENT_PATH,
  LIB_PATH,
  SCRIPT_PATH,
  SECRET_BUNDLE_PATH,
  SECRET_CONTRACT_PATH,
} from './ssm-document.mjs';

const repoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8');
const workflow = read('.github/workflows/api-cd.yml');
const webWorkflow = read('.github/workflows/web-cd.yml');
const JOBS = jobs(workflow);
const WEB_JOBS = jobs(webWorkflow);
const IMAGES = STAGES.api.images;

test('only the designated jobs hold write scopes and only deploy references the production-api environment', () => {
  assert.match(workflow, /^permissions:\n {2}contents: read\n\n/mu);
  assert.deepEqual(Object.keys(JOBS), ['build', 'deploy', 'tag', 'record']);
  for (const name of Object.keys(JOBS))
    assert.deepEqual(permissions(JOBS[name]), permissions(WEB_JOBS[name]), name);
  assert.deepEqual(permissions(JOBS.deploy), {
    contents: 'read',
    'id-token': 'write',
    attestations: 'write',
  });
  assert.match(JOBS.deploy, /^ {4}environment: production-api$/mu);
  for (const name of ['build', 'tag', 'record'])
    assert.doesNotMatch(JOBS[name], /environment:/u, name);
});

test('api-cd and web-cd share one workflow-level concurrency group that never cancels a running deploy', () => {
  const block = (source) => /^concurrency:\n(?: {2}.+\n)+/mu.exec(source)?.[0];
  assert.equal(
    block(workflow),
    'concurrency:\n  group: user-host-production\n  cancel-in-progress: false\n',
  );
  assert.equal(block(workflow), block(webWorkflow), 'the two CD workflows queue in one group');
  assert.doesNotMatch(Object.values(JOBS).join('\n'), /concurrency:/u);
  assert.doesNotMatch(workflow, /^ {2}queue:/mu, 'the default single pending run, as in web-cd');
});

test('the API roles are their own secrets and their trust templates name this workflow and environment', () => {
  const roles = (job) =>
    [...job.matchAll(/role-to-assume: \$\{\{ secrets\.([A-Z_]+) \}\}/gu)].map((m) => m[1]);
  assert.deepEqual(roles(JOBS.build), ['AWS_API_PUBLISH_ROLE_ARN']);
  assert.deepEqual(roles(JOBS.tag), ['AWS_API_PUBLISH_ROLE_ARN']);
  assert.deepEqual(roles(JOBS.deploy), ['AWS_API_DEPLOY_ROLE_ARN']);
  assert.deepEqual(roles(JOBS.record), []);
  assert.equal((workflow.match(/role-to-assume:/gu) ?? []).length, 3);
  assert.doesNotMatch(workflow, /arn:aws|AWS_PUBLISH_ROLE_ARN|AWS_DEPLOY_ROLE_ARN/u);
  const sub = (name) =>
    JSON.parse(read(`infra/aws/iam/${name}.trust.json`)).Statement[0].Condition.StringEquals[
      'token.actions.githubusercontent.com:sub'
    ];
  assert.match(
    sub('api-deploy-role'),
    /:environment:production-api:job_workflow_ref:[^:]+\/\.github\/workflows\/api-cd\.yml@refs\/heads\/main$/u,
  );
  assert.match(
    sub('api-publish-role'),
    /:ref:refs\/heads\/main:job_workflow_ref:[^:]+\/\.github\/workflows\/api-cd\.yml@refs\/heads\/main$/u,
  );
  const deploy = JSON.parse(read('infra/aws/iam/api-deploy-role.permissions.json'));
  const resources = deploy.Statement.flatMap((statement) => [statement.Resource].flat());
  assert.ok(resources.some((resource) => resource.endsWith(`:document/${API_DOCUMENT_NAME}`)));
  for (const name of IMAGES)
    assert.ok(
      resources.some((resource) => resource.endsWith(`:repository/dormduri/${name}`)),
      name,
    );
});

test('every assumed role ID is masked by the web-cd mask script before the action prints it', () => {
  const webMask = runScript(
    steps(WEB_JOBS.build).find(({ name }) => name === 'Mask the account part of the role ID').body,
  );
  let count = 0;
  for (const [name, job] of Object.entries(JOBS)) {
    const list = steps(job);
    list.forEach((step, position) => {
      if (!/configure-aws-credentials@/u.test(step.body)) return;
      assert.match(step.body, /mask-aws-account-id: true/u, `${name}: ${step.name}`);
      const secret = /role-to-assume: \$\{\{ secrets\.([A-Z_]+) \}\}/u.exec(step.body)[1];
      const mask = list[position - 1];
      assert.equal(mask?.name, 'Mask the account part of the role ID', `${name}: ${step.name}`);
      assert.ok(mask.body.includes(`ROLE_ARN: \${{ secrets.${secret} }}`), name);
      assert.equal(runScript(mask.body), webMask, `${name}: the script web-cd-contract tests`);
      count += 1;
    });
    const login = stepIndex(list, /amazon-ecr-login@/u);
    if (login < 0) continue;
    assert.match(list[login].body, /mask-password: 'true'/u, name);
    const mask = list[login - 1];
    assert.equal(mask.name, 'Mask the registry host', `${name}: the mask step precedes the login`);
    assert.match(
      mask.body,
      /echo "::add-mask::\$account\.dkr\.ecr\.\$AWS_REGION\.amazonaws\.com"/u,
    );
    assert.doesNotMatch(mask.body, /env:/u, `${name}: an env value would print in the step header`);
    list.forEach((step, position) => {
      if (/steps\.ecr\.outputs\.registry/u.test(step.body))
        assert.ok(position > login, `${name}: ${step.name} reads the registry after the login`);
    });
  }
  assert.equal(count, 3);
  assert.doesNotMatch(workflow, /\$\{\{\s*vars\./u, 'a variable value prints in the step header');
  assert.doesNotMatch(workflow, /secrets\.(?!AWS_API_(?:PUBLISH|DEPLOY)_ROLE_ARN\b)/u);
});

test('the build job builds both targets of the API Dockerfile with a pinned SBOM generator and scans them before push', () => {
  const list = steps(JOBS.build);
  const build = list[stepIndex(list, /docker buildx build/u)].body;
  const commands = build.split('docker buildx build').slice(1);
  assert.deepEqual(
    commands.map((command) => [
      /--target (\S+)/u.exec(command)?.[1],
      /dest=\$RUNNER_TEMP\/([a-z-]+)\.oci/u.exec(command)?.[1],
    ]),
    [
      ['runtime', 'api'],
      ['migrate', 'api-migrate'],
    ],
  );
  for (const command of commands) {
    for (const flag of [
      '--builder api-cd',
      '--platform linux/amd64',
      '--attest "type=sbom,generator=$SBOM_SCANNER_IMAGE"',
      '--provenance=false',
      '--file infra/deploy/api/Dockerfile',
    ])
      assert.ok(command.includes(flag), flag);
    assert.match(command, /,tar=false" \.\n/u, 'the build context is the repository root');
  }
  assert.match(build, /--driver-opt "image=\$BUILDKIT_IMAGE"/u);
  assert.doesNotMatch(build, /--sbom=|--build-arg|secret/u);
  const scan = stepIndex(list, /image-secret-scan\.mjs/u);
  assert.match(
    list[scan].body,
    /image-secret-scan\.mjs "\$RUNNER_TEMP\/api\.oci" "\$RUNNER_TEMP\/api-migrate\.oci"/u,
  );
  const push = stepIndex(list, /skopeo copy/u);
  const assume = stepIndex(list, /configure-aws-credentials@/u);
  assert.ok(stepIndex(list, /docker buildx build/u) < scan && scan < assume && assume < push);
  assert.match(list[push].body, /for name in api api-migrate; do/u);
  assert.match(list[push].body, /echo "\$\{name\/\/-\/_\}_digest=\$digest" >> "\$GITHUB_OUTPUT"/u);
  assert.match(JOBS.build, /^ {6}api_digest: \$\{\{ steps\.push\.outputs\.api_digest \}\}$/mu);
  assert.match(
    JOBS.build,
    /^ {6}api_migrate_digest: \$\{\{ steps\.push\.outputs\.api_migrate_digest \}\}$/mu,
  );
});

test('the build tools are the inventory pins web-cd uses', async () => {
  const { loadImageInventory, resolveImageReference } =
    await import('../artifacts/image-inventory.mjs');
  const inventory = loadImageInventory(repoRoot);
  for (const [name, variable] of [
    ['api-cd-buildkit', 'BUILDKIT_IMAGE'],
    ['api-cd-sbom-scanner', 'SBOM_SCANNER_IMAGE'],
  ]) {
    const image = inventory.images.find((candidate) => candidate.name === name);
    assert.ok(image, name);
    assert.equal(image.ownerPath, '.github/workflows/api-cd.yml');
    const value = (source) => new RegExp(`^ {2}${variable}: (\\S+)$`, 'mu').exec(source)?.[1];
    assert.equal(value(workflow), resolveImageReference(repoRoot, image));
    assert.equal(value(workflow), value(webWorkflow), `${variable} is the web-cd pin`);
  }
});

test('attestations are made only on push, after approval, with literal subject names and the build digests', () => {
  const attests = steps(JOBS.deploy).filter(({ body }) => /actions\/attest@/u.test(body));
  assert.deepEqual(
    attests.map(({ body }) => [
      /subject-name: (\S+)/u.exec(body)?.[1],
      /subject-digest: (.+)/u.exec(body)?.[1].trim(),
      /if: (.+)/u.exec(body)?.[1].trim(),
    ]),
    IMAGES.map((name) => [
      `dormduri/${name}`,
      `\${{ needs.build.outputs.${name.replaceAll('-', '_')}_digest }}`,
      "${{ github.event_name == 'push' }}",
    ]),
  );
  for (const { body } of attests) assert.match(body, /push-to-registry: false/u);
  for (const name of ['build', 'tag', 'record'])
    assert.doesNotMatch(JOBS[name], /actions\/attest@/u, name);
});

test('every run step uses bash with pipefail and only main runs reach the environment job', () => {
  assert.match(workflow, /^defaults:\n {2}run:\n {4}shell: bash$/mu);
  assert.doesNotMatch(workflow, /^ +shell: (?!bash$)/mu);
  assert.match(JOBS.deploy, /^ {4}if: \$\{\{ [^\n]*github\.ref == 'refs\/heads\/main'/mu);
  assert.match(JOBS.build, /^ {4}if: \$\{\{ github\.event_name == 'push' \}\}$/mu);
  assert.match(workflow, /^ {2}push:\n {4}branches: \[main\]$/mu);
});

test('provenance, SBOM, deploy records and the document hash are checked before the host gets anything', () => {
  const list = steps(JOBS.deploy);
  const verify = stepIndex(list, /gh attestation verify/u);
  const send = stepIndex(list, /ssm-send\.sh "\$ACTION"/u);
  const lastAttest = list.map(({ body }) => /actions\/attest@/u.test(body)).lastIndexOf(true);
  assert.ok(verify > lastAttest && verify < send, 'attest → verify → send');
  const body = list[verify].body;
  assert.match(body, /--signer-workflow "\$GITHUB_REPOSITORY\/\.github\/workflows\/api-cd\.yml"/u);
  assert.match(body, /--source-ref refs\/heads\/main/u);
  assert.match(body, /--deny-self-hosted-runners/u);
  assert.match(body, /--source-digest "\$GITHUB_SHA"/u, 'a push run deploys only its own commit');
  assert.match(body, /for name in api api-migrate; do/u);
  assert.match(
    body,
    /release-record\.mjs match --stage=api --source="\$source" --api="\$API" --api-migrate="\$API_MIGRATE"/u,
  );
  for (const [label, pattern] of [
    ['the newer change check', /deploy-inputs-current\.sh "\$GITHUB_SHA" origin\/main api$/mu],
    ['the SBOM check', /release-record\.mjs check-sbom/u],
    ['the deploy record plan', /release-record\.mjs plan --stage=api /u],
    ['the document hash check', /describe-document --name "\$DEPLOY_DOCUMENT"/u],
  ]) {
    const position = stepIndex(list, pattern);
    assert.ok(position >= 0 && position < send, `${label} runs before sending`);
  }
  const hash = list[stepIndex(list, /describe-document/u)].body;
  assert.ok(hash.includes(`sha256sum ${API_DOCUMENT_PATH} `), 'the API document generated file');
  assert.match(workflow, new RegExp(`^ {2}DEPLOY_DOCUMENT: ${API_DOCUMENT_NAME}$`, 'mu'));
});

test('every record helper call names the API stage and every deploy output it reads exists', () => {
  const calls = [...workflow.matchAll(/release-record\.mjs (\S+)([^\n]*)/gu)];
  assert.ok(calls.length >= 5);
  for (const [, command, rest] of calls) {
    if (['attestation-manifest', 'check-sbom'].includes(command)) continue;
    assert.match(rest, /^ --stage=api /u, command);
  }
  const outputs = (job) =>
    new Set(
      [
        .../^ {4}outputs:\n((?: {6}[a-z_]+: .+\n)+)/mu.exec(job)[1].matchAll(/^ {6}([a-z_]+):/gmu),
      ].map((match) => match[1]),
    );
  const deploy = outputs(JOBS.deploy);
  for (const job of ['tag', 'record'])
    for (const [, name] of JOBS[job].matchAll(/needs\.deploy\.outputs\.([a-z_]+)/gu))
      assert.ok(deploy.has(name), `${job} reads deploy output ${name}`);
  const build = outputs(JOBS.build);
  for (const [, name] of JOBS.deploy.matchAll(/needs\.build\.outputs\.([a-z_]+)/gu))
    assert.ok(build.has(name), `deploy reads build output ${name}`);
  const ids = new Set([...JOBS.deploy.matchAll(/^ {8}id: ([a-z]+)$/gmu)].map((match) => match[1]));
  for (const [, id] of JOBS.deploy.matchAll(/steps\.([a-z]+)\.(?:outputs|outcome)/gu))
    assert.ok(ids.has(id), `step ${id} exists`);
  // release-record.mjs plan writes `<prefix>_<image with - as _>` lines.
  for (const prefix of ['previous_safe', 'rollback'])
    for (const name of IMAGES)
      assert.ok(
        JOBS.deploy.includes(`steps.plan.outputs.${prefix}_${name.replaceAll('-', '_')}`),
        `${prefix} ${name}`,
      );
});

test('the host command carries only the action and the API pair under the document parameter names', () => {
  const document = JSON.parse(read(API_DOCUMENT_PATH));
  assert.deepEqual(Object.keys(document.parameters).sort(), [
    'action',
    'apiDigest',
    'apiMigrateDigest',
  ]);
  const sender = read('scripts/infra/user-host/ssm-send.sh');
  assert.match(
    sender,
    new RegExp(
      `^ {2}${API_DOCUMENT_NAME}\\) workflow=api-cd images=\\(api api-migrate\\) names=\\(apiDigest apiMigrateDigest\\) ;;$`,
      'mu',
    ),
  );
  const sends = [
    ...workflow.matchAll(/ssm-send\.sh ([^\s;]+) ([^\s;]+) ([^\s;]+) ([^\s;]+)/gu),
  ].map((m) => m.slice(1));
  assert.deepEqual(sends, [
    ['"$ACTION"', '"$API"', '"$API_MIGRATE"', '"$HASH"'],
    ['rollback', '"$ROLLBACK_API"', '"$ROLLBACK_API_MIGRATE"', '"$HASH"'],
    ['maintenance', '"$API"', '"$API_MIGRATE"', '"$HASH"'],
  ]);
});

test('no workflow artifact is uploaded, no per-node SSM invocation is read and dispatch inputs reach shells only through env', () => {
  assert.doesNotMatch(workflow, /upload-artifact|download-artifact/u);
  assert.doesNotMatch(workflow, /list-command-invocations|get-command-invocation/u);
  for (const { name, body } of Object.values(JOBS).flatMap(steps)) {
    const run = /^ {8}run: ([\s\S]*)$/mu.exec(body)?.[1] ?? '';
    assert.doesNotMatch(run, /\$\{\{\s*(?:inputs|github\.event)\./u, name);
  }
  assert.match(workflow, /^ {6}api_digest:\n/mu);
  assert.match(workflow, /^ {6}api_migrate_digest:\n/mu);
});

test('the external smoke checks the public paths that stay the same with or without the API', () => {
  const smoke = steps(JOBS.deploy).find(
    ({ name }) => name === 'Smoke the public host from outside',
  );
  assert.match(smoke.body, /external-smoke\.mjs --mode=serving \|/u);
  assert.doesNotMatch(JOBS.deploy, /--mode=maintenance|mode=maintenance/u);
});

// recover step의 script를 가짜 ssm-send.sh 위에서 돌린다. codes는 동작별 exit code, 결과는 보낸 동작 순서·exit·요약.
function runRecover(script, { rollbackApi, codes }) {
  const root = mkdtempSync(join(tmpdir(), 'api-cd-recover-'));
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
      ROLLBACK_API: rollbackApi,
      ROLLBACK_API_MIGRATE: rollbackApi ? 'sha256:previous-migrate' : '',
      API: 'sha256:new-api',
      API_MIGRATE: 'sha256:new-migrate',
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

test('a failed external smoke of a deploy rolls back to the previous API pair or takes the API down, then fails the job', () => {
  const list = steps(JOBS.deploy);
  const at = (name) => list.findIndex((step) => step.name === name);
  const smoke = list[at('Smoke the public host from outside')];
  const recover = list[at('Roll back after a failed external smoke')];
  const fail = list[at('Fail when the external smoke failed')];
  assert.ok(smoke && recover && fail);
  assert.match(smoke.body, /continue-on-error: true/u);
  assert.match(
    recover.body,
    /if: \$\{\{ steps\.smoke\.outcome == 'failure' && steps\.request\.outputs\.action == 'deploy' \}\}/u,
  );
  assert.match(fail.body, /if: \$\{\{ steps\.smoke\.outcome == 'failure' \}\}/u);
  assert.ok(
    at('Smoke the public host from outside') < at('Roll back after a failed external smoke'),
  );
  assert.ok(
    at('Roll back after a failed external smoke') < at('Fail when the external smoke failed'),
  );
  const last = list.at(-1);
  assert.match(last.body, /if: \$\{\{ failure\(\) \}\}/u);
  assert.match(last.body, /## API CD stopped/u);
  assert.match(last.body, /_prisma_migrations/u, 'a migrate failure may leave a partial migration');

  const script = runScript(recover.body);
  const rollback = 'rollback sha256:previous-api sha256:previous-migrate document-hash';
  const maintenance = 'maintenance sha256:new-api sha256:new-migrate document-hash';
  const accepted = runRecover(script, { rollbackApi: 'sha256:previous-api', codes: {} });
  assert.deepEqual([accepted.status, accepted.calls], [0, [rollback]]);
  assert.match(accepted.summary, /recovered: rolled back/u);
  const refused = runRecover(script, {
    rollbackApi: 'sha256:previous-api',
    codes: { rollback: 1 },
  });
  assert.deepEqual([refused.status, refused.calls], [0, [rollback, maintenance]]);
  assert.match(refused.summary, /recovered: entered maintenance/u);
  const first = runRecover(script, { rollbackApi: '', codes: {} });
  assert.deepEqual([first.status, first.calls], [0, [maintenance]]);
  const stuck = runRecover(script, {
    rollbackApi: 'sha256:previous-api',
    codes: { rollback: 1, maintenance: 1 },
  });
  assert.notEqual(stuck.status, 0, 'a failed maintenance fails the step');
});

test('tag and record follow web-cd: they run after a successful deploy, skip what a re-run already made, and only a scanned record becomes a Release', () => {
  const condition = (job) => /^ {4}if: (.+)$/mu.exec(job)?.[1];
  for (const name of ['tag', 'record'])
    assert.equal(condition(JOBS[name]), condition(WEB_JOBS[name]));
  assert.match(JOBS.tag, /for name in api api-migrate; do/u);
  assert.match(JOBS.tag, /already tagged \$IMAGE_TAG/u);
  assert.match(JOBS.record, /gh release view "\$GIT_TAG"/u);
  const record = steps(JOBS.record).at(-1).body;
  const order = [
    'release-record.mjs record --stage=api',
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
  assert.match(
    record,
    /gh release create "\$GIT_TAG" --repo "\$GITHUB_REPOSITORY" --target "\$GITHUB_SHA" \\$/mu,
  );
  assert.match(
    steps(JOBS.deploy).find(({ name }) => name === 'Name the deploy tags').body,
    /release-record\.mjs tags --stage=api --run-number="\$GITHUB_RUN_NUMBER"/u,
  );
});

// 배포 입력: 그 workflow가 build하는 image의 Dockerfile·COPY 원본·.dockerignore, 그 workflow가 대조하는 SSM document의 원본·
// 생성본, 그 workflow 자신. 배포 입력 파일마다 그 입력을 배포하는 workflow만 걸린다(API 묶음 조각·document 원본은 api-cd만,
// web document 원본은 web-cd만, 공유 package·lockfile·.dockerignore·두 document가 담는 lib.sh는 둘 다). filter는 배포 입력
// 밖의 tracked 파일을 걸지 않는다.
const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  cwd: repoRoot,
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean);
const expand = (sources) =>
  sources
    .map((source) => source.replace(/\/$/u, ''))
    .flatMap((source) =>
      tracked.filter((path) => path === source || path.startsWith(`${source}/`)),
    );
const INPUTS = {
  'web-cd': new Set([
    ...expand([
      ...copySources(repoRoot, 'infra/deploy/web/Dockerfile', ''),
      ...copySources(repoRoot, 'infra/deploy/user/ingress/Dockerfile', 'infra/deploy/user/ingress'),
      'infra/deploy/user/ingress',
    ]),
    'infra/deploy/web/Dockerfile',
    '.dockerignore',
    SCRIPT_PATH,
    LIB_PATH,
    COMPOSE_PATH,
    DOCUMENT_PATH,
    '.github/workflows/web-cd.yml',
  ]),
  'api-cd': new Set([
    ...expand(copySources(repoRoot, 'infra/deploy/api/Dockerfile', '')),
    'infra/deploy/api/Dockerfile',
    '.dockerignore',
    API_SCRIPT_PATH,
    LIB_PATH,
    API_COMPOSE_PATH,
    SECRET_BUNDLE_PATH,
    SECRET_CONTRACT_PATH,
    API_DOCUMENT_PATH,
    '.github/workflows/api-cd.yml',
  ]),
};
const FILTERS = { 'web-cd': pushPaths(webWorkflow), 'api-cd': pushPaths(workflow) };
const triggered = (path) => Object.keys(FILTERS).filter((name) => triggers(path, FILTERS[name]));
const deploys = (path) => Object.keys(INPUTS).filter((name) => INPUTS[name].has(path));

test('every deploy input triggers exactly the workflows that deploy it and the filters take nothing else', () => {
  for (const name of Object.keys(INPUTS))
    for (const path of INPUTS[name])
      assert.ok(tracked.includes(path), `${name}: ${path} is tracked`);
  const wrong = tracked
    .filter((path) => triggered(path).join() !== deploys(path).join())
    .map((path) => `${path}: triggers [${triggered(path)}], deploys [${deploys(path)}]`);
  assert.deepEqual(wrong, []);
  for (const [path, expected] of [
    ['infra/deploy/user/api/compose.yml', ['api-cd']],
    [API_SCRIPT_PATH, ['api-cd']],
    [API_DOCUMENT_PATH, ['api-cd']],
    [SECRET_BUNDLE_PATH, ['api-cd']],
    ['apps/api/src/main.ts', ['api-cd']],
    ['packages/database/prisma/schema.prisma', ['api-cd']],
    ['infra/db/migrate-deploy.sh', ['api-cd']],
    [SCRIPT_PATH, ['web-cd']],
    [DOCUMENT_PATH, ['web-cd']],
    [COMPOSE_PATH, ['web-cd']],
    ['apps/web/package.json', ['web-cd']],
    ['packages/eslint-config/base.mjs', ['web-cd']],
    [LIB_PATH, ['web-cd', 'api-cd']],
    ['packages/shared/package.json', ['web-cd', 'api-cd']],
    ['packages/eslint-config/package.json', ['web-cd', 'api-cd']],
    ['pnpm-lock.yaml', ['web-cd', 'api-cd']],
    ['.dockerignore', ['web-cd', 'api-cd']],
    ['docs/README.md', []],
    ['scripts/infra/user-host/ssm-document.mjs', []],
  ]) {
    assert.ok(tracked.includes(path), path);
    assert.deepEqual(triggered(path), expected, path);
  }
  for (const filter of FILTERS['api-cd'])
    assert.ok(
      tracked.some((path) => triggers(path, [filter])),
      `${filter} matches a tracked deploy input`,
    );
});

test('the newer-change check compares the same paths as the api-cd trigger', () => {
  const script = read('scripts/infra/user-host/deploy-inputs-current.sh');
  assert.deepEqual(
    stalePaths(script, 'API_DEPLOY_INPUT_PATHS').sort(),
    FILTERS['api-cd']
      .map((path) => path.replace(/\/\*\*$/u, '').replace(/^!/u, ':(exclude)'))
      .sort(),
  );
});
