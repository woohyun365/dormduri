import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBffRequest, firstFetchInit, stubJsonFetch } from '@/test/bff-route';
import { forwardBffRequest, getBffForwardHeaders } from './forward';
import * as reliability from './reliability';

const AUTH_TOKEN = `v1.session-bff.${'a'.repeat(43)}`;

describe('generic BFF forward helper hardening', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    ['203.0.113.20', '203.0.113.20'],
    ['203.0.113.21', '203.0.113.21'],
    ['2001:0DB8:0:0:0:0:0:1', '2001:db8::1'],
    ['::ffff:203.0.113.20', '203.0.113.20'],
    ['198.51.100.99, 203.0.113.20', null],
    ['not-an-ip', null],
    ['[2001:db8::1]:443', null],
    ['fe80::1%eth0', null],
    [undefined, null],
  ])(
    '최종 fetch는 원본 XFF %s만 정규화하고 모든 extra override를 제거한다',
    async (input, expected) => {
      const fetchMock = stubJsonFetch({ success: true });
      vi.spyOn(reliability, 'startBffReliabilityMeasurement').mockReturnValue({
        requestId: 'request-1',
        correlationHeaders: {
          'x-request-id': 'request-1',
          ...{
            'x-forwarded-for': '198.51.100.1',
            'X-Forwarded-For': '198.51.100.2',
            'X-Real-IP': '198.51.100.3',
            Forwarded: 'for=198.51.100.4',
            'X-Forwarded-Host': 'forged.example',
            'X-Forwarded-Proto': 'https',
          },
        },
        complete: vi.fn(),
      });

      await forwardBffRequest({
        request: createBffRequest('/api/bookmarks', {
          headers: {
            ...(input === undefined ? {} : { 'X-Forwarded-For': input }),
            Cookie: `auth-token=${AUTH_TOKEN}`,
            'user-agent': 'vitest',
            'x-real-ip': '198.51.100.5',
          },
        }),
        method: 'POST',
        path: '/api/bookmarks',
        authenticated: true,
        bodyMode: 'json',
        body: '{}',
      });

      const headers = new Headers(firstFetchInit(fetchMock).headers);
      expect(headers.get('x-forwarded-for')).toBe(expected);
      for (const name of ['x-real-ip', 'forwarded', 'x-forwarded-host', 'x-forwarded-proto']) {
        expect(headers.has(name)).toBe(false);
      }
      expect(headers.get('authorization')).toBe(`Bearer ${AUTH_TOKEN}`);
      expect(headers.get('user-agent')).toBe('vitest');
      expect(headers.get('content-type')).toBe('application/json');
      expect(headers.get('x-request-id')).toBe('request-1');
    },
  );

  it('원본 duplicate XFF spelling은 Headers의 chain으로 남아 최종 fetch에서 생략한다', async () => {
    const fetchMock = stubJsonFetch({ success: true });
    await forwardBffRequest({
      request: createBffRequest('/api/bookmarks', {
        headers: [
          ['x-forwarded-for', '203.0.113.20'],
          ['X-Forwarded-For', '203.0.113.20'],
        ],
      }),
      method: 'GET',
      path: '/api/bookmarks',
    });
    expect(new Headers(firstFetchInit(fetchMock).headers).has('x-forwarded-for')).toBe(false);
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
