import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBffRequest } from '@/test/bff-route';
import { forwardBffRequest, getBffForwardHeaders } from './forward';

const AUTH_TOKEN = `v1.session-bff.${'a'.repeat(43)}`;

describe('generic BFF forward helper hardening', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('route-owned /api path prefix 밖으로 upstream 요청을 만들지 않는다', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await forwardBffRequest({
      request: createBffRequest('/api/bookmarks'),
      method: 'GET',
      path: '/auth/session',
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'BFF_UPSTREAM_URL_INVALID',
    });
  });

  it('unsupported method/bodyMode 조합을 fail-closed한다', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const methodResponse = await forwardBffRequest({
      request: createBffRequest('/api/bookmarks'),
      method: 'PUT' as never,
      path: '/api/bookmarks',
    });
    expect(methodResponse.status).toBe(405);

    const bodyModeResponse = await forwardBffRequest({
      request: createBffRequest('/api/bookmarks'),
      method: 'GET',
      path: '/api/bookmarks',
      bodyMode: 'xml' as never,
    });
    expect(bodyModeResponse.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('malformed upstream JSON은 safe error response로 변환한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response('{"accessToken":"must-not-leak"', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );

    const response = await forwardBffRequest({
      request: createBffRequest('/api/bookmarks'),
      method: 'GET',
      path: '/api/bookmarks',
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'BFF_UPSTREAM_MALFORMED_JSON_RESPONSE',
    });
  });

  it('non-JSON upstream body를 그대로 노출하지 않는다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response('secret token must-not-leak', {
          status: 500,
          headers: { 'Content-Type': 'text/plain' },
        });
      }),
    );

    const response = await forwardBffRequest({
      request: createBffRequest('/api/bookmarks'),
      method: 'GET',
      path: '/api/bookmarks',
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'BFF_UPSTREAM_NON_JSON_RESPONSE',
    });
  });

  it('caller-supplied sensitive headers 대신 cookie-derived Authorization만 전달한다', () => {
    const request = createBffRequest('/api/bookmarks', {
      headers: {
        Cookie: `auth-token=${AUTH_TOKEN}`,
        Authorization: 'Bearer caller-token',
        'x-api-key': 'caller-api-key',
        'x-forwarded-for': '203.0.113.20',
        'user-agent': 'vitest',
      },
    });

    expect(getBffForwardHeaders(request, { authenticated: true })).toEqual({
      Authorization: `Bearer ${AUTH_TOKEN}`,
      'x-forwarded-for': '203.0.113.20',
      'user-agent': 'vitest',
    });
  });
});
