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
