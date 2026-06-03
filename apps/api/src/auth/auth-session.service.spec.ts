import { AuthSessionService } from './auth-session.service.js';
import { createHash } from 'node:crypto';

function hashRenewalTokenForTest(renewalToken: string) {
  return createHash('sha256').update(renewalToken).digest('hex');
}

function makeRenewalToken(sessionId: string, secret: string = 'a'.repeat(43)) {
  return `v1.${sessionId}.${secret}`;
}

describe('AuthSessionService', () => {
  const prisma = {
    authSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    getDatabaseNow: jest.fn(),
    runSerializableTransaction: jest.fn(),
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
    prisma.runSerializableTransaction.mockImplementation((callback: (tx: unknown) => unknown) =>
      callback({
        authSession: {
          findUnique: prisma.authSession.findUnique,
          updateMany: prisma.authSession.updateMany,
        },
      }),
    );
  });

  it('토큰이 없으면 인증되지 않은 세션을 반환한다', async () => {
    await expect(service.getSession(null)).resolves.toEqual({ authenticated: false });

    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    expect(prisma.authSession.create).not.toHaveBeenCalled();
    expect(prisma.$queryRawTyped).not.toHaveBeenCalled();
  });

  it('세션 row를 생성하고 access token과 renewal token family seed를 발급한다', async () => {
    prisma.authSession.create.mockImplementation((input: { data: { id: string } }) => ({
      id: input.data.id,
    }));
    jwtService.signAsync.mockResolvedValue('access-token');

    const authResult = await service.issueAuthResult('user-1', 'test@kangwon.ac.kr', true);

    expect(authResult.accessToken).toBe('access-token');
    expect(authResult.sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(authResult.renewalToken?.startsWith(`v1.${authResult.sessionId}.`)).toBe(true);
    expect(authResult.renewalToken?.split('.')[2]).toHaveLength(43);

    const [createCall] = prisma.authSession.create.mock.calls as Array<
      [
        {
          data: {
            id: string;
            userId: string;
            rememberMe: boolean;
            refreshTokenHash: string;
            expiresAt: Date;
          };
          select: { id: true };
        },
      ]
    >;
    expect(createCall).toBeDefined();
    if (!createCall) {
      throw new Error('Expected authSession.create call');
    }
    expect(createCall[0]).toMatchObject({
      data: {
        id: authResult.sessionId,
        userId: 'user-1',
        rememberMe: true,
      },
      select: { id: true },
    });
    expect(createCall[0].data.refreshTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
    const [payload, options] = jwtService.signAsync.mock.calls[0] as [
      { sub: string; email: string; sid: string },
      { expiresIn: number },
    ];
    expect(payload).toEqual({
      sub: 'user-1',
      email: 'test@kangwon.ac.kr',
      sid: authResult.sessionId,
    });
    expect(options.expiresIn).toEqual(expect.any(Number));
  });

  it('rememberMe가 꺼진 세션은 renewal token hash를 저장하지 않는다', async () => {
    prisma.authSession.create.mockImplementation((input: { data: { id: string } }) => ({
      id: input.data.id,
    }));
    jwtService.signAsync.mockResolvedValue('access-token');

    const authResult = await service.issueAuthResult('user-1', 'test@kangwon.ac.kr', false);

    expect(authResult.accessToken).toBe('access-token');
    expect(authResult.renewalToken).toBeUndefined();
    const [createCall] = prisma.authSession.create.mock.calls as Array<
      [
        {
          data: { refreshTokenHash?: string };
        },
      ]
    >;
    expect(createCall?.[0].data.refreshTokenHash).toBeUndefined();
    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
  });

  it('renewSession은 renewal token을 rotate하고 새 access token을 발급한다', async () => {
    const renewalToken = makeRenewalToken('session-1');
    const renewalTokenHash = hashRenewalTokenForTest(renewalToken);
    prisma.authSession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      rememberMe: true,
      refreshTokenHash: renewalTokenHash,
      expiresAt: new Date('2026-04-30T00:00:00.000Z'),
      revokedAt: null,
      user: {
        email: 'test@kangwon.ac.kr',
        deletedAt: null,
        displayIdentity: { userId: 'user-1' },
      },
    });
    prisma.authSession.updateMany.mockResolvedValue({ count: 1 });
    jwtService.signAsync.mockResolvedValue('renewed-access-token');

    const renewalResult = await service.renewSession(renewalToken);

    expect(renewalResult.success).toBe(true);
    expect(renewalResult.accessToken).toBe('renewed-access-token');
    expect(renewalResult.renewalToken).toMatch(/^v1\.session-1\./);
    expect(renewalResult.rememberMe).toBe(true);

    const [rotationCall] = prisma.authSession.updateMany.mock.calls as Array<
      [
        {
          where: {
            id: string;
            rememberMe: boolean;
            refreshTokenHash: string;
            revokedAt: null;
            expiresAt: { gt: Date };
          };
          data: { refreshTokenHash: string };
        },
      ]
    >;
    expect(rotationCall).toBeDefined();
    if (!rotationCall) {
      throw new Error('Expected renewal rotation updateMany call');
    }
    expect(rotationCall[0].where).toEqual({
      id: 'session-1',
      rememberMe: true,
      refreshTokenHash: renewalTokenHash,
      revokedAt: null,
      expiresAt: {
        gt: new Date('2026-04-23T00:00:00.000Z'),
      },
    });
    expect(rotationCall[0].data.refreshTokenHash).toMatch(/^[a-f0-9]{64}$/);

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

  it('renewSession old token reuse는 token family를 revoke하고 재로그인을 요구한다', async () => {
    const oldRenewalToken = makeRenewalToken('session-1', 'b'.repeat(43));
    const rotatedRenewalTokenHash = hashRenewalTokenForTest(
      makeRenewalToken('session-1', 'c'.repeat(43)),
    );
    prisma.authSession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      rememberMe: true,
      refreshTokenHash: rotatedRenewalTokenHash,
      expiresAt: new Date('2026-04-30T00:00:00.000Z'),
      revokedAt: null,
      user: {
        email: 'test@kangwon.ac.kr',
        deletedAt: null,
        displayIdentity: { userId: 'user-1' },
      },
    });
    prisma.authSession.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.renewSession(oldRenewalToken)).resolves.toMatchObject({
      success: false,
      code: 'AUTH_SESSION_RENEWAL_REUSED',
    });

    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'session-1',
        revokedAt: null,
      },
      data: {
        revokedAt: new Date('2026-04-23T00:00:00.000Z'),
      },
    });
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('renewSession rotation race는 logout/reset/delete revoke가 먼저 반영되면 fail-closed 처리한다', async () => {
    const renewalToken = makeRenewalToken('session-1', 'd'.repeat(43));
    const renewalTokenHash = hashRenewalTokenForTest(renewalToken);
    prisma.authSession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      rememberMe: true,
      refreshTokenHash: renewalTokenHash,
      expiresAt: new Date('2026-04-30T00:00:00.000Z'),
      revokedAt: null,
      user: {
        email: 'test@kangwon.ac.kr',
        deletedAt: null,
        displayIdentity: { userId: 'user-1' },
      },
    });
    prisma.authSession.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.renewSession(renewalToken)).resolves.toMatchObject({
      success: false,
      code: 'AUTH_SESSION_RENEWAL_REQUIRED',
    });

    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it.each([
    [
      'rememberMe=false',
      {
        rememberMe: false,
        refreshTokenHash: hashRenewalTokenForTest(makeRenewalToken('session-1')),
        expiresAt: new Date('2026-04-30T00:00:00.000Z'),
        revokedAt: null,
        user: {
          email: 'test@kangwon.ac.kr',
          deletedAt: null,
          displayIdentity: { userId: 'user-1' },
        },
      },
    ],
    [
      'expired',
      {
        rememberMe: true,
        refreshTokenHash: hashRenewalTokenForTest(makeRenewalToken('session-1')),
        expiresAt: new Date('2026-04-23T00:00:00.000Z'),
        revokedAt: null,
        user: {
          email: 'test@kangwon.ac.kr',
          deletedAt: null,
          displayIdentity: { userId: 'user-1' },
        },
      },
    ],
    [
      'revoked',
      {
        rememberMe: true,
        refreshTokenHash: hashRenewalTokenForTest(makeRenewalToken('session-1')),
        expiresAt: new Date('2026-04-30T00:00:00.000Z'),
        revokedAt: new Date('2026-04-22T00:00:00.000Z'),
        user: {
          email: 'test@kangwon.ac.kr',
          deletedAt: null,
          displayIdentity: { userId: 'user-1' },
        },
      },
    ],
    [
      'deleted user',
      {
        rememberMe: true,
        refreshTokenHash: hashRenewalTokenForTest(makeRenewalToken('session-1')),
        expiresAt: new Date('2026-04-30T00:00:00.000Z'),
        revokedAt: null,
        user: {
          email: 'test@kangwon.ac.kr',
          deletedAt: new Date('2026-04-22T00:00:00.000Z'),
          displayIdentity: { userId: 'user-1' },
        },
      },
    ],
    [
      'missing display identity',
      {
        rememberMe: true,
        refreshTokenHash: hashRenewalTokenForTest(makeRenewalToken('session-1')),
        expiresAt: new Date('2026-04-30T00:00:00.000Z'),
        revokedAt: null,
        user: {
          email: 'test@kangwon.ac.kr',
          deletedAt: null,
          displayIdentity: null,
        },
      },
    ],
  ])('renewSession은 %s 상태를 fail-closed 처리한다', async (_label, sessionState) => {
    prisma.authSession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      ...sessionState,
    });

    await expect(service.renewSession(makeRenewalToken('session-1'))).resolves.toMatchObject({
      success: false,
      code: 'AUTH_SESSION_RENEWAL_REQUIRED',
    });

    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('renewSession은 malformed renewal token이면 session row를 조회하지 않는다', async () => {
    await expect(service.renewSession('v1.session-1.short')).resolves.toMatchObject({
      success: false,
      code: 'AUTH_SESSION_RENEWAL_REQUIRED',
    });

    expect(prisma.runSerializableTransaction).not.toHaveBeenCalled();
    expect(prisma.authSession.findUnique).not.toHaveBeenCalled();
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

  it('logout은 access token이 없어도 renewal token의 session id를 revoke 후보로 사용한다', async () => {
    prisma.authSession.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.logout(null, makeRenewalToken('session-1'))).resolves.toEqual({
      success: true,
    });

    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['session-1'] },
        revokedAt: null,
      },
      data: {
        revokedAt: new Date('2026-04-23T00:00:00.000Z'),
      },
    });
  });
});
