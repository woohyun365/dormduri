import assert from 'node:assert/strict';
import test from 'node:test';

import { externalSmokeCases, runExternalSmoke } from './external-smoke.mjs';
import {
  CANONICAL_HOST,
  INGRESS_SMOKE_CASES,
  PAGE_TITLES,
  checkResponse,
  previousTitleFormat,
} from './ingress-smoke.mjs';

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

// After a rollback dispatch the CD runs this smoke against the older pair, whose ingress image carries the title form
// it was built with. The external smoke takes that previous form for static pages; the local smoke (which serves the
// repository pages) does not, and a page with another screen name still fails.
test('the external smoke takes the previous static page title form of an older pair', async () => {
  const cases = externalSmokeCases('serving');
  const staticCases = cases.filter((testCase) => testCase.expect.staticPage);
  assert.ok(staticCases.length > 0);
  const staticResponse = (testCase, title) => ({
    closed: false,
    status: testCase.expect.status,
    headers: {
      'x-robots-tag': 'noindex',
      'strict-transport-security': 'max-age=300',
      ...(testCase.expect.retryAfter ? { 'retry-after': testCase.expect.retryAfter } : {}),
      'cache-control': 'no-store',
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'",
      'content-type': 'text/html; charset=utf-8',
    },
    body: '',
    title,
  });
  const run = (titleOf) =>
    runExternalSmoke({
      mode: 'serving',
      send: async (options) => {
        const testCase = cases.find(
          (candidate) =>
            candidate.path === options.path &&
            (candidate.method ?? 'GET') === (options.method ?? 'GET'),
        );
        return testCase?.expect.staticPage
          ? staticResponse(testCase, titleOf(testCase.expect.title))
          : { closed: true, error: 'not a static page case' };
      },
    });
  const staticRows = (rows) =>
    rows.filter((row) =>
      staticCases.some(
        (testCase) => testCase.path === row.path && (testCase.method ?? 'GET') === row.method,
      ),
    );

  for (const titleOf of [(title) => title, previousTitleFormat]) {
    const rows = staticRows(await run(titleOf));
    assert.equal(rows.length, staticCases.length);
    assert.deepEqual(
      rows.filter((row) => row.problems.length),
      [],
    );
  }
  const otherScreen = (title) =>
    title === PAGE_TITLES.maintenance ? PAGE_TITLES.notFound : PAGE_TITLES.maintenance;
  for (const titleOf of [otherScreen, (title) => previousTitleFormat(otherScreen(title))]) {
    const rows = staticRows(await run(titleOf));
    assert.ok(rows.every((row) => row.problems.some((problem) => problem.startsWith('title '))));
  }
  // The local smoke keeps the exact title of the repository page.
  const [first] = staticCases;
  assert.ok(
    checkResponse(first, staticResponse(first, previousTitleFormat(first.expect.title))).some(
      (problem) => problem.startsWith('title '),
    ),
  );
  assert.deepEqual(checkResponse(first, staticResponse(first, first.expect.title)), []);
});
