import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { changePasswordResponseSchema } from '@repo/shared/auth/response';
import { createAuthenticatedForwardPostHandler } from '@/auth/bff';

const CURRENT_ACCESS_TOKEN = `v1.session-current-access.${'c'.repeat(43)}`;
const ROTATED_ACCESS_TOKEN = `v1.session-rotated-access.${'a'.repeat(43)}`;
const ROTATED_RENEWAL_TOKEN = `v1.session-rotated-renewal.${'b'.repeat(43)}`;

describe('auth BFF post route helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('authenticated post는 opaque auth-token cookie를 Authorization으로 전달하고 upstream accessToken은 cookie로만 회전한다', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          accessToken: ROTATED_ACCESS_TOKEN,
          renewalToken: ROTATED_RENEWAL_TOKEN,
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
      responseSchema: changePasswordResponseSchema,
    });
    const request = new NextRequest('http://localhost/api/auth/change-password', {
      method: 'POST',
      headers: {
        Cookie: `auth-token=${CURRENT_ACCESS_TOKEN}`,
        'x-forwarded-for': '2001:0DB8:0:0:0:0:0:1',
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
          Authorization: `Bearer ${CURRENT_ACCESS_TOKEN}`,
          'x-forwarded-for': '2001:db8::1',
          'user-agent': 'vitest',
        }),
      }),
    );
    await expect(response.json()).resolves.toEqual({ success: true });

    const cookie = response.cookies.get('auth-token');
    expect(cookie?.value).toBe(ROTATED_ACCESS_TOKEN);
    expect(cookie?.maxAge).toBeUndefined();
    const renewalCookie = response.cookies.get('auth-renewal-token');
    expect(renewalCookie?.value).toBe(ROTATED_RENEWAL_TOKEN);
    expect(renewalCookie?.maxAge).toBe(60 * 60 * 24 * 7);
  });

  it('authenticated post 실패 응답은 upstream token-like fields를 노출하거나 cookie를 회전하지 않는다', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'AUTH_CURRENT_PASSWORD_INVALID',
          error: '현재 비밀번호가 올바르지 않습니다.',
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
      responseSchema: changePasswordResponseSchema,
    });
    const request = new NextRequest('http://localhost/api/auth/change-password', {
      method: 'POST',
      headers: {
        Cookie: `auth-token=${CURRENT_ACCESS_TOKEN}`,
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

  it('change-password private policy 거절은 generic field feedback만 보존한다', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'AUTH_PASSWORD_POLICY_VIOLATION',
          error: '다른 비밀번호를 입력해 주세요.',
          fieldErrors: {
            newPassword: '다른 비밀번호를 입력해 주세요.',
          },
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
      responseSchema: changePasswordResponseSchema,
    });
    const response = await post(
      new NextRequest('http://localhost/api/auth/change-password', {
        method: 'POST',
        headers: { Cookie: `auth-token=${CURRENT_ACCESS_TOKEN}` },
        body: JSON.stringify({
          currentPassword: 'OldPass1234',
          newPassword: 'Password1!',
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'AUTH_PASSWORD_POLICY_VIOLATION',
      error: '다른 비밀번호를 입력해 주세요.',
      fieldErrors: {
        newPassword: '다른 비밀번호를 입력해 주세요.',
      },
    });
    expect(response.cookies.get('auth-token')).toBeUndefined();
  });

  it('authenticated post는 failure 응답의 token-like field를 contract drift로 거부한다', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'AUTH_CURRENT_PASSWORD_INVALID',
          error: '현재 비밀번호가 올바르지 않습니다.',
          accessToken: 'must-not-leak',
          renewalToken: 'must-not-leak',
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
      responseSchema: changePasswordResponseSchema,
    });
    const response = await post(
      new NextRequest('http://localhost/api/auth/change-password', {
        method: 'POST',
        headers: { Cookie: `auth-token=${CURRENT_ACCESS_TOKEN}` },
        body: JSON.stringify({
          currentPassword: 'WrongPass1234',
          newPassword: 'NewPass1234',
        }),
      }),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'BFF_UPSTREAM_SCHEMA_MISMATCH',
    });
    expect(response.cookies.get('auth-token')).toBeUndefined();
  });
});
