import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  issuedSessionResponseSchema,
  loginPasskeyRequestSchema,
  accessRequestApproveRequestSchema,
  accessRequestSchema,
} from '@repo/shared/backoffice';
import { bffMutation, type BffRouteContext } from './mutation-route';
import { SESSION_COOKIE_NAME } from './session-cookie';

const API = 'http://backoffice-api.test:4310';
const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const SAME_ORIGIN = {
  origin: 'http://localhost:4300',
  'sec-fetch-site': 'same-origin',
  host: 'localhost:4300',
};
const PASSKEY_BODY = {
  challengeId: ID,
  credential: {
    id: 'Y3JlZA',
    rawId: 'Y3JlZA',
    type: 'public-key',
    response: { clientDataJSON: 'Y2Q', authenticatorData: 'YWQ', signature: 'c2ln' },
    clientExtensionResults: {},
  },
};
const ACCESS_REQUEST = {
  id: ID,
  kind: 'ROLE_GRANT',
  status: 'APPROVED',
  contentDigest: 'a'.repeat(64),
  targetAccountId: ID,
  targetRole: 'AUDITOR',
  requestedByAccountId: ID,
  requestReason: null,
  expiresAt: '2026-11-29T04:00:00.000Z',
  decidedByAccountId: ID,
  closedAt: '2026-11-22T04:00:00.000Z',
  decisionReason: 'only approver',
  selfApproved: true,
  createdAt: '2026-11-22T04:00:00.000Z',
};

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv('BACKOFFICE_API_URL', API);
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(process.stderr, 'write').mockReturnValue(true);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function post(
  path: string,
  options: { body?: unknown; cookie?: string; headers?: Record<string, string> } = {},
) {
  const headers = new Headers({ ...SAME_ORIGIN, ...options.headers });
  if (options.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  if (options.cookie) {
    headers.set('cookie', `${SESSION_COOKIE_NAME}=${options.cookie}`);
  }
  return new NextRequest(`http://localhost:4300${path}`, {
    method: 'POST',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

const noParams: BffRouteContext = { params: Promise.resolve({}) };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const loginPasskey = bffMutation({
  upstream: '/auth/login/passkey',
  access: 'public',
  body: loginPasskeyRequestSchema,
  response: issuedSessionResponseSchema,
  onSuccess: ({ session }) => ({ body: { scope: session.scope }, issueSession: session.token }),
});

const approve = bffMutation({
  upstream: ({ requestId }) => `/access/requests/${requestId}/approve`,
  params: ['requestId'],
  access: 'session',
  body: accessRequestApproveRequestSchema,
  response: accessRequestSchema,
});

const logout = bffMutation({
  upstream: '/auth/logout',
  access: 'session',
  body: null,
  response: null,
  endsSession: true,
});

describe('bffMutation', () => {
  it('login keeps the token in the cookie and gives the page only the scope', async () => {
    const token = 't'.repeat(43);
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        session: { token, scope: 'FULL', absoluteExpiresAt: '2026-11-22T12:00:00.000Z' },
      }),
    );
    const response = await loginPasskey(
      post('/api/auth/login/passkey', { body: PASSKEY_BODY }),
      noParams,
    );
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ scope: 'FULL' });
    expect(text).not.toContain(token);
    expect(response.headers.getSetCookie()[0]).toContain(`${SESSION_COOKIE_NAME}=${token};`);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(`${API}/auth/login/passkey`);
    expect(init?.cache).toBe('no-store');
    const sent = new Headers(init?.headers);
    expect(sent.get('authorization')).toBeNull();
    expect(sent.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/u);
  });

  it('a session route forwards the cookie as a bearer and passes the upstream body', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, ACCESS_REQUEST));
    const response = await approve(
      post(`/api/access/requests/${ID}/approve`, {
        cookie: 'session-token',
        body: { contentDigest: 'a'.repeat(64), reason: 'only approver' },
      }),
      { params: Promise.resolve({ requestId: ID }) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(ACCESS_REQUEST);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(`${API}/access/requests/${ID}/approve`);
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer session-token');
  });

  it('passes an upstream refusal through and clears the cookie when the session ended', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, { error: { code: 'reauthentication_required' } }),
    );
    const refused = await approve(
      post(`/api/access/requests/${ID}/approve`, {
        cookie: 'session-token',
        body: { contentDigest: 'a'.repeat(64) },
      }),
      { params: Promise.resolve({ requestId: ID }) },
    );
    expect(refused.status).toBe(403);
    expect(await refused.json()).toEqual({ error: { code: 'reauthentication_required' } });
    expect(refused.headers.getSetCookie()).toEqual([]);

    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: { code: 'session_expired' } }));
    const ended = await approve(
      post(`/api/access/requests/${ID}/approve`, {
        cookie: 'session-token',
        body: { contentDigest: 'a'.repeat(64) },
      }),
      { params: Promise.resolve({ requestId: ID }) },
    );
    expect(ended.status).toBe(401);
    expect(await ended.json()).toEqual({ error: { code: 'session_expired' } });
    expect(ended.headers.getSetCookie()[0]).toMatch(/Max-Age=0/u);
  });

  it.each([
    [
      'a body the shared schema rejects',
      { body: { contentDigest: 'short' } },
      400,
      'invalid_request',
    ],
    ['malformed JSON', { body: '{', raw: true }, 400, 'invalid_request'],
    [
      'a form post',
      { body: 'a=1', raw: true, contentType: 'application/x-www-form-urlencoded' },
      415,
      'unsupported_media_type',
    ],
  ] as const)('refuses %s before calling the API', async (_name, input, status, code) => {
    const headers = new Headers({
      ...SAME_ORIGIN,
      'content-type': 'contentType' in input ? input.contentType : 'application/json',
      cookie: `${SESSION_COOKIE_NAME}=session-token`,
    });
    const request = new NextRequest(`http://localhost:4300/api/access/requests/${ID}/approve`, {
      method: 'POST',
      headers,
      body: 'raw' in input ? input.body : JSON.stringify(input.body),
    });
    const response = await approve(request, { params: Promise.resolve({ requestId: ID }) });
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: { code } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a path id that is not a UUID before calling the API', async () => {
    const response = await approve(
      post('/api/access/requests/../accounts/approve', {
        cookie: 'session-token',
        body: { contentDigest: 'a'.repeat(64) },
      }),
      { params: Promise.resolve({ requestId: '..%2Faccounts' }) },
    );
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers a fixed error when the API is unreachable or its body breaks the contract', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    const unreachable = await approve(
      post(`/api/access/requests/${ID}/approve`, {
        cookie: 'session-token',
        body: { contentDigest: 'a'.repeat(64) },
      }),
      { params: Promise.resolve({ requestId: ID }) },
    );
    expect(unreachable.status).toBe(503);
    expect(await unreachable.json()).toEqual({ error: { code: 'upstream_unavailable' } });

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ...ACCESS_REQUEST, status: 'DONE' }));
    const drifted = await approve(
      post(`/api/access/requests/${ID}/approve`, {
        cookie: 'session-token',
        body: { contentDigest: 'a'.repeat(64) },
      }),
      { params: Promise.resolve({ requestId: ID }) },
    );
    expect(drifted.status).toBe(502);
    expect(await drifted.json()).toEqual({ error: { code: 'upstream_invalid' } });
  });

  it('logout clears the cookie, also when the session had already ended', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const done = await logout(post('/api/auth/logout', { cookie: 'session-token' }), noParams);
    expect(done.status).toBe(204);
    expect(done.headers.getSetCookie()[0]).toMatch(/Max-Age=0/u);

    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: { code: 'session_required' } }));
    const ended = await logout(post('/api/auth/logout', { cookie: 'session-token' }), noParams);
    expect(ended.status).toBe(204);
    expect(ended.headers.getSetCookie()[0]).toMatch(/Max-Age=0/u);

    const noCookie = await logout(post('/api/auth/logout'), noParams);
    expect(noCookie.status).toBe(204);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
