import assert from 'node:assert/strict';
import test from 'node:test';

import {
  API_DEPLOY_PATH_CASES,
  API_GUARD_CASES,
  DEPLOY_PATH_CASES,
  DOCUMENT_GUARD_CASES,
  judgeApiDeployPathOutput,
  judgeApiGuardOutput,
  judgeDeployPathOutput,
  judgeGuardOutput,
  parseCaseLines,
} from './ssm-document-runtime.mjs';

// The harness prints `case=<name> <key>=<value> ... out=<last RESULT line>`; a RESULT line from `say` starts with a UTC time.
const passingOutput = (cases) =>
  cases
    .map(({ name, result, ...fields }) => {
      const pairs = Object.entries(fields).map(([key, value]) => `${key}=${value}`);
      const out = result.startsWith('RESULT=failed') ? `2026-11-03T00:00:00Z ${result}` : result;
      return `case=${name} ${pairs.join(' ')} extra=ignored out=${out} web=sha256:x`;
    })
    .join('\n');

const assertCaught = (judge, passing, cases) => {
  for (const [change, expected] of cases) {
    const problems = judge(change(passing));
    assert.ok(
      problems.some((problem) => expected.test(problem)),
      `${expected}: ${problems.join(' | ')}`,
    );
  }
};

test('the case line parser keeps every field and strips the RESULT time', () => {
  const results = parseCaseLines(
    'noise\ncase=a exit=1 current=2 out=2026-11-03T00:00:00Z RESULT=failed action=deploy reason=x',
  );
  assert.deepEqual(results.get('a'), {
    exit: '1',
    current: '2',
    result: 'RESULT=failed action=deploy reason=x',
  });
  assert.equal(results.size, 1);
});

test('each judgment accepts the expected exit codes, RESULT lines and host state', () => {
  for (const [judge, cases] of [
    [judgeGuardOutput, DOCUMENT_GUARD_CASES],
    [judgeDeployPathOutput, DEPLOY_PATH_CASES],
    [judgeApiGuardOutput, API_GUARD_CASES],
    [judgeApiDeployPathOutput, API_DEPLOY_PATH_CASES],
  ]) {
    assert.deepEqual(judge(passingOutput(cases)), []);
  }
});

test('the web guard judgment fails closed on a missing case, a different exit or an early release write', () => {
  assertCaught(judgeGuardOutput, passingOutput(DOCUMENT_GUARD_CASES), [
    [(out) => out.replace(/^case=locked.*$/mu, ''), /locked: no result/u],
    [(out) => out.replace('case=locked exit=75', 'case=locked exit=1'), /locked: exit 1 != 75/u],
    [
      (out) => out.replace('reason=action', 'reason=digest'),
      /action: "RESULT=rejected reason=digest[^"]*" does not start with/u,
    ],
    // A longer reason is a different reason, not a match by prefix.
    [
      (out) => out.replace('reason=tls-missing', 'reason=tls-missing-key'),
      /tls-missing: .* does not start with/u,
    ],
    [(out) => out.replace('written=no', 'written=yes'), /release-before-tls: written yes != no/u],
  ]);
});

test('the web deploy path judgment fails closed on a lost rollback, a lost adoption or an API service call', () => {
  assertCaught(judgeDeployPathOutput, passingOutput(DEPLOY_PATH_CASES), [
    [
      (out) => out.replace(/^case=smoke-failure-rolls-back.*$/mu, ''),
      /smoke-failure-rolls-back: no result/u,
    ],
    [
      (out) =>
        out.replace('case=start-failure-rolls-back exit=1', 'case=start-failure-rolls-back exit=0'),
      /start-failure-rolls-back: exit 0 != 1/u,
    ],
    [
      (out) => out.replace(/(case=smoke-failure-rolls-back .*?)current=2/u, '$1current=4'),
      /smoke-failure-rolls-back: current 4 != 2/u,
    ],
    [
      (out) => out.replace(/(case=second-deploy .*?)previous=1/u, '$1previous=none'),
      /second-deploy: previous none != 1/u,
    ],
    [
      (out) =>
        out.replace(/(case=first-deploy-failure-enters-maintenance .*?)flag=yes/u, '$1flag=no'),
      /first-deploy-failure-enters-maintenance: flag no != yes/u,
    ],
    [
      (out) => out.replace('reason=previous-mismatch', 'reason=pull'),
      /rollback-mismatch: .* does not start with/u,
    ],
    [
      (out) => out.replace(/(case=legacy-adopt-deploy .*?)pfrag=legacy/u, '$1pfrag=none'),
      /legacy-adopt-deploy: pfrag none != legacy/u,
    ],
    [
      (out) => out.replace(/(case=legacy-rollback .*?)cfrag=legacy/u, '$1cfrag=release'),
      /legacy-rollback: cfrag release != legacy/u,
    ],
    [
      (out) => out.replace(/(case=with-api-current .*?)apisvc=no/u, '$1apisvc=yes'),
      /with-api-current: apisvc yes != no/u,
    ],
    [
      (out) => out.replace(/(case=network-mismatch .*?)composed=no/u, '$1composed=yes'),
      /network-mismatch: composed yes != no/u,
    ],
  ]);
});

test('the API guard judgment fails closed when Secrets Manager or AWS is reached before a guard', () => {
  assertCaught(judgeApiGuardOutput, passingOutput(API_GUARD_CASES), [
    [
      (out) => out.replace(/(case=web-record-legacy .*?)aws=no/u, '$1aws=yes'),
      /web-record-legacy: aws yes != no/u,
    ],
    [(out) => out.replace(/^case=web-maintenance.*$/mu, ''), /web-maintenance: no result/u],
  ]);
});

test('the API deploy path judgment fails closed on a rollout after a failed step, a kept secret or a leaked value', () => {
  assertCaught(judgeApiDeployPathOutput, passingOutput(API_DEPLOY_PATH_CASES), [
    [
      (out) =>
        out.replace(/(case=outbox-rows-stop-before-rollout .*?)stopped=no/u, '$1stopped=yes'),
      /outbox-rows-stop-before-rollout: stopped yes != no/u,
    ],
    [
      (out) => out.replace(/(case=outbox-rows-stop-before-rollout .*?)running=1/u, '$1running=2'),
      /outbox-rows-stop-before-rollout: running 2 != 1/u,
    ],
    [
      (out) =>
        out.replace(
          /(case=secret-mode-violation-stops-before-migrate .*?)steps=none/u,
          '$1steps=migrate',
        ),
      /secret-mode-violation-stops-before-migrate: steps migrate != none/u,
    ],
    [
      (out) => out.replace(/(case=migration-secret-failure .*?)migratedir=0/u, '$1migratedir=1'),
      /migration-secret-failure: migratedir 1 != 0/u,
    ],
    [
      (out) => out.replace(/(case=secret-fetch-failure .*?)secrets=1/u, '$1secrets=2'),
      /secret-fetch-failure: secrets 2 != 1/u,
    ],
    [
      (out) =>
        out.replace(
          /(case=first-deploy .*?)steps=migrate,grant,smoke,outbox/u,
          '$1steps=migrate,grant,smoke',
        ),
      /first-deploy: steps migrate,grant,smoke != migrate,grant,smoke,outbox/u,
    ],
    [
      (out) => out.replace(/(case=rollback .*?)steps=none/u, '$1steps=migrate,grant,smoke,outbox'),
      /rollback: steps .* != none/u,
    ],
    [(out) => out.replace(/(case=rollback .*?)cfrag=1/u, '$1cfrag=3'), /rollback: cfrag 3 != 1/u],
    [
      (out) => out.replace('found=no', 'found=yes'),
      /secret-values-stay-off-output: found yes != no/u,
    ],
  ]);
});
