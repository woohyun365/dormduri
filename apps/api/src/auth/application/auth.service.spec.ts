import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';

describe('AuthService facade', () => {
  const verificationUseCases = {
    sendSignupCode: vi.fn(),
    sendResetCode: vi.fn(),
    verifyEmailCode: vi.fn(),
    verifyResetCode: vi.fn(),
  };
  const registrationUseCases = {
    validateSignupDraft: vi.fn(),
    signup: vi.fn(),
  };
  const credentialUseCases = {
    login: vi.fn(),
    resetPassword: vi.fn(),
    changePassword: vi.fn(),
  };
  const sessionUseCases = {
    getSession: vi.fn(),
    renewSession: vi.fn(),
    logout: vi.fn(),
  };
  const service = new AuthService(
    verificationUseCases as never,
    registrationUseCases as never,
    credentialUseCases as never,
    sessionUseCases as never,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates verification and session read methods to their slice use-case providers', async () => {
    const requestContext = { requestIp: '127.0.0.1', userAgent: 'jest' };
    verificationUseCases.sendSignupCode.mockResolvedValueOnce({ success: true });
    verificationUseCases.sendResetCode.mockResolvedValueOnce({ success: true });
    verificationUseCases.verifyEmailCode.mockResolvedValueOnce({ success: true });
    verificationUseCases.verifyResetCode.mockResolvedValueOnce({ success: true });
    sessionUseCases.getSession.mockResolvedValueOnce({ authenticated: false });

    await expect(service.sendSignupCode('test@kangwon.ac.kr', requestContext)).resolves.toEqual({
      success: true,
    });
    await expect(service.sendResetCode('test@kangwon.ac.kr', requestContext)).resolves.toEqual({
      success: true,
    });
    await expect(
      service.verifyEmailCode('test@kangwon.ac.kr', '123456', requestContext),
    ).resolves.toEqual({ success: true });
    await expect(
      service.verifyResetCode('test@kangwon.ac.kr', '123456', requestContext),
    ).resolves.toEqual({ success: true });
    await expect(service.getSession('access-token', requestContext)).resolves.toEqual({
      authenticated: false,
    });

    expect(verificationUseCases.sendSignupCode).toHaveBeenCalledWith(
      'test@kangwon.ac.kr',
      requestContext,
    );
    expect(verificationUseCases.sendResetCode).toHaveBeenCalledWith(
      'test@kangwon.ac.kr',
      requestContext,
    );
    expect(verificationUseCases.verifyEmailCode).toHaveBeenCalledWith(
      'test@kangwon.ac.kr',
      '123456',
      requestContext,
    );
    expect(verificationUseCases.verifyResetCode).toHaveBeenCalledWith(
      'test@kangwon.ac.kr',
      '123456',
      requestContext,
    );
    expect(sessionUseCases.getSession).toHaveBeenCalledWith('access-token', requestContext);
  });

  it('delegates registration and credential mutation methods to their slice use-case providers', async () => {
    const requestContext = { requestIp: '127.0.0.1', userAgent: 'jest' };
    const signupInput = {
      email: 'test@kangwon.ac.kr',
      password: 'Pass1234',
      nickname: '테스터',
      gender: 'M',
      campus: 'CHUNCHEON',
      collegeCode: 'IT',
      birthYear: 2002,
    } as const;
    const authUser = {
      id: 'user-1',
      sessionId: 'session-1',
      gender: 'M',
      campus: 'CHUNCHEON',
    } as const;

    registrationUseCases.validateSignupDraft.mockResolvedValueOnce({ success: true });
    registrationUseCases.signup.mockResolvedValueOnce({
      success: true,
      accessToken: 'signup-token',
    });
    credentialUseCases.login.mockResolvedValueOnce({ success: true, accessToken: 'login-token' });
    credentialUseCases.resetPassword.mockResolvedValueOnce({ success: true });
    credentialUseCases.changePassword.mockResolvedValueOnce({
      success: true,
      accessToken: 'changed-token',
      rememberMe: true,
    });
    sessionUseCases.renewSession.mockResolvedValueOnce({
      success: true,
      accessToken: 'renewed-token',
      renewalToken: 'next-renewal-token',
      rememberMe: true,
    });
    sessionUseCases.logout.mockResolvedValueOnce({ success: true });

    await expect(
      service.validateSignupDraft({
        email: 'test@kangwon.ac.kr',
        password: 'Pass1234',
        nickname: '테스터',
      }),
    ).resolves.toEqual({ success: true });
    await expect(service.signup(signupInput as never)).resolves.toEqual({
      success: true,
      accessToken: 'signup-token',
    });
    await expect(
      service.login('test@kangwon.ac.kr', 'Pass1234', true, requestContext),
    ).resolves.toEqual({ success: true, accessToken: 'login-token' });
    await expect(
      service.resetPassword('test@kangwon.ac.kr', 'NewPass1234', requestContext),
    ).resolves.toEqual({ success: true });
    await expect(
      service.changePassword(authUser, 'OldPass1234', 'NewPass1234', requestContext),
    ).resolves.toEqual({ success: true, accessToken: 'changed-token', rememberMe: true });
    await expect(service.renewSession('renewal-token', requestContext)).resolves.toEqual({
      success: true,
      accessToken: 'renewed-token',
      renewalToken: 'next-renewal-token',
      rememberMe: true,
    });
    await expect(service.logout('access-token', 'renewal-token', requestContext)).resolves.toEqual({
      success: true,
    });

    expect(registrationUseCases.validateSignupDraft).toHaveBeenCalledWith({
      email: 'test@kangwon.ac.kr',
      password: 'Pass1234',
      nickname: '테스터',
    });
    expect(registrationUseCases.signup).toHaveBeenCalledWith(signupInput);
    expect(credentialUseCases.login).toHaveBeenCalledWith(
      'test@kangwon.ac.kr',
      'Pass1234',
      true,
      requestContext,
    );
    expect(credentialUseCases.resetPassword).toHaveBeenCalledWith(
      'test@kangwon.ac.kr',
      'NewPass1234',
      requestContext,
    );
    expect(credentialUseCases.changePassword).toHaveBeenCalledWith(
      authUser,
      'OldPass1234',
      'NewPass1234',
      requestContext,
    );
    expect(sessionUseCases.renewSession).toHaveBeenCalledWith('renewal-token', requestContext);
    expect(sessionUseCases.logout).toHaveBeenCalledWith(
      'access-token',
      'renewal-token',
      requestContext,
    );
  });
});
