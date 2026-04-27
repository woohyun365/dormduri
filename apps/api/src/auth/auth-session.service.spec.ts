import { AuthSessionService } from './auth-session.service.js';

describe('AuthSessionService', () => {
  const prisma = {
    authSession: {
      updateMany: jest.fn(),
    },
    getDatabaseNow: jest.fn(),
    user: {
      findUnique: jest.fn(),
    },
    $queryRawTyped: jest.fn(),
    $queryRaw: jest.fn(),
  };

  const jwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const service = new AuthSessionService(prisma as never, jwtService as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.getDatabaseNow.mockResolvedValue(new Date('2026-04-23T00:00:00.000Z'));
  });

  it('토큰이 없으면 인증되지 않은 세션을 반환한다', async () => {
    await expect(service.getSession(null)).resolves.toEqual({ authenticated: false });

    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.$queryRawTyped).not.toHaveBeenCalled();
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
    prisma.$queryRawTyped.mockResolvedValue([{ userId: 'user-1' }]);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@kangwon.ac.kr',
      gender: 'M',
      campus: 'CHUNCHEON',
      profile: {
        nickname: '테스터',
      },
    });

    await expect(service.getSession('token')).resolves.toMatchObject({
      authenticated: true,
      user: {
        id: 'user-1',
        email: 'test@kangwon.ac.kr',
        nickname: '테스터',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
    });

    expect(prisma.$queryRawTyped).toHaveBeenCalled();
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
      }),
    );
  });

  it('logout은 session id가 있으면 session revoke updateMany를 실행한다', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sid: 'session-1' });
    prisma.authSession.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.logout('token')).resolves.toEqual({ success: true });

    expect(prisma.authSession.updateMany).toHaveBeenCalled();
  });
});
