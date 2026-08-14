import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUTH_RESET_RESTART_REQUIRED_CODE } from '@repo/shared/auth/response';
import { POST as postResetPassword } from '../reset-password/route';
import { POST as postSendResetCode } from '../send-reset-code/route';
import { POST as postVerifyResetCode } from '../verify-reset-code/route';

const VALID_EMAIL = 'student@kangwon.ac.kr';
const VALID_CODE = '123456';
const VALID_PASSWORD = 'NewPass1234';
const VALID_GRANT = `v1.reset-code.${'g'.repeat(43)}`;

function request(path: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '203.0.113.10',
      'user-agent': 'vitest',
    },
    body: JSON.stringify(body),
  });
}

function malformedRequest(path: string) {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{invalid-json',
  });
}

function fetchCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
}

describe('auth password reset BFF routes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('send-reset-code는 valid EmailRequest만 upstream으로 전달한다', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await postSendResetCode(
      request('/api/auth/send-reset-code', { email: VALID_EMAIL }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/auth/send-reset-code',
      expect.objectContaining({
        method: 'POST',
        cache: 'no-store',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-forwarded-for': '203.0.113.10',
          'user-agent': 'vitest',
        }),
      }),
    );
    const [, forwardedInit] = fetchCalls(fetchMock)[0]!;
    expect(JSON.parse(String(forwardedInit.body))).toEqual({ email: VALID_EMAIL });
    await expect(response.json()).resolves.toEqual({ success: true });
  });

  it('verify-reset-code는 valid VerificationCodeRequest만 upstream으로 전달한다', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          resetGrant: VALID_GRANT,
          grantExpiresInSeconds: 900,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await postVerifyResetCode(
      request('/api/auth/verify-reset-code', { email: VALID_EMAIL, code: VALID_CODE }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/auth/verify-reset-code',
      expect.objectContaining({ method: 'POST', cache: 'no-store' }),
    );
    const [, forwardedInit] = fetchCalls(fetchMock)[0]!;
    expect(JSON.parse(String(forwardedInit.body))).toEqual({
      email: VALID_EMAIL,
      code: VALID_CODE,
    });
    await expect(response.json()).resolves.toEqual({
      success: true,
      grantExpiresInSeconds: 900,
    });
  });

  it('인증 성공은 제한 grant를 HttpOnly cookie로 옮기고 browser response에는 만료 시간만 공개한다', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          resetGrant: VALID_GRANT,
          grantExpiresInSeconds: 900,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await postVerifyResetCode(
      request('/api/auth/verify-reset-code', { email: VALID_EMAIL, code: VALID_CODE }),
    );

    await expect(response.json()).resolves.toEqual({
      success: true,
      grantExpiresInSeconds: 900,
    });
    expect(response.cookies.get('password-reset-grant')).toMatchObject({
      value: VALID_GRANT,
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 900,
    });
  });

  it('reset-password는 valid ResetPasswordRequest만 upstream으로 전달하고 성공 시 auth cookies를 clear한다', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await postResetPassword(
      request('/api/auth/reset-password', { newPassword: VALID_PASSWORD }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/auth/reset-password',
      expect.objectContaining({ method: 'POST', cache: 'no-store' }),
    );
    const [, forwardedInit] = fetchCalls(fetchMock)[0]!;
    expect(JSON.parse(String(forwardedInit.body))).toEqual({ newPassword: VALID_PASSWORD });
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(response.cookies.get('auth-token')?.value).toBe('');
    expect(response.cookies.get('auth-token')?.maxAge).toBe(0);
    expect(response.cookies.get('auth-renewal-token')?.value).toBe('');
    expect(response.cookies.get('auth-renewal-token')?.maxAge).toBe(0);
  });

  it('reset browser request는 email 없이 제한 grant cookie로 subject authority를 전달한다', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await postResetPassword(
      new NextRequest('http://localhost/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `password-reset-grant=${VALID_GRANT}`,
        },
        body: JSON.stringify({ newPassword: VALID_PASSWORD }),
      }),
    );

    expect(response.status).toBe(200);
    const [, forwardedInit] = fetchCalls(fetchMock)[0]!;
    expect(JSON.parse(String(forwardedInit.body))).toEqual({
      newPassword: VALID_PASSWORD,
    });
    expect(new Headers(forwardedInit.headers).get('X-Auth-Verification-Grant')).toBe(VALID_GRANT);
  });

  it('reset grant가 stale/replay 상태이면 공통 restart code를 보존하고 grant cookie를 제거한다', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          success: false,
          code: AUTH_RESET_RESTART_REQUIRED_CODE,
          error: '비밀번호 재설정 요청을 다시 진행해주세요.',
          userActionable: true,
        }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await postResetPassword(
      new NextRequest('http://localhost/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `password-reset-grant=${VALID_GRANT}`,
        },
        body: JSON.stringify({ newPassword: VALID_PASSWORD }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: AUTH_RESET_RESTART_REQUIRED_CODE,
      error: '비밀번호 재설정 요청을 다시 진행해주세요.',
      userActionable: true,
    });
    expect(response.cookies.get('password-reset-grant')?.value).toBe('');
    expect(response.cookies.get('password-reset-grant')?.maxAge).toBe(0);
  });

  it('malformed JSON body는 reset upstream 전송 전에 endpoint별 invalid request로 거부한다', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const sendResponse = await postSendResetCode(malformedRequest('/api/auth/send-reset-code'));
    const verifyResponse = await postVerifyResetCode(
      malformedRequest('/api/auth/verify-reset-code'),
    );
    const resetResponse = await postResetPassword(malformedRequest('/api/auth/reset-password'));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(sendResponse.status).toBe(400);
    await expect(sendResponse.json()).resolves.toEqual({
      success: false,
      code: 'INVALID_RESET_CODE_REQUEST',
      userActionable: true,
    });
    expect(verifyResponse.status).toBe(400);
    await expect(verifyResponse.json()).resolves.toEqual({
      success: false,
      code: 'INVALID_VERIFY_RESET_CODE_REQUEST',
      userActionable: true,
    });
    expect(resetResponse.status).toBe(400);
    await expect(resetResponse.json()).resolves.toEqual({
      success: false,
      code: 'INVALID_RESET_PASSWORD_REQUEST',
      userActionable: true,
    });
  });

  it('schema invalid field는 reset upstream 전송 전에 INVALID_FIELD로 거부한다', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const sendResponse = await postSendResetCode(
      request('/api/auth/send-reset-code', { email: 'not-email' }),
    );
    const verifyResponse = await postVerifyResetCode(
      request('/api/auth/verify-reset-code', { email: VALID_EMAIL, code: 'abc' }),
    );
    const resetResponse = await postResetPassword(
      request('/api/auth/reset-password', { newPassword: '' }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    await expect(sendResponse.json()).resolves.toEqual({
      success: false,
      code: 'INVALID_RESET_CODE_REQUEST',
      userActionable: true,
      fieldErrors: { email: 'INVALID_FIELD' },
    });
    await expect(verifyResponse.json()).resolves.toEqual({
      success: false,
      code: 'INVALID_VERIFY_RESET_CODE_REQUEST',
      userActionable: true,
      fieldErrors: { code: 'INVALID_FIELD' },
    });
    await expect(resetResponse.json()).resolves.toEqual({
      success: false,
      code: 'INVALID_RESET_PASSWORD_REQUEST',
      userActionable: true,
      fieldErrors: { newPassword: 'INVALID_FIELD' },
    });
  });

  it('send/verify reset contract 외부 field는 upstream 전송 전에 FORBIDDEN_FIELD로 거부한다', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const sendResponse = await postSendResetCode(
      request('/api/auth/send-reset-code', {
        email: VALID_EMAIL,
        debugToken: 'must-not-forward',
      }),
    );
    const verifyResponse = await postVerifyResetCode(
      request('/api/auth/verify-reset-code', {
        email: VALID_EMAIL,
        code: VALID_CODE,
        verificationProof: 'must-not-forward',
      }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    await expect(sendResponse.json()).resolves.toEqual({
      success: false,
      code: 'INVALID_RESET_CODE_REQUEST',
      userActionable: true,
      fieldErrors: { debugToken: 'FORBIDDEN_FIELD' },
    });
    await expect(verifyResponse.json()).resolves.toEqual({
      success: false,
      code: 'INVALID_VERIFY_RESET_CODE_REQUEST',
      userActionable: true,
      fieldErrors: { verificationProof: 'FORBIDDEN_FIELD' },
    });
  });

  it('reset contract 외부 field는 upstream 전송 전에 FORBIDDEN_FIELD로 거부한다', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await postResetPassword(
      request('/api/auth/reset-password', {
        newPassword: VALID_PASSWORD,
        profile: { intro: 'reset route에서 받으면 안 되는 profile field입니다.' },
        debugToken: 'must-not-forward',
        admin: true,
        verificationProof: 'must-not-forward',
      }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'INVALID_RESET_PASSWORD_REQUEST',
      userActionable: true,
      fieldErrors: {
        profile: 'FORBIDDEN_FIELD',
        debugToken: 'FORBIDDEN_FIELD',
        admin: 'FORBIDDEN_FIELD',
        verificationProof: 'FORBIDDEN_FIELD',
      },
    });
  });

  it('reset browser contract는 email 재전송을 거부한다', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await postResetPassword(
      request('/api/auth/reset-password', {
        email: VALID_EMAIL,
        newPassword: VALID_PASSWORD,
      }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: 'INVALID_RESET_PASSWORD_REQUEST',
      fieldErrors: { email: 'FORBIDDEN_FIELD' },
    });
  });

  it('failure response는 upstream token-like/raw reset fields를 노출하지 않고 Retry-After header를 보존한다', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'AUTH_CODE_REQUEST_THROTTLED',
          error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
          retryAfterSeconds: 45,
          accessToken: 'must-not-leak',
          renewalToken: 'must-not-leak',
          authorization: 'must-not-leak',
          verificationCode: '123456',
          verificationProof: 'must-not-leak',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '45',
          },
        },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await postResetPassword(
      request('/api/auth/reset-password', { newPassword: VALID_PASSWORD }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('45');
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'AUTH_CODE_REQUEST_THROTTLED',
      error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
      retryAfterSeconds: 45,
    });
  });
});
