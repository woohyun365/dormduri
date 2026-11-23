// runtime smoke 셋의 판정 함수가 어긋난 결과를 놓치지 않는지 본다(실제 container 실행은 infra:check runtime gate가 한다).
import assert from 'node:assert/strict';
import test from 'node:test';

import { GATEWAY_CASES, judgeGatewayRows } from '../user-host/gateway-smoke.mjs';
import { INGRESS_CASES, judgeIngressRows } from './ingress-smoke.mjs';
import {
  BACKOFFICE_DOCUMENT_CASES,
  judgeBackofficeDocumentOutput,
} from './ssm-document-runtime.mjs';

const ingressRows = () =>
  INGRESS_CASES.map((c) => ({
    name: c.name,
    status: c.status,
    upstream: c.status === 200 ? { host: 'localhost:4300', ...c.upstream } : null,
    poweredBy: null,
    server: 'nginx',
  }));
const ingressLog = '[22/Nov/2026:00:00:00 +0900] "GET /login HTTP/1.1" 200 2 0.001 "id"\n';

test('the admin ingress judge passes the expected rows and catches each weakened boundary', () => {
  assert.deepEqual(judgeIngressRows(ingressRows(), ingressLog), []);
  const changed = (name, change) =>
    ingressRows().map((row) => (row.name === name ? change(row) : row));
  for (const [rows, log, pattern] of [
    [
      changed('uppercase-host', (row) => ({
        ...row,
        status: 200,
        upstream: { host: 'LOCALHOST:4300' },
      })),
      ingressLog,
      /uppercase-host/u,
    ],
    [
      changed('state-change-pass-through', (row) => ({
        ...row,
        upstream: { ...row.upstream, origin: null },
      })),
      ingressLog,
      /upstream origin/u,
    ],
    [
      changed('state-change-pass-through', (row) => ({
        ...row,
        upstream: { ...row.upstream, 'x-forwarded-for': '203.0.113.7' },
      })),
      ingressLog,
      /x-forwarded-for/u,
    ],
    [
      changed('fixed-host', (row) => ({ ...row, poweredBy: 'Next.js' })),
      ingressLog,
      /X-Powered-By/u,
    ],
    [ingressRows().filter((row) => row.name !== 'put'), ingressLog, /put: no result/u],
    [
      ingressRows(),
      `${ingressLog}"GET /login?smoketoken=do-not-log-0123 HTTP/1.1"`,
      /query string/u,
    ],
    [ingressRows(), `${ingressLog}172.18.0.4 "GET /login HTTP/1.1"`, /client address/u],
  ]) {
    assert.ok(
      judgeIngressRows(rows, log).some((problem) => pattern.test(problem)),
      String(pattern),
    );
  }
});

const gatewayRows = () =>
  GATEWAY_CASES.map((c) => ({
    name: c.name,
    status: c.status,
    upstream: c.upstream ? { ...c.upstream, path: c.path } : null,
  }));

test('the gateway judge passes the expected rows and catches a sender, token or header leak', () => {
  assert.deepEqual(judgeGatewayRows(gatewayRows(), GATEWAY_CASES), []);
  const changed = (name, change) =>
    gatewayRows().map((row) => (row.name === name ? change(row) : row));
  for (const [rows, log, pattern] of [
    [
      changed('other-sender', (row) => ({ ...row, status: 200, upstream: { port: 9090 } })),
      '',
      /other-sender/u,
    ],
    [changed('token-other-case', (row) => ({ ...row, status: 200 })), '', /token-other-case/u],
    [
      changed('remote-write', (row) => ({
        ...row,
        upstream: { ...row.upstream, authorization: 'Bearer x' },
      })),
      '',
      /Authorization/u,
    ],
    [
      changed('api-scrape-from-peer', (row) => ({ ...row, status: 200, upstream: { port: 4000 } })),
      '',
      /api-scrape-from-peer/u,
    ],
    [gatewayRows(), '[x] 10.217.30.5 9480 "POST /api/v1/write" 200', /client address/u],
  ]) {
    assert.ok(
      judgeGatewayRows(rows, GATEWAY_CASES, log).some((problem) => pattern.test(problem)),
      String(pattern),
    );
  }
});

// harness 줄: `case=<이름> <key>=<값> ... out=<RESULT 줄>`(RESULT 줄의 시각은 판정에서 뗀다).
const documentOutput = (cases) =>
  cases
    .map(({ name, result, ...fields }) => {
      const pairs = Object.entries(fields).map(([key, value]) => `${key}=${value}`);
      return `case=${name} ${pairs.join(' ')} out=${result.startsWith('RESULT=failed') ? `2026-11-22T00:00:00Z ${result}` : result}`;
    })
    .join('\n');

test('the backoffice document judge passes the expected lines and catches a changed exit, state or leak', () => {
  assert.deepEqual(judgeBackofficeDocumentOutput(documentOutput(BACKOFFICE_DOCUMENT_CASES)), []);
  for (const [change, pattern] of [
    [
      (c) =>
        c.name === 'engine-27' ? { ...c, exit: 0, result: 'RESULT=succeeded action=deploy' } : c,
      /engine-27/u,
    ],
    [
      (c) => (c.name === 'publish-violation-rolls-back' ? { ...c, current: '3' } : c),
      /publish-violation-rolls-back: current/u,
    ],
    [(c) => (c.name === 'leak' ? { ...c, code: 'yes' } : c), /leak: code/u],
    [(c) => (c.name === 'first-deploy' ? { ...c, perms: 'no' } : c), /first-deploy: perms/u],
  ]) {
    const problems = judgeBackofficeDocumentOutput(
      documentOutput(BACKOFFICE_DOCUMENT_CASES.map(change)),
    );
    assert.ok(
      problems.some((problem) => pattern.test(problem)),
      `${pattern}: ${problems.join(' | ')}`,
    );
  }
  const missing = BACKOFFICE_DOCUMENT_CASES.filter((c) => c.name !== 'rollback');
  assert.ok(judgeBackofficeDocumentOutput(documentOutput(missing)).includes('rollback: no result'));
});
