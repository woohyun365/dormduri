import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST as postLogin } from '../login/route';

const ACCESS_TOKEN = `v1.session-login-access.${'a'.repeat(43)}`;
const RENEWAL_TOKEN = `v1.session-login-renewal.${'b'.repeat(43)}`;

const VALID_LOGIN_BODY = {
  email: 'student@kangwon.ac.kr',
  password: 'pass1234',
  rememberMe: false,
};

function request(body: unknown, headers?: Record<string, string>) {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '203.0.113.10',
      'user-agent': 'vitest',
      ...(headers ?? {}),
    },
    body: JSON.stringify(body),
  });
}

describe('auth login BFF route', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('valid LoginRequest는 upstream auth login으로 allowlist body만 전달하고 민감 caller header를 forwarding하지 않는다', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'AUTH_INVALID_CREDENTIALS',
          error: '이메일 또는 비밀번호가 올바르지 않습니다.',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await postLogin(
      request(VALID_LOGIN_BODY, {
        Cookie: 'auth-token=must-not-forward',
        Authorization: 'Bearer must-not-forward',
        'x-api-key': 'must-not-forward',
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/auth/login',
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

    const fetchCalls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    const [, forwardedInit] = fetchCalls[0]!;
    expect(JSON.parse(String(forwardedInit.body))).toEqual(VALID_LOGIN_BODY);
    expect(forwardedInit.headers).not.toHaveProperty('Cookie');
    expect(forwardedInit.headers).not.toHaveProperty('Authorization');
    expect(forwardedInit.headers).not.toHaveProperty('x-api-key');
    expect(response.status).toBe(200);
  });

  it('malformed JSON body는 upstream 전송 전에 안전한 invalid request로 거부한다', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await postLogin(
      new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid-json',
      }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'INVALID_LOGIN_REQUEST',
      userActionable: true,
    });
  });

  it('login contract 외부 field는 upstream 전송 전에 FORBIDDEN_FIELD로 거부한다', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await postLogin(
      request({
        ...VALID_LOGIN_BODY,
        profile: { intro: 'login route에서 받으면 안 되는 profile field입니다.' },
        admin: true,
        debugToken: 'must-not-forward',
      }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'INVALID_LOGIN_REQUEST',
      userActionable: true,
      fieldErrors: {
        profile: 'FORBIDDEN_FIELD',
        admin: 'FORBIDDEN_FIELD',
        debugToken: 'FORBIDDEN_FIELD',
      },
    });
  });

  it('schema invalid field는 upstream 전송 전에 INVALID_FIELD로 거부한다', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await postLogin(
      request({ email: 'not-email', password: '', rememberMe: true }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'INVALID_LOGIN_REQUEST',
      userActionable: true,
      fieldErrors: {
        email: 'INVALID_FIELD',
        password: 'INVALID_FIELD',
      },
    });
  });

  it('rememberMe=false 성공은 accessToken을 cookie로만 설정하고 renewal cookie를 만료한다', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          accessToken: ACCESS_TOKEN,
          renewalToken: RENEWAL_TOKEN,
          user: {
            id: 'user-1',
            email: VALID_LOGIN_BODY.email,
            nickname: '테스터',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await postLogin(request(VALID_LOGIN_BODY));

    await expect(response.json()).resolves.toEqual({
      success: true,
      user: {
        id: 'user-1',
        email: VALID_LOGIN_BODY.email,
        nickname: '테스터',
      },
    });
    expect(response.cookies.get('auth-token')?.value).toBe(ACCESS_TOKEN);
    expect(response.cookies.get('auth-renewal-token')?.value).toBe('');
    expect(response.cookies.get('auth-renewal-token')?.maxAge).toBe(0);
  });

  it('rememberMe=true 성공은 access/renewal token을 cookie로만 설정한다', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          accessToken: ACCESS_TOKEN,
          renewalToken: RENEWAL_TOKEN,
          user: { id: 'user-1', email: VALID_LOGIN_BODY.email },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await postLogin(request({ ...VALID_LOGIN_BODY, rememberMe: true }));

    await expect(response.json()).resolves.toEqual({
      success: true,
      user: { id: 'user-1', email: VALID_LOGIN_BODY.email },
    });
    expect(response.cookies.get('auth-token')?.value).toBe(ACCESS_TOKEN);
    expect(response.cookies.get('auth-token')?.maxAge).toBe(60 * 60 * 24 * 7);
    expect(response.cookies.get('auth-renewal-token')?.value).toBe(RENEWAL_TOKEN);
    expect(response.cookies.get('auth-renewal-token')?.maxAge).toBe(60 * 60 * 24 * 7);
  });

  it('failure 응답은 upstream token-like fields를 노출하거나 cookie를 설정하지 않는다', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'AUTH_INVALID_CREDENTIALS',
          error: '이메일 또는 비밀번호가 올바르지 않습니다.',
          accessToken: 'must-not-leak',
          renewalToken: 'must-not-leak',
          authorization: 'must-not-leak',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await postLogin(request(VALID_LOGIN_BODY));

    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'AUTH_INVALID_CREDENTIALS',
      error: '이메일 또는 비밀번호가 올바르지 않습니다.',
    });
    expect(response.cookies.get('auth-token')).toBeUndefined();
    expect(response.cookies.get('auth-renewal-token')).toBeUndefined();
  });

  it('upstream Retry-After header를 BFF response에 보존한다', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'TOO_MANY_REQUESTS',
          error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '31',
          },
        },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await postLogin(request(VALID_LOGIN_BODY));

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('31');
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'TOO_MANY_REQUESTS',
      error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    });
  });
});
