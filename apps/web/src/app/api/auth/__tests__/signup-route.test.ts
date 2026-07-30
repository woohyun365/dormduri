import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST as postSignup } from '../signup/route';

const ACCESS_TOKEN = `v1.session-signup-access.${'a'.repeat(43)}`;
const RENEWAL_TOKEN = `v1.session-signup-renewal.${'b'.repeat(43)}`;
const SIGNUP_GRANT = `v1.signup-code.${'g'.repeat(43)}`;

const VALID_SIGNUP_BODY = {
  email: 'student@kangwon.ac.kr',
  password: 'pass1234',
  nickname: '테스터',
  gender: 'M',
  campus: 'CHUNCHEON',
  collegeCode: 'CHUNCHEON_IT',
  birthYear: 2001,
  legalAcceptances: {
    termsVersionId: 'terms-2026-06-22',
    personalDataConsentVersionId: 'personal-data-2026-06-22',
    ageNoticeVersionId: 'age-2026-06-22',
    privacyPolicyVersionIdShown: 'privacy-2026-06-22',
  },
};

function request(body: unknown, cookie?: string) {
  return new NextRequest('http://localhost/api/auth/signup', {
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

describe('auth signup BFF route', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('valid SignupRequest는 browser-session access/renewal cookie를 설정한다', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          accessToken: ACCESS_TOKEN,
          renewalToken: RENEWAL_TOKEN,
          rememberMe: false,
          user: {
            id: 'user-1',
            email: VALID_SIGNUP_BODY.email,
            nickname: VALID_SIGNUP_BODY.nickname,
            gender: 'M',
            campus: 'CHUNCHEON',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await postSignup(
      request(VALID_SIGNUP_BODY, `signup-verification-grant=${SIGNUP_GRANT}`),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/auth/signup',
      expect.objectContaining({
        method: 'POST',
        cache: 'no-store',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-forwarded-for': '203.0.113.10',
          'user-agent': 'vitest',
          'X-Auth-Verification-Grant': SIGNUP_GRANT,
        }),
      }),
    );
    const fetchCalls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    const [, forwardedInit] = fetchCalls[0]!;
    const forwardedBody = JSON.parse(String(forwardedInit.body));
    expect(forwardedBody).toEqual(VALID_SIGNUP_BODY);
    expect(forwardedBody).not.toHaveProperty('lifestyle');
    expect(forwardedBody).not.toHaveProperty('intro');

    await expect(response.json()).resolves.toEqual({
      success: true,
      user: {
        id: 'user-1',
        email: VALID_SIGNUP_BODY.email,
        nickname: VALID_SIGNUP_BODY.nickname,
        gender: 'M',
        campus: 'CHUNCHEON',
      },
    });
    expect(response.cookies.get('auth-token')?.value).toBe(ACCESS_TOKEN);
    expect(response.cookies.get('auth-token')?.maxAge).toBeUndefined();
    expect(response.cookies.get('auth-renewal-token')?.value).toBe(RENEWAL_TOKEN);
    expect(response.cookies.get('auth-renewal-token')?.maxAge).toBeUndefined();
    expect(response.cookies.get('signup-verification-grant')?.value).toBe('');
    expect(response.cookies.get('signup-verification-grant')?.maxAge).toBe(0);
  });

  it('lifestyle/intro 같은 signup 외부 profile field는 upstream 전송 전에 거부한다', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await postSignup(
      request({
        ...VALID_SIGNUP_BODY,
        lifestyle: { bedtime: 'BEFORE_12' },
        intro: '가입 단계에서 보내면 안 되는 자기소개입니다.',
      }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'INVALID_SIGNUP_REQUEST',
      userActionable: true,
      fieldErrors: {
        lifestyle: 'FORBIDDEN_FIELD',
        intro: 'FORBIDDEN_FIELD',
      },
    });
  });

  it('collegeCode/birthYear가 없으면 upstream 전송 전에 거부한다', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const body: Record<string, unknown> = { ...VALID_SIGNUP_BODY };
    delete body.collegeCode;
    delete body.birthYear;

    const response = await postSignup(request(body));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'INVALID_SIGNUP_REQUEST',
      userActionable: true,
      fieldErrors: {
        collegeCode: 'INVALID_FIELD',
        birthYear: 'INVALID_FIELD',
      },
    });
  });

  it('malformed JSON body는 upstream 전송 전에 안전한 invalid request로 거부한다', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await postSignup(
      new NextRequest('http://localhost/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid-json',
      }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'INVALID_SIGNUP_REQUEST',
      userActionable: true,
    });
  });
});
