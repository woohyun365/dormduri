import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpException, RequestMethod } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AUTH_LOGIN_THROTTLE_ENABLED_METADATA } from './login-attempts/network-throttle/auth-login-throttle.decorator.js';

const NEST_ROUTE_PATH_METADATA = 'path';
const NEST_ROUTE_METHOD_METADATA = 'method';
const RENEWAL_TOKEN = `v1.session-1.${'r'.repeat(43)}`;
const requestContext = { requestIp: '127.0.0.1', userAgent: 'jest-agent' };

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
    validateSignupNickname: vi.fn(),
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

  it('signup body는 legal acceptance version id를 포함해 service로 위임한다', async () => {
    authService.signup.mockResolvedValue({ success: true, accessToken: 'signup-token' });

    const body = {
      email: 'test@kangwon.ac.kr',
      password: 'Test1234',
      nickname: '테스터',
      gender: 'M',
      campus: 'CHUNCHEON',
      collegeCode: 'CHUNCHEON_IT',
      birthYear: 2002,
      legalAcceptances: {
        termsVersionId: 'terms-of-service-2026-06-22',
        personalDataConsentVersionId: 'personal-data-collection-use-consent-2026-06-22',
        ageNoticeVersionId: 'age-14-or-above-notice-2026-06-22',
        privacyPolicyVersionIdShown: 'privacy-policy-2026-06-22',
      },
    } as const;

    await expect(controller.signup(body, undefined, requestContext)).resolves.toEqual({
      success: true,
      accessToken: 'signup-token',
    });

    expect(authService.signup).toHaveBeenCalledWith(body, null, {
      requestIp: '127.0.0.1',
      userAgent: 'jest-agent',
    });
  });

  it('signup은 보안 감사에 사용할 request context를 registration owner로 전달한다', async () => {
    authService.signup.mockResolvedValue({ success: true, accessToken: 'signup-token' });

    const body = {
      email: 'test@kangwon.ac.kr',
      password: 'Test1234',
      nickname: '테스터',
      gender: 'M',
      campus: 'CHUNCHEON',
      collegeCode: 'CHUNCHEON_IT',
      birthYear: 2002,
      legalAcceptances: {
        termsVersionId: 'terms-of-service-2026-06-22',
        personalDataConsentVersionId: 'personal-data-collection-use-consent-2026-06-22',
        ageNoticeVersionId: 'age-14-or-above-notice-2026-06-22',
        privacyPolicyVersionIdShown: 'privacy-policy-2026-06-22',
      },
    } as const;
    await controller.signup(body, 'signup-grant', requestContext);

    expect(authService.signup).toHaveBeenCalledWith(body, 'signup-grant', {
      requestIp: '127.0.0.1',
      userAgent: 'jest-agent',
    });
  });

  it('signup nickname validation route는 /auth/signup/validate-nickname으로 노출된다', () => {
    const handler = getAuthControllerHandler('validateSignupNickname');

    expect(Reflect.getMetadata(NEST_ROUTE_PATH_METADATA, handler)).toBe('signup/validate-nickname');
    expect(Reflect.getMetadata(NEST_ROUTE_METHOD_METADATA, handler)).toBe(RequestMethod.POST);
  });

  it('signup submission budget 초과는 Retry-After가 있는 429로 변환한다', async () => {
    authService.signup.mockResolvedValue({
      success: false,
      code: 'AUTH_SIGNUP_SUBMISSION_THROTTLED',
      error: '가입 요청이 잠시 제한됐어요.',
      retryAfterSeconds: 420,
    });
    const body = {
      email: 'test@kangwon.ac.kr',
      password: 'Test1234',
      nickname: '테스터',
      gender: 'M',
      campus: 'CHUNCHEON',
      collegeCode: 'CHUNCHEON_IT',
      birthYear: 2002,
      legalAcceptances: {
        termsVersionId: 'terms-of-service-2026-06-22',
        personalDataConsentVersionId: 'personal-data-collection-use-consent-2026-06-22',
        ageNoticeVersionId: 'age-14-or-above-notice-2026-06-22',
        privacyPolicyVersionIdShown: 'privacy-policy-2026-06-22',
      },
    } as const;

    let failure: unknown;
    try {
      await controller.signup(body, 'signup-grant', requestContext);
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(HttpException);
    expect((failure as HttpException).getStatus()).toBe(429);
    expect((failure as HttpException).getResponse()).toMatchObject({
      success: false,
      code: 'AUTH_SIGNUP_SUBMISSION_THROTTLED',
      retryAfterSeconds: 420,
    });
  });

  it('named login IP throttles는 다른 auth route를 건드리지 않고 login에서만 활성화된다', () => {
    const loginHandler = getAuthControllerHandler('login');
    const signupHandler = getAuthControllerHandler('signup');

    expect(Reflect.getMetadata(AUTH_LOGIN_THROTTLE_ENABLED_METADATA, loginHandler)).toBe(true);
    expect(
      Reflect.getMetadata(AUTH_LOGIN_THROTTLE_ENABLED_METADATA, signupHandler),
    ).toBeUndefined();
  });

  it('password hash capacity 초과는 Retry-After가 있는 503으로 변환한다', async () => {
    authService.login.mockResolvedValue({
      success: false,
      code: 'AUTH_PASSWORD_HASH_CAPACITY_UNAVAILABLE',
      error: '비밀번호 처리가 잠시 지연되고 있어요.',
      userActionable: false,
      retryAfterSeconds: 2,
    });

    let failure: unknown;
    try {
      await controller.login(
        { email: 'test@kangwon.ac.kr', password: 'Password1234' },
        requestContext,
      );
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(HttpException);
    expect((failure as HttpException).getStatus()).toBe(503);
    expect((failure as HttpException).getResponse()).toMatchObject({
      code: 'AUTH_PASSWORD_HASH_CAPACITY_UNAVAILABLE',
      retryAfterSeconds: 2,
    });
  });

  it('validateSignupNickname은 nickname과 SIGNUP grant를 service로 위임한다', async () => {
    authService.validateSignupNickname.mockResolvedValue({
      success: true,
      nickname: '테스터',
    });

    await expect(
      controller.validateSignupNickname({ nickname: '테스터' }, 'signup-grant'),
    ).resolves.toEqual({ success: true, nickname: '테스터' });

    expect(authService.validateSignupNickname).toHaveBeenCalledWith('테스터', 'signup-grant');
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
        requestContext,
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

  it('changePassword session budget 초과는 Retry-After가 있는 429로 변환한다', async () => {
    authService.changePassword.mockResolvedValue({
      success: false,
      code: 'AUTH_CHANGE_PASSWORD_THROTTLED',
      error: '비밀번호 변경이 잠시 제한됐어요.',
      userActionable: false,
      retryAfterSeconds: 587,
    });

    let failure: unknown;
    try {
      await controller.changePassword(
        { currentPassword: 'OldPass1234', newPassword: 'NewPass1234' },
        { id: 'user-1', sessionId: 'session-1', gender: 'M', campus: 'CHUNCHEON' },
        requestContext,
      );
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(HttpException);
    expect((failure as HttpException).getStatus()).toBe(429);
    expect((failure as HttpException).getResponse()).toMatchObject({
      success: false,
      code: 'AUTH_CHANGE_PASSWORD_THROTTLED',
      retryAfterSeconds: 587,
    });
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
        requestContext,
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

    await expect(controller.session('current-access-token', requestContext)).resolves.toEqual({
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
    authService.getSession.mockResolvedValue({
      authenticated: false,
      reason: 'MISSING_TOKEN',
    });

    await expect(controller.session(null, requestContext)).resolves.toEqual({
      authenticated: false,
      reason: 'MISSING_TOKEN',
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
          renewalToken: RENEWAL_TOKEN,
        },
        requestContext,
      ),
    ).resolves.toEqual({ success: true });

    expect(authService.logout).toHaveBeenCalledWith('current-access-token', RENEWAL_TOKEN, {
      requestIp: '127.0.0.1',
      userAgent: 'jest-agent',
    });
  });

  it('logout request는 token이 없는 빈 body도 idempotent success로 위임한다', async () => {
    authService.logout.mockResolvedValue({ success: true });

    await expect(controller.logout(null, {}, requestContext)).resolves.toEqual({
      success: true,
    });

    expect(authService.logout).toHaveBeenCalledWith(null, null, {
      requestIp: '127.0.0.1',
      userAgent: 'jest-agent',
    });
  });
});
