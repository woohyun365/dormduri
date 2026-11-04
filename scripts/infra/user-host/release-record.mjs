#!/usr/bin/env node
// Web CD의 단계 기록(D-WB5·D-WB12). 배포가 성공한 실행마다 record job이 실행 commit(push 실행은 source commit, dispatch
// 실행은 실행한 main commit)에 git tag `deploy-web-<UTC YYYYMMDD>-<run number>`와 GitHub Release를 만들고, 본문과 run 요약에
// 같은 단계 기록을 남긴다. 배포한 source commit은 본문 release_commit_sha다. 형식은
// infra/runbooks/release/production-release-evidence.md "단계 배포 기록"의 YAML template이다.
// deploy job은 이 기록으로 host의 지금 쌍과 직전 안전 쌍을 알고(외부 smoke 실패 때 되돌릴 쌍), dispatch 입력 쌍이 그
// source commit의 기록과 같은지 대조한다(D-WB3). 기록에는 registry host·ARN·node ID 자리가 없고 image는
// `dormduri/<name>@sha256:…`로만 적는다(D-WB7).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ACTIONS = Object.freeze(['deploy', 'rollback', 'maintenance']);
export const IMAGES = Object.freeze(['web', 'ingress']);
const DIGEST = /^sha256:[a-f0-9]{64}$/u;
const COMMIT = /^[a-f0-9]{40}$/u;
const RUN_URL = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/actions\/runs\/[0-9]+$/u;
const SMOKE = /^external smoke \((?:serving|maintenance)\): [0-9]+\/[0-9]+ passed$/u;
const OPERATOR = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})(?:\[bot\])?$/u;
const TIMESTAMP = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$/u;
export const GIT_TAG = /^deploy-web-[0-9]{8}-[0-9]+$/u;
export const SBOM_PREDICATE = 'https://spdx.dev/Document';
export const RECORD_FORMAT = 'infra/runbooks/release/production-release-evidence.md#단계-배포-기록';

// Web 단계가 올리는 component(D-WB9)와 들지 않는 DB 계열(D-WB12). record job은 판정하지 않는다. operator가 evidence를
// 확인한 뒤 Release를 고친다(증거가 빠진 component는 PASS로 적지 않는다).
export const STAGE_COMPONENTS = Object.freeze([
  'Infrastructure target(Web 부분)',
  'Rollback',
  'TLS 만료 경보',
  '외부 가용성',
]);
const NOT_JUDGED = '미판정(operator가 이 run과 evidence를 확인한 뒤 고친다)';
const DB_COMPONENTS = 'DB·migration·role grant·DB credential·backup/restore: 해당 없음(DB 없음)';

const pad = (value) => String(value).padStart(2, '0');
const utcDay = (date) =>
  `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;

// ECR image에 더하는 배포 tag(D-WB3). 숫자 12자리가 이어지지 않게 날짜와 시각 사이에 T를 둔다.
export function imageDeployTag(date, runNumber) {
  return `deploy-${utcDay(date)}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}-${runNumber}`;
}

export function gitDeployTag(date, runNumber) {
  return `deploy-web-${utcDay(date)}-${runNumber}`;
}

const isPair = (pair) =>
  Boolean(pair) && DIGEST.test(pair.web ?? '') && DIGEST.test(pair.ingress ?? '');
const samePair = (left, right) =>
  isPair(left) && isPair(right) && left.web === right.web && left.ingress === right.ingress;
const imageLines = (pair) => IMAGES.map((name) => `  - dormduri/${name}@${pair[name]}`);

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
  ensure(ACTIONS.includes(action), `unknown action: ${action}`);
  ensure(GIT_TAG.test(releaseId ?? ''), 'release ID is not a deploy-web tag');
  ensure(COMMIT.test(sourceCommit ?? ''), 'source commit is not a full SHA');
  ensure(isPair(pair), 'the image pair is not two sha256 digests');
  ensure(
    IMAGES.every((name) => DIGEST.test(sbom?.[name] ?? '')),
    'an SBOM manifest digest is missing',
  );
  ensure(['push', 'workflow_dispatch'].includes(event), `unknown event: ${event}`);
  ensure(RUN_URL.test(runUrl ?? ''), 'run URL is not a workflow run URL');
  ensure(SMOKE.test(smoke ?? ''), 'smoke is not an external smoke summary');
  ensure(previousSafe === null || isPair(previousSafe), 'previous safe pair is malformed');
  ensure(OPERATOR.test(operator ?? ''), 'operator is not a GitHub account name');
  ensure(TIMESTAMP.test(collectedAt ?? ''), 'collected_at is not a UTC timestamp');

  const provenance =
    event === 'push' ? 'provenance 생성·검증 통과' : 'provenance 검증·배포 기록 대조 통과';
  const rollbackCheck = {
    deploy: '확인 전(rollback 실행의 Release가 기록)',
    rollback: `이 실행이 host의 직전 쌍으로 되돌리고 외부 smoke 통과(${runUrl})`,
    maintenance: '해당 없음(점검 mode)',
  }[action];
  const previous =
    previousSafe === null
      ? [
          `previous_safe: ${action === 'rollback' ? '없음(rollback 뒤 host가 직전 쌍을 비움)' : '없음(첫 배포)'}`,
        ]
      : ['previous_safe:', ...imageLines(previousSafe)];
  return [
    `Web 단계 배포 기록. 형식: ${RECORD_FORMAT}`,
    '',
    '```yaml',
    'stage: web',
    `action: ${action}`,
    `release_id: ${releaseId}`,
    `release_commit_sha: ${sourceCommit}`,
    'images:',
    ...imageLines(pair),
    'attestation:',
    ...IMAGES.map(
      (name) =>
        `  - dormduri/${name}: ${provenance}(signer .github/workflows/web-cd.yml, refs/heads/main), SBOM attestation manifest ${sbom[name]}`,
    ),
    `  - run: ${runUrl}`,
    'components:',
    ...STAGE_COMPONENTS.map((name) => `  - ${name}: ${NOT_JUDGED}`),
    `  - ${DB_COMPONENTS}`,
    `smoke: ${smoke}, host 내부 smoke 통과(SSM command Success)`,
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

// 단계 기록에서 동작·source commit·image 쌍·직전 안전 쌍을 읽는다. 형식이 다르면 null이다.
export function parseStageRecord(body) {
  const yaml = /```yaml\n([\s\S]*?)```/u.exec(body ?? '')?.[1];
  if (!yaml) return null;
  const value = (key) => new RegExp(`^${key}: (.*)$`, 'mu').exec(yaml)?.[1]?.trim();
  const list = (key) => {
    const block = new RegExp(`^${key}:\\n((?: {2}- .+\\n)+)`, 'mu').exec(yaml)?.[1] ?? '';
    const pair = {};
    for (const match of block.matchAll(
      /^ {2}- dormduri\/(web|ingress)@(sha256:[a-f0-9]{64})$/gmu,
    )) {
      pair[match[1]] = match[2];
    }
    return isPair(pair) ? pair : null;
  };
  const action = value('action');
  const sourceCommit = value('release_commit_sha');
  const pair = list('images');
  if (
    value('stage') !== 'web' ||
    !ACTIONS.includes(action) ||
    !COMMIT.test(sourceCommit ?? '') ||
    !pair
  ) {
    return null;
  }
  return { action, sourceCommit, pair, previousSafe: list('previous_safe') };
}

function records(releases) {
  return releases
    .filter((release) => GIT_TAG.test(release.tagName))
    .map((release) => ({ ...release, record: parseStageRecord(release.body) }))
    .filter((release) => release.record)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

// 마지막 deploy·rollback 기록이 host의 지금 쌍(current)과 직전 안전 쌍(host previous)이다. maintenance는 둘을 바꾸지 않는다.
export function servingState(releases) {
  const latest = records(releases).find((release) => release.record.action !== 'maintenance');
  return {
    current: latest?.record.pair ?? null,
    previousSafe: latest?.record.previousSafe ?? null,
  };
}

// 이 실행 뒤 host previous가 될 쌍(단계 기록의 previous_safe)과, deploy가 외부 smoke에서 실패했을 때 되돌릴 쌍.
// host 배포 script(infra/deploy/user/ssm/deploy.sh)와 같은 규칙이다: deploy는 다른 쌍을 올리면 current를 previous로 두고,
// 같은 쌍이면 previous를 그대로 둔다. rollback은 previous와 같은 쌍만 받고 성공하면 previous를 비운다.
export function planRun({ action, pair }, releases) {
  ensure(ACTIONS.includes(action), `unknown action: ${action}`);
  ensure(isPair(pair), 'the image pair is not two sha256 digests');
  const { current, previousSafe } = servingState(releases);
  if (action === 'deploy') {
    const previous = current && !samePair(current, pair) ? current : previousSafe;
    return { previousSafe: previous, rollbackTarget: previous };
  }
  if (action === 'rollback') {
    ensure(
      samePair(previousSafe, pair),
      'a rollback must name the previous_safe pair of the latest deploy record',
    );
    return { previousSafe: null, rollbackTarget: null };
  }
  return { previousSafe, rollbackTarget: null };
}

// dispatch 입력 쌍이 그 source commit에 있는 배포 기록과 같은지 본다. tagCommit은 tag가 가리키는 commit이다. tag는 실행
// commit에 붙으므로 통과하는 기록은 그 쌍을 만든 push 실행의 것이다(dispatch 기록은 실행 commit이 source와 같을 때만).
export function matchesRecord(releases, { sourceCommit, web, ingress }) {
  return records(releases).some(
    (release) =>
      release.tagCommit === sourceCommit &&
      release.record.sourceCommit === sourceCommit &&
      samePair(release.record.pair, { web, ingress }),
  );
}

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
}

// 배포 tag의 Release를 읽는다(GH_TOKEN·GITHUB_REPOSITORY 환경). 공개 저장소라 contents: read로 충분하다.
export function readReleases({ withTagCommit = false } = {}) {
  const repository = process.env.GITHUB_REPOSITORY;
  const list = JSON.parse(
    gh(['release', 'list', '--repo', repository, '--limit', '100', '--json', 'tagName,createdAt']),
  ).filter((release) => GIT_TAG.test(release.tagName));
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

const pairOutput = (prefix, pair) =>
  IMAGES.map((name) => `${prefix}_${name}=${pair?.[name] ?? ''}`).join('\n');

if (isDirectExecution()) {
  const [command, file] = process.argv.slice(2);
  const option = (name) =>
    process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  const inputPair = () => ({ web: option('web'), ingress: option('ingress') });
  try {
    if (command === 'plan') {
      // GITHUB_OUTPUT 형식. 쌍이 없으면 빈 값이다.
      const plan = planRun({ action: option('action'), pair: inputPair() }, readReleases());
      console.log(pairOutput('previous_safe', plan.previousSafe));
      console.log(pairOutput('rollback', plan.rollbackTarget));
    } else if (command === 'match') {
      const input = { sourceCommit: option('source'), ...inputPair() };
      if (!matchesRecord(readReleases({ withTagCommit: true }), input)) {
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
      const previousSafe = { web: option('previous-web'), ingress: option('previous-ingress') };
      process.stdout.write(
        renderStageRecord({
          action: option('action'),
          releaseId: option('release-id'),
          sourceCommit: option('source'),
          pair: inputPair(),
          sbom: { web: option('web-sbom'), ingress: option('ingress-sbom') },
          event: option('event'),
          runUrl: option('run-url'),
          smoke: option('smoke'),
          previousSafe: previousSafe.web || previousSafe.ingress ? previousSafe : null,
          operator: option('operator'),
          collectedAt: new Date().toISOString().replace(/\.[0-9]{3}Z$/u, 'Z'),
        }),
      );
    } else if (command === 'tags') {
      const date = new Date();
      const run = option('run-number');
      ensure(/^[0-9]+$/u.test(run ?? ''), 'run number is not a number');
      console.log(`image_tag=${imageDeployTag(date, run)}`);
      console.log(`git_tag=${gitDeployTag(date, run)}`);
    } else {
      console.error(
        'usage: release-record.mjs plan|match|attestation-manifest|check-sbom|record|tags [file] [--options]',
      );
      process.exit(2);
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
