import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST as postSendSignupCode } from '../send-signup-code/route';
import { POST as postSignupDraft } from '../validate-signup-draft/route';
import { POST as postVerifyEmailCode } from '../verify-email-code/route';

const VALID_EMAIL = 'student@kangwon.ac.kr';
const VALID_CODE = '123456';
const DRAFT_BODY = {
  email: VALID_EMAIL,
  password: 'pass1234',
  nickname: '테스터',
};

function request(path: string, body: unknown = DRAFT_BODY) {
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

describe('auth signup draft and email verification BFF routes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('send-signup-code는 valid EmailRequest만 backend signup code endpoint로 전달한다', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await postSendSignupCode(
      request('/api/auth/send-signup-code', { email: VALID_EMAIL }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/auth/send-signup-code',
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

  it('verify-email-code는 valid VerificationCodeRequest만 backend verify endpoint로 전달한다', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await postVerifyEmailCode(
      request('/api/auth/verify-email-code', { email: VALID_EMAIL, code: VALID_CODE }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/auth/verify-email-code',
      expect.objectContaining({ method: 'POST', cache: 'no-store' }),
    );
    const [, forwardedInit] = fetchCalls(fetchMock)[0]!;
    expect(JSON.parse(String(forwardedInit.body))).toEqual({
      email: VALID_EMAIL,
      code: VALID_CODE,
    });
    await expect(response.json()).resolves.toEqual({ success: true });
  });

  it('canonical validate-signup-draft route forwards to backend draft endpoint', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await postSignupDraft(request('/api/auth/validate-signup-draft'));

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/auth/validate-signup-draft',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(DRAFT_BODY),
      }),
    );
    await expect(response.json()).resolves.toEqual({ success: true });
  });

  it('signup code/draft malformed JSON body는 upstream 전송 전에 endpoint별 invalid request로 거부한다', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const sendResponse = await postSendSignupCode(malformedRequest('/api/auth/send-signup-code'));
    const verifyResponse = await postVerifyEmailCode(
      malformedRequest('/api/auth/verify-email-code'),
    );
    const draftResponse = await postSignupDraft(
      malformedRequest('/api/auth/validate-signup-draft'),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    await expect(sendResponse.json()).resolves.toEqual({
      success: false,
      code: 'INVALID_SIGNUP_CODE_REQUEST',
      userActionable: true,
    });
    await expect(verifyResponse.json()).resolves.toEqual({
      success: false,
      code: 'INVALID_VERIFY_EMAIL_CODE_REQUEST',
      userActionable: true,
    });
    await expect(draftResponse.json()).resolves.toEqual({
      success: false,
      code: 'INVALID_SIGNUP_DRAFT_REQUEST',
      userActionable: true,
    });
  });

  it('signup code/draft schema invalid field는 upstream 전송 전에 INVALID_FIELD로 거부한다', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const sendResponse = await postSendSignupCode(
      request('/api/auth/send-signup-code', { email: 'not-email' }),
    );
    const verifyResponse = await postVerifyEmailCode(
      request('/api/auth/verify-email-code', { email: VALID_EMAIL, code: 'abc' }),
    );
    const draftResponse = await postSignupDraft(
      request('/api/auth/validate-signup-draft', { email: VALID_EMAIL, nickname: '테스터' }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    await expect(sendResponse.json()).resolves.toEqual({
      success: false,
      code: 'INVALID_SIGNUP_CODE_REQUEST',
      userActionable: true,
      fieldErrors: { email: 'INVALID_FIELD' },
    });
    await expect(verifyResponse.json()).resolves.toEqual({
      success: false,
      code: 'INVALID_VERIFY_EMAIL_CODE_REQUEST',
      userActionable: true,
      fieldErrors: { code: 'INVALID_FIELD' },
    });
    await expect(draftResponse.json()).resolves.toEqual({
      success: false,
      code: 'INVALID_SIGNUP_DRAFT_REQUEST',
      userActionable: true,
      fieldErrors: { password: 'INVALID_FIELD' },
    });
  });

  it('signup code/draft contract 외부 field는 upstream 전송 전에 FORBIDDEN_FIELD로 거부한다', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const sendResponse = await postSendSignupCode(
      request('/api/auth/send-signup-code', {
        email: VALID_EMAIL,
        debugToken: 'must-not-forward',
      }),
    );
    const verifyResponse = await postVerifyEmailCode(
      request('/api/auth/verify-email-code', {
        email: VALID_EMAIL,
        code: VALID_CODE,
        verificationProof: 'must-not-forward',
      }),
    );
    const draftResponse = await postSignupDraft(
      request('/api/auth/validate-signup-draft', {
        ...DRAFT_BODY,
        lifestyle: { bedtime: 'BEFORE_12' },
        intro: '가입 전송에서 받으면 안 되는 프로필 문구입니다.',
      }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    await expect(sendResponse.json()).resolves.toEqual({
      success: false,
      code: 'INVALID_SIGNUP_CODE_REQUEST',
      userActionable: true,
      fieldErrors: { debugToken: 'FORBIDDEN_FIELD' },
    });
    await expect(verifyResponse.json()).resolves.toEqual({
      success: false,
      code: 'INVALID_VERIFY_EMAIL_CODE_REQUEST',
      userActionable: true,
      fieldErrors: { verificationProof: 'FORBIDDEN_FIELD' },
    });
    await expect(draftResponse.json()).resolves.toEqual({
      success: false,
      code: 'INVALID_SIGNUP_DRAFT_REQUEST',
      userActionable: true,
      fieldErrors: {
        lifestyle: 'FORBIDDEN_FIELD',
        intro: 'FORBIDDEN_FIELD',
      },
    });
  });
});
