import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET as getSession } from '../session/route';
import { POST as renewSession } from '../renew-session/route';

describe('auth BFF session renewal transport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('session route는 access cookie가 인증 실패해도 renewal cookie로 rotate 후 session을 재조회한다', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ authenticated: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            accessToken: 'renewed-access-token',
            renewalToken: 'next-renewal-token',
            rememberMe: true,
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

    const request = new NextRequest('http://localhost/api/auth/session', {
      headers: {
        Cookie: 'auth-token=expired-access-token; auth-renewal-token=current-renewal-token',
        'x-forwarded-for': '203.0.113.10',
        'user-agent': 'vitest',
      },
    });

    const response = await getSession(request);

    await expect(response.json()).resolves.toMatchObject({
      authenticated: true,
      user: { id: 'user-1', email: 'test@kangwon.ac.kr' },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:4000/auth/renew-session',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ renewalToken: 'current-renewal-token' }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'http://localhost:4000/auth/session',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer renewed-access-token' }),
      }),
    );
    expect(response.cookies.get('auth-token')?.value).toBe('renewed-access-token');
    expect(response.cookies.get('auth-renewal-token')?.value).toBe('next-renewal-token');
  });

  it('renew-session route는 renewalToken/accessToken을 응답 body로 노출하지 않고 cookie만 rotate한다', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          accessToken: 'renewed-access-token',
          renewalToken: 'next-renewal-token',
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
        Cookie: 'auth-renewal-token=current-renewal-token',
      },
    });

    const response = await renewSession(request);

    await expect(response.json()).resolves.toEqual({ success: true });
    expect(response.cookies.get('auth-token')?.value).toBe('renewed-access-token');
    expect(response.cookies.get('auth-renewal-token')?.value).toBe('next-renewal-token');
  });
});
