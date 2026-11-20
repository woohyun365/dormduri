import assert from 'node:assert/strict';
import test from 'node:test';

import { externalSmokeCases, runExternalSmoke } from './external-smoke.mjs';
import { CANONICAL_HOST, INGRESS_SMOKE_CASES, PAGE_TITLES } from './ingress-smoke.mjs';

test('the external smoke uses the local ingress smoke table for the public host only', () => {
  for (const mode of ['serving', 'maintenance']) {
    const cases = externalSmokeCases(mode);
    assert.ok(cases.length > 0, mode);
    for (const testCase of cases) {
      assert.ok(INGRESS_SMOKE_CASES.includes(testCase), 'a case comes from the shared table');
      assert.ok(
        [CANONICAL_HOST, `www.${CANONICAL_HOST}`].includes(testCase.host ?? CANONICAL_HOST),
      );
      assert.ok(
        !testCase.path.startsWith('/.well-known/'),
        'the ACME test token exists only locally',
      );
      assert.ok(!testCase.stubOnly, 'stub-only paths need the stub Web');
    }
  }
  const serving = externalSmokeCases('serving').map(
    ({ method = 'GET', path }) => `${method} ${path}`,
  );
  for (const expected of [
    'GET /',
    'GET /privacy',
    'GET /terms',
    'GET /api/health',
    'GET /signup',
    'GET /abc',
    'POST /api/auth/login',
  ]) {
    assert.ok(serving.includes(expected), expected);
  }
  assert.throws(() => externalSmokeCases('web-down'));
});

test('the external smoke connects to the public host name with certificate verification', async () => {
  const sent = [];
  const rows = await runExternalSmoke({
    mode: 'maintenance',
    send: async (options) => {
      sent.push(options);
      return {
        closed: false,
        status: 503,
        headers: {
          'x-robots-tag': 'noindex',
          'strict-transport-security': 'max-age=300',
          'retry-after': '3600',
          'cache-control': 'no-store',
          'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'",
          'content-type': 'text/html; charset=utf-8',
        },
        body: '',
        title: PAGE_TITLES.maintenance,
      };
    },
  });
  assert.ok(rows.length > 0);
  for (const options of sent) {
    assert.equal(options.address, options.host);
    assert.deepEqual(options.ports, { http: 80, https: 443 });
    assert.equal(options.verify, true);
  }
  assert.deepEqual(
    rows.filter((row) => row.problems.length),
    [],
  );
  assert.ok(
    rows.every((row) => !('address' in row)),
    'rows carry no connection address',
  );
});
