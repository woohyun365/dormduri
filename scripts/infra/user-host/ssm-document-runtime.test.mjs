import assert from 'node:assert/strict';
import test from 'node:test';

import { DOCUMENT_GUARD_CASES, judgeGuardOutput } from './ssm-document-runtime.mjs';

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
