import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAuthenticatedForwardPostHandler } from '../_post-route';

describe('auth BFF post route helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('authenticated post는 auth-token cookie를 Authorization으로 전달하고 upstream accessToken은 cookie로만 회전한다', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          accessToken: 'rotated-access-token',
          renewalToken: 'rotated-renewal-token',
          rememberMe: true,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const post = createAuthenticatedForwardPostHandler('/auth/change-password', {
      setAuthCookieFromAccessToken: true,
    });
    const request = new NextRequest('http://localhost/api/auth/change-password', {
      method: 'POST',
      headers: {
        Cookie: 'auth-token=current-access-token',
        'x-forwarded-for': '203.0.113.10',
        'user-agent': 'vitest',
      },
      body: JSON.stringify({
        currentPassword: 'OldPass1234',
        newPassword: 'NewPass1234',
      }),
    });

    const response = await post(request);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/auth/change-password',
      expect.objectContaining({
        method: 'POST',
        cache: 'no-store',
        body: JSON.stringify({
          currentPassword: 'OldPass1234',
          newPassword: 'NewPass1234',
        }),
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer current-access-token',
          'x-forwarded-for': '203.0.113.10',
          'user-agent': 'vitest',
        }),
      }),
    );
    await expect(response.json()).resolves.toEqual({ success: true });

    const cookie = response.cookies.get('auth-token');
    expect(cookie?.value).toBe('rotated-access-token');
    expect(cookie?.maxAge).toBe(60 * 60 * 24 * 7);
    const renewalCookie = response.cookies.get('auth-renewal-token');
    expect(renewalCookie?.value).toBe('rotated-renewal-token');
    expect(renewalCookie?.maxAge).toBe(60 * 60 * 24 * 7);
  });

  it('authenticated post 실패 응답은 upstream token-like fields를 노출하거나 cookie를 회전하지 않는다', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'AUTH_CURRENT_PASSWORD_INVALID',
          error: '현재 비밀번호가 올바르지 않습니다.',
          accessToken: 'must-not-leak',
          renewalToken: 'must-not-leak',
          rememberMe: true,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const post = createAuthenticatedForwardPostHandler('/auth/change-password', {
      setAuthCookieFromAccessToken: true,
    });
    const request = new NextRequest('http://localhost/api/auth/change-password', {
      method: 'POST',
      headers: {
        Cookie: 'auth-token=current-access-token',
      },
      body: JSON.stringify({
        currentPassword: 'WrongPass1234',
        newPassword: 'NewPass1234',
      }),
    });

    const response = await post(request);

    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'AUTH_CURRENT_PASSWORD_INVALID',
      error: '현재 비밀번호가 올바르지 않습니다.',
    });
    expect(response.cookies.get('auth-token')).toBeUndefined();
  });
});
