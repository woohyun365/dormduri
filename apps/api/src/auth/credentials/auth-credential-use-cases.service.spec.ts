import { AuthCredentialUseCases } from './auth-credential-use-cases.service.js';

describe('AuthCredentialUseCases', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
  };
  const loginAttemptService = {
    getActiveLock: jest.fn(),
    recordLoginFailure: jest.fn(),
    clearFailures: jest.fn(),
  };
  const sessionService = {
    issueAuthResult: jest.fn(),
  };
  const verificationService = {
    findLatestVerifiedResetCode: jest.fn(),
  };
  const securityEvents = {
    recordSafely: jest.fn(),
  };
  const useCases = new AuthCredentialUseCases(
    prisma as never,
    loginAttemptService as never,
    sessionService as never,
    verificationService as never,
    securityEvents as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    loginAttemptService.getActiveLock.mockResolvedValue(null);
    loginAttemptService.recordLoginFailure.mockResolvedValue({
      success: false,
      code: 'AUTH_INVALID_CREDENTIALS',
    });
  });

  it('login은 request context가 없으면 login command에 legacy 호출 shape를 유지한다', async () => {
    loginAttemptService.getActiveLock.mockResolvedValueOnce({
      success: false,
      code: 'AUTH_LOGIN_LOCKED',
      locked: true,
    });

    await expect(useCases.login('test@kangwon.ac.kr', 'Pass1234', false)).resolves.toMatchObject({
      success: false,
      code: 'AUTH_LOGIN_LOCKED',
    });

    expect(loginAttemptService.getActiveLock).toHaveBeenCalledWith('test@kangwon.ac.kr');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('login은 request context가 있으면 login command에 audit context를 전달한다', async () => {
    const requestContext = { requestIp: '127.0.0.1', userAgent: 'jest' };
    loginAttemptService.getActiveLock.mockResolvedValueOnce({
      success: false,
      code: 'AUTH_LOGIN_LOCKED',
      locked: true,
    });

    await expect(
      useCases.login('test@kangwon.ac.kr', 'Pass1234', false, requestContext),
    ).resolves.toMatchObject({
      success: false,
      code: 'AUTH_LOGIN_LOCKED',
    });

    expect(loginAttemptService.getActiveLock).toHaveBeenCalledWith(
      'test@kangwon.ac.kr',
      requestContext,
    );
  });

  it('reset/change password는 owning command에 필요한 dependencies를 조립한다', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);

    await expect(
      useCases.resetPassword('missing@kangwon.ac.kr', 'NewPass1234'),
    ).resolves.toMatchObject({
      success: false,
      code: 'AUTH_RESET_RESTART_REQUIRED',
    });
    await expect(
      useCases.changePassword(
        { id: 'user-1', gender: 'M', campus: 'CHUNCHEON' },
        'OldPass1234',
        'NewPass1234',
      ),
    ).resolves.toMatchObject({
      success: false,
      code: 'AUTH_REAUTHENTICATION_REQUIRED',
    });

    expect(verificationService.findLatestVerifiedResetCode).not.toHaveBeenCalled();
    expect(sessionService.issueAuthResult).not.toHaveBeenCalled();
  });
});
