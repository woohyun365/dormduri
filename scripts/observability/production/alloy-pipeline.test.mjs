import assert from 'node:assert/strict';
import test from 'node:test';

import { FIXTURES, judgeAlloyPipeline, SENSITIVE } from './alloy-pipeline.mjs';

// 실제 Alloy·Loki 실행은 scripts/infra/check/validate-runtime-configs.mjs가 한다. 여기서는 판정이 약한 결과를 거부하는지 본다.
const stored = () =>
  FIXTURES.map((fixture) => ({
    labels: {
      service: fixture.service,
      env: 'fixture',
      service_name: fixture.service,
      detected_level: 'unknown',
    },
    line: fixture.expected,
  }));

test('the expected lines pass and hold none of the sensitive input values', () => {
  assert.deepEqual(judgeAlloyPipeline(stored()), []);
  for (const value of SENSITIVE)
    assert.ok(
      FIXTURES.some((fixture) => fixture.input.includes(value)),
      `${value} is a real input value`,
    );
});

test('an unmasked line, a missing line, an extra label or a wrong service is rejected', () => {
  const cases = [
    [(entries) => (entries[1].line = FIXTURES[1].input), /Loki holds 198\.51\.100\.23/u],
    [(entries) => entries.pop(), /expected one stored line/u],
    [(entries) => (entries[0].labels.requestId = 'x'), /labels beyond the allowlist: requestId/u],
    [
      (entries) => (entries[0].labels.service_name = 'other'),
      /labels beyond the allowlist: service_name/u,
    ],
    [(entries) => (entries[7].labels.service = 'web'), /stored with service web/u],
    [(entries) => entries.push({ ...entries[0] }), /Loki holds 10 fixture lines/u],
  ];
  for (const [change, expected] of cases) {
    const entries = stored();
    change(entries);
    assert.match(judgeAlloyPipeline(entries).join('\n'), expected, String(expected));
  }
  assert.match(
    judgeAlloyPipeline(stored(), FIXTURES, ['not-in-any-input']).join('\n'),
    /fixture input lacks the sensitive value/u,
    'a sensitive value that no input carries proves nothing',
  );
});
