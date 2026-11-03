import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEPLOY_PATH_CASES,
  DOCUMENT_GUARD_CASES,
  judgeDeployPathOutput,
  judgeGuardOutput,
} from './ssm-document-runtime.mjs';

const passing = [
  ...DOCUMENT_GUARD_CASES.map(
    (item) =>
      `case=${item.name} exit=${item.exit} out=${item.name === 'tls-missing' ? '2026-11-03T00:00:00Z ' : ''}${item.out}`,
  ),
  'compose=absent',
].join('\n');

test('the guard judgment accepts the expected exit codes and RESULT lines', () => {
  assert.deepEqual(judgeGuardOutput(passing), []);
});

test('the guard judgment fails closed on a missing case, a different exit or an early compose write', () => {
  assert.match(
    judgeGuardOutput(passing.replace(/^case=locked.*$/mu, '')).join(),
    /locked: no result/u,
  );
  assert.match(
    judgeGuardOutput(passing.replace('case=locked exit=75', 'case=locked exit=1')).join(),
    /locked: exit 1/u,
  );
  assert.match(
    judgeGuardOutput(passing.replace('reason=action', 'reason=digest')).join(),
    /action: exit 2 "RESULT=rejected reason=digest"/u,
  );
  assert.match(
    judgeGuardOutput(passing.replace('compose=absent', 'compose=written')).join(),
    /written before the TLS check/u,
  );
});

const deployPassing = DEPLOY_PATH_CASES.map(
  (item) =>
    `case=${item.name} exit=${item.exit} current=${item.current} previous=${item.previous} flag=${item.flag} out=2026-11-03T00:00:00Z ${item.result} web=sha256:x`,
).join('\n');

test('the deploy path judgment accepts the expected exit codes, RESULT lines and host state', () => {
  assert.deepEqual(judgeDeployPathOutput(deployPassing), []);
});

test('the deploy path judgment fails closed on a lost rollback, a success after failure or a wrong previous', () => {
  const cases = [
    [
      (out) => out.replace(/^case=smoke-failure-rolls-back.*$/mu, ''),
      /smoke-failure-rolls-back: no result/u,
    ],
    [
      (out) =>
        out.replace(
          'case=start-failure-rolls-back exit=1 current=2',
          'case=start-failure-rolls-back exit=0 current=2',
        ),
      /start-failure-rolls-back: exit 0 != 1/u,
    ],
    [
      (out) =>
        out.replace(
          'case=smoke-failure-rolls-back exit=1 current=2',
          'case=smoke-failure-rolls-back exit=1 current=4',
        ),
      /smoke-failure-rolls-back: current 4 != 2/u,
    ],
    [
      (out) =>
        out.replace(
          'case=second-deploy exit=0 current=2 previous=1',
          'case=second-deploy exit=0 current=2 previous=none',
        ),
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
  ];
  for (const [change, expected] of cases) {
    const problems = judgeDeployPathOutput(change(deployPassing));
    assert.ok(
      problems.some((problem) => expected.test(problem)),
      `${expected}: ${problems.join(' | ')}`,
    );
  }
});
