import { AuthSessionService } from './auth-session.service.js';

describe('AuthSessionService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  };

  const jwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const service = new AuthSessionService(prisma as never, jwtService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('토큰이 없으면 인증되지 않은 세션을 반환한다', async () => {
    await expect(service.getSession(null)).resolves.toEqual({ authenticated: false });

    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('세션 row를 생성하고 access token을 발급한다', async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: 'session-1' }]);
    jwtService.signAsync.mockResolvedValue('access-token');

    await expect(service.issueAuthResult('user-1', 'test@kangwon.ac.kr', true)).resolves.toEqual({
      accessToken: 'access-token',
      sessionId: 'session-1',
    });

    expect(prisma.$queryRaw).toHaveBeenCalled();
    const [payload, options] = jwtService.signAsync.mock.calls[0] as [
      { sub: string; email: string; sid: string },
      { expiresIn: number },
    ];
    expect(payload).toEqual({
      sub: 'user-1',
      email: 'test@kangwon.ac.kr',
      sid: 'session-1',
    });
    expect(options.expiresIn).toEqual(expect.any(Number));
  });

  it('유효한 토큰이면 현재 사용자 세션을 조회한다', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sid: 'session-1', sub: 'user-1' });
    prisma.$queryRaw.mockResolvedValue([{ userId: 'user-1' }]);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@kangwon.ac.kr',
      nickname: '테스터',
      gender: 'M',
      campus: 'CHUNCHEON',
      lifestyle: {
        bedtime: '22_24',
        wakeTime: '07_08',
        sleepHabit: 'NONE',
        sleepEnvironment: 'QUIET',
        screenUsage: 'NONE',
        noiseSensitivity: 'NORMAL',
        smokingBehavior: 'NO',
        indoorEating: 'SNACK',
        phoneBehavior: 'SOMETIMES',
        earphoneUsage: 'MOSTLY',
        cleanLevel: 'WEEKLY_3_UP',
        drinkingFrequency: 'NONE',
        relationshipStyle: 'CLOSE',
        temperatureSensitivity: 'NORMAL',
        smokingTolerance: null,
        phoneTolerance: null,
        earphoneExpectation: null,
        sleepEnvPreference: null,
        screenTolerance: null,
        indoorEatingTolerance: null,
        cleanExpectation: null,
        drinkingTolerance: 'LOW_ONLY',
      },
      intro: '안녕하세요',
      dormitoryId: null,
      dormitorySelectionState: 'NOT_SELECTED',
    });

    await expect(service.getSession('token')).resolves.toMatchObject({
      authenticated: true,
      user: {
        id: 'user-1',
        email: 'test@kangwon.ac.kr',
      },
    });

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
      }),
    );
  });

  it('logout은 session id가 있으면 revoke 쿼리를 실행한다', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sid: 'session-1' });
    prisma.$executeRaw.mockResolvedValue(1);

    await expect(service.logout('token')).resolves.toEqual({ success: true });

    expect(prisma.$executeRaw).toHaveBeenCalled();
  });
});
