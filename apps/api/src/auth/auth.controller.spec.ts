import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, RequestMethod } from '@nestjs/common';
import { AuthController } from './auth.controller.js';

const NEST_ROUTE_PATH_METADATA = 'path';
const NEST_ROUTE_METHOD_METADATA = 'method';
const request = {
  ip: '127.0.0.1',
  headers: { 'user-agent': 'jest-agent' },
  get: (name: string) => (name.toLowerCase() === 'user-agent' ? 'jest-agent' : undefined),
};

function getBadRequestResponse(error: unknown) {
  expect(error).toBeInstanceOf(BadRequestException);

  if (!(error instanceof BadRequestException)) {
    throw new Error('Expected BadRequestException');
  }

  const response = error.getResponse();
  expect(typeof response).toBe('object');
  expect(response).not.toBeNull();

  if (typeof response !== 'object' || response === null) {
    throw new Error('Expected object response');
  }

  return response as {
    code: string;
    formErrors?: string[];
    fieldErrors?: Record<string, string[]>;
    details?: Array<{ path: string }>;
  };
}

type RouteHandler = object & ((...args: never[]) => unknown);

function getAuthControllerHandler(methodName: keyof AuthController): RouteHandler {
  const descriptor = Object.getOwnPropertyDescriptor(AuthController.prototype, methodName);
  const handler: unknown = descriptor?.value;

  if (typeof handler !== 'function') {
    throw new Error(`Expected ${methodName} handler`);
  }

  return handler as RouteHandler;
}

describe('AuthController', () => {
  const authService = {
    sendSignupCode: vi.fn(),
    sendResetCode: vi.fn(),
    verifyEmailCode: vi.fn(),
    verifyResetCode: vi.fn(),
    getSession: vi.fn(),
    validateSignupDraft: vi.fn(),
    signup: vi.fn(),
    login: vi.fn(),
    resetPassword: vi.fn(),
    changePassword: vi.fn(),
    renewSession: vi.fn(),
    logout: vi.fn(),
  };

  const controller = new AuthController(authService as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('body가 없을 때 bad request 예외를 던진다', async () => {
    try {
      await controller.sendResetCode(undefined, { ip: null } as never);
    } catch (error) {
      const response = getBadRequestResponse(error);

      expect(response.code).toBe('INVALID_REQUEST_BODY');
      expect(response.formErrors?.length).toBeGreaterThan(0);
      expect(response.details?.some((detail) => detail.path === '')).toBe(true);
    }

    await expect(controller.login(undefined, request as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('필드 누락 body는 fieldErrors를 포함한다', async () => {
    try {
      await controller.login({}, request as never);
    } catch (error) {
      const response = getBadRequestResponse(error);

      expect(response.code).toBe('INVALID_REQUEST_BODY');
      expect(response.fieldErrors?.email?.length).toBeGreaterThan(0);
      expect(response.fieldErrors?.password?.length).toBeGreaterThan(0);
    }
  });

  it('signup body는 season profile orchestration 필드를 거부한다', async () => {
    await expect(
      controller.signup({
        email: 'test@kangwon.ac.kr',
        password: 'Test1234',
        nickname: '테스터',
        gender: 'M',
        campus: 'CHUNCHEON',
        collegeCode: 'IT',
        birthYear: 2002,
        legalAcceptances: {
          termsVersionId: 'terms-2026-06-22',
          personalDataConsentVersionId: 'collection-use-2026-06-22',
          ageNoticeVersionId: 'age-2026-06-22',
          privacyPolicyVersionIdShown: 'privacy-2026-06-22',
        },
        lifestyle: {},
        intro: '가입 단계 소개',
        additional: { grade: 2 },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(authService.signup).not.toHaveBeenCalled();
  });

  it('signup body는 legal acceptance version id를 포함해 service로 위임한다', async () => {
    authService.signup.mockResolvedValue({ success: true, accessToken: 'signup-token' });

    const body = {
      email: 'test@kangwon.ac.kr',
      password: 'Test1234',
      nickname: '테스터',
      gender: 'M',
      campus: 'CHUNCHEON',
      collegeCode: 'IT',
      birthYear: 2002,
      legalAcceptances: {
        termsVersionId: 'terms-2026-06-22',
        personalDataConsentVersionId: 'collection-use-2026-06-22',
        ageNoticeVersionId: 'age-2026-06-22',
        privacyPolicyVersionIdShown: 'privacy-2026-06-22',
      },
    } as const;

    await expect(controller.signup(body)).resolves.toEqual({
      success: true,
      accessToken: 'signup-token',
    });

    expect(authService.signup).toHaveBeenCalledWith(body);
  });

  it('signup draft validation route는 /auth/validate-signup-draft로 노출된다', () => {
    const handler = getAuthControllerHandler('validateSignupDraft');

    expect(Reflect.getMetadata(NEST_ROUTE_PATH_METADATA, handler)).toBe('validate-signup-draft');
    expect(Reflect.getMetadata(NEST_ROUTE_METHOD_METADATA, handler)).toBe(RequestMethod.POST);
  });

  it('validateSignupDraft는 email/password/nickname draft body를 parse해 service로 위임한다', async () => {
    authService.validateSignupDraft.mockResolvedValue({ success: true });

    await expect(
      controller.validateSignupDraft({
        email: 'test@kangwon.ac.kr',
        password: 'Test1234',
        nickname: '테스터',
      }),
    ).resolves.toEqual({ success: true });

    expect(authService.validateSignupDraft).toHaveBeenCalledWith({
      email: 'test@kangwon.ac.kr',
      password: 'Test1234',
      nickname: '테스터',
    });
  });

  it('validateSignupDraft는 lifestyle/intro/profile field를 signup draft request에서 거부한다', async () => {
    await expect(
      controller.validateSignupDraft({
        email: 'test@kangwon.ac.kr',
        password: 'Test1234',
        nickname: '테스터',
        lifestyle: {},
        intro: '가입 단계 소개',
        additional: { grade: 2 },
        profile: { intro: 'signup 단계 프로필' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(authService.validateSignupDraft).not.toHaveBeenCalled();
  });

  it('changePassword route는 /auth/change-password로 노출되고 authenticated user context를 service로 전달한다', async () => {
    authService.changePassword.mockResolvedValue({
      success: true,
      accessToken: 'rotated-token',
      rememberMe: false,
    });

    const handler = getAuthControllerHandler('changePassword');

    expect(Reflect.getMetadata(NEST_ROUTE_PATH_METADATA, handler)).toBe('change-password');
    expect(Reflect.getMetadata(NEST_ROUTE_METHOD_METADATA, handler)).toBe(RequestMethod.POST);

    await expect(
      controller.changePassword(
        {
          currentPassword: 'OldPass1234',
          newPassword: 'NewPass1234',
        },
        { id: 'user-1', sessionId: 'session-1', gender: 'M', campus: 'CHUNCHEON' },
        request as never,
      ),
    ).resolves.toEqual({
      success: true,
      accessToken: 'rotated-token',
      rememberMe: false,
    });

    expect(authService.changePassword).toHaveBeenCalledWith(
      { id: 'user-1', sessionId: 'session-1', gender: 'M', campus: 'CHUNCHEON' },
      'OldPass1234',
      'NewPass1234',
      { requestIp: '127.0.0.1', userAgent: 'jest-agent' },
    );
  });

  it('renewSession route는 /auth/renew-session으로 노출되고 renewalToken만 service로 전달한다', async () => {
    authService.renewSession.mockResolvedValue({
      success: true,
      accessToken: 'renewed-access-token',
      renewalToken: 'next-renewal-token',
      rememberMe: true,
    });

    const handler = getAuthControllerHandler('renewSession');

    expect(Reflect.getMetadata(NEST_ROUTE_PATH_METADATA, handler)).toBe('renew-session');
    expect(Reflect.getMetadata(NEST_ROUTE_METHOD_METADATA, handler)).toBe(RequestMethod.POST);

    await expect(
      controller.renewSession(
        {
          renewalToken: 'v1.session-1.renewal-token',
        },
        request as never,
      ),
    ).resolves.toEqual({
      success: true,
      accessToken: 'renewed-access-token',
      renewalToken: 'next-renewal-token',
      rememberMe: true,
    });

    expect(authService.renewSession).toHaveBeenCalledWith('v1.session-1.renewal-token', {
      requestIp: '127.0.0.1',
      userAgent: 'jest-agent',
    });
  });

  it('session route는 guard/decorator가 주입한 access token을 service로 전달한다', async () => {
    authService.getSession.mockResolvedValue({
      authenticated: true,
      user: {
        id: 'user-1',
        email: 'test@kangwon.ac.kr',
        nickname: '테스터',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
    });

    await expect(controller.session('current-access-token', request as never)).resolves.toEqual({
      authenticated: true,
      user: {
        id: 'user-1',
        email: 'test@kangwon.ac.kr',
        nickname: '테스터',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
    });

    expect(authService.getSession).toHaveBeenCalledWith('current-access-token', {
      requestIp: '127.0.0.1',
      userAgent: 'jest-agent',
    });
  });

  it('session route는 optional token이 null이면 unauthenticated session 조회를 위임한다', async () => {
    authService.getSession.mockResolvedValue({ authenticated: false });

    await expect(controller.session(null, request as never)).resolves.toEqual({
      authenticated: false,
    });

    expect(authService.getSession).toHaveBeenCalledWith(null, {
      requestIp: '127.0.0.1',
      userAgent: 'jest-agent',
    });
  });

  it('logout은 access token과 renewal token을 함께 revoke 후보로 전달한다', async () => {
    authService.logout.mockResolvedValue({ success: true });

    await expect(
      controller.logout(
        'current-access-token',
        {
          renewalToken: 'v1.session-1.renewal-token',
        },
        request as never,
      ),
    ).resolves.toEqual({ success: true });

    expect(authService.logout).toHaveBeenCalledWith(
      'current-access-token',
      'v1.session-1.renewal-token',
      { requestIp: '127.0.0.1', userAgent: 'jest-agent' },
    );
  });
});
