import assert from 'node:assert/strict';
import test from 'node:test';

import { inspectSources, redactInspectionReport } from './inspect-configs.mjs';

test('production 후보의 stress throttle, mutable image, local placeholder를 구분한다', () => {
  const report = inspectSources([
    {
      path: 'infra/deploy/compose.yml',
      classification: 'production-candidate',
      source: [
        'services:',
        '  api:',
        '    image: example/api:latest',
        '    environment:',
        '      AUTH_THROTTLE_LIMIT: 5000',
        '      DATABASE_URL: postgresql://user:secret@localhost:5432/app',
      ].join('\n'),
    },
  ]);

  assert.deepEqual(
    report.findings.map(({ ruleId }) => ruleId),
    ['mutable-image', 'stress-policy-in-production', 'local-placeholder'],
  );
});

test('rehearsal과 stress 전용 입력은 production 위반으로 오인하지 않는다', () => {
  const report = inspectSources([
    {
      path: 'apps/api/test/stress/docker/compose.stress.yml',
      classification: 'stress-only',
      source: 'AUTH_THROTTLE_LIMIT: 5000\nSTRESS_TARGET_URL: http://127.0.0.1:8080',
    },
  ]);

  assert.deepEqual(report.findings, []);
});

test('inspection evidence는 원본 secret 값을 출력하지 않는다', () => {
  const secret = 'postgresql://user:super-secret@db.internal/app';
  const report = inspectSources([
    {
      path: 'infra/deploy/.env.api.example',
      classification: 'production-candidate',
      source: `DATABASE_URL=${secret}`,
    },
  ]);
  const serialized = JSON.stringify(redactInspectionReport(report));

  assert.equal(serialized.includes(secret), false);
  assert.equal(serialized.includes('super-secret'), false);
});
