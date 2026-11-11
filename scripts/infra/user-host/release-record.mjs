#!/usr/bin/env node
// CD의 단계 기록(D-WB5·D-WB12, production-api-baseline D-AB12·D-AB17). 배포가 성공한 실행마다 record job이 실행 commit(push
// 실행은 source commit, dispatch 실행은 실행한 main commit)에 git tag `deploy-<stage>-<UTC YYYYMMDD>-<run number>`와 GitHub
// Release를 만들고, 본문과 run 요약에 같은 단계 기록을 남긴다. 배포한 source commit은 본문 release_commit_sha다. 형식은
// infra/runbooks/release/production-release-evidence.md "단계 배포 기록"의 YAML template이다.
// stage는 web(web-cd: web·ingress)과 api(api-cd: api·api-migrate·observability-config)다. CLI는 `--stage=<stage>`로 고르고 기본은
// web이다.
// deploy job은 이 기록으로 host의 지금 쌍과 직전 안전 쌍을 알고(외부 smoke 실패 때 되돌릴 쌍), dispatch 입력 쌍이 그
// source commit의 기록과 같은지 대조한다(D-WB3). 두 stage의 Release는 tag 이름으로 갈려 서로의 계산에 들지 않는다. 기록에는
// registry host·ARN·node ID 자리가 없고 image는 `dormduri/<name>@sha256:…`로만 적는다(D-WB7).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ACTIONS = Object.freeze(['deploy', 'rollback', 'maintenance']);
const DIGEST = /^sha256:[a-f0-9]{64}$/u;
const COMMIT = /^[a-f0-9]{40}$/u;
const RUN_URL = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/actions\/runs\/[0-9]+$/u;
const SMOKE = /^external smoke \((?:serving|maintenance)\): [0-9]+\/[0-9]+ passed$/u;
const OPERATOR = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})(?:\[bot\])?$/u;
const TIMESTAMP = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$/u;
export const SBOM_PREDICATE = 'https://spdx.dev/Document';
export const RECORD_FORMAT = 'infra/runbooks/release/production-release-evidence.md#단계-배포-기록';

// record job은 판정하지 않는다. operator가 evidence를 확인한 뒤 Release를 고친다(증거가 빠진 component는 PASS로 적지 않는다).
const NOT_JUDGED = '미판정(operator가 이 run과 evidence를 확인한 뒤 고친다)';
// DB를 들인 뒤에도 DB를 바꾸지 않는 실행(Web 배포, API rollback·maintenance)의 DB 항목(D-AB17). 최종 release는 전부 본다.
const DB_UNCHANGED = '해당 없음(이 실행은 DB를 바꾸지 않음)';

// 단계마다 올리는 image(배포 묶음), git tag, 그 Release를 만드는 workflow, 기록하는 component(D-WB9·D-WB12, D-AB2·D-AB17).
// api 묶음은 관측 설정 image를 함께 배포하므로(D-AB14) 관측 component를 적는다. 관측 단계는 fail-open이라 host RESULT 줄의
// observability 값(ok·failed)은 operator가 옮겨 적는다(node별 결과를 읽지 않음, D-WB7).
export const STAGES = Object.freeze({
  web: Object.freeze({
    title: 'Web 단계 배포 기록',
    images: Object.freeze(['web', 'ingress']),
    gitTag: /^deploy-web-[0-9]{8}-[0-9]+$/u,
    workflow: '.github/workflows/web-cd.yml',
    components: () => [
      ...['Infrastructure target(Web 부분)', 'Rollback', 'TLS 만료 경보', '외부 가용성'].map(
        (name) => `${name}: ${NOT_JUDGED}`,
      ),
      `DB·migration·role grant·DB credential·backup/restore: ${DB_UNCHANGED}`,
    ],
    // Web document는 maintenance에서도 점검 화면 smoke를 host 안에서 돈다.
    hostSmoke: () => 'host 내부 smoke 통과(SSM command Success)',
    rollbackCheck: (runUrl) => `이 실행이 host의 직전 쌍으로 되돌리고 외부 smoke 통과(${runUrl})`,
    maintenanceCheck: '해당 없음(점검 mode)',
  }),
  api: Object.freeze({
    title: 'API 단계 배포 기록',
    images: Object.freeze(['api', 'api-migrate', 'observability-config']),
    gitTag: /^deploy-api-[0-9]{8}-[0-9]+$/u,
    workflow: '.github/workflows/api-cd.yml',
    // deploy만 migrate·grant·role smoke·auth mail outbox 확인을 돈다(rollback은 돌지 않고, maintenance는 API를 내린다).
    // migrate 시작 시각(UTC)은 host RESULT 줄에만 있어(node별 결과를 읽지 않음, D-WB7) operator가 옮겨 적는다.
    components: (action) => [
      ...[
        'Infrastructure target(API 부분)',
        'API Secrets Manager',
        'Lightsail runtime(API 묶음)',
        'Rollback',
      ].map((name) => `${name}: ${NOT_JUDGED}`),
      ...(action === 'deploy'
        ? [
            'DB migration·role grant·role smoke: 미판정(operator가 host RESULT 줄의 migrateStarted(UTC)를 이 줄에 적고 고친다)',
            `DB credential: ${NOT_JUDGED}`,
            `DB backup/restore: ${NOT_JUDGED}`,
          ]
        : [`DB migration·role grant·DB credential·backup/restore: ${DB_UNCHANGED}`]),
      action === 'maintenance'
        ? '관측 stack: 해당 없음(이 실행은 관측을 바꾸지 않음)'
        : '관측 stack(Prometheus·Loki·Alloy·Alertmanager·Grafana)·Slack 경보·host 지표: 미판정(operator가 host RESULT 줄의 observability 값, Grafana·Slack 시험, Alloy Docker socket 위험 수용을 확인한 뒤 고친다)',
    ],
    // host 안 readiness·smoke는 deploy·rollback의 rollout만 돈다. maintenance는 API를 내리기만 한다.
    hostSmoke: (action) =>
      action === 'maintenance'
        ? 'host 안 smoke 해당 없음(API를 내림. SSM command Success만 확인)'
        : 'host 내부 smoke 통과(SSM command Success: readiness, private listener 공개 열람 응답, metrics 닫힘)',
    rollbackCheck: (runUrl) =>
      `이 실행이 host의 직전 API 묶음으로 되돌리고 외부 smoke 통과(${runUrl})`,
    maintenanceCheck: '해당 없음(API를 내림)',
  }),
});

function stageOf(name = 'web') {
  const stage = Object.hasOwn(STAGES, name) ? STAGES[name] : undefined;
  if (!stage) throw new Error(`unknown stage: ${name}`);
  return stage;
}

const pad = (value) => String(value).padStart(2, '0');
const utcDay = (date) =>
  `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;

// ECR image에 더하는 배포 tag(D-WB3). 숫자 12자리가 이어지지 않게 날짜와 시각 사이에 T를 둔다.
export function imageDeployTag(date, runNumber) {
  return `deploy-${utcDay(date)}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}-${runNumber}`;
}

export function gitDeployTag(date, runNumber, stage = 'web') {
  stageOf(stage);
  return `deploy-${stage}-${utcDay(date)}-${runNumber}`;
}

// 배포 쌍: 그 stage의 image 이름만 key로 갖고 값이 모두 digest다.
const isPair = (pair, images) =>
  Boolean(pair) &&
  Object.keys(pair).length === images.length &&
  images.every((name) => DIGEST.test(pair[name] ?? ''));
const samePair = (left, right, images) =>
  isPair(left, images) &&
  isPair(right, images) &&
  images.every((name) => left[name] === right[name]);
const imageLines = (pair, images) => images.map((name) => `  - dormduri/${name}@${pair[name]}`);

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

// BuildKit SBOM attestation(`--attest type=sbom`)이 붙은 image index에서 platform image 하나와 그것을 가리키는 attestation manifest의 digest를 고른다.
export function attestationManifestDigest(index) {
  const manifests = index?.manifests ?? [];
  const attestations = manifests.filter(
    (entry) => entry.annotations?.['vnd.docker.reference.type'] === 'attestation-manifest',
  );
  const images = manifests.filter((entry) => !attestations.includes(entry));
  ensure(images.length === 1, `the image index has ${images.length} platform images; expected 1`);
  const attestation = attestations.filter(
    (entry) => entry.annotations['vnd.docker.reference.digest'] === images[0].digest,
  );
  ensure(attestation.length === 1, 'the image index has no attestation manifest for its image');
  ensure(DIGEST.test(attestation[0].digest), 'the attestation manifest digest is malformed');
  return attestation[0].digest;
}

export function hasSbomLayer(manifest) {
  return (manifest?.layers ?? []).some(
    (layer) =>
      layer.mediaType === 'application/vnd.in-toto+json' &&
      layer.annotations?.['in-toto.io/predicate-type'] === SBOM_PREDICATE,
  );
}

export function renderStageRecord(input) {
  const { action, releaseId, sourceCommit, pair, sbom, event, runUrl, smoke } = input;
  const { previousSafe, operator, collectedAt } = input;
  const stageName = input.stage ?? 'web';
  const stage = stageOf(stageName);
  const { images } = stage;
  ensure(ACTIONS.includes(action), `unknown action: ${action}`);
  ensure(stage.gitTag.test(releaseId ?? ''), `release ID is not a deploy-${stageName} tag`);
  ensure(COMMIT.test(sourceCommit ?? ''), 'source commit is not a full SHA');
  ensure(isPair(pair, images), `the image pair is not ${images.join(' and ')} sha256 digests`);
  ensure(
    Boolean(sbom) &&
      Object.keys(sbom).length === images.length &&
      images.every((name) => DIGEST.test(sbom[name] ?? '')),
    'an SBOM manifest digest is missing',
  );
  ensure(['push', 'workflow_dispatch'].includes(event), `unknown event: ${event}`);
  ensure(RUN_URL.test(runUrl ?? ''), 'run URL is not a workflow run URL');
  ensure(SMOKE.test(smoke ?? ''), 'smoke is not an external smoke summary');
  ensure(previousSafe === null || isPair(previousSafe, images), 'previous safe pair is malformed');
  ensure(OPERATOR.test(operator ?? ''), 'operator is not a GitHub account name');
  ensure(TIMESTAMP.test(collectedAt ?? ''), 'collected_at is not a UTC timestamp');

  const provenance =
    event === 'push' ? 'provenance 생성·검증 통과' : 'provenance 검증·배포 기록 대조 통과';
  const rollbackCheck = {
    deploy: '확인 전(rollback 실행의 Release가 기록)',
    rollback: stage.rollbackCheck(runUrl),
    maintenance: stage.maintenanceCheck,
  }[action];
  const previous =
    previousSafe === null
      ? [
          `previous_safe: ${action === 'rollback' ? '없음(rollback 뒤 host가 직전 쌍을 비움)' : '없음(첫 배포)'}`,
        ]
      : ['previous_safe:', ...imageLines(previousSafe, images)];
  return [
    `${stage.title}. 형식: ${RECORD_FORMAT}`,
    '',
    '```yaml',
    `stage: ${stageName}`,
    `action: ${action}`,
    `release_id: ${releaseId}`,
    `release_commit_sha: ${sourceCommit}`,
    'images:',
    ...imageLines(pair, images),
    'attestation:',
    ...images.map(
      (name) =>
        `  - dormduri/${name}: ${provenance}(signer ${stage.workflow}, refs/heads/main), SBOM attestation manifest ${sbom[name]}`,
    ),
    `  - run: ${runUrl}`,
    'components:',
    ...stage.components(action).map((line) => `  - ${line}`),
    `smoke: ${smoke}, ${stage.hostSmoke(action)}`,
    `rollback_check: ${rollbackCheck}`,
    ...previous,
    'aggregate_state: COLLECTING',
    'final_decision: PENDING_TARGET',
    `operator: ${operator}`,
    `collected_at: ${collectedAt}`,
    'risk_owner: Owner',
    'rollback_owner: Owner',
    'redaction_confirmed: true',
    '```',
    '',
  ].join('\n');
}

// 단계 기록에서 동작·source commit·image 쌍·직전 안전 쌍을 읽는다. 그 stage의 형식이 아니면 null이다.
export function parseStageRecord(body, stageName = 'web') {
  const { images } = stageOf(stageName);
  const yaml = /```yaml\n([\s\S]*?)```/u.exec(body ?? '')?.[1];
  if (!yaml) return null;
  const value = (key) => new RegExp(`^${key}: (.*)$`, 'mu').exec(yaml)?.[1]?.trim();
  const list = (key) => {
    const block = new RegExp(`^${key}:\\n((?: {2}- .+\\n)+)`, 'mu').exec(yaml)?.[1] ?? '';
    const pair = {};
    for (const match of block.matchAll(/^ {2}- dormduri\/([a-z-]+)@(sha256:[a-f0-9]{64})$/gmu)) {
      pair[match[1]] = match[2];
    }
    return isPair(pair, images) ? pair : null;
  };
  const action = value('action');
  const sourceCommit = value('release_commit_sha');
  const pair = list('images');
  if (
    value('stage') !== stageName ||
    !ACTIONS.includes(action) ||
    !COMMIT.test(sourceCommit ?? '') ||
    !pair
  ) {
    return null;
  }
  return { action, sourceCommit, pair, previousSafe: list('previous_safe') };
}

function records(releases, stageName) {
  const { gitTag } = stageOf(stageName);
  return releases
    .filter((release) => gitTag.test(release.tagName))
    .map((release) => ({ ...release, record: parseStageRecord(release.body, stageName) }))
    .filter((release) => release.record)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

// 마지막 deploy·rollback 기록이 host의 지금 쌍(current)과 직전 안전 쌍(host previous)이다. maintenance는 둘을 바꾸지 않는다.
export function servingState(releases, stageName = 'web') {
  const latest = records(releases, stageName).find(
    (release) => release.record.action !== 'maintenance',
  );
  return {
    current: latest?.record.pair ?? null,
    previousSafe: latest?.record.previousSafe ?? null,
  };
}

// 이 실행 뒤 host previous가 될 쌍(단계 기록의 previous_safe)과, deploy가 외부 smoke에서 실패했을 때 되돌릴 쌍.
// host 배포 script(web: infra/deploy/user/ssm/deploy.sh, api: infra/deploy/user/api/ssm/deploy-api.sh)와 같은 규칙이다:
// deploy는 다른 쌍을 올리면 current를 previous로 두고, 같은 쌍이면 previous를 그대로 둔다. rollback은 previous와 같은 쌍만
// 받고 성공하면 previous를 비운다.
export function planRun({ action, pair }, releases, stageName = 'web') {
  const { images } = stageOf(stageName);
  ensure(ACTIONS.includes(action), `unknown action: ${action}`);
  ensure(isPair(pair, images), `the image pair is not ${images.join(' and ')} sha256 digests`);
  const { current, previousSafe } = servingState(releases, stageName);
  if (action === 'deploy') {
    const previous = current && !samePair(current, pair, images) ? current : previousSafe;
    return { previousSafe: previous, rollbackTarget: previous };
  }
  if (action === 'rollback') {
    ensure(
      samePair(previousSafe, pair, images),
      'a rollback must name the previous_safe pair of the latest deploy record',
    );
    return { previousSafe: null, rollbackTarget: null };
  }
  return { previousSafe, rollbackTarget: null };
}

// dispatch 입력 쌍이 그 source commit에 있는 배포 기록과 같은지 본다. tagCommit은 tag가 가리키는 commit이다. tag는 실행
// commit에 붙으므로 통과하는 기록은 그 쌍을 만든 push 실행의 것이다(dispatch 기록은 실행 commit이 source와 같을 때만).
// 쌍은 `pair`로 주거나 image 이름 key(web: `web`·`ingress`)로 준다.
export function matchesRecord(releases, input, stageName = 'web') {
  const { images } = stageOf(stageName);
  const pair = input.pair ?? Object.fromEntries(images.map((name) => [name, input[name]]));
  return records(releases, stageName).some(
    (release) =>
      release.tagCommit === input.sourceCommit &&
      release.record.sourceCommit === input.sourceCommit &&
      samePair(release.record.pair, pair, images),
  );
}

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
}

// 한 단계가 보는 Release 수. 저장소 목록(최신순)에서 그 단계 tag만 세므로 다른 단계 Release가 창을 쓰지 않는다.
export const STAGE_WINDOW = 100;
// 저장소 전체를 한 번에 받는 목록 크기. 두 단계 Release를 합쳐도 이보다 많아지기 전에 다시 본다.
const LIST_LIMIT = 1000;
export function stageReleases(list, stage) {
  const { gitTag } = stageOf(stage);
  return list.filter((release) => gitTag.test(release.tagName)).slice(0, STAGE_WINDOW);
}

// 배포 tag의 Release를 읽는다(GH_TOKEN·GITHUB_REPOSITORY 환경). 공개 저장소라 contents: read로 충분하다.
export function readReleases({ stage = 'web', withTagCommit = false } = {}) {
  const repository = process.env.GITHUB_REPOSITORY;
  const list = stageReleases(
    JSON.parse(
      gh([
        'release',
        'list',
        '--repo',
        repository,
        '--limit',
        String(LIST_LIMIT),
        '--json',
        'tagName,createdAt',
      ]),
    ),
    stage,
  );
  return list.map((release) => ({
    ...release,
    body: JSON.parse(
      gh(['release', 'view', release.tagName, '--repo', repository, '--json', 'body']),
    ).body,
    ...(withTagCommit
      ? {
          tagCommit: gh([
            'api',
            `repos/${repository}/commits/${release.tagName}`,
            '--jq',
            '.sha',
          ]).trim(),
        }
      : {}),
  }));
}

const isDirectExecution = () =>
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

// GITHUB_OUTPUT 줄 이름은 `<prefix>_<image>`이고 image 이름의 `-`는 `_`다(api-migrate → previous_safe_api_migrate).
const pairOutput = (prefix, pair, images) =>
  images.map((name) => `${prefix}_${name.replaceAll('-', '_')}=${pair?.[name] ?? ''}`).join('\n');

if (isDirectExecution()) {
  const [command, file] = process.argv.slice(2);
  const option = (name) =>
    process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  const stage = option('stage') ?? 'web';
  try {
    const { images } = stageOf(stage);
    // image마다 `--<image>=`(digest), `--<image>-sbom=`, `--previous-<image>=`.
    const pairFrom = (format) =>
      Object.fromEntries(images.map((name) => [name, option(format(name))]));
    const inputPair = () => pairFrom((name) => name);
    if (command === 'plan') {
      // GITHUB_OUTPUT 형식. 쌍이 없으면 빈 값이다.
      const plan = planRun(
        { action: option('action'), pair: inputPair() },
        readReleases({ stage }),
        stage,
      );
      console.log(pairOutput('previous_safe', plan.previousSafe, images));
      console.log(pairOutput('rollback', plan.rollbackTarget, images));
    } else if (command === 'match') {
      const input = { sourceCommit: option('source'), pair: inputPair() };
      if (!matchesRecord(readReleases({ stage, withTagCommit: true }), input, stage)) {
        throw new Error(
          'the dispatch pair does not match a deploy record at its attested source commit',
        );
      }
      console.log('dispatch pair matches a deploy record');
    } else if (command === 'attestation-manifest') {
      console.log(attestationManifestDigest(JSON.parse(readFileSync(file, 'utf8'))));
    } else if (command === 'check-sbom') {
      ensure(
        hasSbomLayer(JSON.parse(readFileSync(file, 'utf8'))),
        'the attestation manifest has no SPDX SBOM layer',
      );
      console.log('SBOM layer present');
    } else if (command === 'record') {
      const previousSafe = pairFrom((name) => `previous-${name}`);
      process.stdout.write(
        renderStageRecord({
          stage,
          action: option('action'),
          releaseId: option('release-id'),
          sourceCommit: option('source'),
          pair: inputPair(),
          sbom: pairFrom((name) => `${name}-sbom`),
          event: option('event'),
          runUrl: option('run-url'),
          smoke: option('smoke'),
          previousSafe: Object.values(previousSafe).some(Boolean) ? previousSafe : null,
          operator: option('operator'),
          collectedAt: new Date().toISOString().replace(/\.[0-9]{3}Z$/u, 'Z'),
        }),
      );
    } else if (command === 'tags') {
      const date = new Date();
      const run = option('run-number');
      ensure(/^[0-9]+$/u.test(run ?? ''), 'run number is not a number');
      console.log(`image_tag=${imageDeployTag(date, run)}`);
      console.log(`git_tag=${gitDeployTag(date, run, stage)}`);
    } else {
      console.error(
        'usage: release-record.mjs plan|match|attestation-manifest|check-sbom|record|tags [file] [--stage=web|api] [--options]',
      );
      process.exit(2);
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
