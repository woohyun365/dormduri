import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST as resolveSession } from '../session/resolve/route';
import { POST as renewSession } from '../renew-session/route';

const EXPIRED_ACCESS_TOKEN = `v1.session-expired-access.${'e'.repeat(43)}`;
const CURRENT_RENEWAL_TOKEN = `v1.session-current-renewal.${'f'.repeat(43)}`;
const RENEWED_ACCESS_TOKEN = `v1.session-renewed-access.${'a'.repeat(43)}`;
const NEXT_RENEWAL_TOKEN = `v1.session-next-renewal.${'b'.repeat(43)}`;

describe('auth BFF session renewal transport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rememberMe=false session도 access 만료 후 renewal cookie로 복구한다', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ authenticated: false, reason: 'ACCESS_EXPIRED' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            accessToken: RENEWED_ACCESS_TOKEN,
            renewalToken: NEXT_RENEWAL_TOKEN,
            rememberMe: false,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            authenticated: true,
            user: {
              id: 'user-1',
              email: 'test@kangwon.ac.kr',
              nickname: '테스터',
              gender: 'M',
              campus: 'CHUNCHEON',
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const request = new NextRequest('http://localhost/api/auth/session/resolve', {
      method: 'POST',
      headers: {
        Cookie: `auth-token=${EXPIRED_ACCESS_TOKEN}; auth-renewal-token=${CURRENT_RENEWAL_TOKEN}`,
        'x-forwarded-for': '203.0.113.10',
        'user-agent': 'vitest',
      },
    });

    const response = await resolveSession(request);

    await expect(response.json()).resolves.toMatchObject({
      status: 'authenticated',
      user: { id: 'user-1', email: 'test@kangwon.ac.kr' },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:4000/auth/renew-session',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ renewalToken: CURRENT_RENEWAL_TOKEN }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'http://localhost:4000/auth/session',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: `Bearer ${RENEWED_ACCESS_TOKEN}` }),
      }),
    );
    expect(response.cookies.get('auth-token')?.value).toBe(RENEWED_ACCESS_TOKEN);
    expect(response.cookies.get('auth-token')?.maxAge).toBeUndefined();
    expect(response.cookies.get('auth-renewal-token')?.value).toBe(NEXT_RENEWAL_TOKEN);
    expect(response.cookies.get('auth-renewal-token')?.maxAge).toBeUndefined();
  });

  it('renew-session route는 renewalToken/accessToken을 응답 body로 노출하지 않고 cookie만 rotate한다', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          accessToken: RENEWED_ACCESS_TOKEN,
          renewalToken: NEXT_RENEWAL_TOKEN,
          rememberMe: true,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const request = new NextRequest('http://localhost/api/auth/renew-session', {
      method: 'POST',
      headers: {
        Cookie: `auth-renewal-token=${CURRENT_RENEWAL_TOKEN}`,
      },
    });

    const response = await renewSession(request);

    await expect(response.json()).resolves.toEqual({ success: true });
    expect(response.cookies.get('auth-token')?.value).toBe(RENEWED_ACCESS_TOKEN);
    expect(response.cookies.get('auth-token')?.maxAge).toBeUndefined();
    expect(response.cookies.get('auth-renewal-token')?.value).toBe(NEXT_RENEWAL_TOKEN);
    expect(response.cookies.get('auth-renewal-token')?.maxAge).toBe(60 * 60 * 24 * 7);
  });

  it('rememberMe=false renewal은 access와 renewal cookie를 browser-session으로 유지한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            success: true,
            accessToken: RENEWED_ACCESS_TOKEN,
            renewalToken: NEXT_RENEWAL_TOKEN,
            rememberMe: false,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }),
    );

    const request = new NextRequest('http://localhost/api/auth/renew-session', {
      method: 'POST',
      headers: {
        Cookie: `auth-renewal-token=${CURRENT_RENEWAL_TOKEN}`,
      },
    });

    const response = await renewSession(request);

    await expect(response.json()).resolves.toEqual({ success: true });
    expect(response.cookies.get('auth-token')?.maxAge).toBeUndefined();
    expect(response.cookies.get('auth-renewal-token')?.value).toBe(NEXT_RENEWAL_TOKEN);
    expect(response.cookies.get('auth-renewal-token')?.maxAge).toBeUndefined();
  });

  it('stale renewal은 cookie를 지우지 않고 browser retry budget을 전달한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            success: false,
            code: 'AUTH_SESSION_RENEWAL_STALE',
            error: '다른 요청에서 로그인 상태를 갱신하고 있습니다.',
            retryAfterMilliseconds: 50,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }),
    );

    const response = await renewSession(
      new NextRequest('http://localhost/api/auth/renew-session', {
        method: 'POST',
        headers: {
          Cookie: `auth-renewal-token=${CURRENT_RENEWAL_TOKEN}`,
        },
      }),
    );

    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'AUTH_SESSION_RENEWAL_STALE',
      error: '다른 요청에서 로그인 상태를 갱신하고 있습니다.',
      retryAfterMilliseconds: 50,
    });
    expect(response.headers.get('x-auth-session-retry-after-milliseconds')).toBe('50');
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('session resolve의 stale renewal은 unavailable과 retry header를 반환하고 cookie를 보존한다', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ authenticated: false, reason: 'ACCESS_EXPIRED' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            code: 'AUTH_SESSION_RENEWAL_STALE',
            error: '다른 요청에서 로그인 상태를 갱신하고 있습니다.',
            retryAfterMilliseconds: 50,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const response = await resolveSession(
      new NextRequest('http://localhost/api/auth/session/resolve', {
        method: 'POST',
        headers: {
          Cookie: `auth-token=${EXPIRED_ACCESS_TOKEN}; auth-renewal-token=${CURRENT_RENEWAL_TOKEN}`,
        },
      }),
    );

    await expect(response.json()).resolves.toEqual({
      status: 'unavailable',
      code: 'AUTH_SESSION_UNAVAILABLE',
    });
    expect(response.headers.get('x-auth-session-retry-after-milliseconds')).toBe('50');
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('session upstream 장애는 unauthenticated로 축약하거나 기존 cookie를 지우지 않는다', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('upstream unavailable'));
    vi.stubGlobal('fetch', fetchMock);

    const request = new NextRequest('http://localhost/api/auth/session/resolve', {
      method: 'POST',
      headers: {
        Cookie: `auth-token=${EXPIRED_ACCESS_TOKEN}; auth-renewal-token=${CURRENT_RENEWAL_TOKEN}`,
      },
    });

    const response = await resolveSession(request);

    await expect(response.json()).resolves.toEqual({
      status: 'unavailable',
      code: 'AUTH_SESSION_UNAVAILABLE',
    });
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('authoritative session 거부는 unauthenticated로 반환하고 기존 cookie를 정리한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(JSON.stringify({ authenticated: false, reason: 'ACCOUNT_DELETED' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );

    const response = await resolveSession(
      new NextRequest('http://localhost/api/auth/session/resolve', {
        method: 'POST',
        headers: {
          Cookie: `auth-token=${EXPIRED_ACCESS_TOKEN}; auth-renewal-token=${CURRENT_RENEWAL_TOKEN}`,
        },
      }),
    );

    await expect(response.json()).resolves.toEqual({ status: 'unauthenticated' });
    expect(response.cookies.get('auth-token')?.maxAge).toBe(0);
    expect(response.cookies.get('auth-renewal-token')?.maxAge).toBe(0);
  });

  it('session schema mismatch는 cookie를 정리하지 않고 unavailable로 반환한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(JSON.stringify({ authenticated: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );

    const response = await resolveSession(
      new NextRequest('http://localhost/api/auth/session/resolve', {
        method: 'POST',
        headers: {
          Cookie: `auth-token=${EXPIRED_ACCESS_TOKEN}`,
        },
      }),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      status: 'unavailable',
      code: 'AUTH_SESSION_UNAVAILABLE',
    });
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});
