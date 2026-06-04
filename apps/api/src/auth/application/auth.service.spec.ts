import { AuthService } from './auth.service.js';

describe('AuthService facade', () => {
  const useCases = {
    sendSignupCode: jest.fn(),
    sendResetCode: jest.fn(),
    verifyEmailCode: jest.fn(),
    verifyResetCode: jest.fn(),
    getSession: jest.fn(),
    validateSignupDraft: jest.fn(),
    signup: jest.fn(),
    login: jest.fn(),
    resetPassword: jest.fn(),
    changePassword: jest.fn(),
    renewSession: jest.fn(),
    logout: jest.fn(),
  };
  const service = new AuthService(useCases as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates verification and session read use cases without owning domain behavior', async () => {
    const requestContext = { requestIp: '127.0.0.1', userAgent: 'jest' };
    useCases.sendSignupCode.mockResolvedValueOnce({ success: true });
    useCases.sendResetCode.mockResolvedValueOnce({ success: true });
    useCases.verifyEmailCode.mockResolvedValueOnce({ success: true });
    useCases.verifyResetCode.mockResolvedValueOnce({ success: true });
    useCases.getSession.mockResolvedValueOnce({ authenticated: false });
    useCases.validateSignupDraft.mockResolvedValueOnce({ success: true });

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
    await expect(
      service.validateSignupDraft({
        email: 'test@kangwon.ac.kr',
        password: 'Pass1234',
        nickname: '테스터',
      }),
    ).resolves.toEqual({ success: true });

    expect(useCases.sendSignupCode).toHaveBeenCalledWith('test@kangwon.ac.kr', requestContext);
    expect(useCases.sendResetCode).toHaveBeenCalledWith('test@kangwon.ac.kr', requestContext);
    expect(useCases.verifyEmailCode).toHaveBeenCalledWith(
      'test@kangwon.ac.kr',
      '123456',
      requestContext,
    );
    expect(useCases.verifyResetCode).toHaveBeenCalledWith(
      'test@kangwon.ac.kr',
      '123456',
      requestContext,
    );
    expect(useCases.getSession).toHaveBeenCalledWith('access-token', requestContext);
    expect(useCases.validateSignupDraft).toHaveBeenCalledWith({
      email: 'test@kangwon.ac.kr',
      password: 'Pass1234',
      nickname: '테스터',
    });
  });

  it('delegates mutating auth use cases without direct Prisma/session/security-event orchestration', async () => {
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

    useCases.signup.mockResolvedValueOnce({ success: true, accessToken: 'signup-token' });
    useCases.login.mockResolvedValueOnce({ success: true, accessToken: 'login-token' });
    useCases.resetPassword.mockResolvedValueOnce({ success: true });
    useCases.changePassword.mockResolvedValueOnce({
      success: true,
      accessToken: 'changed-token',
      rememberMe: true,
    });
    useCases.renewSession.mockResolvedValueOnce({
      success: true,
      accessToken: 'renewed-token',
      renewalToken: 'next-renewal-token',
      rememberMe: true,
    });
    useCases.logout.mockResolvedValueOnce({ success: true });

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

    expect(useCases.signup).toHaveBeenCalledWith(signupInput);
    expect(useCases.login).toHaveBeenCalledWith(
      'test@kangwon.ac.kr',
      'Pass1234',
      true,
      requestContext,
    );
    expect(useCases.resetPassword).toHaveBeenCalledWith(
      'test@kangwon.ac.kr',
      'NewPass1234',
      requestContext,
    );
    expect(useCases.changePassword).toHaveBeenCalledWith(
      authUser,
      'OldPass1234',
      'NewPass1234',
      requestContext,
    );
    expect(useCases.renewSession).toHaveBeenCalledWith('renewal-token', requestContext);
    expect(useCases.logout).toHaveBeenCalledWith('access-token', 'renewal-token', requestContext);
  });
});
