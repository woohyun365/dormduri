import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildJsonResponse,
  forwardAuthRequest,
  getForwardHeaders,
  setAuthCookie,
  setAuthTransportCookies,
} from '@/auth/bff';

const ACCESS_TOKEN = `v1.session-access.${'c'.repeat(43)}`;
const RENEWAL_TOKEN = `v1.session-renewal.${'d'.repeat(43)}`;

describe('auth BFF shared helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('upstream status를 보존한다', async () => {
    const upstream = new Response(JSON.stringify({ success: false }), { status: 429 });
    const response = buildJsonResponse(upstream, { success: false });

    expect(response.status).toBe(429);
  });

  it('upstream Retry-After header를 보존한다', () => {
    const upstream = new Response(JSON.stringify({ success: false }), {
      status: 429,
      headers: { 'Retry-After': '42' },
    });
    const response = buildJsonResponse(upstream, { success: false });

    expect(response.headers.get('Retry-After')).toBe('42');
  });

  it('auth upstream path는 /auth prefix 밖으로 나가지 않는다', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { response, json } = await forwardAuthRequest('GET', '/api/bookmarks');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(502);
    expect(json).toEqual({ success: false, code: 'BFF_UPSTREAM_URL_INVALID' });
  });

  it('malformed upstream JSON은 safe auth BFF response로 변환한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response('{"accessToken":"must-not-leak"', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );

    const { response, json } = await forwardAuthRequest('GET', '/auth/session');

    expect(response.status).toBe(502);
    expect(json).toEqual({ success: false, code: 'BFF_UPSTREAM_MALFORMED_JSON_RESPONSE' });
  });

  it('request sensitive headers는 전달하지 않고 extra Authorization만 명시적으로 허용한다', () => {
    const request = new NextRequest('http://localhost/api/auth/session', {
      headers: {
        Authorization: 'Bearer caller-token',
        Cookie: `auth-token=${ACCESS_TOKEN}`,
        'x-api-key': 'caller-api-key',
        'x-forwarded-for': '203.0.113.30',
        'user-agent': 'vitest',
      },
    });

    expect(
      getForwardHeaders(request, {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        Cookie: 'must-not-forward',
        'x-api-key': 'must-not-forward',
      }),
    ).toEqual({
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'x-forwarded-for': '203.0.113.30',
      'user-agent': 'vitest',
    });
  });

  it('buildJsonResponse는 token-like fields를 response body에서 제거한다', async () => {
    const response = buildJsonResponse(new Response('{}', { status: 400 }), {
      success: false,
      error: 'invalid',
      accessToken: 'must-not-leak',
      renewalToken: 'must-not-leak',
      nested: { authorization: 'must-not-leak', safe: true },
    });

    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'invalid',
      nested: { safe: true },
    });
  });

  it('rememberMe 미체크 시 session cookie를 설정한다', () => {
    const response = buildJsonResponse(new Response('{}', { status: 200 }), { success: true });
    setAuthCookie(response, ACCESS_TOKEN, false);

    const cookie = response.cookies.get('auth-token');
    expect(cookie?.value).toBe(ACCESS_TOKEN);
    expect(cookie?.maxAge).toBeUndefined();
  });

  it('rememberMe 체크 시 persistent cookie를 설정한다', () => {
    const response = buildJsonResponse(new Response('{}', { status: 200 }), { success: true });
    setAuthCookie(response, ACCESS_TOKEN, true);

    const cookie = response.cookies.get('auth-token');
    expect(cookie?.value).toBe(ACCESS_TOKEN);
    expect(cookie?.maxAge).toBe(60 * 60 * 24 * 7);
  });

  it('Phase 0 expected-change: rememberMe 체크 시 7일 session/token family TTL에 맞춘 persistent cookie를 설정한다', () => {
    const response = buildJsonResponse(new Response('{}', { status: 200 }), { success: true });
    setAuthCookie(response, ACCESS_TOKEN, true);

    const cookie = response.cookies.get('auth-token');
    expect(cookie?.value).toBe(ACCESS_TOKEN);
    expect(cookie?.maxAge).toBe(60 * 60 * 24 * 7);
  });

  it('rememberMe transport는 renewal cookie를 access cookie와 분리해 저장한다', () => {
    const response = buildJsonResponse(new Response('{}', { status: 200 }), { success: true });
    setAuthTransportCookies(response, {
      accessToken: ACCESS_TOKEN,
      renewalToken: RENEWAL_TOKEN,
      rememberMe: true,
    });

    expect(response.cookies.get('auth-token')?.value).toBe(ACCESS_TOKEN);
    expect(response.cookies.get('auth-token')?.maxAge).toBe(60 * 60 * 24 * 7);
    expect(response.cookies.get('auth-renewal-token')?.value).toBe(RENEWAL_TOKEN);
    expect(response.cookies.get('auth-renewal-token')?.maxAge).toBe(60 * 60 * 24 * 7);
  });
});
