import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AUTH_BFF_DEFAULT_TIMEOUT_MS,
  buildJsonResponse,
  forwardAuthRequest,
  getAuthCookieNames,
  getForwardHeaders,
  getVerificationGrantCookieName,
  resolveTrustedForwardedFor,
  setAuthCookie,
  setAuthTransportCookies,
  setVerificationGrantCookie,
} from '@/auth/bff';

const ACCESS_TOKEN = `v1.session-access.${'c'.repeat(43)}`;
const RENEWAL_TOKEN = `v1.session-renewal.${'d'.repeat(43)}`;

describe('auth BFF shared helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('upstream status를 보존한다', async () => {
    const upstream = new Response(JSON.stringify({ success: false }), { status: 429 });
    const response = buildJsonResponse(upstream, { success: false });

    expect(response.status).toBe(429);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('upstream Retry-After header를 보존한다', () => {
    const upstream = new Response(JSON.stringify({ success: false }), {
      status: 429,
      headers: { 'Retry-After': '42' },
    });
    const response = buildJsonResponse(upstream, { success: false });

    expect(response.headers.get('Retry-After')).toBe('42');
  });

  it('browser JSON 방어선은 raw verification grant만 제거하고 만료 정보는 유지한다', async () => {
    const response = buildJsonResponse(new Response('{}', { status: 200 }), {
      success: true,
      signupGrant: `v1.signup-code.${'g'.repeat(43)}`,
      resetGrant: `v1.reset-code.${'r'.repeat(43)}`,
      grantExpiresInSeconds: 900,
    });

    await expect(response.json()).resolves.toEqual({
      success: true,
      grantExpiresInSeconds: 900,
    });
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

  it('spoof 가능한 X-Forwarded-For 선행 값은 버리고 trusted edge가 추가한 마지막 IP만 전달한다', () => {
    const request = new NextRequest('http://localhost/api/auth/session', {
      headers: {
        'x-forwarded-for': '198.51.100.99, 203.0.113.30',
      },
    });

    expect(resolveTrustedForwardedFor(request)).toBe('203.0.113.30');
    expect(getForwardHeaders(request)).toEqual({
      'x-forwarded-for': '203.0.113.30',
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

  it('access token은 rememberMe와 무관하게 session cookie로 설정한다', () => {
    const response = buildJsonResponse(new Response('{}', { status: 200 }), { success: true });
    setAuthCookie(response, ACCESS_TOKEN);

    const cookie = response.cookies.get('auth-token');
    expect(cookie?.value).toBe(ACCESS_TOKEN);
    expect(cookie?.maxAge).toBeUndefined();
  });

  it('rememberMe=true여도 access token은 persistent cookie로 만들지 않는다', () => {
    const response = buildJsonResponse(new Response('{}', { status: 200 }), { success: true });
    setAuthTransportCookies(response, {
      accessToken: ACCESS_TOKEN,
      renewalToken: RENEWAL_TOKEN,
      rememberMe: true,
    });

    const cookie = response.cookies.get('auth-token');
    expect(cookie?.value).toBe(ACCESS_TOKEN);
    expect(cookie?.maxAge).toBeUndefined();
  });

  it('rememberMe=true transport는 renewal cookie만 7일 persistent로 저장한다', () => {
    const response = buildJsonResponse(new Response('{}', { status: 200 }), { success: true });
    setAuthTransportCookies(response, {
      accessToken: ACCESS_TOKEN,
      renewalToken: RENEWAL_TOKEN,
      rememberMe: true,
    });

    expect(response.cookies.get('auth-token')?.value).toBe(ACCESS_TOKEN);
    expect(response.cookies.get('auth-token')?.maxAge).toBeUndefined();
    expect(response.cookies.get('auth-renewal-token')?.value).toBe(RENEWAL_TOKEN);
    expect(response.cookies.get('auth-renewal-token')?.maxAge).toBe(60 * 60 * 24 * 7);
  });

  it('rememberMe=false transport는 access와 renewal을 모두 session cookie로 저장한다', () => {
    const response = buildJsonResponse(new Response('{}', { status: 200 }), { success: true });
    setAuthTransportCookies(response, {
      accessToken: ACCESS_TOKEN,
      renewalToken: RENEWAL_TOKEN,
      rememberMe: false,
    });

    expect(response.cookies.get('auth-token')?.maxAge).toBeUndefined();
    expect(response.cookies.get('auth-renewal-token')?.value).toBe(RENEWAL_TOKEN);
    expect(response.cookies.get('auth-renewal-token')?.maxAge).toBeUndefined();
  });

  it('production auth cookie는 __Host- 이름과 Secure/Path/no Domain invariant를 사용한다', () => {
    const response = buildJsonResponse(new Response('{}', { status: 200 }), { success: true });
    setAuthCookie(response, ACCESS_TOKEN, 'production');

    expect(getAuthCookieNames('production')).toEqual({
      access: '__Host-auth-token',
      renewal: '__Host-auth-renewal-token',
    });
    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('__Host-auth-token=');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).not.toMatch(/Domain=/i);
  });

  it('development/test auth cookie는 HTTP local runtime용 기존 이름을 유지한다', () => {
    expect(getAuthCookieNames('development')).toEqual({
      access: 'auth-token',
      renewal: 'auth-renewal-token',
    });
    expect(getAuthCookieNames('test')).toEqual({
      access: 'auth-token',
      renewal: 'auth-renewal-token',
    });
  });

  it('production verification grant는 purpose별 __Host HttpOnly cookie로만 저장한다', () => {
    const response = buildJsonResponse(new Response('{}', { status: 200 }), { success: true });
    const grant = `v1.verification-code.${'g'.repeat(43)}`;

    setVerificationGrantCookie(response, 'password-reset', grant, 900, 'production');

    expect(getVerificationGrantCookieName('signup', 'production')).toBe(
      '__Host-signup-verification-grant',
    );
    expect(getVerificationGrantCookieName('password-reset', 'production')).toBe(
      '__Host-password-reset-grant',
    );
    expect(response.cookies.get('__Host-password-reset-grant')).toMatchObject({
      value: grant,
      maxAge: 900,
    });
    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=strict');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).not.toMatch(/Domain=/i);
  });

  it('network exception을 bounded safe response로 분류한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('connection refused')));

    const result = await forwardAuthRequest('POST', '/auth/login', {
      email: 'student@kangwon.ac.kr',
    });

    expect(result.failureKind).toBe('network');
    expect(result.response.status).toBe(503);
    expect(result.json).toEqual({
      success: false,
      code: 'BFF_UPSTREAM_NETWORK_ERROR',
    });
  });

  it('operation timeout은 fetch를 abort하고 timeout으로 분류한다', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        });
      }),
    );

    const pending = forwardAuthRequest(
      'POST',
      '/auth/login',
      { email: 'student@kangwon.ac.kr' },
      undefined,
      { timeoutMs: 10 },
    );
    await vi.advanceTimersByTimeAsync(10);

    await expect(pending).resolves.toMatchObject({
      failureKind: 'timeout',
      json: { code: 'BFF_UPSTREAM_TIMEOUT' },
    });
    expect(AUTH_BFF_DEFAULT_TIMEOUT_MS).toBe(8_000);
  });

  it('caller abort는 operation timeout과 구분한다', async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        });
      }),
    );

    const pending = forwardAuthRequest('GET', '/auth/session', undefined, {
      signal: controller.signal,
    });
    controller.abort();

    await expect(pending).resolves.toMatchObject({
      failureKind: 'aborted',
      json: { code: 'BFF_UPSTREAM_ABORTED' },
    });
  });

  it('이미 abort된 caller signal도 upstream 호출 전에 aborted로 분류한다', async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.signal?.aborted) {
          throw new DOMException('aborted', 'AbortError');
        }
        return new Response('{}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );

    await expect(
      forwardAuthRequest('GET', '/auth/session', undefined, {
        signal: controller.signal,
      }),
    ).resolves.toMatchObject({
      failureKind: 'aborted',
      json: { code: 'BFF_UPSTREAM_ABORTED' },
    });
  });

  it('upstream 5xx는 response payload를 전달하지 않고 unavailable로 분류한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({ success: false, error: 'raw internal error', secret: 'leak' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }),
    );

    const result = await forwardAuthRequest('POST', '/auth/login');

    expect(result.failureKind).toBe('upstream');
    expect(result.response.status).toBe(503);
    expect(result.json).toEqual({
      success: false,
      code: 'BFF_UPSTREAM_UNAVAILABLE',
    });
  });

  it('runtime response schema mismatch를 invalid response로 분류한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );

    const result = await forwardAuthRequest('POST', '/auth/login', undefined, undefined, {
      responseSchema: {
        safeParse(value: unknown) {
          if (
            typeof value === 'object' &&
            value !== null &&
            !Array.isArray(value) &&
            Reflect.get(value, 'success') === true &&
            typeof Reflect.get(value, 'accessToken') === 'string'
          ) {
            return { success: true as const, data: value as Record<string, unknown> };
          }
          return { success: false as const, error: new Error('schema mismatch') };
        },
      },
    });

    expect(result.failureKind).toBe('invalid-response');
    expect(result.json).toEqual({
      success: false,
      code: 'BFF_UPSTREAM_SCHEMA_MISMATCH',
    });
  });
});
