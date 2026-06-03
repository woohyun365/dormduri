import { createHash } from 'node:crypto';
import { AuthSessionService } from './auth-session.service.js';

function hashTokenForTest(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function makeOpaqueToken(sessionId: string, secret: string = 'a'.repeat(43)) {
  return `v1.${sessionId}.${secret}`;
}

const activeSessionUser = {
  id: 'user-1',
  email: 'test@kangwon.ac.kr',
  gender: 'M' as const,
  campus: 'CHUNCHEON' as const,
  deletedAt: null,
  displayIdentity: {
    userId: 'user-1',
    nickname: '테스터',
  },
};

describe('AuthSessionService', () => {
  const prisma = {
    authSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    getDatabaseNow: jest.fn(),
    runSerializableTransaction: jest.fn(),
  };

  const service = new AuthSessionService(prisma as never);

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

    expect(prisma.authSession.create).not.toHaveBeenCalled();
    expect(prisma.authSession.findUnique).not.toHaveBeenCalled();
  });

  it('세션 row를 생성하고 opaque access token과 renewal token family seed를 발급한다', async () => {
    prisma.authSession.create.mockImplementation((input: { data: { id: string } }) => ({
      id: input.data.id,
    }));

    const authResult = await service.issueAuthResult('user-1', 'test@kangwon.ac.kr', true);

    expect(authResult.accessToken).toMatch(new RegExp(`^v1\\.${authResult.sessionId}\\.`));
    expect(authResult.sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(authResult.renewalToken?.startsWith(`v1.${authResult.sessionId}.`)).toBe(true);
    expect(authResult.accessToken.split('.')[2]).toHaveLength(43);
    expect(authResult.renewalToken?.split('.')[2]).toHaveLength(43);

    const [createCall] = prisma.authSession.create.mock.calls as Array<
      [
        {
          data: {
            id: string;
            userId: string;
            rememberMe: boolean;
            sessionTokenHash: string;
            sessionTokenExpiresAt: Date;
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
    expect(createCall[0].data.sessionTokenHash).toBe(hashTokenForTest(authResult.accessToken));
    expect(createCall[0].data.sessionTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createCall[0].data.sessionTokenExpiresAt).toEqual(new Date('2026-04-23T00:15:00.000Z'));
    expect(createCall[0].data.refreshTokenHash).toBe(
      hashTokenForTest(authResult.renewalToken ?? ''),
    );
    expect(createCall[0].data).not.toHaveProperty('accessToken');
    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
  });

  it('rememberMe가 꺼진 세션은 renewal token hash를 저장하지 않는다', async () => {
    prisma.authSession.create.mockImplementation((input: { data: { id: string } }) => ({
      id: input.data.id,
    }));

    const authResult = await service.issueAuthResult('user-1', 'test@kangwon.ac.kr', false);

    expect(authResult.accessToken).toMatch(new RegExp(`^v1\\.${authResult.sessionId}\\.`));
    expect(authResult.renewalToken).toBeUndefined();
    const [createCall] = prisma.authSession.create.mock.calls as Array<
      [
        {
          data: {
            sessionTokenHash: string;
            sessionTokenExpiresAt: Date;
            refreshTokenHash?: string;
          };
        },
      ]
    >;
    expect(createCall?.[0].data.sessionTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createCall?.[0].data.sessionTokenExpiresAt).toEqual(
      new Date('2026-04-23T00:15:00.000Z'),
    );
    expect(createCall?.[0].data.refreshTokenHash).toBeUndefined();
    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
  });

  it('renewSession은 renewal token과 opaque access token hash를 함께 rotate한다', async () => {
    const renewalToken = makeOpaqueToken('session-1');
    const renewalTokenHash = hashTokenForTest(renewalToken);
    prisma.authSession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      rememberMe: true,
      refreshTokenHash: renewalTokenHash,
      sessionTokenExpiresAt: new Date('2099-04-30T00:00:00.000Z'),
      expiresAt: new Date('2099-04-30T00:00:00.000Z'),
      revokedAt: null,
      user: {
        deletedAt: null,
        displayIdentity: { userId: 'user-1' },
      },
    });
    prisma.authSession.updateMany.mockResolvedValue({ count: 1 });

    const renewalResult = await service.renewSession(renewalToken);

    expect(renewalResult.success).toBe(true);
    expect(renewalResult.accessToken).toMatch(/^v1\.session-1\./);
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
          data: {
            refreshTokenHash: string;
            sessionTokenHash: string;
            sessionTokenExpiresAt: Date;
          };
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
    expect(rotationCall[0].data.sessionTokenHash).toBe(
      hashTokenForTest(renewalResult.accessToken ?? ''),
    );
    expect(rotationCall[0].data.sessionTokenExpiresAt).toEqual(
      new Date('2026-04-23T00:15:00.000Z'),
    );
  });

  it('renewSession old token reuse는 token family를 revoke하고 재로그인을 요구한다', async () => {
    const oldRenewalToken = makeOpaqueToken('session-1', 'b'.repeat(43));
    const rotatedRenewalTokenHash = hashTokenForTest(makeOpaqueToken('session-1', 'c'.repeat(43)));
    prisma.authSession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      rememberMe: true,
      refreshTokenHash: rotatedRenewalTokenHash,
      sessionTokenExpiresAt: new Date('2099-04-30T00:00:00.000Z'),
      expiresAt: new Date('2099-04-30T00:00:00.000Z'),
      revokedAt: null,
      user: {
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
  });

  it('renewSession rotation race는 logout/reset/delete revoke가 먼저 반영되면 fail-closed 처리한다', async () => {
    const renewalToken = makeOpaqueToken('session-1', 'd'.repeat(43));
    const renewalTokenHash = hashTokenForTest(renewalToken);
    prisma.authSession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      rememberMe: true,
      refreshTokenHash: renewalTokenHash,
      sessionTokenExpiresAt: new Date('2099-04-30T00:00:00.000Z'),
      expiresAt: new Date('2099-04-30T00:00:00.000Z'),
      revokedAt: null,
      user: {
        deletedAt: null,
        displayIdentity: { userId: 'user-1' },
      },
    });
    prisma.authSession.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.renewSession(renewalToken)).resolves.toMatchObject({
      success: false,
      code: 'AUTH_SESSION_RENEWAL_REQUIRED',
    });
  });

  it.each([
    [
      'rememberMe=false',
      {
        rememberMe: false,
        refreshTokenHash: hashTokenForTest(makeOpaqueToken('session-1')),
        sessionTokenExpiresAt: new Date('2099-04-30T00:00:00.000Z'),
        expiresAt: new Date('2099-04-30T00:00:00.000Z'),
        revokedAt: null,
        user: {
          deletedAt: null,
          displayIdentity: { userId: 'user-1' },
        },
      },
    ],
    [
      'expired',
      {
        rememberMe: true,
        refreshTokenHash: hashTokenForTest(makeOpaqueToken('session-1')),
        expiresAt: new Date('2026-04-23T00:00:00.000Z'),
        revokedAt: null,
        user: {
          deletedAt: null,
          displayIdentity: { userId: 'user-1' },
        },
      },
    ],
    [
      'revoked',
      {
        rememberMe: true,
        refreshTokenHash: hashTokenForTest(makeOpaqueToken('session-1')),
        sessionTokenExpiresAt: new Date('2099-04-30T00:00:00.000Z'),
        expiresAt: new Date('2099-04-30T00:00:00.000Z'),
        revokedAt: new Date('2026-04-22T00:00:00.000Z'),
        user: {
          deletedAt: null,
          displayIdentity: { userId: 'user-1' },
        },
      },
    ],
    [
      'deleted user',
      {
        rememberMe: true,
        refreshTokenHash: hashTokenForTest(makeOpaqueToken('session-1')),
        sessionTokenExpiresAt: new Date('2099-04-30T00:00:00.000Z'),
        expiresAt: new Date('2099-04-30T00:00:00.000Z'),
        revokedAt: null,
        user: {
          deletedAt: new Date('2026-04-22T00:00:00.000Z'),
          displayIdentity: { userId: 'user-1' },
        },
      },
    ],
    [
      'missing display identity',
      {
        rememberMe: true,
        refreshTokenHash: hashTokenForTest(makeOpaqueToken('session-1')),
        sessionTokenExpiresAt: new Date('2099-04-30T00:00:00.000Z'),
        expiresAt: new Date('2099-04-30T00:00:00.000Z'),
        revokedAt: null,
        user: {
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

    await expect(service.renewSession(makeOpaqueToken('session-1'))).resolves.toMatchObject({
      success: false,
      code: 'AUTH_SESSION_RENEWAL_REQUIRED',
    });

    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
  });

  it('renewSession은 malformed renewal token이면 session row를 조회하지 않는다', async () => {
    await expect(service.renewSession('v1.session-1.short')).resolves.toMatchObject({
      success: false,
      code: 'AUTH_SESSION_RENEWAL_REQUIRED',
    });

    expect(prisma.runSerializableTransaction).not.toHaveBeenCalled();
    expect(prisma.authSession.findUnique).not.toHaveBeenCalled();
  });

  it('유효한 opaque token이면 현재 사용자 세션을 조회한다', async () => {
    const accessToken = makeOpaqueToken('session-1');
    prisma.authSession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      sessionTokenExpiresAt: new Date('2099-04-30T00:00:00.000Z'),
      expiresAt: new Date('2099-04-30T00:00:00.000Z'),
      revokedAt: null,
      user: activeSessionUser,
    });

    await expect(service.getSession(accessToken)).resolves.toMatchObject({
      authenticated: true,
      user: {
        id: 'user-1',
        email: 'test@kangwon.ac.kr',
        nickname: '테스터',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
    });

    expect(prisma.authSession.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionTokenHash: hashTokenForTest(accessToken) },
      }),
    );
  });

  it('old JWT-like token은 인증 실패 처리하고 session row를 조회하지 않는다', async () => {
    await expect(service.getSession('eyJhbGciOiJIUzI1NiJ9.payload.signature')).resolves.toEqual({
      authenticated: false,
    });

    expect(prisma.authSession.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    [
      'revoked',
      {
        sessionTokenExpiresAt: new Date('2099-04-30T00:00:00.000Z'),
        expiresAt: new Date('2099-04-30T00:00:00.000Z'),
        revokedAt: new Date('2026-04-22T00:00:00.000Z'),
      },
    ],
    [
      'access-token-expired',
      {
        sessionTokenExpiresAt: new Date('2026-04-22T23:59:59.000Z'),
        expiresAt: new Date('2099-04-30T00:00:00.000Z'),
        revokedAt: null,
      },
    ],
    [
      'absolute-session-expired',
      {
        sessionTokenExpiresAt: new Date('2099-04-30T00:00:00.000Z'),
        expiresAt: new Date('2026-04-22T23:59:59.000Z'),
        revokedAt: null,
      },
    ],
    [
      'legacy-session-without-access-token-hash-expiry',
      {
        sessionTokenExpiresAt: null,
        expiresAt: new Date('2099-04-30T00:00:00.000Z'),
        revokedAt: null,
      },
    ],
  ])('opaque access session resolve는 %s 상태를 fail-closed 처리한다', async (_label, state) => {
    prisma.authSession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      ...state,
      user: activeSessionUser,
    });

    await expect(service.getSession(makeOpaqueToken('session-1'))).resolves.toEqual({
      authenticated: false,
    });
  });

  it('삭제 처리된 사용자는 유효한 opaque token이 있어도 세션 인증에서 제외한다', async () => {
    prisma.authSession.findUnique.mockResolvedValue({
      id: 'session-deleted',
      userId: 'user-deleted',
      sessionTokenExpiresAt: new Date('2099-04-30T00:00:00.000Z'),
      expiresAt: new Date('2099-04-30T00:00:00.000Z'),
      revokedAt: null,
      user: {
        ...activeSessionUser,
        id: 'user-deleted',
        email: 'deleted@kangwon.ac.kr',
        deletedAt: new Date('2026-05-12T00:00:00.000Z'),
      },
    });

    await expect(service.getSession(makeOpaqueToken('session-deleted'))).resolves.toEqual({
      authenticated: false,
    });
  });

  it('display identity가 없는 사용자는 유효한 opaque token이 있어도 세션 인증에서 제외한다', async () => {
    prisma.authSession.findUnique.mockResolvedValue({
      id: 'session-missing-identity',
      userId: 'user-missing-identity',
      sessionTokenExpiresAt: new Date('2099-04-30T00:00:00.000Z'),
      expiresAt: new Date('2099-04-30T00:00:00.000Z'),
      revokedAt: null,
      user: {
        ...activeSessionUser,
        id: 'user-missing-identity',
        email: 'missing-identity@kangwon.ac.kr',
        displayIdentity: null,
      },
    });

    await expect(service.getSession(makeOpaqueToken('session-missing-identity'))).resolves.toEqual({
      authenticated: false,
    });
  });

  it('authenticated user context는 현재 session id를 포함한다', async () => {
    prisma.authSession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      sessionTokenExpiresAt: new Date('2099-04-30T00:00:00.000Z'),
      expiresAt: new Date('2099-04-30T00:00:00.000Z'),
      revokedAt: null,
      user: activeSessionUser,
    });

    await expect(service.resolveCurrentUserContext(makeOpaqueToken('session-1'))).resolves.toEqual({
      id: 'user-1',
      sessionId: 'session-1',
      gender: 'M',
      campus: 'CHUNCHEON',
    });
  });

  it('logout은 access token hash가 가리키는 session만 revoke한다', async () => {
    const accessToken = makeOpaqueToken('session-1');
    prisma.authSession.findUnique.mockResolvedValue({ id: 'session-1' });
    prisma.authSession.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.logout(accessToken)).resolves.toEqual({ success: true });

    expect(prisma.authSession.findUnique).toHaveBeenCalledWith({
      where: { sessionTokenHash: hashTokenForTest(accessToken) },
      select: { id: true },
    });
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

  it('logout은 forged opaque access token의 session id만 믿고 revoke하지 않는다', async () => {
    prisma.authSession.findUnique.mockResolvedValue(null);

    await expect(service.logout(makeOpaqueToken('session-1', 'z'.repeat(43)))).resolves.toEqual({
      success: true,
    });

    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
  });

  it('logout은 old JWT-like token이면 session row를 조회하지 않고 cookie clear 성공만 반환한다', async () => {
    await expect(service.logout('eyJhbGciOiJIUzI1NiJ9.payload.signature')).resolves.toEqual({
      success: true,
    });

    expect(prisma.authSession.findUnique).not.toHaveBeenCalled();
    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
  });

  it('logout은 access token이 없어도 current renewal token hash가 일치하면 revoke한다', async () => {
    const renewalToken = makeOpaqueToken('session-1');
    prisma.authSession.findUnique.mockResolvedValue({
      id: 'session-1',
      refreshTokenHash: hashTokenForTest(renewalToken),
    });
    prisma.authSession.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.logout(null, renewalToken)).resolves.toEqual({
      success: true,
    });

    expect(prisma.authSession.findUnique).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      select: { id: true, refreshTokenHash: true },
    });
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

  it('logout은 forged renewal token의 session id만 믿고 revoke하지 않는다', async () => {
    prisma.authSession.findUnique.mockResolvedValue({
      id: 'session-1',
      refreshTokenHash: hashTokenForTest(makeOpaqueToken('session-1', 'a'.repeat(43))),
    });

    await expect(
      service.logout(null, makeOpaqueToken('session-1', 'b'.repeat(43))),
    ).resolves.toEqual({
      success: true,
    });

    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
  });
});
