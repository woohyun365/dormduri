import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET as getSession } from '../session/route';
import { POST as renewSession } from '../renew-session/route';

const EXPIRED_ACCESS_TOKEN = `v1.session-expired-access.${'e'.repeat(43)}`;
const CURRENT_RENEWAL_TOKEN = `v1.session-current-renewal.${'f'.repeat(43)}`;
const RENEWED_ACCESS_TOKEN = `v1.session-renewed-access.${'a'.repeat(43)}`;
const NEXT_RENEWAL_TOKEN = `v1.session-next-renewal.${'b'.repeat(43)}`;

describe('auth BFF session renewal transport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('session route는 opaque access cookie가 인증 실패해도 renewal cookie로 rotate 후 session을 재조회한다', async () => {
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
            accessToken: RENEWED_ACCESS_TOKEN,
            renewalToken: NEXT_RENEWAL_TOKEN,
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
        Cookie: `auth-token=${EXPIRED_ACCESS_TOKEN}; auth-renewal-token=${CURRENT_RENEWAL_TOKEN}`,
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
    expect(response.cookies.get('auth-renewal-token')?.value).toBe(NEXT_RENEWAL_TOKEN);
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
    expect(response.cookies.get('auth-renewal-token')?.value).toBe(NEXT_RENEWAL_TOKEN);
  });
});
