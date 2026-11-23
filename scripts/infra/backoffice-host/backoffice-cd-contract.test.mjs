// backoffice-cd.yml의 결정적 검사(backoffice-foundation D-BF16, api-cd와 같은 신뢰 구조). 실제 AWS·GitHub 동작은 백오피스 단계
// 첫 실행이 확인하고, 여기서는 workflow 글이 신뢰 경계를 지키는지 본다: job별 권한과 environment, 백오피스 host 직렬화, schema
// gate 순서, attestation 이름·조건, provenance·SBOM·기록·document hash가 host 명령보다 앞섬, role secret 위치와 mask, 외부 smoke
// 없음, 단계 기록 helper의 backoffice stage 호출, 경로 filter와 배포 입력(배포 입력 파일마다 걸림, filter는 그 밖을 걸지 않음).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
} from '../user-host/cd-workflow-text.mjs';
import { BACKOFFICE_SMOKE, STAGES } from '../user-host/release-record.mjs';
import { SECRET_BUNDLE_PATH } from '../user-host/ssm-document.mjs';
import {
  ALLOY_CONFIG_PATH,
  BOOTSTRAP_DOCUMENT_PATH,
  BOOTSTRAP_SCRIPT_PATH,
  COMPOSE_PATH,
  DEPLOY_DOCUMENT_NAME,
  DEPLOY_DOCUMENT_PATH,
  DEPLOY_SCRIPT_PATH,
  LIB_PATH,
  SECRET_CONTRACT_PATH,
} from './ssm-document.mjs';

const repoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8');
const workflow = read('.github/workflows/backoffice-cd.yml');
const apiWorkflow = read('.github/workflows/api-cd.yml');
const JOBS = jobs(workflow);
const API_JOBS = jobs(apiWorkflow);
const IMAGES = STAGES.backoffice.images;
const step = (job, name) => {
  const found = steps(JOBS[job]).find((entry) => entry.name === name);
  assert.ok(found, `${job}: ${name}`);
  return found;
};

test('only the designated jobs hold write scopes and only deploy references the production-backoffice environment', () => {
  assert.match(workflow, /^permissions:\n {2}contents: read\n\n/mu);
  assert.deepEqual(Object.keys(JOBS), ['build', 'schema', 'deploy', 'tag', 'record']);
  for (const name of ['build', 'deploy', 'tag', 'record'])
    assert.deepEqual(permissions(JOBS[name]), permissions(API_JOBS[name]), name);
  assert.deepEqual(permissions(JOBS.schema), { contents: 'read', actions: 'read' });
  assert.match(JOBS.deploy, /^ {4}environment: production-backoffice$/mu);
  for (const name of ['build', 'schema', 'tag', 'record'])
    assert.doesNotMatch(JOBS[name], /environment:/u, name);
});

test('backoffice-cd has its own host concurrency group that never cancels a running deploy', () => {
  assert.match(
    workflow,
    /^concurrency:\n {2}group: backoffice-host-production\n {2}cancel-in-progress: false$/mu,
  );
  assert.match(apiWorkflow, /^ {2}group: user-host-production$/mu);
});

test('every assumed role ID is masked by the same script as api-cd before the action prints it', () => {
  const apiMask = runScript(
    steps(API_JOBS.build).find(({ name }) => name === 'Mask the account part of the role ID').body,
  );
  const roles = {};
  for (const [name, job] of Object.entries(JOBS)) {
    const list = steps(job);
    list.forEach((entry, position) => {
      if (!/configure-aws-credentials@/u.test(entry.body)) return;
      assert.match(entry.body, /mask-aws-account-id: true/u, `${name}: ${entry.name}`);
      const secret = /role-to-assume: \$\{\{ secrets\.([A-Z_]+) \}\}/u.exec(entry.body)[1];
      roles[name] = secret;
      const mask = list[position - 1];
      assert.equal(mask?.name, 'Mask the account part of the role ID', `${name}: ${entry.name}`);
      assert.ok(mask.body.includes(`ROLE_ARN: \${{ secrets.${secret} }}`), name);
      assert.equal(runScript(mask.body), apiMask, name);
    });
    const login = stepIndex(list, /amazon-ecr-login@/u);
    if (login < 0) continue;
    assert.equal(list[login - 1].name, 'Mask the registry host', name);
    assert.doesNotMatch(list[login - 1].body, /env:/u, name);
  }
  assert.deepEqual(roles, {
    build: 'AWS_BACKOFFICE_PUBLISH_ROLE_ARN',
    deploy: 'AWS_BACKOFFICE_DEPLOY_ROLE_ARN',
    tag: 'AWS_BACKOFFICE_PUBLISH_ROLE_ARN',
  });
  assert.doesNotMatch(workflow, /secrets\.(?!AWS_BACKOFFICE_(?:PUBLISH|DEPLOY)_ROLE_ARN\b)/u);
  assert.doesNotMatch(workflow, /\$\{\{\s*vars\./u);
});

test('the build job builds the three images with the api-cd tool pins and scans them before push', () => {
  for (const name of ['BUILDKIT_IMAGE', 'SBOM_SCANNER_IMAGE']) {
    const pin = new RegExp(`^ {2}${name}: (\\S+)$`, 'mu');
    assert.equal(pin.exec(workflow)[1], pin.exec(apiWorkflow)[1], name);
  }
  const postgres = /^ {8}image: (postgres:\S+)$/mu;
  assert.equal(postgres.exec(JOBS.build)[1], postgres.exec(API_JOBS.build)[1]);
  const build = runScript(step('build', 'Build the three images as OCI layouts with an SBOM').body);
  for (const [name, file, context] of [
    ['backoffice-api', 'infra/deploy/backoffice-api/Dockerfile --target runtime', '.'],
    ['backoffice-web', 'infra/deploy/backoffice-web/Dockerfile --target runtime', '.'],
    [
      'backoffice-ingress',
      'infra/deploy/backoffice/ingress/Dockerfile',
      'infra/deploy/backoffice/ingress',
    ],
  ]) {
    assert.ok(
      build.includes(
        `--file ${file} \\\n  --output "type=oci,dest=$RUNNER_TEMP/${name}.oci,tar=false" ${context}\n`,
      ),
      name,
    );
  }
  assert.equal(
    (build.match(/--attest "type=sbom,generator=\$SBOM_SCANNER_IMAGE" --provenance=false/gu) ?? [])
      .length,
    3,
  );
  const list = steps(JOBS.build);
  const scan = stepIndex(list, /image-secret-scan\.mjs/u);
  assert.ok(
    scan > stepIndex(list, /docker buildx build/u) && scan < stepIndex(list, /skopeo copy/u),
  );
  for (const name of IMAGES)
    assert.match(list[scan].body, new RegExp(`\\$RUNNER_TEMP/${name}\\.oci`, 'u'));
  // 생성 step은 api-cd의 것과 같고 NODE_IMAGE만 백오피스 API Dockerfile에서 읽는다.
  const generate = (source) =>
    runScript(steps(source).find(({ name }) => name.startsWith('Generate the Prisma client')).body);
  assert.equal(
    generate(JOBS.build),
    generate(API_JOBS.build)
      .replace('infra/deploy/api/Dockerfile', 'infra/deploy/backoffice-api/Dockerfile')
      .replace('The API Dockerfile', 'The backoffice API Dockerfile'),
  );
});

test('the schema gate runs on push before the approval and the deploy job needs it', () => {
  assert.match(JOBS.schema, /^ {4}needs: build$/mu);
  assert.match(
    JOBS.schema,
    /^ {4}if: \$\{\{ github\.event_name == 'push' && needs\.build\.result == 'success' \}\}$/mu,
  );
  assert.match(
    step('schema', 'Wait for the api-cd deploy of this schema').body,
    /run: node scripts\/infra\/backoffice-host\/schema-gate\.mjs --sha="\$GITHUB_SHA"$/mu,
  );
  assert.match(JOBS.schema, /fetch-depth: 0/u);
  assert.match(JOBS.deploy, /^ {4}needs: \[build, schema\]$/mu);
  assert.match(
    JOBS.deploy,
    /github\.event_name == 'workflow_dispatch' \|\| \(needs\.build\.result == 'success' && needs\.schema\.result == 'success'\)/u,
  );
  assert.match(JOBS.deploy, /github\.ref == 'refs\/heads\/main'/u);
});

test('attestations are made only on push, after approval, with literal subject names and the build digests', () => {
  const list = steps(JOBS.deploy);
  const attests = list.filter(({ body }) => /actions\/attest@/u.test(body));
  assert.equal(attests.length, 3);
  IMAGES.forEach((name, index) => {
    const { body } = attests[index];
    assert.match(body, /if: \$\{\{ github\.event_name == 'push' \}\}/u);
    assert.match(body, new RegExp(`subject-name: dormduri/${name}$`, 'mu'));
    assert.match(
      body,
      new RegExp(
        `subject-digest: \\$\\{\\{ needs\\.build\\.outputs\\.${name.replaceAll('-', '_')}_digest \\}\\}`,
        'u',
      ),
    );
    assert.match(body, /push-to-registry: false/u);
  });
  assert.ok(list.indexOf(attests[0]) > stepIndex(list, /deploy-inputs-current\.sh/u));
});

test('freshness, provenance, SBOM, deploy records and the document hash are checked before the host gets anything', () => {
  const list = steps(JOBS.deploy);
  const order = [
    /deploy-inputs-current\.sh "\$GITHUB_SHA" origin\/main backoffice$/mu,
    /actions\/attest@/u,
    /gh attestation verify/u,
    /check-sbom/u,
    /release-record\.mjs plan --stage=backoffice/u,
    /describe-document --name "\$DEPLOY_DOCUMENT"/u,
    /ssm-send\.sh "\$ACTION" "\$API" "\$WEB" "\$INGRESS" "\$HASH"/u,
  ].map((pattern) => stepIndex(list, pattern));
  assert.ok(
    order.every((index) => index >= 0),
    JSON.stringify(order),
  );
  assert.deepEqual(
    [...order].sort((a, b) => a - b),
    order,
  );
  const verify = runScript(step('deploy', 'Verify the provenance of the three images').body);
  assert.match(
    verify,
    /--signer-workflow "\$GITHUB_REPOSITORY\/\.github\/workflows\/backoffice-cd\.yml"/u,
  );
  assert.match(verify, /--source-ref refs\/heads\/main/u);
  assert.match(verify, /--deny-self-hosted-runners/u);
  assert.match(verify, /for name in backoffice-api backoffice-web backoffice-ingress; do/u);
  assert.match(workflow, new RegExp(`^ {2}DEPLOY_DOCUMENT: ${DEPLOY_DOCUMENT_NAME}$`, 'mu'));
  assert.ok(
    step('deploy', 'Check the deploy document hash').body.includes(
      `sha256sum ${DEPLOY_DOCUMENT_PATH} `,
    ),
  );
});

test('there is no external smoke: the record smoke is the host smoke summary the stage record accepts', () => {
  assert.doesNotMatch(
    workflow,
    /external-smoke|--mode=serving|Roll back after a failed external smoke/u,
  );
  assert.equal(
    /echo "summary=(.+)" >> "\$GITHUB_OUTPUT"$/mu.exec(
      step('deploy', 'Record the host smoke summary').body,
    )[1],
    BACKOFFICE_SMOKE,
  );
  const list = steps(JOBS.deploy);
  assert.equal(stepIndex(list, /summary=host smoke/u), stepIndex(list, /ssm-send\.sh/u) + 1);
});

test('every record helper call names the backoffice stage and every deploy output it reads exists', () => {
  const calls = [...workflow.matchAll(/release-record\.mjs (plan|match|record|tags)\b[^\n]*/gu)];
  assert.equal(calls.length, 4);
  for (const [line] of calls) assert.match(line, /--stage=backoffice/u, line);
  const outputs = new Set(
    [...JOBS.deploy.matchAll(/^ {6}([a-z_]+): \$\{\{ steps\./gmu)].map((m) => m[1]),
  );
  for (const job of ['tag', 'record'])
    for (const [, name] of JOBS[job].matchAll(/needs\.deploy\.outputs\.([a-z_]+)/gu))
      assert.ok(outputs.has(name), `${job} reads ${name}`);
  for (const name of IMAGES) {
    const key = name.replaceAll('-', '_');
    for (const output of [`${key}_digest`, `${key}_sbom`, `previous_safe_${key}`])
      assert.ok(outputs.has(output), output);
  }
});

test('no workflow artifact is uploaded, no per-node SSM invocation is read and dispatch inputs reach shells only through env', () => {
  assert.doesNotMatch(workflow, /upload-artifact|list-command-invocations|get-command-invocation/u);
  for (const { body } of Object.values(JOBS).flatMap((job) => steps(job))) {
    if (!/run: /u.test(body)) continue;
    const script = body.slice(body.indexOf('run: '));
    assert.doesNotMatch(script, /\$\{\{\s*inputs\./u);
  }
});

test('tag and record follow api-cd: after a successful deploy, skip what a re-run made, and only a scanned record becomes a Release', () => {
  assert.equal(/^ {4}if: (.+)$/mu.exec(JOBS.tag)[1], /^ {4}if: (.+)$/mu.exec(API_JOBS.tag)[1]);
  assert.equal(
    /^ {4}if: (.+)$/mu.exec(JOBS.record)[1],
    /^ {4}if: (.+)$/mu.exec(API_JOBS.record)[1],
  );
  const record = runScript(
    step('record', 'Create the deploy tag and Release with the stage record').body,
  );
  const scan = record.indexOf('public-record-scan.mjs');
  assert.ok(
    scan > record.indexOf('release-record.mjs record') &&
      scan < record.indexOf('gh release create'),
  );
  assert.match(
    record,
    /gh release create "\$GIT_TAG" --repo "\$GITHUB_REPOSITORY" --target "\$GITHUB_SHA" \\$/mu,
  );
  assert.match(
    runScript(step('tag', 'Add the deploy tag to the three digests').body),
    /for name in backoffice-api backoffice-web backoffice-ingress; do/u,
  );
});

// 배포 입력: 세 image의 Dockerfile·COPY 원본(ingress는 build context 전체)·.dockerignore, deploy document의 원본·생성본(compose·
// Alloy 설정·lib·secret 묶음 script·contract), bootstrap document의 원본·생성본, 이 workflow. filter는 그 밖의 tracked 파일을
// 걸지 않는다(document 생성기·test는 걸지 않음).
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
const INPUTS = new Set([
  ...expand([
    ...copySources(repoRoot, 'infra/deploy/backoffice-api/Dockerfile', ''),
    ...copySources(repoRoot, 'infra/deploy/backoffice-web/Dockerfile', ''),
    'infra/deploy/backoffice/ingress',
  ]),
  'infra/deploy/backoffice-api/Dockerfile',
  'infra/deploy/backoffice-web/Dockerfile',
  '.dockerignore',
  DEPLOY_SCRIPT_PATH,
  BOOTSTRAP_SCRIPT_PATH,
  LIB_PATH,
  COMPOSE_PATH,
  ALLOY_CONFIG_PATH,
  SECRET_BUNDLE_PATH,
  SECRET_CONTRACT_PATH,
  DEPLOY_DOCUMENT_PATH,
  BOOTSTRAP_DOCUMENT_PATH,
  '.github/workflows/backoffice-cd.yml',
]);
const FILTER = pushPaths(workflow);

test('every backoffice deploy input triggers backoffice-cd and the filter takes nothing else', () => {
  for (const path of INPUTS) assert.ok(tracked.includes(path), `${path} is tracked`);
  const wrong = tracked
    .filter((path) => triggers(path, FILTER) !== INPUTS.has(path))
    // backoffice-web·backoffice-api 디렉터리 전체가 COPY 원본이고, packages/database·eslint-config도 전체다.
    .map((path) => `${path}: triggers ${triggers(path, FILTER)}, deploys ${INPUTS.has(path)}`);
  assert.deepEqual(wrong, []);
  for (const [path, expected] of [
    ['apps/backoffice-api/src/main.ts', true],
    ['packages/database/prisma/schema.prisma', true],
    ['infra/deploy/api/rds-ca-bundle.sha256', true],
    [SECRET_BUNDLE_PATH, true],
    ['infra/deploy/user/api/ssm/deploy-api.sh', false],
    ['infra/deploy/api/Dockerfile', false],
    ['apps/api/src/main.ts', false],
    ['scripts/infra/backoffice-host/ssm-document.mjs', false],
    ['infra/observability/prometheus/rules/backoffice-alerts.yml', false],
  ]) {
    if (tracked.includes(path)) assert.equal(triggers(path, FILTER), expected, path);
  }
  for (const filter of FILTER)
    assert.ok(
      tracked.some((path) => triggers(path, [filter])),
      `${filter} matches a tracked deploy input`,
    );
});

test('the newer-change check compares the same paths as the backoffice-cd trigger', () => {
  assert.deepEqual(
    stalePaths(
      read('scripts/infra/user-host/deploy-inputs-current.sh'),
      'BACKOFFICE_DEPLOY_INPUT_PATHS',
    ).sort(),
    FILTER.map((path) => path.replace(/\/\*\*$/u, '')).sort(),
  );
});
