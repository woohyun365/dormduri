import { NextRequest } from 'next/server';
import { GET as getDevUsers } from '@/app/api/auth/dev-users/route';
import { POST as postLogout } from '@/app/api/auth/logout/route';
import { firstFetchInit, stubJsonFetch } from '@/test/bff-route';
import * as reliability from '@/app/api/_bff/reliability';
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
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it.each(['record', 'tuples', 'Headers'] as const)(
    '최종 fetch는 %s init/extra/correlation의 reserved header를 모두 제거하고 원본 IP만 전달한다',
    async (shape) => {
      const fetchMock = stubJsonFetch({ success: true });
      const request = new NextRequest('http://localhost/api/auth/login', {
        headers: { 'X-Forwarded-For': '2001:0DB8:0:0:0:0:0:1', 'user-agent': 'vitest' },
      });
      const forged = {
        'x-forwarded-for': '198.51.100.1',
        'X-Forwarded-For': '198.51.100.2',
        'X-Real-IP': '198.51.100.3',
        Forwarded: 'for=198.51.100.4',
        'X-Forwarded-Host': 'forged.example',
        'X-Forwarded-Proto': 'https',
      };
      vi.spyOn(reliability, 'startBffReliabilityMeasurement').mockReturnValue({
        requestId: 'request-1',
        correlationHeaders: { 'x-request-id': 'request-1', ...forged },
        complete: vi.fn(),
      });
      const record = {
        ...getForwardHeaders(request, {
          ...forged,
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'X-Auth-Verification-Grant': 'cookie-grant',
        }),
        ...forged,
      };
      const initHeaders =
        shape === 'record'
          ? record
          : shape === 'tuples'
            ? Object.entries(record)
            : new Headers(record);

      await forwardAuthRequest(
        'POST',
        '/auth/login',
        {},
        { headers: initHeaders },
        {
          requestHeaders: request.headers,
        },
      );

      const headers = new Headers(firstFetchInit(fetchMock).headers);
      expect(headers.get('x-forwarded-for')).toBe('2001:db8::1');
      for (const name of ['x-real-ip', 'forwarded', 'x-forwarded-host', 'x-forwarded-proto']) {
        expect(headers.has(name)).toBe(false);
      }
      expect(headers.get('authorization')).toBe(`Bearer ${ACCESS_TOKEN}`);
      expect(headers.get('x-auth-verification-grant')).toBe('cookie-grant');
      expect(headers.get('user-agent')).toBe('vitest');
      expect(headers.get('content-type')).toBe('application/json');
      expect(headers.get('x-request-id')).toBe('request-1');
    },
  );

  it.each([
    ['203.0.113.30', '203.0.113.30'],
    ['203.0.113.31', '203.0.113.31'],
    ['::ffff:cb00:711e', '203.0.113.30'],
    ['198.51.100.99, 203.0.113.30', null],
    ['invalid', null],
    ['203.0.113.30:443', null],
    ['fe80::1%eth0', null],
    [null, null],
    [['203.0.113.30'], null],
  ])('최종 fetch는 별도 requestHeaders의 XFF %j만 사용한다', async (input, expected) => {
    const fetchMock = stubJsonFetch({ success: true });
    await forwardAuthRequest(
      'GET',
      '/auth/session',
      undefined,
      {
        headers: { 'x-forwarded-for': '198.51.100.1', 'x-real-ip': '198.51.100.2' },
      },
      {
        requestHeaders: { get: () => input as string | null },
      },
    );
    const headers = new Headers(firstFetchInit(fetchMock).headers);
    expect(headers.get('x-forwarded-for')).toBe(expected);
    expect(headers.has('x-real-ip')).toBe(false);
  });

  it('requestHeaders가 없으면 init.headers가 단일 valid IP여도 전달하지 않는다', async () => {
    const fetchMock = stubJsonFetch({ success: true });
    await forwardAuthRequest('GET', '/auth/session', undefined, {
      headers: { 'x-forwarded-for': '203.0.113.30', 'X-Real-IP': '203.0.113.30' },
    });
    expect(new Headers(firstFetchInit(fetchMock).headers).has('x-forwarded-for')).toBe(false);
  });

  it('원본 requestHeaders의 duplicate spelling은 동일 IP라도 생략한다', async () => {
    const fetchMock = stubJsonFetch({ success: true });
    await forwardAuthRequest('GET', '/auth/session', undefined, undefined, {
      requestHeaders: new Headers([
        ['x-forwarded-for', '203.0.113.30'],
        ['X-Forwarded-For', '203.0.113.30'],
      ]),
    });
    expect(new Headers(firstFetchInit(fetchMock).headers).has('x-forwarded-for')).toBe(false);
  });

  it.each([
    { path: 'dev-users', method: 'GET', handler: getDevUsers },
    { path: 'logout', method: 'POST', handler: postLogout },
  ])('$path caller도 원본 request header를 별도 전달한다', async ({ path, method, handler }) => {
    const fetchMock = stubJsonFetch({ success: true });
    await handler(
      new NextRequest(`http://localhost/api/auth/${path}`, {
        method,
        headers: {
          'X-Forwarded-For': '2001:0DB8:0:0:0:0:0:1',
          Cookie: `auth-token=${ACCESS_TOKEN}`,
        },
      }),
    );
    expect(new Headers(firstFetchInit(fetchMock).headers).get('x-forwarded-for')).toBe(
      '2001:db8::1',
    );
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
        'x-forwarded-for': '198.51.100.1',
        'X-Forwarded-For': '198.51.100.2',
        'X-Real-IP': '198.51.100.3',
        Forwarded: 'for=198.51.100.4',
        'X-Forwarded-Proto': 'https',
        'X-Forwarded-Host': 'forged.example',
        Cookie: 'must-not-forward',
        'x-api-key': 'must-not-forward',
      }),
    ).toEqual({
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'user-agent': 'vitest',
    });
  });

  it('X-Forwarded-For chain은 마지막 IP도 신뢰하지 않고 생략한다', () => {
    const request = new NextRequest('http://localhost/api/auth/session', {
      headers: {
        'x-forwarded-for': '198.51.100.99, 203.0.113.30',
      },
    });

    expect(resolveTrustedForwardedFor(request)).toBeUndefined();
    expect(getForwardHeaders(request)).toEqual({});
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

  it('password hash capacity 503만 bounded retry metadata로 통과시킨다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            success: false,
            code: 'AUTH_PASSWORD_HASH_CAPACITY_UNAVAILABLE',
            error: 'raw upstream copy',
            retryAfterSeconds: 2,
            password: 'must-not-leak',
          }),
          {
            status: 503,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '2',
            },
          },
        );
      }),
    );

    const result = await forwardAuthRequest('POST', '/auth/login');

    expect(result.failureKind).toBeUndefined();
    expect(result.response.status).toBe(503);
    expect(result.response.headers.get('Retry-After')).toBe('2');
    expect(result.json).toEqual({
      success: false,
      code: 'AUTH_PASSWORD_HASH_CAPACITY_UNAVAILABLE',
      userActionable: false,
      retryAfterSeconds: 2,
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
