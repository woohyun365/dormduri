import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST as postSendSignupCode } from '../send-signup-code/route';
import { POST as postValidateSignupNickname } from '../signup/validate-nickname/route';
import { POST as postVerifyEmailCode } from '../verify-email-code/route';

const VALID_EMAIL = 'student@kangwon.ac.kr';
const VALID_CODE = '123456';
const VALID_SIGNUP_GRANT = `v1.signup-code.${'s'.repeat(43)}`;
const NICKNAME_BODY = { nickname: '테스터' };

function request(path: string, body: unknown, cookie?: string) {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '203.0.113.10',
      'user-agent': 'vitest',
      ...(cookie ? { cookie } : {}),
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

describe('auth signup nickname and email verification BFF routes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('send-signup-code는 valid EmailRequest만 backend endpoint로 전달한다', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await postSendSignupCode(
      request('/api/auth/send-signup-code', { email: VALID_EMAIL }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/auth/send-signup-code',
      expect.objectContaining({ method: 'POST', cache: 'no-store' }),
    );
    const [, forwardedInit] = fetchCalls(fetchMock)[0]!;
    expect(JSON.parse(String(forwardedInit.body))).toEqual({ email: VALID_EMAIL });
    await expect(response.json()).resolves.toEqual({ success: true });
  });

  it('verify-email-code는 bounded signup grant를 HttpOnly cookie로만 저장한다', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            signupGrant: VALID_SIGNUP_GRANT,
            grantExpiresInSeconds: 900,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await postVerifyEmailCode(
      request('/api/auth/verify-email-code', { email: VALID_EMAIL, code: VALID_CODE }),
    );

    await expect(response.json()).resolves.toEqual({
      success: true,
      grantExpiresInSeconds: 900,
    });
    expect(response.cookies.get('signup-verification-grant')).toMatchObject({
      value: VALID_SIGNUP_GRANT,
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 900,
    });
  });

  it('signup nickname route는 nickname과 purpose grant만 backend로 전달한다', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ success: true, nickname: '테스터' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await postValidateSignupNickname(
      request(
        '/api/auth/signup/validate-nickname',
        NICKNAME_BODY,
        `signup-verification-grant=${VALID_SIGNUP_GRANT}`,
      ),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/auth/signup/validate-nickname',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(NICKNAME_BODY),
        headers: expect.objectContaining({
          'X-Auth-Verification-Grant': VALID_SIGNUP_GRANT,
        }),
      }),
    );
    await expect(response.json()).resolves.toEqual({ success: true, nickname: '테스터' });
  });

  it('nickname malformed JSON은 upstream 전에 endpoint error로 거부한다', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await postValidateSignupNickname(
      malformedRequest('/api/auth/signup/validate-nickname'),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'INVALID_SIGNUP_NICKNAME_REQUEST',
      userActionable: true,
    });
  });

  it('nickname 누락은 upstream 전에 INVALID_FIELD로 거부한다', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await postValidateSignupNickname(
      request('/api/auth/signup/validate-nickname', {}),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'INVALID_SIGNUP_NICKNAME_REQUEST',
      userActionable: true,
      fieldErrors: { nickname: 'INVALID_FIELD' },
    });
  });

  it('email/password/profile field는 nickname contract 외부 field로 거부한다', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await postValidateSignupNickname(
      request('/api/auth/signup/validate-nickname', {
        ...NICKNAME_BODY,
        email: VALID_EMAIL,
        password: 'pass1234',
        profile: { intro: 'forward 금지' },
      }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'INVALID_SIGNUP_NICKNAME_REQUEST',
      userActionable: true,
      fieldErrors: {
        email: 'FORBIDDEN_FIELD',
        password: 'FORBIDDEN_FIELD',
        profile: 'FORBIDDEN_FIELD',
      },
    });
  });
});
