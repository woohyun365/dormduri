import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { scanText } from './public-record-scan.mjs';
import {
  attestationManifestDigest,
  gitDeployTag,
  hasSbomLayer,
  imageDeployTag,
  matchesRecord,
  parseStageRecord,
  planRun,
  renderStageRecord,
  servingState,
  STAGE_WINDOW,
  stageReleases,
} from './release-record.mjs';

const repoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const digest = (character) => `sha256:${character.repeat(64)}`;
const commit = (character) => character.repeat(40);
const pair = (web, ingress) => ({ web: digest(web), ingress: digest(ingress) });
const runUrl = 'https://github.com/woohyun365/dormduri/actions/runs/41573137218';
const input = (overrides = {}) => ({
  action: 'deploy',
  releaseId: 'deploy-web-20261103-42',
  sourceCommit: commit('c'),
  pair: pair('a', 'b'),
  sbom: { web: digest('5'), ingress: digest('6') },
  event: 'push',
  runUrl,
  smoke: 'external smoke (serving): 21/21 passed',
  previousSafe: pair('d', 'e'),
  operator: 'woohyun365',
  collectedAt: '2026-11-03T05:40:00Z',
  ...overrides,
});
let created = 0;
const release = (overrides = {}, tagCommit = commit('c')) => {
  created += 1;
  return {
    tagName: `deploy-web-20261103-${created}`,
    createdAt: `2026-11-03T0${Math.min(created, 9)}:00:00Z`,
    tagCommit,
    body: renderStageRecord(input(overrides)),
  };
};

test('deploy tags follow D-WB3·D-WB5 names in UTC and never form a 12-digit run', () => {
  const date = new Date('2026-10-27T15:30:59Z');
  assert.equal(imageDeployTag(date, 42), 'deploy-20261027T1530-42');
  assert.equal(gitDeployTag(date, 42), 'deploy-web-20261027-42');
  assert.equal(imageDeployTag(new Date('2026-01-02T03:04:00+09:00'), 7), 'deploy-20260101T1804-7');
  assert.doesNotMatch(imageDeployTag(date, 123456), /[0-9]{12}/u);
});

test('the stage record has the template fields in order and passes the public record scan', () => {
  const evidence = readFileSync(
    resolve(repoRoot, 'infra/runbooks/release/production-release-evidence.md'),
    'utf8',
  );
  const template = /## 단계 배포 기록[\s\S]*?```yaml\n([\s\S]*?)```/u.exec(evidence)[1];
  const fields = (yaml) => yaml.match(/^[a-z_]+(?=:)/gmu);
  const body = renderStageRecord(input());
  const yaml = /```yaml\n([\s\S]*?)```/u.exec(body)[1];
  assert.deepEqual(fields(yaml), fields(template));
  for (const line of [
    'stage: web',
    'aggregate_state: COLLECTING',
    'final_decision: PENDING_TARGET',
    'redaction_confirmed: true',
    `  - dormduri/web@${digest('a')}`,
    `  - dormduri/ingress@${digest('b')}`,
    `  - run: ${runUrl}`,
  ]) {
    assert.ok(yaml.split('\n').includes(line), line);
  }
  assert.doesNotMatch(yaml, /: PASS\b/u, 'the record job never judges a component');
  assert.match(yaml, /SBOM attestation manifest sha256:5{64}/u);
  assert.deepEqual(scanText(body), []);
});

test('the stage record refuses values outside the fixed forms', () => {
  for (const overrides of [
    { action: 'restart' },
    { releaseId: 'v1.0.0' },
    { sourceCommit: 'main' },
    { pair: { web: 'dormduri/web:latest', ingress: digest('b') } },
    { sbom: { web: digest('5') } },
    { event: 'schedule' },
    { runUrl: 'https://example.org/run/1' },
    { smoke: 'external smoke (serving): 21/21 passed\nrelease_commit_sha: x' },
    { operator: 'owner@example.org' },
    { collectedAt: 'yesterday' },
    { previousSafe: { web: digest('d') } },
  ]) {
    assert.throws(() => renderStageRecord(input(overrides)), JSON.stringify(overrides));
  }
});

test('the stage record parses back to its action, source, pair and previous safe pair', () => {
  assert.deepEqual(parseStageRecord(renderStageRecord(input())), {
    action: 'deploy',
    sourceCommit: commit('c'),
    pair: pair('a', 'b'),
    previousSafe: pair('d', 'e'),
  });
  assert.equal(
    parseStageRecord(renderStageRecord(input({ previousSafe: null }))).previousSafe,
    null,
  );
  assert.match(renderStageRecord(input({ previousSafe: null })), /previous_safe: 없음\(첫 배포\)/u);
  assert.equal(parseStageRecord('action: deploy\n'), null);
});

test('serving state follows the host rules for deploy, redeploy, rollback and maintenance', () => {
  const first = release({ previousSafe: null });
  assert.deepEqual(servingState([]), { current: null, previousSafe: null });
  assert.deepEqual(planRun({ action: 'deploy', pair: pair('a', 'b') }, []), {
    previousSafe: null,
    rollbackTarget: null,
  });
  // A new pair after the first deploy keeps the first pair as the rollback target.
  assert.deepEqual(
    planRun({ action: 'deploy', pair: pair('f', 'b') }, [first]).rollbackTarget,
    pair('a', 'b'),
  );
  // A redeploy of the serving pair keeps the host previous pair unchanged.
  const second = release({ pair: pair('f', 'b'), previousSafe: pair('a', 'b') });
  assert.deepEqual(
    planRun({ action: 'deploy', pair: pair('f', 'b') }, [first, second]).rollbackTarget,
    pair('a', 'b'),
  );
  // A rollback must name the previous safe pair and clears it.
  assert.throws(() => planRun({ action: 'rollback', pair: pair('9', '9') }, [first, second]));
  assert.deepEqual(planRun({ action: 'rollback', pair: pair('a', 'b') }, [first, second]), {
    previousSafe: null,
    rollbackTarget: null,
  });
  // A maintenance record changes neither the serving pair nor the previous safe pair.
  const rolledBack = release({ action: 'rollback', previousSafe: null });
  const maintenance = release({ action: 'maintenance', pair: pair('7', '7'), previousSafe: null });
  assert.deepEqual(servingState([first, second, rolledBack, maintenance]), {
    current: pair('a', 'b'),
    previousSafe: null,
  });
  assert.equal(
    planRun({ action: 'deploy', pair: pair('a', 'b') }, [first, second, rolledBack]).rollbackTarget,
    null,
  );
  // Releases outside the deploy tag pattern are not records.
  assert.deepEqual(servingState([{ ...first, tagName: 'v1.0.0' }]).current, null);
});

test('a dispatch pair matches only a record whose tag points at the attested source commit', () => {
  const recorded = release();
  const dispatch = { sourceCommit: commit('c'), web: digest('a'), ingress: digest('b') };
  assert.equal(matchesRecord([recorded], dispatch), true);
  assert.equal(matchesRecord([recorded], { ...dispatch, web: digest('9') }), false);
  assert.equal(matchesRecord([recorded], { ...dispatch, sourceCommit: commit('d') }), false);
  assert.equal(matchesRecord([{ ...recorded, tagCommit: commit('d') }], dispatch), false);
  assert.equal(matchesRecord([{ ...recorded, tagName: 'release-1' }], dispatch), false);
});

test('a dispatch record tagged at its run commit feeds the serving state and vouches only when tag and source match', () => {
  // The record job tags the run commit. A dispatch run's commit is the main head it ran from, so a
  // later dispatch of the pair matches its push record, or a dispatch record whose run commit was the source.
  const sourceA = commit('c');
  const sourceB = commit('f');
  const runCommit = commit('9');
  const at = (hour) => `2026-11-04T${hour}:00:00Z`;
  const pushA = { ...release({ previousSafe: null }, sourceA), createdAt: at('10') };
  const pushB = {
    ...release(
      { sourceCommit: sourceB, pair: pair('f', '1'), previousSafe: pair('a', 'b') },
      sourceB,
    ),
    createdAt: at('11'),
  };
  const rollbackA = {
    ...release({ action: 'rollback', event: 'workflow_dispatch', previousSafe: null }, runCommit),
    createdAt: at('12'),
  };
  const releases = [pushA, pushB, rollbackA];
  const dispatchA = { sourceCommit: sourceA, web: digest('a'), ingress: digest('b') };
  assert.deepEqual(servingState(releases), { current: pair('a', 'b'), previousSafe: null });
  assert.equal(matchesRecord(releases, dispatchA), true);
  assert.equal(matchesRecord([rollbackA], dispatchA), false);
  // A dispatch record tagged at the run commit R never vouches for its pair at R itself.
  assert.equal(matchesRecord([rollbackA], { ...dispatchA, sourceCommit: runCommit }), false);
  // A dispatch run from the source commit itself tags that commit and matches like a push record.
  assert.equal(matchesRecord([{ ...rollbackA, tagCommit: sourceA }], dispatchA), true);
  assert.deepEqual(planRun({ action: 'deploy', pair: pair('f', '1') }, releases), {
    previousSafe: pair('a', 'b'),
    rollbackTarget: pair('a', 'b'),
  });
});

test('the SBOM check reads the BuildKit index and attestation manifest shapes', () => {
  const image = { mediaType: 'application/vnd.oci.image.manifest.v1+json', digest: digest('1') };
  const attestation = {
    mediaType: 'application/vnd.oci.image.manifest.v1+json',
    digest: digest('2'),
    annotations: {
      'vnd.docker.reference.digest': digest('1'),
      'vnd.docker.reference.type': 'attestation-manifest',
    },
  };
  assert.equal(attestationManifestDigest({ manifests: [image, attestation] }), digest('2'));
  assert.throws(() => attestationManifestDigest({ manifests: [image] }));
  assert.throws(() =>
    attestationManifestDigest({
      manifests: [image, { ...image, digest: digest('3') }, attestation],
    }),
  );
  assert.throws(() =>
    attestationManifestDigest({
      manifests: [
        image,
        {
          ...attestation,
          annotations: { ...attestation.annotations, 'vnd.docker.reference.digest': digest('3') },
        },
      ],
    }),
  );
  const layer = {
    mediaType: 'application/vnd.in-toto+json',
    annotations: { 'in-toto.io/predicate-type': 'https://spdx.dev/Document' },
  };
  assert.equal(hasSbomLayer({ layers: [layer] }), true);
  assert.equal(
    hasSbomLayer({
      layers: [
        {
          ...layer,
          annotations: { 'in-toto.io/predicate-type': 'https://slsa.dev/provenance/v1' },
        },
      ],
    }),
    false,
  );
});

// API 단계(production-api-baseline D-AB12·D-AB14·D-AB17). 같은 helper가 `--stage=api`로 API 묶음(api·api-migrate·
// observability-config)의 기록을 쓰고 읽는다. 두 단계의 Release는 tag 이름으로 갈려 서로의 지금 쌍·직전 쌍 계산에 들지 않는다.
// 관측 설정 digest는 묶음마다 같은 값(9)으로 두고, 그 digest만 다른 묶음은 따로 본다.
const apiPair = (api, migrate, observability = '9') => ({
  api: digest(api),
  'api-migrate': digest(migrate),
  'observability-config': digest(observability),
});
const apiInput = (overrides = {}) =>
  input({
    stage: 'api',
    releaseId: 'deploy-api-20261111-7',
    pair: apiPair('a', 'b'),
    sbom: { api: digest('5'), 'api-migrate': digest('6'), 'observability-config': digest('7') },
    previousSafe: apiPair('d', 'e'),
    ...overrides,
  });
let apiCreated = 0;
const apiRelease = (overrides = {}, tagCommit = commit('c')) => {
  apiCreated += 1;
  return {
    tagName: `deploy-api-20261111-${apiCreated}`,
    createdAt: `2026-11-11T0${Math.min(apiCreated, 9)}:30:00Z`,
    tagCommit,
    body: renderStageRecord(apiInput(overrides)),
  };
};
const yamlOf = (body) => /```yaml\n([\s\S]*?)```/u.exec(body)[1];

test('the API stage record keeps the template fields, names the API pair and passes the public record scan', () => {
  const evidence = readFileSync(
    resolve(repoRoot, 'infra/runbooks/release/production-release-evidence.md'),
    'utf8',
  );
  const template = /## 단계 배포 기록[\s\S]*?```yaml\n([\s\S]*?)```/u.exec(evidence)[1];
  const fields = (yaml) => yaml.match(/^[a-z_]+(?=:)/gmu);
  for (const action of ['deploy', 'rollback', 'maintenance']) {
    const body = renderStageRecord(apiInput({ action }));
    const yaml = yamlOf(body);
    assert.deepEqual(fields(yaml), fields(template), action);
    for (const line of [
      'stage: api',
      `release_id: deploy-api-20261111-7`,
      `  - dormduri/api@${digest('a')}`,
      `  - dormduri/api-migrate@${digest('b')}`,
      `  - dormduri/observability-config@${digest('9')}`,
      `  - run: ${runUrl}`,
      'aggregate_state: COLLECTING',
      'final_decision: PENDING_TARGET',
    ]) {
      assert.ok(yaml.split('\n').includes(line), `${action}: ${line}`);
    }
    assert.match(yaml, /signer \.github\/workflows\/api-cd\.yml, refs\/heads\/main/u);
    // host 안 smoke는 deploy·rollback만 돈다. maintenance는 API를 내리기만 해 그 통과를 적지 않는다.
    const smoke = yaml.split('\n').find((line) => line.startsWith('smoke: '));
    if (action === 'maintenance') {
      assert.match(smoke, /host 안 smoke 해당 없음\(API를 내림/u, action);
      assert.doesNotMatch(smoke, /readiness|metrics 닫힘|smoke 통과/u, action);
    } else {
      assert.match(
        smoke,
        /host 내부 smoke 통과\(SSM command Success: readiness, private listener 공개 열람 응답, metrics 닫힘\)/u,
        action,
      );
    }
    assert.doesNotMatch(yaml, /web-cd\.yml|dormduri\/(?:web|ingress)@/u, action);
    assert.doesNotMatch(yaml, /: PASS\b/u, 'the record job never judges a component');
    assert.match(body, /^API 단계 배포 기록\. 형식: /u);
    assert.deepEqual(scanText(body), [], action);
  }
});

test('API deploy records leave the DB components to the operator and other runs mark them unchanged (D-AB17)', () => {
  const components = (body) => {
    const yaml = yamlOf(body);
    return yaml
      .slice(yaml.indexOf('components:\n'), yaml.indexOf('\nsmoke: '))
      .split('\n')
      .slice(1);
  };
  const deploy = components(renderStageRecord(apiInput()));
  for (const name of [
    'Infrastructure target(API 부분)',
    'API Secrets Manager',
    'Lightsail runtime(API 묶음)',
    'Rollback',
    'DB migration·role grant·role smoke',
    'DB credential',
    'DB backup/restore',
  ]) {
    assert.ok(
      deploy.some((line) => line.startsWith(`  - ${name}: 미판정`)),
      `deploy: ${name} starts unjudged`,
    );
  }
  assert.ok(
    deploy.some((line) => /DB migration·role grant·role smoke: .*migrateStarted/u.test(line)),
    'the operator copies the migrate start time (UTC) from the host RESULT line',
  );
  for (const action of ['rollback', 'maintenance']) {
    const lines = components(renderStageRecord(apiInput({ action })));
    const db = lines.filter((line) => /\bDB\b/u.test(line));
    assert.deepEqual(
      db,
      [
        '  - DB migration·role grant·DB credential·backup/restore: 해당 없음(이 실행은 DB를 바꾸지 않음)',
      ],
      action,
    );
  }
  // 관측 component: deploy·rollback은 operator가 host RESULT 줄의 observability 값으로 판정하고, maintenance는 관측을 바꾸지 않는다.
  for (const action of ['deploy', 'rollback']) {
    const line = components(renderStageRecord(apiInput({ action }))).find((item) =>
      item.startsWith('  - 관측 stack'),
    );
    assert.match(
      line,
      /^ {2}- 관측 stack\(Prometheus·Loki·Alloy·Alertmanager·Grafana\)·Slack 경보·host 지표: 미판정\(/u,
    );
    assert.match(line, /observability 값/u, action);
  }
  assert.ok(
    components(renderStageRecord(apiInput({ action: 'maintenance' }))).includes(
      '  - 관측 stack: 해당 없음(이 실행은 관측을 바꾸지 않음)',
    ),
  );
  // A Web deploy never changes the DB, also after the API stage brought it in.
  const web = components(renderStageRecord(input()));
  assert.deepEqual(
    web.filter((line) => /\bDB\b/u.test(line)),
    [
      '  - DB·migration·role grant·DB credential·backup/restore: 해당 없음(이 실행은 DB를 바꾸지 않음)',
    ],
  );
});

test('the API stage refuses the Web release ID, image names and SBOM keys', () => {
  for (const [overrides, reason] of [
    [{ releaseId: 'deploy-web-20261111-7' }, /release ID is not a deploy-api tag/u],
    [{ pair: pair('a', 'b') }, /image pair is not api and api-migrate and observability-config/u],
    [
      { pair: { api: digest('a') } },
      /image pair is not api and api-migrate and observability-config/u,
    ],
    [
      { pair: { api: digest('a'), 'api-migrate': digest('b') } },
      /image pair is not api and api-migrate and observability-config/u,
    ],
    [
      { sbom: { api: digest('5'), 'api-migrate': digest('6') } },
      /SBOM manifest digest is missing/u,
    ],
    [{ sbom: { web: digest('5'), ingress: digest('6') } }, /SBOM manifest digest is missing/u],
    [{ previousSafe: pair('d', 'e') }, /previous safe pair is malformed/u],
    [{ stage: 'backoffice' }, /unknown stage: backoffice/u],
  ]) {
    assert.throws(() => renderStageRecord(apiInput(overrides)), reason, JSON.stringify(overrides));
  }
  assert.throws(
    () => renderStageRecord(input({ releaseId: 'deploy-api-20261103-42' })),
    /release ID is not a deploy-web tag/u,
  );
});

// 두 단계의 Release가 저장소 목록 하나에 섞인다. 한 단계의 창(최근 STAGE_WINDOW개)은 그 단계 tag만 세므로 다른 단계 Release가
// 많이 쌓여도 지금 묶음·직전 묶음과 dispatch 대조 기록을 잃지 않는다.
test('a stage keeps its own recent Releases however many the other stage adds', () => {
  const tag = (stage, n) => ({ tagName: `deploy-${stage}-20261111-${n}`, createdAt: '' });
  const newestFirst = [
    ...Array.from({ length: 150 }, (_, n) => tag('web', 300 - n)),
    tag('api', 2),
    tag('api', 1),
    ...Array.from({ length: STAGE_WINDOW + 5 }, (_, n) => tag('web', 100 - n)),
  ];
  assert.deepEqual(
    stageReleases(newestFirst, 'api').map((release) => release.tagName),
    ['deploy-api-20261111-2', 'deploy-api-20261111-1'],
  );
  const web = stageReleases(newestFirst, 'web');
  assert.equal(web.length, STAGE_WINDOW);
  assert.equal(web[0].tagName, 'deploy-web-20261111-300');
  assert.ok(web.every((release) => release.tagName.startsWith('deploy-web-')));
  assert.throws(() => stageReleases(newestFirst, 'backoffice'), /unknown stage: backoffice/u);
});

test('each stage parses and plans only its own Releases', () => {
  const apiFirst = apiRelease({ previousSafe: null });
  const webFirst = release({ previousSafe: null });
  const apiBody = apiFirst.body;
  assert.deepEqual(parseStageRecord(apiBody, 'api'), {
    action: 'deploy',
    sourceCommit: commit('c'),
    pair: apiPair('a', 'b'),
    previousSafe: null,
  });
  assert.equal(parseStageRecord(apiBody, 'web'), null);
  assert.equal(parseStageRecord(apiBody), null, 'the default stage is web');
  assert.equal(parseStageRecord(webFirst.body, 'api'), null);
  const mixed = [webFirst, apiFirst];
  assert.deepEqual(servingState(mixed, 'api'), { current: apiPair('a', 'b'), previousSafe: null });
  assert.deepEqual(servingState(mixed, 'web'), { current: pair('a', 'b'), previousSafe: null });
  assert.deepEqual(
    planRun({ action: 'deploy', pair: apiPair('f', 'b') }, mixed, 'api').rollbackTarget,
    apiPair('a', 'b'),
  );
  assert.throws(() => planRun({ action: 'deploy', pair: pair('f', 'b') }, mixed, 'api'));
  // 관측 설정 digest만 바뀐 배포도 다른 묶음이라 host current가 직전 안전 묶음이 된다(rollback이 그 설정으로 되돌린다).
  assert.deepEqual(
    planRun({ action: 'deploy', pair: apiPair('a', 'b', '8') }, mixed, 'api').rollbackTarget,
    apiPair('a', 'b'),
  );
  const second = apiRelease({ pair: apiPair('f', 'b'), previousSafe: apiPair('a', 'b') });
  assert.deepEqual(
    planRun({ action: 'rollback', pair: apiPair('a', 'b') }, [...mixed, second], 'api'),
    {
      previousSafe: null,
      rollbackTarget: null,
    },
  );
  // A Web Release with the same tag time never vouches for an API dispatch, and the other way round.
  const dispatch = { sourceCommit: commit('c'), pair: apiPair('a', 'b') };
  assert.equal(matchesRecord(mixed, dispatch, 'api'), true);
  assert.equal(matchesRecord([webFirst], dispatch, 'api'), false);
  assert.equal(
    matchesRecord([apiFirst], {
      sourceCommit: commit('c'),
      web: digest('a'),
      ingress: digest('b'),
    }),
    false,
  );
  assert.equal(gitDeployTag(new Date('2026-11-11T15:30:00Z'), 7, 'api'), 'deploy-api-20261111-7');
  assert.throws(() => gitDeployTag(new Date('2026-11-11T15:30:00Z'), 7, 'backoffice'));
});
