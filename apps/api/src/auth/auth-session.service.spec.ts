import { AuthSessionService } from './auth-session.service.js';

describe('AuthSessionService', () => {
  const prisma = {
    authSession: {
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    getDatabaseNow: jest.fn(),
    user: {
      findUnique: jest.fn(),
    },
    $queryRawTyped: jest.fn(),
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
    expect(prisma.authSession.create).not.toHaveBeenCalled();
    expect(prisma.$queryRawTyped).not.toHaveBeenCalled();
  });

  it('세션 row를 생성하고 access token을 발급한다', async () => {
    prisma.authSession.create.mockResolvedValue({ id: 'session-1' });
    jwtService.signAsync.mockResolvedValue('access-token');

    await expect(service.issueAuthResult('user-1', 'test@kangwon.ac.kr', true)).resolves.toEqual({
      accessToken: 'access-token',
      sessionId: 'session-1',
    });

    const [createCall] = prisma.authSession.create.mock.calls as Array<
      [
        {
          data: { userId: string; rememberMe: boolean; expiresAt: Date };
          select: { id: true };
        },
      ]
    >;
    expect(createCall).toBeDefined();
    if (!createCall) {
      throw new Error('Expected authSession.create call');
    }
    expect(createCall[0]).toMatchObject({
      data: { userId: 'user-1', rememberMe: true },
      select: { id: true },
    });
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
      displayIdentity: {
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

  it('삭제 처리된 사용자는 유효한 토큰이 있어도 세션 인증에서 제외한다', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sid: 'session-deleted', sub: 'user-deleted' });
    prisma.$queryRawTyped.mockResolvedValue([{ userId: 'user-deleted' }]);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-deleted',
      email: 'deleted@kangwon.ac.kr',
      deletedAt: new Date('2026-05-12T00:00:00.000Z'),
      gender: 'M',
      campus: 'CHUNCHEON',
      displayIdentity: {
        nickname: '탈퇴한 사용자',
      },
    });

    await expect(service.getSession('token')).resolves.toEqual({ authenticated: false });
  });

  it('display identity가 없는 사용자는 유효한 토큰이 있어도 세션 인증에서 제외하고 nickname fallback을 쓰지 않는다', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sid: 'session-missing-identity',
      sub: 'user-missing-identity',
    });
    prisma.$queryRawTyped.mockResolvedValue([{ userId: 'user-missing-identity' }]);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-missing-identity',
      email: 'missing-identity@kangwon.ac.kr',
      deletedAt: null,
      gender: 'M',
      campus: 'CHUNCHEON',
      nickname: 'account-level-nickname',
      displayIdentity: null,
    });

    await expect(service.getSession('token')).resolves.toEqual({ authenticated: false });
  });

  it('삭제 처리된 사용자는 authenticated user context도 반환하지 않는다', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sid: 'session-deleted', sub: 'user-deleted' });
    prisma.$queryRawTyped.mockResolvedValue([{ userId: 'user-deleted' }]);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-deleted',
      deletedAt: new Date('2026-05-12T00:00:00.000Z'),
      gender: 'M',
      campus: 'CHUNCHEON',
      displayIdentity: {
        userId: 'user-deleted',
      },
    });

    await expect(service.resolveCurrentUserContext('token')).resolves.toBeNull();
  });

  it('authenticated user context는 현재 session id를 포함한다', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sid: 'session-1', sub: 'user-1' });
    prisma.$queryRawTyped.mockResolvedValue([{ userId: 'user-1' }]);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      deletedAt: null,
      gender: 'M',
      campus: 'CHUNCHEON',
      displayIdentity: {
        userId: 'user-1',
      },
    });

    await expect(service.resolveCurrentUserContext('token')).resolves.toEqual({
      id: 'user-1',
      sessionId: 'session-1',
      gender: 'M',
      campus: 'CHUNCHEON',
    });
  });

  it('display identity가 없는 사용자는 current-user context로도 복원하지 않는다', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sid: 'session-missing-identity',
      sub: 'user-missing-identity',
    });
    prisma.$queryRawTyped.mockResolvedValue([{ userId: 'user-missing-identity' }]);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-missing-identity',
      deletedAt: null,
      gender: 'M',
      campus: 'CHUNCHEON',
      displayIdentity: null,
    });

    await expect(service.resolveCurrentUserContext('token')).resolves.toBeNull();
  });

  it('logout은 session id가 있으면 session revoke updateMany를 실행한다', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sid: 'session-1' });
    prisma.authSession.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.logout('token')).resolves.toEqual({ success: true });

    expect(prisma.authSession.updateMany).toHaveBeenCalled();
  });
});
